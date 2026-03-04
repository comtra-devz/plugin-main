/**
 * GET /api/admin/affiliates — lista affiliati con referral totali.
 * Header: Authorization: Bearer <ADMIN_SECRET> or X-Admin-Key: <ADMIN_SECRET>
 */
import { sql } from '../../oauth-server/db.mjs';
import { requireAdmin } from '../../oauth-server/admin-auth.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  if (!sql) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const rows = await sql`
      SELECT a.affiliate_code, a.total_referrals, a.total_earnings_cents, a.created_at
      FROM affiliates a
      ORDER BY a.total_referrals DESC
    `;

    const affiliates = (rows.rows || []).map(r => ({
      affiliate_code: r.affiliate_code,
      total_referrals: r.total_referrals ?? 0,
      total_earnings_cents: r.total_earnings_cents ?? 0,
      created_at: r.created_at,
    }));

    res.status(200).json({
      total: affiliates.length,
      affiliates,
    });
  } catch (err) {
    console.error('GET /api/admin/affiliates', err);
    res.status(500).json({ error: 'Server error' });
  }
}
