import app from '../oauth-server/app.mjs';

/**
 * Un solo serverless: GET/PATCH /api/user/profile + POST resolve.
 * La rewrite per resolve aggiunge ?__profile=resolve (vercel.json).
 */
function setCors(res, methods) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Accept, X-Requested-With',
  );
  res.setHeader('Access-Control-Max-Age', '7200');
}

export default function handler(req, res) {
  const u = new URL(req.url || '', 'https://n.local');
  if (u.searchParams.get('__profile') === 'resolve') {
    setCors(res, 'POST,OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return res.status(405).end();
    }
    u.searchParams.delete('__profile');
    const qs = u.searchParams.toString() ? `?${u.searchParams.toString()}` : '';
    req.url = '/api/user/profile/resolve-name-conflict' + qs;
    return app(req, res);
  }

  setCors(res, 'GET,PATCH,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH, OPTIONS');
    return res.status(405).end();
  }
  const qs = u.searchParams.toString() ? `?${u.searchParams.toString()}` : '';
  req.url = '/api/user/profile' + qs;
  return app(req, res);
}
