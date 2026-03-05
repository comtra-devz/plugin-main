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
  if (!requireAdmin(req, res)) return;

  const route = (req.query?.route || '').toLowerCase().trim();
  if (!route) return res.status(400).json({ error: 'Missing query: route=stats|credits-timeline|users|affiliates|token-usage|weekly-updates|health' });

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
    { id: 'auth', name: 'Auth API', url: authUrl },
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
