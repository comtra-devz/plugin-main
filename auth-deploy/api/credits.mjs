/**
 * Single serverless function for credits (balance, estimate, consume) to stay under Vercel limit.
 * GET /api/credits -> balance. POST /api/credits/estimate, POST /api/credits/consume via rewrite -> /api/credits?sub=...
 */
import app from '../oauth-server/app.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const sub = req.query?.sub;
  const qs = (req.url || '').includes('?') ? (req.url || '').slice((req.url || '').indexOf('?')) : '';
  if (sub === 'estimate') {
    if (req.method !== 'POST') return res.status(405).end();
    req.url = '/api/credits/estimate';
    return app(req, res);
  }
  if (sub === 'consume') {
    if (req.method !== 'POST') return res.status(405).end();
    req.url = '/api/credits/consume';
    return app(req, res);
  }
  if (req.method !== 'GET') return res.status(405).end();
  req.url = '/api/credits' + qs;
  return app(req, res);
}
