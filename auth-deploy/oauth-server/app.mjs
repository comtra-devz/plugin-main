/**
 * Express app per Figma OAuth. Usato da Vercel (api/figma-oauth).
 * Store: REDIS_URL o memoria. Credits: POSTGRES_URL + JWT_SECRET.
 */
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';

const FIGMA_CLIENT_ID = process.env.FIGMA_CLIENT_ID;
const FIGMA_CLIENT_SECRET = process.env.FIGMA_CLIENT_SECRET;
const BASE_URL = (process.env.BASE_URL || 'http://localhost:3456').replace(/\/$/, '');
const JWT_SECRET = process.env.JWT_SECRET || 'comtra-dev-secret-change-in-prod';
const FREE_TIER_CREDITS = 25;

async function createFlowStore() {
  if (process.env.REDIS_URL) {
    const { createClient } = await import('redis');
    const client = createClient({ url: process.env.REDIS_URL });
    client.on('error', () => {});
    await client.connect();
    return {
      async set(key, value) {
        await client.set(key, JSON.stringify(value), { EX: 600 });
      },
      async get(key) {
        const v = await client.get(key);
        return v == null ? undefined : JSON.parse(v);
      },
      async delete(key) {
        await client.del(key);
      },
    };
  }
  const map = new Map();
  return {
    async set(key, value) {
      map.set(key, value);
    },
    async get(key) {
      return map.get(key);
    },
    async delete(key) {
      map.delete(key);
    },
  };
}

let flowStorePromise;
function getFlowStore() {
  if (!flowStorePromise) flowStorePromise = createFlowStore();
  return flowStorePromise;
}

const app = express();
app.use(cookieParser());
app.use(cors({
  origin: (origin, cb) => {
    if (origin == null || origin === '' || origin === 'null') {
      cb(null, '*');
    } else {
      cb(null, true);
    }
  },
}));
app.use(express.json());

app.get('/auth/figma/init', async (req, res) => {
  const store = await getFlowStore();
  const flowId = randomBytes(16).toString('hex');
  await store.set(flowId, null);
  const authUrl = `${BASE_URL}/auth/figma/start?flow_id=${flowId}`;
  res.json({ authUrl, readKey: flowId });
});

app.get('/auth/figma/start', (req, res) => {
  const flowId = req.query.flow_id;
  if (!flowId) return res.status(400).send('Invalid flow');
  const isSecure = BASE_URL.startsWith('https://');
  res.cookie('figma_oauth_flow', flowId, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });
  const redirectUri = `${BASE_URL}/auth/figma/callback`;
  const scope = 'current_user:read';
  const figmaAuthUrl = `https://www.figma.com/oauth?client_id=${FIGMA_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${flowId}&response_type=code`;
  res.redirect(figmaAuthUrl);
});

app.get('/auth/figma/callback', async (req, res) => {
  const { code, state: flowId } = req.query;
  const cookieFlow = req.cookies?.figma_oauth_flow;
  if (!flowId) return res.status(400).send('Invalid state (missing)');

  const store = await getFlowStore();
  const existing = await store.get(flowId);
  if (existing === undefined) return res.status(400).send('Expired flow');
  if (cookieFlow !== undefined && cookieFlow !== flowId) return res.status(400).send('Invalid state');
  if (!FIGMA_CLIENT_ID || !FIGMA_CLIENT_SECRET) return res.status(500).send('Server misconfigured');

  const redirectUri = `${BASE_URL}/auth/figma/callback`;
  const tokenRes = await fetch('https://api.figma.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${FIGMA_CLIENT_ID}:${FIGMA_CLIENT_SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({ redirect_uri: redirectUri, code, grant_type: 'authorization_code' }),
  });
  if (!tokenRes.ok) {
    console.error('Figma token error', await tokenRes.text());
    return res.status(400).send('Auth failed');
  }

  const tokenData = await tokenRes.json();
  const meRes = await fetch('https://api.figma.com/v1/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!meRes.ok) return res.status(400).send('Could not load user');
  const figmaUser = await meRes.json();

  const user = {
    id: figmaUser.id,
    name: figmaUser.handle || figmaUser.email || 'User',
    email: figmaUser.email || '',
    img_url: figmaUser.img_url || null,
    plan: 'FREE',
    stats: {
      maxHealthScore: 0,
      wireframesGenerated: 0,
      wireframesModified: 0,
      analyzedA11y: 0,
      analyzedUX: 0,
      analyzedProto: 0,
      syncedStorybook: 0,
      syncedGithub: 0,
      syncedBitbucket: 0,
      affiliatesCount: 0,
    },
  };

  if (process.env.POSTGRES_URL) {
    try {
      const { sql } = await import('@vercel/postgres');
      await sql`
        INSERT INTO users (id, email, name, img_url, plan, credits_total, credits_used, total_xp, current_level, updated_at)
        VALUES (${user.id}, ${user.email}, ${user.name}, ${user.img_url}, 'FREE', ${FREE_TIER_CREDITS}, 0, 0, 1, NOW())
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          img_url = EXCLUDED.img_url,
          updated_at = NOW()
      `;
      const aff = await sql`SELECT total_referrals FROM affiliates WHERE user_id = ${user.id} LIMIT 1`;
      if (aff.rows.length > 0) user.stats.affiliatesCount = Number(aff.rows[0].total_referrals) || 0;
      const xpRow = await sql`SELECT total_xp, current_level FROM users WHERE id = ${user.id} LIMIT 1`;
      if (xpRow.rows.length > 0) {
        const txp = Number(xpRow.rows[0].total_xp) || 0;
        const info = getLevelInfo(txp);
        user.total_xp = txp;
        user.current_level = info.level;
        user.xp_for_next_level = info.xpForNextLevel;
        user.xp_for_current_level_start = info.xpForCurrentLevelStart;
      }
    } catch (err) {
      console.error('Postgres upsert user', err);
    }
  }

  const authToken = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '365d' });
  user.authToken = authToken;

  await store.set(flowId, { user });
  res.clearCookie('figma_oauth_flow');
  res.send(getReturnToFigmaHtml());
});

function getReturnToFigmaHtml() {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login completato – Comtra</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Tiny5&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Space Grotesk', sans-serif; margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #ff90e8; padding: 24px; }
    h1 { font-family: 'Tiny5', sans-serif; font-size: 2rem; font-weight: 700; margin: 0 0 0.5rem; color: #000; text-transform: uppercase; letter-spacing: 0.05em; }
    p { font-size: 0.95rem; color: #000; margin: 0 0 1.5rem; font-weight: 500; }
  </style>
</head>
<body>
  <h1>Login completato</h1>
  <p>Questa finestra si chiuderà e tornerai a Figma.</p>
  <script>
    setTimeout(function() {
      try { window.location.href = 'figma://'; } catch(e) {}
      setTimeout(function() { window.close(); }, 300);
    }, 5000);
  </script>
</body>
</html>`;
}

app.get('/auth/figma/poll', async (req, res) => {
  const readKey = req.query.read_key;
  if (!readKey) return res.status(400).json({ error: 'read_key required' });
  const store = await getFlowStore();
  const data = await store.get(readKey);
  if (data === undefined) return res.status(404).json({ error: 'not found' });
  if (data === null) return res.status(202).json({ status: 'pending' });
  await store.delete(readKey);
  res.json(data);
});

app.get('/auth/figma/plugin', (req, res) => {
  const readKey = req.query.read_key;
  const authUrl = req.query.auth_url;
  const pluginId = req.query.plugin_id || 'COMTRA_PLUGIN_DEV_ID';
  if (!readKey || !authUrl) return res.status(400).send('Missing read_key or auth_url');
  const pollUrl = `${BASE_URL}/api/figma-oauth/poll?read_key=${encodeURIComponent(readKey)}`;
  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login Figma – Comtra</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #ff90e8; padding: 24px; }
    .card { background: #fff; border: 2px solid #000; padding: 2rem; max-width: 360px; text-align: center; box-shadow: 6px 6px 0 #000; }
    h1 { font-size: 1.2rem; margin: 0 0 0.5rem; }
    p { color: #333; margin: 0 0 1rem; font-size: 0.9rem; }
    .done { color: green; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Login con Figma</h1>
    <p id="msg">Apertura finestra di login…</p>
  </div>
  <script>
    (function() {
      var authUrl = ${JSON.stringify(authUrl)};
      var pollUrl = ${JSON.stringify(pollUrl)};
      var pluginId = ${JSON.stringify(pluginId)};
      window.open(authUrl, '_blank');
      var msg = document.getElementById('msg');
      msg.textContent = 'Completa il login nella finestra aperta, poi torna qui.';
      var interval = setInterval(function() {
        fetch(pollUrl)
          .then(function(r) {
            if (r.status === 202) return null;
            if (!r.ok) return null;
            return r.json();
          })
          .then(function(data) {
            if (data && data.user) {
              clearInterval(interval);
              parent.postMessage(
                { pluginMessage: { type: 'oauth-complete', user: data.user }, pluginId: pluginId },
                'https://www.figma.com'
              );
              msg.innerHTML = 'Login completato. <span class="done">Chiudi il plugin e riaprilo per continuare.</span>';
            }
          })
          .catch(function() {});
      }, 2000);
    })();
  </script>
</body>
</html>`;
  res.send(html);
});

function getUserIdFromToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
    return decoded.sub || null;
  } catch {
    return null;
  }
}

// --- Gamification: curva livelli (L1=0, L2=100, L3=250, L4=500, L5=800, poi livello²×20 cumulativo)
const LEVEL_XP_BASE = [0, 100, 250, 500, 800];
function xpThresholdForLevel(level) {
  if (level <= 0) return 0;
  if (level <= LEVEL_XP_BASE.length) return LEVEL_XP_BASE[level - 1];
  let sum = LEVEL_XP_BASE[LEVEL_XP_BASE.length - 1];
  for (let L = LEVEL_XP_BASE.length + 1; L <= level; L++) sum += L * L * 20;
  return sum;
}
function levelFromTotalXp(totalXp) {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (xp >= xpThresholdForLevel(level + 1)) level++;
  return level;
}
function getLevelInfo(totalXp) {
  const level = levelFromTotalXp(totalXp);
  const xpForNext = xpThresholdForLevel(level + 1);
  const xpForCurrent = xpThresholdForLevel(level);
  return { level, xpForNextLevel: xpForNext, xpForCurrentLevelStart: xpForCurrent };
}

const XP_BY_ACTION = {
  audit: 50,
  scan: 50,
  wireframe_gen: 30,
  generate: 30,
  wireframe_modified: 20,
  proto_scan: 40,
  a11y_check: 35,
  ux_audit: 45,
  sync_storybook: 25,
  sync_github: 25,
  sync_bitbucket: 25,
  sync: 25,
  fix_accepted: 10,
  bug_report: 5,
};

function estimateCreditsByAction(actionType, nodeCount) {
  const n = nodeCount ?? 0;
  if (actionType === 'audit' || actionType === 'scan') {
    if (n <= 500) return 2;
    if (n <= 5000) return 5;
    if (n <= 50000) return 8;
    return 11;
  }
  if (actionType === 'wireframe_gen' || actionType === 'generate') return 3;
  if (actionType === 'proto_scan') return 2;
  if (actionType === 'a11y_check') return 2;
  if (actionType === 'ux_audit') return 4;
  if (actionType === 'sync') return 1;
  return 5;
}

app.get('/api/credits', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.POSTGRES_URL) {
    return res.json({
      credits_remaining: FREE_TIER_CREDITS,
      credits_total: FREE_TIER_CREDITS,
      credits_used: 0,
      plan: 'FREE',
      plan_expires_at: null,
      current_level: 1,
      total_xp: 0,
      xp_for_next_level: 100,
      xp_for_current_level_start: 0,
    });
  }
  try {
    const { sql } = await import('@vercel/postgres');
    const r = await sql`SELECT credits_total, credits_used, plan, plan_expires_at, total_xp, current_level FROM users WHERE id = ${userId}`;
    if (r.rows.length === 0) {
      return res.json({
        credits_remaining: FREE_TIER_CREDITS,
        credits_total: FREE_TIER_CREDITS,
        credits_used: 0,
        plan: 'FREE',
        plan_expires_at: null,
        current_level: 1,
        total_xp: 0,
        xp_for_next_level: 100,
        xp_for_current_level_start: 0,
      });
    }
    const row = r.rows[0];
    const total = Number(row.credits_total) || 0;
    const used = Number(row.credits_used) || 0;
    const remaining = Math.max(0, total - used);
      const totalXp = Math.max(0, Number(row.total_xp) || 0);
    const info = getLevelInfo(totalXp);
    res.json({
      credits_remaining: remaining,
      credits_total: total,
      credits_used: used,
      plan: row.plan || 'FREE',
      plan_expires_at: row.plan_expires_at ?? null,
      current_level: info.level,
      total_xp: totalXp,
      xp_for_next_level: info.xpForNextLevel,
      xp_for_current_level_start: info.xpForCurrentLevelStart ?? 0,
    });
  } catch (err) {
    console.error('GET /api/credits', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/credits/estimate', async (req, res) => {
  const body = req.body || {};
  const actionType = body.action_type || 'audit';
  const nodeCount = body.node_count != null ? Number(body.node_count) : undefined;
  const estimated = estimateCreditsByAction(actionType, nodeCount);
  res.json({ estimated_credits: estimated });
});

app.post('/api/credits/consume', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body || {};
  const actionType = body.action_type || 'audit';
  const creditsConsumed = Math.max(0, Math.floor(Number(body.credits_consumed) || 0));
  const fileId = body.file_id || null;
  if (creditsConsumed <= 0) return res.status(400).json({ error: 'credits_consumed must be positive' });

  if (!process.env.POSTGRES_URL) {
    return res.json({ credits_remaining: Math.max(0, FREE_TIER_CREDITS - creditsConsumed), credits_total: FREE_TIER_CREDITS, credits_used: creditsConsumed });
  }
  try {
    const { sql } = await import('@vercel/postgres');
    const r = await sql`SELECT credits_total, credits_used FROM users WHERE id = ${userId}`;
    if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const row = r.rows[0];
    const total = Number(row.credits_total) || 0;
    const used = Number(row.credits_used) || 0;
    const remaining = Math.max(0, total - used);
    if (remaining < creditsConsumed) return res.status(402).json({ error: 'Insufficient credits', credits_remaining: remaining });

    await sql`UPDATE users SET credits_used = credits_used + ${creditsConsumed}, updated_at = NOW() WHERE id = ${userId}`;
    await sql`INSERT INTO credit_transactions (user_id, action_type, credits_consumed, file_id) VALUES (${userId}, ${actionType}, ${creditsConsumed}, ${fileId})`;

    const maxHealthFromBody = body.max_health_score != null ? Math.max(0, Math.min(100, Number(body.max_health_score))) : null;
    if (maxHealthFromBody != null) {
      await sql`UPDATE users SET max_health_score = GREATEST(COALESCE(max_health_score, 0), ${maxHealthFromBody}), updated_at = NOW() WHERE id = ${userId}`;
    }
    if (actionType === 'fix_accepted') {
      await sql`UPDATE users SET fixes_accepted_total = COALESCE(fixes_accepted_total, 0) + 1, consecutive_fixes = COALESCE(consecutive_fixes, 0) + 1, updated_at = NOW() WHERE id = ${userId}`;
    } else if (actionType === 'bug_report') {
      await sql`UPDATE users SET bug_reports_total = COALESCE(bug_reports_total, 0) + 1, updated_at = NOW() WHERE id = ${userId}`;
    }
    if (body.reset_consecutive_fixes) {
      await sql`UPDATE users SET consecutive_fixes = 0, updated_at = NOW() WHERE id = ${userId}`;
    }
    if (body.token_fixes_delta != null && body.token_fixes_delta > 0) {
      await sql`UPDATE users SET token_fixes_total = COALESCE(token_fixes_total, 0) + ${Math.floor(body.token_fixes_delta)}, updated_at = NOW() WHERE id = ${userId}`;
    }

    let levelUp = false;
    let currentLevel = 1;
    let totalXp = 0;
    let xpForNextLevel = 100;
    const xpEarned = XP_BY_ACTION[actionType] ?? 0;
    const u = await sql`SELECT total_xp, current_level FROM users WHERE id = ${userId} LIMIT 1`;
    if (u.rows.length > 0) {
      totalXp = Math.max(0, Number(u.rows[0].total_xp) || 0);
      const oldLevel = Math.max(1, Number(u.rows[0].current_level) || 1);
      if (xpEarned > 0) {
        totalXp += xpEarned;
        const info = getLevelInfo(totalXp);
        currentLevel = info.level;
        xpForNextLevel = info.xpForNextLevel;
        levelUp = currentLevel > oldLevel;
        await sql`UPDATE users SET total_xp = ${totalXp}, current_level = ${currentLevel}, updated_at = NOW() WHERE id = ${userId}`;
        await sql`INSERT INTO xp_transactions (user_id, action_type, xp_earned) VALUES (${userId}, ${actionType}, ${xpEarned})`;
      } else {
        const info = getLevelInfo(totalXp);
        currentLevel = info.level;
        xpForNextLevel = info.xpForNextLevel;
      }
    }

    const newUsed = used + creditsConsumed;
    const newRemaining = Math.max(0, total - newUsed);
    const infoResp = getLevelInfo(totalXp);
    let newTrophies = [];
    try {
      newTrophies = await checkTrophies(sql, userId);
    } catch (e) {
      console.error('checkTrophies', e);
    }
    res.json({
      credits_remaining: newRemaining,
      credits_total: total,
      credits_used: newUsed,
      level_up: levelUp,
      current_level: currentLevel,
      total_xp: totalXp,
      xp_for_next_level: xpForNextLevel,
      xp_for_current_level_start: infoResp.xpForCurrentLevelStart,
      new_trophies: newTrophies,
    });
  } catch (err) {
    console.error('POST /api/credits/consume', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Trofei: contesto utente e check sblocco
async function getTrophyContext(sql, userId) {
  const u = await sql`SELECT total_xp, max_health_score, fixes_accepted_total, consecutive_fixes, token_fixes_total, bug_reports_total, linkedin_shared
    FROM users WHERE id = ${userId} LIMIT 1`;
  const userRow = u.rows[0] || {};
  const totalXp = Math.max(0, Number(userRow.total_xp) || 0);
  const maxHealth = Math.max(0, Number(userRow.max_health_score) || 0);
  const fixesAccepted = Math.max(0, Number(userRow.fixes_accepted_total) || 0);
  const consecutiveFixes = Math.max(0, Number(userRow.consecutive_fixes) || 0);
  const tokenFixes = Math.max(0, Number(userRow.token_fixes_total) || 0);
  const bugReports = Math.max(0, Number(userRow.bug_reports_total) || 0);
  const linkedinShared = !!userRow.linkedin_shared;

  const ct = await sql`SELECT action_type, COUNT(*) as c FROM credit_transactions WHERE user_id = ${userId} GROUP BY action_type`;
  const counts = {};
  for (const r of ct.rows) counts[r.action_type] = Number(r.c) || 0;
  const audits = (counts.audit || 0) + (counts.scan || 0);
  const wireframesGen = (counts.wireframe_gen || 0) + (counts.generate || 0);
  const protoScans = counts.proto_scan || 0;
  const a11y = counts.a11y_check || 0;
  const ux = counts.ux_audit || 0;
  const syncStorybook = counts.sync_storybook || 0;
  const syncGithub = counts.sync_github || 0;
  const syncBitbucket = counts.sync_bitbucket || 0;

  const today = await sql`SELECT COUNT(*) as c FROM credit_transactions WHERE user_id = ${userId} AND action_type IN ('audit','scan') AND created_at::date = CURRENT_DATE`;
  const auditsToday = Number(today.rows[0]?.c) || 0;

  let affiliateReferrals = 0;
  const aff = await sql`SELECT total_referrals FROM affiliates WHERE user_id = ${userId} LIMIT 1`;
  if (aff.rows.length > 0) affiliateReferrals = Number(aff.rows[0].total_referrals) || 0;

  return {
    totalXp, maxHealth, fixesAccepted, consecutiveFixes, tokenFixes, bugReports, linkedinShared,
    audits, wireframesGen, protoScans, a11y, ux, syncStorybook, syncGithub, syncBitbucket,
    auditsToday, affiliateReferrals,
  };
}

function evaluateTrophyCondition(condition, ctx, unlockedIds) {
  if (!condition || !condition.type) return false;
  const t = condition.type;
  const v = condition.value;
  if (t === 'xp_min') return ctx.totalXp >= (v || 0);
  if (t === 'audits_min') return ctx.audits >= (v || 0);
  if (t === 'wireframes_gen_min') return ctx.wireframesGen >= (v || 0);
  if (t === 'health_min') return ctx.maxHealth >= (v || 0);
  if (t === 'consecutive_fixes_min') return ctx.consecutiveFixes >= (v || 0);
  if (t === 'proto_scans_min') return ctx.protoScans >= (v || 0);
  if (t === 'token_fixes_min') return ctx.tokenFixes >= (v || 0);
  if (t === 'bug_reports_min') return ctx.bugReports >= (v || 0);
  if (t === 'fixes_accepted_min') return ctx.fixesAccepted >= (v || 0);
  if (t === 'audits_today_min') return ctx.auditsToday >= (v || 0);
  if (t === 'all_syncs_used') return ctx.syncStorybook > 0 && ctx.syncGithub > 0 && ctx.syncBitbucket > 0;
  if (t === 'linkedin_shared') return ctx.linkedinShared;
  if (t === 'affiliate_referrals_min') return ctx.affiliateReferrals >= (v || 0);
  if (t === 'all_other_trophies') {
    const other = ['NOVICE_SPROUT','SOLID_ROCK','IRON_FRAME','BRONZE_AUDITOR','DIAMOND_PARSER','SILVER_SURFER','GOLDEN_STANDARD','PLATINUM_PRODUCER','OBSIDIAN_MODE','PIXEL_PERFECT','TOKEN_MASTER','SYSTEM_LORD','BUG_HUNTER','THE_FIXER','SPEED_DEMON','HARMONIZER','SOCIALITE','INFLUENCER','DESIGN_LEGEND'];
    return other.every(id => unlockedIds.includes(id));
  }
  return false;
}

async function checkTrophies(sql, userId) {
  const ctx = await getTrophyContext(sql, userId);
  const unlocked = await sql`SELECT trophy_id FROM user_trophies WHERE user_id = ${userId}`;
  const unlockedIds = (unlocked.rows || []).map(r => r.trophy_id);
  const all = await sql`SELECT id, name, unlock_condition FROM trophies ORDER BY sort_order`;
  const newlyUnlocked = [];
  for (const row of all.rows || []) {
    if (unlockedIds.includes(row.id)) continue;
    const cond = row.unlock_condition && (typeof row.unlock_condition === 'object' ? row.unlock_condition : JSON.parse(row.unlock_condition || '{}'));
    if (evaluateTrophyCondition(cond, ctx, unlockedIds)) {
      await sql`INSERT INTO user_trophies (user_id, trophy_id) VALUES (${userId}, ${row.id}) ON CONFLICT (user_id, trophy_id) DO NOTHING`;
      newlyUnlocked.push({ id: row.id, name: row.name });
      unlockedIds.push(row.id);
    }
  }
  return newlyUnlocked;
}

app.get('/api/trophies', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.POSTGRES_URL) return res.json({ trophies: [], unlocked_ids: [] });
  try {
    const { sql } = await import('@vercel/postgres');
    const all = await sql`SELECT id, name, description, icon_id, sort_order FROM trophies ORDER BY sort_order`;
    const ut = await sql`SELECT trophy_id, unlocked_at FROM user_trophies WHERE user_id = ${userId}`;
    const unlockedSet = new Set((ut.rows || []).map(r => r.trophy_id));
    const unlockedAt = {};
    for (const r of ut.rows || []) unlockedAt[r.trophy_id] = r.unlocked_at;
    const trophies = (all.rows || []).map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      icon_id: row.icon_id,
      sort_order: row.sort_order,
      unlocked: unlockedSet.has(row.id),
      unlocked_at: unlockedAt[row.id] || null,
    }));
    const unlocked_ids = Array.from(unlockedSet);
    res.json({ trophies, unlocked_ids });
  } catch (err) {
    console.error('GET /api/trophies', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/trophies/linkedin-shared', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.POSTGRES_URL) return res.json({ linkedin_shared: true, new_trophies: [] });
  try {
    const { sql } = await import('@vercel/postgres');
    await sql`UPDATE users SET linkedin_shared = true, updated_at = NOW() WHERE id = ${userId}`;
    const newTrophies = await checkTrophies(sql, userId);
    res.json({ linkedin_shared: true, new_trophies: newTrophies });
  } catch (err) {
    console.error('POST /api/trophies/linkedin-shared', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Affiliate self-service: ottieni o registra codice (JWT)
function randomAffiliateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

app.get('/api/affiliates/me', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.POSTGRES_URL) return res.status(503).json({ error: 'Affiliates not configured' });
  try {
    const { sql } = await import('@vercel/postgres');
    const r = await sql`SELECT affiliate_code, total_referrals FROM affiliates WHERE user_id = ${userId} LIMIT 1`;
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not an affiliate', affiliate_code: null });
    res.json({ affiliate_code: r.rows[0].affiliate_code, total_referrals: Number(r.rows[0].total_referrals) || 0 });
  } catch (err) {
    console.error('GET /api/affiliates/me', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/affiliates/register', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.POSTGRES_URL) return res.status(503).json({ error: 'Affiliates not configured' });
  try {
    const { sql } = await import('@vercel/postgres');
    let r = await sql`SELECT affiliate_code FROM affiliates WHERE user_id = ${userId} LIMIT 1`;
    if (r.rows.length > 0) {
      return res.json({ affiliate_code: r.rows[0].affiliate_code, already_registered: true });
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomAffiliateCode();
      try {
        await sql`INSERT INTO affiliates (user_id, affiliate_code) VALUES (${userId}, ${code})`;
        return res.status(201).json({ affiliate_code: code });
      } catch (e) {
        if (e.code !== '23505') throw e; // unique violation = retry with new code
      }
    }
    res.status(500).json({ error: 'Could not generate unique code' });
  } catch (err) {
    console.error('POST /api/affiliates/register', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Test: simula un referral affiliato (senza webhook Lemon). Solo se TEST_AFFILIATE_SECRET è impostato.
app.post('/api/test/simulate-referral', async (req, res) => {
  const secret = req.headers['x-test-secret'];
  if (!process.env.TEST_AFFILIATE_SECRET || secret !== process.env.TEST_AFFILIATE_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!process.env.POSTGRES_URL) return res.status(503).json({ error: 'Not configured' });
  const body = req.body || {};
  const code = (body.affiliate_code || '').trim();
  if (!code) return res.status(400).json({ error: 'affiliate_code required' });
  try {
    const { sql } = await import('@vercel/postgres');
    const r = await sql`UPDATE affiliates SET total_referrals = total_referrals + 1, updated_at = NOW() WHERE affiliate_code = ${code} RETURNING user_id, total_referrals`;
    if (r.rowCount === 0) return res.status(404).json({ error: 'Affiliate code not found' });
    res.json({ ok: true, user_id: r.rows[0].user_id, total_referrals: Number(r.rows[0].total_referrals) });
  } catch (err) {
    console.error('simulate-referral', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default app;
