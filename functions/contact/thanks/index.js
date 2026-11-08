// Enquiry form handler for Cloudflare Pages.
// The form keeps posting to /contact/thanks/ exactly as it did on Netlify, so the
// HTML needs no change. A POST lands here; a GET falls through to the static page.
// Every enquiry is saved to D1 first, then emailed, so a failed email never loses a lead.

const FIELDS = ['name', 'email', 'phone', 'sms_consent', 'booking_type', 'preferred_date',
  'hours', 'headcount', 'message', 'attribution', 'subject'];

const clip = (v, n) => (v == null ? '' : String(v).trim().slice(0, n));

export async function onRequestPost({ request, env }) {
  const thanks = new URL('/contact/thanks/', request.url).toString();
  let form;
  try { form = await request.formData(); } catch { return Response.redirect(thanks, 303); }

  // Honeypot: real people never fill this. Pretend success, store nothing.
  if (clip(form.get('bot-field'), 200)) return Response.redirect(thanks, 303);

  const d = {};
  for (const f of FIELDS) d[f] = clip(form.get(f), f === 'message' ? 5000 : 500);
  if (!d.name || !d.email || !d.email.includes('@')) return Response.redirect(thanks, 303);
  d.sms_consent = d.sms_consent ? 'Yes' : 'No';
  const isTest = /\[TEST\]/i.test(d.message) ? 1 : 0;
  const subject = (isTest ? '[TEST] ' : '') + 'Website enquiry: ' + (d.subject && d.subject !== 'Can Company Warehouse enquiry' ? d.subject : d.name);

  let id = null;
  try {
    const r = await env.DB.prepare(
      `INSERT INTO enquiries (name,email,phone,sms_consent,booking_type,preferred_date,hours,headcount,message,attribution,subject,ip_country,user_agent,is_test)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(d.name, d.email, d.phone, d.sms_consent, d.booking_type, d.preferred_date, d.hours,
      d.headcount, d.message, d.attribution, subject, clip(request.cf && request.cf.country, 8),
      clip(request.headers.get('user-agent'), 300), isTest).run();
    id = r.meta && r.meta.last_row_id;
  } catch (e) { console.log('db insert failed', e && e.message); }

  const lines = [
    ['Name', d.name], ['Email', d.email], ['Phone', d.phone || '(none)'],
    ['OK to text', d.sms_consent], ['Booking type', d.booking_type], ['When', d.preferred_date],
    ['Hours', d.hours], ['People', d.headcount], ['Notes', d.message], ['Came from', d.attribution],
  ];
  const text = lines.map(([k, v]) => `${k}: ${v || ''}`).join('\n') + `\n\nSaved as enquiry #${id ?? '?'}. Reply to this email to answer ${d.name} directly.`;
  const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = '<table cellpadding="4">' + lines.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v).replace(/\n/g, '<br>')}</td></tr>`).join('') +
    `</table><p>Saved as enquiry #${esc(id ?? '?')}. Reply to this email to answer ${esc(d.name)} directly.</p>`;

  let emailed = 0, err = '';
  if (env.EMAIL_API_TOKEN && env.CF_ACCOUNT_ID) {
    try {
      const resp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/sending/send`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.EMAIL_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: env.NOTIFY_TO,
          from: env.NOTIFY_FROM,
          subject, text, html,
          replyTo: d.email,
        }),
      });
      const j = await resp.json().catch(() => ({}));
      if (resp.ok && j.success !== false) emailed = 1;
      else err = clip(JSON.stringify(j.errors || j).slice(0, 300), 300) || `HTTP ${resp.status}`;
    } catch (e) { err = clip(e && e.message, 300); }
  } else {
    err = 'email token not configured yet';
  }
  if (id != null) {
    try { await env.DB.prepare('UPDATE enquiries SET emailed=?, email_error=? WHERE id=?').bind(emailed, err, id).run(); } catch {}
  }
  return Response.redirect(thanks, 303);
}
