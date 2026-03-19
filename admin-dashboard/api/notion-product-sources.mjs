/**
 * POST /api/notion-product-sources
 * Estrae link da una pagina Notion o da un database (integration + pagina condivisa).
 *
 * Body JSON:
 *   { "pageId": "uuid" } | { "databaseId": "uuid" }
 *   opzionale: "ignoreTokens": ["Antigravity", ...]
 *
 * Env: NOTION_INTEGRATION_TOKEN (secret integration Notion)
 * Fallback: se body senza id, usa NOTION_PRODUCT_SOURCES_PAGE_ID o NOTION_PRODUCT_SOURCES_DATABASE_ID
 */
import { requireAdmin } from '../lib/admin-auth.mjs';
import {
  runNotionProductSourcesExtract,
  buildMarkdownReport,
  normalizeNotionId,
  resolveNotionSourceIds,
} from '../lib/product-sources-notion.mjs';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
}

function parseBody(req) {
  if (typeof req.body === 'object' && req.body !== null) return req.body;
  try {
    return JSON.parse(req.body || '{}');
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await requireAdmin(req, res))) return;

  const token = process.env.NOTION_INTEGRATION_TOKEN || process.env.NOTION_TOKEN;
  if (!token) {
    return res.status(503).json({
      error: 'Notion non configurato: imposta NOTION_INTEGRATION_TOKEN sul progetto Vercel.',
    });
  }

  const body = parseBody(req);
  let pageId = normalizeNotionId(body.pageId);
  let databaseId = normalizeNotionId(body.databaseId);
  if (!pageId && !databaseId) {
    const r = resolveNotionSourceIds({});
    pageId = r.pageId;
    databaseId = r.databaseId;
  }

  if (!pageId && !databaseId) {
    return res.status(400).json({
      error: 'Specifica pageId o databaseId nel body, oppure NOTION_PRODUCT_SOURCES_PAGE_ID / NOTION_PRODUCT_SOURCES_DATABASE_ID in env.',
    });
  }

  const ignoreTokens = Array.isArray(body.ignoreTokens) ? body.ignoreTokens : [];

  try {
    const { mode, sourceLabel, links, stats } = await runNotionProductSourcesExtract({
      notionToken: token,
      pageId: pageId || undefined,
      databaseId: databaseId || undefined,
      ignoreTokens,
    });

    const markdown = buildMarkdownReport({
      links,
      sourceLabel,
      mode,
      stats,
      linkedinEnrichments: [],
    });

    return res.status(200).json({
      ok: true,
      mode,
      sourceId: sourceLabel,
      linkCount: links.length,
      links,
      markdown,
      stats,
    });
  } catch (err) {
    console.error('notion-product-sources', err);
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg || 'Server error' });
  }
}
