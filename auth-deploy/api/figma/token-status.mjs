/**
 * Debug: Figma token status for current user (see docs/FIGMA-TOKEN-TROUBLESHOOTING.md).
 * GET or POST /api/figma/token-status with Authorization: Bearer <jwt>
 */
import app from '../../oauth-server/app.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();
  req.url = '/api/figma/token-status';
  return app(req, res);
}
