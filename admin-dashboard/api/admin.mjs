/**
 * API admin sul progetto Vercel della dashboard (non su auth-deploy).
 * GET /api/admin?route=stats|credits-timeline|users|affiliates
 * Header: Authorization: Bearer <ADMIN_SECRET> or X-Admin-Key: <ADMIN_SECRET>
 * Env (stesso progetto dashboard): POSTGRES_URL, ADMIN_SECRET
 */
import { sql } from '../lib/db.mjs';
import { requireAdmin } from '../lib/admin-auth.mjs';

const COST_PER_SCAN_USD = 0.013;
const BUFFER_DAYS = 30;
const ALERT_THRESHOLD_USD = 15;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
}

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

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  if (!sql) return res.status(503).json({ error: 'Database not configured' });

  const route = (req.query?.route || '').toLowerCase().trim();
  if (!route) return res.status(400).json({ error: 'Missing query: route=stats|credits-timeline|users|affiliates' });

  try {
    if (route === 'stats') return await handleStats(req, res);
    if (route === 'credits-timeline') return await handleCreditsTimeline(req, res);
    if (route === 'users') return await handleUsers(req, res);
    if (route === 'affiliates') return await handleAffiliates(req, res);
    return res.status(400).json({ error: 'Unknown route' });
  } catch (err) {
    console.error('GET /api/admin', route, err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function handleStats(req, res) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const usersTotal = await sql`SELECT COUNT(*)::int AS c FROM users`;
  const usersByPlan = await sql`SELECT plan, COUNT(*)::int AS c FROM users GROUP BY plan`;
  const proByCredits = await sql`SELECT credits_total, COUNT(*)::int AS c FROM users WHERE plan = 'PRO' GROUP BY credits_total ORDER BY credits_total`;
  const signupsToday = await sql`SELECT COUNT(*)::int AS c FROM users WHERE created_at >= ${todayStart}`;
  const signups7d = await sql`SELECT COUNT(*)::int AS c FROM users WHERE created_at >= ${sevenDaysAgo}`;
  const signups30d = await sql`SELECT COUNT(*)::int AS c FROM users WHERE created_at >= ${thirtyDaysAgo}`;
  const expiring7d = await sql`
    SELECT COUNT(*)::int AS c FROM users
    WHERE plan = 'PRO' AND plan_expires_at IS NOT NULL AND plan_expires_at > NOW() AND plan_expires_at <= NOW() + INTERVAL '7 days'
  `;

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

  const scanCount30 = (scans30d.rows[0]?.c ?? 0);
  const avgScansPerDay = scanCount30 / 30 || 0;
  const cost30dUsd = Math.round(scanCount30 * COST_PER_SCAN_USD * 1000) / 1000;
  const suggestedBufferUsd = Math.round(avgScansPerDay * BUFFER_DAYS * COST_PER_SCAN_USD * 1000) / 1000;
  const costAlert = suggestedBufferUsd < ALERT_THRESHOLD_USD || cost30dUsd > ALERT_THRESHOLD_USD;

  const affiliatesTotal = await sql`SELECT COUNT(*)::int AS c FROM affiliates`;
  const referralsTotal = await sql`SELECT COALESCE(SUM(total_referrals), 0)::int AS s FROM affiliates`;

  const freeActive = await sql`
    SELECT COUNT(DISTINCT u.id)::int AS c FROM users u
    INNER JOIN credit_transactions ct ON ct.user_id = u.id WHERE u.plan = 'FREE'
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
}

async function handleCreditsTimeline(req, res) {
  const period = Math.min(90, Math.max(1, parseInt(req.query?.period, 10) || 30));
  const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();

  const creditsByDay = await sql`
    SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS day,
           SUM(credits_consumed)::int AS credits,
           COUNT(*) FILTER (WHERE action_type IN ('audit', 'scan'))::int AS scans
    FROM credit_transactions WHERE created_at >= ${since}
    GROUP BY 1 ORDER BY 1
  `;
  const byActionByDay = await sql`
    SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS day,
           action_type, COUNT(*)::int AS count, SUM(credits_consumed)::int AS credits
    FROM credit_transactions WHERE created_at >= ${since}
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

  res.status(200).json({ period_days: period, since, timeline: days, by_action_per_day: byAction });
}

async function handleUsers(req, res) {
  const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query?.offset, 10) || 0);

  const total = await sql`SELECT COUNT(*)::int AS c FROM users`;
  const rows = await sql`
    SELECT id, email, name, plan, plan_expires_at, credits_total, credits_used, created_at
    FROM users ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
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
  res.status(200).json({ total: total.rows[0]?.c ?? 0, limit, offset, users });
}

async function handleAffiliates(req, res) {
  const rows = await sql`
    SELECT a.affiliate_code, a.total_referrals, a.total_earnings_cents, a.created_at
    FROM affiliates a ORDER BY a.total_referrals DESC
  `;
  const affiliates = (rows.rows || []).map(r => ({
    affiliate_code: r.affiliate_code,
    total_referrals: r.total_referrals ?? 0,
    total_earnings_cents: r.total_earnings_cents ?? 0,
    created_at: r.created_at,
  }));
  res.status(200).json({ total: affiliates.length, affiliates });
}
