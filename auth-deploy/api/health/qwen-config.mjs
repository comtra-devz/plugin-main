/**
 * GET /api/health/qwen-config — env smoke check (no secrets).
 */
import app from '../../oauth-server/app.mjs';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const u = req.url || '';
  const qs = u.includes('?') ? u.slice(u.indexOf('?')) : '';
  req.url = `/api/health/qwen-config${qs}`;
  return app(req, res);
}
