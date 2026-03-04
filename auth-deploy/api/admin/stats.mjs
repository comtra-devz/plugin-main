/**
 * GET /api/admin/stats — aggregati per dashboard home.
 * Header: Authorization: Bearer <ADMIN_SECRET> or X-Admin-Key: <ADMIN_SECRET>
 */
import { sql } from '../../oauth-server/db.mjs';
import { requireAdmin } from '../../oauth-server/admin-auth.mjs';

const COST_PER_SCAN_USD = 0.013;
const BUFFER_DAYS = 30;
const ALERT_THRESHOLD_USD = 15;

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
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Users: total, by plan, PRO by variant (credits_total), signups, expiring
    const usersTotal = await sql`SELECT COUNT(*)::int AS c FROM users`;
    const usersByPlan = await sql`
      SELECT plan, COUNT(*)::int AS c FROM users GROUP BY plan
    `;
    const proByCredits = await sql`
      SELECT credits_total, COUNT(*)::int AS c FROM users WHERE plan = 'PRO' GROUP BY credits_total ORDER BY credits_total
    `;
    const signupsToday = await sql`SELECT COUNT(*)::int AS c FROM users WHERE created_at >= ${todayStart}`;
    const signups7d = await sql`SELECT COUNT(*)::int AS c FROM users WHERE created_at >= ${sevenDaysAgo}`;
    const signups30d = await sql`SELECT COUNT(*)::int AS c FROM users WHERE created_at >= ${thirtyDaysAgo}`;
    const expiring7d = await sql`
      SELECT COUNT(*)::int AS c FROM users
      WHERE plan = 'PRO' AND plan_expires_at IS NOT NULL
        AND plan_expires_at > NOW() AND plan_expires_at <= NOW() + INTERVAL '7 days'
    `;

    // Credits: scans (audit/scan) today, 7d, 30d; total credits consumed; by action_type
    const scansToday = await sql`
      SELECT COUNT(*)::int AS c FROM credit_transactions
      WHERE action_type IN ('audit', 'scan') AND created_at >= ${todayStart}
    `;
    const scans7d = await sql`
      SELECT COUNT(*)::int AS c FROM credit_transactions
      WHERE action_type IN ('audit', 'scan') AND created_at >= ${sevenDaysAgo}
    `;
    const scans30d = await sql`
      SELECT COUNT(*)::int AS c FROM credit_transactions
      WHERE action_type IN ('audit', 'scan') AND created_at >= ${thirtyDaysAgo}
    `;
    const creditsConsumed30d = await sql`
      SELECT COALESCE(SUM(credits_consumed), 0)::int AS s FROM credit_transactions WHERE created_at >= ${thirtyDaysAgo}
    `;
    const byActionType = await sql`
      SELECT action_type, COUNT(*)::int AS count, COALESCE(SUM(credits_consumed), 0)::int AS credits
      FROM credit_transactions WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY action_type ORDER BY credits DESC
    `;

    // Kimi cost estimate & buffer
    const scanCount30 = (scans30d.rows[0]?.c ?? 0);
    const avgScansPerDay = scanCount30 / 30 || 0;
    const cost30dUsd = Math.round(scanCount30 * COST_PER_SCAN_USD * 1000) / 1000;
    const suggestedBufferUsd = Math.round(avgScansPerDay * BUFFER_DAYS * COST_PER_SCAN_USD * 1000) / 1000;
    const costAlert = suggestedBufferUsd < ALERT_THRESHOLD_USD || cost30dUsd > ALERT_THRESHOLD_USD;

    // Affiliates
    const affiliatesTotal = await sql`SELECT COUNT(*)::int AS c FROM affiliates`;
    const referralsTotal = await sql`SELECT COALESCE(SUM(total_referrals), 0)::int AS s FROM affiliates`;

    // Funnel: signup (users), FREE active (has any credit_transaction + plan FREE), PRO
    const freeActive = await sql`
      SELECT COUNT(DISTINCT u.id)::int AS c FROM users u
      INNER JOIN credit_transactions ct ON ct.user_id = u.id
      WHERE u.plan = 'FREE'
    `;
    const proCount = (usersByPlan.rows.find(r => r.plan === 'PRO')?.c) ?? 0;
    const totalUsers = usersTotal.rows[0]?.c ?? 0;
    const signup30 = signups30d.rows[0]?.c ?? 0;
    const freeActiveCount = freeActive.rows[0]?.c ?? 0;

    const planMap = Object.fromEntries((usersByPlan.rows || []).map(r => [r.plan, r.c]));
    const proByVariant = (proByCredits.rows || []).map(r => ({
      credits_total: r.credits_total,
      label: r.credits_total === 20 ? '1w' : r.credits_total === 100 ? '1m' : r.credits_total === 800 ? '6m' : r.credits_total === 2000 ? '1y' : String(r.credits_total),
      count: r.c,
    }));

    res.status(200).json({
      users: {
        total: totalUsers,
        by_plan: planMap,
        pro_by_variant: proByVariant,
        signups_today: signupsToday.rows[0]?.c ?? 0,
        signups_7d: signups7d.rows[0]?.c ?? 0,
        signups_30d: signup30,
        pro_expiring_7d: expiring7d.rows[0]?.c ?? 0,
      },
      credits: {
        scans_today: scansToday.rows[0]?.c ?? 0,
        scans_7d: scans7d.rows[0]?.c ?? 0,
        scans_30d: scanCount30,
        credits_consumed_30d: creditsConsumed30d.rows[0]?.s ?? 0,
        by_action_type: (byActionType.rows || []).map(r => ({ action_type: r.action_type, count: r.count, credits: r.credits })),
      },
      kimi: {
        cost_30d_usd: cost30dUsd,
        cost_per_scan_usd: COST_PER_SCAN_USD,
        suggested_buffer_30d_usd: suggestedBufferUsd,
        alert_threshold_usd: ALERT_THRESHOLD_USD,
        cost_alert: costAlert,
      },
      affiliates: {
        total: affiliatesTotal.rows[0]?.c ?? 0,
        referrals_total: referralsTotal.rows[0]?.s ?? 0,
      },
      funnel: {
        signups_30d: signup30,
        free_active: freeActiveCount,
        pro: proCount,
        conversion_free_to_pro_pct: freeActiveCount > 0 ? Math.round((proCount / (freeActiveCount + proCount)) * 100) : 0,
      },
    });
  } catch (err) {
    console.error('GET /api/admin/stats', err);
    res.status(500).json({ error: 'Server error' });
  }
}
