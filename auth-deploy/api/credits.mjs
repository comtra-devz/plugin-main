import app from '../oauth-server/app.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).end();
  const qs = (req.url || '').includes('?') ? (req.url || '').slice((req.url || '').indexOf('?')) : '';
  req.url = '/api/credits' + qs;
  return app(req, res);
}
