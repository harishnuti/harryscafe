export default async (req: Request) => {
  const url = new URL(req.url).searchParams.get('url') ?? '';
  let target: URL;
  try { target = new URL(url); } catch { return new Response('bad url', { status: 400 }); }

  // SSRF guards — a public fetch proxy is a vulnerability unless you do this:
  if (target.protocol !== 'https:') return new Response('https only', { status: 400 });
  if (/^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|\[)/.test(target.hostname))
    return new Response('forbidden', { status: 403 });

  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch(target, { signal: ctl.signal, redirect: 'follow',
      headers: { 'User-Agent': 'Gatekeeper-PWA/8.0 (personal coffee audit tool)' } });
    clearTimeout(t);
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/html'))
      return new Response('', { status: 204 });
    const html = (await res.text()).slice(0, 250_000);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 15_000);
    return new Response(text, { status: 200, headers: {
      'content-type': 'text/plain; charset=utf-8',
      'access-control-allow-origin': '*',        // your PWA origin can also be pinned here
      'cache-control': 'public, max-age=86400',
    }});
  } catch { return new Response('', { status: 204 }); }
};
