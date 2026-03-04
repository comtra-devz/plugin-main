/**
 * GET /api/admin/credits-timeline?period=7|30 — consumo crediti e scan per giorno.
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

  const period = Math.min(90, Math.max(1, parseInt(req.query?.period, 10) || 30));
  const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();

  try {
    const creditsByDay = await sql`
      SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS day,
             SUM(credits_consumed)::int AS credits,
             COUNT(*) FILTER (WHERE action_type IN ('audit', 'scan'))::int AS scans
      FROM credit_transactions
      WHERE created_at >= ${since}
      GROUP BY 1 ORDER BY 1
    `;

    const byActionByDay = await sql`
      SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS day,
             action_type,
             COUNT(*)::int AS count,
             SUM(credits_consumed)::int AS credits
      FROM credit_transactions
      WHERE created_at >= ${since}
      GROUP BY 1, 2 ORDER BY 1, 3 DESC
    `;

    const toDateStr = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : (d ? String(d).slice(0, 10) : ''));
    const days = (creditsByDay.rows || []).map(r => ({
      date: toDateStr(r.day),
      credits: r.credits ?? 0,
      scans: r.scans ?? 0,
    }));

    const byAction = {};
    for (const r of byActionByDay.rows || []) {
      const d = toDateStr(r.day);
      if (!byAction[d]) byAction[d] = {};
      byAction[d][r.action_type] = { count: r.count, credits: r.credits };
    }

    res.status(200).json({
      period_days: period,
      since,
      timeline: days,
      by_action_per_day: byAction,
    });
  } catch (err) {
    console.error('GET /api/admin/credits-timeline', err);
    res.status(500).json({ error: 'Server error' });
  }
}
