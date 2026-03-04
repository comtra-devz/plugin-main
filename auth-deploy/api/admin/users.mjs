/**
 * GET /api/admin/users?limit=50&offset=0 — lista utenti (email offuscata, aggregati).
 * Header: Authorization: Bearer <ADMIN_SECRET> or X-Admin-Key: <ADMIN_SECRET>
 */
import { sql } from '../../oauth-server/db.mjs';
import { requireAdmin } from '../../oauth-server/admin-auth.mjs';

function maskEmail(email) {
  if (!email || typeof email !== 'string') return '—';
  const t = email.trim();
  if (!t) return '—';
  const at = t.indexOf('@');
  if (at <= 0) return t.slice(0, 2) + '***';
  const local = t.slice(0, at);
  const domain = t.slice(at);
  if (local.length <= 2) return local + '***' + domain;
  return local.slice(0, 2) + '***' + domain;
}

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

  const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query?.offset, 10) || 0);

  try {
    const total = await sql`SELECT COUNT(*)::int AS c FROM users`;
    const rows = await sql`
      SELECT id, email, name, plan, plan_expires_at, credits_total, credits_used, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const users = (rows.rows || []).map(r => ({
      id: r.id,
      email_masked: maskEmail(r.email),
      name: r.name || '—',
      plan: r.plan || 'FREE',
      plan_expires_at: r.plan_expires_at ?? null,
      credits_total: r.credits_total ?? 0,
      credits_used: r.credits_used ?? 0,
      credits_remaining: Math.max(0, (r.credits_total ?? 0) - (r.credits_used ?? 0)),
      created_at: r.created_at,
    }));

    res.status(200).json({
      total: total.rows[0]?.c ?? 0,
      limit,
      offset,
      users,
    });
  } catch (err) {
    console.error('GET /api/admin/users', err);
    res.status(500).json({ error: 'Server error' });
  }
}
