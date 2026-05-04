/**
 * POST /api/notion-product-sources — disabled.
 * Historical implementation lives in git history; product-sources automation is no longer used from this deploy.
 */
import { requireAdmin } from '../lib/admin-auth.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await requireAdmin(req, res))) return;

  return res.status(410).json({
    ok: false,
    disabled: true,
    message: 'Product sources Notion API disabled on this deploy.',
  });
}
