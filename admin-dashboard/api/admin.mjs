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

/** True se l'errore indica tabella/colonna mancante (migration non eseguita). */
function isMissingTableError(err) {
  const msg = err?.message != null ? String(err.message) : '';
  return /relation .* does not exist|table .* does not exist|column .* does not exist/i.test(msg);
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await requireAdmin(req, res))) return;

  const route = (req.query?.route || '').toLowerCase().trim();
  if (!route) {
    return res.status(400).json({
      error:
        'Missing query: route=stats|credits-timeline|users|affiliates|token-usage|weekly-updates|health|function-executions|executions-users|users-countries|throttle-events|discounts-stats|discounts-level|discounts-throttle|generate-ab-stats|support-feedback|plugin-logs|brand-awareness|touchpoint-funnel|notifications',
    });
  }

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

  if (route === 'notifications') {
    try {
      return await handleNotifications(req, res);
    } catch (err) {
      console.error('GET /api/admin notifications', err);
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
    if (route === 'brand-awareness') return await handleBrandAwareness(req, res);
    if (route === 'touchpoint-funnel') return await handleTouchpointFunnel(req, res);
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
    SELECT COALESCE(SUM(GREATEST(credits_consumed, 0)), 0)::int AS s FROM credit_transactions
    WHERE created_at >= ${thirtyDaysAgo} AND action_type != 'admin_recharge'
  `;
  const creditsConsumed30dPro = await sql`
    SELECT COALESCE(SUM(GREATEST(ct.credits_consumed, 0)), 0)::int AS s
    FROM credit_transactions ct
    INNER JOIN users u ON u.id = ct.user_id
    WHERE ct.created_at >= ${thirtyDaysAgo} AND ct.action_type != 'admin_recharge' AND u.plan = 'PRO'
  `;
  const creditsConsumed30dFree = await sql`
    SELECT COALESCE(SUM(GREATEST(ct.credits_consumed, 0)), 0)::int AS s
    FROM credit_transactions ct
    INNER JOIN users u ON u.id = ct.user_id
    WHERE ct.created_at >= ${thirtyDaysAgo} AND ct.action_type != 'admin_recharge' AND u.plan = 'FREE'
  `;
  const byActionType = await sql`
    SELECT action_type, COUNT(*)::int AS count, COALESCE(SUM(GREATEST(credits_consumed, 0)), 0)::int AS credits
    FROM credit_transactions
    WHERE created_at >= ${thirtyDaysAgo} AND action_type != 'admin_recharge'
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
      credits_consumed_30d_pro: creditsConsumed30dPro.rows[0]?.s ?? 0,
      credits_consumed_30d_free: creditsConsumed30dFree.rows[0]?.s ?? 0,
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

async function handleNotifications(req, res) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const notifications = [];

  // --- PRO in scadenza (7 giorni)
  try {
    const expiring7d = await sql`
      SELECT COUNT(*)::int AS c FROM users
      WHERE plan = 'PRO' AND plan_expires_at IS NOT NULL AND plan_expires_at > NOW() AND plan_expires_at <= NOW() + INTERVAL '7 days'
    `;
    const count = expiring7d.rows[0]?.c ?? 0;
    if (count > 0) {
      notifications.push({
        id: 'pro-expiring-7d',
        created_at: now.toISOString(),
        severity: 'info',
        title: `${count} PRO in scadenza nei prossimi 7 giorni`,
        description: 'Verifica se vuoi comunicare rinnovi o offerte mirate agli utenti PRO in scadenza.',
        target_path: '/users',
      });
    }
  } catch (_) {}

  // --- Kimi: costo e buffer (stesse formule di handleStats)
  try {
    const scans30d = await sql`
      SELECT COUNT(*)::int AS c FROM credit_transactions
      WHERE action_type IN ('audit', 'scan') AND created_at >= ${thirtyDaysAgo}
    `;
    const scanCount30 = scans30d.rows[0]?.c ?? 0;
    const avgScansPerDay = scanCount30 / 30 || 0;
    let cost30dUsd = Math.round(scanCount30 * COST_PER_SCAN_USD * 1000) / 1000;
    let token_usage_30d = null;
    try {
      const tokenTotals = await sql`
        SELECT COUNT(*)::int AS count, COALESCE(SUM(input_tokens), 0)::bigint AS in_tok, COALESCE(SUM(output_tokens), 0)::bigint AS out_tok
        FROM kimi_usage_log WHERE created_at >= ${thirtyDaysAgo}
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
    if (costAlert) {
      notifications.push({
        id: 'kimi-buffer-alert',
        created_at: now.toISOString(),
        severity: 'warning',
        title: 'Verifica saldo Kimi e buffer di sicurezza',
        description:
          `Negli ultimi 30 giorni il costo Kimi è ~$${cost30dUsd.toFixed(2)}. Buffer suggerito per 30 gg: ~$${suggestedBufferUsd.toFixed(2)}. Controlla la pagina Crediti e costi.`,
        target_path: '/credits',
      });
    }
  } catch (_) {}

  // --- Throttle events dal plugin (se ci sono spike recenti)
  try {
    const totalResult = await sql`SELECT COUNT(*)::int AS c FROM throttle_events`;
    const total = totalResult.rows?.[0]?.c ?? 0;
    if (total > 0) {
      const sevenDaysResult = await sql`
        SELECT COUNT(*)::int AS c FROM throttle_events WHERE occurred_at >= ${sevenDaysAgo}
      `;
      const last7 = sevenDaysResult.rows?.[0]?.c ?? 0;
      if (last7 > 0) {
        notifications.push({
          id: 'throttle-last7',
          created_at: now.toISOString(),
          severity: 'info',
          title: `Eventi throttle/503 negli ultimi 7 giorni: ${last7}`,
          description: 'Ci sono stati errori di limite richieste segnalati dal plugin. Controlla Storico utilizzo o i log plugin.',
          target_path: '/executions',
        });
      }
    }
  } catch (_) {}

  // --- Codici sconto throttle vicini alla scadenza
  try {
    const soonExpiring = await sql`
      SELECT COUNT(*)::int AS c
      FROM user_throttle_discounts
      WHERE expires_at > NOW() AND expires_at <= NOW() + INTERVAL '7 days'
    `;
    const count = soonExpiring.rows?.[0]?.c ?? 0;
    if (count > 0) {
      notifications.push({
        id: 'discounts-throttle-expiring',
        created_at: now.toISOString(),
        severity: 'info',
        title: `Codici throttle in scadenza (7 gg): ${count}`,
        description: 'Alcuni codici sconto throttle scadranno a breve. Valuta se estenderli o lasciarli scadere.',
        target_path: '/discounts',
      });
    }
  } catch (_) {}

  // --- Ticket supporto aperti da >48 ore (se la tabella esiste)
  try {
    const openResult = await sql`
      SELECT COUNT(*)::int AS c FROM support_tickets
      WHERE (status = 'open' OR status IS NULL) AND created_at <= NOW() - INTERVAL '48 hours'
    `;
    const count = openResult.rows?.[0]?.c ?? 0;
    if (count > 0) {
      notifications.push({
        id: 'support-open-48h',
        created_at: now.toISOString(),
        severity: 'info',
        title: `Ticket supporto aperti da oltre 48 ore: ${count}`,
        description: 'Ci sono richieste di supporto in attesa da più di 48 ore. Controlla la pagina Supporto.',
        target_path: '/support',
      });
    }
  } catch (err) {
    if (!/relation "support_tickets" does not exist/i.test(String(err))) {
      console.error('handleNotifications support_tickets', err);
    }
  }

  res.status(200).json({ items: notifications });
}

async function handleCreditsTimeline(req, res) {
  const period = Math.min(90, Math.max(1, parseInt(req.query?.period, 10) || 30));
  const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();
  const planRaw = (req.query?.plan || '').toUpperCase().trim();
  const planFilter = planRaw === 'PRO' || planRaw === 'FREE' ? planRaw : null;

  const loadUnfilteredTimeline = async () => {
    const creditsRows = await sql`
      SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS day,
             SUM(GREATEST(credits_consumed, 0))::int FILTER (WHERE action_type != 'admin_recharge') AS credits,
             COUNT(*) FILTER (WHERE action_type IN ('audit', 'scan'))::int AS scans
      FROM credit_transactions WHERE created_at >= ${since}
      GROUP BY 1 ORDER BY 1
    `;
    const byActionRows = await sql`
      SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS day,
             action_type, COUNT(*)::int AS count, SUM(GREATEST(credits_consumed, 0))::int AS credits
      FROM credit_transactions WHERE created_at >= ${since}
        AND action_type != 'admin_recharge'
      GROUP BY 1, 2 ORDER BY 1, 3 DESC
    `;
    return { creditsRows, byActionRows };
  };

  let creditsByDay;
  let byActionByDay;
  let effectivePlanFilter = planFilter;
  let planFilterFallbackNote = null;
  if (!planFilter) {
    const base = await loadUnfilteredTimeline();
    creditsByDay = base.creditsRows;
    byActionByDay = base.byActionRows;
  } else {
    try {
      creditsByDay = await sql`
        SELECT date_trunc('day', ct.created_at AT TIME ZONE 'UTC')::date AS day,
               SUM(GREATEST(ct.credits_consumed, 0))::int FILTER (WHERE ct.action_type != 'admin_recharge') AS credits,
               COUNT(*) FILTER (WHERE ct.action_type IN ('audit', 'scan'))::int AS scans
        FROM credit_transactions ct
        INNER JOIN users u ON u.id = ct.user_id
        WHERE ct.created_at >= ${since} AND u.plan = ${planFilter}
        GROUP BY 1 ORDER BY 1
      `;
      byActionByDay = await sql`
        SELECT date_trunc('day', ct.created_at AT TIME ZONE 'UTC')::date AS day,
               ct.action_type, COUNT(*)::int AS count, SUM(GREATEST(ct.credits_consumed, 0))::int AS credits
        FROM credit_transactions ct
        INNER JOIN users u ON u.id = ct.user_id
        WHERE ct.created_at >= ${since} AND u.plan = ${planFilter}
          AND ct.action_type != 'admin_recharge'
        GROUP BY 1, 2 ORDER BY 1, 3 DESC
      `;
    } catch (err) {
      // Non bloccare il grafico: in ambienti con schema "misto" il join users/plan può fallire.
      console.warn('credits-timeline plan filter fallback to unfiltered:', err?.message || err);
      const base = await loadUnfilteredTimeline();
      creditsByDay = base.creditsRows;
      byActionByDay = base.byActionRows;
      effectivePlanFilter = null;
      planFilterFallbackNote = `Filtro piano "${planFilter}" non disponibile in questo ambiente: timeline mostrata su tutti gli utenti.`;
    }
  }

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
    if (!effectivePlanFilter && kimiByDate[d.date]) {
      d.kimi_calls = kimiByDate[d.date].kimi_calls;
      d.kimi_cost_usd = kimiByDate[d.date].kimi_cost_usd;
    }
  }

  res.status(200).json({
    period_days: period,
    since,
    timeline: days,
    by_action_per_day: byAction,
    plan_filter: effectivePlanFilter,
    kimi_note: planFilterFallbackNote || (effectivePlanFilter
      ? 'Kimi (rosa/verde) non filtrato per piano: la telemetria token è anonima. Solo scan/crediti sono per piano selezionato.'
      : null),
  });
}

async function handleUsers(req, res) {
  const limit = Math.min(100, Math.max(1, parseInt(req.query?.limit, 10) || 50));
  const offset = Math.max(0, parseInt(req.query?.offset, 10) || 0);
  const countryCode = (req.query?.country || '').trim().toUpperCase().slice(0, 2) || null;

  const total = await sql`
    SELECT COUNT(*)::int AS c FROM users
    WHERE (country_code = ${countryCode} OR ${countryCode}::text IS NULL)
  `;
  let rows;
  try {
    rows = await sql`
      SELECT id, email, name, plan, plan_expires_at, credits_total, credits_used, last_admin_recharge_at, country_code, created_at
      FROM users
      WHERE (country_code = ${countryCode} OR ${countryCode}::text IS NULL)
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
  } catch (err) {
    if (err?.message && /last_admin_recharge_at|column.*does not exist/i.test(err.message)) {
      rows = await sql`
        SELECT id, email, name, plan, plan_expires_at, credits_total, credits_used, country_code, created_at
        FROM users
        WHERE (country_code = ${countryCode} OR ${countryCode}::text IS NULL)
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
      `;
      rows.rows = (rows.rows || []).map(r => ({ ...r, last_admin_recharge_at: null }));
    } else {
      throw err;
    }
  }
  const users = (rows.rows || []).map(r => ({
    id: r.id,
    email_masked: maskEmail(r.email),
    name: r.name || '—',
    plan: r.plan || 'FREE',
    plan_expires_at: r.plan_expires_at ?? null,
    credits_total: r.credits_total ?? 0,
    credits_used: r.credits_used ?? 0,
    credits_remaining: Math.max(0, (r.credits_total ?? 0) - (r.credits_used ?? 0)),
    last_admin_recharge_at: r.last_admin_recharge_at ?? null,
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

  const planExec = (req.query?.plan || '').toUpperCase().trim();
  const planFilterExec = planExec === 'PRO' || planExec === 'FREE' ? planExec : null;

  const countResult = await sql`
    SELECT COUNT(*)::int AS c FROM credit_transactions ct
    INNER JOIN users u ON u.id = ct.user_id
    WHERE (ct.action_type = ${actionType} OR ${actionType}::text IS NULL)
      AND (ct.user_id = ${userId} OR ${userId}::text IS NULL)
      AND (u.country_code = ${countryCode} OR ${countryCode}::text IS NULL)
      AND (u.plan = ${planFilterExec} OR ${planFilterExec}::text IS NULL)
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
      AND (u.plan = ${planFilterExec} OR ${planFilterExec}::text IS NULL)
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
  const planRaw = (req.query?.plan || '').toUpperCase().trim();
  const planFilterUsers = planRaw === 'PRO' || planRaw === 'FREE' ? planRaw : null;

  const rows = await sql`
    SELECT DISTINCT ct.user_id, u.email, u.country_code
    FROM credit_transactions ct
    INNER JOIN users u ON u.id = ct.user_id
    WHERE (u.country_code = ${countryCode} OR ${countryCode}::text IS NULL)
      AND (u.plan = ${planFilterUsers} OR ${planFilterUsers}::text IS NULL)
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
    if (isMissingTableError(err)) {
      return res.status(200).json({
        level: { total: 0, by_level: { 5: 0, 10: 0, 15: 0, 20: 0 } },
        throttle: { total: 0, valid: 0, expired: 0 },
      });
    }
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
    if (isMissingTableError(err)) return res.status(200).json({ total: 0, limit, offset, items: [] });
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
    if (isMissingTableError(err)) {
      const period = Math.min(365, Math.max(1, parseInt(req.query?.period, 10) || 30));
      const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();
      return res.status(200).json({
        period_days: period,
        since,
        total: { count: 0, input_tokens: 0, output_tokens: 0, credits_consumed: 0, avg_latency_ms: null, cost_usd: 0 },
        by_variant: [],
        feedback_by_variant: {},
        requests_list: [],
        timeline: [],
      });
    }
    res.status(500).json({ error: 'Server error' });
  }
}

/** Supporto: feedback da A/B test Generate + support tickets da Documentation & Help */
async function handleSupportFeedback(req, res) {
  const limit = Math.min(200, Math.max(1, parseInt(req.query?.limit, 10) || 100));
  try {
    let abRows = { rows: [] };
    try {
      abRows = await sql`
        SELECT f.id::text, 'A/B Generate' AS source, f.variant, f.thumbs, f.comment, r.created_at, u.email
        FROM generate_ab_feedback f
        JOIN generate_ab_requests r ON r.id = f.request_id
        LEFT JOIN users u ON u.id = r.user_id
      `;
    } catch (e) {
      if (!isMissingTableError(e)) throw e;
    }
    let ticketRows = { rows: [] };
    try {
      ticketRows = await sql`
        SELECT st.id::text, 'Support Ticket' AS source, st.type AS variant, NULL::text AS thumbs, st.message AS comment, st.created_at, u.email
        FROM support_tickets st
        LEFT JOIN users u ON u.id = st.user_id
      `;
    } catch (e) {
      if (!isMissingTableError(e)) throw e;
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
    if (isMissingTableError(err)) return res.status(200).json({ items: [] });
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
    if (isMissingTableError(err)) return res.status(200).json({ items: [] });
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
    if (isMissingTableError(err)) return res.status(200).json({ total: 0, limit, offset, items: [] });
    res.status(500).json({ error: 'Server error' });
  }
}

/** Brand awareness: click Share on LinkedIn per trofeo. Futuro: post pubblicati (tag LinkedIn), click pagina/footer. */
async function handleBrandAwareness(req, res) {
  const limit = Math.min(500, Math.max(1, parseInt(req.query?.limit, 10) || 100));
  const offset = Math.max(0, parseInt(req.query?.offset, 10) || 0);
  const period = Math.min(365, Math.max(1, parseInt(req.query?.period, 10) || 30));
  const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();
  try {
    const countResult = await sql`
      SELECT COUNT(*)::int AS c FROM linkedin_share_events WHERE created_at >= ${since}
    `;
    const total = countResult.rows?.[0]?.c ?? 0;
    const rows = await sql`
      SELECT lse.id, lse.user_id, lse.trophy_id, lse.created_at, u.email
      FROM linkedin_share_events lse
      LEFT JOIN users u ON u.id = lse.user_id
      WHERE lse.created_at >= ${since}
      ORDER BY lse.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const share_clicks = (rows.rows || []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      user_masked: maskEmail(r.email),
      trophy_id: r.trophy_id,
      created_at: r.created_at,
    }));
    const byTrophyResult = await sql`
      SELECT trophy_id, COUNT(*)::int AS c
      FROM linkedin_share_events WHERE created_at >= ${since}
      GROUP BY trophy_id ORDER BY c DESC
    `;
    const by_trophy = (byTrophyResult.rows || []).reduce((acc, r) => {
      acc[r.trophy_id] = r.c ?? 0;
      return acc;
    }, {});
    const unique_users_result = await sql`
      SELECT COUNT(DISTINCT user_id)::int AS c FROM linkedin_share_events WHERE created_at >= ${since}
    `;
    const unique_users = unique_users_result.rows?.[0]?.c ?? 0;
    res.status(200).json({
      period_days: period,
      since,
      share_clicks: { total, limit, offset, items: share_clicks },
      by_trophy,
      unique_users,
      posts_published_note: 'Da integrare quando avremo i tag/metriche da LinkedIn (post effettivamente pubblicati).',
      activity_note: 'Click su pagina trophy e click su link footer: da abilitare quando le pagine comtra.dev/trophy e il footer sono live (tracking UTM o beacon).',
    });
  } catch (err) {
    if (/relation "linkedin_share_events" does not exist/i.test(String(err))) {
      return res.status(200).json({
        period_days: period,
        since,
        share_clicks: { total: 0, limit, offset, items: [] },
        by_trophy: {},
        unique_users: 0,
        posts_published_note: 'Da integrare quando avremo i tag/metriche da LinkedIn.',
        activity_note: 'Click pagina e footer: da abilitare quando le pagine e il footer sono live.',
      });
    }
    console.error('handleBrandAwareness', err);
    res.status(500).json({ error: 'Server error' });
  }
}

/** Funnel touchpoint: Landing, Plugin, LinkedIn, Instagram, TikTok. Ingressi → utilizzo → PRO → retention. */
async function handleTouchpointFunnel(req, res) {
  const period = Math.min(365, Math.max(1, parseInt(req.query?.period, 10) || 30));
  const since = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();
  const SOURCES = ['landing', 'plugin', 'linkedin', 'instagram', 'tiktok'];
  const SOURCE_LABELS = { landing: 'Landing page', plugin: 'Plugin Figma', linkedin: 'Pagina LinkedIn', instagram: 'Instagram', tiktok: 'TikTok' };

  try {
    const hasAttribution = await sql`
      SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_attribution') AS ok
    `;
    const hasTouchpointEvents = await sql`
      SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'touchpoint_events') AS ok
    `;

    const bySource = {};
    for (const s of SOURCES) {
      bySource[s] = {
        label: SOURCE_LABELS[s],
        visite: 0,
        click: 0,
        ingressi: 0,
        primo_utilizzo: 0,
        upgrade_pro: 0,
        pro_attivi: 0,
        note: s === 'landing' ? 'UTM sui link + beacon visit/click (opzionale).' : s === 'linkedin' ? 'Link pagina non ancora attivo.' : s === 'plugin' ? 'Default: utenti da OAuth Figma.' : '',
      };
    }

    if (hasTouchpointEvents.rows?.[0]?.ok) {
      const eventCounts = await sql`
        SELECT source, event_type, COUNT(*)::int AS c
        FROM touchpoint_events
        WHERE created_at >= ${since}
        GROUP BY source, event_type
      `;
      for (const r of eventCounts.rows || []) {
        if (!bySource[r.source]) continue;
        const c = r.c ?? 0;
        if (r.event_type === 'visit') bySource[r.source].visite += c;
        else if (r.event_type === 'click') bySource[r.source].click += c;
        if (r.event_type === 'visit' || r.event_type === 'click') bySource[r.source].ingressi += c;
      }
    }

    /* user_attribution used in loop below to assign each user to a source; ingressi = visite + click (above) + signups (loop) */

    const firstUsage = await sql`
      SELECT ct.user_id, MIN(ct.created_at) AS first_used
      FROM credit_transactions ct
      WHERE ct.created_at >= ${since}
      GROUP BY ct.user_id
    `;
    const firstUsageByUser = (firstUsage.rows || []).reduce((acc, r) => {
      acc[r.user_id] = r.first_used;
      return acc;
    }, {});

    const proUsers = await sql`
      SELECT u.id, u.plan_expires_at, u.created_at
      FROM users u
      WHERE u.plan = 'PRO' AND (u.plan_expires_at IS NULL OR u.plan_expires_at > NOW())
    `;
    const proUserIds = new Set((proUsers.rows || []).map((r) => r.id));

    const upgradedInPeriod = await sql`
      SELECT u.id FROM users u
      WHERE u.plan = 'PRO' AND u.updated_at >= ${since}
    `;
    const upgradedIds = new Set((upgradedInPeriod.rows || []).map((r) => r.id));

    let attrByUser = {};
    if (hasAttribution.rows?.[0]?.ok) {
      const attrs = await sql`SELECT user_id, source FROM user_attribution`;
      for (const r of attrs.rows || []) attrByUser[r.user_id] = r.source;
    }

    const allUsersSince = await sql`
      SELECT id FROM users WHERE created_at >= ${since}
    `;
    for (const u of allUsersSince.rows || []) {
      const src = attrByUser[u.id] || 'plugin';
      if (!bySource[src]) continue;
      bySource[src].ingressi += 1;
      if (firstUsageByUser[u.id]) bySource[src].primo_utilizzo += 1;
      if (upgradedIds.has(u.id)) bySource[src].upgrade_pro += 1;
      if (proUserIds.has(u.id)) bySource[src].pro_attivi += 1;
    }

    const linkedinShareCount = await sql`
      SELECT COUNT(DISTINCT user_id)::int AS c FROM linkedin_share_events WHERE created_at >= ${since}
    `;
    const lc = linkedinShareCount.rows?.[0]?.c ?? 0;
    if (lc > 0 && bySource.linkedin.ingressi === 0) bySource.linkedin.ingressi = lc;

    res.status(200).json({
      period_days: period,
      since,
      by_source: Object.entries(bySource).map(([k, v]) => ({ source: k, ...v })),
      data_note: 'Plugin = default (OAuth Figma). Landing/LinkedIn: abilita tracking per dati completi.',
    });
  } catch (err) {
    if (/relation "user_attribution" does not exist|relation "touchpoint_events" does not exist/i.test(String(err))) {
      return res.status(200).json({
        period_days: period,
        since: new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString(),
        by_source: SOURCES.map((s) => ({ source: s, label: SOURCE_LABELS[s], visite: 0, click: 0, ingressi: 0, primo_utilizzo: 0, upgrade_pro: 0, pro_attivi: 0, note: 'Esegui migration 005_touchpoint_funnel.sql' })),
        data_note: 'Esegui la migration 005_touchpoint_funnel.sql sul DB.',
      });
    }
    console.error('handleTouchpointFunnel', err);
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
    { id: 'auth-figma-live', name: 'Figma OAuth – risposta Figma (app valida?)', url: null },
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
    pingFigmaOAuthLive(authUrl, 'auth-figma-live'),
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

/**
 * Simula l’inizio del flusso OAuth: init → start (redirect) → richiesta a Figma.
 * Se Figma risponde con "doesn't exist" / "does not exist" (app in review o client_id errato), segnala degraded.
 * Così in dashboard si vede se il problema è lato Figma, non solo se i nostri endpoint rispondono.
 */
async function pingFigmaOAuthLive(authBaseUrl, id) {
  const start = Date.now();
  try {
    const initRes = await fetch(authBaseUrl + '/api/figma-oauth/init', { method: 'GET', signal: AbortSignal.timeout(8000) });
    if (!initRes.ok) return { id, status: 'down', latencyMs: Date.now() - start, message: `Init HTTP ${initRes.status}` };
    const initData = await initRes.json();
    const startUrl = initData?.authUrl;
    if (!startUrl || typeof startUrl !== 'string') return { id, status: 'degraded', latencyMs: Date.now() - start, message: 'Init senza authUrl' };

    const startRes = await fetch(startUrl, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8000) });
    const figmaUrl = startRes.headers.get('location');
    if (!figmaUrl || !figmaUrl.includes('figma.com')) return { id, status: 'degraded', latencyMs: Date.now() - start, message: 'Redirect a Figma non ricevuto' };

    const figmaRes = await fetch(figmaUrl, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(10000) });
    const body = await figmaRes.text();
    const badMessage = body.includes("doesn't exist") || body.includes('does not exist') || body.includes('OAuth app with client id');
    if (badMessage) {
      const snippet = body.includes("doesn't exist") ? "Figma: OAuth app doesn't exist (app in review o client_id errato)" : (body.slice(0, 120).replace(/\s+/g, ' ').trim() || 'Figma: risposta di errore');
      return { id, status: 'degraded', latencyMs: Date.now() - start, message: snippet };
    }
    return { id, status: 'up', latencyMs: Date.now() - start, message: null };
  } catch (e) {
    return { id, status: 'down', latencyMs: Date.now() - start, message: (e && e.message) || 'Timeout o errore' };
  }
}
