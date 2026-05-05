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

function parseProjectMeta(payload, metadata) {
  const projectObj =
    payload.project && typeof payload.project === 'object' && !Array.isArray(payload.project)
      ? payload.project
      : metadata.project && typeof metadata.project === 'object' && !Array.isArray(metadata.project)
        ? metadata.project
        : {};
  const projectId = normText(payload.project_id || projectObj.project_id || projectObj.id, 120) || null;
  const projectName = normText(payload.project_name || projectObj.project_name || projectObj.name, 180) || null;
  const siteDomain = normText(payload.site_domain || projectObj.site_domain || projectObj.domain, 180) || null;
  const brandKey = normText(payload.brand_key || projectObj.brand_key, 120) || null;
  const designSystemId =
    normText(payload.design_system_id || projectObj.design_system_id || projectObj.ds_id, 120) || null;
  const dsStateRaw = normText(payload.ds_state || projectObj.ds_state, 24).toLowerCase();
  const dsState = ['connected', 'inferred', 'unknown', 'none'].includes(dsStateRaw) ? dsStateRaw : 'unknown';
  return { projectId, projectName, siteDomain, brandKey, designSystemId, dsState };
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

function parseFigmaUrlParts(rawUrl) {
  const input = normText(rawUrl, 1200);
  if (!input) return { ok: false, error: 'figma_url required' };
  let u;
  try {
    u = new URL(input);
  } catch {
    return { ok: false, error: 'Invalid Figma URL' };
  }
  if (!/figma\.com$/i.test(u.hostname) && !/\.figma\.com$/i.test(u.hostname)) {
    return { ok: false, error: 'URL must be a figma.com link' };
  }
  const m = u.pathname.match(/\/(?:file|design)\/([a-zA-Z0-9]+)/);
  if (!m?.[1]) return { ok: false, error: 'Could not extract Figma file key from URL' };
  const fileKey = m[1];
  const nodeId = normText(u.searchParams.get('node-id') || '', 80) || null;
  return { ok: true, fileKey, nodeId };
}

function figmaAuthHeaders(tokenOverride) {
  const fromRequest = normText(tokenOverride || '', 800);
  const token =
    fromRequest ||
    normText(process.env.FIGMA_ACCESS_TOKEN || '', 800) ||
    normText(process.env.FIGMA_API_TOKEN || '', 800) ||
    normText(process.env.FIGMA_PAT || '', 800);
  if (!token) return null;
  return { 'X-Figma-Token': token };
}

function nodeToCorpusSummary(node) {
  const name = normText(node?.name || '', 180);
  const t = normText(node?.type || '', 30).toUpperCase();
  const children = Array.isArray(node?.children) ? node.children : [];
  const childNames = children
    .map((c) => normText(c?.name || '', 80))
    .filter(Boolean)
    .slice(0, 10);
  const summary = [t ? `Type: ${t}` : '', childNames.length ? `Children: ${childNames.join(', ')}` : '']
    .filter(Boolean)
    .join('. ');
  return { title: name || t || 'Untitled screen', summary };
}

function collectFrameNodes(root, out = [], max = 120) {
  if (!root || out.length >= max) return out;
  const children = Array.isArray(root.children) ? root.children : [];
  for (const child of children) {
    if (!child || out.length >= max) break;
    const type = String(child.type || '').toUpperCase();
    if (type === 'FRAME' || type === 'COMPONENT' || type === 'COMPONENT_SET') {
      out.push(child);
      continue;
    }
    if (Array.isArray(child.children) && child.children.length > 0) {
      collectFrameNodes(child, out, max);
    }
  }
  return out;
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
      project_id,
      project_name,
      site_domain,
      brand_key,
      design_system_id,
      ds_state,
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
  const projectMeta = parseProjectMeta(payload, metadata);
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
      project_id,
      project_name,
      site_domain,
      brand_key,
      design_system_id,
      ds_state,
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
      ${projectMeta.projectId},
      ${projectMeta.projectName},
      ${projectMeta.siteDomain},
      ${projectMeta.brandKey},
      ${projectMeta.designSystemId},
      ${projectMeta.dsState},
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
  if (action === 'ingest_from_figma') {
    const figmaUrl = normText(body.figma_url || body.url, 1200);
    const parsed = parseFigmaUrlParts(figmaUrl);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const headers = figmaAuthHeaders(body.figma_token);
    if (!headers) {
      return res.status(503).json({
        error:
          'Figma token missing. Add token in the form or configure backend env (FIGMA_ACCESS_TOKEN / FIGMA_API_TOKEN / FIGMA_PAT).',
      });
    }
    const mode = normText(body.mode || '', 24).toLowerCase(); // auto|single
    const forceWholeFile = mode === 'auto';
    const effectiveNodeId = forceWholeFile ? null : parsed.nodeId;
    const projectMeta =
      body.project && typeof body.project === 'object' && !Array.isArray(body.project) ? body.project : {};
    const figmaApiUrl = effectiveNodeId
      ? `https://api.figma.com/v1/files/${parsed.fileKey}/nodes?ids=${encodeURIComponent(effectiveNodeId)}`
      : `https://api.figma.com/v1/files/${parsed.fileKey}`;
    const fr = await fetch(figmaApiUrl, { method: 'GET', headers });
    if (!fr.ok) {
      const tx = await fr.text();
      return res.status(fr.status >= 500 ? 502 : 400).json({
        error: `Figma API error ${fr.status}`,
        details: tx.slice(0, 240),
      });
    }
    const fj = await fr.json();
    const toInsert = [];
    if (effectiveNodeId) {
      const node = fj?.nodes?.[effectiveNodeId]?.document;
      if (!node) {
        return res.status(404).json({
          error: 'Node not found in Figma file. Try mode=auto to import the whole file.',
        });
      }
      const mapped = nodeToCorpusSummary(node);
      toInsert.push({
        title: mapped.title,
        prompt_summary: mapped.summary,
        figma_url: figmaUrl,
        metadata: {
          figma_file_key: parsed.fileKey,
          figma_node_id: effectiveNodeId,
          figma_node_type: String(node?.type || ''),
          project: projectMeta,
        },
        raw_payload: { figma_node: node },
      });
    } else {
      const doc = fj?.document;
      if (!doc || typeof doc !== 'object') return res.status(400).json({ error: 'Invalid Figma file document' });
      const frames = collectFrameNodes(doc, [], 160);
      const picked = mode === 'single' ? frames.slice(0, 1) : frames.slice(0, 60);
      if (picked.length === 0) return res.status(400).json({ error: 'No frame-like nodes found in file' });
      for (const f of picked) {
        const mapped = nodeToCorpusSummary(f);
        toInsert.push({
          title: mapped.title,
          prompt_summary: mapped.summary,
          figma_url: `https://www.figma.com/file/${parsed.fileKey}?node-id=${encodeURIComponent(String(f.id || ''))}`,
          metadata: {
            figma_file_key: parsed.fileKey,
            figma_node_id: String(f.id || ''),
            figma_node_type: String(f.type || ''),
            project: projectMeta,
          },
          raw_payload: { figma_node: f },
        });
      }
    }
    const out = [];
    for (const item of toInsert) {
      const row = await insertOne(item, req);
      if (row) out.push(row);
    }
    return res.status(200).json({
      ok: true,
      inserted: out.length,
      mode: effectiveNodeId ? 'node' : mode || 'auto',
      file_key: parsed.fileKey,
      items: out,
    });
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
  if (action === 'set_status_bulk') {
    const ids = Array.isArray(body.ids)
      ? body.ids.map((x) => normText(x, 64)).filter(Boolean).slice(0, 500)
      : [];
    const status = normText(body.status, 24).toLowerCase();
    if (ids.length === 0) return res.status(400).json({ error: 'ids[] required' });
    if (!['draft', 'approved', 'rejected', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }
    const up = await sql`
      UPDATE ui_corpus_examples
      SET status = ${status}, updated_at = now()
      WHERE id IN (SELECT x::uuid FROM unnest(${ids}::text[]) AS t(x))
      RETURNING id::text
    `;
    return res.status(200).json({ ok: true, updated: up.rows?.length || 0 });
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

