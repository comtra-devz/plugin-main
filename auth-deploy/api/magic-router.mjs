/**
 * Un solo serverless per tutte le route magic (limite 12 funzioni Vercel).
 * Le rewrite in vercel.json aggiungono ?__m=… per il dispatch.
 */
import app from '../oauth-server/app.mjs';

function setCors(res, methods, headers) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', headers);
}

const H_SIMPLE = 'Content-Type';

function stripM(u) {
  u.searchParams.delete('__m');
}

export default function handler(req, res) {
  const u = new URL(req.url || '', 'https://n.local');
  const op = (u.searchParams.get('__m') || '').toString();

  if (op === 'request') {
    setCors(res, 'GET, POST, OPTIONS', H_SIMPLE);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return res.status(405).json({ error: 'method_not_allowed' });
    }
    stripM(u);
    const qs = u.searchParams.toString() ? `?${u.searchParams.toString()}` : '';
    req.url = '/auth/magic-link/request' + qs;
    return app(req, res);
  }

  if (op === 'verify') {
    setCors(res, 'GET, POST, OPTIONS', H_SIMPLE);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET, OPTIONS');
      return res.status(405).send('Method not allowed');
    }
    stripM(u);
    const qs = u.searchParams.toString() ? `?${u.searchParams.toString()}` : '';
    req.url = '/auth/magic/verify' + qs;
    return app(req, res);
  }

  if (op === 'short') {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return res.status(405).end();
    }
    const id = (u.searchParams.get('id') || '').toString();
    stripM(u);
    u.searchParams.delete('id');
    if (!id) {
      return res.status(400).type('text/plain').send('Missing id');
    }
    req.url = '/auth/m/' + id;
    return app(req, res);
  }

  return res.status(404).type('text/plain').send('Unknown route');
}
