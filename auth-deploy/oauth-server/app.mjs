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
  createThrottleDiscount,
  deleteLevelDiscount,
  isLevelWithDiscount,
  discountPercentForLevel,
  resolveLemonStoreId,
  resolveLemonVariant1y,
} from './lemon-discounts.mjs';
import {
  buildDsContextForPrompt,
  loadDsPackage,
  mapDsSourceToId,
  resolveContextProfile,
  resolveDsPackageForContext,
  validateActionPlanAgainstDs,
  validateActionPlanAgainstFileDsIndex,
  validateActionPlanSchema,
  validateActionPlanVisiblePrimitives,
  validateActionPlanNoInstanceForPublicDs,
} from './ds-loader.mjs';
import { runGenerateDualCallPipeline } from './generation-swarm.mjs';
import { formatDesignIntelligenceForPrompt, inferFocusedScreenType } from './design-intelligence.mjs';
import { buildDsSlimIndex, buildPromptScopedDsIndex } from './ds-context-retrieval.mjs';

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
    // Figma plugin UI runs in `data:` / opaque origin -> browser reports `origin = null`.
    // Accept all origins here (auth is JWT-based), including null-origin preflights.
    if (origin == null || origin === '' || origin === 'null') return cb(null, true);
    return cb(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
}));
app.options('*', cors());
// Code-gen / audit / DS context index: corpi grandi; default 5mb (override con JSON_BODY_LIMIT).
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '5mb' }));

// DS import/catalog endpoints are user-specific and must never be served as stale 304.
app.use(['/api/user/ds-imports', '/api/user/ds-imports/context', '/api/design-systems'], (_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Vary', 'Authorization');
  next();
});

app.get('/auth/figma/init', async (req, res) => {
  const store = await getFlowStore();
  const flowId = randomBytes(16).toString('hex');
  await store.set(flowId, null);
  let startUrl = `${BASE_URL}/auth/figma/start?flow_id=${flowId}`;
  const utmSource = (req.query.utm_source || '').toString().trim();
  const utmMedium = (req.query.utm_medium || '').toString().trim();
  const utmCampaign = (req.query.utm_campaign || '').toString().trim();
  if (utmSource || utmMedium || utmCampaign) {
    const q = new URLSearchParams();
    if (utmSource) q.set('utm_source', utmSource);
    if (utmMedium) q.set('utm_medium', utmMedium);
    if (utmCampaign) q.set('utm_campaign', utmCampaign);
    startUrl += '&' + q.toString();
  }
  if (req.query.redirect === '1' || req.query.redirect === 'true') {
    return res.redirect(302, startUrl);
  }
  res.json({ authUrl: startUrl, readKey: flowId });
});

app.get('/auth/figma/start', async (req, res) => {
  const flowId = req.query.flow_id;
  if (!flowId) return res.status(400).send('Invalid flow');
  const utmSource = (req.query.utm_source || '').toString().trim();
  const utmMedium = (req.query.utm_medium || '').toString().trim();
  const utmCampaign = (req.query.utm_campaign || '').toString().trim();
  if (utmSource || utmMedium || utmCampaign) {
    const store = await getFlowStore();
    await store.set(flowId, { utm: { utm_source: utmSource || null, utm_medium: utmMedium || null, utm_campaign: utmCampaign || null } });
  }
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
  let existing = await store.get(flowId);
  if (existing === undefined) return res.status(400).send('Expired flow');
  if (cookieFlow !== undefined && cookieFlow !== flowId) return res.status(400).send('Invalid state');
  const utmFromStart = existing && typeof existing === 'object' && existing.utm ? existing.utm : null;
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
  console.log('[OAuth] Callback: Figma user arrived', { figma_user_id: figmaUser.id, email: figmaUser.email || '(no email)', handle: figmaUser.handle });

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

  if (POSTGRES_URL && tokenSaved && utmFromStart && utmFromStart.utm_source) {
    const sourceMap = { landing: 'landing', linkedin: 'linkedin', instagram: 'instagram', tiktok: 'tiktok' };
    const touchpointSource = sourceMap[(utmFromStart.utm_source || '').toLowerCase()];
    if (touchpointSource) {
      try {
        await dbSql`
          INSERT INTO user_attribution (user_id, source, utm_source, utm_medium, utm_campaign)
          VALUES (${user.id}, ${touchpointSource}, ${utmFromStart.utm_source || null}, ${utmFromStart.utm_medium || null}, ${utmFromStart.utm_campaign || null})
          ON CONFLICT (user_id) DO NOTHING
        `;
      } catch (err) {
        if (!/relation "user_attribution" does not exist/i.test(String(err))) console.error('user_attribution insert', err);
      }
    }
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
      try {
        const tagRow = await dbSql`SELECT COALESCE(tags, '[]'::jsonb) AS tags FROM users WHERE id = ${user.id} LIMIT 1`;
        if (tagRow.rows.length > 0) {
          const rawTags = tagRow.rows[0].tags;
          user.tags = Array.isArray(rawTags) ? rawTags : (rawTags && typeof rawTags === 'object' && !Array.isArray(rawTags) ? [] : []);
        }
      } catch (_) { /* tags column may not exist before migration 006 */ }
      const productionStats = await getProductionStats(dbSql, user.id);
      if (productionStats) user.stats = productionStats;
    } catch (err) {
      console.error('OAuth callback: post-save SELECT failed (non-fatal)', err);
    }
  }

  const authToken = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '365d' });
  user.authToken = authToken;

  if (tokenSaved) console.log('[OAuth] Login completato — questo log appare solo se la richiesta arriva al nostro callback', { user_id: user.id, email: user.email });
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
  return getUserAuthContext(req).userId;
}

function getUserAuthContext(req) {
  const authRaw = String(req.headers.authorization || '').trim();
  if (!authRaw) return { userId: null, reason: 'missing_authorization' };
  const m = authRaw.match(/^Bearer\s+(.+)$/i);
  if (!m || !m[1]) return { userId: null, reason: 'invalid_authorization_format' };
  const token = String(m[1]).trim();
  if (!token) return { userId: null, reason: 'empty_bearer_token' };

  // Allow one previous secret for seamless rotations between deploys.
  const verifySecrets = [
    String(JWT_SECRET || '').trim(),
    String(process.env.JWT_SECRET_PREVIOUS || '').trim(),
  ].filter(Boolean);

  for (const secret of verifySecrets) {
    try {
      const decoded = jwt.verify(token, secret);
      const userId = decoded?.sub ? String(decoded.sub) : '';
      if (userId) return { userId, reason: null };
    } catch {
      // keep trying next secret
    }
  }
  return { userId: null, reason: 'jwt_verify_failed' };
}

const ADMIN_API_KEY = String(process.env.ADMIN_API_KEY || '').trim();
const EXTERNAL_DS_STATUSES = new Set(['draft', 'published', 'archived']);
const BUILTIN_DESIGN_SYSTEMS = [
  'Custom (Current)',
  'Material Design 3',
  'iOS Human Interface',
  'Ant Design',
  'Carbon Design',
  'Bootstrap 5',
  'Salesforce Lightning',
  'Uber Base Web',
];

function isAdminApiRequest(req) {
  if (!ADMIN_API_KEY) return false;
  const k = String(req.headers['x-admin-key'] || '').trim();
  if (k && k === ADMIN_API_KEY) return true;
  const auth = String(req.headers.authorization || '');
  if (auth.startsWith('Bearer ')) {
    const t = auth.slice(7).trim();
    if (t && t === ADMIN_API_KEY) return true;
  }
  return false;
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

function estimateCreditsByAction(actionType, nodeCount, options = {}) {
  const hasScreenshot = Boolean(options?.has_screenshot);
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
  if (actionType === 'wireframe_gen' || actionType === 'generate') {
    return 3 + (hasScreenshot ? 2 : 0);
  }
  if (actionType === 'wireframe_modified') return 3 + (hasScreenshot ? 2 : 0);
  if (actionType === 'proto_scan') return 2;
  // Prototype Audit: node_count = number of selected flows; low credits (1–4). See audit-specs/prototype-audit/COST-PROSPECT.md
  if (actionType === 'proto_audit') {
    const flows = Math.max(0, Math.floor(n));
    if (flows <= 1) return 1;
    if (flows <= 3) return 2;
    if (flows <= 6) return 3;
    return 4;
  }
  if (actionType === 'ux_audit') return 4;
  if (actionType === 'sync') return 1;
  if (actionType === 'scan_sync') return 15;
  if (actionType === 'sync_fix' || actionType === 'sync_storybook' || actionType === 'comp_sync') return 5;
  if (actionType === 'code_gen') return 0;
  if (actionType === 'code_gen_ai') return 40;
  return 5;
}

app.get('/api/credits', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const q = req.query || {};
  const lite =
    q.lite === '1' ||
    q.lite === 'true' ||
    String(q.lite || '').toLowerCase() === 'yes';
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
    const [r, tr, giftRows] = await Promise.all([
      dbSql`SELECT credits_total, credits_used, plan, plan_expires_at, total_xp, current_level FROM users WHERE id = ${userId}`,
      (async () => {
        try {
          return await dbSql`SELECT COALESCE(tags, '[]'::jsonb) AS tags FROM users WHERE id = ${userId} LIMIT 1`;
        } catch {
          return { rows: [] };
        }
      })(),
      (async () => {
        try {
          return await dbSql`
            SELECT credits_added, created_at FROM user_credit_gifts
            WHERE user_id = ${userId} AND shown_at IS NULL ORDER BY created_at DESC
          `;
        } catch {
          return { rows: [] };
        }
      })(),
    ]);
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
    /** lite=1: solo saldo/plan/XP/regalo/tags — niente aggregazioni su credit_transactions (costose; evita timeout con più tab plugin). */
    let stats = null;
    let recent_transactions = [];
    if (!lite) {
      const [statsResult, txResult] = await Promise.all([
        getProductionStats(dbSql, userId).catch((statsErr) => {
          console.error('GET /api/credits: getProductionStats failed (non-fatal)', statsErr);
          return null;
        }),
        dbSql`
          SELECT action_type, credits_consumed, created_at
          FROM credit_transactions
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT 30
        `.catch((txErr) => {
          console.error('GET /api/credits: recent_transactions failed (non-fatal)', txErr);
          return { rows: [] };
        }),
      ]);
      stats = statsResult;
      recent_transactions = (txResult.rows || []).map((txRow) => ({
        action_type: txRow.action_type,
        credits_consumed: Number(txRow.credits_consumed) || 0,
        created_at: txRow.created_at,
      }));
    }
    const out = {
      credits_remaining: remaining,
      credits_total: total,
      credits_used: used,
      plan: row.plan || 'FREE',
      plan_expires_at: row.plan_expires_at ?? null,
      current_level: info.level,
      total_xp: totalXp,
      xp_for_next_level: info.xpForNextLevel,
      xp_for_current_level_start: info.xpForCurrentLevelStart ?? 0,
      ...(stats && { stats }),
      recent_transactions,
    };
    if (tr.rows.length > 0) {
      const raw = tr.rows[0].tags;
      out.tags = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' && !Array.isArray(raw) ? [] : []);
    }
    if (giftRows.rows && giftRows.rows.length > 0) {
      const totalAdded = giftRows.rows.reduce((s, gr) => s + (Number(gr.credits_added) || 0), 0);
      const latest = giftRows.rows[0];
      out.gift = { credits_added: totalAdded, created_at: latest.created_at };
    }
    res.json(out);
  } catch (err) {
    console.error('GET /api/credits', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/credits/estimate', async (req, res) => {
  const body = req.body || {};
  const actionType = body.action_type || 'audit';
  const nodeCount = body.node_count != null ? Number(body.node_count) : undefined;
  const hasScreenshot =
    body.has_screenshot === true ||
    body.has_screenshot === 'true' ||
    body.has_screenshot === 1 ||
    body.has_screenshot === '1';
  const estimated = estimateCreditsByAction(actionType, nodeCount, { has_screenshot: hasScreenshot });
  res.json({ estimated_credits: estimated });
});

// --- Credit gift (admin recharge): mark as shown so plugin shows modal once
app.post('/api/credit-gift-seen', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!POSTGRES_URL) return res.json({ ok: true });
  try {
    await dbSql`
      UPDATE user_credit_gifts SET shown_at = NOW() WHERE user_id = ${userId} AND shown_at IS NULL
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/credit-gift-seen', err);
    res.status(500).json({ error: 'Server error' });
  }
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
    /** Livello persistito prima di questo consume (per modal client quando lo stato React era già allineato a GET). */
    let levelUpPreviousLevel = null;
    let currentLevel = 1;
    let totalXp = 0;
    let xpForNextLevel = 100;
    const xpEarned = XP_BY_ACTION[actionType] ?? 0;
    const u = await dbSql`SELECT total_xp, current_level FROM users WHERE id = ${userId} LIMIT 1`;
    if (u.rows.length > 0) {
      totalXp = Math.max(0, Number(u.rows[0].total_xp) || 0);
      const oldLevelDb = Math.max(1, Number(u.rows[0].current_level) || 1);
      if (xpEarned > 0) {
        totalXp += xpEarned;
        const info = getLevelInfo(totalXp);
        currentLevel = info.level;
        xpForNextLevel = info.xpForNextLevel;
        levelUp = currentLevel > oldLevelDb;
        if (levelUp) levelUpPreviousLevel = oldLevelDb;
        await dbSql`UPDATE users SET total_xp = ${totalXp}, current_level = ${currentLevel}, updated_at = NOW() WHERE id = ${userId}`;
        await dbSql`INSERT INTO xp_transactions (user_id, action_type, xp_earned) VALUES (${userId}, ${actionType}, ${xpEarned})`;
      } else {
        const info = getLevelInfo(totalXp);
        currentLevel = info.level;
        xpForNextLevel = info.xpForNextLevel;
        // XP già sufficiente per un livello più alto ma DB non allineato (es. azione senza voce in XP_BY_ACTION):
        // al prossimo consume mostriamo comunque level_up e sincronizziamo current_level.
        if (currentLevel > oldLevelDb) {
          levelUp = true;
          levelUpPreviousLevel = oldLevelDb;
          await dbSql`UPDATE users SET current_level = ${currentLevel}, updated_at = NOW() WHERE id = ${userId}`;
        }
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
            storeId: resolveLemonStoreId(),
            variantId1y: resolveLemonVariant1y(),
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
      ...(levelUp && levelUpPreviousLevel != null ? { level_up_previous_level: levelUpPreviousLevel } : {}),
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

// Log free actions (0-credit) in credit_transactions for activity tracking (Stats + dashboard) without touching balance
app.post('/api/credits/log-free', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!POSTGRES_URL) return res.status(204).end();
  const body = req.body || {};
  const rawType = body.action_type;
  const actionType = typeof rawType === 'string' ? rawType.trim() : '';
  if (!actionType) return res.status(400).json({ error: 'action_type required' });
  if (actionType.length > 64) return res.status(400).json({ error: 'action_type too long' });
  try {
    await dbSql`
      INSERT INTO credit_transactions (user_id, action_type, credits_consumed, file_id)
      VALUES (${userId}, ${actionType}, 0, null)
    `;
    res.status(204).end();
  } catch (err) {
    console.error('POST /api/credits/log-free', err);
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
/**
 * Modello per messaggi multimodali (image_url in content).
 * Moonshot elenca esplicitamente modelli vision: moonshot-v1-*-vision-preview, kimi-k2.5, ecc.
 * Il default testuale (es. kimi-k2-0905-preview) non è nella lista ufficiale “vision”.
 * @see https://platform.moonshot.ai/docs/guide/use-kimi-vision-model
 */
const KIMI_VISION_MODEL = process.env.KIMI_VISION_MODEL || 'kimi-k2.5';
const DS_AUDIT_PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'ds-audit-system.md');

/** Risposta Moonshot/OpenAI: campi usage variabili; a volte solo total_tokens (dashboard costi). */
function normalizeMoonshotUsage(usage) {
  if (!usage || typeof usage !== 'object') return { inputTokens: 0, outputTokens: 0 };
  let inputTokens = Math.max(
    0,
    Number(usage.input_tokens ?? usage.prompt_tokens ?? usage.promptTokens ?? 0),
  );
  let outputTokens = Math.max(
    0,
    Number(usage.output_tokens ?? usage.completion_tokens ?? usage.completionTokens ?? 0),
  );
  const total = Math.max(0, Number(usage.total_tokens ?? usage.totalTokens ?? 0));
  if (total > 0 && inputTokens === 0 && outputTokens === 0) {
    inputTokens = Math.floor(total * 0.45);
    outputTokens = total - inputTokens;
  }
  return { inputTokens, outputTokens };
}

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
  const out = {
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
  if (raw.rule_id != null) out.rule_id = String(raw.rule_id);
  if (raw.recommendation === true) out.recommendation = true;
  if (raw.autoFixAvailable === true) out.autoFixAvailable = true;
  if (raw.optimizationPayload && typeof raw.optimizationPayload === 'object') {
    out.optimizationPayload = raw.optimizationPayload;
  }
  if (raw.nodeName != null && String(raw.nodeName).trim()) {
    out.nodeName = String(raw.nodeName).trim();
  }
  if (raw.hideLayerActions === true) out.hideLayerActions = true;
  return out;
}

/** Extract quoted name from DS issue msg (same heuristics as plugin IssueList). */
function extractNameFromMsgDs(msg) {
  if (typeof msg !== 'string' || !msg) return '';
  const curly = msg.match(/[\u201c\u201d]([^\u201c\u201d]+)[\u201c\u201d]/);
  if (curly && curly[1] && String(curly[1]).trim()) return String(curly[1]).trim();
  const straight = msg.match(/["']([^"']+)["']/);
  if (straight && straight[1] && String(straight[1]).trim()) return String(straight[1]).trim();
  const emptyFrame = msg.match(/empty\s+([^\s.]+)\s+frame/i);
  if (emptyFrame && emptyFrame[1] && String(emptyFrame[1]).trim()) return String(emptyFrame[1]).trim();
  return '';
}

function walkFigmaDocForIds(node, pageName, validIds, nameToCandidates) {
  if (!node || typeof node !== 'object') return;
  let nextPage = pageName;
  if (node.type === 'CANVAS' || node.type === 'PAGE') {
    nextPage = node.name != null ? String(node.name) : pageName;
  }
  if (node.id != null) {
    const id = String(node.id);
    validIds.add(id);
    if (node.name != null) {
      const nm = String(node.name);
      if (!nameToCandidates.has(nm)) nameToCandidates.set(nm, []);
      nameToCandidates.get(nm).push({ id, page: nextPage || '' });
    }
  }
  if (Array.isArray(node.children)) {
    for (const c of node.children) walkFigmaDocForIds(c, nextPage, validIds, nameToCandidates);
  }
}

/** Real Figma page/canvas name for each node id (fixes LLM putting frame names like "Footer" in pageName). */
function walkFigmaDocIdToPageName(node, pageName, idToPageName) {
  if (!node || typeof node !== 'object') return;
  let nextPage = pageName;
  if (node.type === 'CANVAS' || node.type === 'PAGE') {
    nextPage = node.name != null ? String(node.name) : pageName;
  }
  if (node.id != null) {
    idToPageName.set(String(node.id), nextPage != null && nextPage !== '' ? String(nextPage) : '');
  }
  if (Array.isArray(node.children)) {
    for (const c of node.children) walkFigmaDocIdToPageName(c, nextPage, idToPageName);
  }
}

/**
 * Ogni issue deve avere un layerId presente nello snapshot JSON usato per l'audit.
 * Se l'LLM sbaglia l'id: prova layerIds, poi nodeName/msg + nome nel documento (match univoco o pageName).
 * Altrimenti hideLayerActions — niente Select Layer ambiguo o che fallisce.
 */
function resolveDsAuditIssuesFromSnapshot(issues, fileJson) {
  const doc = fileJson && fileJson.document;
  if (!doc || !Array.isArray(issues)) return issues;
  const validIds = new Set();
  const nameToCandidates = new Map();
  const idToPageName = new Map();
  walkFigmaDocForIds(doc, null, validIds, nameToCandidates);
  walkFigmaDocIdToPageName(doc, null, idToPageName);

  const tryId = (id) => {
    const s = id != null ? String(id).trim() : '';
    return s && validIds.has(s) ? s : null;
  };

  return issues.map((issue) => {
    if (!issue || issue.hideLayerActions === true) return issue;

    let layerId = tryId(issue.layerId);
    if (!layerId && Array.isArray(issue.layerIds)) {
      for (const id of issue.layerIds) {
        layerId = tryId(id);
        if (layerId) break;
      }
    }

    if (!layerId) {
      const name =
        (issue.nodeName && String(issue.nodeName).trim()) || extractNameFromMsgDs(issue.msg || '');
      if (name) {
        const cands = nameToCandidates.get(name) || [];
        if (cands.length === 1) layerId = cands[0].id;
        else if (cands.length > 1 && issue.pageName) {
          const pn = String(issue.pageName).trim();
          const onPage = cands.filter((c) => c.page === pn);
          if (onPage.length === 1) layerId = onPage[0].id;
        }
      }
    }

    const hideLayerActions = !layerId;
    const out = { ...issue, layerId: layerId || '', hideLayerActions };
    if (Array.isArray(issue.layerIds)) {
      const filtered = issue.layerIds.map(String).filter((id) => validIds.has(id));
      if (filtered.length > 0) out.layerIds = filtered;
      else delete out.layerIds;
    }
    if (layerId) {
      const canon = idToPageName.get(layerId);
      if (canon != null && String(canon).trim() !== '') {
        out.pageName = String(canon);
      }
    }
    return out;
  });
}

function documentTreeHasInstance(node) {
  if (!node || typeof node !== 'object') return false;
  if (node.type === 'INSTANCE') return true;
  if (Array.isArray(node.children)) {
    for (const c of node.children) {
      if (documentTreeHasInstance(c)) return true;
    }
  }
  return false;
}

/**
 * Hint when the REST export has INSTANCE nodes but zero components with remote:true.
 * Audit then uses only in-file definitions — not live team-library payloads in this JSON.
 * Copy stays soft: the file might be an intentional local DS, not a “broken” link.
 */
function getLibraryContextHint(fileJson) {
  const doc = fileJson?.document;
  const comps = fileJson?.components;
  if (!doc || !comps || typeof comps !== 'object') return null;
  if (!documentTreeHasInstance(doc)) return null;
  const keys = Object.keys(comps);
  if (keys.length === 0) return null;
  let remoteCount = 0;
  for (const k of keys) {
    const c = comps[k];
    if (c && c.remote === true) remoteCount++;
  }
  if (remoteCount > 0) return null;
  return {
    type: 'local_definitions_only',
    message:
      "In questo export non risulta nessun componente da team library (remoto). L'audit confronta istanze e master presenti in questo file. Se ti aspettavi la library esterna, verifica in Figma: Assets → librerie, e che il collegamento non sia saltato.",
  };
}

/** Layout vocabulary (HTML/code); do not report as generic naming (3.1). */
const NAMING_STRUCTURAL_ALLOWLIST = new Set(['section', 'wrapper', 'container']);

function filterAllowedStructuralLayerNames(issues) {
  if (!Array.isArray(issues)) return issues;
  return issues.filter((issue) => {
    if (!issue || issue.categoryId !== 'naming') return true;
    const raw =
      (issue.nodeName && String(issue.nodeName).trim()) || extractNameFromMsgDs(issue.msg || '') || '';
    const key = raw.trim().toLowerCase();
    if (key && NAMING_STRUCTURAL_ALLOWLIST.has(key)) return false;
    return true;
  });
}

function findNodeWithParent(node, targetId, parent = null) {
  if (!node || typeof node !== 'object') return null;
  if (node.id != null && String(node.id) === String(targetId)) return { node, parent };
  if (Array.isArray(node.children)) {
    for (const c of node.children) {
      const r = findNodeWithParent(c, targetId, node);
      if (r) return r;
    }
  }
  return null;
}

/** absoluteBoundingBox off-grid is misleading for auto-layout flow children (inspector shows relative X/Y). */
function filterOffGridAutoLayoutFalsePositives(issues, fileJson) {
  if (!Array.isArray(issues) || !fileJson?.document) return issues;
  const doc = fileJson.document;
  const gridMsg =
    /off[-\s]?grid|fuori griglia|allineamento.{0,12}griglia|not aligned to.{0,32}grid|aligned to.{0,16}\d+px/i;
  return issues.filter((issue) => {
    if (!issue || issue.categoryId !== 'consistency') return true;
    const msg = String(issue.msg || '');
    if (!gridMsg.test(msg)) return true;
    const lid = issue.layerId && String(issue.layerId).trim();
    if (!lid) return true;
    const hit = findNodeWithParent(doc, lid);
    if (!hit || !hit.parent) return true;
    const lm = hit.parent.layoutMode;
    if (lm == null || lm === 'NONE') return true;
    const lp = hit.node.layoutPositioning;
    if (lp === 'ABSOLUTE') return true;
    return false;
  });
}

/** Multi-layer “merge redundant components” tips: separate definitions → severity LOW (advisory). */
function downgradeRedundantComponentMergeSeverity(issues) {
  if (!Array.isArray(issues)) return issues;
  const mergeHint = (t) =>
    /redundant|merge into (a |one |single )?component|single component with variant|consolidat(e|ing)|ds-opt-1\b|ds-opt-4\b|equivalent structure|duplicate famil/i.test(
      t,
    );
  return issues.map((issue) => {
    if (!issue || !Array.isArray(issue.layerIds) || issue.layerIds.length < 2) return issue;
    const blob = `${issue.msg || ''} ${issue.fix || ''}`;
    const rule = String(issue.rule_id || '');
    const isMergeFamily =
      mergeHint(blob) ||
      /^DS-OPT-[14]\b/i.test(rule) ||
      (issue.categoryId === 'optimization' && /redundant|merge into|consolidat/i.test(blob));
    if (!isMergeFamily) return issue;
    if (issue.severity === 'HIGH' || issue.severity === 'MED') {
      return { ...issue, severity: 'LOW' };
    }
    return issue;
  });
}

function findNodeByIdInDocument(node, targetId) {
  if (!node || typeof node !== 'object') return null;
  if (node.id != null && String(node.id) === String(targetId)) return node;
  if (Array.isArray(node.children)) {
    for (const c of node.children) {
      const r = findNodeByIdInDocument(c, targetId);
      if (r) return r;
    }
  }
  return null;
}

const INSTANCE_MAIN_COMPARE_KEYS = [
  'layoutMode',
  'primaryAxisSizingMode',
  'counterAxisSizingMode',
  'primaryAxisAlignItems',
  'counterAxisAlignItems',
  'layoutWrap',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
  'itemSpacing',
  'counterAxisSpacing',
  'strokeWeight',
];

function looseEqualJson(a, b) {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.001;
  if (a === undefined || a === null) return b === undefined || b === null;
  if (b === undefined || b === null) return a === undefined || a === null;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function inheritVal(inst, main, key) {
  if (inst[key] !== undefined && inst[key] !== null) return inst[key];
  return main[key];
}

function normalizeFillsForCompare(fills) {
  if (!Array.isArray(fills)) return [];
  return fills.map((f) => {
    if (!f || typeof f !== 'object') return f;
    const o = { type: f.type, visible: f.visible !== false };
    if (f.type === 'SOLID' && f.color && typeof f.color === 'object') {
      const c = f.color;
      o.color = {
        r: typeof c.r === 'number' ? Math.round(c.r * 10000) / 10000 : c.r,
        g: typeof c.g === 'number' ? Math.round(c.g * 10000) / 10000 : c.g,
        b: typeof c.b === 'number' ? Math.round(c.b * 10000) / 10000 : c.b,
        a: typeof c.a === 'number' ? Math.round(c.a * 10000) / 10000 : 1,
      };
    }
    return o;
  });
}

/**
 * True when INSTANCE root matches local COMPONENT (or FRAME) master in same file JSON for layout / paint.
 * Does not deep-walk children (TEXT overrides etc.) — targets false positives on “overrides vs main” for root.
 */
function instanceRootMatchesMainInFileJson(inst, main) {
  if (!inst || !main || inst.type !== 'INSTANCE') return false;
  if (main.type !== 'COMPONENT' && main.type !== 'FRAME') return false;

  for (const k of INSTANCE_MAIN_COMPARE_KEYS) {
    const iv = inheritVal(inst, main, k);
    const mv = main[k];
    if (iv === undefined && mv === undefined) continue;
    if (!looseEqualJson(iv, mv)) return false;
  }

  const instEffFs =
    inst.fillStyleId != null && String(inst.fillStyleId).trim() !== ''
      ? String(inst.fillStyleId)
      : main.fillStyleId != null && String(main.fillStyleId).trim() !== ''
        ? String(main.fillStyleId)
        : '';
  const mainEffFs =
    main.fillStyleId != null && String(main.fillStyleId).trim() !== '' ? String(main.fillStyleId) : '';
  if (instEffFs !== mainEffFs) return false;

  const instEffSs =
    inst.strokeStyleId != null && String(inst.strokeStyleId).trim() !== ''
      ? String(inst.strokeStyleId)
      : main.strokeStyleId != null && String(main.strokeStyleId).trim() !== ''
        ? String(main.strokeStyleId)
        : '';
  const mainEffSs =
    main.strokeStyleId != null && String(main.strokeStyleId).trim() !== '' ? String(main.strokeStyleId) : '';
  if (instEffSs !== mainEffSs) return false;

  const instFillsSrc = Array.isArray(inst.fills) && inst.fills.length > 0 ? inst.fills : main.fills;
  const mainFillsSrc = main.fills;
  if (
    JSON.stringify(normalizeFillsForCompare(instFillsSrc || [])) !==
    JSON.stringify(normalizeFillsForCompare(mainFillsSrc || []))
  )
    return false;

  const instStrSrc = Array.isArray(inst.strokes) && inst.strokes.length > 0 ? inst.strokes : main.strokes;
  const mainStrSrc = main.strokes;
  if (
    JSON.stringify(normalizeFillsForCompare(instStrSrc || [])) !==
    JSON.stringify(normalizeFillsForCompare(mainStrSrc || []))
  )
    return false;

  const iCr = inheritVal(inst, main, 'cornerRadius');
  const mCr = main.cornerRadius;
  if (!looseEqualJson(iCr, mCr)) return false;

  const instRcEff =
    Array.isArray(inst.rectangleCornerRadii) && inst.rectangleCornerRadii.length > 0
      ? inst.rectangleCornerRadii
      : main.rectangleCornerRadii;
  const mainRc = main.rectangleCornerRadii;
  if (!looseEqualJson(instRcEff || [], mainRc || [])) return false;

  return true;
}

const ADOPTION_FALSE_OVERRIDE_MSG =
  /override|differ( from| with)? (the )?main|vs\.?\s*main|deviation.*main|fields changed|changed \(/i;

function filterFalsePositiveInstanceVsMainAdoption(issues, fileJson) {
  const doc = fileJson?.document;
  if (!doc || !Array.isArray(issues)) return issues;
  return issues.filter((issue) => {
    if (!issue || issue.categoryId !== 'adoption') return true;
    const blob = `${issue.msg || ''} ${issue.fix || ''}`;
    if (!ADOPTION_FALSE_OVERRIDE_MSG.test(blob)) return true;
    const lid = issue.layerId && String(issue.layerId).trim();
    if (!lid) return true;
    const inst = findNodeByIdInDocument(doc, lid);
    if (!inst || inst.type !== 'INSTANCE' || !inst.componentId) return true;
    const main = findNodeByIdInDocument(doc, String(inst.componentId));
    if (!main) return true;
    if (instanceRootMatchesMainInFileJson(inst, main)) return false;
    return true;
  });
}

function nodeHasFillStyleOrVariableBinding(n) {
  if (!n || typeof n !== 'object') return false;
  if (n.fillStyleId != null && String(n.fillStyleId).trim() !== '') return true;
  const bv = n.boundVariables;
  if (bv && typeof bv === 'object' && bv.fills != null) return true;
  return false;
}

function nodeHasStrokeStyleOrVariableBinding(n) {
  if (!n || typeof n !== 'object') return false;
  if (n.strokeStyleId != null && String(n.strokeStyleId).trim() !== '') return true;
  const bv = n.boundVariables;
  if (bv && typeof bv === 'object' && bv.strokes != null) return true;
  return false;
}

/**
 * Coverage 2.1/2.2: LLM or stale plugin JSON may claim hardcoded paint while snapshot has style/variable IDs.
 */
function filterFalsePositiveHardcodedPaintCoverage(issues, fileJson) {
  const doc = fileJson?.document;
  if (!doc || !Array.isArray(issues)) return issues;
  const fillHard = /hardcoded\s+fill|colou?r hardcoded|fill colou?r.*hardcode|no style or variable|senza stile|DS-2\.1\b/i;
  const strokeHard = /hardcoded\s+stroke|stroke.*hardcode|no style or variable.*stroke|DS-2\.2\b/i;
  return issues.filter((issue) => {
    if (!issue || issue.categoryId !== 'coverage') return true;
    const blob = `${issue.msg || ''} ${issue.fix || ''}`;
    const lid = issue.layerId && String(issue.layerId).trim();
    if (!lid) return true;
    const node = findNodeByIdInDocument(doc, lid);
    if (!node) return true;
    if (fillHard.test(blob) && nodeHasFillStyleOrVariableBinding(node)) return false;
    if (strokeHard.test(blob) && nodeHasStrokeStyleOrVariableBinding(node)) return false;
    return true;
  });
}

function jsonNodeDirectChildCount(node) {
  if (!node || typeof node !== 'object' || !Array.isArray(node.children)) return 0;
  return node.children.length;
}

/** DS-4.1: LLM or truncated JSON says "empty frame" but snapshot lists children. */
function filterFalsePositiveGhostEmptyFrameStructure(issues, fileJson) {
  const doc = fileJson?.document;
  if (!doc || !Array.isArray(issues)) return issues;
  const ghostRe =
    /ghost|no children|empty frame|frame with no|nessun figlio|senza figli|wrapper vuot|meaningful children|redundant wrapper|DS-4\.1\b/i;
  const parentTypes = new Set(['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE', 'SECTION']);
  return issues.filter((issue) => {
    if (!issue || issue.categoryId !== 'structure') return true;
    const blob = `${issue.msg || ''} ${issue.fix || ''}`;
    if (!ghostRe.test(blob)) return true;
    const lid = issue.layerId && String(issue.layerId).trim();
    if (!lid) return true;
    const node = findNodeByIdInDocument(doc, lid);
    if (!node) return true;
    if (!parentTypes.has(String(node.type || ''))) return true;
    if (jsonNodeDirectChildCount(node) > 0) return false;
    return true;
  });
}

/** 5.3 / typography: drop when TEXT has library text style, typo variables, or cited px ≠ snapshot style.fontSize. */
function filterFalsePositiveTypeScaleTypography(issues, fileJson) {
  const doc = fileJson?.document;
  if (!doc || !Array.isArray(issues)) return issues;
  const topicRe =
    /type scale|typescale|font size|fontSize|not (found )?in.*scale|5\.3|DS-5\.3|line height.*(scale|type)|typograph/i;
  const typoFocusRe = /font|typescale|type scale|fontSize|5\.3|DS-5\.3|typograph|line height|heading|body\b/i;
  return issues.filter((issue) => {
    if (!issue || issue.categoryId !== 'consistency') return true;
    const blob = `${issue.msg || ''} ${issue.fix || ''}`;
    if (!topicRe.test(blob)) return true;
    const lid = issue.layerId && String(issue.layerId).trim();
    if (!lid) return true;
    const node = findNodeByIdInDocument(doc, lid);
    if (!node || String(node.type) !== 'TEXT') return true;
    if (node.textStyleId != null && String(node.textStyleId).trim() !== '') return false;
    if (node.styles && node.styles.text != null && String(node.styles.text).trim() !== '') return false;
    const bv = node.boundVariables;
    if (
      bv &&
      typeof bv === 'object' &&
      (bv.fontSize != null || bv.fontFamily != null || bv.fontWeight != null)
    )
      return false;
    const fs = node.style && typeof node.style.fontSize === 'number' ? node.style.fontSize : null;
    if (fs != null && typoFocusRe.test(blob)) {
      const pxMatches = [...blob.matchAll(/\b(\d+)\s*px\b/gi)].map((m) => Number(m[1]));
      if (pxMatches.some((p) => Math.abs(p - fs) >= 0.5)) return false;
    }
    return true;
  });
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

/** Parallel Figma REST calls with bounded concurrency (sequential was N×latency for “all pages” audits). */
async function mapWithConcurrency(items, concurrency, mapper) {
  if (!items.length) return [];
  const cap = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await mapper(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: cap }, () => worker()));
  return results;
}

/** REST `depth` too shallow → inner frames get empty `children` in JSON → false DS-4.1 "ghost / no children". */
const FIGMA_AUDIT_REST_DEPTH_NODES = 8;
const FIGMA_AUDIT_REST_DEPTH_PAGE = 8;
const FIGMA_AUDIT_REST_DEPTH_FULL_OVERVIEW = 5;
/** Max parallel GET /v1/files/... per multi-page audit (Figma rate limits ~ tier-dependent; 6 is a safe default). */
const FIGMA_AUDIT_PAGE_FETCH_CONCURRENCY = 6;

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
    url.searchParams.set('depth', String(FIGMA_AUDIT_REST_DEPTH_NODES));
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
    url.searchParams.set('depth', String(FIGMA_AUDIT_REST_DEPTH_PAGE));
    const res = await fetch(url.toString(), auth);
    if (!res.ok) { const t = await res.text(); handleFigmaError(res, t); }
    const data = await res.json();
    const doc = data.document || { type: 'DOCUMENT', id: '0:0', children: [] };
    const children = Array.isArray(doc.children) ? doc.children : [];
    return { document: { type: 'DOCUMENT', id: '0:0', children }, components: data.components };
  }

  if (scopeType === 'all' && pageIdsArr.length > 0) {
    const allChildren = [];
    let components = undefined;
    const pageResults = await mapWithConcurrency(pageIdsArr, FIGMA_AUDIT_PAGE_FETCH_CONCURRENCY, async (pid) => {
      const url = new URL(`https://api.figma.com/v1/files/${fileKey}`);
      url.searchParams.set('ids', pid);
      url.searchParams.set('depth', String(FIGMA_AUDIT_REST_DEPTH_PAGE));
      const res = await fetch(url.toString(), auth);
      if (!res.ok) {
        const t = await res.text();
        handleFigmaError(res, t);
      }
      return res.json();
    });
    for (const data of pageResults) {
      const doc = data.document || {};
      const kids = Array.isArray(doc.children) ? doc.children : [];
      allChildren.push(...kids);
      if (data.components && components === undefined) components = data.components;
    }
    return { document: { type: 'DOCUMENT', id: '0:0', children: allChildren }, components };
  }

  if (scopeType === 'all') {
    const url = new URL(`https://api.figma.com/v1/files/${fileKey}`);
    url.searchParams.set('depth', String(FIGMA_AUDIT_REST_DEPTH_FULL_OVERVIEW));
    const res = await fetch(url.toString(), auth);
    if (!res.ok) { const t = await res.text(); handleFigmaError(res, t); }
    const data = await res.json();
    return { document: data.document || { type: 'DOCUMENT', id: '0:0', children: [] }, components: data.components };
  }

  const url = new URL(`https://api.figma.com/v1/files/${fileKey}`);
  url.searchParams.set('depth', String(FIGMA_AUDIT_REST_DEPTH_FULL_OVERVIEW));
  const res = await fetch(url.toString(), auth);
  if (!res.ok) { const t = await res.text(); handleFigmaError(res, t); }
  const data = await res.json();
  return { document: data.document || { type: 'DOCUMENT', id: '0:0', children: [] }, components: data.components };
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

    // Advisory: file senza design system (0 componenti) → suggerire Preline, skip Kimi
    const components = fileJson?.components;
    const componentCount = components && typeof components === 'object' ? Object.keys(components).length : null;
    if (componentCount === 0) {
      return res.json({
        issues: [],
        advisory: {
          type: 'no_design_system',
          message: 'Questo file non ha componenti definiti. Per partire da zero, ti consigliamo Preline: design system gratuito con 840+ componenti e template.',
          ctaLabel: 'Scopri Preline',
          ctaUrl: 'https://preline.co',
        },
      });
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
    let issues = rawIssues.map(normalizeDsAuditIssue).filter(Boolean);
    try {
      issues = resolveDsAuditIssuesFromSnapshot(issues, fileJson);
    } catch (resolveErr) {
      console.error('DS Audit: resolveDsAuditIssuesFromSnapshot', resolveErr?.message || resolveErr);
    }
    issues = filterAllowedStructuralLayerNames(issues);
    issues = filterOffGridAutoLayoutFalsePositives(issues, fileJson);
    issues = downgradeRedundantComponentMergeSeverity(issues);
    issues = filterFalsePositiveInstanceVsMainAdoption(issues, fileJson);
    issues = filterFalsePositiveHardcodedPaintCoverage(issues, fileJson);
    issues = filterFalsePositiveGhostEmptyFrameStructure(issues, fileJson);
    issues = filterFalsePositiveTypeScaleTypography(issues, fileJson);

    // Telemetria uso token (anonima): log per dashboard. Vedi docs/TOKEN-USAGE-TELEMETRY.md
    const { inputTokens, outputTokens } = normalizeMoonshotUsage(kimiData?.usage);
    if (dbSql && (inputTokens > 0 || outputTokens > 0)) {
      const nodeCount = countFigmaNodes(fileJson?.document);
      const sizeBand = nodeCount > 0 ? sizeBandFromNodeCount(nodeCount) : null;
      dbSql`
        INSERT INTO kimi_usage_log (action_type, input_tokens, output_tokens, size_band, model)
        VALUES ('ds_audit', ${inputTokens}, ${outputTokens}, ${sizeBand}, ${KIMI_MODEL})
      `.catch((err) => console.error('Kimi usage log insert failed', err.message));
    }

    const libraryContextHint = getLibraryContextHint(fileJson);
    res.json({ issues, ...(libraryContextHint ? { libraryContextHint } : {}) });
  } catch (err) {
    console.error('POST /api/agents/ds-audit', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Generate agent (Kimi): file_key + prompt → action plan JSON. A/B: 50% Direct (A), 50% ASCII first (B)
const GENERATE_PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'generate-system.md');
const GENERATE_ASCII_PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'generate-ascii-system.md');

function normalizeScreenshotFromBody(body) {
  const raw =
    body?.screenshot_base64 ||
    body?.screenshotBase64 ||
    body?.screenshot_data_url ||
    body?.screenshotDataUrl;
  if (raw == null || raw === '') return { dataUrl: null, error: null };
  if (typeof raw !== 'string') {
    return { dataUrl: null, error: 'screenshot must be a string (base64 or data URL).' };
  }
  const s = raw.trim();
  if (!s) return { dataUrl: null, error: null };
  let dataUrl = s;
  if (!/^data:image\//i.test(s)) {
    dataUrl = `data:image/png;base64,${s.replace(/\s/g, '')}`;
  }
  const m = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,([\s\S]+)$/i);
  if (!m) {
    return { dataUrl: null, error: 'Invalid screenshot: expected PNG/JPEG/WebP data URL or raw base64.' };
  }
  const b64 = m[2].replace(/\s/g, '');
  const approxBytes = Math.ceil((b64.length * 3) / 4);
  const MAX_BYTES = 6 * 1024 * 1024;
  if (approxBytes > MAX_BYTES) {
    return { dataUrl: null, error: 'Screenshot too large (max 6MB decoded).' };
  }
  return { dataUrl: `data:image/${m[1].toLowerCase() === 'jpg' ? 'jpeg' : m[1].toLowerCase()};base64,${b64}`, error: null };
}

async function callKimi(messages, maxTokens = 8192) {
  const usesVision =
    Array.isArray(messages) && messages.some((m) => m && typeof m === 'object' && Array.isArray(m.content));
  const model = usesVision ? KIMI_VISION_MODEL : KIMI_MODEL;
  /** kimi-k2.5: la doc Moonshot impone temperature/top_p fissi; altri valori possono dare errore. */
  const isK25Family = /k2\.5/i.test(String(model));
  const payload = { model, messages, max_tokens: maxTokens };
  if (!isK25Family) {
    payload.temperature = 0.3;
  }
  const r = await fetch('https://api.moonshot.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KIMI_API_KEY}` },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || `Kimi API ${r.status}`);
  }
  const data = await r.json();
  return { content: data?.choices?.[0]?.message?.content, usage: data?.usage };
}

async function repairActionPlanWithKimi(systemPrompt, actionPlan, errors, promptContext) {
  const repairUserMsg = [
    'Your previous JSON is invalid. Repair it and return only one valid JSON object.',
    `Validation errors: ${(errors || []).join(' | ')}`,
    'Keep intent unchanged and preserve DS constraints.',
    `Prompt context:\n${promptContext}`,
    `Previous JSON:\n${JSON.stringify(actionPlan || {}, null, 2)}`,
  ].join('\n\n');
  return callKimi(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: repairUserMsg }],
    8192
  );
}

app.post('/api/agents/generate', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body || {};
  const fileKey = (body.file_key || body.fileKey || '').trim();
  const prompt = (body.prompt || body.promptText || '').trim();
  const mode = body.mode || 'create';
  const dsSource = body.ds_source || body.dsSource || 'custom';
  const dsContextIndex = body.ds_context_index;
  const dsCacheHashFromBody = String(body.ds_cache_hash || body.dsCacheHash || '').trim();
  const contextProfile = resolveContextProfile(body.context_profile || body.contextProfile || { input_mode: mode });
  const resolvedDsId = mapDsSourceToId(dsSource);
  let dsPackageRaw = loadDsPackage(dsSource);
  if (!dsPackageRaw && dbSql && dsSource && String(dsSource).toLowerCase() !== 'custom') {
    try {
      const sourceNorm = String(dsSource).trim().toLowerCase();
      const sourceSlug = sourceNorm.replace(/[^a-z0-9-]/g, '-');
      const ext = await dbSql`
        SELECT ds_package
        FROM external_design_systems
        WHERE status = 'published'
          AND (
            lower(ds_source) = ${sourceNorm}
            OR lower(display_name) = ${sourceNorm}
            OR slug = ${sourceSlug}
          )
        ORDER BY updated_at DESC
        LIMIT 1
      `;
      const row = ext?.rows?.[0];
      if (row?.ds_package && typeof row.ds_package === 'object') {
        dsPackageRaw = row.ds_package;
      }
    } catch (e) {
      console.error('external DS lookup failed', e);
    }
  }
  const dsPackage = resolveDsPackageForContext(dsPackageRaw, contextProfile);

  if (!fileKey) return res.status(400).json({ error: 'file_key required' });
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  if (!KIMI_API_KEY) return res.status(503).json({ error: 'KIMI_API_KEY not configured' });

  const shot = normalizeScreenshotFromBody(body);
  if (shot.error) return res.status(400).json({ error: shot.error });
  const screenshotDataUrl = shot.dataUrl;

  /** Phase 3: 2× Kimi default. Opt out: USE_KIMI_SWARM=0 / false. */
  const useKimiDualSwarmPipeline =
    process.env.USE_KIMI_SWARM !== '0' && process.env.USE_KIMI_SWARM !== 'false';

  let variant = Math.random() < 0.5 ? 'B' : 'A';
  const startMs = Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let asciiWireframe = null;
  let generationPipeline = 'legacy_ab';
  let dualPipelineSucceeded = false;

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
    const dsContextBlock = dsPackage ? buildDsContextForPrompt(dsPackage, contextProfile) : 'Resolved DS package: unavailable (fallback to semantic DS hint only).';
    const dsIndexForValidation =
      dsContextIndex && typeof dsContextIndex === 'object' && !Array.isArray(dsContextIndex)
        ? dsContextIndex
        : null;
    const dsIndexSlim = dsIndexForValidation
      ? buildDsSlimIndex(dsIndexForValidation, {
          maxComponents: Number(process.env.GENERATE_DS_SLIM_COMPONENTS || 120),
          maxVariables: Number(process.env.GENERATE_DS_SLIM_VARIABLES || 180),
        })
      : null;
    const dsIndexForPrompt = dsIndexSlim
      ? buildPromptScopedDsIndex(dsIndexSlim, prompt, {
          topKComponents: Number(process.env.GENERATE_DS_PROMPT_COMPONENTS || 32),
          topKVariables: Number(process.env.GENERATE_DS_PROMPT_VARIABLES || 48),
        })
      : null;
    const dsIndexHashLine =
      dsCacheHashFromBody ||
      (dsIndexForValidation && typeof dsIndexForValidation.hash === 'string' ? dsIndexForValidation.hash : '') ||
      'n/a';
    const dsIndexBlock = dsIndexForPrompt
      ? [
          '',
          '[DS CONTEXT INDEX]',
          'Prompt-scoped DS index retrieved from a slim local snapshot. For file-scoped DS, use only component ids and token paths that appear in this JSON.',
          JSON.stringify(dsIndexForPrompt),
          '[END DS CONTEXT INDEX]',
          `ds_cache_hash: ${dsIndexHashLine}`,
        ].join('\n')
      : '';
    const inferredScreenArchetype = inferFocusedScreenType(prompt);
    const designIntelBlock = formatDesignIntelligenceForPrompt(fileKey, {
      focusScreenType: inferredScreenArchetype,
    });
    const contextBlob = [
      `Mode: ${mode}.`,
      inferredScreenArchetype
        ? `Inferred screen archetype: ${inferredScreenArchetype} (layout and checklist prioritize this type).`
        : 'Inferred screen archetype: none — full pattern library in DESIGN INTELLIGENCE block.',
      `DS source: ${dsSource}.`,
      `Resolved DS id: ${resolvedDsId || 'none'}.`,
      `Context profile: platform=${contextProfile.platform}, density=${contextProfile.density}, input_mode=${contextProfile.input_mode}, selection_type=${contextProfile.selection_type}.`,
      `File has ${pageCount} page(s).`,
      'Use only variable references (no raw hex/px).',
      dsContextBlock,
      dsIndexBlock,
      designIntelBlock,
    ].join('\n');

    let actionPlan = null;
    const forceDirectForVision = Boolean(screenshotDataUrl);

    if (useKimiDualSwarmPipeline) {
      try {
        const dual = await runGenerateDualCallPipeline({
          callKimi,
          extractJsonFromContent,
          userPrompt: prompt,
          contextBlob,
          actionPlanSystemPrompt: systemPrompt,
          screenshotDataUrl,
        });
        totalInputTokens = dual.usage.input;
        totalOutputTokens = dual.usage.output;
        if (dual.actionPlan && typeof dual.actionPlan === 'object') {
          actionPlan = dual.actionPlan;
          variant = 'S';
          asciiWireframe = null;
          dualPipelineSucceeded = true;
          generationPipeline = 'kimi_dual_layout_mapper';
        } else {
          console.error('Generate dual pipeline failed:', dual.stage);
        }
      } catch (dualErr) {
        console.error('Generate dual pipeline error:', dualErr?.message || dualErr);
      }
    }

    if (!actionPlan && !forceDirectForVision && variant === 'B') {
      let asciiPrompt;
      try {
        asciiPrompt = readFileSync(GENERATE_ASCII_PROMPT_PATH, 'utf8');
        if (!asciiPrompt?.trim()) throw new Error('empty');
      } catch (e) {
        console.error('Generate B: ASCII prompt not found', e?.message);
        asciiPrompt = 'Create an ASCII wireframe using +, -, |. Return only the wireframe, no other text.';
      }
      const asciiUserMsg = `User request: ${prompt}\n\nCreate the ASCII wireframe.`;
      const { content: asciiContent, usage: asciiUsage } = await callKimi(
        [{ role: 'system', content: asciiPrompt }, { role: 'user', content: asciiUserMsg }],
        2048,
      );
      totalInputTokens += Math.max(0, Number(asciiUsage?.input_tokens ?? asciiUsage?.prompt_tokens ?? 0));
      totalOutputTokens += Math.max(0, Number(asciiUsage?.output_tokens ?? asciiUsage?.completion_tokens ?? 0));
      asciiWireframe = (asciiContent || '').trim();

      const convertUserMsg = `ASCII wireframe:\n${asciiWireframe}\n\nOriginal prompt: ${prompt}\n\nContext: ${contextBlob}\n\nConvert this ASCII wireframe into the action plan JSON. Return only the JSON object, no other text.`;
      const { content: jsonContent, usage: jsonUsage } = await callKimi(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: convertUserMsg }],
        8192,
      );
      totalInputTokens += Math.max(0, Number(jsonUsage?.input_tokens ?? jsonUsage?.prompt_tokens ?? 0));
      totalOutputTokens += Math.max(0, Number(jsonUsage?.output_tokens ?? jsonUsage?.completion_tokens ?? 0));
      actionPlan = extractJsonFromContent(jsonContent);
      generationPipeline = 'legacy_ab';
    } else if (!actionPlan) {
      const userText = `User prompt:\n${prompt}\n\nContext: ${contextBlob}\n\nReturn only the action plan JSON object, no other text.`;
      const userMessage = screenshotDataUrl
        ? [
            { type: 'image_url', image_url: { url: screenshotDataUrl } },
            { type: 'text', text: userText },
          ]
        : userText;
      const { content, usage } = await callKimi(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
        8192,
      );
      totalInputTokens += Math.max(0, Number(usage?.input_tokens ?? usage?.prompt_tokens ?? 0));
      totalOutputTokens += Math.max(0, Number(usage?.output_tokens ?? usage?.completion_tokens ?? 0));
      actionPlan = extractJsonFromContent(content);
      if (!dualPipelineSucceeded) generationPipeline = 'legacy_ab';
    }

    if (!actionPlan || typeof actionPlan !== 'object') {
      console.error('Generate: invalid or missing JSON from Kimi');
      return res.status(502).json({ error: 'Invalid response from AI' });
    }

    let schemaValidation = validateActionPlanSchema(actionPlan);
    let dsValidation = validateActionPlanAgainstDs(actionPlan, dsPackage);
    let visibleValidation = validateActionPlanVisiblePrimitives(actionPlan);
    let publicDsInstanceValidation = validateActionPlanNoInstanceForPublicDs(actionPlan, dsSource);
    const mustRepair =
      !schemaValidation.valid ||
      !dsValidation.valid ||
      !visibleValidation.valid ||
      !publicDsInstanceValidation.valid;
    if (mustRepair) {
      const firstPassErrors = [
        ...schemaValidation.errors.map((e) => `schema: ${e}`),
        ...dsValidation.errors.map((e) => `ds: ${e}`),
        ...visibleValidation.errors.map((e) => `visible: ${e}`),
        ...publicDsInstanceValidation.errors.map((e) => `public_ds: ${e}`),
      ];
      const repair = await repairActionPlanWithKimi(systemPrompt, actionPlan, firstPassErrors, `User prompt: ${prompt}\n\n${contextBlob}`);
      totalInputTokens += Math.max(0, Number(repair?.usage?.input_tokens ?? repair?.usage?.prompt_tokens ?? 0));
      totalOutputTokens += Math.max(0, Number(repair?.usage?.output_tokens ?? repair?.usage?.completion_tokens ?? 0));
      const repaired = extractJsonFromContent(repair?.content);
      if (repaired && typeof repaired === 'object') {
        actionPlan = repaired;
        schemaValidation = validateActionPlanSchema(actionPlan);
        dsValidation = validateActionPlanAgainstDs(actionPlan, dsPackage);
        visibleValidation = validateActionPlanVisiblePrimitives(actionPlan);
        publicDsInstanceValidation = validateActionPlanNoInstanceForPublicDs(actionPlan, dsSource);
      }
    }

    if (!schemaValidation.valid) {
      return res.status(422).json({
        error: 'Action plan schema validation failed',
        code: 'ACTION_PLAN_SCHEMA_FAILED',
        details: schemaValidation.errors,
      });
    }
    if (!dsValidation.valid) {
      return res.status(422).json({
        error: 'Action plan violates DS package constraints',
        code: 'DS_VALIDATION_FAILED',
        ds_id: dsPackage?.ds_id || null,
        details: dsValidation.errors,
      });
    }
    if (!visibleValidation.valid) {
      return res.status(422).json({
        error: 'Action plan missing visible primitives on root',
        code: 'VISIBLE_CONTENT_REQUIRED',
        details: visibleValidation.errors,
      });
    }
    if (!publicDsInstanceValidation.valid) {
      return res.status(422).json({
        error: 'INSTANCE_COMPONENT not allowed for public design system packages',
        code: 'PUBLIC_DS_NO_INSTANCE',
        details: publicDsInstanceValidation.errors,
      });
    }

    const fileIndexValidation = validateActionPlanAgainstFileDsIndex(actionPlan, dsIndexForValidation);
    if (!fileIndexValidation.skipped && !fileIndexValidation.valid) {
      return res.status(422).json({
        error: 'Action plan violates file DS context index',
        code: 'FILE_DS_INDEX_VIOLATION',
        details: fileIndexValidation.errors,
      });
    }

    if (!actionPlan.metadata || typeof actionPlan.metadata !== 'object') actionPlan.metadata = {};
    if (!String(actionPlan.metadata.prompt || '').trim()) actionPlan.metadata.prompt = prompt;
    actionPlan.metadata.inferred_screen_archetype = inferredScreenArchetype ?? null;
    actionPlan.metadata.generation_pipeline = generationPipeline;
    actionPlan.metadata.ds_source = dsSource;
    actionPlan.metadata.ds_id = dsPackage?.ds_id || resolvedDsId || null;
    actionPlan.metadata.ds_context_strategy = dsIndexForPrompt ? 'slim_plus_prompt_retrieval' : 'none';
    if (dsIndexForPrompt?.components_retrieval) actionPlan.metadata.ds_components_retrieval = dsIndexForPrompt.components_retrieval;
    if (dsIndexForPrompt?.variable_names_retrieval) actionPlan.metadata.ds_variables_retrieval = dsIndexForPrompt.variable_names_retrieval;
    actionPlan.metadata.context_profile = contextProfile;
    actionPlan.metadata.ds_validation = {
      valid: dsValidation.valid,
      warnings: [
        ...(schemaValidation.warnings || []),
        ...(dsValidation.warnings || []),
        ...(fileIndexValidation.skipped ? [] : fileIndexValidation.warnings || []),
      ],
      token_refs_used: dsValidation.used.tokenRefs.length,
      component_refs_used: dsValidation.used.componentRefs.length,
    };
    actionPlan.metadata.file_ds_index_validation = {
      skipped: fileIndexValidation.skipped,
      valid: fileIndexValidation.skipped ? null : fileIndexValidation.valid,
      warnings: fileIndexValidation.skipped ? [] : fileIndexValidation.warnings || [],
      component_node_ids_seen: fileIndexValidation.used?.componentNodeIds?.length ?? 0,
      variable_refs_seen: fileIndexValidation.used?.variableRefs?.length ?? 0,
    };

    if (screenshotDataUrl) {
      const metaEc = Number(actionPlan.metadata.estimated_credits);
      const base =
        Number.isFinite(metaEc) && metaEc > 0
          ? metaEc
          : estimateCreditsByAction(mode === 'modify' ? 'wireframe_modified' : 'generate', undefined, {
              has_screenshot: false,
            });
      actionPlan.metadata.estimated_credits = base + 2;
      actionPlan.metadata.screenshot_attached = true;
    }

    const creditsConsumed = actionPlan.metadata?.estimated_credits ?? 3;
    const latencyMs = Date.now() - startMs;

    if (dbSql) {
      dbSql`
        INSERT INTO kimi_usage_log (action_type, input_tokens, output_tokens, size_band, model)
        VALUES ('generate', ${totalInputTokens}, ${totalOutputTokens}, null, ${KIMI_MODEL})
      `.catch((err) => console.error('Kimi usage log generate failed', err.message));

      const ins = await dbSql`
        INSERT INTO generate_ab_requests (user_id, variant, input_tokens, output_tokens, credits_consumed, latency_ms)
        VALUES (${userId}, ${variant}, ${totalInputTokens}, ${totalOutputTokens}, ${creditsConsumed}, ${latencyMs})
        RETURNING id
      `.catch(() => ({ rows: [] }));
      const requestId = ins?.rows?.[0]?.id ?? null;

      res.json({
        action_plan: actionPlan,
        variant,
        request_id: requestId,
        ds_id: dsPackage?.ds_id || resolvedDsId || null,
        ds_validation: actionPlan.metadata.ds_validation,
      });
    } else {
      res.json({
        action_plan: actionPlan,
        variant,
        request_id: null,
        ds_id: dsPackage?.ds_id || resolvedDsId || null,
        ds_validation: actionPlan.metadata.ds_validation,
      });
    }
  } catch (err) {
    console.error('POST /api/agents/generate', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Feedback Generate (thumbs up/down + optional comment)
app.post('/api/feedback/generate', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body || {};
  const requestId = body.request_id;
  const thumbs = body.thumbs;
  const comment = (body.comment || '').trim().slice(0, 2000);

  if (!requestId) return res.status(400).json({ error: 'request_id required' });
  if (thumbs !== 'up' && thumbs !== 'down') return res.status(400).json({ error: 'thumbs must be up or down' });

  if (!dbSql) return res.status(503).json({ error: 'Database required' });

  try {
    const sel = await dbSql`SELECT id, user_id, variant FROM generate_ab_requests WHERE id = ${requestId} LIMIT 1`;
    const reqRow = sel?.rows?.[0];
    if (!reqRow || reqRow.user_id !== userId) return res.status(404).json({ error: 'Request not found' });

    await dbSql`
      INSERT INTO generate_ab_feedback (request_id, variant, thumbs, comment)
      VALUES (${requestId}, ${reqRow.variant}, ${thumbs}, ${comment || null})
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/feedback/generate', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Design systems catalog (dynamic list for plugin dropdown)
app.get('/api/design-systems', async (_req, res) => {
  if (!dbSql) return res.json({ systems: BUILTIN_DESIGN_SYSTEMS });
  try {
    const sel = await dbSql`
      SELECT display_name
      FROM external_design_systems
      WHERE status = 'published'
      ORDER BY updated_at DESC
      LIMIT 300
    `;
    const external = (sel.rows || [])
      .map((r) => String(r.display_name || '').trim())
      .filter(Boolean);
    const out = Array.from(new Set([...BUILTIN_DESIGN_SYSTEMS, ...external]));
    return res.json({ systems: out });
  } catch (err) {
    console.error('GET /api/design-systems', err);
    return res.json({ systems: BUILTIN_DESIGN_SYSTEMS });
  }
});

// --- Admin external DS CRUD (for portal ingestion / publish)
app.get('/api/admin/design-systems/external', async (req, res) => {
  if (!isAdminApiRequest(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!dbSql) return res.status(503).json({ error: 'Database required' });
  try {
    const sel = await dbSql`
      SELECT slug, display_name, ds_source, status, ds_package, created_at, updated_at
      FROM external_design_systems
      ORDER BY updated_at DESC
      LIMIT 500
    `;
    res.json({ items: sel.rows || [] });
  } catch (err) {
    console.error('GET /api/admin/design-systems/external', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/admin/design-systems/external', async (req, res) => {
  if (!isAdminApiRequest(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!dbSql) return res.status(503).json({ error: 'Database required' });
  const body = req.body || {};
  const slug = String(body.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 120);
  const displayName = String(body.display_name || body.displayName || '').trim().slice(0, 200);
  const dsSource = String(body.ds_source || body.dsSource || slug).trim().slice(0, 160);
  const statusRaw = String(body.status || 'draft').trim().toLowerCase();
  const status = EXTERNAL_DS_STATUSES.has(statusRaw) ? statusRaw : 'draft';
  const dsPackage = body.ds_package ?? body.dsPackage;
  if (!slug) return res.status(400).json({ error: 'slug required' });
  if (!displayName) return res.status(400).json({ error: 'display_name required' });
  if (!dsPackage || typeof dsPackage !== 'object' || Array.isArray(dsPackage)) {
    return res.status(400).json({ error: 'ds_package object required' });
  }
  try {
    const dsPackageStr = JSON.stringify(dsPackage);
    await dbSql`
      INSERT INTO external_design_systems (
        slug, display_name, ds_source, status, ds_package, created_at, updated_at
      )
      VALUES (
        ${slug}, ${displayName}, ${dsSource}, ${status}, ${dsPackageStr}::jsonb, NOW(), NOW()
      )
      ON CONFLICT (slug) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        ds_source = EXCLUDED.ds_source,
        status = EXCLUDED.status,
        ds_package = EXCLUDED.ds_package,
        updated_at = NOW()
    `;
    res.json({ ok: true, slug, status });
  } catch (err) {
    console.error('PUT /api/admin/design-systems/external', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- User DS imports (Generate: custom file DS — persist context index for performance)
app.get('/api/user/ds-imports', async (req, res) => {
  const authCtx = getUserAuthContext(req);
  const userId = authCtx.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED', reason: authCtx.reason });
  if (!dbSql) return res.status(503).json({ error: 'Database required' });
  try {
    const sel = await dbSql`
      SELECT figma_file_key, display_name, figma_file_name, ds_cache_hash,
             EXTRACT(EPOCH FROM updated_at) * 1000 AS updated_at_ms
      FROM user_ds_imports
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
    `;
    res.json({ imports: sel.rows || [] });
  } catch (err) {
    console.error('GET /api/user/ds-imports', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/user/ds-imports/context', async (req, res) => {
  const authCtx = getUserAuthContext(req);
  const userId = authCtx.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED', reason: authCtx.reason });
  const fileKey = String(req.query.file_key || req.query.fileKey || '').trim();
  if (!fileKey) return res.status(400).json({ error: 'file_key required' });
  if (!dbSql) return res.status(503).json({ error: 'Database required' });
  try {
    const sel = await dbSql`
      SELECT ds_context_index, ds_cache_hash
      FROM user_ds_imports
      WHERE user_id = ${userId} AND figma_file_key = ${fileKey}
      LIMIT 1
    `;
    const row = sel?.rows?.[0];
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({
      ds_context_index: row.ds_context_index,
      ds_cache_hash: row.ds_cache_hash || null,
    });
  } catch (err) {
    console.error('GET /api/user/ds-imports/context', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/user/ds-imports', async (req, res) => {
  const authCtx = getUserAuthContext(req);
  const userId = authCtx.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED', reason: authCtx.reason });
  if (!dbSql) return res.status(503).json({ error: 'Database required' });
  const body = req.body || {};
  const figmaFileKey = String(body.figma_file_key || body.file_key || body.fileKey || '').trim();
  const displayName = String(body.display_name || body.displayName || '').trim().slice(0, 500);
  const figmaFileName = String(body.figma_file_name || body.figmaFileName || '').trim().slice(0, 500);
  const dsCacheHash = String(body.ds_cache_hash || body.dsCacheHash || '').trim().slice(0, 128);
  const dsContextIndex = body.ds_context_index ?? body.dsContextIndex;
  if (!figmaFileKey) return res.status(400).json({ error: 'figma_file_key required' });
  if (!displayName) return res.status(400).json({ error: 'display_name required' });
  if (!dsContextIndex || typeof dsContextIndex !== 'object') return res.status(400).json({ error: 'ds_context_index object required' });

  try {
    const planRow = await dbSql`SELECT plan FROM users WHERE id = ${userId} LIMIT 1`;
    const plan = String(planRow?.rows?.[0]?.plan || 'FREE').toUpperCase();
    if (plan !== 'PRO') {
      const cntSel = await dbSql`
        SELECT COUNT(*)::int AS c FROM user_ds_imports WHERE user_id = ${userId}
      `;
      const total = cntSel?.rows?.[0]?.c ?? 0;
      const sameSel = await dbSql`
        SELECT 1 FROM user_ds_imports
        WHERE user_id = ${userId} AND figma_file_key = ${figmaFileKey}
        LIMIT 1
      `;
      const hasSame = (sameSel?.rows?.length || 0) > 0;
      if (total >= 1 && !hasSame) {
        return res.status(403).json({
          error: 'Free tier allows one design system file. Upgrade to Pro to import more.',
          code: 'DS_IMPORT_PRO_REQUIRED',
        });
      }
    }

    const jsonStr = JSON.stringify(dsContextIndex);
    await dbSql`
      INSERT INTO user_ds_imports (
        user_id, figma_file_key, display_name, figma_file_name, ds_cache_hash, ds_context_index, updated_at
      )
      VALUES (
        ${userId}, ${figmaFileKey}, ${displayName}, ${figmaFileName},
        ${dsCacheHash}, ${jsonStr}::jsonb, NOW()
      )
      ON CONFLICT (user_id, figma_file_key) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        figma_file_name = EXCLUDED.figma_file_name,
        ds_cache_hash = EXCLUDED.ds_cache_hash,
        ds_context_index = EXCLUDED.ds_context_index,
        updated_at = NOW()
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/user/ds-imports', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Support ticket (Documentation & Help modal)
app.post('/api/support/ticket', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body || {};
  const type = (body.type || 'BUG').toUpperCase();
  const message = (body.message || '').trim().slice(0, 2000);

  const ALLOWED_TYPES = ['BUG', 'FEATURE', 'LOVE', 'AUDIT'];
  if (!ALLOWED_TYPES.includes(type)) return res.status(400).json({ error: `type must be one of ${ALLOWED_TYPES.join(', ')}` });
  if (message.length < 2) return res.status(400).json({ error: 'message must be at least 2 characters' });

  if (!dbSql) return res.status(503).json({ error: 'Database required' });

  try {
    await dbSql`
      INSERT INTO support_tickets (user_id, type, message)
      VALUES (${userId}, ${type}, ${message})
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/support/ticket', err);
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

// --- UX Logic Audit agent (Kimi): file_key → Figma JSON → Kimi → issues
const UX_AUDIT_PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'ux-audit-system.md');

function normalizeUxAuditIssue(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id != null ? String(raw.id) : `UXL-${Math.random().toString(36).slice(2, 9)}`;
  const categoryId = raw.categoryId != null ? String(raw.categoryId) : 'form-ux';
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
    rule_id: raw.id,
    pageName: raw.pageName != null ? String(raw.pageName) : undefined,
    heuristic: raw.heuristic != null ? String(raw.heuristic) : undefined,
    nodeName: raw.nodeName != null ? String(raw.nodeName) : undefined,
  };
}

app.post('/api/agents/ux-audit', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body || {};
  const fileKey = (body.file_key || body.fileKey || '').trim();
  const fileJsonFromBody = body.file_json || body.fileJson;

  if (!fileKey && !fileJsonFromBody) return res.status(400).json({ error: 'file_key or file_json required' });
  if (!KIMI_API_KEY) return res.status(503).json({ error: 'KIMI_API_KEY not configured' });

  let systemPrompt;
  const pathsToTry = [UX_AUDIT_PROMPT_PATH, path.join(process.cwd(), 'prompts', 'ux-audit-system.md')];
  for (const p of pathsToTry) {
    try {
      systemPrompt = readFileSync(p, 'utf8');
      if (systemPrompt && systemPrompt.length > 0) break;
    } catch (_) {}
  }
  if (!systemPrompt) {
    console.error('UX Audit: failed to read prompt', pathsToTry);
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
        console.warn('POST /api/agents/ux-audit: no token for user_id=', userId);
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

    // Keep UX payload under model context budget. System prompt for UX is large,
    // so we cap file JSON aggressively and signal truncation to the model.
    const UX_JSON_MAX = 140000;
    let uxBlob = JSON.stringify(fileJson);
    if (uxBlob.length > UX_JSON_MAX) {
      uxBlob = `${uxBlob.slice(0, UX_JSON_MAX)}\n…[truncated for model input: file JSON exceeded size budget]`;
    }
    const userMessage = [
      `Ecco il JSON del file di design. Esegui l'audit UX secondo le regole e restituisci solo un JSON con chiave "issues" (array di issue). Nessun testo prima o dopo.`,
      'Se trovi il marker "[truncated for model input]" tratta l\'analisi come partial scan e limita i risultati ai segnali più affidabili.',
      uxBlob,
    ].join('\n\n');

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
      console.error('UX Audit: Kimi API', kimiRes.status, t.slice(0, 300));
      // Preserve upstream semantics: 429 from Kimi should stay 429 (not generic 400),
      // so frontend can show a proper "retry later" message.
      if (kimiRes.status === 429) {
        return res.status(429).json({
          error: 'UX audit temporarily rate-limited by AI provider. Please retry in about 1 minute.',
          code: 'KIMI_RATE_LIMIT',
        });
      }
      if (kimiRes.status === 400 && /token limit|exceeded model token limit|invalid_request_error/i.test(t)) {
        return res.status(413).json({
          error: 'Selection too large for UX audit. Try Current Selection with fewer layers, or scan a smaller page section.',
          code: 'UX_AUDIT_INPUT_TOO_LARGE',
        });
      }
      return res.status(kimiRes.status >= 500 ? 502 : 400).json({ error: 'Kimi API error', details: t.slice(0, 260) });
    }
    const kimiData = await kimiRes.json();
    const content = kimiData?.choices?.[0]?.message?.content;
    const parsed = extractJsonFromContent(content);
    const rawIssues = Array.isArray(parsed?.issues) ? parsed.issues : [];
    const issues = rawIssues.map(normalizeUxAuditIssue).filter(Boolean);

    const { inputTokens, outputTokens } = normalizeMoonshotUsage(kimiData?.usage);
    if (dbSql && (inputTokens > 0 || outputTokens > 0)) {
      const nodeCount = countFigmaNodes(fileJson?.document);
      const sizeBand = nodeCount > 0 ? sizeBandFromNodeCount(nodeCount) : null;
      dbSql`
        INSERT INTO kimi_usage_log (action_type, input_tokens, output_tokens, size_band, model)
        VALUES ('ux_audit', ${inputTokens}, ${outputTokens}, ${sizeBand}, ${KIMI_MODEL})
      `.catch((err) => console.error('Kimi usage log ux_audit failed', err.message));
    }

    res.json({ issues });
  } catch (err) {
    console.error('POST /api/agents/ux-audit', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Sync: check Storybook URL (verifica che esponga /api/stories o equivalente)
const { runSyncScan, fetchStorybookMetadata } = await import('./sync-scan-engine.mjs');

app.post('/api/agents/sync-check-storybook', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body || {};
  const storybookUrl = (body.storybook_url || body.storybookUrl || '').trim();
  const storybookToken = (body.storybook_token || body.storybookToken || '').trim() || undefined;
  if (!storybookUrl) return res.status(400).json({ ok: false, error: 'storybook_url required' });
  try {
    const result = await fetchStorybookMetadata(storybookUrl, storybookToken);
    if (result.connectionStatus === 'ok') {
      return res.json({ ok: true });
    }
    return res.json({ ok: false, error: result.error || 'Stories API not found at this URL.' });
  } catch (err) {
    return res.json({ ok: false, error: err?.message || 'Connection failed.' });
  }
});

app.post('/api/agents/sync-scan', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body || {};
  const fileKey = (body.file_key || body.fileKey || '').trim();
  const fileJsonFromBody = body.file_json || body.fileJson;
  const storybookUrl = (body.storybook_url || body.storybookUrl || '').trim();
  const storybookToken = (body.storybook_token || body.storybookToken || '').trim() || undefined;
  // Do not log body or storybookToken; token is used only for fetch and must not be persisted or logged.

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

    const result = await runSyncScan(fileJson, storybookUrl, storybookToken);

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

// --- Code generation (Kimi): subtree JSON from plugin + format → source code
const CODE_GEN_PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'code-gen-system.md');

function sanitizeCodeGenComponentName(raw) {
  const s = String(raw || 'Generated').replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  const parts = s.split(/\s+/).filter(Boolean);
  if (!parts.length) return 'GeneratedComponent';
  return parts.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

function stripCodeFences(text) {
  let t = String(text || '').trim();
  if (!t.startsWith('```')) return t;
  t = t.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, '');
  t = t.replace(/\n```[\s\S]*$/, '');
  return t.trim();
}

app.post('/api/agents/code-gen', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body || {};
  const format = String(body.format || body.output_format || 'REACT').toUpperCase().trim();
  const nodeJson = body.node_json || body.nodeJson;
  const fileKey = (body.file_key || body.fileKey || '').trim() || undefined;

  const ALLOWED = ['REACT', 'REACT_INLINE', 'STORYBOOK', 'LIQUID', 'CSS', 'VUE', 'SVELTE', 'ANGULAR'];
  if (!nodeJson || typeof nodeJson !== 'object') return res.status(400).json({ error: 'node_json required' });
  if (!ALLOWED.includes(format)) return res.status(400).json({ error: 'invalid format' });
  if (!KIMI_API_KEY) return res.status(503).json({ error: 'KIMI_API_KEY not configured' });

  let systemPrompt;
  const pathsToTry = [CODE_GEN_PROMPT_PATH, path.join(process.cwd(), 'prompts', 'code-gen-system.md')];
  for (const p of pathsToTry) {
    try {
      systemPrompt = readFileSync(p, 'utf8');
      if (systemPrompt && systemPrompt.length > 0) break;
    } catch (_) {}
  }
  if (!systemPrompt) {
    console.error('Code gen: failed to read prompt', pathsToTry);
    return res.status(500).json({ error: 'System prompt not found' });
  }

  const JSON_MAX = 320000;
  let blob = JSON.stringify(nodeJson);
  if (blob.length > JSON_MAX) blob = `${blob.slice(0, JSON_MAX)}\n…[truncated for model input]`;

  const sbCtx = body.storybook_context || body.storybookContext;
  let sbBlock = '';
  if (sbCtx && typeof sbCtx === 'object') {
    try {
      const s = JSON.stringify(sbCtx);
      sbBlock = s.length > 12000 ? `${s.slice(0, 12000)}\n…[truncated]` : s;
    } catch (_) {}
  }

  const userMessage = [
    `Output format: ${format}.`,
    fileKey ? `Figma file_key (context only): ${fileKey}` : '',
    'The JSON is the user-selected Figma node (root) and descendants. Generate code for this root as a whole — not a generic unrelated widget.',
    'If root._meta.truncated is true, add a one-line top comment that descendants were capped in the export.',
    sbBlock
      ? `Optional Storybook sync hints (prefer imports/names when layer IDs match; do not shrink scope):\n${sbBlock}`
      : '',
    '---',
    blob,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const { content, usage } = await callKimi(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
      12000,
    );
    const { inputTokens, outputTokens } = normalizeMoonshotUsage(usage);
    if (dbSql) {
      dbSql`
        INSERT INTO kimi_usage_log (action_type, input_tokens, output_tokens, size_band, model)
        VALUES ('code_gen', ${inputTokens}, ${outputTokens}, null, ${KIMI_MODEL})
      `.catch((err) => console.error('Kimi usage log code_gen failed', err.message));
    }
    const code = stripCodeFences(content);
    if (!code) return res.status(502).json({ error: 'Empty response from AI' });
    const componentName = sanitizeCodeGenComponentName(nodeJson.name);
    res.json({
      code,
      format,
      component_name: componentName,
      warnings: [],
    });
  } catch (err) {
    console.error('POST /api/agents/code-gen', err);
    const msg = err?.message || 'Server error';
    if (String(msg).includes('429')) return res.status(429).json({ error: 'Rate limited; try again shortly.' });
    res.status(500).json({ error: String(msg).length < 240 ? msg : 'Server error' });
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
  const wireframesModified = counts.wireframe_modified || 0;
  const protoScans = (counts.proto_scan || 0) + (counts.proto_audit || 0);
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
    audits, wireframesGen, wireframesModified, protoScans, a11y, ux, syncStorybook, syncGithub, syncBitbucket,
    auditsToday, affiliateReferrals,
  };
}

/** Build production metrics object for plugin (UserStats shape). */
async function getProductionStats(dbSql, userId) {
  const ctx = await getTrophyContext(dbSql, userId);
  return {
    maxHealthScore: ctx.maxHealth,
    wireframesGenerated: ctx.wireframesGen,
    wireframesModified: ctx.wireframesModified ?? 0,
    analyzedA11y: ctx.a11y,
    analyzedUX: ctx.ux,
    analyzedProto: ctx.protoScans,
    syncedStorybook: ctx.syncStorybook,
    syncedGithub: ctx.syncGithub,
    syncedBitbucket: ctx.syncBitbucket,
    affiliatesCount: ctx.affiliateReferrals,
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

// --- Brand awareness: tracciamento click "Share on LinkedIn" per trofeo (dashboard: Brand awareness)
app.post('/api/tracking/linkedin-share', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const trophyId = (req.body && req.body.trophy_id) ? String(req.body.trophy_id).trim() : null;
  if (!trophyId || trophyId.length > 64) return res.status(400).json({ error: 'trophy_id required' });
  if (!POSTGRES_URL) return res.status(204).end();
  try {
    await dbSql`INSERT INTO linkedin_share_events (user_id, trophy_id) VALUES (${userId}, ${trophyId})`;
    res.status(204).end();
  } catch (err) {
    console.error('POST /api/tracking/linkedin-share', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Throttle/503: tracciamento eventi + codice sconto 5% (una tantum, valido 1 settimana)
app.post('/api/report-throttle', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!POSTGRES_URL) return res.status(204).end();
  try {
    await dbSql`INSERT INTO throttle_events (user_id) VALUES (${userId})`;
    res.status(204).end();
  } catch (err) {
    console.error('POST /api/report-throttle', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/throttle-discount', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!POSTGRES_URL) return res.status(503).json({ error: 'Database not configured' });
  try {
    const existing = await dbSql`SELECT code, expires_at FROM user_throttle_discounts WHERE user_id = ${userId} LIMIT 1`;
    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      const exp = row.expires_at ? new Date(row.expires_at) : null;
      if (exp && exp > new Date()) {
        return res.json({ code: row.code, expires_at: row.expires_at, already_issued: true });
      }
      return res.status(400).json({ error: 'Codice sconto throttle già usato (una tantum per utente).' });
    }
    const created = await createThrottleDiscount({ userId, storeId: resolveLemonStoreId() });
    if (!created) return res.status(503).json({ error: 'Impossibile creare il codice. Riprova più tardi.' });
    await dbSql`
      INSERT INTO user_throttle_discounts (user_id, code, lemon_discount_id, expires_at)
      VALUES (${userId}, ${created.code}, ${created.id}, ${created.expires_at})
    `;
    res.json({ code: created.code, expires_at: created.expires_at });
  } catch (err) {
    console.error('POST /api/throttle-discount', err);
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
  '1w': process.env.LEMON_VARIANT_1W || '1450263',
  '1m': process.env.LEMON_VARIANT_1M || '1450299',
  '6m': process.env.LEMON_VARIANT_6M || '1450304',
  '1y': process.env.LEMON_VARIANT_1Y || '1450315',
};
const LEMON_CHECKOUT_URLS = {
  '1w': process.env.LEMON_CHECKOUT_URL_1W || '',
  '1m': process.env.LEMON_CHECKOUT_URL_1M || '',
  '6m': process.env.LEMON_CHECKOUT_URL_6M || '',
  '1y': process.env.LEMON_CHECKOUT_URL_1Y || '',
};
app.get('/api/checkout/redirect', (req, res) => {
  const tier = (req.query.tier || '6m').toLowerCase();
  const directUrl = (LEMON_CHECKOUT_URLS[tier] || LEMON_CHECKOUT_URLS['6m'] || '').trim();
  const variantId = LEMON_VARIANT_IDS[tier] || LEMON_VARIANT_IDS['6m'];
  const base = directUrl || `${LEMON_CHECKOUT_BASE}/${variantId}`;
  const u = new URL(base);
  const params = u.searchParams;
  const aff = (req.query.aff || '').trim();
  const email = (req.query.email || '').trim();
  if (aff) {
    params.set('aff', aff);
    params.set('checkout[custom][aff]', aff);
  }
  if (email) params.set('checkout[custom][email]', email);
  u.search = params.toString();
  res.redirect(302, u.toString());
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
