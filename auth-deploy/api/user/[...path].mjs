/**
 * Unified handler for user DS import APIs.
 * Routes:
 * - GET  /api/user/ds-imports
 * - GET  /api/user/ds-imports/context
 * - PUT  /api/user/ds-imports
 */
import app from '../../oauth-server/app.mjs';

function setCors(res, methods = 'GET, PUT, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
}

function resolvePath(req) {
  const fromQuery = req.query?.path;
  const chunks = Array.isArray(fromQuery) ? fromQuery : fromQuery ? [fromQuery] : [];
  if (chunks.length) return `/api/user/${chunks.join('/')}`;

  const url = req.url || '';
  const match = url.match(/\/api\/user\/([^?]+)/);
  return match ? `/api/user/${match[1]}` : '/api/user';
}

export default function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const targetPath = resolvePath(req);
  if (!targetPath.startsWith('/api/user/ds-imports')) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (req.method !== 'GET' && req.method !== 'PUT') {
    return res.status(405).end();
  }

  const qs = (req.url || '').includes('?') ? (req.url || '').slice((req.url || '').indexOf('?')) : '';
  req.url = `${targetPath}${qs}`;
  return app(req, res);
}
