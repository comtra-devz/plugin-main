/**
 * Unico handler per /api/figma/* (resta sotto il limite di 12 Serverless Functions su Vercel Hobby).
 * - /api/figma/file -> POST only
 * - /api/figma/token-status -> GET o POST (debug token)
 */
import app from '../../oauth-server/app.mjs';

function setCors(res, methods = 'GET, POST, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default function handler(req, res) {
  const pathQuery = req.query.path;
  const fromQuery = Array.isArray(pathQuery) ? pathQuery[0] : pathQuery;
  const fromUrl = (req.url || '').match(/\/api\/figma\/([^/?]+)/);
  const segment = fromQuery || (fromUrl ? fromUrl[1] : null);

  if (segment === 'file') {
    setCors(res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).end();
    req.url = '/api/figma/file';
    return app(req, res);
  }

  if (segment === 'token-status') {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();
    req.url = '/api/figma/token-status';
    return app(req, res);
  }

  setCors(res);
  res.status(404).json({ error: 'Not found' });
}
