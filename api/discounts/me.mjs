/**
 * Proxy per GET /api/discounts/me quando auth.comtra.dev è servito dal progetto Vercel **plugin-login**
 * (root repo) e non da **auth-deploy**: la route reale vive sull’upstream OAuth.
 *
 * Env (opzionale): COMTRA_AUTH_UPSTREAM_URL — base senza slash finale, es. https://auth-deploy-ten.vercel.app
 */
const DEFAULT_UPSTREAM = 'https://auth-deploy-ten.vercel.app';

function upstreamBase() {
  const raw = (process.env.COMTRA_AUTH_UPSTREAM_URL || DEFAULT_UPSTREAM).trim().replace(/\/$/, '');
  return raw || DEFAULT_UPSTREAM;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Admin-Key, Accept, X-Requested-With',
  );
  res.setHeader('Access-Control-Max-Age', '7200');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.end();
  }

  try {
    const u = new URL(req.url || '', 'https://n.local');
    const qs = u.searchParams.toString() ? `?${u.searchParams.toString()}` : '';
    const target = `${upstreamBase()}/api/discounts/me${qs}`;

    const upstreamRes = await fetch(target, {
      method: 'GET',
      headers: {
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        Accept: req.headers.accept || 'application/json',
      },
    });

    const ct = upstreamRes.headers.get('content-type') || 'application/json; charset=utf-8';
    res.setHeader('Content-Type', ct);
    const body = await upstreamRes.text();
    res.statusCode = upstreamRes.status;
    return res.end(body);
  } catch (e) {
    console.error('[discounts/me proxy]', e);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Upstream unavailable' }));
  }
}
