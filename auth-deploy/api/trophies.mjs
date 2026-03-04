/**
 * Single serverless function for trophies (list + linkedin-shared) to stay under Vercel limit.
 * GET /api/trophies -> list. POST /api/trophies/linkedin-shared via rewrite -> /api/trophies?sub=linkedin-shared
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
  if (sub === 'linkedin-shared') {
    if (req.method !== 'POST') return res.status(405).end();
    req.url = '/api/trophies/linkedin-shared';
    return app(req, res);
  }
  if (req.method !== 'GET') return res.status(405).end();
  req.url = '/api/trophies' + qs;
  return app(req, res);
}
