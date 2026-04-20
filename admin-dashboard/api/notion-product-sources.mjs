/**
 * POST /api/notion-product-sources
 * Estrae link da una pagina Notion o da un database (integration + pagina condivisa).
 *
 * Body JSON:
 *   { "pageId": "uuid" } | { "databaseId": "uuid" }
 *   opzionale: "ignoreTokens": ["internal-note-token", ...]
 *   opzionale: "enrichLinkedIn": true — chiama Apify sui URL LinkedIn (stessi env del cron; richiesta lunga)
 *   opzionale: "fetchWeb": true — Fase 1 bis + 2: fetch / strategia per URL web non-LinkedIn (stessi limiti env del cron)
 *   opzionale: "includeDocSnapshot": true — Fase 4: include snapshot rules/docs (env URL/repo come il cron)
 *   opzionale: "includeLlmSynthesis": true — Fase 5: sintesi LLM nel Markdown (`PRODUCT_SOURCES_LLM_SYNTHESIS=1` + key/model)
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
import { enrichLinkedInPosts } from '../lib/apify-linkedin.mjs';
import { isWebFetchCandidateUrl } from '../lib/fetch-generic-web.mjs';
import { fetchProductSourcesSequential, getWebFetchLimitsFromEnv } from '../lib/product-source-fetch-strategy.mjs';
import { normalizeUrlKey } from '../lib/product-sources-seen.mjs';
import { buildPluginDocSnapshot } from '../lib/plugin-doc-snapshot.mjs';
import { synthesizeProductImprovementsMarkdown } from '../lib/product-sources-llm.mjs';

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
  // Hard-stop dashboard LinkedIn scraping to avoid Apify credit consumption.
  const enrichLinkedIn = false;
  const fetchWeb =
    body.fetchWeb === true ||
    String(body.fetchWeb || '').toLowerCase() === 'true' ||
    process.env.PRODUCT_SOURCES_MANUAL_FETCH_WEB_DEFAULT === '1' ||
    process.env.PRODUCT_SOURCES_MANUAL_FETCH_WEB_DEFAULT === 'true';
  const includeDocSnapshot =
    body.includeDocSnapshot === true ||
    String(body.includeDocSnapshot || '').toLowerCase() === 'true' ||
    process.env.PRODUCT_SOURCES_MANUAL_DOC_SNAPSHOT_DEFAULT === '1' ||
    process.env.PRODUCT_SOURCES_MANUAL_DOC_SNAPSHOT_DEFAULT === 'true';
  const includeLlmSynthesis =
    body.includeLlmSynthesis === true ||
    String(body.includeLlmSynthesis || '').toLowerCase() === 'true';

  try {
    const { mode, sourceLabel, links, stats } = await runNotionProductSourcesExtract({
      notionToken: token,
      pageId: pageId || undefined,
      databaseId: databaseId || undefined,
      ignoreTokens,
    });

    /** @type {Array<{ url: string, text?: string, outboundLinks?: string[], error?: string }>} */
    let linkedinEnrichments = [];
    if (enrichLinkedIn) {
      const linkedinUrls = links.filter((l) => /linkedin\.com/i.test(l.url)).map((l) => l.url);
      const apifyToken = process.env.APIFY_TOKEN || '';
      const actorId = process.env.APIFY_LINKEDIN_ACTOR_ID || '';
      const inputMode = process.env.APIFY_LINKEDIN_INPUT_MODE;
      if (linkedinUrls.length && apifyToken && actorId) {
        linkedinEnrichments = await enrichLinkedInPosts(apifyToken, actorId, linkedinUrls, {
          inputMode: inputMode || undefined,
        });
      } else if (linkedinUrls.length) {
        linkedinEnrichments = linkedinUrls.map((url) => ({
          url,
          error: !apifyToken
            ? 'APIFY_TOKEN non configurato su Vercel'
            : 'APIFY_LINKEDIN_ACTOR_ID non configurato su Vercel',
        }));
      }
    }

    /** @type {Array<{ url: string, text?: string, error?: string, contentType?: string, kind?: string, strategyNote?: string }>} */
    let webEnrichments = [];
    if (fetchWeb) {
      const limits = getWebFetchLimitsFromEnv();
      const webKeys = new Set();
      const webUrls = [];
      for (const l of links) {
        if (!isWebFetchCandidateUrl(l.url)) continue;
        const k = normalizeUrlKey(l.url);
        if (webKeys.has(k)) continue;
        webKeys.add(k);
        webUrls.push(l.url);
      }
      if (limits.max > 0 && webUrls.length) {
        webEnrichments = await fetchProductSourcesSequential(webUrls, {
          max: limits.max,
          fetchOpts: { timeoutMs: limits.timeoutMs, maxTextChars: limits.maxTextChars },
        });
      }
    }

    let pluginDocSnapshot = null;
    if (includeDocSnapshot) {
      pluginDocSnapshot = await buildPluginDocSnapshot();
    }

    let llmSynthesisSection = '';
    if (includeLlmSynthesis) {
      llmSynthesisSection = await synthesizeProductImprovementsMarkdown({
        mode,
        sourceLabel,
        newLinks: links,
        seenLinks: [],
        linkedinEnrichments,
        webEnrichments,
        pluginDocSnapshot,
      });
    }

    const markdown = buildMarkdownReport({
      links,
      sourceLabel,
      mode,
      stats,
      linkedinEnrichments,
      webEnrichments,
      pluginDocSnapshot,
      llmSynthesisSection,
      phase6SkipHeavy: false,
    });

    return res.status(200).json({
      ok: true,
      mode,
      sourceId: sourceLabel,
      linkCount: links.length,
      linkedinEnriched: linkedinEnrichments.length,
      enrichLinkedInRequested: enrichLinkedIn,
      fetchWebRequested: fetchWeb,
      webEnriched: webEnrichments.length,
      includeDocSnapshotRequested: includeDocSnapshot,
      includeLlmSynthesisRequested: includeLlmSynthesis,
      llmSynthesisChars: llmSynthesisSection.length,
      docSnapshot: pluginDocSnapshot
        ? {
            skipped: pluginDocSnapshot.skipped,
            skipReason: pluginDocSnapshot.skipReason,
            truncated: pluginDocSnapshot.truncated,
            sourceCount: (pluginDocSnapshot.sources || []).length,
            okCount: (pluginDocSnapshot.sources || []).filter((s) => s.ok).length,
          }
        : null,
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
