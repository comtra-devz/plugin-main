import app from '../../oauth-server/app.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const qs = (req.url || '').includes('?') ? (req.url || '').slice((req.url || '').indexOf('?')) : '';
  req.url = '/auth/figma/init' + qs;
  return app(req, res);
}
