/**
 * Single serverless function for all Figma OAuth routes (init, plugin, start, callback, poll)
 * to stay under Vercel 12-function limit.
 */
import app from '../../oauth-server/app.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const VALID = ['init', 'plugin', 'start', 'callback', 'poll'];

export default function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const url = req.url || '';
  // Rewrites can leave req.url as /auth/figma/start (original) or /api/figma-oauth/start (destination)
  const match = url.match(/\/(?:api\/figma-oauth|auth\/figma)\/([^/?]+)/);
  const segment = match && VALID.includes(match[1]) ? match[1] : 'init';
  const qs = url.includes('?') ? url.slice(url.indexOf('?')) : '';
  req.url = `/auth/figma/${segment}` + qs;
  return app(req, res);
}
