/**
 * Design Intelligence v2 — LLM enrichment for `content_defaults` (§9.1 pack v2).
 * Single batched call when wizard_signals (tone / keywords) are present.
 * `opts.callKimi` is a generic chat caller (Kimi or Qwen) with the same message shape.
 */

import { createHash } from 'node:crypto';

/** In-memory cache per process (serverless: warm instance only). */
const enrichmentCache = new Map();
const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000;

function getEnrichmentCacheTtlMs() {
  const n = Number(process.env.KIMI_ENRICHMENT_CACHE_TTL_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CACHE_TTL_MS;
}

function enrichmentCacheKey(userId, archetypeId, tone, keywordsSorted, baseObj, partition = '') {
  return createHash('sha256')
    .update(JSON.stringify({ u: userId, a: archetypeId, t: tone, k: keywordsSorted, b: baseObj, p: partition }))
    .digest('hex')
    .slice(0, 56);
}

function pruneEnrichmentCache(ttlMs) {
  const now = Date.now();
  if (enrichmentCache.size < 400) return;
  for (const [k, v] of enrichmentCache) {
    if (now - v.at > ttlMs) enrichmentCache.delete(k);
  }
  let i = 0;
  const drop = enrichmentCache.size - 300;
  if (drop <= 0) return;
  for (const k of enrichmentCache.keys()) {
    enrichmentCache.delete(k);
    i += 1;
    if (i >= drop) break;
  }
}

function safeJsonParseObject(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  try {
    const j = JSON.parse(t);
    return j && typeof j === 'object' && !Array.isArray(j) ? j : null;
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   callKimi: (messages: unknown[], maxTokens?: number) => Promise<{ content?: string; usage?: { prompt_tokens?: number; completion_tokens?: number; input_tokens?: number; output_tokens?: number } }>,
 *   archetypeId: string | null,
 *   contentDefaultsEntry: Record<string, unknown> | null,
 *   kimiEnrichableFields: unknown,
 *   toneOfVoice: string | null,
 *   brandVoiceKeywords: string[] | null,
 *   charLimits?: Record<string, number>,
 *   cacheUserId?: string | null,
 *   cachePartition?: string | null,
 * }} opts
 * @returns {Promise<{ block: string, used: boolean, usage: { input: number, output: number }, enriched: Record<string, string> | null, cacheHit?: boolean }>}
 */
export async function runKimiContentDefaultsEnrichment(opts) {
  const usage = { input: 0, output: 0 };
  const archetypeId = opts.archetypeId && String(opts.archetypeId).trim() ? String(opts.archetypeId).trim() : null;
  const entry = opts.contentDefaultsEntry && typeof opts.contentDefaultsEntry === 'object' && !Array.isArray(opts.contentDefaultsEntry)
    ? opts.contentDefaultsEntry
    : null;
  const tone = (opts.toneOfVoice && String(opts.toneOfVoice).trim()) || '';
  const kw = Array.isArray(opts.brandVoiceKeywords)
    ? opts.brandVoiceKeywords.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  if (!archetypeId || !entry) return { block: '', used: false, usage, enriched: null, cacheHit: false };
  if (!tone && kw.length === 0) return { block: '', used: false, usage, enriched: null, cacheHit: false };

  const rawFields = opts.kimiEnrichableFields;
  const fieldList = Array.isArray(rawFields) ? rawFields.map((x) => String(x || '').trim()).filter(Boolean) : [];
  const base = {};
  for (const f of fieldList) {
    const v = entry[f];
    if (typeof v === 'string' && v.trim()) base[f] = v.trim();
  }
  if (Object.keys(base).length === 0) return { block: '', used: false, usage, enriched: null, cacheHit: false };

  const cacheUserId =
    opts.cacheUserId && String(opts.cacheUserId).trim() ? String(opts.cacheUserId).trim() : null;
  const ttlMs = getEnrichmentCacheTtlMs();
  const cachePart = opts.cachePartition != null ? String(opts.cachePartition) : '';
  const cacheKey =
    cacheUserId && archetypeId
      ? enrichmentCacheKey(cacheUserId, archetypeId, tone, [...kw].sort(), base, cachePart)
      : null;
  if (cacheKey) {
    const hit = enrichmentCache.get(cacheKey);
    if (hit && Date.now() - hit.at < ttlMs && hit.payload?.used) {
      return {
        block: hit.payload.block,
        used: true,
        usage: { input: 0, output: 0 },
        enriched: hit.payload.enriched,
        cacheHit: true,
      };
    }
  }

  const limits = opts.charLimits && typeof opts.charLimits === 'object' ? opts.charLimits : {};
  const lim = (k) => {
    const n = Number(limits[k]);
    return Number.isFinite(n) && n > 0 ? n : 120;
  };

  const system = `You are a UX copy editor. Rewrite ONLY the string values in the user's JSON object to match the brand voice. Output a single JSON object with the SAME keys as input; string values only; no markdown; no keys not in input. Respect max lengths per key:
title/max ${lim('title')}, description/max ${lim('description')}, primary_cta/max ${lim('primary_cta')}, secondary_action/max ${lim('secondary_action')}.`;

  const user = [
    `Archetype: ${archetypeId}`,
    tone ? `Tone of voice (free text): ${tone}` : '',
    kw.length ? `Brand voice keywords: ${kw.join(', ')}` : '',
    `Input JSON (rewrite string values): ${JSON.stringify(base)}`,
  ]
    .filter(Boolean)
    .join('\n');

  const { content, usage: u } = await opts.callKimi(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    2048,
  );
  usage.input += Math.max(0, Number(u?.prompt_tokens ?? u?.input_tokens ?? 0));
  usage.output += Math.max(0, Number(u?.completion_tokens ?? u?.output_tokens ?? 0));

  let enriched = safeJsonParseObject(content);
  if (!enriched) {
    const fence = String(content || '').match(/\{[\s\S]*\}/);
    if (fence) enriched = safeJsonParseObject(fence[0]);
  }
  if (!enriched) return { block: '', used: false, usage, enriched: null, cacheHit: false };

  const outStrings = {};
  for (const k of Object.keys(base)) {
    if (typeof enriched[k] === 'string' && enriched[k].trim()) outStrings[k] = enriched[k].trim();
  }
  if (Object.keys(outStrings).length === 0) return { block: '', used: false, usage, enriched: null, cacheHit: false };

  const block = [
    '',
    '[CONTENT_DEFAULTS_ENRICHMENT — DI v2]',
    'Use these strings when choosing INSTANCE_COMPONENT TEXT properties and CREATE_TEXT where they match slot intent; still obey DS index and validation.',
    JSON.stringify({ archetype: archetypeId, enriched_copy: outStrings }),
    '[END CONTENT_DEFAULTS_ENRICHMENT]',
  ].join('\n');

  const out = { block, used: true, usage, enriched: outStrings, cacheHit: false };
  if (cacheKey) {
    pruneEnrichmentCache(ttlMs);
    enrichmentCache.set(cacheKey, {
      at: Date.now(),
      payload: { block: out.block, used: true, enriched: out.enriched },
    });
  }
  return out;
}
