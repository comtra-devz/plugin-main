/**
 * Express app per Figma OAuth. Usato da Vercel (api/figma-oauth).
 * Store: REDIS_URL o memoria. Credits: DATABASE_URL o POSTGRES_URL + JWT_SECRET.
 */
// DB: usiamo postgres.js (compatibile con Supabase pooler); DATABASE_URL ha priorità
if (process.env.DATABASE_URL) process.env.POSTGRES_URL = process.env.DATABASE_URL;
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { sql as dbSql, withTransaction } from './db.mjs';
import {
  generateLevelDiscountCode,
  createLevelDiscount,
  deleteLevelDiscount,
  isLevelWithDiscount,
  discountPercentForLevel,
} from './lemon-discounts.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FIGMA_CLIENT_ID = process.env.FIGMA_CLIENT_ID;
const FIGMA_CLIENT_SECRET = process.env.FIGMA_CLIENT_SECRET;
const BASE_URL = (process.env.BASE_URL || 'http://localhost:3456').replace(/\/$/, '');
const JWT_SECRET = process.env.JWT_SECRET || 'comtra-dev-secret-change-in-prod';
/** DB URL: DATABASE_URL ha priorità (utile se POSTGRES_URL è bloccata dall'integrazione Vercel). */
const POSTGRES_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
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
  const scope = 'current_user:read file_content:read';
  const figmaAuthUrl = `https://www.figma.com/oauth?client_id=${FIGMA_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${flowId}&response_type=code`;
  res.redirect(figmaAuthUrl);
});

app.get('/auth/figma/callback', async (req, res) => {
  const { code, state: flowId } = req.query;
  const cookieFlow = req.cookies?.figma_oauth_flow;
  const countryCode = (req.headers['x-vercel-ip-country'] || '').toString().toUpperCase().trim().slice(0, 2) || null;
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

  let tokenSaved = false;
  let txError = null;

  if (POSTGRES_URL && withTransaction) {
    const expiresInSec = Math.max(60, Number(tokenData.expires_in) || 90 * 24 * 3600);
    const expiresAt = new Date(Date.now() + expiresInSec * 1000);
    const refreshToken = tokenData.refresh_token || tokenData.access_token;

    try {
      await withTransaction(async (tx) => {
        await tx`
          INSERT INTO users (id, email, name, img_url, plan, credits_total, credits_used, total_xp, current_level, country_code, updated_at)
          VALUES (${user.id}, ${user.email}, ${user.name}, ${user.img_url}, 'FREE', ${FREE_TIER_CREDITS}, 0, 0, 1, ${countryCode}, NOW())
          ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            name = EXCLUDED.name,
            img_url = EXCLUDED.img_url,
            country_code = COALESCE(EXCLUDED.country_code, users.country_code),
            updated_at = NOW()
        `;
        await tx`
          INSERT INTO figma_tokens (user_id, access_token, refresh_token, expires_at, updated_at)
          VALUES (${user.id}, ${tokenData.access_token}, ${refreshToken}, ${expiresAt.toISOString()}, NOW())
          ON CONFLICT (user_id) DO UPDATE SET
            access_token = EXCLUDED.access_token,
            refresh_token = EXCLUDED.refresh_token,
            expires_at = EXCLUDED.expires_at,
            updated_at = NOW()
        `;
      });
      tokenSaved = true;
    } catch (err) {
      txError = err;
      console.error('OAuth callback: users+figma_tokens transaction FAILED — user_id=', user.id, 'error=', err?.message || err);
    }
  } else if (POSTGRES_URL) {
    console.warn('OAuth callback: withTransaction not available, falling back to non-atomic save');
    try {
      await dbSql`
        INSERT INTO users (id, email, name, img_url, plan, credits_total, credits_used, total_xp, current_level, country_code, updated_at)
        VALUES (${user.id}, ${user.email}, ${user.name}, ${user.img_url}, 'FREE', ${FREE_TIER_CREDITS}, 0, 0, 1, ${countryCode}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          img_url = EXCLUDED.img_url,
          country_code = COALESCE(EXCLUDED.country_code, users.country_code),
          updated_at = NOW()
      `;
      const expiresInSec = Math.max(60, Number(tokenData.expires_in) || 90 * 24 * 3600);
      const expiresAt = new Date(Date.now() + expiresInSec * 1000);
      const refreshToken = tokenData.refresh_token || tokenData.access_token;
      await dbSql`
        INSERT INTO figma_tokens (user_id, access_token, refresh_token, expires_at, updated_at)
        VALUES (${user.id}, ${tokenData.access_token}, ${refreshToken}, ${expiresAt.toISOString()}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          expires_at = EXCLUDED.expires_at,
          updated_at = NOW()
      `;
      tokenSaved = true;
    } catch (err) {
      txError = err;
      console.error('OAuth callback: fallback save failed — user_id=', user.id, 'error=', err?.message || err);
    }
  }

  if (txError && !tokenSaved) {
    await store.set(flowId, { error: 'token_save_failed', message: txError?.message || 'Database error' });
    res.clearCookie('figma_oauth_flow');
    return res.status(500).send(getOAuthErrorHtml());
  }

  if (POSTGRES_URL && tokenSaved) {
    try {
      const aff = await dbSql`SELECT total_referrals FROM affiliates WHERE user_id = ${user.id} LIMIT 1`;
      if (aff.rows.length > 0) user.stats.affiliatesCount = Number(aff.rows[0].total_referrals) || 0;
      const xpRow = await dbSql`SELECT total_xp, current_level FROM users WHERE id = ${user.id} LIMIT 1`;
      if (xpRow.rows.length > 0) {
        const txp = Number(xpRow.rows[0].total_xp) || 0;
        const info = getLevelInfo(txp);
        user.total_xp = txp;
        user.current_level = info.level;
        user.xp_for_next_level = info.xpForNextLevel;
        user.xp_for_current_level_start = info.xpForCurrentLevelStart;
      }
    } catch (err) {
      console.error('OAuth callback: post-save SELECT failed (non-fatal)', err);
    }
  }

  const authToken = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '365d' });
  user.authToken = authToken;

  await store.set(flowId, { user, tokenSaved });
  res.clearCookie('figma_oauth_flow');
  res.send(getReturnToFigmaHtml());
});

function getOAuthErrorHtml() {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Errore – Comtra</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Tiny5&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Space Grotesk', sans-serif; margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #ff90e8; padding: 24px; }
    h1 { font-family: 'Tiny5', sans-serif; font-size: 2rem; font-weight: 700; margin: 0 0 0.5rem; color: #000; text-transform: uppercase; letter-spacing: 0.05em; }
    p { font-size: 0.95rem; color: #000; margin: 0 0 1.5rem; font-weight: 500; }
    a { color: #000; text-decoration: underline; font-weight: 700; }
  </style>
</head>
<body>
  <h1>Qualcosa non è andato a buon fine</h1>
  <p>Chiudi questa finestra e riprova il login dal plugin Figma.</p>
</body>
</html>`;
}

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

/** Get valid Figma access token for user; refresh if expired (within 5 min buffer). Returns null if no tokens or refresh fails. */
async function getFigmaAccessToken(sql, userId) {
  const r = await dbSql`SELECT access_token, refresh_token, expires_at FROM figma_tokens WHERE user_id = ${userId} LIMIT 1`;
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;
  if (expiresAt && expiresAt.getTime() > now.getTime() + bufferMs) {
    return row.access_token;
  }
  if (!FIGMA_CLIENT_ID || !FIGMA_CLIENT_SECRET) return row.access_token;
  const refreshRes = await fetch('https://api.figma.com/v1/oauth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${FIGMA_CLIENT_ID}:${FIGMA_CLIENT_SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({ refresh_token: row.refresh_token }),
  });
  if (!refreshRes.ok) {
    console.error('Figma refresh token failed', await refreshRes.text());
    return expiresAt && expiresAt.getTime() > now.getTime() ? row.access_token : null;
  }
  const data = await refreshRes.json();
  const newExpiresIn = Math.max(60, Number(data.expires_in) || 90 * 24 * 3600);
  const newExpiresAt = new Date(Date.now() + newExpiresIn * 1000);
  await dbSql`
    UPDATE figma_tokens SET access_token = ${data.access_token}, expires_at = ${newExpiresAt.toISOString()}, updated_at = NOW() WHERE user_id = ${userId}
  `;
  return data.access_token;
}

/** Force refresh Figma token (e.g. after 403 from Figma). Returns new access_token or null. Use to recover without asking user to re-login. */
async function forceRefreshFigmaToken(userId) {
  const r = await dbSql`SELECT refresh_token FROM figma_tokens WHERE user_id = ${userId} LIMIT 1`;
  if (r.rows.length === 0) {
    console.warn('forceRefreshFigmaToken: no row in figma_tokens for user_id=', userId, '(user must complete "Riconnetti Figma" once)');
    return null;
  }
  if (!FIGMA_CLIENT_ID || !FIGMA_CLIENT_SECRET) return null;
  const refreshRes = await fetch('https://api.figma.com/v1/oauth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${FIGMA_CLIENT_ID}:${FIGMA_CLIENT_SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({ refresh_token: r.rows[0].refresh_token }),
  });
  if (!refreshRes.ok) {
    console.warn('forceRefreshFigmaToken: Figma refresh failed for user_id=', userId, await refreshRes.text());
    return null;
  }
  const data = await refreshRes.json();
  const newExpiresIn = Math.max(60, Number(data.expires_in) || 90 * 24 * 3600);
  const newExpiresAt = new Date(Date.now() + newExpiresIn * 1000);
  await dbSql`
    UPDATE figma_tokens SET access_token = ${data.access_token}, expires_at = ${newExpiresAt.toISOString()}, updated_at = NOW() WHERE user_id = ${userId}
  `;
  return data.access_token;
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
  a11y_audit: 35,
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
  // A11Y Audit v1.0: same complexity bands as DS, no Kimi (backend-only: contrast, touch, OKLCH, heuristics)
  if (actionType === 'a11y_audit' || actionType === 'a11y_check') {
    if (n <= 500) return 1;
    if (n <= 5000) return 2;
    if (n <= 50000) return 4;
    return 6;
  }
  if (actionType === 'wireframe_gen' || actionType === 'generate') return 3;
  if (actionType === 'proto_scan') return 2;
  if (actionType === 'ux_audit') return 4;
  if (actionType === 'sync') return 1;
  if (actionType === 'scan_sync') return 15;
  if (actionType === 'sync_fix' || actionType === 'sync_storybook') return 5;
  return 5;
}

app.get('/api/credits', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!POSTGRES_URL) {
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
    const r = await dbSql`SELECT credits_total, credits_used, plan, plan_expires_at, total_xp, current_level FROM users WHERE id = ${userId}`;
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

// --- Level discount code (gamification): get current code for authenticated user
app.get('/api/discounts/me', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!POSTGRES_URL) return res.json({ code: null, level: null, percent: null });
  try {
    const r = await dbSql`
      SELECT level, code FROM user_level_discounts WHERE user_id = ${userId} LIMIT 1
    `;
    const row = r.rows[0];
    if (!row) return res.json({ code: null, level: null, percent: null });
    const percent = discountPercentForLevel(row.level);
    return res.json({ code: row.code, level: Number(row.level), percent });
  } catch (e) {
    console.error('GET /api/discounts/me', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/credits/consume', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body || {};
  const actionType = body.action_type || 'audit';
  const creditsConsumed = Math.max(0, Math.floor(Number(body.credits_consumed) || 0));
  const fileId = body.file_id || null;
  if (creditsConsumed <= 0) return res.status(400).json({ error: 'credits_consumed must be positive' });

  if (!POSTGRES_URL) {
    return res.json({ credits_remaining: Math.max(0, FREE_TIER_CREDITS - creditsConsumed), credits_total: FREE_TIER_CREDITS, credits_used: creditsConsumed });
  }
  try {
    const r = await dbSql`SELECT credits_total, credits_used FROM users WHERE id = ${userId}`;
    if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const row = r.rows[0];
    const total = Number(row.credits_total) || 0;
    const used = Number(row.credits_used) || 0;
    const remaining = Math.max(0, total - used);
    if (remaining < creditsConsumed) return res.status(402).json({ error: 'Insufficient credits', credits_remaining: remaining });

    await dbSql`UPDATE users SET credits_used = credits_used + ${creditsConsumed}, updated_at = NOW() WHERE id = ${userId}`;
    await dbSql`INSERT INTO credit_transactions (user_id, action_type, credits_consumed, file_id) VALUES (${userId}, ${actionType}, ${creditsConsumed}, ${fileId})`;

    const maxHealthFromBody = body.max_health_score != null ? Math.max(0, Math.min(100, Number(body.max_health_score))) : null;
    if (maxHealthFromBody != null) {
      await dbSql`UPDATE users SET max_health_score = GREATEST(COALESCE(max_health_score, 0), ${maxHealthFromBody}), updated_at = NOW() WHERE id = ${userId}`;
    }
    if (actionType === 'fix_accepted') {
      await dbSql`UPDATE users SET fixes_accepted_total = COALESCE(fixes_accepted_total, 0) + 1, consecutive_fixes = COALESCE(consecutive_fixes, 0) + 1, updated_at = NOW() WHERE id = ${userId}`;
    } else if (actionType === 'bug_report') {
      await dbSql`UPDATE users SET bug_reports_total = COALESCE(bug_reports_total, 0) + 1, updated_at = NOW() WHERE id = ${userId}`;
    }
    if (body.reset_consecutive_fixes) {
      await dbSql`UPDATE users SET consecutive_fixes = 0, updated_at = NOW() WHERE id = ${userId}`;
    }
    if (body.token_fixes_delta != null && body.token_fixes_delta > 0) {
      await dbSql`UPDATE users SET token_fixes_total = COALESCE(token_fixes_total, 0) + ${Math.floor(body.token_fixes_delta)}, updated_at = NOW() WHERE id = ${userId}`;
    }

    let levelUp = false;
    let currentLevel = 1;
    let totalXp = 0;
    let xpForNextLevel = 100;
    const xpEarned = XP_BY_ACTION[actionType] ?? 0;
    const u = await dbSql`SELECT total_xp, current_level FROM users WHERE id = ${userId} LIMIT 1`;
    if (u.rows.length > 0) {
      totalXp = Math.max(0, Number(u.rows[0].total_xp) || 0);
      const oldLevel = Math.max(1, Number(u.rows[0].current_level) || 1);
      if (xpEarned > 0) {
        totalXp += xpEarned;
        const info = getLevelInfo(totalXp);
        currentLevel = info.level;
        xpForNextLevel = info.xpForNextLevel;
        levelUp = currentLevel > oldLevel;
        await dbSql`UPDATE users SET total_xp = ${totalXp}, current_level = ${currentLevel}, updated_at = NOW() WHERE id = ${userId}`;
        await dbSql`INSERT INTO xp_transactions (user_id, action_type, xp_earned) VALUES (${userId}, ${actionType}, ${xpEarned})`;
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
      newTrophies = await checkTrophies(dbSql, userId);
    } catch (e) {
      console.error('checkTrophies', e);
    }

    let levelDiscountCode = null;
    if (POSTGRES_URL && isLevelWithDiscount(currentLevel)) {
      try {
        const existing = await dbSql`
          SELECT level, lemon_discount_id, code FROM user_level_discounts WHERE user_id = ${userId} LIMIT 1
        `;
        const prev = existing.rows[0];
        if (prev && Number(prev.level) !== currentLevel) {
          await deleteLevelDiscount(prev.lemon_discount_id);
          await dbSql`DELETE FROM user_level_discounts WHERE user_id = ${userId}`;
        }
        if (!prev || Number(prev.level) !== currentLevel) {
          const code = generateLevelDiscountCode(userId, currentLevel);
          const percent = discountPercentForLevel(currentLevel);
          const created = await createLevelDiscount({
            storeId: process.env.LEMON_SQUEEZY_STORE_ID,
            variantId1y: process.env.LEMON_VARIANT_1Y || '1345319',
            name: `Level ${currentLevel} - ${percent}%`,
            code,
            amountPercent: percent,
          });
          if (created) {
            await dbSql`
              INSERT INTO user_level_discounts (user_id, level, lemon_discount_id, code)
              VALUES (${userId}, ${currentLevel}, ${created.id}, ${created.code})
              ON CONFLICT (user_id) DO UPDATE SET level = EXCLUDED.level, lemon_discount_id = EXCLUDED.lemon_discount_id, code = EXCLUDED.code
            `;
            levelDiscountCode = created.code;
          }
        } else {
          levelDiscountCode = prev.code;
        }
      } catch (e) {
        console.error('Level discount ensure', e);
      }
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
      level_discount_code: levelDiscountCode,
    });
  } catch (err) {
    console.error('POST /api/credits/consume', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Figma file (pipeline to agents): fetch file JSON with user's token
app.post('/api/figma/file', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body || {};
  const fileKey = (body.file_key || body.fileKey || '').trim();
  if (!fileKey) return res.status(400).json({ error: 'file_key required' });
  const depth = body.depth != null ? Math.min(10, Math.max(1, Number(body.depth))) : undefined;
  const nodeIds = body.node_ids || body.nodeIds;
  const idsParam = Array.isArray(nodeIds) ? nodeIds.join(',') : (typeof nodeIds === 'string' ? nodeIds : undefined);

  if (!POSTGRES_URL) {
    return res.status(503).json({ error: 'Figma file API requires database' });
  }
  try {
    let accessToken = await getFigmaAccessToken(dbSql, userId);
    if (!accessToken) {
      accessToken = await forceRefreshFigmaToken(userId);
    }
    if (!accessToken) {
      console.warn('POST /api/figma/file: no token for user_id=', userId, '(no row, expired, or refresh failed)');
      return res.status(403).json({
        error: 'Figma non connesso. Clicca "Riconnetti Figma" nel plugin.',
        code: 'FIGMA_RECONNECT',
      });
    }
    const url = new URL(`https://api.figma.com/v1/files/${fileKey}`);
    if (depth != null) url.searchParams.set('depth', String(depth));
    if (idsParam) url.searchParams.set('ids', idsParam);

    let figmaRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (figmaRes.status === 403) {
      const newToken = await forceRefreshFigmaToken(userId);
      if (newToken) {
        figmaRes = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${newToken}` },
        });
      }
    }
    if (figmaRes.status === 403) {
      console.warn('POST /api/figma/file: Figma 403 anche dopo refresh per user_id=', userId);
      return res.status(403).json({
        error: 'Figma non connesso. Clicca "Riconnetti Figma" nel plugin.',
        code: 'FIGMA_RECONNECT',
      });
    }
    if (figmaRes.status === 404) {
      return res.status(404).json({ error: 'File not found' });
    }
    if (!figmaRes.ok) {
      const text = await figmaRes.text();
      console.error('Figma file API error', figmaRes.status, text);
      return res.status(figmaRes.status >= 500 ? 502 : 400).json({ error: 'Figma API error', details: text.slice(0, 200) });
    }
    const fileJson = await figmaRes.json();
    res.setHeader('Content-Type', 'application/json');
    res.json(fileJson);
  } catch (err) {
    console.error('POST /api/figma/file', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Debug: token status — verifica con Figma API così "presente e valido" = token davvero usabile (vedi docs/FIGMA-TOKEN-TROUBLESHOOTING.md)
async function figmaTokenValidForApi(accessToken) {
  if (!accessToken) return false;
  const meRes = await fetch('https://api.figma.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return meRes.ok;
}

app.get('/api/figma/token-status', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!POSTGRES_URL) return res.json({ ok: false, hasToken: false, reason: 'no_db' });
  try {
    const r = await dbSql`SELECT access_token, expires_at FROM figma_tokens WHERE user_id = ${userId} LIMIT 1`;
    if (r.rows.length === 0) return res.json({ ok: false, hasToken: false, reason: 'no_row' });
    const token = await getFigmaAccessToken(dbSql, userId);
    if (!token) return res.json({ ok: false, hasToken: false, reason: 'expired_or_invalid' });
    const validWithFigma = await figmaTokenValidForApi(token);
    if (!validWithFigma) return res.json({ ok: false, hasToken: false, reason: 'figma_rejected' });
    return res.json({ ok: true, hasToken: true });
  } catch (err) {
    console.error('GET /api/figma/token-status', err);
    return res.status(500).json({ ok: false, hasToken: false, reason: 'error' });
  }
});
app.post('/api/figma/token-status', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!POSTGRES_URL) return res.json({ ok: false, hasToken: false, reason: 'no_db' });
  try {
    const r = await dbSql`SELECT access_token, expires_at FROM figma_tokens WHERE user_id = ${userId} LIMIT 1`;
    if (r.rows.length === 0) return res.json({ ok: false, hasToken: false, reason: 'no_row' });
    const token = await getFigmaAccessToken(dbSql, userId);
    if (!token) return res.json({ ok: false, hasToken: false, reason: 'expired_or_invalid' });
    const validWithFigma = await figmaTokenValidForApi(token);
    if (!validWithFigma) return res.json({ ok: false, hasToken: false, reason: 'figma_rejected' });
    return res.json({ ok: true, hasToken: true });
  } catch (err) {
    console.error('POST /api/figma/token-status', err);
    return res.status(500).json({ ok: false, hasToken: false, reason: 'error' });
  }
});

// --- DS Audit agent (Kimi): file_key → Figma JSON → Kimi → issues
const KIMI_API_KEY = process.env.KIMI_API_KEY;
const KIMI_MODEL = process.env.KIMI_MODEL || 'kimi-k2-0905-preview';
const DS_AUDIT_PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'ds-audit-system.md');

function extractJsonFromContent(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  const jsonBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const toParse = jsonBlock ? jsonBlock[1].trim() : trimmed;
  try {
    return JSON.parse(toParse);
  } catch {
    return null;
  }
}

function normalizeDsAuditIssue(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id != null ? String(raw.id) : `ds-${Math.random().toString(36).slice(2, 9)}`;
  const categoryId = raw.categoryId != null ? String(raw.categoryId) : 'coverage';
  const msg = raw.msg != null ? String(raw.msg) : 'Issue';
  const severity = raw.severity === 'HIGH' || raw.severity === 'MED' || raw.severity === 'LOW' ? raw.severity : 'MED';
  const layerId = raw.layerId != null ? String(raw.layerId) : '';
  const fix = raw.fix != null ? String(raw.fix) : '';
  return {
    id,
    categoryId,
    msg,
    severity,
    layerId,
    fix,
    layerIds: Array.isArray(raw.layerIds) ? raw.layerIds.map(String) : undefined,
    tokenPath: raw.tokenPath != null ? String(raw.tokenPath) : undefined,
    pageName: raw.pageName != null ? String(raw.pageName) : undefined,
  };
}

/** Count nodes in Figma file JSON (document tree) for size_band telemetry. */
function countFigmaNodes(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  let n = 1;
  if (Array.isArray(obj.children)) for (const c of obj.children) n += countFigmaNodes(c);
  return n;
}

function sizeBandFromNodeCount(n) {
  if (n <= 500) return 'small';
  if (n <= 5000) return 'medium';
  if (n <= 50000) return 'large';
  return '200k+';
}

/** Fetch file JSON from Figma REST API. Never requests the full file in one go: per-page or per-node only, to avoid 400 on large files. Returns { document } for audit engines. */
async function fetchFigmaFileForAudit(accessToken, fileKey, scope, pageId, nodeIds, pageIds) {
  const scopeType = scope === 'current' || scope === 'page' || scope === 'all' ? scope : 'all';
  const idsArr = Array.isArray(nodeIds) ? nodeIds.filter(Boolean) : [];
  const pageIdTrim = typeof pageId === 'string' ? pageId.trim() : '';
  const pageIdsArr = Array.isArray(pageIds) ? pageIds.filter(Boolean) : [];
  const auth = { headers: { Authorization: `Bearer ${accessToken}` } };

  const handleFigmaError = (res, t) => {
    if (res.status === 403) {
      console.warn('fetchFigmaFileForAudit: Figma API 403 (token rejected by Figma)');
      throw new Error('No Figma token; re-login to grant file access');
    }
    if (res.status === 404) throw new Error('File not found');
    throw new Error(t || 'Figma API error');
  };

  if (scopeType === 'current' && idsArr.length > 0) {
    const url = new URL(`https://api.figma.com/v1/files/${fileKey}/nodes`);
    url.searchParams.set('ids', idsArr.join(','));
    url.searchParams.set('depth', '5');
    const res = await fetch(url.toString(), auth);
    if (!res.ok) { const t = await res.text(); handleFigmaError(res, t); }
    const data = await res.json();
    const nodesMap = data.nodes || {};
    const docs = Object.values(nodesMap).map((v) => v && v.document).filter(Boolean);
    return { document: { type: 'DOCUMENT', id: '0:0', children: docs.length ? docs : [] } };
  }

  if (scopeType === 'page' && pageIdTrim) {
    const url = new URL(`https://api.figma.com/v1/files/${fileKey}`);
    url.searchParams.set('ids', pageIdTrim);
    url.searchParams.set('depth', '4');
    const res = await fetch(url.toString(), auth);
    if (!res.ok) { const t = await res.text(); handleFigmaError(res, t); }
    const data = await res.json();
    const doc = data.document || { type: 'DOCUMENT', id: '0:0', children: [] };
    const children = Array.isArray(doc.children) ? doc.children : [];
    return { document: { type: 'DOCUMENT', id: '0:0', children } };
  }

  if (scopeType === 'all' && pageIdsArr.length > 0) {
    const allChildren = [];
    for (const pid of pageIdsArr) {
      const url = new URL(`https://api.figma.com/v1/files/${fileKey}`);
      url.searchParams.set('ids', pid);
      url.searchParams.set('depth', '4');
      const res = await fetch(url.toString(), auth);
      if (!res.ok) { const t = await res.text(); handleFigmaError(res, t); }
      const data = await res.json();
      const doc = data.document || {};
      const kids = Array.isArray(doc.children) ? doc.children : [];
      allChildren.push(...kids);
    }
    return { document: { type: 'DOCUMENT', id: '0:0', children: allChildren } };
  }

  if (scopeType === 'all') {
    const url = new URL(`https://api.figma.com/v1/files/${fileKey}`);
    url.searchParams.set('depth', '2');
    const res = await fetch(url.toString(), auth);
    if (!res.ok) { const t = await res.text(); handleFigmaError(res, t); }
    const data = await res.json();
    return { document: data.document || { type: 'DOCUMENT', id: '0:0', children: [] } };
  }

  const url = new URL(`https://api.figma.com/v1/files/${fileKey}`);
  url.searchParams.set('depth', '2');
  const res = await fetch(url.toString(), auth);
  if (!res.ok) { const t = await res.text(); handleFigmaError(res, t); }
  const data = await res.json();
  return { document: data.document || { type: 'DOCUMENT', id: '0:0', children: [] } };
}

app.post('/api/agents/ds-audit', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body || {};
  const fileKey = (body.file_key || body.fileKey || '').trim();
  const fileJsonFromBody = body.file_json || body.fileJson;
  if (!fileKey && !fileJsonFromBody) return res.status(400).json({ error: 'file_key or file_json required' });

  if (!POSTGRES_URL) return res.status(503).json({ error: 'DS Audit requires database' });
  if (!KIMI_API_KEY) return res.status(503).json({ error: 'KIMI_API_KEY not configured' });

  let systemPrompt;
  const pathsToTry = [DS_AUDIT_PROMPT_PATH, path.join(process.cwd(), 'prompts', 'ds-audit-system.md')];
  for (const p of pathsToTry) {
    try {
      systemPrompt = readFileSync(p, 'utf8');
      if (systemPrompt && systemPrompt.length > 0) break;
    } catch (_) {}
  }
  if (!systemPrompt) {
    console.error('DS Audit: failed to read prompt', pathsToTry);
    return res.status(500).json({ error: 'System prompt not found' });
  }

  try {
    let fileJson;
    if (fileJsonFromBody && typeof fileJsonFromBody === 'object' && fileJsonFromBody.document) {
      fileJson = fileJsonFromBody;
    } else if (fileKey) {
      let accessToken = await getFigmaAccessToken(dbSql, userId);
      if (!accessToken) accessToken = await forceRefreshFigmaToken(userId);
      if (!accessToken) {
        console.warn('POST /api/agents/ds-audit: no token for user_id=', userId);
        return res.status(403).json({ error: 'Figma non connesso. Clicca "Riconnetti Figma" nel plugin.', code: 'FIGMA_RECONNECT' });
      }
      let fetchErr = null;
      try {
        fileJson = await fetchFigmaFileForAudit(accessToken, fileKey, body.scope, body.page_id || body.pageId, body.node_ids || body.nodeIds, body.page_ids || body.pageIds);
      } catch (err) {
        fetchErr = err;
      }
      if (fetchErr && fetchErr.message && fetchErr.message.includes('re-login')) {
        const newToken = await forceRefreshFigmaToken(userId);
        if (newToken) {
          try {
            fileJson = await fetchFigmaFileForAudit(newToken, fileKey, body.scope, body.page_id || body.pageId, body.node_ids || body.nodeIds, body.page_ids || body.pageIds);
            fetchErr = null;
          } catch (e) {
            fetchErr = e;
          }
        }
      }
      if (fetchErr) {
        const msg = fetchErr && fetchErr.message ? fetchErr.message : 'Figma API error';
        if (msg.includes('re-login')) return res.status(403).json({ error: 'Figma non connesso. Clicca "Riconnetti Figma" nel plugin.', code: 'FIGMA_RECONNECT' });
        if (msg.includes('not found')) return res.status(404).json({ error: msg });
        return res.status(400).json({ error: msg });
      }
    } else {
      return res.status(400).json({ error: 'file_json must include document' });
    }
    const userMessage = `Ecco il JSON del file di design. Esegui l'audit secondo le regole e restituisci solo un JSON con chiave "issues" (array di issue). Nessun testo prima o dopo.\n\n${JSON.stringify(fileJson)}`;

    const kimiRes = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KIMI_API_KEY}`,
      },
      body: JSON.stringify({
        model: KIMI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_completion_tokens: 4096,
      }),
    });
    if (!kimiRes.ok) {
      const t = await kimiRes.text();
      console.error('DS Audit: Kimi API', kimiRes.status, t.slice(0, 300));
      return res.status(kimiRes.status >= 500 ? 502 : 400).json({ error: 'Kimi API error', details: t.slice(0, 200) });
    }
    const kimiData = await kimiRes.json();
    const content = kimiData?.choices?.[0]?.message?.content;
    const parsed = extractJsonFromContent(content);
    const rawIssues = Array.isArray(parsed?.issues) ? parsed.issues : [];
    const issues = rawIssues.map(normalizeDsAuditIssue).filter(Boolean);

    // Telemetria uso token (anonima): log per dashboard. Vedi docs/TOKEN-USAGE-TELEMETRY.md
    const usage = kimiData?.usage;
    const inputTokens = Math.max(0, Number(usage?.input_tokens ?? usage?.prompt_tokens ?? 0));
    const outputTokens = Math.max(0, Number(usage?.output_tokens ?? usage?.completion_tokens ?? 0));
    if (dbSql && (inputTokens > 0 || outputTokens > 0)) {
      const nodeCount = countFigmaNodes(fileJson?.document);
      const sizeBand = nodeCount > 0 ? sizeBandFromNodeCount(nodeCount) : null;
      dbSql`
        INSERT INTO kimi_usage_log (action_type, input_tokens, output_tokens, size_band, model)
        VALUES ('ds_audit', ${inputTokens}, ${outputTokens}, ${sizeBand}, ${KIMI_MODEL})
      `.catch((err) => console.error('Kimi usage log insert failed', err.message));
    }

    res.json({ issues });
  } catch (err) {
    console.error('POST /api/agents/ds-audit', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Generate agent (Kimi): file_key + prompt → action plan JSON
const GENERATE_PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'generate-system.md');

app.post('/api/agents/generate', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body || {};
  const fileKey = (body.file_key || body.fileKey || '').trim();
  const prompt = (body.prompt || body.promptText || '').trim();
  const mode = body.mode || 'create';
  const dsSource = body.ds_source || body.dsSource || 'custom';

  if (!fileKey) return res.status(400).json({ error: 'file_key required' });
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  if (!KIMI_API_KEY) return res.status(503).json({ error: 'KIMI_API_KEY not configured' });

  let systemPrompt;
  try {
    systemPrompt = readFileSync(GENERATE_PROMPT_PATH, 'utf8');
    if (!systemPrompt || systemPrompt.length === 0) throw new Error('empty');
  } catch (e) {
    console.error('Generate: failed to read prompt', GENERATE_PROMPT_PATH, e?.message);
    return res.status(500).json({ error: 'System prompt not found' });
  }

  try {
    let accessToken = await getFigmaAccessToken(dbSql, userId);
    if (!accessToken) accessToken = await forceRefreshFigmaToken(userId);
    if (!accessToken) {
      return res.status(403).json({ error: 'Figma non connesso. Clicca "Riconnetti Figma" nel plugin.', code: 'FIGMA_RECONNECT' });
    }
    let fileJson;
    let fetchErr = null;
    try {
      fileJson = await fetchFigmaFileForAudit(accessToken, fileKey, 'all', null, null, null);
    } catch (err) {
      fetchErr = err;
    }
    if (fetchErr?.message?.includes('re-login')) {
      const newToken = await forceRefreshFigmaToken(userId);
      if (newToken) {
        try {
          fileJson = await fetchFigmaFileForAudit(newToken, fileKey, 'all', null, null, null);
          fetchErr = null;
        } catch (e) {
          fetchErr = e;
        }
      }
    }
    if (fetchErr || !fileJson) {
      const msg = fetchErr?.message || 'Figma API error';
      if (msg.includes('re-login')) return res.status(403).json({ error: 'Figma non connesso. Clicca "Riconnetti Figma" nel plugin.', code: 'FIGMA_RECONNECT' });
      if (msg.includes('not found')) return res.status(404).json({ error: msg });
      return res.status(400).json({ error: msg });
    }

    const pageCount = fileJson?.document?.children?.length ?? 0;
    const contextBlob = `Mode: ${mode}. DS: ${dsSource}. File has ${pageCount} page(s). Use only variable references (no raw hex/px).`;
    const userMessage = `User prompt:\n${prompt}\n\nContext: ${contextBlob}\n\nReturn only the action plan JSON object, no other text.`;

    const kimiRes = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KIMI_API_KEY}`,
      },
      body: JSON.stringify({
        model: KIMI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: 8192,
      }),
    });
    if (!kimiRes.ok) {
      const t = await kimiRes.text();
      console.error('Generate: Kimi API', kimiRes.status, t.slice(0, 300));
      return res.status(kimiRes.status >= 500 ? 502 : 400).json({ error: 'Kimi API error', details: t.slice(0, 200) });
    }
    const kimiData = await kimiRes.json();
    const content = kimiData?.choices?.[0]?.message?.content;
    const actionPlan = extractJsonFromContent(content);
    if (!actionPlan || typeof actionPlan !== 'object') {
      console.error('Generate: invalid or missing JSON from Kimi');
      return res.status(502).json({ error: 'Invalid response from AI' });
    }
    if (!actionPlan.version || !actionPlan.metadata || !actionPlan.frame || !Array.isArray(actionPlan.actions)) {
      return res.status(502).json({ error: 'Action plan missing required fields' });
    }

    if (dbSql) {
      const usage = kimiData?.usage;
      const inputTokens = Math.max(0, Number(usage?.input_tokens ?? usage?.prompt_tokens ?? 0));
      const outputTokens = Math.max(0, Number(usage?.output_tokens ?? usage?.completion_tokens ?? 0));
      if (inputTokens > 0 || outputTokens > 0) {
        dbSql`
          INSERT INTO kimi_usage_log (action_type, input_tokens, output_tokens, size_band, model)
          VALUES ('generate', ${inputTokens}, ${outputTokens}, null, ${KIMI_MODEL})
        `.catch((err) => console.error('Kimi usage log generate failed', err.message));
      }
    }

    res.json({ action_plan: actionPlan });
  } catch (err) {
    console.error('POST /api/agents/generate', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- A11Y Audit agent (v1.0: no Kimi — backend only: contrast, touch, focus, alt, semantics, color, OKLCH)
const { runA11yAudit } = await import('./a11y-audit-engine.mjs');

app.post('/api/agents/a11y-audit', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body || {};
  const fileKey = (body.file_key || body.fileKey || '').trim();
  const fileJsonFromBody = body.file_json || body.fileJson;

  if (!fileKey && !fileJsonFromBody) return res.status(400).json({ error: 'file_key or file_json required' });
  if (!POSTGRES_URL) return res.status(503).json({ error: 'A11Y Audit requires database' });

  try {
    let fileJson;
    if (fileJsonFromBody && typeof fileJsonFromBody === 'object' && fileJsonFromBody.document) {
      fileJson = fileJsonFromBody;
    } else if (fileKey) {
      let accessToken = await getFigmaAccessToken(dbSql, userId);
      if (!accessToken) accessToken = await forceRefreshFigmaToken(userId);
      if (!accessToken) {
        console.warn('POST /api/agents/a11y-audit: no token for user_id=', userId);
        return res.status(403).json({ error: 'Figma non connesso. Clicca "Riconnetti Figma" nel plugin.', code: 'FIGMA_RECONNECT' });
      }
      let fetchErr = null;
      try {
        fileJson = await fetchFigmaFileForAudit(accessToken, fileKey, body.scope, body.page_id || body.pageId, body.node_ids || body.nodeIds, body.page_ids || body.pageIds);
      } catch (err) {
        fetchErr = err;
      }
      if (fetchErr && fetchErr.message && fetchErr.message.includes('re-login')) {
        const newToken = await forceRefreshFigmaToken(userId);
        if (newToken) {
          try {
            fileJson = await fetchFigmaFileForAudit(newToken, fileKey, body.scope, body.page_id || body.pageId, body.node_ids || body.nodeIds, body.page_ids || body.pageIds);
            fetchErr = null;
          } catch (e) {
            fetchErr = e;
          }
        }
      }
      if (fetchErr) {
        const msg = fetchErr && fetchErr.message ? fetchErr.message : 'Figma API error';
        if (msg.includes('re-login')) return res.status(403).json({ error: 'Figma non connesso. Clicca "Riconnetti Figma" nel plugin.', code: 'FIGMA_RECONNECT' });
        if (msg.includes('not found')) return res.status(404).json({ error: msg });
        return res.status(400).json({ error: msg });
      }
    } else {
      return res.status(400).json({ error: 'file_key or file_json required' });
    }
    const { issues } = runA11yAudit(fileJson);
    res.json({ issues });
  } catch (err) {
    const msg = err?.message || '';
    if (msg.includes('File too large')) {
      return res.status(400).json({ error: msg });
    }
    console.error('POST /api/agents/a11y-audit', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Sync Scan (Figma vs Storybook drift detection)
const { runSyncScan } = await import('./sync-scan-engine.mjs');

app.post('/api/agents/sync-scan', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body || {};
  const fileKey = (body.file_key || body.fileKey || '').trim();
  const fileJsonFromBody = body.file_json || body.fileJson;
  const storybookUrl = (body.storybook_url || body.storybookUrl || '').trim();

  if (!storybookUrl) return res.status(400).json({ error: 'storybook_url required' });
  if (!fileKey && !fileJsonFromBody) return res.status(400).json({ error: 'file_key or file_json required' });
  if (!POSTGRES_URL) return res.status(503).json({ error: 'Sync Scan requires database' });

  try {
    let fileJson;
    if (fileJsonFromBody && typeof fileJsonFromBody === 'object' && fileJsonFromBody.document) {
      fileJson = fileJsonFromBody;
    } else if (fileKey) {
      let accessToken = await getFigmaAccessToken(dbSql, userId);
      if (!accessToken) accessToken = await forceRefreshFigmaToken(userId);
      if (!accessToken) {
        return res.status(403).json({ error: 'Figma non connesso. Clicca "Riconnetti Figma" nel plugin.', code: 'FIGMA_RECONNECT' });
      }
      let fetchErr = null;
      try {
        fileJson = await fetchFigmaFileForAudit(accessToken, fileKey, body.scope || 'all', body.page_id || body.pageId, body.node_ids || body.nodeIds, body.page_ids || body.pageIds);
      } catch (err) {
        fetchErr = err;
      }
      if (fetchErr && fetchErr.message && fetchErr.message.includes('re-login')) {
        const newToken = await forceRefreshFigmaToken(userId);
        if (newToken) {
          try {
            fileJson = await fetchFigmaFileForAudit(newToken, fileKey, body.scope || 'all', body.page_id || body.pageId, body.node_ids || body.nodeIds, body.page_ids || body.pageIds);
            fetchErr = null;
          } catch (e) {
            fetchErr = e;
          }
        }
      }
      if (fetchErr) {
        const msg = fetchErr && fetchErr.message ? fetchErr.message : 'Figma API error';
        if (msg.includes('re-login')) return res.status(403).json({ error: 'Figma non connesso. Clicca "Riconnetti Figma" nel plugin.', code: 'FIGMA_RECONNECT' });
        if (msg.includes('not found')) return res.status(404).json({ error: msg });
        return res.status(400).json({ error: msg });
      }
    } else {
      return res.status(400).json({ error: 'file_json must include document' });
    }

    const result = await runSyncScan(fileJson, storybookUrl);

    if (result.connectionStatus === 'unreachable' && result.error) {
      return res.status(400).json({ error: result.error, connectionStatus: 'unreachable' });
    }

    res.json({
      items: result.items || [],
      connectionStatus: result.connectionStatus || 'ok',
    });
  } catch (err) {
    console.error('POST /api/agents/sync-scan', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Trofei: contesto utente e check sblocco
async function getTrophyContext(sql, userId) {
  const u = await dbSql`SELECT total_xp, max_health_score, fixes_accepted_total, consecutive_fixes, token_fixes_total, bug_reports_total, linkedin_shared
    FROM users WHERE id = ${userId} LIMIT 1`;
  const userRow = u.rows[0] || {};
  const totalXp = Math.max(0, Number(userRow.total_xp) || 0);
  const maxHealth = Math.max(0, Number(userRow.max_health_score) || 0);
  const fixesAccepted = Math.max(0, Number(userRow.fixes_accepted_total) || 0);
  const consecutiveFixes = Math.max(0, Number(userRow.consecutive_fixes) || 0);
  const tokenFixes = Math.max(0, Number(userRow.token_fixes_total) || 0);
  const bugReports = Math.max(0, Number(userRow.bug_reports_total) || 0);
  const linkedinShared = !!userRow.linkedin_shared;

  const ct = await dbSql`SELECT action_type, COUNT(*) as c FROM credit_transactions WHERE user_id = ${userId} GROUP BY action_type`;
  const counts = {};
  for (const r of ct.rows) counts[r.action_type] = Number(r.c) || 0;
  const audits = (counts.audit || 0) + (counts.scan || 0);
  const wireframesGen = (counts.wireframe_gen || 0) + (counts.generate || 0);
  const protoScans = counts.proto_scan || 0;
  const a11y = counts.a11y_check || counts.a11y_audit || 0;
  const ux = counts.ux_audit || 0;
  const syncStorybook = counts.sync_storybook || 0;
  const syncGithub = counts.sync_github || 0;
  const syncBitbucket = counts.sync_bitbucket || 0;

  const today = await dbSql`SELECT COUNT(*) as c FROM credit_transactions WHERE user_id = ${userId} AND action_type IN ('audit','scan') AND created_at::date = CURRENT_DATE`;
  const auditsToday = Number(today.rows[0]?.c) || 0;

  let affiliateReferrals = 0;
  const aff = await dbSql`SELECT total_referrals FROM affiliates WHERE user_id = ${userId} LIMIT 1`;
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

async function checkTrophies(dbSql, userId) {
  const ctx = await getTrophyContext(dbSql, userId);
  const unlocked = await dbSql`SELECT trophy_id FROM user_trophies WHERE user_id = ${userId}`;
  const unlockedIds = (unlocked.rows || []).map(r => r.trophy_id);
  const all = await dbSql`SELECT id, name, unlock_condition FROM trophies ORDER BY sort_order`;
  const newlyUnlocked = [];
  for (const row of all.rows || []) {
    if (unlockedIds.includes(row.id)) continue;
    const cond = row.unlock_condition && (typeof row.unlock_condition === 'object' ? row.unlock_condition : JSON.parse(row.unlock_condition || '{}'));
    if (evaluateTrophyCondition(cond, ctx, unlockedIds)) {
      await dbSql`INSERT INTO user_trophies (user_id, trophy_id) VALUES (${userId}, ${row.id}) ON CONFLICT (user_id, trophy_id) DO NOTHING`;
      newlyUnlocked.push({ id: row.id, name: row.name });
      unlockedIds.push(row.id);
    }
  }
  return newlyUnlocked;
}

app.get('/api/trophies', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!POSTGRES_URL) return res.json({ trophies: [], unlocked_ids: [] });
  try {
    const all = await dbSql`SELECT id, name, description, icon_id, sort_order FROM trophies ORDER BY sort_order`;
    const ut = await dbSql`SELECT trophy_id, unlocked_at FROM user_trophies WHERE user_id = ${userId}`;
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
  if (!POSTGRES_URL) return res.json({ linkedin_shared: true, new_trophies: [] });
  try {
    await dbSql`UPDATE users SET linkedin_shared = true, updated_at = NOW() WHERE id = ${userId}`;
    const newTrophies = await checkTrophies(dbSql, userId);
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
  if (!POSTGRES_URL) return res.status(503).json({ error: 'Affiliates not configured' });
  try {
    const r = await dbSql`SELECT affiliate_code, total_referrals FROM affiliates WHERE user_id = ${userId} LIMIT 1`;
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
  if (!POSTGRES_URL) return res.status(503).json({ error: 'Affiliates not configured' });
  try {
    let r = await dbSql`SELECT affiliate_code FROM affiliates WHERE user_id = ${userId} LIMIT 1`;
    if (r.rows.length > 0) {
      return res.json({ affiliate_code: r.rows[0].affiliate_code, already_registered: true });
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomAffiliateCode();
      try {
        await dbSql`INSERT INTO affiliates (user_id, affiliate_code) VALUES (${userId}, ${code})`;
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

// --- Checkout redirect: reindirizza al checkout Lemon Squeezy (evita 404 se il plugin apre auth.comtra.dev per sbaglio).
const LEMON_CHECKOUT_BASE = process.env.LEMON_SQUEEZY_CHECKOUT_BASE || 'https://comtra.lemonsqueezy.com/checkout/buy';
const LEMON_VARIANT_IDS = {
  '1w': process.env.LEMON_VARIANT_1W || '1345293',
  '1m': process.env.LEMON_VARIANT_1M || '1345303',
  '6m': process.env.LEMON_VARIANT_6M || '1345310',
  '1y': process.env.LEMON_VARIANT_1Y || '1345319',
};
app.get('/api/checkout/redirect', (req, res) => {
  const tier = (req.query.tier || '6m').toLowerCase();
  const variantId = LEMON_VARIANT_IDS[tier] || LEMON_VARIANT_IDS['6m'];
  const base = `${LEMON_CHECKOUT_BASE}/${variantId}`;
  const params = new URLSearchParams();
  const aff = (req.query.aff || '').trim();
  const email = (req.query.email || '').trim();
  if (aff) {
    params.set('aff', aff);
    params.set('checkout[custom][aff]', aff);
  }
  if (email) params.set('checkout[custom][email]', email);
  const url = params.toString() ? `${base}?${params.toString()}` : base;
  res.redirect(302, url);
});

// --- Test: simula un referral affiliato (senza webhook Lemon). Solo se TEST_AFFILIATE_SECRET è impostato.
app.post('/api/test/simulate-referral', async (req, res) => {
  const secret = req.headers['x-test-secret'];
  if (!process.env.TEST_AFFILIATE_SECRET || secret !== process.env.TEST_AFFILIATE_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!POSTGRES_URL) return res.status(503).json({ error: 'Not configured' });
  const body = req.body || {};
  const code = (body.affiliate_code || '').trim();
  if (!code) return res.status(400).json({ error: 'affiliate_code required' });
  try {
    const r = await dbSql`UPDATE affiliates SET total_referrals = total_referrals + 1, updated_at = NOW() WHERE affiliate_code = ${code} RETURNING user_id, total_referrals`;
    if (r.rowCount === 0) return res.status(404).json({ error: 'Affiliate code not found' });
    res.json({ ok: true, user_id: r.rows[0].user_id, total_referrals: Number(r.rows[0].total_referrals) });
  } catch (err) {
    console.error('simulate-referral', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default app;
