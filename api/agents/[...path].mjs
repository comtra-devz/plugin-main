/**
 * Proxy for /api/agents/* when auth.comtra.dev is served by the root Vercel project
 * instead of the auth-deploy project. Guarantees CORS headers for Figma webview (origin: null).
 */
const DEFAULT_UPSTREAM = 'https://auth-deploy-ten.vercel.app';

function upstreamBase() {
  const raw = (process.env.COMTRA_AUTH_UPSTREAM_URL || DEFAULT_UPSTREAM).trim().replace(/\/$/, '');
  return raw || DEFAULT_UPSTREAM;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    if (req.method === 'GET' || req.method === 'HEAD') return resolve(undefined);
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Admin-Key, Accept, X-Requested-With',
  );
  res.setHeader('Access-Control-Max-Age', '7200');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method || '')) {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    return res.end();
  }

  try {
    const u = new URL(req.url || '/api/agents', 'https://n.local');
    const target = `${upstreamBase()}${u.pathname}${u.search}`;
    const body = await readRequestBody(req);

    const upstreamRes = await fetch(target, {
      method: req.method,
      headers: {
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        ...(req.headers['content-type'] ? { 'Content-Type': req.headers['content-type'] } : {}),
        Accept: req.headers.accept || 'application/json',
      },
      body,
    });

    const ct = upstreamRes.headers.get('content-type') || 'application/json; charset=utf-8';
    res.setHeader('Content-Type', ct);
    const responseBody = await upstreamRes.text();
    res.statusCode = upstreamRes.status;
    return res.end(responseBody);
  } catch (e) {
    console.error('[agents proxy]', e);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Agents upstream unavailable' }));
  }
}
