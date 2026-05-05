import { requireAdmin } from '../lib/admin-auth.mjs';
import { sql } from '../lib/db.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
}

function normText(v, max = 4000) {
  return String(v || '').trim().slice(0, max);
}

function toJsonArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 64);
}

function inferArchetype(text) {
  const t = text.toLowerCase();
  if (/\b(checkout|payment|cart|order summary|pay now)\b/.test(t)) return 'checkout_summary_mobile';
  if (/\b(login|sign in|authentication|otp|2fa)\b/.test(t)) return 'login';
  if (/\b(register|sign up|onboarding|welcome)\b/.test(t)) return 'onboarding_step';
  if (/\b(pricing|plans|subscription)\b/.test(t)) return 'pricing';
  if (/\b(dashboard|overview|analytics|kpi|metrics)\b/.test(t)) return 'dashboard_overview';
  if (/\b(profile|account|settings)\b/.test(t)) return 'settings_profile';
  return 'custom_ui';
}

function inferPlatform(text) {
  const t = text.toLowerCase();
  if (/\b(mobile|ios|android|phone)\b/.test(t)) return 'mobile';
  if (/\b(desktop|web app|webapp)\b/.test(t)) return 'desktop';
  if (/\b(tablet|ipad)\b/.test(t)) return 'tablet';
  return 'unknown';
}

function inferAntiPatterns(text) {
  const t = text.toLowerCase();
  const out = [];
  if (/\bicon\b/.test(t) && /\bfill|stretch|stretched|deform/.test(t)) out.push('icon_stretched_fill');
  if (/\bplaceholder|lorem|dummy\b/.test(t)) out.push('placeholder_overuse');
  if (/\bfixed\b/.test(t) && /\bwithout reason|random|a caso\b/.test(t)) out.push('fixed_size_misuse');
  return out;
}

function inferKeywords(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4);
  const uniq = new Set();
  for (const w of words) {
    if (uniq.size >= 24) break;
    uniq.add(w);
  }
  return [...uniq];
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  if (typeof req.body === 'object') return req.body;
  return {};
}

async function handleGet(req, res) {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const status = normText(req.query.status, 24).toLowerCase();
  const archetype = normText(req.query.archetype, 80).toLowerCase();
  const q = normText(req.query.q, 200).toLowerCase();
  const pattern = `%${q}%`;
  const validStatus = ['draft', 'approved', 'rejected', 'archived'].includes(status) ? status : null;
  const useArch = archetype || null;
  const rows = await sql`
    SELECT
      id::text,
      source_kind,
      source_license,
      source_url,
      title,
      archetype,
      platform,
      locale,
      quality_score,
      status,
      tags,
      sections,
      anti_patterns,
      keywords,
      metadata,
      created_by,
      created_at,
      updated_at
    FROM ui_corpus_examples
    WHERE (status = ${validStatus} OR ${validStatus}::text IS NULL)
      AND (archetype = ${useArch} OR ${useArch}::text IS NULL)
      AND (
        ${q}::text = ''
        OR lower(coalesce(title, '')) ILIKE ${pattern}
        OR lower(coalesce(source_url, '')) ILIKE ${pattern}
        OR lower(coalesce(archetype, '')) ILIKE ${pattern}
      )
    ORDER BY updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const totalResult = await sql`
    SELECT COUNT(*)::int AS c FROM ui_corpus_examples
    WHERE (status = ${validStatus} OR ${validStatus}::text IS NULL)
      AND (archetype = ${useArch} OR ${useArch}::text IS NULL)
      AND (
        ${q}::text = ''
        OR lower(coalesce(title, '')) ILIKE ${pattern}
        OR lower(coalesce(source_url, '')) ILIKE ${pattern}
        OR lower(coalesce(archetype, '')) ILIKE ${pattern}
      )
  `;
  const byStatus = await sql`
    SELECT status, COUNT(*)::int AS c
    FROM ui_corpus_examples
    GROUP BY status
    ORDER BY status
  `;
  const byArchetype = await sql`
    SELECT archetype, COUNT(*)::int AS c
    FROM ui_corpus_examples
    GROUP BY archetype
    ORDER BY c DESC
    LIMIT 20
  `;
  return res.status(200).json({
    items: rows.rows || [],
    total: totalResult.rows?.[0]?.c ?? 0,
    limit,
    offset,
    stats: {
      by_status: byStatus.rows || [],
      top_archetypes: byArchetype.rows || [],
    },
  });
}

async function insertOne(payload, req) {
  const title = normText(payload.title || payload.name, 180);
  const sourceUrl = normText(payload.source_url || payload.figma_url || payload.url, 600);
  const summary = normText(payload.prompt_summary || payload.summary || payload.description, 2000);
  const notes = normText(payload.notes || '', 2000);
  const fullText = [title, summary, notes].filter(Boolean).join('\n');
  const archetype = normText(payload.archetype, 80).toLowerCase() || inferArchetype(fullText);
  const platform = normText(payload.platform, 24).toLowerCase() || inferPlatform(fullText);
  const locale = normText(payload.locale, 24) || null;
  const qualityRaw = Number(payload.quality_score);
  const quality =
    Number.isFinite(qualityRaw) && qualityRaw >= 0 && qualityRaw <= 5
      ? Math.round(qualityRaw * 100) / 100
      : null;
  const tags = toJsonArray(payload.tags);
  const sections = toJsonArray(payload.sections);
  const antiPatterns = [
    ...new Set([...toJsonArray(payload.anti_patterns), ...inferAntiPatterns(fullText)]),
  ].slice(0, 32);
  const keywords = [...new Set([...toJsonArray(payload.keywords), ...inferKeywords(fullText)])].slice(0, 48);
  const sourceKind = normText(payload.source_kind, 32).toLowerCase() || 'internal_figma';
  const sourceLicense = normText(payload.source_license, 32).toLowerCase() || 'owned';
  const metadata =
    payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
      ? payload.metadata
      : {};
  const rawPayload =
    payload.raw_payload && typeof payload.raw_payload === 'object' && !Array.isArray(payload.raw_payload)
      ? payload.raw_payload
      : payload;
  const createdBy = req.adminUser?.email ? normText(req.adminUser.email, 160) : null;

  const ins = await sql`
    INSERT INTO ui_corpus_examples (
      source_kind,
      source_license,
      source_url,
      title,
      archetype,
      platform,
      locale,
      quality_score,
      status,
      tags,
      sections,
      anti_patterns,
      keywords,
      metadata,
      raw_payload,
      created_by
    )
    VALUES (
      ${sourceKind},
      ${sourceLicense},
      ${sourceUrl || null},
      ${title || null},
      ${archetype},
      ${platform},
      ${locale},
      ${quality},
      ${'draft'},
      ${JSON.stringify(tags)}::jsonb,
      ${JSON.stringify(sections)}::jsonb,
      ${JSON.stringify(antiPatterns)}::jsonb,
      ${JSON.stringify(keywords)}::jsonb,
      ${JSON.stringify(metadata)}::jsonb,
      ${JSON.stringify(rawPayload)}::jsonb,
      ${createdBy}
    )
    RETURNING id::text, archetype, platform, status, quality_score
  `;
  return ins.rows?.[0] || null;
}

async function handlePost(req, res) {
  const body = parseBody(req);
  const action = normText(body.action, 40).toLowerCase();
  if (!action) return res.status(400).json({ error: 'action required' });

  if (action === 'ingest_example') {
    const row = await insertOne(body.example || body, req);
    return res.status(200).json({ ok: true, item: row });
  }
  if (action === 'ingest_batch') {
    const examples = Array.isArray(body.examples) ? body.examples : [];
    if (examples.length === 0) return res.status(400).json({ error: 'examples[] required' });
    const out = [];
    for (const ex of examples.slice(0, 200)) {
      const row = await insertOne(ex, req);
      if (row) out.push(row);
    }
    return res.status(200).json({ ok: true, inserted: out.length, items: out });
  }
  if (action === 'set_status') {
    const id = normText(body.id, 64);
    const status = normText(body.status, 24).toLowerCase();
    if (!id) return res.status(400).json({ error: 'id required' });
    if (!['draft', 'approved', 'rejected', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }
    const up = await sql`
      UPDATE ui_corpus_examples
      SET status = ${status}, updated_at = now()
      WHERE id = ${id}::uuid
      RETURNING id::text, status
    `;
    if (!up.rows?.[0]) return res.status(404).json({ error: 'not found' });
    return res.status(200).json({ ok: true, item: up.rows[0] });
  }

  return res.status(400).json({ error: 'unknown action' });
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!(await requireAdmin(req, res))) return;
  if (!sql) return res.status(503).json({ error: 'Database not configured' });
  try {
    if (req.method === 'GET') return await handleGet(req, res);
    if (req.method === 'POST') return await handlePost(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    const msg = String(err?.message || err || '');
    if (/relation .*ui_corpus_examples.* does not exist/i.test(msg)) {
      return res.status(200).json({
        items: [],
        total: 0,
        limit: 0,
        offset: 0,
        stats: { by_status: [], top_archetypes: [] },
        migration_needed: true,
      });
    }
    console.error('ui-corpus api error', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

