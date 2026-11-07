// Keep the *.pages.dev copies (production and previews) out of search engines,
// and never serve the server-side source files as static assets.
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const p = url.pathname;
  if (p.startsWith('/functions/') || p === '/wrangler.toml' || p === '/netlify.toml') {
    return new Response('Not found', { status: 404 });
  }
  const res = await context.next();
  if (url.hostname.endsWith('.pages.dev')) {
    const r = new Response(res.body, res);
    r.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return r;
  }
  return res;
}
