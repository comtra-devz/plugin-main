import app from '../oauth-server/app.mjs';

/**
 * GET /auth/m/:id → rewrites to this function with ?id=
 * 302 to /auth/magic/verify?token=…
 */
export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  const u = new URL(req.url || '', 'https://n.local');
  const id = (u.searchParams.get('id') || '').toString();
  if (!id) {
    return res.status(400).type('text/plain').send('Missing id');
  }
  req.url = '/auth/m/' + id;
  return app(req, res);
}
