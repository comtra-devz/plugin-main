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
  validateCustomFileDsRequiresComponentInstances,
  validateActionPlanComponentSemanticFit,
  validateDesktopCreateStructure,
  isCustomDsSource,
} from './ds-loader.mjs';
import { runGenerateDualCallPipeline } from './generation-swarm.mjs';
import {
  buildPreflightFromPack,
  formatDesignIntelligenceForPrompt,
  inferFocusedScreenTypeWithPack,
  loadPatternsPayload,
} from './design-intelligence.mjs';
import { buildPromptScopedDsIndex } from './ds-context-retrieval.mjs';
import {
  generationSpecSearchText,
  generationSpecToPromptBlock,
  runGenerationSpecResolver,
} from './generation-spec-resolver.mjs';
import {
  prepCacheEnabled,
  prepCacheGet,
  prepCacheSet,
  prepCacheKeyDsPrompt,
  prepCacheKeySpec,
  prepCacheTtlMs,
} from './generate-prep-cache.mjs';
import { runKimiContentDefaultsEnrichment } from './kimi-content-enrichment.mjs';
import { buildDesignIntelligenceExecutorHints } from './design-intelligence-executor-hints.mjs';
import { withKimiConcurrencySlot } from './kimi-concurrency.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Literal FIGMA_RECONNECT lets the plugin detect and retry with inline file_json (email sign-in users). */
const MSG_FIGMA_API_TOKEN_MISSING =
  'Figma API token not stored (FIGMA_RECONNECT). Plugin runs still work when file JSON is sent inline. Use Sign in with Figma (OAuth) from Login only for server-side Figma fetch.';
const MSG_FIGMA_TOKEN_REJECTED_BY_API =
  'Figma rejected this token (FIGMA_RECONNECT). Sign in with Figma (OAuth) from Login again to refresh server access.';

function formatWizardSignalsBlock(wizardSignals) {
  if (!wizardSignals || typeof wizardSignals !== 'object' || Array.isArray(wizardSignals)) return '';
  const tone = typeof wizardSignals.tone_of_voice === 'string' ? wizardSignals.tone_of_voice.trim() : '';
  const kw = Array.isArray(wizardSignals.brand_voice_keywords)
    ? wizardSignals.brand_voice_keywords.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  if (!tone && !kw.length) return '';
  const slim = {
    ...(tone ? { tone_of_voice: tone } : {}),
    ...(kw.length ? { brand_voice_keywords: kw } : {}),
  };
  return [
    '',
    '[WIZARD_SIGNALS — DI v2; overrides generic pack defaults when present]',
    JSON.stringify(slim),
    '[END WIZARD_SIGNALS]',
  ].join('\n');
}

/** Estrae testo dalle override admin (JSON dashboard / `generate_tov_config`). */
function formatPromptOverridesForTovContext(po) {
  if (!po || typeof po !== 'object' || Array.isArray(po)) return '';
  const preferKeys = [
    'assistant_style_notes',
    'instructions',
    'tone_notes',
    'notes',
    'comtra_tov',
  ];
  for (const k of preferKeys) {
    if (typeof po[k] === 'string' && po[k].trim()) return po[k].trim();
  }
  try {
    const s = JSON.stringify(po);
    return s.length > 4000 ? `${s.slice(0, 4000)}…` : s;
  } catch {
    return '';
  }
}

const NEUTRAL_TOV_FALLBACK = [
  '',
  '[COMTRA_TOV — default neutral; no DS wizard tone and no admin dashboard overrides]',
  'Voice: professional, concise, product- and UI-first. Avoid hype and filler. Prefer clear visual hierarchy, legible defaults, and accessibility-aware layout decisions. Do not invent a brand voice beyond the design system and user prompt.',
  '[END COMTRA_TOV]',
].join('\n');

/**
 * Priorità: (1) segnali DS import (WIZARD_SIGNALS), (2) `generate_tov_config.prompt_overrides`, (3) fallback neutro.
 */
function resolveComtraTovResolution(wizardSignalsBlock, adminPromptOverrides) {
  if (wizardSignalsBlock && String(wizardSignalsBlock).trim()) {
    return { block: '', source: 'wizard_ds' };
  }
  const adminText = formatPromptOverridesForTovContext(adminPromptOverrides);
  if (adminText) {
    return {
      block: ['', '[COMTRA_TOV — admin/dashboard]', adminText, '[END COMTRA_TOV]'].join('\n'),
      source: 'admin',
    };
  }
  return { block: NEUTRAL_TOV_FALLBACK, source: 'neutral' };
}

const FIGMA_CLIENT_ID = process.env.FIGMA_CLIENT_ID;
const FIGMA_CLIENT_SECRET = process.env.FIGMA_CLIENT_SECRET;
const BASE_URL = (process.env.BASE_URL || 'http://localhost:3456').replace(/\/$/, '');
const JWT_SECRET = process.env.JWT_SECRET || 'comtra-dev-secret-change-in-prod';
/** DB URL: DATABASE_URL ha priorità (utile se POSTGRES_URL è bloccata dall'integrazione Vercel). */
const POSTGRES_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const FREE_TIER_CREDITS = 25;

function normalizeUserEmail(s) {
  if (s == null || typeof s !== 'string') return '';
  return s.trim().toLowerCase();
}

function isValidEmailFormat(s) {
  if (!s || typeof s !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function generateComtraUserId() {
  return `comtra_${randomBytes(12).toString('hex')}`;
}

/**
 * Figma OAuth: una sola riga `users` per account; merge su email; `users.id` resta la PK
 * (Figma classico) o comtra_* se creato prima con magic link.
 */
async function runFigmaOAuthUserPersistence(executor, figmaUser, tokenData, countryCode) {
  const emailNorm = normalizeUserEmail(figmaUser.email);
  const figmaId = String(figmaUser.id);
  const name = figmaUser.handle || figmaUser.email || 'User';
  const email = figmaUser.email || '';
  const img = figmaUser.img_url || null;
  const expiresInSec = Math.max(60, Number(tokenData.expires_in) || 90 * 24 * 3600);
  const expiresAt = new Date(Date.now() + expiresInSec * 1000);
  const refreshToken = tokenData.refresh_token || tokenData.access_token;
  let userId = null;
  if (emailNorm) {
    const r1 = await executor`SELECT id FROM users WHERE LOWER(BTRIM(email)) = ${emailNorm} LIMIT 1`;
    if (r1.rows.length) userId = r1.rows[0].id;
  }
  if (!userId) {
    const r2 = await executor`SELECT id FROM users WHERE id = ${figmaId} OR figma_user_id = ${figmaId} LIMIT 1`;
    if (r2.rows.length) userId = r2.rows[0].id;
  }
  if (!userId) {
    userId = figmaId;
  }
  let hasConflict = false;
  let conflictPayload = null;
  const rPrior = await executor`
    SELECT first_name, surname, profile_saved_at, figma_user_id, name
    FROM users WHERE id = ${userId} LIMIT 1
  `;
  if (rPrior.rows.length) {
    const p = rPrior.rows[0];
    const hadFigma = p.figma_user_id != null;
    if (!hadFigma && p.profile_saved_at) {
      const f = (p.first_name || '').trim();
      const s = (p.surname || '').trim();
      const manual = [f, s].filter(Boolean).join(' ').trim();
      if (manual && String(name).trim().toLowerCase() !== manual.toLowerCase()) {
        hasConflict = true;
        conflictPayload = { figma_handle: name, manual_first: f, manual_surname: s || null };
      }
    }
  }
  const conflictJson = conflictPayload ? JSON.stringify(conflictPayload) : null;
  await executor`
    INSERT INTO users (id, email, name, img_url, plan, credits_total, credits_used, total_xp, current_level, country_code, figma_user_id, updated_at)
    VALUES (${userId}, ${email}, ${name}, ${img}, 'FREE', ${FREE_TIER_CREDITS}, 0, 0, 1, ${countryCode}, ${figmaId}, NOW())
    ON CONFLICT (id) DO UPDATE SET
      email = COALESCE(NULLIF(EXCLUDED.email, ''), users.email),
      name = CASE WHEN ${hasConflict} THEN users.name ELSE EXCLUDED.name END,
      img_url = EXCLUDED.img_url,
      country_code = COALESCE(EXCLUDED.country_code, users.country_code),
      figma_user_id = ${figmaId},
      name_conflict = CASE WHEN ${hasConflict} THEN ${conflictJson}::jsonb ELSE NULL END,
      updated_at = NOW()
  `;
  await executor`
    INSERT INTO figma_tokens (user_id, access_token, refresh_token, expires_at, updated_at)
    VALUES (${userId}, ${tokenData.access_token}, ${refreshToken}, ${expiresAt.toISOString()}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
  `;
  return { userId, name, email, img };
}

async function resolveOrCreateUserByEmail(executor, email, countryCode) {
  const em = normalizeUserEmail(email);
  if (!em) throw new Error('empty_email');
  const r = await executor`
    SELECT id, email, name, img_url FROM users WHERE LOWER(BTRIM(email)) = ${em} LIMIT 1
  `;
  if (r.rows.length) {
    const row = r.rows[0];
    return {
      userId: String(row.id),
      name: row.name || em.split('@')[0] || 'User',
      email: row.email || em,
      img_url: row.img_url,
    };
  }
  const newId = generateComtraUserId();
  const localPart = em.split('@')[0] || 'User';
  try {
    await executor`
      INSERT INTO users (id, email, name, img_url, plan, credits_total, credits_used, total_xp, current_level, country_code, figma_user_id, updated_at)
      VALUES (${newId}, ${em}, ${localPart}, null, 'FREE', ${FREE_TIER_CREDITS}, 0, 0, 1, ${countryCode}, null, NOW())
    `;
  } catch (e) {
    // Race: due richieste in parallelo con la stessa email inesistente -> secondo INSERT urta unique su email
    if (e?.code === '23505' || /unique|duplicate key/i.test(String(e?.message || e))) {
      const r2 = await executor`
        SELECT id, email, name, img_url FROM users WHERE LOWER(BTRIM(email)) = ${em} LIMIT 1
      `;
      if (r2.rows.length) {
        const row = r2.rows[0];
        return {
          userId: String(row.id),
          name: row.name || em.split('@')[0] || 'User',
          email: row.email || em,
          img_url: row.img_url,
        };
      }
    }
    throw e;
  }
  return { userId: newId, name: localPart, email: em, img_url: null };
}

const MAGIC_LINK_FLOW_TTL_SEC = Math.min(
  3600,
  Math.max(300, Number(process.env.MAGIC_LINK_FLOW_TTL_SEC) || 900)
);
const MAGIC_LINK_JWT_TTL_SEC = 15 * 60;

/**
 * Template email magic link: HTML semantico, stili inline.
 * Stile allineato al plugin (bordo nero, ombra, giallo CTA, sfondo card bianco).
 * Logo: `MAGIC_LINK_EMAIL_LOGO_URL`. Banner: `MAGIC_LINK_EMAIL_BANNER_URL` (opz., più tardi).
 */
function buildComtraMagicLinkEmailHtml(signInUrl) {
  const raw = String(signInUrl);
  const hrefAttr = raw.replace(/&/g, '&amp;');
  const plainUrlDisplay = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const logoUrl = (process.env.MAGIC_LINK_EMAIL_LOGO_URL || 'https://comtra.dev/android-chrome-192x192.png')
    .toString()
    .trim();
  const bannerUrl = (process.env.MAGIC_LINK_EMAIL_BANNER_URL || '').toString().trim();
  const tagline = (process.env.MAGIC_LINK_EMAIL_TAGLINE || '').toString().trim();
  const logoBlock = logoUrl
    ? `<a href="https://comtra.dev" target="_blank" rel="noopener noreferrer" style="text-decoration:none;border:0;">
        <img src="${logoUrl.replace(/&/g, '&amp;')}" width="120" height="" alt="Comtra" style="display:block;max-width:120px;height:auto;border:0;outline:0;" />
      </a>`
    : `<p style="margin:0;font-size:1.5rem;font-weight:800;letter-spacing:-0.04em;color:#000;font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif;">Comtra</p>`;
  const taglineBlock = tagline
    ? `<p style="margin:8px 0 0 0;">
        <span style="display:inline-block;background:#000;color:#fff;padding:6px 10px;font-size:10px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;">${tagline.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>
      </p>`
    : '';
  const bannerBlock = bannerUrl
    ? `<div style="margin:0 0 16px 0;">
        <img src="${bannerUrl.replace(/&/g, '&amp;')}" width="456" height="" alt="" style="display:block;width:100%;max-width:100%;height:auto;border:0;border-bottom:2px solid #000;" />
      </div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <title>Comtra — sign in</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:#e8e8e8;">
  <div style="max-width:480px;margin:0 auto;padding:24px 12px;">
    <article
      style="border:2px solid #000;background:#fff;box-shadow:4px 4px 0 #000;padding:0;overflow:hidden;font-family:'Space Grotesk',system-ui,-apple-system,'Segoe UI',Arial,sans-serif;"
    >
      <header style="padding:28px 24px 12px 24px;">
        ${taglineBlock}
        ${logoBlock}
      </header>
      ${bannerBlock}
      <section style="padding:0 24px 20px 24px;font-size:15px;color:#000;line-height:1.5;">
        <p style="margin:0 0 12px 0;font-weight:700;">Sign in to the Comtra Figma plugin</p>
        <p style="margin:0 0 20px 0;">This link is valid for about <strong>15 minutes</strong>. If you did not request it, you can ignore this message.</p>
        <p style="margin:0;">
          <a
            href="${hrefAttr}"
            style="display:inline-block;background:#ffc900;color:#000 !important;padding:14px 28px;font-size:15px;font-weight:800;text-decoration:none;border:2px solid #000;box-shadow:4px 4px 0 #000;font-family:'Space Grotesk',system-ui,-apple-system,'Segoe UI',Arial,sans-serif;"
            >Open sign-in link</a
          >
        </p>
      </section>
      <section
        style="padding:0 24px 24px 24px;font-size:12px;color:#333;line-height:1.45;border-top:1px solid #e0e0e0;"
      >
        <p style="margin:16px 0 0 0;">If the button does not work, paste this in your browser:</p>
        <p style="margin:6px 0 0 0;word-break:break-all;color:#0000ee;font-size:12px;">${plainUrlDisplay}</p>
      </section>
      <footer style="padding:0 24px 24px 24px;font-size:10px;color:#666;">
        Cordiska &amp; Ben — Comtra
      </footer>
    </article>
  </div>
</body>
</html>`;
}

function magicLinkEmailSubject() {
  return (process.env.MAGIC_LINK_EMAIL_SUBJECT || 'Sign in to Comtra (Figma plugin)').toString();
}

/** From header for magic-link SMTP. Prefer explicit SMTP_FROM; else same mailbox as auth (required by many providers e.g. OVH). */
function smtpFromAddressForMagic() {
  return (
    process.env.SMTP_FROM ||
    process.env.MAIL_FROM ||
    process.env.SMTP_USER ||
    process.env.MAIL_USER ||
    ''
  ).trim();
}

async function sendMagicLinkEmailSmtp(toAddress, verifyUrl) {
  const { default: nodemailer } = await import('nodemailer');
  const from = smtpFromAddressForMagic();
  if (!from) {
    return { ok: false, reason: 'smtp_no_from' };
  }
  const port = Math.max(1, Number(process.env.SMTP_PORT) || 587);
  const secure = process.env.SMTP_SECURE === '1' || process.env.SMTP_SECURE === 'true' || port === 465;
  const host = (process.env.SMTP_HOST || process.env.MAIL_HOST || '').trim();
  if (!host) {
    return { ok: false, reason: 'smtp_no_host' };
  }
  const user = (process.env.SMTP_USER || process.env.MAIL_USER || '').trim();
  const pass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.MAIL_PASS || '').trim();
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user || pass ? { user: user || undefined, pass: pass || undefined } : undefined,
  });
  const html = buildComtraMagicLinkEmailHtml(verifyUrl);
  const text = `Comtra sign-in\n\nOpen this link (valid ~15 min):\n${verifyUrl}\n\nIf you did not request this, ignore this email.`;
  await transporter.sendMail({ from, to: toAddress, subject: magicLinkEmailSubject(), html, text });
  return { ok: true };
}

async function sendMagicLinkEmailResend(toAddress, verifyUrl) {
  const resend = process.env.RESEND_API_KEY;
  if (!resend) {
    return { ok: false, reason: 'no_resend' };
  }
  const from = process.env.RESEND_FROM || 'Comtra <onboarding@resend.dev>';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resend}` },
    body: JSON.stringify({
      from,
      to: [toAddress],
      subject: magicLinkEmailSubject(),
      html: buildComtraMagicLinkEmailHtml(verifyUrl),
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    console.error('Resend error', r.status, t);
    return { ok: false, reason: 'resend_http' };
  }
  return { ok: true };
}

function hasSmtpForMagic() {
  return Boolean((process.env.SMTP_HOST || process.env.MAIL_HOST) && smtpFromAddressForMagic());
}

async function sendMagicLinkEmail(toAddress, verifyUrl) {
  if (hasSmtpForMagic()) {
    try {
      return await sendMagicLinkEmailSmtp(toAddress, verifyUrl);
    } catch (e) {
      console.error('[magic-link] SMTP send failed', e);
      return { ok: false, reason: 'smtp_error' };
    }
  }
  if (process.env.RESEND_API_KEY) {
    return sendMagicLinkEmailResend(toAddress, verifyUrl);
  }
  if (process.env.MAGIC_LINK_DEV_LOG === '1') {
    console.log('[magic-link] (no SMTP/Resend) verify URL for ', toAddress, verifyUrl);
    return { ok: false, reason: 'dev_log' };
  }
  return { ok: false, reason: 'no_provider' };
}

async function createFlowStore() {
  if (process.env.REDIS_URL) {
    const { createClient } = await import('redis');
    const client = createClient({ url: process.env.REDIS_URL });
    client.on('error', () => {});
    await client.connect();
    return {
      async set(key, value) {
        const ex = key.startsWith('mshort:')
          ? Math.max(MAGIC_LINK_FLOW_TTL_SEC, MAGIC_LINK_JWT_TTL_SEC)
          : MAGIC_LINK_FLOW_TTL_SEC;
        await client.set(key, JSON.stringify(value), { EX: ex });
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
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key, X-Requested-With, Accept');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});
// JWT in header (no credentialed cookies) → `origin: *` is safe. Include PATCH for profile / Vercel.
// Figma plugin UI us `Origin: null` (data: URL); * risolve il preflight.
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key', 'X-Requested-With', 'Accept'],
  })
);
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
    try {
      await withTransaction(async (tx) => {
        const p = await runFigmaOAuthUserPersistence(tx, figmaUser, tokenData, countryCode);
        user.id = p.userId;
        user.name = p.name;
        user.email = p.email;
        user.img_url = p.img;
      });
      tokenSaved = true;
    } catch (err) {
      txError = err;
      console.error('OAuth callback: users+figma_tokens transaction FAILED —', err?.message || err);
    }
  } else if (POSTGRES_URL) {
    console.warn('OAuth callback: withTransaction not available, falling back to non-atomic save');
    try {
      const p = await runFigmaOAuthUserPersistence(dbSql, figmaUser, tokenData, countryCode);
      user.id = p.userId;
      user.name = p.name;
      user.email = p.email;
      user.img_url = p.img;
      tokenSaved = true;
    } catch (err) {
      txError = err;
      console.error('OAuth callback: fallback save failed —', err?.message || err);
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
      await loadUserForLoginResponse(dbSql, user);
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

/**
 * Richiede link al login: stesso meccanismo readKey + /auth/figma/poll.
 * Dopo run migration 017 (figma_user_id, unique email).
 */
app.post('/auth/magic-link/request', async (req, res) => {
  if (!POSTGRES_URL) {
    return res.status(503).json({ error: 'database_unavailable' });
  }
  const email = typeof req.body?.email === 'string' ? req.body.email : '';
  if (!isValidEmailFormat(email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }
  const em = normalizeUserEmail(email);
  if (!em) {
    return res.status(400).json({ error: 'invalid_email' });
  }
  const resendOk =
    hasSmtpForMagic() || Boolean(process.env.RESEND_API_KEY) || process.env.MAGIC_LINK_DEV_LOG === '1';
  if (!resendOk) {
    return res.status(503).json({
      error: 'email_not_configured',
      message:
        'Set SMTP (SMTP_HOST and sender: SMTP_FROM or SMTP_USER/MAIL_USER) or RESEND_API_KEY, or MAGIC_LINK_DEV_LOG=1 for local testing.',
    });
  }
  const store = await getFlowStore();
  const readKey = randomBytes(16).toString('hex');
  await store.set(readKey, null);
  const token = jwt.sign({ typ: 'ml', readKey, email: em }, JWT_SECRET, { expiresIn: '15m' });
  const shortId = randomBytes(10)
    .toString('base64url')
    .replace(/=+$/g, '');
  const shortTokenPayload = { token, _mlShortExp: Date.now() + MAGIC_LINK_JWT_TTL_SEC * 1000 };
  await store.set(`mshort:${shortId}`, shortTokenPayload);
  const signInUrl = `${BASE_URL}/auth/m/${shortId}`;
  const send = await sendMagicLinkEmail(em, signInUrl);
  if (!send.ok && process.env.MAGIC_LINK_DEV_LOG !== '1') {
    return res.status(503).json({ error: 'email_send_failed' });
  }
  res.json({
    readKey,
    ok: true,
    ...(process.env.MAGIC_LINK_DEV_LOG === '1' ? { devLink: signInUrl } : {}),
  });
});

/**
 * Short sign-in link: resolves to the same flow as /auth/magic/verify?token=…
 * (email CTA and fallback line use this URL; token stays server-side in Redis / memory until redirect).
 */
app.get('/auth/m/:id', async (req, res) => {
  const id = (req.params?.id || req.query?.id || '').toString();
  if (!id || !/^[A-Za-z0-9_-]{10,50}$/.test(id)) {
    return res
      .status(400)
      .send(
        getMagicLinkVerifyErrorPageHtml({
          title: 'Invalid link',
          message: 'This sign-in link is not valid. Request a new one from the Comtra plugin in Figma.',
        })
      );
  }
  const store = await getFlowStore();
  const key = `mshort:${id}`;
  const entry = await store.get(key);
  if (entry == null || typeof entry !== 'object') {
    return res
      .status(400)
      .send(
        getMagicLinkVerifyErrorPageHtml({
          title: 'Link expired',
          message: 'This sign-in link is no longer valid. Open the plugin, enter your email again, and we’ll send a new link.',
        })
      );
  }
  if (entry._mlShortExp && Date.now() > Number(entry._mlShortExp)) {
    return res
      .status(400)
      .send(
        getMagicLinkVerifyErrorPageHtml({
          title: 'Link expired',
          message: 'This sign-in link is no longer valid. Open the plugin, enter your email again, and we’ll send a new link.',
        })
      );
  }
  const token = entry.token;
  if (!token || typeof token !== 'string') {
    return res
      .status(400)
      .send(
        getMagicLinkVerifyErrorPageHtml({
          title: 'Invalid link',
          message: 'This sign-in link is not valid. Request a new one from the Comtra plugin in Figma.',
        })
      );
  }
  return res.redirect(302, `${BASE_URL}/auth/magic/verify?token=${encodeURIComponent(token)}`);
});

app.get('/auth/magic/verify', async (req, res) => {
  const countryCode = (req.headers['x-vercel-ip-country'] || '').toString().toUpperCase().trim().slice(0, 2) || null;
  const qToken = (req.query?.token || '').toString();
  if (!qToken) {
    return res
      .status(400)
      .send(
        getMagicLinkVerifyErrorPageHtml({
          title: 'Invalid link',
          message: 'This link is missing a token. Request a new sign-in link from the Comtra plugin in Figma.',
        })
      );
  }
  let payload;
  try {
    payload = jwt.verify(qToken, JWT_SECRET);
  } catch {
    return res
      .status(400)
      .send(
        getMagicLinkVerifyErrorPageHtml({
          title: 'Link expired',
          message: 'This sign-in link is no longer valid. Open the plugin, enter your email again, and we’ll send a new link.',
        })
      );
  }
  if (payload?.typ !== 'ml' || !payload?.readKey || !payload?.email) {
    return res
      .status(400)
      .send(
        getMagicLinkVerifyErrorPageHtml({
          title: 'Invalid link',
          message: 'This link is not valid. Use the new link we sent to your email, or request a new one from the plugin.',
        })
      );
  }
  const readKey = String(payload.readKey);
  const em = String(payload.email);
  if (!POSTGRES_URL) {
    return res
      .status(503)
      .send(
        getMagicLinkVerifyErrorPageHtml({
          title: 'Service unavailable',
          message: 'Comtra is not able to sign you in right now. Try again later.',
        })
      );
  }
  const store = await getFlowStore();
  const flowState = await store.get(readKey);
  if (flowState === undefined) {
    return res
      .status(400)
      .send(
        getMagicLinkVerifyErrorPageHtml({
          title: 'Session expired',
          message: 'This sign-in request timed out. Open the Comtra plugin, enter your email, and request a new link.',
        })
      );
  }
  if (flowState && typeof flowState === 'object' && flowState.user) {
    return res
      .status(200)
      .send(
        getComtraPostLoginHtml({ variant: 'magic' })
      );
  }
  let tokenSaved = false;
  let u;
  try {
    if (withTransaction) {
      await withTransaction(async (tx) => {
        u = await resolveOrCreateUserByEmail(tx, em, countryCode);
      });
    } else {
      u = await resolveOrCreateUserByEmail(dbSql, em, countryCode);
    }
    tokenSaved = true;
  } catch (e) {
    console.error('magic/verify: user upsert failed', e);
    return res
      .status(500)
      .send(
        getMagicLinkVerifyErrorPageHtml({
          title: 'Could not sign you in',
          message: 'Something went wrong on our side. Please try again from the plugin.',
        })
      );
  }
  if (!u) {
    return res
      .status(500)
      .send(
        getMagicLinkVerifyErrorPageHtml({
          title: 'Error',
          message: 'Please try again from the Comtra plugin in Figma.',
        })
      );
  }
  const user = {
    id: u.userId,
    name: u.name,
    email: u.email,
    img_url: u.img_url,
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
  if (tokenSaved) {
    try {
      await loadUserForLoginResponse(dbSql, user);
    } catch (e) {
      console.error('magic/verify: loadUserForLoginResponse', e);
    }
  }
  const authToken = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '365d' });
  user.authToken = authToken;
  await store.set(readKey, { user, tokenSaved: true });
  if (process.env.MAGIC_LINK_DEV_LOG === '1') {
    console.log('[magic/verify] session ready for', user.id, user.email);
  }
  return res.status(200).send(getComtraPostLoginHtml({ variant: 'magic' }));
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

/** Pagina “successo” in browser: brand Comtra + CTA apre app Figma (schema URL `figma://`). */
function getComtraPostLoginHtml({ variant = 'figma' } = {}) {
  const isMagic = variant === 'magic';
  const title = isMagic ? "You're in — Comtra" : 'Login completato – Comtra';
  const h1 = isMagic ? "You're in!" : 'Login completato';
  const lead = isMagic
    ? "Sign-in is done. Figma with the Comtra plugin should pick you up in a moment. If the plugin doesn’t update, use the button below to open the Figma app."
    : "OAuth completed. The plugin in Figma should connect shortly. You can also open the Figma app with the button below.";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Tiny5&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Space Grotesk', sans-serif; margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #ff90e8; padding: 24px; }
    .card { max-width: 420px; width: 100%; border: 3px solid #000; background: #fff; box-shadow: 8px 8px 0 #000; padding: 2rem; text-align: center; }
    .badge { display: inline-block; background: #000; color: #fff; padding: 6px 10px; font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 1rem; }
    h1 { font-family: 'Tiny5', sans-serif; font-size: 1.75rem; font-weight: 700; margin: 0 0 0.75rem; color: #000; text-transform: uppercase; letter-spacing: 0.05em; }
    p { font-size: 0.95rem; color: #000; margin: 0 0 1.25rem; font-weight: 500; line-height: 1.5; }
    .btn {
      display: inline-block; background: #000; color: #fff !important; font-weight: 800; text-decoration: none;
      padding: 14px 24px; border: 2px solid #000; box-shadow: 4px 4px 0 #000; font-size: 0.95rem; cursor: pointer; font-family: inherit;
      text-transform: uppercase; letter-spacing: 0.04em; user-select: none;
      transition: background-color 0.12s ease, color 0.12s ease, box-shadow 0.1s ease, transform 0.1s ease;
    }
    .btn:hover { background: #262626; color: #fff !important; }
    .btn:focus { outline: none; }
    .btn:focus-visible { outline: 2px solid #000; outline-offset: 3px; }
    .btn:active {
      background: #000; color: #fff !important;
      transform: translate(2px, 2px);
      box-shadow: 2px 2px 0 #000;
    }
    .hint { font-size: 0.75rem; color: #333; margin-top: 1.25rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Design System AI</div>
    <h1>${h1}</h1>
    <p>${lead}</p>
    <p><a class="btn" id="comtra-cta" href="figma://">Start rocking in Figma</a></p>
    <p class="hint">This tries to open the Figma app. You can return to the window where the plugin is open.</p>
  </div>
  <script>
    function goFigma() { try { window.location.href = 'figma://'; } catch (e) {} }
    var cta = document.getElementById('comtra-cta');
    if (cta) cta.addEventListener('click', function (e) { e.preventDefault(); goFigma(); });
    setTimeout(goFigma, 2200);
  </script>
</body>
</html>`;
}

function getReturnToFigmaHtml() {
  return getComtraPostLoginHtml({ variant: 'figma' });
}

function getMagicLinkVerifyErrorPageHtml(
  { title, message } = { title: 'Link issue', message: 'Something went wrong. Request a new link from the plugin.' }
) {
  const t = (title || 'Link issue').replace(/</g, '&lt;');
  const m = (message || '').replace(/</g, '&lt;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t} – Comtra</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Tiny5&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Space Grotesk', sans-serif; margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #e8e8e8; padding: 24px; }
    .card { max-width: 420px; width: 100%; border: 3px solid #000; background: #fff; box-shadow: 8px 8px 0 #000; padding: 2rem; text-align: center; }
    /* Tiny5: solo maiuscole + tracking per leggibilità (pixel font) */
    h1 { font-family: 'Tiny5', sans-serif; font-size: 1.35rem; font-weight: 700; margin: 0 0 0.75rem; color: #000; text-transform: uppercase; letter-spacing: 0.08em; line-height: 1.25; }
    p { font-size: 0.95rem; color: #000; margin: 0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${t}</h1>
    <p>${m}</p>
  </div>
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

/** First name + surname in DB + flags for plugin (Personal Details, badge). */
function attachUserProfileFromRow(user, row) {
  if (!row) return;
  if (row.name) user.name = String(row.name);
  const figma = row.figma_user_id != null;
  const first = (row.first_name && String(row.first_name).trim()) || null;
  const sur = (row.surname && String(row.surname).trim()) || null;
  const saved = row.profile_saved_at != null;
  const conflict = row.name_conflict && typeof row.name_conflict === 'object' ? row.name_conflict : null;
  if (row.figma_user_id !== undefined) user.figma_user_id = row.figma_user_id;
  user.first_name = first;
  user.surname = sur;
  user.profile_saved_at = row.profile_saved_at || null;
  user.name_conflict = conflict;
  user.profile_locked = figma;
  const needsNameSave = !figma && !saved;
  const needsConflictAction = Boolean(conflict);
  user.show_profile_badge = needsNameSave || needsConflictAction;
}

app.get('/api/user/profile', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  if (!POSTGRES_URL) return res.status(503).json({ error: 'database_unavailable' });
  try {
    const r = await dbSql`
      SELECT email, name, first_name, surname, figma_user_id, profile_saved_at, name_conflict, img_url
      FROM users WHERE id = ${userId} LIMIT 1
    `;
    if (r.rows.length === 0) return res.status(404).json({ error: 'not_found' });
    const row = r.rows[0];
    const u = { id: userId, email: row.email, name: row.name };
    attachUserProfileFromRow(u, row);
    res.json({ ok: true, profile: u });
  } catch (e) {
    console.error('GET /api/user/profile', e);
    res.status(500).json({ error: 'server_error' });
  }
});

app.patch('/api/user/profile', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  if (!POSTGRES_URL) return res.status(503).json({ error: 'database_unavailable' });
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const firstIn = body.first_name != null ? String(body.first_name).trim() : '';
  const surIn = body.surname != null ? String(body.surname).trim() : '';
  if (!firstIn) {
    return res.status(400).json({ error: 'first_name_required' });
  }
  try {
    const lock = await dbSql`SELECT figma_user_id FROM users WHERE id = ${userId} LIMIT 1`;
    if (lock.rows.length === 0) return res.status(404).json({ error: 'not_found' });
    if (lock.rows[0].figma_user_id != null) {
      return res.status(403).json({ error: 'profile_locked', message: 'Name is managed from your Figma account.' });
    }
    const fullName = surIn ? `${firstIn} ${surIn}` : firstIn;
    const r2 = await dbSql`
      UPDATE users
      SET
        first_name = ${firstIn},
        surname = ${surIn || null},
        name = ${fullName},
        profile_saved_at = NOW(),
        updated_at = NOW()
      WHERE id = ${userId} AND figma_user_id IS NULL
      RETURNING email, name, first_name, surname, figma_user_id, profile_saved_at, name_conflict, img_url
    `;
    if (r2.rows.length === 0) {
      return res.status(403).json({ error: 'profile_locked' });
    }
    const row = r2.rows[0];
    const u = { id: userId, email: row.email, name: row.name };
    attachUserProfileFromRow(u, row);
    res.json({ ok: true, profile: u });
  } catch (e) {
    console.error('PATCH /api/user/profile', e);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/api/user/profile/resolve-name-conflict', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  if (!POSTGRES_URL) return res.status(503).json({ error: 'database_unavailable' });
  const use = (req.body && req.body.use) === 'figma' ? 'figma' : (req.body && req.body.use) === 'keep' ? 'keep' : null;
  if (!use) {
    return res.status(400).json({ error: 'invalid_body', message: 'use must be "figma" or "keep"' });
  }
  try {
    const r0 = await dbSql`
      SELECT name_conflict, name, first_name, surname, email, figma_user_id, img_url
      FROM users WHERE id = ${userId} LIMIT 1
    `;
    if (r0.rows.length === 0) return res.status(404).json({ error: 'not_found' });
    const b = r0.rows[0];
    if (b.figma_user_id == null) {
      return res.status(400).json({ error: 'no_conflict' });
    }
    const c = b.name_conflict && typeof b.name_conflict === 'object' ? b.name_conflict : null;
    if (!c) {
      return res.status(400).json({ error: 'no_pending_conflict' });
    }
    if (use === 'figma') {
      const h = (c.figma_handle && String(c.figma_handle).trim()) || b.name;
      const r1 = await dbSql`
        UPDATE users
        SET
          name = ${h},
          first_name = ${h},
          surname = NULL,
          name_conflict = NULL,
          profile_saved_at = COALESCE(profile_saved_at, NOW()),
          updated_at = NOW()
        WHERE id = ${userId}
        RETURNING email, name, first_name, surname, figma_user_id, profile_saved_at, name_conflict, img_url
      `;
      const row = r1.rows[0];
      const u = { id: userId, email: row.email, name: row.name };
      attachUserProfileFromRow(u, row);
      return res.json({ ok: true, profile: u });
    }
    const f = (c.manual_first && String(c.manual_first).trim()) || '';
    const s = (c.manual_surname && String(c.manual_surname).trim()) || '';
    const full = [f, s].filter(Boolean).join(' ').trim() || f;
    const r2 = await dbSql`
      UPDATE users
      SET
        name = ${full},
        name_conflict = NULL,
        updated_at = NOW()
      WHERE id = ${userId}
      RETURNING email, name, first_name, surname, figma_user_id, profile_saved_at, name_conflict, img_url
    `;
    const row = r2.rows[0];
    const u = { id: userId, email: row.email, name: row.name };
    attachUserProfileFromRow(u, row);
    res.json({ ok: true, profile: u });
  } catch (e) {
    console.error('POST /api/user/profile/resolve-name-conflict', e);
    res.status(500).json({ error: 'server_error' });
  }
});

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

/** Headers for Figma REST: OAuth bearer vs Personal Access Token (magic-link parity path). */
function figmaRestHeaders(auth) {
  if (!auth || !auth.token) return {};
  if (auth.kind === 'pat') {
    return { 'X-Figma-Token': auth.token };
  }
  return { Authorization: `Bearer ${auth.token}` };
}

/**
 * Valid Figma auth for REST: OAuth (refresh when expired) or PAT (no refresh).
 * Returns null if no row or unusable.
 */
async function getFigmaAuthForUser(userId) {
  let r;
  try {
    r = await dbSql`
      SELECT access_token, refresh_token, expires_at, COALESCE(token_kind, 'oauth') AS token_kind
      FROM figma_tokens WHERE user_id = ${userId} LIMIT 1
    `;
  } catch (e) {
    if (/column|does not exist/i.test(String(e))) {
      r = await dbSql`SELECT access_token, refresh_token, expires_at FROM figma_tokens WHERE user_id = ${userId} LIMIT 1`;
    } else throw e;
  }
  if (r.rows.length === 0) return null;
  const row = r.rows[0];
  const kind = String(row.token_kind || 'oauth').toLowerCase() === 'pat' ? 'pat' : 'oauth';
  if (kind === 'pat') {
    return { token: row.access_token, kind: 'pat' };
  }
  const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;
  if (expiresAt && expiresAt.getTime() > now.getTime() + bufferMs) {
    return { token: row.access_token, kind: 'oauth' };
  }
  if (!FIGMA_CLIENT_ID || !FIGMA_CLIENT_SECRET) return { token: row.access_token, kind: 'oauth' };
  const rt = row.refresh_token != null ? String(row.refresh_token).trim() : '';
  if (!rt) {
    return expiresAt && expiresAt.getTime() > now.getTime()
      ? { token: row.access_token, kind: 'oauth' }
      : null;
  }
  const refreshRes = await fetch('https://api.figma.com/v1/oauth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${FIGMA_CLIENT_ID}:${FIGMA_CLIENT_SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({ refresh_token: rt }),
  });
  if (!refreshRes.ok) {
    console.error('Figma refresh token failed', await refreshRes.text());
    return expiresAt && expiresAt.getTime() > now.getTime()
      ? { token: row.access_token, kind: 'oauth' }
      : null;
  }
  const data = await refreshRes.json();
  const newExpiresIn = Math.max(60, Number(data.expires_in) || 90 * 24 * 3600);
  const newExpiresAt = new Date(Date.now() + newExpiresIn * 1000);
  await dbSql`
    UPDATE figma_tokens SET access_token = ${data.access_token}, expires_at = ${newExpiresAt.toISOString()}, updated_at = NOW() WHERE user_id = ${userId}
  `;
  return { token: data.access_token, kind: 'oauth' };
}

/** @deprecated Use getFigmaAuthForUser — returns raw token string for legacy call sites. */
async function getFigmaAccessToken(sql, userId) {
  const auth = await getFigmaAuthForUser(userId);
  return auth ? auth.token : null;
}

/** Force refresh Figma token (e.g. after 403 from Figma). Returns new access_token or null. Use to recover without asking user to re-login. */
async function forceRefreshFigmaToken(userId) {
  let r;
  try {
    r = await dbSql`
      SELECT refresh_token, COALESCE(token_kind, 'oauth') AS token_kind FROM figma_tokens WHERE user_id = ${userId} LIMIT 1
    `;
  } catch (e) {
    if (/column|does not exist/i.test(String(e))) {
      r = await dbSql`SELECT refresh_token FROM figma_tokens WHERE user_id = ${userId} LIMIT 1`;
    } else throw e;
  }
  if (r.rows.length === 0) {
    console.warn('forceRefreshFigmaToken: no row in figma_tokens for user_id=', userId, '(user must complete "Riconnetti Figma" once)');
    return null;
  }
  if (String(r.rows[0].token_kind || 'oauth').toLowerCase() === 'pat') return null;
  const rt = r.rows[0].refresh_token != null ? String(r.rows[0].refresh_token).trim() : '';
  if (!rt) return null;
  if (!FIGMA_CLIENT_ID || !FIGMA_CLIENT_SECRET) return null;
  const refreshRes = await fetch('https://api.figma.com/v1/oauth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${FIGMA_CLIENT_ID}:${FIGMA_CLIENT_SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({ refresh_token: rt }),
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
  generate_refinement_light: 10,
  generate_refinement_medium: 15,
  generate_refinement_heavy: 20,
  generate_refinement_xl: 25,
  enhance_plus: 8,
  wireframe_modified: 20,
  proto_scan: 40,
  proto_audit: 40,
  a11y_check: 35,
  a11y_audit: 35,
  ux_audit: 45,
  audit_auto_fix: 10,
  audit_auto_fix_all: 15,
  sync_storybook: 25,
  sync_github: 25,
  sync_bitbucket: 25,
  sync: 25,
  comp_sync: 25,
  scan_sync: 25,
  sync_fix: 25,
  code_gen_ai: 40,
  code_gen_free: 2,
  token_css: 2,
  token_json: 2,
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
  /** Kimi mini-agent: structured prompt assist (cost tunable via env). */
  if (actionType === 'enhance_plus') {
    const n = Number(process.env.ENHANCE_PLUS_CREDITS);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 1;
  }
  /**
   * §6 Conversational UX — post-first-generate refinement chips (preview only).
   * Actual charge remains action_plan.metadata.estimated_credits after successful generate.
   */
  if (actionType === 'generate_refinement_light') return 1;
  if (actionType === 'generate_refinement_medium') return 2;
  if (actionType === 'generate_refinement_heavy') return 3;
  if (actionType === 'generate_refinement_xl') {
    const n = Number(process.env.GENERATE_REFINEMENT_XL_CREDITS);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 4;
  }
  /** DS import wizard: Kimi flavor text only — no credits (see /api/agents/import-narration). */
  if (actionType === 'import_narration') return 0;
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
    let lockedUntilRenewal = false;
    try {
      const u = await dbSql`
        SELECT level_discount_locked_until_renewal
        FROM users
        WHERE id = ${userId}
        LIMIT 1
      `;
      lockedUntilRenewal = Boolean(u.rows?.[0]?.level_discount_locked_until_renewal);
    } catch (_) {
      lockedUntilRenewal = false;
    }
    if (lockedUntilRenewal) {
      return res.json({ code: null, level: null, percent: null, locked_until_renewal: true });
    }
    const r = await dbSql`
      SELECT level, code FROM user_level_discounts WHERE user_id = ${userId} LIMIT 1
    `;
    const row = r.rows[0];
    if (!row) return res.json({ code: null, level: null, percent: null, locked_until_renewal: false });
    const percent = discountPercentForLevel(row.level);
    return res.json({ code: row.code, level: Number(row.level), percent, locked_until_renewal: false });
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
    let levelDiscountLockedUntilRenewal = false;
    try {
      const ru = await dbSql`
        SELECT level_discount_locked_until_renewal
        FROM users
        WHERE id = ${userId}
        LIMIT 1
      `;
      levelDiscountLockedUntilRenewal = Boolean(ru.rows?.[0]?.level_discount_locked_until_renewal);
    } catch (_) {
      levelDiscountLockedUntilRenewal = false;
    }
    if (!levelDiscountLockedUntilRenewal && POSTGRES_URL && isLevelWithDiscount(currentLevel)) {
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
      level_discount_locked_until_renewal: levelDiscountLockedUntilRenewal,
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
    // Free actions still count for progression/trophies.
    const xpEarned = XP_BY_ACTION[actionType] ?? 0;
    if (xpEarned > 0) {
      const u = await dbSql`SELECT total_xp FROM users WHERE id = ${userId} LIMIT 1`;
      if (u.rows.length > 0) {
        const oldXp = Math.max(0, Number(u.rows[0].total_xp) || 0);
        const totalXp = oldXp + xpEarned;
        const info = getLevelInfo(totalXp);
        await dbSql`
          UPDATE users
          SET total_xp = ${totalXp}, current_level = ${info.level}, updated_at = NOW()
          WHERE id = ${userId}
        `;
        await dbSql`
          INSERT INTO xp_transactions (user_id, action_type, xp_earned)
          VALUES (${userId}, ${actionType}, ${xpEarned})
        `;
      }
    }
    try {
      await checkTrophies(dbSql, userId);
    } catch (e) {
      console.error('checkTrophies log-free', e);
    }
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
    let auth = await getFigmaAuthForUser(userId);
    if (!auth) {
      await forceRefreshFigmaToken(userId);
      auth = await getFigmaAuthForUser(userId);
    }
    if (!auth) {
      console.warn('POST /api/figma/file: no token for user_id=', userId, '(no row, expired, or refresh failed)');
      return res.status(403).json({
        error: MSG_FIGMA_API_TOKEN_MISSING,
        code: 'FIGMA_RECONNECT',
      });
    }
    const url = new URL(`https://api.figma.com/v1/files/${fileKey}`);
    if (depth != null) url.searchParams.set('depth', String(depth));
    if (idsParam) url.searchParams.set('ids', idsParam);

    let figmaRes = await fetch(url.toString(), {
      headers: figmaRestHeaders(auth),
    });
    if (figmaRes.status === 403 && auth.kind !== 'pat') {
      await forceRefreshFigmaToken(userId);
      const auth2 = await getFigmaAuthForUser(userId);
      if (auth2) {
        auth = auth2;
        figmaRes = await fetch(url.toString(), {
          headers: figmaRestHeaders(auth),
        });
      }
    }
    if (figmaRes.status === 403) {
      console.warn('POST /api/figma/file: Figma 403 anche dopo refresh per user_id=', userId);
      return res.status(403).json({
        error: MSG_FIGMA_TOKEN_REJECTED_BY_API,
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
async function figmaTokenValidForApi(figmaAuth) {
  if (!figmaAuth || !figmaAuth.token) return false;
  const meRes = await fetch('https://api.figma.com/v1/me', {
    headers: figmaRestHeaders(figmaAuth),
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
    const fa = await getFigmaAuthForUser(userId);
    if (!fa) return res.json({ ok: false, hasToken: false, reason: 'expired_or_invalid' });
    const validWithFigma = await figmaTokenValidForApi(fa);
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
    const fa = await getFigmaAuthForUser(userId);
    if (!fa) return res.json({ ok: false, hasToken: false, reason: 'expired_or_invalid' });
    const validWithFigma = await figmaTokenValidForApi(fa);
    if (!validWithFigma) return res.json({ ok: false, hasToken: false, reason: 'figma_rejected' });
    return res.json({ ok: true, hasToken: true });
  } catch (err) {
    console.error('POST /api/figma/token-status', err);
    return res.status(500).json({ ok: false, hasToken: false, reason: 'error' });
  }
});


// --- Save Figma Personal Access Token (magic / email users): same REST access as OAuth for audits
app.post('/api/figma/personal-access-token', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!POSTGRES_URL) return res.status(503).json({ error: 'Database not configured' });
  const raw = String(req.body?.token || req.body?.access_token || '').trim();
  if (!raw) return res.status(400).json({ error: 'token required' });
  const meRes = await fetch('https://api.figma.com/v1/me', {
    headers: { 'X-Figma-Token': raw },
  });
  if (!meRes.ok) {
    const t = await meRes.text();
    console.warn('PAT /me failed', meRes.status, t.slice(0, 200));
    return res.status(400).json({ error: 'Figma rejected this token. Check it is a valid Personal Access Token with file read access.' });
  }
  const me = await meRes.json();
  const handle = me && me.handle != null ? String(me.handle) : '';
  const expiresAt = new Date('2099-01-01T00:00:00.000Z');
  const emptyRefresh = '';
  try {
    await dbSql`
      INSERT INTO figma_tokens (user_id, access_token, refresh_token, expires_at, updated_at, token_kind)
      VALUES (${userId}, ${raw}, ${emptyRefresh}, ${expiresAt.toISOString()}, NOW(), 'pat')
      ON CONFLICT (user_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW(),
        token_kind = 'pat'
    `;
  } catch (e) {
    if (/token_kind|column|does not exist/i.test(String(e))) {
      await dbSql`
        INSERT INTO figma_tokens (user_id, access_token, refresh_token, expires_at, updated_at)
        VALUES (${userId}, ${raw}, ${emptyRefresh}, ${expiresAt.toISOString()}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          expires_at = EXCLUDED.expires_at,
          updated_at = NOW()
      `;
    } else {
      console.error('POST /api/figma/personal-access-token', e);
      return res.status(500).json({ error: 'Could not save token' });
    }
  }
  return res.json({ ok: true, figma_handle: handle, has_figma_rest_token: true });
});

// --- DS Audit agent (Kimi): file_key → Figma JSON → Kimi → issues
const KIMI_API_KEY = process.env.KIMI_API_KEY;
const DEFAULT_KIMI_MODEL = 'kimi-k2.6';
const KIMI_MODEL = process.env.KIMI_MODEL || DEFAULT_KIMI_MODEL;

function isKimiFixedSamplingModel(model) {
  const s = String(model || '').trim();
  // Moonshot Kimi k2.5+ rejects custom sampling params on some endpoints/accounts.
  return /kimi[-_]?k2\.[5-9]/i.test(s);
}

function buildKimiChatRequestPayload({ model = KIMI_MODEL, messages, maxTokens = 4096 }) {
  const resolvedModel = String(model || KIMI_MODEL || '').trim() || DEFAULT_KIMI_MODEL;
  const payload = {
    model: resolvedModel,
    messages,
    // Moonshot chat completions expects max_tokens; older code used OpenAI-style max_completion_tokens.
    max_tokens: maxTokens,
  };
  if (!isKimiFixedSamplingModel(resolvedModel)) {
    payload.temperature = 0.3;
  }
  return payload;
}

/**
 * Modello per messaggi multimodali (image_url in content).
 * Moonshot elenca esplicitamente modelli vision: moonshot-v1-*-vision-preview, kimi-k2.5, ecc.
 * Kimi K2.6 supports multimodal input; keep KIMI_VISION_MODEL override for account/provider differences.
 * @see https://platform.moonshot.ai/docs/guide/use-kimi-vision-model
 */
const KIMI_VISION_MODEL = process.env.KIMI_VISION_MODEL || process.env.KIMI_MODEL || DEFAULT_KIMI_MODEL;
/** Plugin Generate A/B (50/50): Moonshot chat model slug per arm — set B to alternate flagship (e.g. Kimi 2.6) via env. */
const KIMI_GENERATE_MODEL_A =
  process.env.KIMI_GENERATE_MODEL_A || process.env.KIMI_MODEL_PRIMARY || process.env.KIMI_MODEL || DEFAULT_KIMI_MODEL;
const KIMI_GENERATE_MODEL_B =
  process.env.KIMI_GENERATE_MODEL_B ||
  process.env.KIMI_MODEL_SECONDARY ||
  process.env.KIMI_MODEL_ALT ||
  process.env.KIMI_MODEL_B ||
  '';
const KIMI_GENERATION_SPEC_MODEL =
  process.env.KIMI_GENERATION_SPEC_MODEL ||
  process.env.KIMI_GENERATE_SPEC_MODEL ||
  process.env.KIMI_GENERATE_MODEL_A ||
  process.env.KIMI_MODEL_PRIMARY ||
  process.env.KIMI_MODEL ||
  DEFAULT_KIMI_MODEL;

function resolveGenerateChatModel(abVariant) {
  const primary = String(KIMI_GENERATE_MODEL_A || '').trim() || DEFAULT_KIMI_MODEL;
  const secondaryRaw = String(KIMI_GENERATE_MODEL_B || '').trim();
  const secondary = secondaryRaw || primary;
  return abVariant === 'B' ? secondary : primary;
}

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

/** Moonshot may return 429 or 400 with TPM/org rate-limit wording (not always 429). */
function kimiResponseLooksRateLimited(status, bodyText) {
  const st = Number(status);
  const t = String(bodyText || '').toLowerCase();
  if (st === 429) return true;
  if (/\btpm\b|tokens per minute|rate.?limit|too many requests|throttl/.test(t)) return true;
  if (st === 400 && (/request reached/.test(t) || /organization.*limit/.test(t) || /\borg-[a-z0-9]+\b.*\bproj-/.test(t))) {
    return true;
  }
  return false;
}

function kimiRateLimitRetryAfterSec() {
  const n = Number(process.env.KIMI_RATE_LIMIT_RETRY_AFTER_SEC);
  return Number.isFinite(n) && n >= 10 && n <= 300 ? Math.floor(n) : 65;
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

function clampNumber(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function walkFigmaNodes(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  if (Array.isArray(node.children)) {
    for (const c of node.children) walkFigmaNodes(c, visit);
  }
}

function buildDsSpecSnapshot(fileJson) {
  const doc = fileJson?.document;
  const components = fileJson?.components && typeof fileJson.components === 'object' ? fileJson.components : {};
  const componentSets =
    fileJson?.componentSets && typeof fileJson.componentSets === 'object' ? fileJson.componentSets : {};
  const compIds = Object.keys(components);
  const componentCount = compIds.length;
  const componentSetCount = Object.keys(componentSets).length;

  const byComponentInstanceCount = new Map();
  let totalNodeCount = 0;
  let tokenBoundNodeCount = 0;
  let textNodeCount = 0;
  let textStyleBoundCount = 0;

  if (doc) {
    walkFigmaNodes(doc, (n) => {
      totalNodeCount += 1;
      if (n.type === 'INSTANCE' && n.componentId) {
        const cid = String(n.componentId);
        byComponentInstanceCount.set(cid, (byComponentInstanceCount.get(cid) || 0) + 1);
      }
      const bv = n.boundVariables;
      if (
        bv &&
        typeof bv === 'object' &&
        (bv.fills != null ||
          bv.strokes != null ||
          bv.effects != null ||
          bv.fontSize != null ||
          bv.fontFamily != null ||
          bv.fontWeight != null)
      ) {
        tokenBoundNodeCount += 1;
      }
      if (n.type === 'TEXT') {
        textNodeCount += 1;
        if (
          (n.textStyleId != null && String(n.textStyleId).trim() !== '') ||
          (n.styles && n.styles.text != null && String(n.styles.text).trim() !== '')
        ) {
          textStyleBoundCount += 1;
        }
      }
    });
  }

  const componentSummaries = compIds.slice(0, 80).map((id) => {
    const c = components[id] || {};
    const name = c.name != null ? String(c.name) : '';
    const description = c.description != null ? String(c.description) : '';
    const propertyDefs = c.propertyDefinitions && typeof c.propertyDefinitions === 'object' ? c.propertyDefinitions : {};
    return {
      id,
      name,
      has_description: description.trim().length > 0,
      property_count: Object.keys(propertyDefs).length,
      instance_count: byComponentInstanceCount.get(id) || 0,
      remote: c.remote === true,
    };
  });

  const describedComponents = componentSummaries.filter((c) => c.has_description).length;
  const variantReadyComponents = componentSummaries.filter((c) => c.property_count > 0).length;
  const tokenBindingRate = totalNodeCount > 0 ? tokenBoundNodeCount / totalNodeCount : 0;
  const textStyleRate = textNodeCount > 0 ? textStyleBoundCount / textNodeCount : 0;

  return {
    generated_at: new Date().toISOString(),
    totals: {
      nodes: totalNodeCount,
      components: componentCount,
      component_sets: componentSetCount,
      text_nodes: textNodeCount,
    },
    coverage_inputs: {
      components_with_description: describedComponents,
      components_with_properties: variantReadyComponents,
      nodes_with_token_binding: tokenBoundNodeCount,
      text_nodes_with_style: textStyleBoundCount,
      token_binding_rate: Number(tokenBindingRate.toFixed(4)),
      text_style_rate: Number(textStyleRate.toFixed(4)),
    },
    components: componentSummaries,
  };
}

function countIssuesByRulePrefix(issues, prefix) {
  const out = { total: 0, high: 0, med: 0, low: 0 };
  if (!Array.isArray(issues)) return out;
  const rx = new RegExp(`^${prefix}-\\d{3}$`, 'i');
  for (const issue of issues) {
    const ruleId = String(issue?.rule_id || '').trim();
    if (!rx.test(ruleId)) continue;
    out.total += 1;
    if (issue.severity === 'HIGH') out.high += 1;
    else if (issue.severity === 'MED') out.med += 1;
    else out.low += 1;
  }
  return out;
}

function buildCoverageSummaryFromSnapshot(specSnapshot, issues) {
  const inp = specSnapshot?.coverage_inputs || {};
  const totals = specSnapshot?.totals || {};
  const compCount = Math.max(1, Number(totals.components) || 0);
  const descRate = clampNumber((Number(inp.components_with_description) || 0) / compCount, 0, 1);
  const propRate = clampNumber((Number(inp.components_with_properties) || 0) / compCount, 0, 1);
  const tokenRate = clampNumber(Number(inp.token_binding_rate) || 0, 0, 1);
  const textRate = clampNumber(Number(inp.text_style_rate) || 0, 0, 1);
  const sc = countIssuesByRulePrefix(issues, 'SC');
  const baseScore = Math.round((descRate * 30 + propRate * 25 + tokenRate * 25 + textRate * 20) * 100);
  const penalties = sc.high * 12 + sc.med * 6 + sc.low * 3;
  const score = clampNumber(baseScore - penalties, 0, 100);
  return {
    score,
    issues_total: sc.total,
    high_issues: sc.high,
    med_issues: sc.med,
    low_issues: sc.low,
    breakdown: {
      description_rate: Number(descRate.toFixed(3)),
      property_contract_rate: Number(propRate.toFixed(3)),
      token_binding_rate: Number(tokenRate.toFixed(3)),
      text_style_rate: Number(textRate.toFixed(3)),
      penalty_points: penalties,
    },
  };
}

function buildReadabilitySummary(issues) {
  const ar = countIssuesByRulePrefix(issues, 'AR');
  const penalties = ar.high * 10 + ar.med * 5 + ar.low * 2;
  const score = clampNumber(100 - penalties, 0, 100);
  return {
    score,
    issues_total: ar.total,
    high_issues: ar.high,
    med_issues: ar.med,
    low_issues: ar.low,
    penalty_points: penalties,
  };
}

function deriveQualityGates(specCoverageSummary, readabilitySummary) {
  const overall = Math.round(specCoverageSummary.score * 0.6 + readabilitySummary.score * 0.4);
  let status = 'pass';
  if (
    overall < 60 ||
    (specCoverageSummary.high_issues || 0) > 0 ||
    (readabilitySummary.high_issues || 0) > 1
  ) {
    status = 'block';
  } else if (overall < 80) {
    status = 'warn';
  }
  return {
    overall_score: overall,
    status,
    gates: {
      spec_coverage: specCoverageSummary.score >= 70 ? 'pass' : specCoverageSummary.score >= 50 ? 'warn' : 'block',
      agent_readability: readabilitySummary.score >= 75 ? 'pass' : readabilitySummary.score >= 55 ? 'warn' : 'block',
    },
  };
}

function sizeBandFromNodeCount(n) {
  if (n <= 500) return 'small';
  if (n <= 5000) return 'medium';
  if (n <= 50000) return 'large';
  return '200k+';
}

/**
 * DS audit prompt payload budget:
 * sending full Figma REST JSON can exceed provider request-size limits even for one dense page.
 * We compact to only fields used by DS rules / deterministic post-filters.
 */
const DS_PROMPT_CHAR_BUDGET = 1200000;
const DS_PROMPT_MAX_TEXT_CHARS = 120;
const DS_PROMPT_MAX_PAINTS = 4;

function trimPaintForDsPrompt(p) {
  if (!p || typeof p !== 'object') return null;
  const out = { type: p.type };
  if (p.visible === false) out.visible = false;
  if (typeof p.opacity === 'number') out.opacity = p.opacity;
  if (p.type === 'SOLID' && p.color && typeof p.color === 'object') {
    out.color = {
      r: typeof p.color.r === 'number' ? p.color.r : undefined,
      g: typeof p.color.g === 'number' ? p.color.g : undefined,
      b: typeof p.color.b === 'number' ? p.color.b : undefined,
      a: typeof p.color.a === 'number' ? p.color.a : undefined,
    };
  }
  return out;
}

function collectReferencedComponentIds(node, out) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'INSTANCE' && node.componentId != null && String(node.componentId).trim() !== '') {
    out.add(String(node.componentId).trim());
  }
  if (Array.isArray(node.children)) {
    for (const c of node.children) collectReferencedComponentIds(c, out);
  }
}

function compactNodeForDsPrompt(node) {
  if (!node || typeof node !== 'object') return null;
  const out = {
    id: node.id != null ? String(node.id) : '',
    type: node.type != null ? String(node.type) : '',
  };
  if (node.name != null) out.name = String(node.name);
  if (node.visible === false) out.visible = false;
  if (node.componentId != null && String(node.componentId).trim() !== '') out.componentId = String(node.componentId);
  if (node.layoutPositioning != null) out.layoutPositioning = node.layoutPositioning;
  if (node.layoutMode != null) out.layoutMode = node.layoutMode;
  if (node.primaryAxisSizingMode != null) out.primaryAxisSizingMode = node.primaryAxisSizingMode;
  if (node.counterAxisSizingMode != null) out.counterAxisSizingMode = node.counterAxisSizingMode;
  if (node.primaryAxisAlignItems != null) out.primaryAxisAlignItems = node.primaryAxisAlignItems;
  if (node.counterAxisAlignItems != null) out.counterAxisAlignItems = node.counterAxisAlignItems;
  if (node.layoutWrap != null) out.layoutWrap = node.layoutWrap;
  if (node.paddingTop != null) out.paddingTop = node.paddingTop;
  if (node.paddingRight != null) out.paddingRight = node.paddingRight;
  if (node.paddingBottom != null) out.paddingBottom = node.paddingBottom;
  if (node.paddingLeft != null) out.paddingLeft = node.paddingLeft;
  if (node.itemSpacing != null) out.itemSpacing = node.itemSpacing;
  if (node.counterAxisSpacing != null) out.counterAxisSpacing = node.counterAxisSpacing;
  if (node.strokeWeight != null) out.strokeWeight = node.strokeWeight;
  if (node.cornerRadius != null) out.cornerRadius = node.cornerRadius;
  if (Array.isArray(node.rectangleCornerRadii)) out.rectangleCornerRadii = node.rectangleCornerRadii;
  if (node.fillStyleId != null && String(node.fillStyleId).trim() !== '') out.fillStyleId = String(node.fillStyleId);
  if (node.strokeStyleId != null && String(node.strokeStyleId).trim() !== '') out.strokeStyleId = String(node.strokeStyleId);
  if (node.textStyleId != null && String(node.textStyleId).trim() !== '') out.textStyleId = String(node.textStyleId);
  if (node.absoluteBoundingBox && typeof node.absoluteBoundingBox === 'object') {
    const b = node.absoluteBoundingBox;
    out.absoluteBoundingBox = { x: b.x, y: b.y, width: b.width, height: b.height };
  }
  if (node.style && typeof node.style === 'object') {
    const st = {};
    if (node.style.fontSize != null) st.fontSize = node.style.fontSize;
    if (node.style.fontWeight != null) st.fontWeight = node.style.fontWeight;
    if (node.style.lineHeightPx != null) st.lineHeightPx = node.style.lineHeightPx;
    if (node.style.fontFamily != null) st.fontFamily = node.style.fontFamily;
    if (Object.keys(st).length > 0) out.style = st;
  }
  if (typeof node.characters === 'string' && node.characters.length > 0) {
    out.characters =
      node.characters.length > DS_PROMPT_MAX_TEXT_CHARS
        ? `${node.characters.slice(0, DS_PROMPT_MAX_TEXT_CHARS)}...`
        : node.characters;
  }
  if (Array.isArray(node.fills) && node.fills.length > 0) {
    out.fills = node.fills.slice(0, DS_PROMPT_MAX_PAINTS).map(trimPaintForDsPrompt).filter(Boolean);
  }
  if (Array.isArray(node.strokes) && node.strokes.length > 0) {
    out.strokes = node.strokes.slice(0, DS_PROMPT_MAX_PAINTS).map(trimPaintForDsPrompt).filter(Boolean);
  }
  if (node.boundVariables && typeof node.boundVariables === 'object') {
    const bv = {};
    for (const k of ['fills', 'strokes', 'fontSize', 'fontFamily', 'fontWeight', 'lineHeight']) {
      if (node.boundVariables[k] != null) bv[k] = node.boundVariables[k];
    }
    if (Object.keys(bv).length > 0) out.boundVariables = bv;
  }
  if (Array.isArray(node.children) && node.children.length > 0) {
    out.children = node.children.map(compactNodeForDsPrompt).filter(Boolean);
  } else if (Array.isArray(node.children)) {
    out.children = [];
  }
  return out;
}

function compactFileJsonForDsPrompt(fileJson) {
  if (!fileJson || typeof fileJson !== 'object') return fileJson;
  const compactDocument = compactNodeForDsPrompt(fileJson.document || { type: 'DOCUMENT', id: '0:0', children: [] });
  const referenced = new Set();
  collectReferencedComponentIds(compactDocument, referenced);
  let compactComponents = undefined;
  if (fileJson.components && typeof fileJson.components === 'object') {
    compactComponents = {};
    for (const id of referenced) {
      const c = fileJson.components[id];
      if (!c || typeof c !== 'object') continue;
      compactComponents[id] = {
        key: c.key,
        name: c.name,
        description: c.description,
        remote: c.remote === true,
      };
    }
  }
  return {
    document: compactDocument || { type: 'DOCUMENT', id: '0:0', children: [] },
    ...(compactComponents ? { components: compactComponents } : {}),
  };
}

function buildDsPromptInputJson(fileJson) {
  const fullString = JSON.stringify(fileJson);
  if (fullString.length <= DS_PROMPT_CHAR_BUDGET) return { payload: fileJson, compacted: false };
  const compact = compactFileJsonForDsPrompt(fileJson);
  const compactString = JSON.stringify(compact);
  if (compactString.length <= DS_PROMPT_CHAR_BUDGET) return { payload: compact, compacted: true };
  // Last resort: still use compact payload; route already maps provider-size errors to ds_audit_input_too_large.
  return { payload: compact, compacted: true };
}

function safeJsonSize(obj) {
  try {
    return JSON.stringify(obj).length;
  } catch {
    return 0;
  }
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
const FIGMA_AUDIT_PAGE_FETCH_CONCURRENCY = 2;

/** Fetch file JSON from Figma REST API. Never requests the full file in one go: per-page or per-node only, to avoid 400 on large files. Returns { document } for audit engines. */
async function fetchFigmaFileForAudit(figmaAuth, fileKey, scope, pageId, nodeIds, pageIds) {
  const scopeType = scope === 'current' || scope === 'page' || scope === 'all' ? scope : 'all';
  const idsArr = Array.isArray(nodeIds) ? nodeIds.filter(Boolean) : [];
  const pageIdTrim = typeof pageId === 'string' ? pageId.trim() : '';
  const pageIdsArr = Array.isArray(pageIds) ? pageIds.filter(Boolean) : [];
  const figmaReqInit = { headers: figmaRestHeaders(figmaAuth) };

  const handleFigmaError = (res, t) => {
    if (res.status === 403) {
      console.warn('fetchFigmaFileForAudit: Figma API 403 (token rejected by Figma)');
      throw new Error('No Figma token; re-login to grant file access');
    }
    if (res.status === 404) throw new Error('File not found');
    if (res.status === 429) {
      const retryRaw = res.headers.get('retry-after');
      const retryNum = retryRaw != null && String(retryRaw).trim() !== '' ? Number(retryRaw) : NaN;
      throw Object.assign(new Error('Figma rate limit exceeded'), {
        code: 'FIGMA_RATE_LIMITED',
        retryAfterSec: Number.isFinite(retryNum) ? retryNum : null,
        upgradeUrl: res.headers.get('x-figma-upgrade-link') || null,
      });
    }
    throw new Error(t || 'Figma API error');
  };

  if (scopeType === 'current' && idsArr.length > 0) {
    const url = new URL(`https://api.figma.com/v1/files/${fileKey}/nodes`);
    url.searchParams.set('ids', idsArr.join(','));
    url.searchParams.set('depth', String(FIGMA_AUDIT_REST_DEPTH_NODES));
    const res = await fetch(url.toString(), figmaReqInit);
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
    const res = await fetch(url.toString(), figmaReqInit);
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
      const res = await fetch(url.toString(), figmaReqInit);
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
    const res = await fetch(url.toString(), figmaReqInit);
    if (!res.ok) { const t = await res.text(); handleFigmaError(res, t); }
    const data = await res.json();
    return { document: data.document || { type: 'DOCUMENT', id: '0:0', children: [] }, components: data.components };
  }

  const url = new URL(`https://api.figma.com/v1/files/${fileKey}`);
  url.searchParams.set('depth', String(FIGMA_AUDIT_REST_DEPTH_FULL_OVERVIEW));
  const res = await fetch(url.toString(), figmaReqInit);
  if (!res.ok) { const t = await res.text(); handleFigmaError(res, t); }
  const data = await res.json();
  return { document: data.document || { type: 'DOCUMENT', id: '0:0', children: [] }, components: data.components };
}

function asStringArray(v) {
  if (!Array.isArray(v)) return undefined;
  const out = v.map((x) => String(x || '').trim()).filter(Boolean);
  return out.length > 0 ? out : undefined;
}

function buildProviderFetchParams(body, fallbackScope = 'all') {
  const sourceRef =
    body?.source_ref && typeof body.source_ref === 'object' && !Array.isArray(body.source_ref)
      ? body.source_ref
      : body?.sourceRef && typeof body.sourceRef === 'object' && !Array.isArray(body.sourceRef)
        ? body.sourceRef
        : null;
  const selectionContext =
    body?.selection_context && typeof body.selection_context === 'object' && !Array.isArray(body.selection_context)
      ? body.selection_context
      : body?.selectionContext && typeof body.selectionContext === 'object' && !Array.isArray(body.selectionContext)
        ? body.selectionContext
        : null;
  const scope =
    body?.scope ||
    sourceRef?.scope ||
    selectionContext?.scope ||
    fallbackScope;
  return {
    scope,
    pageId:
      body?.page_id ||
      body?.pageId ||
      sourceRef?.page_id ||
      sourceRef?.pageId ||
      selectionContext?.page_id ||
      selectionContext?.pageId ||
      null,
    nodeIds:
      asStringArray(body?.node_ids) ||
      asStringArray(body?.nodeIds) ||
      asStringArray(sourceRef?.node_ids) ||
      asStringArray(sourceRef?.nodeIds) ||
      asStringArray(selectionContext?.node_ids) ||
      asStringArray(selectionContext?.nodeIds),
    pageIds:
      asStringArray(body?.page_ids) ||
      asStringArray(body?.pageIds) ||
      asStringArray(sourceRef?.page_ids) ||
      asStringArray(sourceRef?.pageIds) ||
      asStringArray(selectionContext?.page_ids) ||
      asStringArray(selectionContext?.pageIds),
  };
}

async function resolveDesignDocumentFromBody({ body, userId, fallbackScope = 'all' }) {
  const sourceTool = String(body?.source_tool || body?.sourceTool || '').trim().toLowerCase();
  const fileJsonFromBody =
    body?.design_document ||
    body?.designDocument ||
    body?.file_json ||
    body?.fileJson;
  const sourceRef =
    body?.source_ref && typeof body.source_ref === 'object' && !Array.isArray(body.source_ref)
      ? body.source_ref
      : body?.sourceRef && typeof body.sourceRef === 'object' && !Array.isArray(body.sourceRef)
        ? body.sourceRef
        : null;
  const refDocId = String(
    sourceRef?.doc_id ||
    sourceRef?.docId ||
    sourceRef?.file_key ||
    sourceRef?.fileKey ||
    ''
  ).trim();
  const fileKey = refDocId || String(body?.file_key || body?.fileKey || '').trim();
  const providerParams = buildProviderFetchParams(body, fallbackScope);

  if (fileJsonFromBody && typeof fileJsonFromBody === 'object' && fileJsonFromBody.document) {
    return { fileJson: fileJsonFromBody, sourceTool: sourceTool || 'inline' };
  }

  if (sourceTool && sourceTool !== 'figma') {
    const err = new Error(`Unsupported source_tool "${sourceTool}". Provide design_document until adapter is implemented.`);
    err.status = 400;
    throw err;
  }

  if (!fileKey) {
    const err = new Error('file_key/source_ref.doc_id or design_document required');
    err.status = 400;
    throw err;
  }

      let figmaAuth = await getFigmaAuthForUser(userId);
      if (!figmaAuth) {
        await forceRefreshFigmaToken(userId);
        figmaAuth = await getFigmaAuthForUser(userId);
      }
      if (!figmaAuth) {
    const err = new Error(MSG_FIGMA_API_TOKEN_MISSING);
    err.status = 403;
    err.code = 'FIGMA_RECONNECT';
    throw err;
  }

      let fetchErr = null;
  let fileJson = null;
  try {
    fileJson = await fetchFigmaFileForAudit(
      figmaAuth,
      fileKey,
      providerParams.scope,
      providerParams.pageId,
      providerParams.nodeIds,
      providerParams.pageIds,
    );
      } catch (err) {
        fetchErr = err;
      }
      if (fetchErr && fetchErr.message && fetchErr.message.includes('re-login')) {
        await forceRefreshFigmaToken(userId);
        const authRetry = await getFigmaAuthForUser(userId);
        if (authRetry) {
          try {
        fileJson = await fetchFigmaFileForAudit(
          authRetry,
          fileKey,
          providerParams.scope,
          providerParams.pageId,
          providerParams.nodeIds,
          providerParams.pageIds,
        );
            fetchErr = null;
          } catch (e) {
            fetchErr = e;
          }
        }
      }
  if (fetchErr || !fileJson) {
    if (fetchErr && fetchErr.code === 'FIGMA_RATE_LIMITED') {
      const err = new Error('Figma rate limit exceeded');
      err.status = 429;
      err.code = 'FIGMA_RATE_LIMITED';
      err.retryAfterSec = fetchErr.retryAfterSec ?? null;
      err.upgradeUrl = fetchErr.upgradeUrl ?? null;
      throw err;
    }
    const msg = fetchErr && fetchErr.message ? fetchErr.message : 'Figma API error';
    const err = new Error(msg);
    if (msg.includes('re-login')) {
      err.status = 403;
      err.code = 'FIGMA_RECONNECT';
    } else if (msg.includes('Rate limit exceeded') || /"status"\s*:\s*429/.test(msg) || /\b429\b/.test(msg)) {
      err.status = 429;
      err.code = 'FIGMA_RATE_LIMITED';
      err.retryAfterSec = null;
      err.upgradeUrl = null;
      err.message = 'Figma rate limit reached. Wait a few seconds and retry the scan.';
    } else if (msg.includes('not found')) {
      err.status = 404;
    } else {
      err.status = 400;
    }
    throw err;
  }

  return { fileJson, sourceTool: sourceTool || 'figma', fileKey };
}

app.post('/api/agents/ds-audit', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body || {};

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

  const dsAuditReqStart = Date.now();
  try {
    let fileJson;
    try {
      const resolved = await resolveDesignDocumentFromBody({ body, userId, fallbackScope: 'all' });
      fileJson = resolved.fileJson;
      console.info(
        '[DS_AUDIT_TIMING] ' +
          JSON.stringify({
            phase: 'resolve_design_document_ms',
            ms: Date.now() - dsAuditReqStart,
            file_key: resolved.fileKey || body?.file_key || null,
          }),
      );
    } catch (resolveErr) {
      const status = Number(resolveErr?.status) || 400;
      const code = resolveErr?.code;
      const msg = resolveErr?.message || 'Invalid design source';
      if (code) return res.status(status).json({ error: msg, code });
      return res.status(status).json({ error: msg });
    }

    // Advisory: file senza design system (0 componenti) → suggerire Preline, skip Kimi
    const components = fileJson?.components;
    const componentCount = components && typeof components === 'object' ? Object.keys(components).length : null;
    if (componentCount === 0) {
      const specSnapshot = buildDsSpecSnapshot(fileJson);
      const specCoverageSummary = buildCoverageSummaryFromSnapshot(specSnapshot, []);
      const readabilitySummary = buildReadabilitySummary([]);
      const qualityGates = deriveQualityGates(specCoverageSummary, readabilitySummary);
      return res.json({
        issues: [],
        spec_snapshot: specSnapshot,
        spec_coverage_summary: specCoverageSummary,
        readability_summary: readabilitySummary,
        quality_gates: qualityGates,
        advisory: {
          type: 'no_design_system',
          message: 'Questo file non ha componenti definiti. Per partire da zero, ti consigliamo Preline: design system gratuito con 840+ componenti e template.',
          ctaLabel: 'Scopri Preline',
          ctaUrl: 'https://preline.co',
        },
      });
    }

    const dsPromptInput = buildDsPromptInputJson(fileJson);
    const userMessage = `Ecco il JSON del file di design. Esegui l'audit secondo le regole e restituisci solo un JSON con chiave "issues" (array di issue). Nessun testo prima o dopo.${
      dsPromptInput.compacted
        ? ' Nota: il payload e` stato compattato lato server per limiti di richiesta; usa solo i campi presenti senza assumere dati mancanti.'
        : ''
    }\n\n${JSON.stringify(dsPromptInput.payload)}`;
    const beforeKimiMs = Date.now() - dsAuditReqStart;
    console.info(
      '[DS_AUDIT_TIMING] ' +
        JSON.stringify({
          phase: 'prompt_built',
          model: KIMI_MODEL,
          compacted: dsPromptInput.compacted,
          original_chars: safeJsonSize(fileJson),
          prompt_chars: userMessage.length,
          ms_since_request_start: beforeKimiMs,
        }),
    );

    const kimiHttpStart = Date.now();
    const kimiRes = await withKimiConcurrencySlot(() =>
      fetch('https://api.moonshot.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${KIMI_API_KEY}`,
        },
        body: JSON.stringify(
          buildKimiChatRequestPayload({
            model: KIMI_MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            maxTokens: 4096,
          }),
        ),
      }),
    );
    const kimiHttpMs = Date.now() - kimiHttpStart;
    console.info(
      '[DS_AUDIT_TIMING] ' +
        JSON.stringify({
          phase: 'kimi_queue_wait_plus_http_ms',
          ms: kimiHttpMs,
          ok: kimiRes.ok,
          status: kimiRes.status,
          note: 'queue Redis + HTTP Moonshot',
        }),
    );
    if (!kimiRes.ok) {
      const t = await kimiRes.text();
      const lower = String(t || '').toLowerCase();
      console.error('DS Audit: Kimi API', kimiRes.status, t.slice(0, 300));
      if (kimiResponseLooksRateLimited(kimiRes.status, t)) {
        const retryAfterSec = kimiRateLimitRetryAfterSec();
        res.setHeader('Retry-After', String(retryAfterSec));
        return res.status(429).json({
          error:
            'DS audit hit the AI provider rate limit (tokens/minute). Wait briefly — the plugin will retry automatically when possible.',
          code: 'KIMI_RATE_LIMIT',
          retryAfterSec,
        });
      }
      const isInputTooLarge = /total message size|exceeds limit|context length|maximum context|token limit|invalid_request_error/.test(lower);
      if (isInputTooLarge) {
        return res.status(413).json({
          error: 'ds_audit_input_too_large',
          details: 'Selection too large for DS audit. Use Current Selection or a single page and retry.',
        });
      }
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
    const specSnapshot = buildDsSpecSnapshot(fileJson);
    const specCoverageSummary = buildCoverageSummaryFromSnapshot(specSnapshot, issues);
    const readabilitySummary = buildReadabilitySummary(issues);
    const qualityGates = deriveQualityGates(specCoverageSummary, readabilitySummary);

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
    console.info(
      '[DS_AUDIT_TIMING] ' +
        JSON.stringify({
          phase: 'total_request_wall_ms_ok',
          ms: Date.now() - dsAuditReqStart,
        }),
    );
    res.json({
      issues,
      spec_snapshot: specSnapshot,
      spec_coverage_summary: specCoverageSummary,
      readability_summary: readabilitySummary,
      quality_gates: qualityGates,
      ...(libraryContextHint ? { libraryContextHint } : {}),
    });
  } catch (err) {
    console.error('POST /api/agents/ds-audit', err);
    console.error(
      '[DS_AUDIT_TIMING] ' +
        JSON.stringify({
          phase: 'failed_after_ms',
          ms: typeof dsAuditReqStart === 'number' ? Date.now() - dsAuditReqStart : null,
          code: err?.code ?? null,
        }),
    );
    if (err?.code === 'KIMI_QUEUE_TIMEOUT') {
      return res.status(503).json({
        error: err.message || 'Too many simultaneous AI requests. Retry shortly.',
        code: 'KIMI_QUEUE_TIMEOUT',
      });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Generate agent (Kimi): file_key + prompt → action plan JSON. A/B: 50% model A vs model B (see KIMI_GENERATE_MODEL_*)
const GENERATE_PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'generate-system.md');

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

async function callKimi(messages, maxTokens = 8192, textModelOverride = null) {
  const usesVision =
    Array.isArray(messages) && messages.some((m) => m && typeof m === 'object' && Array.isArray(m.content));
  const textModel =
    textModelOverride != null && String(textModelOverride).trim() !== ''
      ? String(textModelOverride).trim()
      : KIMI_MODEL;
  const model = usesVision ? KIMI_VISION_MODEL : textModel;
  const payload = buildKimiChatRequestPayload({ model, messages, maxTokens });
  const timeoutMs = Math.max(15000, Number(process.env.KIMI_API_TIMEOUT_MS || 55000));
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(new Error('Kimi request timeout')), timeoutMs);
  let r;
  try {
    r = await withKimiConcurrencySlot(() =>
      fetch('https://api.moonshot.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KIMI_API_KEY}` },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      }),
    );
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new Error(`Kimi API timeout after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || `Kimi API ${r.status}`);
  }
  const data = await r.json();
  return { content: data?.choices?.[0]?.message?.content, usage: data?.usage };
}

async function repairActionPlanWithKimi(systemPrompt, actionPlan, errors, promptContext, textModelOverride = null) {
  const repairUserMsg = [
    'Your previous JSON is invalid. Repair it and return only one valid JSON object.',
    `Validation errors: ${(errors || []).join(' | ')}`,
    'Keep intent unchanged and preserve DS constraints.',
    `Prompt context:\n${promptContext}`,
    `Previous JSON:\n${JSON.stringify(actionPlan || {}, null, 2)}`,
  ].join('\n\n');
  return callKimi(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: repairUserMsg }],
    8192,
    textModelOverride,
  );
}

function normalizeActionPlanEnvelope(actionPlan, { prompt, mode, dsSource } = {}) {
  if (!actionPlan || typeof actionPlan !== 'object' || Array.isArray(actionPlan)) return actionPlan;
  const plan = actionPlan;
  plan.version = '1.0';
  if (!plan.metadata || typeof plan.metadata !== 'object' || Array.isArray(plan.metadata)) plan.metadata = {};
  if (!String(plan.metadata.prompt || '').trim()) plan.metadata.prompt = String(prompt || '').trim();
  if (!String(plan.metadata.mode || '').trim()) plan.metadata.mode = mode || 'create';
  if (!String(plan.metadata.ds_source || '').trim()) plan.metadata.ds_source = dsSource || 'custom';
  if (!Number.isFinite(Number(plan.metadata.estimated_credits ?? NaN))) plan.metadata.estimated_credits = 3;
  return plan;
}

function ensureCreateModeHasCreateFrameAction(actionPlan, mode) {
  if (!actionPlan || typeof actionPlan !== 'object') return actionPlan;
  const modeNorm = String(mode || '').toLowerCase();
  if (modeNorm !== 'create' && modeNorm !== 'screenshot') return actionPlan;
  const plan = actionPlan;
  if (!Array.isArray(plan.actions)) plan.actions = [];
  const hasCreateFrame = plan.actions.some(
    (a) => a && typeof a === 'object' && String(a.type || '').toUpperCase() === 'CREATE_FRAME',
  );
  if (hasCreateFrame) return plan;

  const frame = plan.frame && typeof plan.frame === 'object' ? plan.frame : {};
  if (!plan.frame || typeof plan.frame !== 'object') {
    plan.frame = frame;
  }
  if (typeof frame.name !== 'string' || frame.name.trim() === '') {
    frame.name = 'Generated Screen';
  }
  if (!Number.isFinite(Number(frame.width)) || Number(frame.width) <= 0) frame.width = 1440;
  if (!Number.isFinite(Number(frame.height)) || Number(frame.height) <= 0) frame.height = 1024;
  if (typeof frame.layoutMode !== 'string' || frame.layoutMode.trim() === '') frame.layoutMode = 'VERTICAL';

  plan.actions.unshift({
    type: 'CREATE_FRAME',
    ref: 'content_root',
    parent: 'root',
    name: 'Content',
    layoutMode: 'VERTICAL',
    width: 1200,
    height: 800,
    itemSpacing: 16,
  });
  return plan;
}

function ensureMinimumCreateModeStructureFrames(actionPlan, mode, prompt) {
  if (!actionPlan || typeof actionPlan !== 'object') return actionPlan;
  const modeNorm = String(mode || '').toLowerCase();
  if (modeNorm !== 'create' && modeNorm !== 'screenshot') return actionPlan;
  if (isMobilePrompt(prompt)) return actionPlan;
  const plan = actionPlan;
  if (!Array.isArray(plan.actions)) plan.actions = [];
  const frames = plan.actions.filter(
    (a) => a && typeof a === 'object' && String(a.type || '').toUpperCase() === 'CREATE_FRAME',
  );
  if (frames.length >= 2) return plan;

  const parentFrame = frames[0] || null;
  const parentRef =
    parentFrame && typeof parentFrame.ref === 'string' && parentFrame.ref.trim()
      ? parentFrame.ref.trim()
      : 'content_root';
  if (parentFrame && (!parentFrame.ref || typeof parentFrame.ref !== 'string')) parentFrame.ref = parentRef;
  const sectionRef = 'content_section';
  const alreadyHasSection = plan.actions.some((a) => a && typeof a === 'object' && a.ref === sectionRef);
  if (!alreadyHasSection) {
    const insertAt = parentFrame ? Math.max(0, plan.actions.indexOf(parentFrame)) + 1 : 0;
    plan.actions.splice(insertAt, 0, {
      type: 'CREATE_FRAME',
      ref: sectionRef,
      parentId: parentRef,
      name: 'Content Section',
      layoutMode: 'VERTICAL',
      width: 960,
      itemSpacing: 16,
    });
  }

  for (const action of plan.actions) {
    if (!action || typeof action !== 'object') continue;
    if (action.ref === sectionRef) continue;
    if (String(action.type || '').toUpperCase() === 'CREATE_FRAME') continue;
    const parent = String(action.parentId || action.parent || 'root').trim();
    if (parent === 'root') action.parentId = sectionRef;
  }
  return plan;
}

function isMobilePrompt(prompt) {
  return /\b(mobile|iphone|android|phone|cellulare|smartphone)\b/i.test(String(prompt || ''));
}

function isHeroPrompt(prompt, archetype) {
  return (
    String(archetype || '') === 'hero' ||
    /\b(hero|banner|landing|above[-\s]?the[-\s]?fold|marketing\s+section|headline\s+section)\b/i.test(String(prompt || ''))
  );
}

function ensureDesktopStructureHasSubstantialRootFrame(actionPlan, mode, prompt) {
  if (!actionPlan || typeof actionPlan !== 'object') return actionPlan;
  const modeNorm = String(mode || '').toLowerCase();
  if (modeNorm !== 'create' && modeNorm !== 'screenshot') return actionPlan;
  if (isMobilePrompt(prompt)) return actionPlan;
  const plan = actionPlan;
  if (!Array.isArray(plan.actions)) plan.actions = [];

  const hasSubstantialRootFrame = plan.actions.some((a) => {
    if (!a || typeof a !== 'object') return false;
    if (String(a.type || '').toUpperCase() !== 'CREATE_FRAME') return false;
    const rawParent = a.parentId ?? a.parent;
    const parent = rawParent == null || String(rawParent).trim() === '' ? 'root' : String(rawParent).trim();
    if (parent !== 'root') return false;
    const w = Number(a.width);
    const h = Number(a.height);
    return Number.isFinite(w) && w >= 280 && Number.isFinite(h) && h >= 240;
  });
  if (hasSubstantialRootFrame) return plan;

  plan.actions.unshift({
    type: 'CREATE_FRAME',
    ref: 'desktop_content',
    parent: 'root',
    name: 'Desktop Content',
    layoutMode: 'VERTICAL',
    width: 1200,
    height: 760,
    itemSpacing: 16,
    paddingTop: 24,
    paddingRight: 24,
    paddingBottom: 24,
    paddingLeft: 24,
  });
  return plan;
}

function scoreNameMatch(name, hints) {
  const n = String(name || '').toLowerCase();
  if (!n) return 0;
  let score = 0;
  for (const h of hints) {
    if (n.includes(h)) score += 3;
  }
  if (/\b(step|progress|wizard|breadcrumb|timeline)\b/i.test(n)) score -= 8;
  return score;
}

function pickBestComponentCandidate(components, includeHints, options) {
  const skipCardAsSoloCta = options?.skipCardAsSoloCta === true;
  let best = null;
  let bestScore = -9999;
  for (const c of components || []) {
    const nm = String(c?.name || '').toLowerCase();
    if (skipCardAsSoloCta && /\bcard\b/i.test(nm) && !/\b(button|btn|cta)\b/i.test(nm)) continue;
    const s = scoreNameMatch(c?.name, includeHints);
    if (s > bestScore) {
      best = c;
      bestScore = s;
    }
  }
  return bestScore > 0 ? best : null;
}

/**
 * Deterministic binding: for login/auth flows, swap semantically wrong instance picks
 * (step/progress-like) with better candidates from DS index when available.
 */
function enforceDeterministicSemanticComponentBinding(actionPlan, prompt, dsContextIndex) {
  if (!actionPlan || typeof actionPlan !== 'object') return actionPlan;
  if (!dsContextIndex || typeof dsContextIndex !== 'object') return actionPlan;
  const components = Array.isArray(dsContextIndex.components) ? dsContextIndex.components : [];
  if (!components.length) return actionPlan;
  const plan = actionPlan;
  if (!Array.isArray(plan.actions)) return plan;

  const isLoginLike = /\b(login|sign[\s-]?in|auth|password|email)\b/i.test(String(prompt || ''));
  if (!isLoginLike) return plan;

  const forbidden = /\b(step|progress|wizard|breadcrumb|timeline)\b/i;
  const inputCandidate = pickBestComponentCandidate(components, ['input', 'field', 'text field', 'textfield', 'email', 'password']);
  const buttonCandidate = pickBestComponentCandidate(components, ['button', 'btn', 'cta', 'primary'], {
    skipCardAsSoloCta: true,
  });

  for (let i = 0; i < plan.actions.length; i++) {
    const a = plan.actions[i];
    if (!a || typeof a !== 'object') continue;
    if (String(a.type || '').trim() !== 'INSTANCE_COMPONENT') continue;

    const nameHint = String(a.name || '').toLowerCase();
    const key = String(a.component_key || a.componentKey || a.component_id || '').trim();
    const nodeId = String(a.component_node_id || a.componentNodeId || '').trim();
    const found =
      components.find((c) => String(c?.componentKey || '').trim() === key) ||
      components.find((c) => String(c?.id || '').trim() === nodeId) ||
      null;
    const foundName = String(found?.name || '').toLowerCase();
    const badPick = !found || forbidden.test(foundName);
    if (!badPick) continue;

    const wantsInput = /\b(email|password|field|input)\b/i.test(nameHint);
    const wantsButton = /\b(button|cta|submit|next|continue|sign[\s-]?in)\b/i.test(nameHint);
    const candidate = wantsInput ? inputCandidate : wantsButton ? buttonCandidate : buttonCandidate || inputCandidate;
    if (!candidate) continue;
    if (candidate.componentKey) a.component_key = String(candidate.componentKey);
    if (candidate.id) a.component_node_id = String(candidate.id);
  }
  return plan;
}

function validateCustomDsIndexReadiness(mode, dsSource, dsIndexForValidation) {
  const modeNorm = String(mode || '').toLowerCase();
  if (modeNorm !== 'create' && modeNorm !== 'screenshot') {
    return { valid: true, errors: [] };
  }
  if (!isCustomDsSource(dsSource)) {
    return { valid: true, errors: [] };
  }
  if (!dsIndexForValidation || typeof dsIndexForValidation !== 'object') {
    return {
      valid: false,
      errors: ['Missing ds_context_index for custom DS generation. Re-import design system for this file and retry.'],
    };
  }
  const components = Array.isArray(dsIndexForValidation.components) ? dsIndexForValidation.components : [];
  const minComponents = Number(process.env.GENERATE_MIN_COMPONENTS_FOR_CUSTOM_DS || 4);
  if (components.length < minComponents) {
    return {
      valid: false,
      errors: [
        `ds_context_index has too few components (${components.length}). Minimum required for reliable custom DS generation: ${minComponents}.`,
      ],
    };
  }
  return { valid: true, errors: [] };
}

const SLOT_BLUEPRINTS = {
  hero: [
    { id: 'eyebrow', required: false, hints: ['eyebrow', 'kicker', 'badge', 'label', 'tag'] },
    { id: 'title_block', required: false, hints: ['title', 'heading', 'headline', 'hero title', 'h1'] },
    { id: 'description_block', required: false, hints: ['description', 'subtitle', 'subheading', 'body', 'paragraph'] },
    { id: 'primary_cta', required: true, hints: ['button', 'cta', 'primary', 'action', 'start', 'get started'] },
    { id: 'secondary_cta', required: false, hints: ['button', 'cta', 'secondary', 'link', 'learn more'] },
    { id: 'visual', required: false, hints: ['image', 'illustration', 'media', 'preview', 'card', 'mockup'] },
  ],
  login: [
    { id: 'brand_logo', required: false, hints: ['logo', 'brand', 'wordmark', 'logotype'] },
    { id: 'title_block', required: false, hints: ['title', 'heading', 'headline', 'hero title', 'h1', 'welcome'] },
    { id: 'description_block', required: false, hints: ['description', 'subtitle', 'subheading', 'helper', 'body'] },
    { id: 'email_input', required: true, hints: ['email', 'input', 'field', 'text field'] },
    { id: 'password_input', required: true, hints: ['password', 'input', 'field', 'text field'] },
    { id: 'primary_cta', required: true, hints: ['button', 'cta', 'primary', 'submit', 'sign in', 'continue'] },
    { id: 'secondary_action', required: false, hints: ['link', 'secondary', 'forgot', 'reset'] },
  ],
  profile: [
    { id: 'info_row', required: true, hints: ['row', 'item', 'list', 'info'] },
    { id: 'primary_cta', required: false, hints: ['button', 'cta', 'primary', 'save', 'edit'] },
  ],
  dashboard: [
    { id: 'stat_card', required: true, hints: ['card', 'stat', 'metric', 'tile'] },
    { id: 'action_button', required: false, hints: ['button', 'cta', 'primary'] },
  ],
  form: [
    { id: 'form_input', required: true, hints: ['input', 'field', 'text field', 'select', 'dropdown'] },
    { id: 'primary_cta', required: true, hints: ['button', 'cta', 'primary', 'submit', 'continue'] },
  ],
};

function scorePageContextForSlot(pageName, slotHints, promptTokens) {
  const p = String(pageName || '').toLowerCase();
  if (!p) return 0;
  let score = 0;
  for (const h of slotHints || []) {
    const hh = String(h || '').toLowerCase();
    if (hh && p.includes(hh)) score += 2;
  }
  for (const t of promptTokens || []) {
    if (t.length > 2 && p.includes(t)) score += 1;
  }
  return score;
}

function componentScoreForSlot(name, slotHints, promptTokens, slotId, pageName, pageOrder) {
  const n = String(name || '').toLowerCase();
  if (!n) return -999;
  let score = 0;
  for (const h of slotHints) {
    if (n.includes(h)) score += 4;
  }
  for (const t of promptTokens) {
    if (t.length > 2 && n.includes(t)) score += 1;
  }
  if (/\b(step|progress|wizard|breadcrumb|timeline)\b/i.test(n)) score -= 10;
  if (
    slotId === 'primary_cta' &&
    /\bcard\b/i.test(n) &&
    !/\b(button|btn|cta|action)\b/i.test(n)
  ) {
    score -= 30;
  }
  score += scorePageContextForSlot(pageName, slotHints, promptTokens);
  const po = Number(pageOrder);
  if (Number.isFinite(po) && po > 0) {
    score += Math.max(0, 8 - po) * 0.25;
  }
  return score;
}

function buildSlotCandidatePack(dsIndexForValidation, archetype, prompt) {
  if (!dsIndexForValidation || typeof dsIndexForValidation !== 'object') return null;
  const components = Array.isArray(dsIndexForValidation.components) ? dsIndexForValidation.components : [];
  if (!components.length) return null;
  const slots = SLOT_BLUEPRINTS[archetype] || [];
  if (!slots.length) return null;
  const promptTokens = String(prompt || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);

  const out = [];
  for (const slot of slots) {
    const ranked = components
      .map((c) => ({
        c,
        score: componentScoreForSlot(
          c?.name,
          slot.hints || [],
          promptTokens,
          slot.id,
          c?.pageName,
          c?.pageOrder,
        ),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((x) => ({
        id: String(x.c?.id || ''),
        componentKey: String(x.c?.componentKey || x.c?.component_key || ''),
        name: String(x.c?.name || ''),
        pageName: String(x.c?.pageName || ''),
        pageOrder: Number(x.c?.pageOrder) || null,
      }));
    if (ranked.length > 0) {
      out.push({
        id: slot.id,
        required: Boolean(slot.required),
        hints: slot.hints || [],
        candidates: ranked,
      });
    }
  }
  return out.length ? { archetype, slots: out } : null;
}

function buildSlotCandidatePackFromGenerationSpec(dsIndexForValidation, generationSpec, prompt) {
  if (!generationSpec || typeof generationSpec !== 'object') return null;
  if (!dsIndexForValidation || typeof dsIndexForValidation !== 'object') return null;
  const components = Array.isArray(dsIndexForValidation.components) ? dsIndexForValidation.components : [];
  if (!components.length) return null;
  const specSlots = [
    ...(Array.isArray(generationSpec.required_slots) ? generationSpec.required_slots : []),
    ...(Array.isArray(generationSpec.optional_slots) ? generationSpec.optional_slots : []),
  ];
  if (!specSlots.length) return null;
  const promptTokens = [
    ...String(prompt || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter(Boolean),
    ...(Array.isArray(generationSpec.ds_search_terms)
      ? generationSpec.ds_search_terms.map((x) => String(x || '').toLowerCase())
      : []),
  ];

  const out = [];
  for (const slot of specSlots) {
    if (!slot || typeof slot !== 'object') continue;
    const slotId = String(slot.id || '').trim();
    if (!slotId) continue;
    const hints = [
      slotId,
      String(slot.label || ''),
      String(slot.kind || ''),
      ...(Array.isArray(slot.component_search_terms) ? slot.component_search_terms : []),
    ]
      .map((x) => String(x || '').trim().toLowerCase())
      .filter(Boolean);
    const ranked = components
      .map((c) => ({
        c,
        score: componentScoreForSlot(
          c?.name,
          hints,
          promptTokens,
          slotId,
          c?.pageName,
          c?.pageOrder,
        ),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((x) => ({
        id: String(x.c?.id || ''),
        componentKey: String(x.c?.componentKey || x.c?.component_key || ''),
        name: String(x.c?.name || ''),
        pageName: String(x.c?.pageName || ''),
        pageOrder: Number(x.c?.pageOrder) || null,
      }));
    out.push({
      id: slotId,
      required: Boolean(slot.required) && ranked.length > 0,
      hints,
      kind: String(slot.kind || 'generic'),
      candidates: ranked,
    });
  }
  return out.length ? { archetype: generationSpec.archetype_id || 'kimi_spec', source: 'generation_spec', slots: out } : null;
}

function formatSlotCandidateBlock(pack) {
  if (!pack || !Array.isArray(pack.slots) || pack.slots.length === 0) return '';
  return [
    '',
    '[COMPONENT_SLOT_CANDIDATES]',
    'Use INSTANCE_COMPONENT picks from these slot candidates first (exact key/id).',
    JSON.stringify(pack),
    '[END COMPONENT_SLOT_CANDIDATES]',
  ].join('\n');
}

function normalizeAssignmentOverrides(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const [slotId, v] of Object.entries(raw)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const componentKey = String(v.component_key || v.componentKey || '').trim();
    const componentNodeId = String(v.component_node_id || v.componentNodeId || '').trim();
    if (!componentKey && !componentNodeId) continue;
    out[String(slotId)] = {
      component_key: componentKey || null,
      component_node_id: componentNodeId || null,
    };
  }
  return Object.keys(out).length > 0 ? out : null;
}

function applyAssignmentOverridesToSlotPack(slotPack, overrides) {
  if (!slotPack || !Array.isArray(slotPack.slots) || slotPack.slots.length === 0) return slotPack;
  if (!overrides || typeof overrides !== 'object') return slotPack;
  const next = {
    ...slotPack,
    slots: slotPack.slots.map((slot) => {
      const ov = overrides[slot.id];
      if (!ov) return slot;
      const candidates = Array.isArray(slot.candidates) ? [...slot.candidates] : [];
      const pref = {
        id: String(ov.component_node_id || '').trim(),
        componentKey: String(ov.component_key || '').trim(),
        name: 'User-confirmed component',
      };
      const already = candidates.find(
        (c) =>
          (pref.id && String(c?.id || '').trim() === pref.id) ||
          (pref.componentKey && String(c?.componentKey || '').trim() === pref.componentKey),
      );
      if (already) {
        const rest = candidates.filter((c) => c !== already);
        return { ...slot, candidates: [already, ...rest] };
      }
      if (pref.id || pref.componentKey) {
        return { ...slot, candidates: [pref, ...candidates] };
      }
      return slot;
    }),
  };
  return next;
}

function assignSlotToAction(action, slotPack) {
  const n = String(action?.name || '').toLowerCase();
  if (!n || !slotPack?.slots?.length) return null;
  let best = null;
  let bestScore = 0;
  for (const s of slotPack.slots) {
    let score = 0;
    for (const h of s.hints || []) {
      if (n.includes(String(h).toLowerCase())) score += 1;
    }
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return best;
}

function enforceSlotCandidateBinding(actionPlan, slotPack) {
  if (!actionPlan || typeof actionPlan !== 'object') return actionPlan;
  if (!slotPack || !Array.isArray(slotPack.slots) || !slotPack.slots.length) return actionPlan;
  const plan = actionPlan;
  if (!Array.isArray(plan.actions)) return plan;
  for (let i = 0; i < plan.actions.length; i++) {
    const a = plan.actions[i];
    if (!a || typeof a !== 'object') continue;
    if (String(a.type || '').trim() !== 'INSTANCE_COMPONENT') continue;
    const slot = assignSlotToAction(a, slotPack);
    if (!slot || !Array.isArray(slot.candidates) || slot.candidates.length === 0) continue;
    a.slot_id = slot.id;
    const currentId = String(a.component_node_id || a.componentNodeId || '').trim();
    const currentKey = String(a.component_key || a.componentKey || a.component_id || '').trim();
    const alreadyValid = slot.candidates.some(
      (c) => (c.id && c.id === currentId) || (c.componentKey && c.componentKey === currentKey),
    );
    if (alreadyValid) continue;
    const chosen = slot.candidates[0];
    if (chosen.componentKey) a.component_key = chosen.componentKey;
    if (chosen.id) a.component_node_id = chosen.id;
  }
  return plan;
}

/**
 * Success-path: ogni INSTANCE_COMPONENT deve avere `component_node_id` se l’indice DS lo conosce,
 * così il plugin risolve prima in-file (getNodeById) senza dipendere dall’import via key.
 */
function hydrateInstanceComponentRefsFromDsIndex(actionPlan, dsContextIndex) {
  if (!actionPlan || typeof actionPlan !== 'object' || !Array.isArray(actionPlan.actions)) return actionPlan;
  if (!dsContextIndex || typeof dsContextIndex !== 'object') return actionPlan;
  const components = Array.isArray(dsContextIndex.components) ? dsContextIndex.components : [];
  if (!components.length) return actionPlan;
  const byKey = new Map();
  for (const c of components) {
    const k = String(c?.componentKey || c?.component_key || '').trim();
    if (k) byKey.set(k, c);
  }
  for (const a of actionPlan.actions) {
    if (!a || typeof a !== 'object') continue;
    if (String(a.type || '').trim() !== 'INSTANCE_COMPONENT') continue;
    const key = String(a.component_key || a.componentKey || a.component_id || '').trim();
    const existingId = String(a.component_node_id || a.componentNodeId || '').trim();
    if (existingId && /^\d+:\d+$/.test(existingId)) continue;
    if (!key) continue;
    const row = byKey.get(key);
    const id = row && String(row.id || '').trim();
    if (id && /^\d+:\d+$/.test(id)) {
      a.component_node_id = id;
    }
  }
  return actionPlan;
}

/**
 * Login fallback: if no explicit logo instance is present, try to place one logo/brand component
 * near the top so screens with brand systems do not miss identity by default.
 */
function enforceLogoFallbackForLogin(actionPlan, prompt, dsContextIndex) {
  if (!actionPlan || typeof actionPlan !== 'object' || !Array.isArray(actionPlan.actions)) return actionPlan;
  if (!/\b(login|sign[\s-]?in|auth)\b/i.test(String(prompt || ''))) return actionPlan;
  if (!dsContextIndex || typeof dsContextIndex !== 'object') return actionPlan;
  const components = Array.isArray(dsContextIndex.components) ? dsContextIndex.components : [];
  if (!components.length) return actionPlan;

  const hasLogoInstance = actionPlan.actions.some((a) => {
    if (!a || typeof a !== 'object') return false;
    if (String(a.type || '').trim() !== 'INSTANCE_COMPONENT') return false;
    const n = String(a.name || '').toLowerCase();
    const key = String(a.component_key || a.componentKey || a.component_id || '').trim();
    const id = String(a.component_node_id || a.componentNodeId || '').trim();
    const fromIndex =
      components.find((c) => String(c?.componentKey || '').trim() === key) ||
      components.find((c) => String(c?.id || '').trim() === id) ||
      null;
    const inName = /\b(logo|brand|wordmark|logotype)\b/i.test(n);
    const inComponent = /\b(logo|brand|wordmark|logotype)\b/i.test(String(fromIndex?.name || '').toLowerCase());
    return inName || inComponent;
  });
  if (hasLogoInstance) return actionPlan;

  const logoCandidate = components.find((c) =>
    /\b(logo|brand|wordmark|logotype)\b/i.test(String(c?.name || '').toLowerCase()),
  );
  if (!logoCandidate) return actionPlan;

  const parent =
    actionPlan.actions.find((a) => a && typeof a === 'object' && String(a.type || '').toUpperCase() === 'CREATE_FRAME')
      ?.ref || 'root';
  actionPlan.actions.unshift({
    type: 'INSTANCE_COMPONENT',
    name: 'Brand Logo',
    parentId: parent,
    ...(logoCandidate.componentKey ? { component_key: String(logoCandidate.componentKey) } : {}),
    ...(logoCandidate.id ? { component_node_id: String(logoCandidate.id) } : {}),
  });
  return actionPlan;
}

function validateSlotCoverage(actionPlan, slotPack) {
  if (!slotPack || !Array.isArray(slotPack.slots) || !slotPack.slots.length) return { valid: true, errors: [] };
  if (!actionPlan || typeof actionPlan !== 'object') return { valid: true, errors: [] };
  const actions = Array.isArray(actionPlan.actions) ? actionPlan.actions : [];
  const covered = new Set();
  for (const a of actions) {
    if (!a || typeof a !== 'object') continue;
    if (String(a.type || '').trim() !== 'INSTANCE_COMPONENT') continue;
    const id = String(a.component_node_id || a.componentNodeId || '').trim();
    const key = String(a.component_key || a.componentKey || a.component_id || '').trim();
    for (const s of slotPack.slots) {
      const ok = (s.candidates || []).some((c) => (c.id && c.id === id) || (c.componentKey && c.componentKey === key));
      if (ok) covered.add(s.id);
    }
  }
  const missing = slotPack.slots.filter((s) => s.required && !covered.has(s.id)).map((s) => s.id);
  if (missing.length) {
    return {
      valid: false,
      errors: [`Required component slots not covered by valid DS instance candidates: ${missing.join(', ')}`],
    };
  }
  return { valid: true, errors: [] };
}

function validateLayoutQualityContract(actionPlan, prompt, mode, dsSource, dsIndexForValidation, slotPack, generationSpec = null) {
  const modeNorm = String(mode || '').toLowerCase();
  if (modeNorm !== 'create' && modeNorm !== 'screenshot') return { valid: true, errors: [] };
  if (!actionPlan || typeof actionPlan !== 'object') return { valid: true, errors: [] };
  const actions = Array.isArray(actionPlan.actions) ? actionPlan.actions : [];
  if (!actions.length) return { valid: false, errors: ['Action plan has no actions.'] };

  const isDesktop = !isMobilePrompt(prompt);
  const isHero = isHeroPrompt(prompt, slotPack?.archetype);
  const isCustom = isCustomDsSource(dsSource);
  const componentsInIndex = Array.isArray(dsIndexForValidation?.components) ? dsIndexForValidation.components.length : 0;
  const minInstances = Number(process.env.GENERATE_QUALITY_MIN_INSTANCES || (isHero ? 1 : isDesktop ? 3 : 2));
  const minFrames = Number(process.env.GENERATE_QUALITY_MIN_FRAMES || (isDesktop ? 2 : 1));

  let instanceCount = 0;
  let frameCount = 0;
  let textCount = 0;
  let hasSubstantialFrame = false;
  let hasHeroNamedFrame = false;
  let hasCtaLikeAction = false;
  for (const a of actions) {
    const t = String(a?.type || '').toUpperCase();
    if (t === 'INSTANCE_COMPONENT') instanceCount += 1;
    if (t === 'CREATE_FRAME') frameCount += 1;
    if (t === 'CREATE_TEXT') textCount += 1;
    const nameLike = `${String(a?.name || '')} ${String(a?.ref || '')} ${String(a?.slot_id || '')}`.toLowerCase();
    if (t === 'CREATE_FRAME') {
      const w = Number(a?.width);
      const h = Number(a?.height);
      if (
        Number.isFinite(w) &&
        Number.isFinite(h) &&
        w >= (isDesktop ? 720 : 300) &&
        h >= (isHero ? (isDesktop ? 280 : 220) : isDesktop ? 240 : 160)
      ) {
        hasSubstantialFrame = true;
      }
      if (/\b(hero|banner|landing|above[-_\s]?fold)\b/i.test(nameLike)) hasHeroNamedFrame = true;
    }
    if (/\b(primary_cta|secondary_cta|cta|button|action|get started|start)\b/i.test(nameLike)) {
      hasCtaLikeAction = true;
    }
  }

  const errors = [];
  if (frameCount < minFrames) {
    errors.push(`Layout contract: requires at least ${minFrames} CREATE_FRAME actions (found ${frameCount}).`);
  }
  if (isCustom && componentsInIndex > 0 && instanceCount < minInstances) {
    errors.push(
      `Layout contract: requires at least ${minInstances} INSTANCE_COMPONENT actions for custom DS output (found ${instanceCount}).`,
    );
  }
  if (textCount < 1) {
    errors.push('Layout contract: requires at least one CREATE_TEXT action for visible semantic content.');
  }
  if (isHero) {
    if (!hasSubstantialFrame) {
      errors.push('Hero contract: requires a substantial hero section frame; thin strips are not acceptable.');
    }
    if (!hasHeroNamedFrame) {
      errors.push('Hero contract: requires a semantically named hero/banner frame or ref.');
    }
    if (textCount < 2) {
      errors.push('Hero contract: requires at least headline and supporting copy text nodes.');
    }
    if (!hasCtaLikeAction) {
      errors.push('Hero contract: requires a visible primary CTA action after the copy.');
    }
  }
  if (generationSpec && Array.isArray(generationSpec.required_slots) && generationSpec.required_slots.length > 0) {
    for (const slot of generationSpec.required_slots) {
      if (!slot || typeof slot !== 'object') continue;
      const id = String(slot.id || '').trim().toLowerCase();
      if (!id) continue;
      const label = String(slot.label || '').trim().toLowerCase();
      const terms = [id, label, ...(Array.isArray(slot.component_search_terms) ? slot.component_search_terms : [])]
        .map((x) => String(x || '').trim().toLowerCase())
        .filter((x) => x.length >= 3);
      const covered = actions.some((a) => {
        if (!a || typeof a !== 'object') return false;
        const hay = [
          String(a.slot_id || a.slotId || ''),
          String(a.name || ''),
          String(a.ref || ''),
          String(a.parent || ''),
          String(a.parentId || ''),
          String(a.text || ''),
        ]
          .join(' ')
          .toLowerCase();
        return terms.some((term) => hay.includes(term));
      });
      if (!covered) {
        errors.push(`Generation spec: required slot "${id}" is not represented in the action plan.`);
      }
    }
  }

  const requiredSlots = (slotPack?.slots || []).filter((s) => s.required).length;
  if (requiredSlots >= 2 && instanceCount < 2) {
    errors.push(
      `Layout contract: this archetype expects multiple DS component slots; at least 2 INSTANCE_COMPONENT required (found ${instanceCount}).`,
    );
  }

  return { valid: errors.length === 0, errors };
}

function summarizeActionPlanShape(actionPlan) {
  const actions = Array.isArray(actionPlan?.actions) ? actionPlan.actions : [];
  let createFrame = 0;
  let createText = 0;
  let createRect = 0;
  let instanceComponent = 0;
  const componentRefs = [];
  for (const a of actions) {
    const t = String(a?.type || '').toUpperCase();
    if (t === 'CREATE_FRAME') createFrame += 1;
    if (t === 'CREATE_TEXT') createText += 1;
    if (t === 'CREATE_RECT') createRect += 1;
    if (t === 'INSTANCE_COMPONENT') {
      instanceComponent += 1;
      const componentKey = String(a?.component_key || a?.componentKey || a?.component_id || '').trim();
      const componentNodeId = String(a?.component_node_id || a?.componentNodeId || '').trim();
      if (componentKey || componentNodeId) {
        componentRefs.push({ component_key: componentKey || null, component_node_id: componentNodeId || null });
      }
    }
  }
  return {
    actions_total: actions.length,
    create_frame: createFrame,
    create_text: createText,
    create_rect: createRect,
    instance_component: instanceComponent,
    component_refs_sample: componentRefs.slice(0, 12),
  };
}

function summarizeSlotPack(slotPack) {
  if (!slotPack || !Array.isArray(slotPack.slots)) return null;
  return {
    archetype: slotPack.archetype || null,
    slots_total: slotPack.slots.length,
    required_slots: slotPack.slots.filter((s) => s.required).map((s) => s.id),
    candidate_counts: slotPack.slots.map((s) => ({ id: s.id, count: Array.isArray(s.candidates) ? s.candidates.length : 0 })),
  };
}

function snapshotValidationState(validators) {
  return {
    schema: Boolean(validators.schemaValidation?.valid),
    ds: Boolean(validators.dsValidation?.valid),
    visible: Boolean(validators.visibleValidation?.valid),
    public_ds_instance: Boolean(validators.publicDsInstanceValidation?.valid),
    custom_ds_instances: Boolean(validators.customDsInstanceValidation?.valid),
    semantic_fit: Boolean(validators.semanticFitValidation?.valid),
    desktop_structure: Boolean(validators.desktopStructureValidation?.valid),
    slot_coverage: Boolean(validators.slotCoverageValidation?.valid),
    quality_contract: Boolean(validators.qualityContractValidation?.valid),
  };
}

function buildDeterministicFallbackPlan({
  prompt,
  mode,
  dsSource,
  dsIndexForValidation,
  slotPack,
  inferredScreenArchetype,
  baseMetadata,
}) {
  const modeNorm = String(mode || '').toLowerCase();
  if (modeNorm !== 'create' && modeNorm !== 'screenshot') return null;
  if (!isCustomDsSource(dsSource)) return null;
  if (!slotPack || !Array.isArray(slotPack.slots) || slotPack.slots.length === 0) return null;
  const components = Array.isArray(dsIndexForValidation?.components) ? dsIndexForValidation.components : [];
  if (!components.length) return null;

  if (isHeroPrompt(prompt, inferredScreenArchetype)) {
    const pickSlotCandidate = (slotId) => slotPack.slots.find((s) => s.id === slotId)?.candidates?.[0] || null;
    const primaryCta = pickSlotCandidate('primary_cta');
    const visual = pickSlotCandidate('visual');
    const isMobile = isMobilePrompt(prompt);
    const actions = [
      {
        type: 'CREATE_FRAME',
        ref: 'hero_section',
        parent: 'root',
        name: 'Hero Banner',
        layoutMode: isMobile ? 'VERTICAL' : 'HORIZONTAL',
        width: isMobile ? 390 : 1200,
        height: isMobile ? 520 : 440,
        itemSpacing: 32,
        paddingTop: 48,
        paddingRight: 48,
        paddingBottom: 48,
        paddingLeft: 48,
      },
      {
        type: 'CREATE_FRAME',
        ref: 'hero_copy',
        parentId: 'hero_section',
        name: 'Hero Copy',
        layoutMode: 'VERTICAL',
        width: isMobile ? 294 : 560,
        itemSpacing: 16,
      },
      {
        type: 'CREATE_TEXT',
        parent: 'hero_copy',
        name: 'Hero Headline',
        text: 'Build better product experiences',
      },
      {
        type: 'CREATE_TEXT',
        parent: 'hero_copy',
        name: 'Hero Supporting Copy',
        text: 'A focused hero section with clear hierarchy, concise copy, and a primary action.',
      },
    ];
    if (primaryCta) {
      actions.push({
        type: 'INSTANCE_COMPONENT',
        parent: 'hero_copy',
        name: 'Primary CTA Button',
        slot_id: 'primary_cta',
        ...(primaryCta.componentKey ? { component_key: primaryCta.componentKey } : {}),
        ...(primaryCta.id ? { component_node_id: primaryCta.id } : {}),
      });
    } else {
      actions.push({
        type: 'CREATE_RECT',
        parent: 'hero_copy',
        name: 'Primary CTA Button',
        width: 160,
        height: 48,
      });
      actions.push({
        type: 'CREATE_TEXT',
        parent: 'hero_copy',
        name: 'Primary CTA Label',
        text: 'Get started',
      });
    }
    if (visual) {
      actions.push({
        type: 'INSTANCE_COMPONENT',
        parent: 'hero_section',
        name: 'Hero Visual',
        slot_id: 'visual',
        ...(visual.componentKey ? { component_key: visual.componentKey } : {}),
        ...(visual.id ? { component_node_id: visual.id } : {}),
      });
    }
    return {
      frame: {
        name: 'Hero Banner',
        width: isMobile ? 390 : 1440,
        height: isMobile ? 844 : 900,
        layoutMode: 'VERTICAL',
      },
      actions,
      metadata: {
        ...(baseMetadata && typeof baseMetadata === 'object' ? baseMetadata : {}),
        fallback_strategy: 'deterministic_hero_blueprint',
        fallback_applied: true,
      },
    };
  }

  const actions = [];
  actions.push({
    type: 'CREATE_FRAME',
    ref: 'root_content',
    parent: 'root',
    name: 'Content',
    layoutMode: 'VERTICAL',
    width: /\bdesktop\b/i.test(String(prompt || '')) ? 1200 : 390,
    height: /\bdesktop\b/i.test(String(prompt || '')) ? 820 : 780,
    itemSpacing: 16,
    paddingTop: 24,
    paddingRight: 24,
    paddingBottom: 24,
    paddingLeft: 24,
  });
  actions.push({
    type: 'CREATE_TEXT',
    parent: 'root_content',
    name: 'Screen Title',
    text: inferredScreenArchetype === 'login' ? 'Welcome back' : 'Generated screen',
  });

  const pickFromSlot = (slotId) => slotPack.slots.find((s) => s.id === slotId)?.candidates?.[0] || null;
  const requiredSlots = slotPack.slots.filter((s) => s.required);
  const used = new Set();

  for (const s of requiredSlots) {
    let candidate = pickFromSlot(s.id);
    if (!candidate) {
      candidate = components
        .map((c) => ({
          id: String(c?.id || ''),
          componentKey: String(c?.componentKey || c?.component_key || ''),
          name: String(c?.name || ''),
        }))
        .find((c) => c.id || c.componentKey);
    }
    if (!candidate) continue;
    const uniq = `${candidate.componentKey || ''}::${candidate.id || ''}`;
    if (used.has(uniq)) continue;
    used.add(uniq);
    actions.push({
      type: 'INSTANCE_COMPONENT',
      parent: 'root_content',
      name: `${s.id}_instance`,
      ...(candidate.componentKey ? { component_key: candidate.componentKey } : {}),
      ...(candidate.id ? { component_node_id: candidate.id } : {}),
    });
  }

  if (requiredSlots.length === 0) {
    const firstCandidate = slotPack.slots[0]?.candidates?.[0];
    if (firstCandidate) {
      actions.push({
        type: 'INSTANCE_COMPONENT',
        parent: 'root_content',
        name: 'primary_component',
        ...(firstCandidate.componentKey ? { component_key: firstCandidate.componentKey } : {}),
        ...(firstCandidate.id ? { component_node_id: firstCandidate.id } : {}),
      });
    }
  }

  if (!actions.some((a) => String(a.type || '').toUpperCase() === 'INSTANCE_COMPONENT')) return null;

  return {
    frame: {
      name: inferredScreenArchetype === 'login' ? 'Login Screen' : 'Generated Screen',
      width: /\bdesktop\b/i.test(String(prompt || '')) ? 1440 : 390,
      height: /\bdesktop\b/i.test(String(prompt || '')) ? 1024 : 844,
      layoutMode: 'VERTICAL',
    },
    actions,
    metadata: {
      ...(baseMetadata && typeof baseMetadata === 'object' ? baseMetadata : {}),
      fallback_strategy: 'deterministic_slot_blueprint',
      fallback_applied: true,
    },
  };
}

const ENHANCE_PLUS_SYSTEM = `You are Enhance Plus for Comtra Generate (Figma). The product already enforces design system usage, layout quality, and accessibility server-side — do NOT lecture the user about those.

Read the user's draft and output ONLY markdown they can paste as their terminal prompt (no preamble, no "Here is…").

Use this structure (omit empty sections):
## Goal
(One tight paragraph: what screen, who it's for, primary job-to-be-done.)

## Context
(One line: viewport, create vs modify selection, language if clear.)

## Must include
(3–8 bullets: concrete sections, components, copy hints, states.)

## Avoid / risks
(0–4 bullets: real conflicts or ambiguities only.)

## Open questions
(0–2 bullets only if something important is unknowable; otherwise omit the section.)

Rules:
- Match the user's language (Italian/English) when obvious.
- Prefer specifics over generic UX advice.
- Keep under ~320 words.`;

app.post('/api/agents/enhance-plus', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!KIMI_API_KEY) return res.status(503).json({ error: 'KIMI_API_KEY not configured' });
  const body = req.body || {};
  const rawPrompt = String(body.prompt ?? body.goal ?? '').trim();
  if (!rawPrompt) return res.status(400).json({ error: 'prompt required' });
  if (rawPrompt.length > 8000) return res.status(400).json({ error: 'prompt too long (max 8000 chars)' });
  const mode = String(body.mode || 'create').toLowerCase();
  const dsSource = String(body.ds_source || body.dsSource || 'custom').trim() || 'custom';
  const hasScreenshot = Boolean(body.has_screenshot ?? body.hasScreenshot);
  const selectionLabel =
    typeof body.selection_label === 'string'
      ? body.selection_label.trim().slice(0, 400)
      : typeof body.selection_summary === 'string'
        ? body.selection_summary.trim().slice(0, 400)
        : '';

  if (!dbSql) return res.status(503).json({ error: 'Database required' });

  let cost = estimateCreditsByAction('enhance_plus');
  try {
    const uRow = await dbSql`SELECT credits_total, credits_used, plan FROM users WHERE id = ${userId} LIMIT 1`;
    if (!uRow.rows.length) return res.status(404).json({ error: 'User not found' });
    const row0 = uRow.rows[0];
    const userPlan = String(row0.plan || 'FREE').toUpperCase();
    if (userPlan === 'PRO') cost = 0;
    const total = Number(row0.credits_total) || 0;
    const used = Number(row0.credits_used) || 0;
    const remaining = Math.max(0, total - used);
    if (cost > 0 && remaining < cost) {
      return res.status(402).json({ error: 'Insufficient credits', credits_remaining: remaining });
    }
  } catch (e) {
    console.error('enhance-plus balance', e);
    return res.status(500).json({ error: 'Server error' });
  }

  const userBlock = [
    `Mode: ${mode}.`,
    `DS source: ${dsSource}.`,
    hasScreenshot ? 'User attached a screenshot reference.' : '',
    selectionLabel ? `Selection / modify target: ${selectionLabel}` : '',
    `Current prompt:\n${rawPrompt}`,
  ]
    .filter(Boolean)
    .join('\n');

  let inputTok = 0;
  let outTok = 0;
  let enhanced = '';
  try {
    const { content, usage } = await callKimi(
      [{ role: 'system', content: ENHANCE_PLUS_SYSTEM }, { role: 'user', content: userBlock }],
      2048,
    );
    enhanced = String(content || '').trim();
    inputTok = Math.max(0, Number(usage?.prompt_tokens ?? usage?.input_tokens ?? 0));
    outTok = Math.max(0, Number(usage?.completion_tokens ?? usage?.output_tokens ?? 0));
  } catch (e) {
    console.error('enhance-plus kimi', e?.message || e);
    return res.status(502).json({ error: 'AI enhance failed' });
  }
  if (!enhanced) return res.status(502).json({ error: 'Empty response from AI' });
  const clipped = enhanced.length > 12000 ? `${enhanced.slice(0, 12000)}\n…(truncated)` : enhanced;

  let credits_remaining;
  let credits_total;
  let credits_used;
  try {
    if (cost > 0) {
      await dbSql`UPDATE users SET credits_used = credits_used + ${cost}, updated_at = NOW() WHERE id = ${userId}`;
      await dbSql`INSERT INTO credit_transactions (user_id, action_type, credits_consumed, file_id) VALUES (${userId}, ${'enhance_plus'}, ${cost}, ${null})`;
    }
    const xpEarned = XP_BY_ACTION.enhance_plus ?? 0;
    if (xpEarned > 0) {
      const ux = await dbSql`SELECT total_xp, current_level FROM users WHERE id = ${userId} LIMIT 1`;
      if (ux.rows.length) {
        const oldXp = Math.max(0, Number(ux.rows[0].total_xp) || 0);
        const totalXp = oldXp + xpEarned;
        const info = getLevelInfo(totalXp);
        const currentLevel = info.level;
        await dbSql`UPDATE users SET total_xp = ${totalXp}, current_level = ${currentLevel}, updated_at = NOW() WHERE id = ${userId}`;
        await dbSql`INSERT INTO xp_transactions (user_id, action_type, xp_earned) VALUES (${userId}, ${'enhance_plus'}, ${xpEarned})`;
      }
    }
    const r2 = await dbSql`SELECT credits_total, credits_used FROM users WHERE id = ${userId} LIMIT 1`;
    credits_total = Number(r2.rows[0].credits_total) || 0;
    credits_used = Number(r2.rows[0].credits_used) || 0;
    credits_remaining = Math.max(0, credits_total - credits_used);
    dbSql`
      INSERT INTO kimi_usage_log (action_type, input_tokens, output_tokens, size_band, model)
      VALUES (${'enhance_plus'}, ${inputTok}, ${outTok}, null, ${KIMI_MODEL})
    `.catch((err) => console.error('Kimi usage log enhance_plus failed', err?.message || err));
          } catch (e) {
    console.error('enhance-plus post', e);
    return res.status(500).json({ error: 'Server error' });
  }

  res.json({
    enhanced_prompt: clipped,
    credits_consumed: cost,
    credits_remaining,
    credits_total,
    credits_used,
  });
});

function sanitizeImportNarrationText(raw) {
  let t = String(raw || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_`[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > 420) t = `${t.slice(0, 417)}…`;
  return t;
}

const IMPORT_NARRATION_SYSTEM = {
  welcome: `You write microcopy for Comtra (Figma plugin). Output ONLY one or two short sentences (max 44 words total). English. Playful, confident, design-tool native — never stiff corporate. The designer is starting a guided import: Comtra will read tokens, styles, and components from the **Figma file they already have open** (live session) — not from an uploaded .fig. If a file name is given, you may mention it once. No quotation marks. No markdown. No bullets.`,
  session_locked: `Output ONLY one punchy sentence (max 34 words). English. The user just confirmed: Comtra may sponge design-system context from their **live Figma session** (the open file). Tone: cheeky, warm, irreverent senior-designer energy — confident, not rude. No quotes. No markdown.`,
  tokens_done: `Output ONLY one or two short sentences (max 40 words). English. Playful. The import wizard finished reading variables (tokens) and local styles from their file; give a tiny "nice, foundations in view" vibe. Use the counts in the user message if useful. No markdown.`,
  components_done: `Output ONLY one or two short sentences (max 44 words). English. Playful. The heavy component / variant scan for the catalog just finished — they're almost ready to generate. Acknowledge the win without sounding like a loading spinner. No markdown.`,
};

app.post('/api/agents/import-narration', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!KIMI_API_KEY) return res.status(503).json({ error: 'KIMI_API_KEY not configured' });
  const body = req.body || {};
  const kind = String(body.kind || '').toLowerCase();
  const allowed = new Set(['welcome', 'session_locked', 'tokens_done', 'components_done']);
  if (!allowed.has(kind)) return res.status(400).json({ error: 'invalid kind' });
  const system = IMPORT_NARRATION_SYSTEM[kind];
  if (!system) return res.status(400).json({ error: 'invalid kind' });

  const fileName = typeof body.file_name === 'string' ? body.file_name.trim().slice(0, 200) : '';
  const hint = typeof body.hint === 'string' ? body.hint.trim().slice(0, 600) : '';

  const userBlock = [
    `Narration kind: ${kind}.`,
    fileName ? `Open Figma file name: ${fileName}` : 'Open Figma file name: (unknown)',
    hint ? `Context:\n${hint}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  let inputTok = 0;
  let outTok = 0;
  let text = '';
  try {
    const { content, usage } = await callKimi(
      [{ role: 'system', content: system }, { role: 'user', content: userBlock }],
      220,
    );
    text = sanitizeImportNarrationText(content);
    inputTok = Math.max(0, Number(usage?.prompt_tokens ?? usage?.input_tokens ?? 0));
    outTok = Math.max(0, Number(usage?.completion_tokens ?? usage?.output_tokens ?? 0));
  } catch (e) {
    console.error('import-narration kimi', e?.message || e);
    return res.status(502).json({ error: 'AI narration failed' });
  }
  if (!text) return res.status(502).json({ error: 'Empty narration' });

  if (dbSql) {
    dbSql`
      INSERT INTO kimi_usage_log (action_type, input_tokens, output_tokens, size_band, model)
      VALUES (${'import_narration'}, ${inputTok}, ${outTok}, null, ${KIMI_MODEL})
    `.catch((err) => console.error('Kimi usage log import_narration failed', err?.message || err));
  }

  res.json({ text });
});

app.post('/api/agents/generate', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const body = req.body || {};
  const legacyFileKey = (body.file_key || body.fileKey || '').trim();
  const prompt = (body.prompt || body.promptText || '').trim();
  const mode = body.mode || 'create';
  const dsSource = body.ds_source || body.dsSource || 'custom';
  const dsContextIndex = body.ds_context_index;
  const dsCacheHashFromBody = String(body.ds_cache_hash || body.dsCacheHash || '').trim();
  const assignmentOverrides = normalizeAssignmentOverrides(
    body.component_assignment_overrides || body.componentAssignmentOverrides,
  );
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

  if (
    !legacyFileKey &&
    !(body?.design_document && typeof body.design_document === 'object') &&
    !(body?.designDocument && typeof body.designDocument === 'object') &&
    !(body?.file_json && typeof body.file_json === 'object') &&
    !(body?.fileJson && typeof body.fileJson === 'object') &&
    !(body?.source_ref && typeof body.source_ref === 'object')
  ) {
    return res.status(400).json({ error: 'file_key/source_ref.doc_id or design_document required' });
  }
  if (!prompt) return res.status(400).json({ error: 'prompt required' });
  if (!KIMI_API_KEY) return res.status(503).json({ error: 'KIMI_API_KEY not configured' });

  const shot = normalizeScreenshotFromBody(body);
  if (shot.error) return res.status(400).json({ error: shot.error });
  const screenshotDataUrl = shot.dataUrl;

  /** Phase 3: 2× Kimi default. Opt out: USE_KIMI_SWARM=0 / false. */
  const useKimiDualSwarmPipeline =
    process.env.USE_KIMI_SWARM !== '0' && process.env.USE_KIMI_SWARM !== 'false';

  const abVariant = Math.random() < 0.5 ? 'A' : 'B';
  let variant = abVariant;
  const generateChatModel = resolveGenerateChatModel(abVariant);
  const callKimiGenerate = (messages, maxTokens = 8192) => callKimi(messages, maxTokens, generateChatModel);

  const startMs = Date.now();
  const generateBudgetMs = Math.max(120000, Number(process.env.GENERATE_REQUEST_BUDGET_MS || 240000));
  const budgetLeftMs = () => generateBudgetMs - (Date.now() - startMs);
  const phaseTimers = {
    started_at_ms: startMs,
    resolve_source_ms: null,
    model_ms: null,
    validation_ms: null,
    total_ms: null,
  };
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let generationPipeline = 'legacy_direct_json';
  let dualPipelineSucceeded = false;
  const repairStats = {
    repair_passes_attempted: 0,
    repair_passes_with_valid_json: 0,
    semantic_escape_hatch_attempted: false,
    semantic_escape_hatch_with_valid_json: false,
  };

  let systemPrompt;
  try {
    systemPrompt = readFileSync(GENERATE_PROMPT_PATH, 'utf8');
    if (!systemPrompt || systemPrompt.length === 0) throw new Error('empty');
  } catch (e) {
    console.error('Generate: failed to read prompt', GENERATE_PROMPT_PATH, e?.message);
    return res.status(500).json({ error: 'System prompt not found' });
  }

  try {
    let fileJson;
    let resolvedDocKey = legacyFileKey || '';
    try {
      const resolved = await resolveDesignDocumentFromBody({ body, userId, fallbackScope: 'all' });
      fileJson = resolved.fileJson;
      resolvedDocKey = resolved.fileKey || resolvedDocKey;
      phaseTimers.resolve_source_ms = Date.now() - startMs;
    } catch (resolveErr) {
      const status = Number(resolveErr?.status) || 400;
      const code = resolveErr?.code;
      const msg = resolveErr?.message || 'Invalid design source';
      if (code) return res.status(status).json({ error: msg, code });
      return res.status(status).json({ error: msg });
    }
    const docContextKey = resolvedDocKey || 'inline-design-document';
    const pageCount = fileJson?.document?.children?.length ?? 0;
    const dsContextBlock = dsPackage ? buildDsContextForPrompt(dsPackage, contextProfile) : 'Resolved DS package: unavailable (fallback to semantic DS hint only).';
    const dsIndexForValidation =
      dsContextIndex && typeof dsContextIndex === 'object' && !Array.isArray(dsContextIndex)
        ? dsContextIndex
        : null;
    const customDsIndexReadiness = validateCustomDsIndexReadiness(mode, dsSource, dsIndexForValidation);
    if (!customDsIndexReadiness.valid) {
      return res.status(412).json({
        error: 'Custom DS context index is missing or incomplete',
        code: 'DS_CONTEXT_INDEX_REQUIRED',
        details: customDsIndexReadiness.errors,
      });
    }
    const patternsPayload = loadPatternsPayload();
    const { legacyScreenKey: inferredScreenArchetype, packV2ArchetypeId } = inferFocusedScreenTypeWithPack(
      prompt,
      patternsPayload,
    );
    const dsHashForCache =
      String(dsCacheHashFromBody || '').trim() ||
      (dsIndexForValidation && typeof dsIndexForValidation.hash === 'string' ? dsIndexForValidation.hash : '') ||
      'nohash';

    let generationSpecCacheHit = false;

    const fetchTovAdminOverrides = async () => {
      if (!dbSql) return null;
      try {
        const tovRow = await dbSql`
          SELECT prompt_overrides FROM generate_tov_config WHERE singleton = 'default' LIMIT 1
        `;
        const po = tovRow.rows?.[0]?.prompt_overrides;
        if (po && typeof po === 'object' && !Array.isArray(po)) return po;
      } catch (tovErr) {
        const msg = String(tovErr?.message || '');
        if (!/does not exist|relation|no such table/i.test(msg)) {
          console.error('generate_tov_config read', msg);
        }
      }
      return null;
    };

    const callKimiSpec = (messages, maxTokens = 2200) => callKimi(messages, maxTokens, KIMI_GENERATION_SPEC_MODEL);

    const resolveGenerationSpecPhase = async () => {
      let generationSpec = null;
      let generationSpecUsed = false;
      let specIn = 0;
      let specOut = 0;
      let cacheHit = false;
      if (!(mode === 'create' || mode === 'screenshot') || budgetLeftMs() <= 90000) {
        return { generationSpec, generationSpecUsed, specIn, specOut, cacheHit };
      }
      const specKey = prepCacheKeySpec({
        prompt,
        mode,
        dsHash: dsHashForCache,
        archetype: inferredScreenArchetype,
        packId: packV2ArchetypeId,
        specModel: KIMI_GENERATION_SPEC_MODEL,
      });
      if (prepCacheEnabled) {
        const hit = prepCacheGet(specKey);
        if (hit?.spec && typeof hit.spec === 'object') {
          return {
            generationSpec: hit.spec,
            generationSpecUsed: true,
            specIn: 0,
            specOut: 0,
            cacheHit: true,
          };
        }
      }
      try {
        const specRes = await runGenerationSpecResolver({
          callKimi: callKimiSpec,
          extractJsonFromContent,
          userPrompt: prompt,
          inferredScreenArchetype,
          packV2ArchetypeId,
          dsContextIndex: dsIndexForValidation,
          patternsPayload,
        });
        if (specRes?.spec) {
          generationSpec = specRes.spec;
          generationSpecUsed = true;
          specIn = Math.max(0, Number(specRes.usage?.input ?? specRes.usage?.prompt_tokens ?? 0));
          specOut = Math.max(0, Number(specRes.usage?.output ?? specRes.usage?.completion_tokens ?? 0));
          if (prepCacheEnabled) prepCacheSet(specKey, { spec: generationSpec }, prepCacheTtlMs);
        }
      } catch (specErr) {
        console.error('Generation spec resolver failed', specErr?.message || specErr);
      }
      return { generationSpec, generationSpecUsed, specIn, specOut, cacheHit: false };
    };

    const [adminPromptOverrides, specPhase] = await Promise.all([fetchTovAdminOverrides(), resolveGenerationSpecPhase()]);
    let generationSpec = specPhase.generationSpec;
    let generationSpecUsed = specPhase.generationSpecUsed;
    totalInputTokens += specPhase.specIn;
    totalOutputTokens += specPhase.specOut;
    generationSpecCacheHit = specPhase.cacheHit;

    const generationSpecBlock = generationSpecToPromptBlock(generationSpec);
    const retrievalPrompt = [prompt, generationSpecSearchText(generationSpec)].filter(Boolean).join('\n');
    const isCustomSourceForPrompt = isCustomDsSource(dsSource);
    const promptTopKComponents = isCustomSourceForPrompt
      ? Number(process.env.GENERATE_DS_PROMPT_COMPONENTS_CUSTOM || 40)
      : Number(process.env.GENERATE_DS_PROMPT_COMPONENTS || 32);
    const promptTopKVariables = isCustomSourceForPrompt
      ? Number(process.env.GENERATE_DS_PROMPT_VARIABLES_CUSTOM || 64)
      : Number(process.env.GENERATE_DS_PROMPT_VARIABLES || 48);

    let dsPromptIndexCacheHit = false;
    const dsPromptKey = prepCacheKeyDsPrompt({
      dsHash: dsHashForCache,
      retrievalPrompt,
      topKComponents: promptTopKComponents,
      topKVariables: promptTopKVariables,
    });
    let dsIndexForPrompt = null;
    if (prepCacheEnabled && dsIndexForValidation) {
      const hit = prepCacheGet(dsPromptKey);
      if (hit?.dsIndexForPrompt && typeof hit.dsIndexForPrompt === 'object') {
        dsIndexForPrompt = JSON.parse(JSON.stringify(hit.dsIndexForPrompt));
        dsPromptIndexCacheHit = true;
      }
    }
    if (!dsIndexForPrompt && dsIndexForValidation) {
      dsIndexForPrompt = buildPromptScopedDsIndex(dsIndexForValidation, retrievalPrompt, {
        topKComponents: promptTopKComponents,
        topKVariables: promptTopKVariables,
      });
      if (prepCacheEnabled) prepCacheSet(dsPromptKey, { dsIndexForPrompt }, prepCacheTtlMs);
    }
    const dsIndexHashLine =
      dsCacheHashFromBody ||
      (dsIndexForValidation && typeof dsIndexForValidation.hash === 'string' ? dsIndexForValidation.hash : '') ||
      'n/a';
    const dsIndexBlock = dsIndexForPrompt
      ? [
          '',
          '[DS CONTEXT INDEX]',
          'Prompt-scoped DS index retrieved from the imported file catalog. For file-scoped DS, use only component ids/keys and variable names that appear in this JSON.',
          JSON.stringify(dsIndexForPrompt),
          '[END DS CONTEXT INDEX]',
          `ds_cache_hash: ${dsIndexHashLine}`,
        ].join('\n')
      : '';
    const slotCandidatePackBase =
      buildSlotCandidatePackFromGenerationSpec(dsIndexForValidation, generationSpec, prompt) ||
      buildSlotCandidatePack(dsIndexForValidation, inferredScreenArchetype, prompt);
    const slotCandidatePack = applyAssignmentOverridesToSlotPack(slotCandidatePackBase, assignmentOverrides);
    const slotCandidateBlock = formatSlotCandidateBlock(slotCandidatePack);
    const qualityContractLine =
      mode === 'create' || mode === 'screenshot'
        ? 'QUALITY CONTRACT: produce a coherent, visible screen with real DS instances (not primitives-only), meaningful hierarchy, and semantic role coverage for the inferred archetype.'
        : null;
    const designIntelBlock = formatDesignIntelligenceForPrompt(docContextKey, {
      focusScreenType: inferredScreenArchetype,
      userPrompt: prompt,
      patternsPayload,
      packV2ArchetypeId,
    });
    const wizardSignals =
      dsIndexForValidation &&
      typeof dsIndexForValidation.wizard_signals === 'object' &&
      !Array.isArray(dsIndexForValidation.wizard_signals)
        ? dsIndexForValidation.wizard_signals
        : null;
    const wizardSignalsBlock = formatWizardSignalsBlock(wizardSignals);

    const comtraTovRes = resolveComtraTovResolution(wizardSignalsBlock, adminPromptOverrides);
    const comtraTovBlock = comtraTovRes.block;
    const comtraTovSource = comtraTovRes.source;

    let kimiEnrichmentBlock = '';
    let kimiEnrichmentUsed = false;
    let kimiEnrichmentCacheHit = false;
    const cdRoot =
      patternsPayload && typeof patternsPayload.content_defaults === 'object' && !Array.isArray(patternsPayload.content_defaults)
        ? patternsPayload.content_defaults
        : null;
    const cdEntry =
      packV2ArchetypeId && cdRoot && typeof cdRoot[packV2ArchetypeId] === 'object' && !Array.isArray(cdRoot[packV2ArchetypeId])
        ? cdRoot[packV2ArchetypeId]
        : null;
    const toneW = wizardSignals && typeof wizardSignals.tone_of_voice === 'string' ? wizardSignals.tone_of_voice.trim() : '';
    const kwW =
      wizardSignals && Array.isArray(wizardSignals.brand_voice_keywords)
        ? wizardSignals.brand_voice_keywords.map((x) => String(x || '').trim()).filter(Boolean)
        : [];
    if (cdEntry && (toneW || kwW.length) && budgetLeftMs() > 75000) {
      try {
        const tovRule = patternsPayload?.wizard_integration?.override_rules?.tov_enrichment_trigger;
        const charLimits =
          tovRule && typeof tovRule === 'object' && tovRule.char_limits && typeof tovRule.char_limits === 'object'
            ? tovRule.char_limits
            : undefined;
        const enrich = await runKimiContentDefaultsEnrichment({
          callKimi: callKimiGenerate,
          archetypeId: packV2ArchetypeId,
          contentDefaultsEntry: cdEntry,
          kimiEnrichableFields: cdEntry.kimi_enrichable_fields,
          toneOfVoice: toneW || null,
          brandVoiceKeywords: kwW.length ? kwW : null,
          charLimits,
          cacheUserId: userId,
          cachePartition: generateChatModel,
        });
        if (enrich.used) {
          kimiEnrichmentBlock = enrich.block;
          kimiEnrichmentUsed = true;
          if (enrich.cacheHit) kimiEnrichmentCacheHit = true;
          totalInputTokens += enrich.usage.input;
          totalOutputTokens += enrich.usage.output;
        }
      } catch (enrErr) {
        console.error('Kimi content enrichment failed', enrErr?.message || enrErr);
      }
    }
    const primaryCustomDsSuccessLine =
      isCustomDsSource(dsSource) && (mode === 'create' || mode === 'screenshot')
        ? 'PRIMARY SUCCESS (custom/file DS): Ship the screen with INSTANCE_COMPONENT for real components from [DS CONTEXT INDEX] (buttons, inputs, cards, headers, etc.). Prefer components[].componentKey when present, else components[].id. If the index lists components, a primitives-only plan (frames + rects + plain text only) is a failed generation — not an acceptable fallback.'
        : null;
    const packV2AuthArchetypes = new Set([
      'login',
      'register',
      'forgot_password',
      'email_verification',
      'pin_biometric',
      'onboarding_step',
    ]);
    const semanticGuardrailLine =
      inferredScreenArchetype === 'login' ||
      (packV2ArchetypeId && packV2AuthArchetypes.has(packV2ArchetypeId))
        ? 'SEMANTIC SAFETY (login/auth): never use step/progress/wizard/breadcrumb/timeline components for fields/buttons/CTA. If no suitable component exists, replace that slot with CREATE_RECT + CREATE_TEXT.'
        : null;
    const contextBlob = [
      `Mode: ${mode}.`,
      inferredScreenArchetype
        ? `Inferred screen archetype: ${inferredScreenArchetype}${
            packV2ArchetypeId ? ` (pack v2 archetype: ${packV2ArchetypeId})` : ''
          } (layout and checklist prioritize this type).`
        : 'Inferred screen archetype: none — full pattern library in DESIGN INTELLIGENCE block.',
      `DS source: ${dsSource}.`,
      `Resolved DS id: ${resolvedDsId || 'none'}.`,
      `Context profile: platform=${contextProfile.platform}, density=${contextProfile.density}, input_mode=${contextProfile.input_mode}, selection_type=${contextProfile.selection_type}.`,
      `File has ${pageCount} page(s).`,
      isCustomSourceForPrompt
        ? 'Use only variable references that appear in [DS CONTEXT INDEX].variable_names. If no exact variable fits, omit the style property instead of inventing a token.'
        : 'Use only variable references from the bundled DS package (no raw hex/px).',
      ...(primaryCustomDsSuccessLine ? [primaryCustomDsSuccessLine] : []),
      ...(semanticGuardrailLine ? [semanticGuardrailLine] : []),
      ...(qualityContractLine ? [qualityContractLine] : []),
      dsContextBlock,
      generationSpecBlock,
      dsIndexBlock,
      slotCandidateBlock,
      designIntelBlock,
      wizardSignalsBlock,
      kimiEnrichmentBlock,
      comtraTovBlock,
    ].join('\n');

    let actionPlan = null;
    const forceDirectForVision = Boolean(screenshotDataUrl);

    if (useKimiDualSwarmPipeline && budgetLeftMs() > 100000) {
      try {
        const dual = await runGenerateDualCallPipeline({
          callKimi: callKimiGenerate,
          extractJsonFromContent,
          userPrompt: prompt,
          contextBlob,
          actionPlanSystemPrompt: systemPrompt,
          screenshotDataUrl,
        });
        totalInputTokens += dual.usage.input;
        totalOutputTokens += dual.usage.output;
        if (dual.actionPlan && typeof dual.actionPlan === 'object') {
          actionPlan = dual.actionPlan;
          dualPipelineSucceeded = true;
          generationPipeline = 'kimi_dual_layout_mapper';
    } else {
          console.error('Generate dual pipeline failed:', dual.stage);
        }
      } catch (dualErr) {
        console.error('Generate dual pipeline error:', dualErr?.message || dualErr);
      }
    }

    if (!actionPlan) {
      const userText = `User prompt:\n${prompt}\n\nContext: ${contextBlob}\n\nReturn only the action plan JSON object, no other text.`;
      const userMessage = screenshotDataUrl
        ? [
            { type: 'image_url', image_url: { url: screenshotDataUrl } },
            { type: 'text', text: userText },
          ]
        : userText;
      const { content, usage } = await callKimiGenerate(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
        8192,
      );
      totalInputTokens += Math.max(0, Number(usage?.input_tokens ?? usage?.prompt_tokens ?? 0));
      totalOutputTokens += Math.max(0, Number(usage?.output_tokens ?? usage?.completion_tokens ?? 0));
      actionPlan = extractJsonFromContent(content);
      if (!dualPipelineSucceeded) generationPipeline = 'legacy_direct_json';
    }

    if (!actionPlan || typeof actionPlan !== 'object') {
      console.error('Generate: invalid or missing JSON from Kimi');
      return res.status(502).json({ error: 'Invalid response from AI' });
    }
    const afterModelMs = Date.now();
    phaseTimers.model_ms = afterModelMs - startMs - (phaseTimers.resolve_source_ms || 0);

    actionPlan = normalizeActionPlanEnvelope(actionPlan, { prompt, mode, dsSource });
    actionPlan = ensureCreateModeHasCreateFrameAction(actionPlan, mode);
    actionPlan = ensureMinimumCreateModeStructureFrames(actionPlan, mode, prompt);
    actionPlan = ensureDesktopStructureHasSubstantialRootFrame(actionPlan, mode, prompt);
    actionPlan = enforceDeterministicSemanticComponentBinding(actionPlan, prompt, dsIndexForValidation);
    actionPlan = enforceSlotCandidateBinding(actionPlan, slotCandidatePack);
    actionPlan = hydrateInstanceComponentRefsFromDsIndex(actionPlan, dsIndexForValidation);
    actionPlan = enforceLogoFallbackForLogin(actionPlan, prompt, dsIndexForValidation);
    let schemaValidation = validateActionPlanSchema(actionPlan);
    let dsValidation = validateActionPlanAgainstDs(actionPlan, dsPackage);
    let visibleValidation = validateActionPlanVisiblePrimitives(actionPlan);
    let publicDsInstanceValidation = validateActionPlanNoInstanceForPublicDs(actionPlan, dsSource);
    let customDsInstanceValidation = validateCustomFileDsRequiresComponentInstances(
      actionPlan,
      dsSource,
      dsIndexForValidation,
    );
    let semanticFitValidation = validateActionPlanComponentSemanticFit(actionPlan, dsIndexForValidation, prompt);
    let desktopStructureValidation = validateDesktopCreateStructure(actionPlan, prompt);
    let slotCoverageValidation = validateSlotCoverage(actionPlan, slotCandidatePack);
    let qualityContractValidation = validateLayoutQualityContract(
      actionPlan,
      prompt,
      mode,
      dsSource,
      dsIndexForValidation,
      slotCandidatePack,
      generationSpec,
    );
    let fileIndexValidation = validateActionPlanAgainstFileDsIndex(actionPlan, dsIndexForValidation);
    const mustRepair =
      !schemaValidation.valid ||
      !dsValidation.valid ||
      !visibleValidation.valid ||
      !publicDsInstanceValidation.valid ||
      !customDsInstanceValidation.valid ||
      !semanticFitValidation.valid ||
      !desktopStructureValidation.valid ||
      !slotCoverageValidation.valid ||
      !qualityContractValidation.valid ||
      (!fileIndexValidation.skipped && !fileIndexValidation.valid);
    if (mustRepair) {
      const structuralErrors = [
        ...schemaValidation.errors.map((e) => `schema: ${e}`),
        ...visibleValidation.errors.map((e) => `visible: ${e}`),
        ...desktopStructureValidation.errors.map((e) => `desktop_structure: ${e}`),
      ];
      const dsErrors = [
        ...dsValidation.errors.map((e) => `ds: ${e}`),
        ...publicDsInstanceValidation.errors.map((e) => `public_ds: ${e}`),
        ...customDsInstanceValidation.errors.map((e) => `custom_ds_instances: ${e}`),
        ...semanticFitValidation.errors.map((e) => `semantic_fit: ${e}`),
        ...slotCoverageValidation.errors.map((e) => `slot_coverage: ${e}`),
        ...qualityContractValidation.errors.map((e) => `quality_contract: ${e}`),
        ...(!fileIndexValidation.skipped ? fileIndexValidation.errors.map((e) => `file_index: ${e}`) : []),
      ];
      const repairPasses = [structuralErrors, dsErrors].filter((errs) => errs.length > 0);
      for (let pass = 0; pass < repairPasses.length; pass++) {
        if (budgetLeftMs() <= 70000) break;
        repairStats.repair_passes_attempted += 1;
        const repair = await repairActionPlanWithKimi(
          systemPrompt,
          actionPlan,
          repairPasses[pass],
          `User prompt: ${prompt}\n\n${contextBlob}`,
          generateChatModel,
        );
        totalInputTokens += Math.max(0, Number(repair?.usage?.input_tokens ?? repair?.usage?.prompt_tokens ?? 0));
        totalOutputTokens += Math.max(0, Number(repair?.usage?.output_tokens ?? repair?.usage?.completion_tokens ?? 0));
        const repaired = extractJsonFromContent(repair?.content);
        if (repaired && typeof repaired === 'object') {
          repairStats.repair_passes_with_valid_json += 1;
          actionPlan = repaired;
          actionPlan = normalizeActionPlanEnvelope(actionPlan, { prompt, mode, dsSource });
          actionPlan = ensureCreateModeHasCreateFrameAction(actionPlan, mode);
          actionPlan = ensureMinimumCreateModeStructureFrames(actionPlan, mode, prompt);
          actionPlan = ensureDesktopStructureHasSubstantialRootFrame(actionPlan, mode, prompt);
          actionPlan = enforceDeterministicSemanticComponentBinding(actionPlan, prompt, dsIndexForValidation);
          actionPlan = enforceSlotCandidateBinding(actionPlan, slotCandidatePack);
          actionPlan = hydrateInstanceComponentRefsFromDsIndex(actionPlan, dsIndexForValidation);
          actionPlan = enforceLogoFallbackForLogin(actionPlan, prompt, dsIndexForValidation);
          schemaValidation = validateActionPlanSchema(actionPlan);
          dsValidation = validateActionPlanAgainstDs(actionPlan, dsPackage);
          visibleValidation = validateActionPlanVisiblePrimitives(actionPlan);
          publicDsInstanceValidation = validateActionPlanNoInstanceForPublicDs(actionPlan, dsSource);
          customDsInstanceValidation = validateCustomFileDsRequiresComponentInstances(
            actionPlan,
            dsSource,
            dsIndexForValidation,
          );
          semanticFitValidation = validateActionPlanComponentSemanticFit(actionPlan, dsIndexForValidation, prompt);
          desktopStructureValidation = validateDesktopCreateStructure(actionPlan, prompt);
          slotCoverageValidation = validateSlotCoverage(actionPlan, slotCandidatePack);
          qualityContractValidation = validateLayoutQualityContract(
            actionPlan,
            prompt,
            mode,
            dsSource,
            dsIndexForValidation,
            slotCandidatePack,
            generationSpec,
          );
          fileIndexValidation = validateActionPlanAgainstFileDsIndex(actionPlan, dsIndexForValidation);
        }
      }
    }

    // Final targeted semantic pass (escape hatch): try once more before returning 422.
    if (!semanticFitValidation.valid && budgetLeftMs() > 55000) {
      repairStats.semantic_escape_hatch_attempted = true;
      const semanticOnlyErrors = semanticFitValidation.errors.map((e) => `semantic_fit: ${e}`);
      const semanticRepair = await repairActionPlanWithKimi(
        systemPrompt,
        actionPlan,
        [
          ...semanticOnlyErrors,
          'Replace semantically incompatible INSTANCE_COMPONENT with either a correct DS component from index or CREATE_RECT + CREATE_TEXT fallback for that slot.',
        ],
        `User prompt: ${prompt}\n\n${contextBlob}`,
        generateChatModel,
      );
      totalInputTokens += Math.max(
        0,
        Number(semanticRepair?.usage?.input_tokens ?? semanticRepair?.usage?.prompt_tokens ?? 0),
      );
      totalOutputTokens += Math.max(
        0,
        Number(semanticRepair?.usage?.output_tokens ?? semanticRepair?.usage?.completion_tokens ?? 0),
      );
      const repairedSemantic = extractJsonFromContent(semanticRepair?.content);
      if (repairedSemantic && typeof repairedSemantic === 'object') {
        repairStats.semantic_escape_hatch_with_valid_json = true;
        actionPlan = repairedSemantic;
        actionPlan = normalizeActionPlanEnvelope(actionPlan, { prompt, mode, dsSource });
        actionPlan = ensureCreateModeHasCreateFrameAction(actionPlan, mode);
        actionPlan = ensureMinimumCreateModeStructureFrames(actionPlan, mode, prompt);
        actionPlan = ensureDesktopStructureHasSubstantialRootFrame(actionPlan, mode, prompt);
        actionPlan = enforceDeterministicSemanticComponentBinding(actionPlan, prompt, dsIndexForValidation);
        actionPlan = enforceSlotCandidateBinding(actionPlan, slotCandidatePack);
        actionPlan = hydrateInstanceComponentRefsFromDsIndex(actionPlan, dsIndexForValidation);
        actionPlan = enforceLogoFallbackForLogin(actionPlan, prompt, dsIndexForValidation);
        schemaValidation = validateActionPlanSchema(actionPlan);
        dsValidation = validateActionPlanAgainstDs(actionPlan, dsPackage);
        visibleValidation = validateActionPlanVisiblePrimitives(actionPlan);
        publicDsInstanceValidation = validateActionPlanNoInstanceForPublicDs(actionPlan, dsSource);
        customDsInstanceValidation = validateCustomFileDsRequiresComponentInstances(
          actionPlan,
          dsSource,
          dsIndexForValidation,
        );
        semanticFitValidation = validateActionPlanComponentSemanticFit(actionPlan, dsIndexForValidation, prompt);
        desktopStructureValidation = validateDesktopCreateStructure(actionPlan, prompt);
        slotCoverageValidation = validateSlotCoverage(actionPlan, slotCandidatePack);
        qualityContractValidation = validateLayoutQualityContract(
          actionPlan,
          prompt,
          mode,
          dsSource,
          dsIndexForValidation,
          slotCandidatePack,
          generationSpec,
        );
        fileIndexValidation = validateActionPlanAgainstFileDsIndex(actionPlan, dsIndexForValidation);
      }
    }

    // P4: final deterministic fallback before returning hard 422 for custom DS create/screenshot flows.
    const fallbackNeeded =
      !customDsInstanceValidation.valid ||
      !semanticFitValidation.valid ||
      !slotCoverageValidation.valid ||
      !qualityContractValidation.valid ||
      (!fileIndexValidation.skipped && !fileIndexValidation.valid);
    if (fallbackNeeded) {
      const deterministicFallback = buildDeterministicFallbackPlan({
        prompt,
        mode,
        dsSource,
        dsIndexForValidation,
        slotPack: slotCandidatePack,
        inferredScreenArchetype,
        baseMetadata: actionPlan?.metadata,
      });
      if (deterministicFallback && typeof deterministicFallback === 'object') {
        actionPlan = deterministicFallback;
        actionPlan = normalizeActionPlanEnvelope(actionPlan, { prompt, mode, dsSource });
        actionPlan = ensureCreateModeHasCreateFrameAction(actionPlan, mode);
        actionPlan = ensureMinimumCreateModeStructureFrames(actionPlan, mode, prompt);
        actionPlan = ensureDesktopStructureHasSubstantialRootFrame(actionPlan, mode, prompt);
        actionPlan = enforceDeterministicSemanticComponentBinding(actionPlan, prompt, dsIndexForValidation);
        actionPlan = enforceSlotCandidateBinding(actionPlan, slotCandidatePack);
        actionPlan = hydrateInstanceComponentRefsFromDsIndex(actionPlan, dsIndexForValidation);
        actionPlan = enforceLogoFallbackForLogin(actionPlan, prompt, dsIndexForValidation);
        schemaValidation = validateActionPlanSchema(actionPlan);
        dsValidation = validateActionPlanAgainstDs(actionPlan, dsPackage);
        visibleValidation = validateActionPlanVisiblePrimitives(actionPlan);
        publicDsInstanceValidation = validateActionPlanNoInstanceForPublicDs(actionPlan, dsSource);
        customDsInstanceValidation = validateCustomFileDsRequiresComponentInstances(
          actionPlan,
          dsSource,
          dsIndexForValidation,
        );
        semanticFitValidation = validateActionPlanComponentSemanticFit(actionPlan, dsIndexForValidation, prompt);
        desktopStructureValidation = validateDesktopCreateStructure(actionPlan, prompt);
        slotCoverageValidation = validateSlotCoverage(actionPlan, slotCandidatePack);
        qualityContractValidation = validateLayoutQualityContract(
          actionPlan,
          prompt,
          mode,
          dsSource,
          dsIndexForValidation,
          slotCandidatePack,
          generationSpec,
        );
        fileIndexValidation = validateActionPlanAgainstFileDsIndex(actionPlan, dsIndexForValidation);
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
        error: 'Action plan missing visible leaf actions (text, rect, or instance)',
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
    if (!customDsInstanceValidation.valid) {
      return res.status(422).json({
        error: 'Custom design system requires at least one component instance in the action plan',
        code: 'CUSTOM_DS_INSTANCES_REQUIRED',
        details: customDsInstanceValidation.errors,
      });
    }
    if (!semanticFitValidation.valid) {
      return res.status(422).json({
        error: 'Action plan selected semantically incompatible DS components',
        code: 'COMPONENT_SEMANTIC_MISMATCH',
        details: semanticFitValidation.errors,
      });
    }
    if (!desktopStructureValidation.valid) {
      return res.status(422).json({
        error: 'Desktop structure is not coherent for this prompt',
        code: 'DESKTOP_STRUCTURE_INVALID',
        details: desktopStructureValidation.errors,
      });
    }
    if (!slotCoverageValidation.valid) {
      return res.status(422).json({
        error: 'Action plan does not cover required DS component slots for this prompt archetype',
        code: 'SLOT_CANDIDATE_COVERAGE_FAILED',
        details: slotCoverageValidation.errors,
      });
    }
    if (!qualityContractValidation.valid) {
      return res.status(422).json({
        error: 'Action plan does not satisfy layout quality contract',
        code: 'QUALITY_CONTRACT_FAILED',
        details: qualityContractValidation.errors,
      });
    }

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
    actionPlan.metadata.inferred_pack_v2_archetype = packV2ArchetypeId ?? null;
    actionPlan.metadata.generation_spec = generationSpec
      ? {
          archetype_id: generationSpec.archetype_id,
          archetype_label: generationSpec.archetype_label,
          confidence: generationSpec.confidence,
          required_slots: (generationSpec.required_slots || []).map((s) => s.id),
          optional_slots: (generationSpec.optional_slots || []).map((s) => s.id),
        }
      : null;
    actionPlan.metadata.kimi_content_enrichment_used = Boolean(kimiEnrichmentUsed);
    actionPlan.metadata.kimi_content_enrichment_cache_hit = Boolean(kimiEnrichmentCacheHit);
    const executorHints = buildDesignIntelligenceExecutorHints(patternsPayload, {
      packV2ArchetypeId,
      inferredScreenArchetype,
    });
    if (executorHints) actionPlan.metadata.design_intelligence_executor = executorHints;
    actionPlan.metadata.generation_pipeline = generationPipeline;
    actionPlan.metadata.ds_source = dsSource;
    actionPlan.metadata.ds_id = dsPackage?.ds_id || resolvedDsId || null;
    actionPlan.metadata.ds_context_strategy = dsIndexForPrompt ? 'full_index_prompt_retrieval' : 'none';
    if (dsIndexForPrompt?.components_retrieval) actionPlan.metadata.ds_components_retrieval = dsIndexForPrompt.components_retrieval;
    if (dsIndexForPrompt?.variable_names_retrieval) actionPlan.metadata.ds_variables_retrieval = dsIndexForPrompt.variable_names_retrieval;
    actionPlan.metadata.context_profile = contextProfile;
    actionPlan.metadata.assignment_overrides_applied = assignmentOverrides
      ? Object.keys(assignmentOverrides).length
      : 0;
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
      component_keys_seen: fileIndexValidation.used?.componentKeys?.length ?? 0,
      variable_refs_seen: fileIndexValidation.used?.variableRefs?.length ?? 0,
    };
    const validationStateFinal = snapshotValidationState({
      schemaValidation,
      dsValidation,
      visibleValidation,
      publicDsInstanceValidation,
      customDsInstanceValidation,
      semanticFitValidation,
      desktopStructureValidation,
      slotCoverageValidation,
      qualityContractValidation,
    });
    const actionPlanShape = summarizeActionPlanShape(actionPlan);
    const slotPackSummary = summarizeSlotPack(slotCandidatePack);
    actionPlan.metadata.generation_diagnostics = {
      pipeline: generationPipeline,
      kimi_model: generateChatModel,
      generate_ab_variant: variant,
      phase_timers: phaseTimers,
      repair: repairStats,
      validation_state_final: validationStateFinal,
      action_plan_shape: actionPlanShape,
      slot_candidates: slotPackSummary,
      token_usage: {
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
      },
      generation_spec: {
        used: Boolean(generationSpecUsed),
        cache_hit: Boolean(generationSpecCacheHit),
        model: KIMI_GENERATION_SPEC_MODEL,
        archetype_id: generationSpec?.archetype_id || null,
        confidence: generationSpec?.confidence ?? null,
      },
      prep_cache: {
        enabled: Boolean(prepCacheEnabled),
        ttl_ms: prepCacheTtlMs,
        generation_spec_hit: Boolean(generationSpecCacheHit),
        ds_prompt_scoped_index_hit: Boolean(dsPromptIndexCacheHit),
      },
      comtra_tov: { source: comtraTovSource },
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
    phaseTimers.validation_ms =
      Date.now() - afterModelMs;
    phaseTimers.total_ms = latencyMs;
    actionPlan.metadata.generation_diagnostics.phase_timers = phaseTimers;

    const responseDiagnostics = actionPlan.metadata.generation_diagnostics;

    if (dbSql) {
      dbSql`
        INSERT INTO kimi_usage_log (action_type, input_tokens, output_tokens, size_band, model)
        VALUES ('generate', ${totalInputTokens}, ${totalOutputTokens}, null, ${generateChatModel})
      `.catch((err) => console.error('Kimi usage log generate failed', err.message));

      const learningSnapshot = JSON.stringify({
        wizard_signals: wizardSignals
          ? { has_tone: Boolean(toneW), keyword_count: kwW.length }
          : null,
        pack_meta: patternsPayload?.meta && typeof patternsPayload.meta === 'object' ? patternsPayload.meta : null,
        inferred_screen_archetype: inferredScreenArchetype ?? null,
        inferred_pack_v2_archetype: packV2ArchetypeId ?? null,
        generation_spec: generationSpec
          ? {
              archetype_id: generationSpec.archetype_id,
              confidence: generationSpec.confidence,
              required_slots: (generationSpec.required_slots || []).map((s) => s.id),
            }
          : null,
      });
      const ins = await dbSql`
        INSERT INTO generate_ab_requests (user_id, variant, input_tokens, output_tokens, credits_consumed, latency_ms, figma_file_key, ds_source, inferred_screen_archetype, inferred_pack_v2_archetype, kimi_enrichment_used, learning_snapshot, kimi_model, generation_route)
        VALUES (${userId}, ${variant}, ${totalInputTokens}, ${totalOutputTokens}, ${creditsConsumed}, ${latencyMs}, ${legacyFileKey || null}, ${String(dsSource)}, ${inferredScreenArchetype || null}, ${packV2ArchetypeId || null}, ${kimiEnrichmentUsed}, ${learningSnapshot}::jsonb, ${generateChatModel}, ${generationPipeline})
        RETURNING id
      `.catch(() => ({ rows: [] }));
      const requestId = ins?.rows?.[0]?.id ?? null;

      console.info(
        '[generate_diagnostics]',
        JSON.stringify({
          request_id: requestId,
          user_id: userId,
          ds_source: dsSource,
          ds_id: dsPackage?.ds_id || resolvedDsId || null,
          diagnostics: responseDiagnostics,
        }),
      );

      res.json({
        action_plan: actionPlan,
        variant,
        kimi_model: generateChatModel,
        generation_route: generationPipeline,
        request_id: requestId,
        ds_id: dsPackage?.ds_id || resolvedDsId || null,
        ds_validation: actionPlan.metadata.ds_validation,
        phase_timers: phaseTimers,
        generation_diagnostics: responseDiagnostics,
      });
    } else {
      console.info(
        '[generate_diagnostics]',
        JSON.stringify({
          request_id: null,
          user_id: userId,
          ds_source: dsSource,
          ds_id: dsPackage?.ds_id || resolvedDsId || null,
          diagnostics: responseDiagnostics,
        }),
      );
      res.json({
        action_plan: actionPlan,
        variant,
        kimi_model: generateChatModel,
        generation_route: generationPipeline,
        request_id: null,
        ds_id: dsPackage?.ds_id || resolvedDsId || null,
        ds_validation: actionPlan.metadata.ds_validation,
        phase_timers: phaseTimers,
        generation_diagnostics: responseDiagnostics,
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
    void dbSql`
      INSERT INTO generation_plugin_events (user_id, request_id, figma_file_key, event_type, payload)
      VALUES (
        ${userId},
        ${requestId},
        null,
        'user_thumbs_feedback',
        ${JSON.stringify({ thumbs, has_comment: Boolean(comment) })}::jsonb
      )
    `.catch((e) => console.error('generation_plugin_events thumbs', e?.message));
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/feedback/generate', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/** Learning loop / telemetria plugin (DI v2): eventi post-generazione (undo, applicato, ecc.). */
app.post('/api/generation/plugin-event', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!dbSql) return res.status(503).json({ error: 'Database required' });
  const body = req.body || {};
  const eventType = String(body.event_type || body.eventType || '')
    .trim()
    .slice(0, 96);
  if (!eventType) return res.status(400).json({ error: 'event_type required' });
  const requestId = body.request_id || body.requestId || null;
  const figmaFileKey = String(body.figma_file_key || body.file_key || body.fileKey || '')
    .trim()
    .slice(0, 256);
  const payload =
    body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload) ? body.payload : {};
  try {
    await dbSql`
      INSERT INTO generation_plugin_events (user_id, request_id, figma_file_key, event_type, payload)
      VALUES (
        ${userId},
        ${requestId},
        ${figmaFileKey || null},
        ${eventType},
        ${JSON.stringify(payload)}::jsonb
      )
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/generation/plugin-event', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/** Pack-driven preflight hints for Generate UI (§15.6) — no credits, inference only. */
app.get('/api/generate/conversation-hints', async (req, res) => {
  const authCtx = getUserAuthContext(req);
  if (!authCtx.userId) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED', reason: authCtx.reason });
  const prompt = String(req.query.prompt || '').trim();
  if (!prompt) return res.status(400).json({ error: 'prompt query param required' });
  if (prompt.length > 16000) return res.status(400).json({ error: 'prompt too long' });
  try {
    const patternsPayload = loadPatternsPayload();
    const { legacyScreenKey, packV2ArchetypeId } = inferFocusedScreenTypeWithPack(prompt, patternsPayload);
    const packPreflight = buildPreflightFromPack(patternsPayload, {
      legacyScreenKey,
      packV2ArchetypeId,
    });
    res.json({
      legacy_screen_key: legacyScreenKey,
      pack_v2_archetype_id: packV2ArchetypeId,
      preflight: packPreflight,
      pack_shape: patternsPayload ? 'loaded' : 'missing',
    });
  } catch (err) {
    console.error('GET /api/generate/conversation-hints', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/** Admin: thread overview for Phase 4 hub / ops (search by title). */
app.get('/api/admin/generate-threads', async (req, res) => {
  if (!isAdminApiRequest(req)) return res.status(403).json({ error: 'Forbidden' });
  if (!dbSql) return res.status(503).json({ error: 'Database required' });
  const q = String(req.query.q || '').trim().slice(0, 200);
  const lim = Math.min(200, Math.max(1, Number(req.query.limit) || 80));
  try {
    const rows = q
      ? await dbSql`
          SELECT gt.id::text AS id, gt.user_id, gt.file_key, gt.ds_cache_hash, gt.title,
                 EXTRACT(EPOCH FROM gt.updated_at) * 1000 AS updated_at_ms,
                 (SELECT COUNT(*)::int FROM generate_messages gm WHERE gm.thread_id = gt.id) AS message_count
          FROM generate_threads gt
          WHERE gt.title ILIKE ${'%' + q + '%'}
          ORDER BY gt.updated_at DESC
          LIMIT ${lim}
        `
      : await dbSql`
          SELECT gt.id::text AS id, gt.user_id, gt.file_key, gt.ds_cache_hash, gt.title,
                 EXTRACT(EPOCH FROM gt.updated_at) * 1000 AS updated_at_ms,
                 (SELECT COUNT(*)::int FROM generate_messages gm WHERE gm.thread_id = gt.id) AS message_count
          FROM generate_threads gt
          ORDER BY gt.updated_at DESC
          LIMIT ${lim}
        `;
    res.json({ threads: rows.rows || [] });
  } catch (err) {
    console.error('GET /api/admin/generate-threads', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/** Admin: aggregazione live su `generation_plugin_events` (nessuna tabella rollup separata). */
app.get('/api/admin/generation-learning-summary', async (req, res) => {
  if (!isAdminApiRequest(req)) return res.status(403).json({ error: 'Forbidden' });
  if (!dbSql) return res.status(503).json({ error: 'Database required' });
  try {
    const totals30d = await dbSql`
      SELECT event_type, COUNT(*)::int AS cnt
      FROM generation_plugin_events
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY event_type
      ORDER BY cnt DESC
    `;
    const recent = await dbSql`
      SELECT id, created_at, event_type, request_id, figma_file_key, payload
      FROM generation_plugin_events
      ORDER BY created_at DESC
      LIMIT 50
    `;
    res.json({
      totals_30d: totals30d.rows || [],
      recent: recent.rows || [],
    });
  } catch (err) {
    console.error('GET /api/admin/generation-learning-summary', err);
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

const SOURCE_PROVIDERS = new Set(['github', 'bitbucket', 'gitlab', 'custom']);
const SOURCE_STATUSES = new Set(['draft', 'needs_auth', 'connected_manual', 'scan_failed', 'ready']);

function normalizeSourceProvider(v) {
  const provider = String(v || '').trim().toLowerCase();
  return SOURCE_PROVIDERS.has(provider) ? provider : null;
}

function normalizeRepoUrl(v) {
  return String(v || '').trim().replace(/\.git$/i, '').slice(0, 1200);
}

function normalizeSourcePath(v) {
  return String(v || '').trim().replace(/^\/+|\/+$/g, '').slice(0, 500);
}

function normalizeStorybookUrl(v) {
  const raw = String(v || '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw);
    const pathname = u.pathname.replace(/\/+$/g, '');
    return `${u.origin}${pathname}`.slice(0, 1200);
  } catch {
    return raw.replace(/\/+$/g, '').slice(0, 1200);
  }
}

function rowToSourceConnection(row) {
  if (!row) return null;
  return {
    provider: row.provider,
    repoUrl: row.repo_url,
    branch: row.default_branch || 'main',
    storybookPath: row.storybook_path || '',
    storybookUrl: row.storybook_url,
    figmaFileKey: row.figma_file_key,
    status: row.status || 'draft',
    authStatus: row.auth_status || 'needs_auth',
    hasToken: !!(row.source_access_token && String(row.source_access_token).trim()),
    scan: row.scan_result || null,
    lastScannedAt: row.last_scanned_at ? new Date(row.last_scanned_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function parseGitHubRepoUrl(repoUrl) {
  const ssh = String(repoUrl || '').match(/^git@github\.com:([^/]+)\/(.+)$/i);
  if (ssh) return { owner: ssh[1], repo: ssh[2].replace(/\.git$/i, '') };
  try {
    const u = new URL(repoUrl);
    if (!/github\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.replace(/^\/+|\/+$/g, '').split('/');
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/i, '') };
  } catch {
    return null;
  }
}

function parseBitbucketRepoUrl(repoUrl) {
  try {
    const u = new URL(repoUrl);
    if (!/bitbucket\.org$/i.test(u.hostname)) return null;
    const parts = u.pathname.replace(/^\/+|\/+$/g, '').split('/');
    if (parts.length < 2) return null;
    return { workspace: parts[0], repo: parts[1].replace(/\.git$/i, '') };
  } catch {
    return null;
  }
}

function parseGitLabRepoUrl(repoUrl) {
  try {
    const u = new URL(repoUrl);
    if (!/gitlab\.com$/i.test(u.hostname)) return null;
    const projectPath = u.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '');
    return projectPath ? { projectPath } : null;
  } catch {
    return null;
  }
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Comtra-Source-Scan/1.0',
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return data;
}

async function listSourceFiles({ provider, repoUrl, branch, sourceToken }) {
  const token = typeof sourceToken === 'string' && sourceToken.trim() ? sourceToken.trim() : '';
  const authHeaders = token ? { Authorization: /^bearer\s+/i.test(token) ? token : `Bearer ${token}` } : {};
  if (provider === 'github') {
    const parsed = parseGitHubRepoUrl(repoUrl);
    if (!parsed) throw new Error('Invalid GitHub repository URL.');
    const data = await fetchJson(
      `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { headers: authHeaders },
    );
    const files = Array.isArray(data?.tree)
      ? data.tree.filter((x) => x?.type === 'blob' && typeof x.path === 'string').map((x) => x.path)
      : [];
    return files;
  }
  if (provider === 'bitbucket') {
    const parsed = parseBitbucketRepoUrl(repoUrl);
    if (!parsed) throw new Error('Invalid Bitbucket repository URL.');
    const files = [];
    let url = `https://api.bitbucket.org/2.0/repositories/${encodeURIComponent(parsed.workspace)}/${encodeURIComponent(parsed.repo)}/src/${encodeURIComponent(branch)}/?pagelen=100`;
    for (let i = 0; i < 8 && url; i++) {
      const data = await fetchJson(url, { headers: authHeaders });
      for (const v of data?.values || []) {
        if (v?.type === 'commit_file' && typeof v.path === 'string') files.push(v.path);
      }
      url = typeof data?.next === 'string' ? data.next : '';
    }
    return files;
  }
  if (provider === 'gitlab') {
    const parsed = parseGitLabRepoUrl(repoUrl);
    if (!parsed) throw new Error('Invalid GitLab repository URL.');
    const project = encodeURIComponent(parsed.projectPath);
    const data = await fetchJson(
      `https://gitlab.com/api/v4/projects/${project}/repository/tree?ref=${encodeURIComponent(branch)}&recursive=true&per_page=100`,
      { headers: authHeaders },
    );
    return Array.isArray(data)
      ? data.filter((x) => x?.type === 'blob' && typeof x.path === 'string').map((x) => x.path)
      : [];
  }
  throw new Error('Custom sources require manual setup until provider auth is configured.');
}

function inferSourceScan({ provider, files, storybookPath }) {
  const base = normalizeSourcePath(storybookPath);
  const inBase = (p) => !base || p === base || p.startsWith(`${base}/`);
  const storybookConfigs = files.filter((p) =>
    inBase(p) && /(^|\/)\.storybook\/main\.(js|cjs|mjs|ts|tsx)$/i.test(p),
  );
  const stories = files.filter((p) =>
    inBase(p) && /\.(stories|story)\.(js|jsx|ts|tsx|mdx|vue|svelte)$/i.test(p),
  );
  const components = files.filter((p) =>
    inBase(p) && /(^|\/)(components|ui|src)\/.+\.(jsx|tsx|vue|svelte)$/i.test(p) && !/\.(stories|story)\./i.test(p),
  );
  const hasPnpm = files.some((p) => inBase(p) && /(^|\/)pnpm-lock\.yaml$/i.test(p));
  const hasYarn = files.some((p) => inBase(p) && /(^|\/)yarn\.lock$/i.test(p));
  const hasNpm = files.some((p) => inBase(p) && /(^|\/)package-lock\.json$/i.test(p));
  const packageManager = hasPnpm ? 'pnpm' : hasYarn ? 'yarn' : hasNpm ? 'npm' : null;
  const detectedFramework =
    files.some((p) => /\.(tsx|jsx)$/i.test(p)) ? 'react' :
      files.some((p) => /\.vue$/i.test(p)) ? 'vue' :
        files.some((p) => /\.svelte$/i.test(p)) ? 'svelte' :
          null;
  const issues = [];
  if (storybookConfigs.length === 0) issues.push('No .storybook/main config found in the selected path.');
  if (stories.length === 0) issues.push('No Storybook stories found in the selected path.');
  const status = storybookConfigs.length > 0 && stories.length > 0 ? 'ready' : files.length > 0 ? 'partial' : 'failed';
  return {
    status,
    provider,
    packageManager,
    detectedFramework,
    storybookConfigPath: storybookConfigs[0] || null,
    storiesCount: stories.length,
    componentsCount: components.length,
    confidence: status === 'ready' ? 'high' : status === 'partial' ? 'medium' : 'low',
    issues,
    detectedAt: new Date().toISOString(),
  };
}

async function runSourceScan(input) {
  const provider = normalizeSourceProvider(input.provider);
  const repoUrl = normalizeRepoUrl(input.repoUrl || input.repo_url);
  const branch = String(input.branch || input.default_branch || 'main').trim().slice(0, 200) || 'main';
  const storybookPath = normalizeSourcePath(input.storybookPath || input.storybook_path);
  const sourceToken = typeof input.sourceToken === 'string' ? input.sourceToken : typeof input.source_token === 'string' ? input.source_token : '';
  if (!provider) throw new Error('provider required');
  if (!repoUrl) throw new Error('repo_url required');
  if (provider === 'custom') {
    return {
      status: 'partial',
      provider,
      defaultBranch: branch,
      packageManager: null,
      detectedFramework: null,
      storybookConfigPath: storybookPath ? `${storybookPath}/.storybook/main.*` : '.storybook/main.*',
      storiesCount: null,
      componentsCount: null,
      confidence: 'low',
      issues: ['Custom source saved. Automatic scanning requires a provider integration or custom API connector.'],
      detectedAt: new Date().toISOString(),
    };
  }
  const files = await listSourceFiles({ provider, repoUrl, branch, sourceToken });
  return {
    ...inferSourceScan({ provider, files, storybookPath }),
    defaultBranch: branch,
  };
}

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
    const normalizeDsContextIndex = (raw) => {
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
      if (typeof raw === 'string' && raw.trim() !== '') {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
        } catch {
          // fall through
        }
      }
      return null;
    };
    const idx = normalizeDsContextIndex(row.ds_context_index);
    if (!idx) return res.status(404).json({ error: 'Context snapshot unavailable' });
    res.json({
      ds_context_index: idx,
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

// --- Storybook Sync: source repository connection
app.get('/api/sync/source-connection', async (req, res) => {
  const authCtx = getUserAuthContext(req);
  const userId = authCtx.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED', reason: authCtx.reason });
  if (!dbSql) return res.status(503).json({ error: 'Database required' });
  const figmaFileKey = String(req.query.figma_file_key || req.query.file_key || req.query.fileKey || '').trim();
  const storybookUrl = normalizeStorybookUrl(req.query.storybook_url || req.query.storybookUrl);
  if (!figmaFileKey) return res.status(400).json({ error: 'figma_file_key required' });
  if (!storybookUrl) return res.status(400).json({ error: 'storybook_url required' });
  try {
    const sel = await dbSql`
      SELECT provider, repo_url, default_branch, storybook_path, storybook_url, figma_file_key,
             status, auth_status, source_access_token, scan_result, last_scanned_at, updated_at
      FROM user_source_connections
      WHERE user_id = ${userId}
        AND figma_file_key = ${figmaFileKey}
        AND (
          storybook_url = ${storybookUrl}
          OR regexp_replace(storybook_url, '/+$', '') = ${storybookUrl}
        )
      LIMIT 1
    `;
    const row = sel?.rows?.[0];
    if (!row) return res.json({ connection: null });
    res.json({ connection: rowToSourceConnection(row) });
  } catch (err) {
    console.error('GET /api/sync/source-connection', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/sync/source-connection', async (req, res) => {
  const authCtx = getUserAuthContext(req);
  const userId = authCtx.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED', reason: authCtx.reason });
  if (!dbSql) return res.status(503).json({ error: 'Database required' });
  const body = req.body || {};
  const figmaFileKey = String(body.figma_file_key || body.file_key || body.fileKey || '').trim();
  const storybookUrl = normalizeStorybookUrl(body.storybook_url || body.storybookUrl);
  const provider = normalizeSourceProvider(body.provider);
  const repoUrl = normalizeRepoUrl(body.repo_url || body.repoUrl);
  const defaultBranch = String(body.default_branch || body.branch || 'main').trim().slice(0, 200) || 'main';
  const storybookPath = normalizeSourcePath(body.storybook_path || body.storybookPath);
  const sourceToken = typeof body.source_token === 'string' && body.source_token.trim()
    ? body.source_token.trim().slice(0, 4000)
    : '';
  const scanResult = body.scan_result ?? body.scan;
  const authStatus = provider === 'custom' ? 'not_configured' : 'needs_auth';
  const status =
    scanResult?.status === 'ready' ? 'ready' :
      scanResult?.status === 'partial' ? 'connected_manual' :
        provider === 'custom' ? 'connected_manual' : 'needs_auth';
  if (!figmaFileKey) return res.status(400).json({ error: 'figma_file_key required' });
  if (!storybookUrl) return res.status(400).json({ error: 'storybook_url required' });
  if (!provider) return res.status(400).json({ error: 'provider required' });
  if (!repoUrl) return res.status(400).json({ error: 'repo_url required' });
  try {
    const scanJson = scanResult && typeof scanResult === 'object' ? JSON.stringify(scanResult) : null;
    const ins = await dbSql`
      INSERT INTO user_source_connections (
        user_id, figma_file_key, storybook_url, provider, repo_url, default_branch, storybook_path,
        status, auth_status, source_access_token, scan_result, last_scanned_at, updated_at
      )
      VALUES (
        ${userId}, ${figmaFileKey}, ${storybookUrl}, ${provider}, ${repoUrl}, ${defaultBranch}, ${storybookPath},
        ${status}, ${authStatus}, ${sourceToken || null}, ${scanJson}::jsonb,
        ${scanJson ? new Date().toISOString() : null}, NOW()
      )
      ON CONFLICT (user_id, figma_file_key, storybook_url) DO UPDATE SET
        provider = EXCLUDED.provider,
        repo_url = EXCLUDED.repo_url,
        default_branch = EXCLUDED.default_branch,
        storybook_path = EXCLUDED.storybook_path,
        status = EXCLUDED.status,
        auth_status = EXCLUDED.auth_status,
        source_access_token = COALESCE(NULLIF(EXCLUDED.source_access_token, ''), user_source_connections.source_access_token),
        scan_result = EXCLUDED.scan_result,
        last_scanned_at = EXCLUDED.last_scanned_at,
        updated_at = NOW()
      RETURNING provider, repo_url, default_branch, storybook_path, storybook_url, figma_file_key,
                status, auth_status, source_access_token, scan_result, last_scanned_at, updated_at
    `;
    let row = ins?.rows?.[0];
    if (!row) {
      const again = await dbSql`
        SELECT provider, repo_url, default_branch, storybook_path, storybook_url, figma_file_key,
               status, auth_status, source_access_token, scan_result, last_scanned_at, updated_at
        FROM user_source_connections
        WHERE user_id = ${userId} AND figma_file_key = ${figmaFileKey} AND storybook_url = ${storybookUrl}
        LIMIT 1
      `;
      row = again?.rows?.[0];
    }
    const connection = rowToSourceConnection(row);
    if (!connection) {
      return res.status(500).json({ error: 'Save did not return a connection row' });
    }
    res.json({ ok: true, connection });
  } catch (err) {
    console.error('PUT /api/sync/source-connection', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/sync/source-connection', async (req, res) => {
  const authCtx = getUserAuthContext(req);
  const userId = authCtx.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED', reason: authCtx.reason });
  if (!dbSql) return res.status(503).json({ error: 'Database required' });
  const body = req.body || {};
  const figmaFileKey = String(body.figma_file_key || body.file_key || req.query.figma_file_key || req.query.fileKey || '').trim();
  const storybookUrl = normalizeStorybookUrl(body.storybook_url || body.storybookUrl || req.query.storybook_url || req.query.storybookUrl);
  if (!figmaFileKey) return res.status(400).json({ error: 'figma_file_key required' });
  if (!storybookUrl) return res.status(400).json({ error: 'storybook_url required' });
  try {
    await dbSql`
      DELETE FROM user_source_connections
      WHERE user_id = ${userId}
        AND figma_file_key = ${figmaFileKey}
        AND (
          storybook_url = ${storybookUrl}
          OR regexp_replace(storybook_url, '/+$', '') = ${storybookUrl}
        )
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/sync/source-connection', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/sync/source-connection/scan', async (req, res) => {
  const authCtx = getUserAuthContext(req);
  const userId = authCtx.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED', reason: authCtx.reason });
  const body = req.body || {};
  const sourceToken = typeof body.source_token === 'string' && body.source_token.trim()
    ? body.source_token.trim().slice(0, 4000)
    : '';
  try {
    let effectiveInput = body;
    if (!sourceToken && dbSql) {
      const figmaFileKey = String(body.figma_file_key || body.file_key || '').trim();
      const storybookUrl = normalizeStorybookUrl(body.storybook_url || '');
      if (figmaFileKey && storybookUrl) {
        const sel = await dbSql`
          SELECT source_access_token
          FROM user_source_connections
          WHERE user_id = ${userId}
            AND figma_file_key = ${figmaFileKey}
            AND (
              storybook_url = ${storybookUrl}
              OR regexp_replace(storybook_url, '/+$', '') = ${storybookUrl}
            )
          LIMIT 1
        `;
        const tokenFromDb = sel?.rows?.[0]?.source_access_token;
        if (typeof tokenFromDb === 'string' && tokenFromDb.trim()) {
          effectiveInput = { ...body, source_token: tokenFromDb };
        }
      }
    }
    const scan = await runSourceScan(effectiveInput);
    res.json({ ok: true, scan });
  } catch (err) {
    const message = err?.message || 'Source scan failed';
    res.status(err?.status === 404 ? 404 : 400).json({
      ok: false,
      error: message,
      scan: {
        status: 'failed',
        provider: normalizeSourceProvider(body.provider) || undefined,
        defaultBranch: String(body.branch || body.default_branch || 'main'),
        confidence: 'low',
        issues: [message],
        detectedAt: new Date().toISOString(),
      },
    });
  }
});

app.post('/api/sync/source-auth/start', async (req, res) => {
  const authCtx = getUserAuthContext(req);
  const userId = authCtx.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED', reason: authCtx.reason });
  const provider = normalizeSourceProvider(req.body?.provider);
  if (!provider) return res.status(400).json({ ok: false, error: 'provider required' });
  const state = Buffer.from(JSON.stringify({ userId, provider, ts: Date.now() })).toString('base64url');
  if (provider === 'custom') {
    return res.json({ ok: true, status: 'connected_manual', url: null, message: 'Custom source uses manual setup.' });
  }
  if (provider === 'github') {
    const installUrl = String(process.env.GITHUB_APP_INSTALL_URL || '').trim();
    if (installUrl) {
      const url = new URL(installUrl);
      url.searchParams.set('state', state);
      return res.json({ ok: true, status: 'needs_auth', url: url.toString() });
    }
    const clientId = String(process.env.GITHUB_OAUTH_CLIENT_ID || '').trim();
    const redirectUri = String(process.env.GITHUB_OAUTH_REDIRECT_URI || `${BASE_URL}/auth/source/github/callback`).trim();
    if (clientId) {
      const url = new URL('https://github.com/login/oauth/authorize');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('scope', 'read:user repo');
      url.searchParams.set('state', state);
      return res.json({ ok: true, status: 'needs_auth', url: url.toString() });
    }
    return res.status(400).json({ ok: false, status: 'needs_auth', error: 'GitHub auth is missing configuration (set GITHUB_APP_INSTALL_URL or GITHUB_OAUTH_CLIENT_ID).' });
  }
  if (provider === 'bitbucket') {
    const authBase = String(process.env.BITBUCKET_OAUTH_AUTHORIZE_URL || 'https://bitbucket.org/site/oauth2/authorize').trim();
    const clientId = String(process.env.BITBUCKET_OAUTH_CLIENT_ID || '').trim();
    const redirectUri = String(process.env.BITBUCKET_OAUTH_REDIRECT_URI || `${BASE_URL}/auth/source/bitbucket/callback`).trim();
    if (!clientId) {
      return res.status(400).json({ ok: false, status: 'needs_auth', error: 'Bitbucket auth is missing configuration (set BITBUCKET_OAUTH_CLIENT_ID).' });
    }
    const url = new URL(authBase);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    return res.json({ ok: true, status: 'needs_auth', url: url.toString() });
  }
  if (provider === 'gitlab') {
    const authBase = String(process.env.GITLAB_OAUTH_AUTHORIZE_URL || 'https://gitlab.com/oauth/authorize').trim();
    const clientId = String(process.env.GITLAB_OAUTH_CLIENT_ID || '').trim();
    const redirectUri = String(process.env.GITLAB_OAUTH_REDIRECT_URI || `${BASE_URL}/auth/source/gitlab/callback`).trim();
    if (!clientId) {
      return res.status(400).json({ ok: false, status: 'needs_auth', error: 'GitLab auth is missing configuration (set GITLAB_OAUTH_CLIENT_ID).' });
    }
    const url = new URL(authBase);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'read_user read_api read_repository');
    url.searchParams.set('state', state);
    return res.json({ ok: true, status: 'needs_auth', url: url.toString() });
  }
  return res.status(400).json({ ok: false, status: 'needs_auth', error: `Unsupported source provider: ${provider}` });
});

// --- Generate conversational UX: threads + messages (plugin sync)
app.get('/api/generate/threads', async (req, res) => {
  const authCtx = getUserAuthContext(req);
  const userId = authCtx.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED', reason: authCtx.reason });
  if (!dbSql) return res.status(503).json({ error: 'Database required' });
  const fileKey = String(req.query.file_key || req.query.fileKey || '').trim();
  const dsHash = String(req.query.ds_cache_hash || req.query.dsCacheHash || '').trim().slice(0, 128);
  if (!fileKey) return res.status(400).json({ error: 'file_key required' });
  try {
    const sel = await dbSql`
      SELECT id::text, title, EXTRACT(EPOCH FROM created_at) * 1000 AS created_at_ms,
             EXTRACT(EPOCH FROM updated_at) * 1000 AS updated_at_ms
      FROM generate_threads
      WHERE user_id = ${userId} AND file_key = ${fileKey} AND ds_cache_hash = ${dsHash}
      ORDER BY updated_at DESC
      LIMIT 40
    `;
    res.json({ threads: sel.rows || [] });
  } catch (err) {
    console.error('GET /api/generate/threads', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/generate/threads', async (req, res) => {
  const authCtx = getUserAuthContext(req);
  const userId = authCtx.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED', reason: authCtx.reason });
  if (!dbSql) return res.status(503).json({ error: 'Database required' });
  const body = req.body || {};
  const fileKey = String(body.file_key || body.fileKey || '').trim();
  const dsHash = String(body.ds_cache_hash ?? body.dsCacheHash ?? '').trim().slice(0, 128);
  const title =
    body.title != null && String(body.title).trim() !== ''
      ? String(body.title).trim().slice(0, 240)
      : null;
  if (!fileKey) return res.status(400).json({ error: 'file_key required' });
  try {
    const ins = await dbSql`
      INSERT INTO generate_threads (user_id, file_key, ds_cache_hash, title)
      VALUES (${userId}, ${fileKey}, ${dsHash}, ${title})
      RETURNING id::text
    `;
    const id = ins?.rows?.[0]?.id;
    if (!id) return res.status(500).json({ error: 'Create failed' });
    res.json({ id });
  } catch (err) {
    console.error('POST /api/generate/threads', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/generate/thread-messages', async (req, res) => {
  const authCtx = getUserAuthContext(req);
  const userId = authCtx.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED', reason: authCtx.reason });
  if (!dbSql) return res.status(503).json({ error: 'Database required' });
  const threadId = String(req.query.thread_id || req.query.threadId || '').trim();
  if (!threadId) return res.status(400).json({ error: 'thread_id required' });
  try {
    const own = await dbSql`
      SELECT 1 FROM generate_threads WHERE id = ${threadId}::uuid AND user_id = ${userId} LIMIT 1
    `;
    if (!own?.rows?.length) return res.status(404).json({ error: 'Not found' });
    const sel = await dbSql`
      SELECT id::text, role, message_type, content_json,
             credit_estimate, credit_consumed,
             EXTRACT(EPOCH FROM created_at) * 1000 AS created_at_ms
      FROM generate_messages
      WHERE thread_id = ${threadId}::uuid
      ORDER BY created_at ASC
      LIMIT 500
    `;
    res.json({ messages: sel.rows || [] });
  } catch (err) {
    console.error('GET /api/generate/thread-messages', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/generate/thread-messages', async (req, res) => {
  const authCtx = getUserAuthContext(req);
  const userId = authCtx.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED', reason: authCtx.reason });
  if (!dbSql) return res.status(503).json({ error: 'Database required' });
  const body = req.body || {};
  const threadId = String(body.thread_id || body.threadId || '').trim();
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!threadId) return res.status(400).json({ error: 'thread_id required' });
  if (messages.length === 0) return res.status(400).json({ error: 'messages required' });
  if (messages.length > 50) return res.status(400).json({ error: 'too many messages' });
  try {
    const own = await dbSql`
      SELECT id FROM generate_threads WHERE id = ${threadId}::uuid AND user_id = ${userId} LIMIT 1
    `;
    if (!own?.rows?.length) return res.status(404).json({ error: 'Not found' });
    for (const m of messages) {
      const role = String(m?.role || '').toLowerCase();
      if (!['user', 'assistant', 'system'].includes(role)) continue;
      const messageType = String(m?.message_type || m?.messageType || 'chat').toLowerCase();
      const mt = ['chat', 'reasoning_summary', 'action_result', 'error'].includes(messageType) ? messageType : 'chat';
      const contentJson =
        m?.content_json && typeof m.content_json === 'object'
          ? m.content_json
          : m?.contentJson && typeof m.contentJson === 'object'
            ? m.contentJson
            : { text: String(m?.text || '') };
      const credEst =
        typeof m?.credit_estimate === 'number'
          ? m.credit_estimate
          : typeof m?.creditEstimate === 'number'
            ? m.creditEstimate
            : null;
      const credCons =
        typeof m?.credit_consumed === 'number'
          ? m.credit_consumed
          : typeof m?.creditConsumed === 'number'
            ? m.creditConsumed
            : null;
      await dbSql`
        INSERT INTO generate_messages (thread_id, role, message_type, content_json, credit_estimate, credit_consumed)
        VALUES (
          ${threadId}::uuid,
          ${role},
          ${mt},
          ${JSON.stringify(contentJson)}::jsonb,
          ${credEst},
          ${credCons}
        )
      `;
    }
    await dbSql`UPDATE generate_threads SET updated_at = NOW() WHERE id = ${threadId}::uuid`;
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/generate/thread-messages', err);
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
  if (!POSTGRES_URL) return res.status(503).json({ error: 'A11Y Audit requires database' });

  try {
    let fileJson;
    try {
      const resolved = await resolveDesignDocumentFromBody({ body, userId, fallbackScope: 'all' });
      fileJson = resolved.fileJson;
    } catch (resolveErr) {
      const status = Number(resolveErr?.status) || 400;
      const code = resolveErr?.code;
      const msg = resolveErr?.message || 'Invalid design source';
      if (code) return res.status(status).json({ error: msg, code });
      return res.status(status).json({ error: msg });
    }
    const { issues } = runA11yAudit(fileJson);
    res.json({ issues });
  } catch (err) {
    const msg = err?.message || '';
    if (msg.includes('File too large')) {
      return res.status(413).json({ error: msg, code: 'A11Y_FILE_TOO_LARGE' });
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
    try {
      const resolved = await resolveDesignDocumentFromBody({ body, userId, fallbackScope: 'all' });
      fileJson = resolved.fileJson;
    } catch (resolveErr) {
      const status = Number(resolveErr?.status) || 400;
      const code = resolveErr?.code;
      const msg = resolveErr?.message || 'Invalid design source';
      if (code) return res.status(status).json({ error: msg, code });
      return res.status(status).json({ error: msg });
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

    const kimiRes = await withKimiConcurrencySlot(() =>
      fetch('https://api.moonshot.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${KIMI_API_KEY}`,
        },
        body: JSON.stringify(
          buildKimiChatRequestPayload({
            model: KIMI_MODEL,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage },
            ],
            maxTokens: 4096,
          }),
        ),
      }),
    );
    if (!kimiRes.ok) {
      const t = await kimiRes.text();
      console.error('UX Audit: Kimi API', kimiRes.status, t.slice(0, 300));
      if (kimiResponseLooksRateLimited(kimiRes.status, t)) {
        const retryAfterSec = kimiRateLimitRetryAfterSec();
        res.setHeader('Retry-After', String(retryAfterSec));
        return res.status(429).json({
          error: 'UX audit temporarily rate-limited by AI provider. Please retry in about 1 minute.',
          code: 'KIMI_RATE_LIMIT',
          retryAfterSec,
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
    if (err?.code === 'KIMI_QUEUE_TIMEOUT') {
      return res.status(503).json({
        error: err.message || 'Too many simultaneous AI requests. Retry shortly.',
        code: 'KIMI_QUEUE_TIMEOUT',
      });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Sync: check Storybook URL (verifica che esponga /api/stories o equivalente)
const { runSyncScanFromSnapshot, fetchStorybookMetadata } = await import('./sync-scan-engine.mjs');

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
      return res.json({
        ok: true,
        endpointPath: result.endpointPath,
        endpointUrl: result.endpointUrl,
        entryCount: result.entryCount ?? 0,
        storyCount: result.storyCount ?? 0,
        componentCount: result.componentCount ?? 0,
      });
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
  const storybookUrl = (body.storybook_url || body.storybookUrl || '').trim();
  const storybookToken = (body.storybook_token || body.storybookToken || '').trim() || undefined;
  // Do not log body or storybookToken; token is used only for fetch and must not be persisted or logged.

  if (!storybookUrl) return res.status(400).json({ error: 'storybook_url required' });
  if (!POSTGRES_URL) return res.status(503).json({ error: 'Sync Scan requires database' });

  try {
    const rawSnap = body.sync_snapshot ?? body.syncSnapshot;
    const syncSnapshot =
      rawSnap && typeof rawSnap === 'object' && !Array.isArray(rawSnap) ? rawSnap : null;
    const comps = syncSnapshot?.components;
    const instances = syncSnapshot?.instances;
    const hasValidSnapshot =
      syncSnapshot &&
      ((Array.isArray(comps) && comps.length > 0) || (Array.isArray(instances) && instances.length > 0)) &&
      typeof syncSnapshot.fileKey === 'string';

    if (!hasValidSnapshot) {
      const reason = rawSnap ? 'malformed' : 'missing';
      console.warn(`[sync-scan] sync_snapshot ${reason}; refusing REST fallback — reload plugin`);
      return res.status(400).json({
        error: 'sync_snapshot_required',
        code: 'SYNC_SNAPSHOT_REQUIRED',
        message: 'Sync requires the latest plugin snapshot. Reload the plugin and run Scan again.',
      });
    }

    const result = await runSyncScanFromSnapshot(syncSnapshot, storybookUrl, storybookToken);

    if (result.connectionStatus === 'unreachable' && result.error) {
      return res.status(400).json({ error: result.error, connectionStatus: 'unreachable' });
    }

    const items = Array.isArray(result.items) ? result.items : [];
    const normalizedStorybookUrl = normalizeStorybookUrl(storybookUrl);
    const snapshotFileKey = String(syncSnapshot.fileKey || '').trim();

    if (dbSql && snapshotFileKey && normalizedStorybookUrl) {
      try {
        await dbSql`
          INSERT INTO user_sync_scans (
            user_id, figma_file_key, storybook_url, items_json, last_scanned_at, updated_at
          )
          VALUES (
            ${userId}, ${snapshotFileKey}, ${normalizedStorybookUrl}, ${JSON.stringify(items)}::jsonb, NOW(), NOW()
          )
          ON CONFLICT (user_id, figma_file_key, storybook_url) DO UPDATE SET
            items_json = EXCLUDED.items_json,
            last_scanned_at = EXCLUDED.last_scanned_at,
            updated_at = NOW()
        `;
      } catch (cacheErr) {
        console.warn('[sync-scan] could not persist scan cache', cacheErr?.message || cacheErr);
      }
    }

    res.json({
      items,
      connectionStatus: result.connectionStatus || 'ok',
    });
  } catch (err) {
    console.error('POST /api/agents/sync-scan', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/sync/scan-cache', async (req, res) => {
  const authCtx = getUserAuthContext(req);
  const userId = authCtx.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED', reason: authCtx.reason });
  if (!dbSql) return res.status(503).json({ error: 'Database required' });

  const figmaFileKey = String(req.query.figma_file_key || req.query.file_key || req.query.fileKey || '').trim();
  const storybookUrl = normalizeStorybookUrl(req.query.storybook_url || req.query.storybookUrl);
  if (!figmaFileKey) return res.status(400).json({ error: 'figma_file_key required' });
  if (!storybookUrl) return res.status(400).json({ error: 'storybook_url required' });

  try {
    const sel = await dbSql`
      SELECT items_json, last_scanned_at
      FROM user_sync_scans
      WHERE user_id = ${userId}
        AND figma_file_key = ${figmaFileKey}
        AND (
          storybook_url = ${storybookUrl}
          OR regexp_replace(storybook_url, '/+$', '') = ${storybookUrl}
        )
      LIMIT 1
    `;
    const row = sel?.rows?.[0];
    if (!row) return res.json({ cache: null });
    const items = Array.isArray(row.items_json) ? row.items_json : [];
    res.json({
      cache: {
        items,
        scannedAt: row.last_scanned_at ? new Date(row.last_scanned_at).toISOString() : null,
      },
    });
  } catch (err) {
    console.error('GET /api/sync/scan-cache', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/sync/latest-scan-cache', async (req, res) => {
  const authCtx = getUserAuthContext(req);
  const userId = authCtx.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED', reason: authCtx.reason });
  if (!dbSql) return res.status(503).json({ error: 'Database required' });

  const figmaFileKey = String(req.query.figma_file_key || req.query.file_key || req.query.fileKey || '').trim();
  if (!figmaFileKey) return res.status(400).json({ error: 'figma_file_key required' });

  try {
    const sel = await dbSql`
      SELECT storybook_url, items_json, last_scanned_at
      FROM user_sync_scans
      WHERE user_id = ${userId}
        AND figma_file_key = ${figmaFileKey}
      ORDER BY last_scanned_at DESC NULLS LAST, updated_at DESC NULLS LAST
      LIMIT 1
    `;
    const row = sel?.rows?.[0];
    if (!row) return res.json({ cache: null });
    const items = Array.isArray(row.items_json) ? row.items_json : [];
    res.json({
      cache: {
        storybookUrl: row.storybook_url ? String(row.storybook_url) : null,
        items,
        scannedAt: row.last_scanned_at ? new Date(row.last_scanned_at).toISOString() : null,
      },
    });
  } catch (err) {
    console.error('GET /api/sync/latest-scan-cache', err);
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

function normalizeHistoryLimit(raw, fallback = 30, max = 100) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.max(1, Math.floor(n)));
}

// --- History (webapp/read model): recent generate runs + recent credit/activity events
app.get('/api/history', async (req, res) => {
  const userId = getUserIdFromToken(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!POSTGRES_URL) return res.json({ generate: [], activity: [] });

  const q = req.query || {};
  const include = String(q.include || 'all').trim().toLowerCase();
  const includeGenerate = include === 'all' || include === 'generate';
  const includeActivity = include === 'all' || include === 'activity';
  const limitGenerate = normalizeHistoryLimit(q.limit_generate || q.limitGenerate, 20, 80);
  const limitActivity = normalizeHistoryLimit(q.limit_activity || q.limitActivity, 40, 120);

  try {
    let generate = [];
    let activity = [];
    if (includeGenerate) {
      const gr = await dbSql`
        SELECT
          r.id,
          r.variant,
          r.input_tokens,
          r.output_tokens,
          r.credits_consumed,
          r.latency_ms,
          r.created_at,
          f.thumbs,
          f.comment,
          f.created_at AS feedback_at
        FROM generate_ab_requests r
        LEFT JOIN LATERAL (
          SELECT thumbs, comment, created_at
          FROM generate_ab_feedback
          WHERE request_id = r.id
          ORDER BY created_at DESC
          LIMIT 1
        ) f ON true
        WHERE r.user_id = ${userId}
        ORDER BY r.created_at DESC
        LIMIT ${limitGenerate}
      `;
      generate = (gr.rows || []).map((row) => ({
        id: row.id,
        variant: row.variant,
        input_tokens: Number(row.input_tokens) || 0,
        output_tokens: Number(row.output_tokens) || 0,
        credits_consumed: Number(row.credits_consumed) || 0,
        latency_ms: Number(row.latency_ms) || 0,
        created_at: row.created_at,
        feedback: row.thumbs
          ? {
              thumbs: row.thumbs,
              comment: row.comment || '',
              created_at: row.feedback_at || null,
            }
          : null,
      }));
    }
    if (includeActivity) {
      const ar = await dbSql`
        SELECT
          action_type,
          credits_consumed,
          file_id,
          created_at
        FROM credit_transactions
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limitActivity}
      `;
      activity = (ar.rows || []).map((row) => ({
        action_type: row.action_type,
        credits_consumed: Number(row.credits_consumed) || 0,
        file_id: row.file_id || null,
        created_at: row.created_at,
      }));
    }
    const summary = {
      generate_count: Array.isArray(generate) ? generate.length : 0,
      activity_count: Array.isArray(activity) ? activity.length : 0,
      credits_consumed_activity_window: (Array.isArray(activity) ? activity : []).reduce((acc, row) => acc + (Number(row.credits_consumed) || 0), 0),
      latest_generate_at: generate[0]?.created_at || null,
      latest_activity_at: activity[0]?.created_at || null,
    };
    return res.json({ generate, activity, summary });
  } catch (err) {
    console.error('GET /api/history', err);
    return res.status(500).json({ error: 'Server error' });
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
  const a11y = (counts.a11y_check || 0) + (counts.a11y_audit || 0);
  const ux = counts.ux_audit || 0;
  // New sync actions are tracked as comp_sync; treat them as Storybook sync activity for trophies/stats.
  const syncStorybook = (counts.sync_storybook || 0) + (counts.comp_sync || 0);
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

/** XP, crediti, tag, trofei stats — dopo login Figma o magic link. */
async function loadUserForLoginResponse(dbSql, user) {
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
    const creditsRow = await dbSql`
      SELECT credits_total, credits_used, plan
      FROM users
      WHERE id = ${user.id}
      LIMIT 1
    `;
    if (creditsRow.rows.length > 0) {
      const creditsTotal = Math.max(0, Number(creditsRow.rows[0].credits_total) || 0);
      const creditsUsed = Math.max(0, Number(creditsRow.rows[0].credits_used) || 0);
      user.credits_total = creditsTotal;
      user.credits_used = creditsUsed;
      user.credits_remaining = Math.max(0, creditsTotal - creditsUsed);
      if (creditsRow.rows[0].plan) user.plan = String(creditsRow.rows[0].plan).toUpperCase();
    }
  } catch (err) {
    console.error('loadUserForLoginResponse: credits select failed (non-fatal)', err);
  }
  try {
    const pr = await dbSql`
      SELECT name, figma_user_id, first_name, surname, profile_saved_at, name_conflict
      FROM users WHERE id = ${user.id} LIMIT 1
    `;
    if (pr.rows.length) {
      attachUserProfileFromRow(user, pr.rows[0]);
    }
  } catch (e) {
    if (!/column|does not exist/i.test(String(e))) {
      console.error('loadUserForLoginResponse: profile select failed (non-fatal)', e);
    }
  }
  try {
    const tagRow = await dbSql`SELECT COALESCE(tags, '[]'::jsonb) AS tags FROM users WHERE id = ${user.id} LIMIT 1`;
    if (tagRow.rows.length > 0) {
      const rawTags = tagRow.rows[0].tags;
      user.tags = Array.isArray(rawTags) ? rawTags : (rawTags && typeof rawTags === 'object' && !Array.isArray(rawTags) ? [] : []);
    }
  } catch (_) { /* tags column may not exist before migration 006 */ }
  try {
    const ft = await dbSql`SELECT 1 FROM figma_tokens WHERE user_id = ${user.id} LIMIT 1`;
    user.has_figma_rest_token = ft.rows.length > 0;
  } catch (_) {
    user.has_figma_rest_token = false;
  }
  const productionStats = await getProductionStats(dbSql, user.id);
  if (productionStats) user.stats = productionStats;
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
