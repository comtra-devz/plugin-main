/**
 * In-memory prep cache for /api/agents/generate (same Node isolate / warm lambda).
 * Speeds repeat prompts without changing quality: same inputs → same retrieved artifacts.
 *
 * Disable: GENERATE_PREP_CACHE=0
 * TTL: GENERATE_PREP_CACHE_TTL_MS (default 180000)
 * Max entries: GENERATE_PREP_CACHE_MAX (default 400)
 */
import { createHash } from 'crypto';

export const prepCacheEnabled =
  process.env.GENERATE_PREP_CACHE !== '0' && process.env.GENERATE_PREP_CACHE !== 'false';

export const prepCacheTtlMs = Math.max(30000, Number(process.env.GENERATE_PREP_CACHE_TTL_MS || 180000));

const prepCacheMax = Math.max(50, Number(process.env.GENERATE_PREP_CACHE_MAX || 400));

/** @type {Map<string, { exp: number, val: unknown }>} */
const store = new Map();

function evictIfNeeded() {
  while (store.size > prepCacheMax) {
    const k = store.keys().next().value;
    if (k === undefined) break;
    store.delete(k);
  }
}

export function prepCacheGet(key) {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) {
    store.delete(key);
    return null;
  }
  return e.val;
}

export function prepCacheSet(key, val, ttlMs = prepCacheTtlMs) {
  store.set(key, { exp: Date.now() + ttlMs, val });
  evictIfNeeded();
}

export function normalizePromptForCache(p) {
  return String(p || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 12000);
}

function shaShort(parts) {
  return createHash('sha256').update(parts.join('\x1e')).digest('hex').slice(0, 48);
}

export function prepCacheKeySpec({ prompt, mode, dsHash, archetype, packId, specModel }) {
  return `gspec:${shaShort([
    normalizePromptForCache(prompt),
    String(mode || ''),
    String(dsHash || ''),
    String(archetype || ''),
    String(packId || ''),
    String(specModel || ''),
  ])}`;
}

export function prepCacheKeyDsPrompt({ dsHash, retrievalPrompt, topKComponents, topKVariables }) {
  return `dspidx:${shaShort([
    String(dsHash || ''),
    normalizePromptForCache(retrievalPrompt),
    String(topKComponents ?? ''),
    String(topKVariables ?? ''),
  ])}`;
}
