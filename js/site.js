/* First-party, no dependencies. Two jobs:
   1. Remember utm_* from the landing URL for the length of the visit, and post it
      with the enquiry, so a reply can be traced to the outreach wave that caused it.
   2. Pre-select the booking type when an outreach link deep-links with ?use=
   Both degrade to nothing if scripting or sessionStorage is unavailable. */
(function () {
  var KEY = 'ccw_attr';
  function read() { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function write(o) { try { sessionStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }

  var q = new URLSearchParams(location.search);
  var a = read(), dirty = false;

  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) {
    var v = q.get(k);
    if (v && !a[k]) { a[k] = v.slice(0, 120); dirty = true; }
  });
  if (!a.landing) { a.landing = location.pathname; dirty = true; }
  if (!a.referrer && document.referrer && document.referrer.indexOf(location.host) === -1) {
    a.referrer = document.referrer.slice(0, 200); dirty = true;
  }
  if (dirty) write(a);

  var form = document.querySelector('form[name="enquiry"]');
  if (!form) return;

  var hidden = form.querySelector('input[name="attribution"]');
  if (hidden) {
    hidden.value = Object.keys(a).map(function (k) { return k + '=' + a[k]; }).join(' | ');
  }

  // Subject line for the Netlify notification, e.g. "Tour only, Jennifer Hayward, October".
  // Hours is disabled (so it is not sent) when the enquiry is only for a tour.
  var subj = form.querySelector('input[name="subject"]');
  var hrs = form.querySelector('input[name="hours"]');
  var bt = form.querySelector('select[name="booking_type"]');
  function syncHours() { if (hrs && bt) hrs.disabled = (bt.value === 'Tour only'); }
  if (bt) bt.addEventListener('change', syncHours);
  form.addEventListener('submit', function () {
    syncHours();
    if (!subj) return;
    var parts = [];
    ['booking_type', 'name', 'preferred_date'].forEach(function (n) {
      var el = form.querySelector('[name="' + n + '"]');
      if (el && el.value.trim()) parts.push(el.value.trim().slice(0, 60));
    });
    if (parts.length) subj.value = parts.join(', ');
  });

  var use = q.get('use');
  var sel = form.querySelector('select[name="booking_type"]');
  var map = { meeting: 'Meeting', event: 'Event, reception or party, Star', dock: 'Event, reception or party, Can', production: 'Video or production, Star', loft: 'Video or production, South', tour: 'Tour' };
  if (use && sel && map[use]) {
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value.indexOf(map[use]) === 0) { sel.selectedIndex = i; break; }
    }
  }
})();
