/**
 * Dedup persistente URL fonti prodotto (cron).
 * Chiave = normalizeUrlKey (stesso algoritmo di notion-extract).
 */
import { sql, sqlRaw } from './db.mjs';
import { normalizeUrlKey } from './notion-extract.mjs';

export { normalizeUrlKey };

/**
 * @returns {Promise<Set<string>>}
 */
export async function loadSeenUrlKeys() {
  if (!sql) return new Set();
  try {
    const result = await sql`
      SELECT url_key FROM product_sources_seen_urls
    `;
    return new Set((result.rows || []).map((r) => r.url_key));
  } catch (e) {
    if (/does not exist|relation .*product_sources_seen_urls/i.test(String(e?.message || e))) {
      console.warn('product-sources-seen: tabella product_sources_seen_urls assente — esegui migration 004');
      return new Set();
    }
    throw e;
  }
}

/**
 * @param {Array<{ url: string, contexts?: string[] }>} links
 * @param {Set<string>} seenKeys
 * @returns {{ newLinks: typeof links, seenLinks: typeof links }}
 */
export function partitionLinksBySeen(links, seenKeys) {
  const newLinks = [];
  const seenLinks = [];
  for (const l of links) {
    const key = normalizeUrlKey(l.url);
    if (seenKeys.has(key)) seenLinks.push(l);
    else newLinks.push(l);
  }
  return { newLinks, seenLinks };
}

/**
 * @param {Array<{ url: string }>} links
 */
export async function upsertSeenUrls(links) {
  if (!sqlRaw || !links.length) return;
  const rows = links.map((l) => ({
    url_key: normalizeUrlKey(l.url),
    url_sample: String(l.url).slice(0, 2048),
  }));
  try {
    await sqlRaw`
      INSERT INTO product_sources_seen_urls ${sqlRaw(rows)}
      ON CONFLICT (url_key) DO UPDATE SET
        last_seen_at = NOW(),
        url_sample = EXCLUDED.url_sample
    `;
  } catch (e) {
    if (/does not exist|relation .*product_sources_seen_urls/i.test(String(e?.message || e))) {
      console.warn('product-sources-seen: skip upsert — migration 004 non eseguita');
      return;
    }
    throw e;
  }
}
