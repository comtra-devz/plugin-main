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
// Kimi prezzi per token (docs COST-ESTIMATE)
const KIMI_COST_INPUT_PER_1M = 0.4;
const KIMI_COST_OUTPUT_PER_1M = 2.0;

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
  if (!(await requireAdmin(req, res))) return;

  const route = (req.query?.route || '').toLowerCase().trim();
  if (!route) return res.status(400).json({ error: 'Missing query: route=stats|credits-timeline|users|affiliates|token-usage|weekly-updates|health|function-executions|executions-users|users-countries|throttle-events|discounts-stats|discounts-level|discounts-throttle|generate-ab-stats|support-feedback|plugin-logs' });

  if (route === 'weekly-updates') {
    try {
      return await handleWeeklyUpdates(req, res);
    } catch (err) {
      console.error('GET /api/admin weekly-updates', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
  if (route === 'health') {
    try {
      return await handleHealth(req, res);
    } catch (err) {
      console.error('GET /api/admin health', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  if (!sql) return res.status(503).json({ error: 'Database not configured' });

  try {
    if (route === 'stats') return await handleStats(req, res);
    if (route === 'credits-timeline') return await handleCreditsTimeline(req, res);
    if (route === 'users') return await handleUsers(req, res);
    if (route === 'affiliates') return await handleAffiliates(req, res);
    if (route === 'token-usage') return await handleTokenUsage(req, res);
    if (route === 'function-executions') return await handleFunctionExecutions(req, res);
    if (route === 'executions-users') return await handleExecutionsUsers(req, res);
    if (route === 'users-countries') return await handleUsersCountries(req, res);
    if (route === 'throttle-events') return await handleThrottleEvents(req, res);
    if (route === 'discounts-stats') return await handleDiscountsStats(req, res);
    if (route === 'discounts-level') return await handleDiscountsLevel(req, res);
    if (route === 'discounts-throttle') return await handleDiscountsThrottle(req, res);
    if (route === 'generate-ab-stats') return await handleGenerateABStats(req, res);
    if (route === 'support-feedback') return await handleSupportFeedback(req, res);
    if (route === 'plugin-logs') return await handlePluginLogs(req, res);
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
  let cost30dUsd = Math.round(scanCount30 * COST_PER_SCAN_USD * 1000) / 1000;
  let token_usage_30d = null;
  try {
    const thirtyDaysAgoIso = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const tokenTotals = await sql`
      SELECT COUNT(*)::int AS count, COALESCE(SUM(input_tokens), 0)::bigint AS in_tok, COALESCE(SUM(output_tokens), 0)::bigint AS out_tok
      FROM kimi_usage_log WHERE created_at >= ${thirtyDaysAgoIso}
    `;
    const tt = tokenTotals.rows?.[0];
    if (tt && (tt.count ?? 0) > 0) {
      const inTok = Number(tt.in_tok) || 0;
      const outTok = Number(tt.out_tok) || 0;
      const realCost = (inTok / 1e6) * KIMI_COST_INPUT_PER_1M + (outTok / 1e6) * KIMI_COST_OUTPUT_PER_1M;
      token_usage_30d = { calls: tt.count ?? 0, cost_usd: Math.round(realCost * 1000) / 1000 };
      cost30dUsd = token_usage_30d.cost_usd;
    }
  } catch (_) {}
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
      token_usage_30d: token_usage_30d,
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
    kimi_calls: 0,
    kimi_cost_usd: 0,
  }));
  const byAction = {};
  for (const r of byActionByDay.rows || []) {
    const d = toDateStr(r.day);
    if (!byAction[d]) byAction[d] = {};
    byAction[d][r.action_type] = { count: r.count, credits: r.credits };
  }

  let kimiByDay = [];
  try {
    const kimiRows = await sql`
      SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS day,
             COUNT(*)::int AS count,
             COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
             COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens
      FROM kimi_usage_log WHERE created_at >= ${since}
      GROUP BY 1 ORDER BY 1
    `;
    kimiByDay = (kimiRows.rows || []).map(r => {
      const inTok = Number(r.input_tokens) || 0;
      const outTok = Number(r.output_tokens) || 0;
      const costUsd = (inTok / 1e6) * KIMI_COST_INPUT_PER_1M + (outTok / 1e6) * KIMI_COST_OUTPUT_PER_1M;
      return { day: toDateStr(r.day), count: r.count ?? 0, cost_usd: Math.round(costUsd * 1000) / 1000 };
    });
  } catch (_) {}
  const kimiByDate = {};
  for (const r of kimiByDay) {
    kimiByDate[r.day] = { kimi_calls: r.count, kimi_cost_usd: r.cost_usd };
  }
  for (const d of days) {
    if (kimiByDate[d.date]) {
      d.kimi_calls = kimiByDate[d.date].kimi_calls;
      d.kimi_cost_usd = kimiByDate[d.date].kimi_cost_usd;
    }
  }

  res.status(200).json({ period_days: period, since, timeline: days, by_action_per_day: byAction });
}

async function handleUsers(req, res) {
  const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query?.offset, 10) || 0);
  const countryCode = (req.query?.country || '').trim().toUpperCase().slice(0, 2) || null;

  const total = await sql`
    SELECT COUNT(*)::int AS c FROM users
    WHERE (country_code = ${countryCode} OR ${countryCode}::text IS NULL)
  `;
  const rows = await sql`
    SELECT id, email, name, plan, plan_expires_at, credits_total, credits_used, country_code, created_at
    FROM users
    WHERE (country_code = ${countryCode} OR ${countryCode}::text IS NULL)
    ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
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
    country_code: r.country_code ?? null,
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

async function handleTokenUsage(req, res) {
  const period = Math.min(365, Math.max(1, parseInt(req.query?.period, 10) || 30));
  const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();

  let totals = { count: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0 };
  let byAction = [];
  let bySizeBand = [];
  let byDay = [];

  try {
    const totalsRow = await sql`
      SELECT COUNT(*)::int AS count,
             COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
             COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens
      FROM kimi_usage_log WHERE created_at >= ${since}
    `;
    const t = totalsRow.rows?.[0];
    if (t) {
      const inTok = Number(t.input_tokens) || 0;
      const outTok = Number(t.output_tokens) || 0;
      const costUsd = (inTok / 1e6) * KIMI_COST_INPUT_PER_1M + (outTok / 1e6) * KIMI_COST_OUTPUT_PER_1M;
      totals = { count: t.count ?? 0, input_tokens: inTok, output_tokens: outTok, cost_usd: Math.round(costUsd * 1000) / 1000 };
    }
  } catch (_) {
    // Tabella kimi_usage_log può non esistere ancora
  }

  try {
    const byActionRows = await sql`
      SELECT action_type, COUNT(*)::int AS count,
             COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
             COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens
      FROM kimi_usage_log WHERE created_at >= ${since}
      GROUP BY action_type ORDER BY count DESC
    `;
    byAction = (byActionRows.rows || []).map(r => {
      const inTok = Number(r.input_tokens) || 0;
      const outTok = Number(r.output_tokens) || 0;
      const costUsd = (inTok / 1e6) * KIMI_COST_INPUT_PER_1M + (outTok / 1e6) * KIMI_COST_OUTPUT_PER_1M;
      return {
        action_type: r.action_type,
        count: r.count ?? 0,
        input_tokens: inTok,
        output_tokens: outTok,
        cost_usd: Math.round(costUsd * 1000) / 1000,
      };
    });
  } catch (_) {}

  try {
    const byBandRows = await sql`
      SELECT COALESCE(size_band, 'unknown') AS size_band, COUNT(*)::int AS count,
             COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
             COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens
      FROM kimi_usage_log WHERE created_at >= ${since} AND action_type = 'ds_audit'
      GROUP BY size_band ORDER BY count DESC
    `;
    bySizeBand = (byBandRows.rows || []).map(r => {
      const inTok = Number(r.input_tokens) || 0;
      const outTok = Number(r.output_tokens) || 0;
      const costUsd = (inTok / 1e6) * KIMI_COST_INPUT_PER_1M + (outTok / 1e6) * KIMI_COST_OUTPUT_PER_1M;
      return {
        size_band: r.size_band,
        count: r.count ?? 0,
        input_tokens: inTok,
        output_tokens: outTok,
        cost_usd: Math.round(costUsd * 1000) / 1000,
      };
    });
  } catch (_) {}

  try {
    const byDayRows = await sql`
      SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS day,
             COUNT(*)::int AS count,
             COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
             COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens
      FROM kimi_usage_log WHERE created_at >= ${since}
      GROUP BY 1 ORDER BY 1
    `;
    const toDateStr = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : (d ? String(d).slice(0, 10) : ''));
    byDay = (byDayRows.rows || []).map(r => {
      const inTok = Number(r.input_tokens) || 0;
      const outTok = Number(r.output_tokens) || 0;
      const costUsd = (inTok / 1e6) * KIMI_COST_INPUT_PER_1M + (outTok / 1e6) * KIMI_COST_OUTPUT_PER_1M;
      return {
        date: toDateStr(r.day),
        count: r.count ?? 0,
        input_tokens: inTok,
        output_tokens: outTok,
        cost_usd: Math.round(costUsd * 1000) / 1000,
      };
    });
  } catch (_) {}

  res.status(200).json({
    period_days: period,
    since,
    totals,
    by_action: byAction,
    by_size_band: bySizeBand,
    by_day: byDay,
  });
}

async function handleFunctionExecutions(req, res) {
  const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query?.offset, 10) || 0);
  const actionType = (req.query?.action_type || '').trim() || null;
  const userId = (req.query?.user_id || '').trim() || null;
  const countryCode = (req.query?.country || '').trim().toUpperCase().slice(0, 2) || null;
  let dateFrom = (req.query?.date_from || '').trim() || null;
  let dateTo = (req.query?.date_to || '').trim() || null;
  if (dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) dateFrom = null;
  if (dateTo && !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) dateTo = null;

  const countResult = await sql`
    SELECT COUNT(*)::int AS c FROM credit_transactions ct
    INNER JOIN users u ON u.id = ct.user_id
    WHERE (ct.action_type = ${actionType} OR ${actionType}::text IS NULL)
      AND (ct.user_id = ${userId} OR ${userId}::text IS NULL)
      AND (u.country_code = ${countryCode} OR ${countryCode}::text IS NULL)
      AND (ct.created_at >= ${dateFrom}::date OR ${dateFrom}::text IS NULL)
      AND (ct.created_at <= (${dateTo}::date + INTERVAL '1 day') OR ${dateTo}::text IS NULL)
  `;
  const total = countResult.rows?.[0]?.c ?? 0;

  const rows = await sql`
    SELECT ct.id, u.email, u.country_code, ct.action_type, ct.credits_consumed, ct.created_at
    FROM credit_transactions ct
    INNER JOIN users u ON u.id = ct.user_id
    WHERE (ct.action_type = ${actionType} OR ${actionType}::text IS NULL)
      AND (ct.user_id = ${userId} OR ${userId}::text IS NULL)
      AND (u.country_code = ${countryCode} OR ${countryCode}::text IS NULL)
      AND (ct.created_at >= ${dateFrom}::date OR ${dateFrom}::text IS NULL)
      AND (ct.created_at <= (${dateTo}::date + INTERVAL '1 day') OR ${dateTo}::text IS NULL)
    ORDER BY ct.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const executions = (rows.rows || []).map((r) => ({
    id: r.id,
    user_masked: maskEmail(r.email),
    country_code: r.country_code ?? null,
    action_type: r.action_type,
    credits_consumed: r.credits_consumed ?? 0,
    created_at: r.created_at,
  }));

  res.status(200).json({ total, limit, offset, executions });
}

async function handleExecutionsUsers(req, res) {
  const countryCode = (req.query?.country || '').trim().toUpperCase().slice(0, 2) || null;
  let dateFrom = (req.query?.date_from || '').trim() || null;
  let dateTo = (req.query?.date_to || '').trim() || null;
  if (dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) dateFrom = null;
  if (dateTo && !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) dateTo = null;

  const rows = await sql`
    SELECT DISTINCT ct.user_id, u.email, u.country_code
    FROM credit_transactions ct
    INNER JOIN users u ON u.id = ct.user_id
    WHERE (u.country_code = ${countryCode} OR ${countryCode}::text IS NULL)
      AND (ct.created_at >= ${dateFrom}::date OR ${dateFrom}::text IS NULL)
      AND (ct.created_at <= (${dateTo}::date + INTERVAL '1 day') OR ${dateTo}::text IS NULL)
    ORDER BY u.email
  `;

  const users = (rows.rows || []).map((r) => ({
    user_id: r.user_id,
    user_masked: maskEmail(r.email),
    country_code: r.country_code ?? null,
  }));

  res.status(200).json({ users });
}

async function handleUsersCountries(req, res) {
  const rows = await sql`
    SELECT DISTINCT country_code FROM users WHERE country_code IS NOT NULL AND country_code != '' ORDER BY country_code
  `;
  const countries = (rows.rows || []).map((r) => r.country_code);
  res.status(200).json({ countries });
}

/** Throttle/503 events (plugin report-throttle). Monitoraggio anche dopo passaggio a Vercel Pro. */
async function handleThrottleEvents(req, res) {
  try {
    const totalResult = await sql`SELECT COUNT(*)::int AS c FROM throttle_events`;
    const total = totalResult.rows?.[0]?.c ?? 0;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const byDayResult = await sql`
      SELECT DATE(occurred_at) AS day, COUNT(*)::int AS c
      FROM throttle_events WHERE occurred_at >= ${thirtyDaysAgo}
      GROUP BY DATE(occurred_at) ORDER BY day DESC
      LIMIT 31
    `;
    const by_day = (byDayResult.rows || []).map((r) => ({ day: r.day, count: r.c }));
    const recentResult = await sql`
      SELECT te.id, te.user_id, te.occurred_at, u.email
      FROM throttle_events te
      LEFT JOIN users u ON u.id = te.user_id
      ORDER BY te.occurred_at DESC
      LIMIT 50
    `;
    const recent = (recentResult.rows || []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      user_masked: maskEmail(r.email),
      occurred_at: r.occurred_at,
    }));
    res.status(200).json({ total, by_day, recent });
  } catch (err) {
    console.error('handleThrottleEvents', err);
    res.status(200).json({ total: 0, by_day: [], recent: [] });
  }
}

async function handleDiscountsStats(req, res) {
  try {
    const levelTotalResult = await sql`SELECT COUNT(*)::int AS c FROM user_level_discounts`;
    const levelTotal = levelTotalResult.rows?.[0]?.c ?? 0;
    const levelByLevelResult = await sql`
      SELECT level, COUNT(*)::int AS c FROM user_level_discounts GROUP BY level ORDER BY level
    `;
    const by_level = { 5: 0, 10: 0, 15: 0, 20: 0 };
    for (const r of levelByLevelResult.rows || []) {
      if (r.level in by_level) by_level[r.level] = r.c;
    }
    const throttleTotalResult = await sql`SELECT COUNT(*)::int AS c FROM user_throttle_discounts`;
    const throttleTotal = throttleTotalResult.rows?.[0]?.c ?? 0;
    const throttleValidResult = await sql`
      SELECT COUNT(*)::int AS c FROM user_throttle_discounts WHERE expires_at > NOW()
    `;
    const throttleValid = throttleValidResult.rows?.[0]?.c ?? 0;
    const throttleExpired = throttleTotal - throttleValid;
    res.status(200).json({
      level: { total: levelTotal, by_level: by_level },
      throttle: { total: throttleTotal, valid: throttleValid, expired: throttleExpired },
    });
  } catch (err) {
    console.error('handleDiscountsStats', err);
    res.status(500).json({ error: 'Server error' });
  }
}

async function handleDiscountsLevel(req, res) {
  const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query?.offset, 10) || 0);
  const levelFilter = req.query?.level ? parseInt(req.query.level, 10) : null;
  const validLevels = [5, 10, 15, 20];
  const level = levelFilter && validLevels.includes(levelFilter) ? levelFilter : null;
  try {
    const countResult = await sql`
      SELECT COUNT(*)::int AS c FROM user_level_discounts ld
      WHERE (ld.level = ${level} OR ${level}::int IS NULL)
    `;
    const total = countResult.rows?.[0]?.c ?? 0;
    const rows = await sql`
      SELECT ld.user_id, ld.level, ld.code, ld.created_at, u.email
      FROM user_level_discounts ld
      LEFT JOIN users u ON u.id = ld.user_id
      WHERE (ld.level = ${level} OR ${level}::int IS NULL)
      ORDER BY ld.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const items = (rows.rows || []).map((r) => ({
      user_id: r.user_id,
      user_masked: maskEmail(r.email),
      level: r.level,
      code: r.code,
      created_at: r.created_at,
    }));
    res.status(200).json({ total, limit, offset, items });
  } catch (err) {
    console.error('handleDiscountsLevel', err);
    res.status(500).json({ error: 'Server error' });
  }
}

/** A/B test Generate: performance e feedback per varianti A vs B */
async function handleGenerateABStats(req, res) {
  const period = Math.min(365, Math.max(1, parseInt(req.query?.period, 10) || 30));
  const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();
  try {
    const requestsByVariant = await sql`
      SELECT variant, COUNT(*)::int AS count,
             COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
             COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
             COALESCE(SUM(credits_consumed), 0)::int AS credits_consumed,
             AVG(latency_ms)::numeric(12,2) AS avg_latency_ms
      FROM generate_ab_requests WHERE created_at >= ${since}
      GROUP BY variant
    `;
    const totals = await sql`
      SELECT COUNT(*)::int AS count,
             COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
             COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
             COALESCE(SUM(credits_consumed), 0)::int AS credits_consumed,
             AVG(latency_ms)::numeric(12,2) AS avg_latency_ms
      FROM generate_ab_requests WHERE created_at >= ${since}
    `;
    const feedbackByVariant = await sql`
      SELECT f.variant, f.thumbs, COUNT(*)::int AS count
      FROM generate_ab_feedback f
      INNER JOIN generate_ab_requests r ON r.id = f.request_id
      WHERE r.created_at >= ${since}
      GROUP BY f.variant, f.thumbs
    `;
    const requestsLimit = Math.min(200, Math.max(50, parseInt(req.query?.requests_limit, 10) || 100));
    const requestsList = await sql`
      SELECT r.id, r.user_id, r.variant, r.input_tokens, r.output_tokens, r.credits_consumed, r.latency_ms, r.created_at,
             u.email, f.thumbs AS feedback_thumbs, f.comment AS feedback_comment
      FROM generate_ab_requests r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN generate_ab_feedback f ON f.request_id = r.id
      WHERE r.created_at >= ${since}
      ORDER BY r.created_at DESC
      LIMIT ${requestsLimit}
    `;
    const byDay = await sql`
      SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS day, variant,
             COUNT(*)::int AS count, COALESCE(SUM(credits_consumed), 0)::int AS credits
      FROM generate_ab_requests WHERE created_at >= ${since}
      GROUP BY 1, 2 ORDER BY 1, 2
    `;
    const toDateStr = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : (d ? String(d).slice(0, 10) : ''));
    const by_variant = (requestsByVariant.rows || []).map((r) => ({
      variant: r.variant,
      count: r.count ?? 0,
      input_tokens: Number(r.input_tokens) || 0,
      output_tokens: Number(r.output_tokens) || 0,
      credits_consumed: r.credits_consumed ?? 0,
      avg_latency_ms: r.avg_latency_ms != null ? Math.round(Number(r.avg_latency_ms)) : null,
    }));
    const t = totals.rows?.[0];
    const total = {
      count: t?.count ?? 0,
      input_tokens: Number(t?.input_tokens) || 0,
      output_tokens: Number(t?.output_tokens) || 0,
      credits_consumed: t?.credits_consumed ?? 0,
      avg_latency_ms: t?.avg_latency_ms != null ? Math.round(Number(t.avg_latency_ms)) : null,
    };
    const feedback_by_variant = {};
    for (const r of feedbackByVariant.rows || []) {
      const v = r.variant || '?';
      if (!feedback_by_variant[v]) feedback_by_variant[v] = { up: 0, down: 0 };
      feedback_by_variant[v][r.thumbs === 'up' ? 'up' : 'down'] = r.count ?? 0;
    }
    const requests_list = (requestsList.rows || []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      user_masked: maskEmail(r.email),
      variant: r.variant,
      input_tokens: r.input_tokens ?? 0,
      output_tokens: r.output_tokens ?? 0,
      credits_consumed: r.credits_consumed ?? 0,
      latency_ms: r.latency_ms ?? null,
      created_at: r.created_at,
      feedback_thumbs: r.feedback_thumbs ?? null,
      feedback_comment: r.feedback_comment ?? null,
    }));
    const timeline = {};
    for (const r of byDay.rows || []) {
      const d = toDateStr(r.day);
      if (!timeline[d]) timeline[d] = { A: { count: 0, credits: 0 }, B: { count: 0, credits: 0 } };
      const v = r.variant || 'A';
      timeline[d][v].count = r.count ?? 0;
      timeline[d][v].credits = r.credits ?? 0;
    }
    const costUsd = (total.input_tokens / 1e6) * KIMI_COST_INPUT_PER_1M + (total.output_tokens / 1e6) * KIMI_COST_OUTPUT_PER_1M;
    res.status(200).json({
      period_days: period,
      since,
      total: { ...total, cost_usd: Math.round(costUsd * 1000) / 1000 },
      by_variant,
      feedback_by_variant,
      requests_list,
      timeline: Object.entries(timeline).map(([date, v]) => ({ date, ...v })).sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (err) {
    console.error('handleGenerateABStats', err);
    res.status(500).json({ error: 'Server error' });
  }
}

/** Supporto: feedback da A/B test Generate + support tickets da Documentation & Help */
async function handleSupportFeedback(req, res) {
  const limit = Math.min(200, Math.max(1, parseInt(req.query?.limit, 10) || 100));
  try {
    const abRows = await sql`
      SELECT f.id::text, 'A/B Generate' AS source, f.variant, f.thumbs, f.comment, r.created_at, u.email
      FROM generate_ab_feedback f
      JOIN generate_ab_requests r ON r.id = f.request_id
      LEFT JOIN users u ON u.id = r.user_id
    `;
    let ticketRows = { rows: [] };
    try {
      ticketRows = await sql`
        SELECT st.id::text, 'Support Ticket' AS source, st.type AS variant, NULL::text AS thumbs, st.message AS comment, st.created_at, u.email
        FROM support_tickets st
        LEFT JOIN users u ON u.id = st.user_id
      `;
    } catch (e) {
      if (!/relation "support_tickets" does not exist/i.test(String(e))) throw e;
    }
    const combined = [...(abRows.rows || []), ...(ticketRows.rows || [])]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
    const items = combined.map((r) => ({
      id: r.id,
      source: r.source,
      variant: r.variant,
      thumbs: r.thumbs,
      comment: r.comment || null,
      user_masked: maskEmail(r.email),
      created_at: r.created_at,
    }));
    res.status(200).json({ items });
  } catch (err) {
    console.error('handleSupportFeedback', err);
    res.status(500).json({ error: 'Server error', items: [] });
  }
}

/** Plugin logs: throttle_events e altre problematiche lato plugin. Fix consigliato + risolto (smart detect) */
async function handlePluginLogs(req, res) {
  const limit = Math.min(200, Math.max(1, parseInt(req.query?.limit, 10) || 100));
  try {
    const rows = await sql`
      SELECT te.id, te.user_id, te.occurred_at, u.email,
        EXISTS (
          SELECT 1 FROM throttle_events te2
          WHERE te2.user_id = te.user_id
            AND te2.occurred_at > te.occurred_at
            AND te2.occurred_at < te.occurred_at + INTERVAL '7 days'
        ) AS ripetuto
      FROM throttle_events te
      LEFT JOIN users u ON u.id = te.user_id
      ORDER BY te.occurred_at DESC
      LIMIT ${limit}
    `;
    const items = (rows.rows || []).map((r) => ({
      id: r.id,
      date: r.occurred_at,
      category: 'throttle',
      category_label: 'Limite richieste',
      description: 'Utente ha raggiunto il limite delle richieste (503).',
      fix: 'Attendere 15 minuti o passare a piano superiore. In Cursor: verificare rate limit backend.',
      risolto: !r.ripetuto,
      user_masked: maskEmail(r.email),
    }));
    res.status(200).json({ items });
  } catch (err) {
    console.error('handlePluginLogs', err);
    res.status(500).json({ error: 'Server error', items: [] });
  }
}

async function handleDiscountsThrottle(req, res) {
  const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query?.offset, 10) || 0);
  const statusFilter = (req.query?.status || '').toLowerCase().trim() || null; // 'valid' | 'expired' | null = tutti
  const showAll = !statusFilter || (statusFilter !== 'valid' && statusFilter !== 'expired');
  try {
    const countResult = await sql`
      SELECT COUNT(*)::int AS c FROM user_throttle_discounts td
      WHERE (${showAll}) OR (td.expires_at > NOW() AND ${statusFilter === 'valid'}) OR (td.expires_at <= NOW() AND ${statusFilter === 'expired'})
    `;
    const total = countResult.rows?.[0]?.c ?? 0;
    const rows = await sql`
      SELECT td.user_id, td.code, td.expires_at, td.issued_at, u.email
      FROM user_throttle_discounts td
      LEFT JOIN users u ON u.id = td.user_id
      WHERE (${showAll}) OR (td.expires_at > NOW() AND ${statusFilter === 'valid'}) OR (td.expires_at <= NOW() AND ${statusFilter === 'expired'})
      ORDER BY td.issued_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const now = new Date();
    const items = (rows.rows || []).map((r) => ({
      user_id: r.user_id,
      user_masked: maskEmail(r.email),
      code: r.code,
      expires_at: r.expires_at,
      issued_at: r.issued_at,
      status: r.expires_at && new Date(r.expires_at) <= now ? 'expired' : 'valid',
    }));
    res.status(200).json({ total, limit, offset, items });
  } catch (err) {
    console.error('handleDiscountsThrottle', err);
    res.status(500).json({ error: 'Server error' });
  }
}

/** Conventional commit type -> category */
const CONVENTIONAL_TO_CATEGORY = {
  feat: 'FEAT',
  fix: 'FIX',
  docs: 'DOCS',
  chore: 'CHORE',
  refactor: 'REFACTOR',
  style: 'STYLE',
  security: 'SECURITY',
  test: 'CHORE',
  perf: 'FIX',
  ci: 'CHORE',
  build: 'CHORE',
};

function parseConventionalMessage(fullMessage) {
  if (!fullMessage || typeof fullMessage !== 'string') return { category: 'CHORE', title: 'Update', description: '' };
  const lines = fullMessage.trim().split(/\r?\n/).filter(Boolean);
  const subject = lines[0] || 'Update';
  const body = lines.slice(1).join('\n').trim();
  let category = 'CHORE';
  let title = subject;
  const match = subject.match(/^(\w+)(?:\([^)]*\))?!?:\s*(.+)$/i);
  if (match) {
    const type = (match[1] || '').toLowerCase();
    category = CONVENTIONAL_TO_CATEGORY[type] || 'CHORE';
    title = (match[2] || subject).trim();
    if (title.length > 80) title = title.slice(0, 77) + '...';
  }
  const description = body || title;
  return { category, title, description: description.length > 200 ? description.slice(0, 197) + '...' : description };
}

async function handleWeeklyUpdates(req, res) {
  const repo = (process.env.GITHUB_REPO || '').trim();
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return res.status(200).json({ updates: [], source: 'none', message: 'Set GITHUB_REPO (owner/repo) to enable' });
  }
  const token = (process.env.GITHUB_TOKEN || '').trim();
  const perPage = Math.min(50, Math.max(10, parseInt(req.query?.per_page, 10) || 30));
  const url = `https://api.github.com/repos/${repo}/commits?per_page=${perPage}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const ghRes = await fetch(url, { headers });
  if (!ghRes.ok) {
    const text = await ghRes.text();
    console.error('GitHub API', ghRes.status, text);
    return res.status(502).json({ error: 'GitHub API error', status: ghRes.status });
  }
  const commits = await ghRes.json();
  if (!Array.isArray(commits)) {
    return res.status(200).json({ updates: [], source: 'github' });
  }

  const updates = commits.map((c) => {
    const sha = c.sha || '';
    const msg = (c.commit && c.commit.message) || '';
    const authorDate = (c.commit && c.commit.author && c.commit.author.date) || '';
    const date = authorDate ? authorDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const { category, title, description } = parseConventionalMessage(msg);
    return {
      id: sha || `commit-${date}-${Math.random().toString(36).slice(2, 9)}`,
      date,
      category,
      title,
      description,
      commitHash: sha ? sha.slice(0, 7) : undefined,
    };
  });

  res.status(200).json({ updates, source: 'github' });
}

const HEALTH_CACHE_MS = 60_000;
let healthCache = { data: null, at: 0 };

async function handleHealth(req, res) {
  if (Date.now() - healthCache.at < HEALTH_CACHE_MS && healthCache.data) {
    return res.status(200).json(healthCache.data);
  }

  const authUrl = (process.env.AUTH_PUBLIC_URL || 'https://auth.comtra.dev').replace(/\/$/, '');
  const checks = [
    { id: 'dashboard', name: 'Dashboard (Vercel)', url: null },
    { id: 'database', name: 'Database (Postgres)', url: null },
    { id: 'auth', name: 'Auth API (root)', url: authUrl },
    { id: 'auth-credits', name: 'Auth API – GET /api/credits', url: null },
    { id: 'auth-oauth-init', name: 'Auth API – GET /api/figma-oauth/init', url: null },
    { id: 'vercel', name: 'Vercel', url: 'https://www.vercel.com' },
  ];

  const results = await Promise.allSettled([
    Promise.resolve({ id: 'dashboard', status: 'up', latencyMs: 0, message: null }),
    (async () => {
      if (!sql) return { id: 'database', status: 'unknown', latencyMs: null, message: 'Non configurato' };
      const start = Date.now();
      try {
        await sql`SELECT 1`;
        return { id: 'database', status: 'up', latencyMs: Date.now() - start, message: null };
      } catch (e) {
        return { id: 'database', status: 'down', latencyMs: Date.now() - start, message: (e && e.message) || 'Errore' };
      }
    })(),
    pingUrl(authUrl, 'auth'),
    pingApiGet(authUrl + '/api/credits', 'auth-credits', 401),
    pingApiGet(authUrl + '/api/figma-oauth/init', 'auth-oauth-init', 200),
    pingUrl('https://www.vercel.com', 'vercel'),
  ]);

  const checkResults = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    const c = checks[i];
    return { id: c.id, status: 'down', latencyMs: null, message: (r.reason && r.reason.message) || 'Errore' };
  });

  const byId = Object.fromEntries(checks.map(c => [c.id, c]));
  const list = checkResults.map(r => ({
    id: r.id,
    name: (byId[r.id] && byId[r.id].name) || r.id,
    status: r.status,
    latencyMs: r.latencyMs ?? null,
    message: r.message ?? null,
  }));

  const downCount = list.filter(c => c.status === 'down').length;
  const unknownCount = list.filter(c => c.status === 'unknown').length;
  let global = 'up';
  if (downCount > 0) global = downCount === list.length ? 'down' : 'degraded';
  else if (unknownCount === list.length) global = 'unknown';

  const payload = {
    global,
    checks: list,
    cachedAt: new Date().toISOString(),
  };
  healthCache = { data: payload, at: Date.now() };
  res.status(200).json(payload);
}

async function pingUrl(url, id) {
  const start = Date.now();
  try {
    const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
    const ok = r.ok || r.status < 500;
    return { id, status: ok ? 'up' : 'degraded', latencyMs: Date.now() - start, message: ok ? null : `HTTP ${r.status}` };
  } catch (e) {
    return { id, status: 'down', latencyMs: Date.now() - start, message: (e && e.message) || 'Timeout o errore' };
  }
}

/** GET an API endpoint; expect a specific status (e.g. 401 for /api/credits without token, 200 for /init). */
async function pingApiGet(url, id, expectedStatus) {
  const start = Date.now();
  try {
    const r = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(8000) });
    const ok = r.status === expectedStatus || (r.status < 500 && expectedStatus === 200);
    const message = ok ? null : `HTTP ${r.status} (expected ${expectedStatus})`;
    return { id, status: ok ? 'up' : r.status >= 500 ? 'down' : 'degraded', latencyMs: Date.now() - start, message };
  } catch (e) {
    return { id, status: 'down', latencyMs: Date.now() - start, message: (e && e.message) || 'Timeout o errore' };
  }
}
