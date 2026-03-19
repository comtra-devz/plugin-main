/**
 * Estrae URL dal contenuto Notion (blocchi + proprietà database).
 * Filtri: ignora blocchi/proprietà il cui testo contiene token da escludere (es. Antigravity).
 */

const NOTION_VERSION = '2022-06-28';

/** @param {string} token @param {string} path @param {RequestInit} [init] */
export async function notionRequest(token, path, init = {}) {
  const r = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!r.ok) {
    const msg = data.message || data.error || text || r.statusText;
    throw new Error(`Notion API ${r.status}: ${msg}`);
  }
  return data;
}

/** @param {unknown[]} richText */
export function plainFromRichText(richText) {
  if (!Array.isArray(richText)) return '';
  return richText.map((r) => r.plain_text || '').join('');
}

/** @param {unknown[]} richText */
export function urlsFromRichText(richText) {
  if (!Array.isArray(richText)) return [];
  const out = [];
  for (const r of richText) {
    if (r.type === 'text' && r.text?.link?.url) out.push(r.text.link.url);
    if (r.type === 'mention' && r.mention?.type === 'link_preview' && r.mention.link_preview?.url) {
      out.push(r.mention.link_preview.url);
    }
  }
  return out;
}

/**
 * @param {object} block
 * @param {{ ignorePatterns: RegExp[] }} opts
 * @returns {{ urls: string[], contextLabel: string, ignored: boolean }}
 */
export function extractFromBlock(block, opts) {
  const { ignorePatterns } = opts;
  const urls = new Set();
  const textParts = [];

  const addRich = (richText, label) => {
    textParts.push(plainFromRichText(richText));
    for (const u of urlsFromRichText(richText)) urls.add(u);
    return label;
  };

  let label = block.type || 'block';

  const payload = block[block.type];
  if (!payload) return { urls: [], contextLabel: label, ignored: false };

  switch (block.type) {
    case 'paragraph':
    case 'heading_1':
    case 'heading_2':
    case 'heading_3':
    case 'bulleted_list_item':
    case 'numbered_list_item':
    case 'to_do':
    case 'quote':
      addRich(payload.rich_text, block.type);
      break;
    case 'callout':
      addRich(payload.rich_text, 'callout');
      break;
    case 'code':
      addRich(payload.rich_text, 'code');
      break;
    case 'table_row':
      for (const cell of payload.cells || []) {
        addRich(cell, 'table_cell');
      }
      break;
    case 'synced_block':
      break;
    default:
      break;
  }

  const fullText = textParts.join(' ');
  const ignored = ignorePatterns.some((re) => re.test(fullText));
  if (ignored) return { urls: [], contextLabel: label, ignored: true };

  return {
    urls: [...urls].filter((u) => /^https?:\/\//i.test(u)),
    contextLabel: label,
    ignored: false,
  };
}

/**
 * @param {Record<string, unknown>} properties
 * @param {{ ignorePatterns: RegExp[] }} opts
 * @returns {Array<{ url: string, context: string }>}
 */
export function extractUrlsFromDatabaseProperties(properties, opts) {
  if (!properties || typeof properties !== 'object') return [];
  /** @type {Array<{ url: string, context: string }>} */
  const found = [];

  for (const [name, prop] of Object.entries(properties)) {
    if (!prop || typeof prop !== 'object') continue;
    const p = /** @type {{ type: string, [k: string]: unknown }} */ (prop);

    if (p.type === 'url' && typeof p.url === 'string' && p.url.startsWith('http')) {
      found.push({ url: p.url, context: `property:${name}` });
      continue;
    }

    if (p.type === 'title' && Array.isArray(p.title)) {
      const plain = plainFromRichText(p.title);
      if (opts.ignorePatterns.some((re) => re.test(plain))) continue;
      for (const u of urlsFromRichText(p.title)) {
        if (/^https?:\/\//i.test(u)) found.push({ url: u, context: `title:${name}` });
      }
    }

    if (p.type === 'rich_text' && Array.isArray(p.rich_text)) {
      const plain = plainFromRichText(p.rich_text);
      if (opts.ignorePatterns.some((re) => re.test(plain))) continue;
      for (const u of urlsFromRichText(p.rich_text)) {
        if (/^https?:\/\//i.test(u)) found.push({ url: u, context: `rich_text:${name}` });
      }
    }

    if (p.type === 'formula' && p.formula?.type === 'string' && typeof p.formula.string === 'string') {
      const s = p.formula.string;
      if (opts.ignorePatterns.some((re) => re.test(s))) continue;
      const matches = s.match(/https?:\/\/[^\s)\]>"']+/gi) || [];
      for (const u of matches) found.push({ url: u, context: `formula:${name}` });
    }
  }

  return found;
}

/**
 * Lista tutti i blocchi discendenti (ricorsivo su has_children).
 * @param {string} token
 * @param {string} blockId
 */
export async function listAllBlocksDepthFirst(token, blockId) {
  /** @type {object[]} */
  const out = [];
  let startCursor = undefined;

  do {
    const qs = new URLSearchParams({ page_size: '100' });
    if (startCursor) qs.set('start_cursor', startCursor);
    const data = await notionRequest(token, `/blocks/${blockId}/children?${qs}`);

    for (const block of data.results || []) {
      out.push(block);
      if (block.has_children) {
        const nested = await listAllBlocksDepthFirst(token, block.id);
        out.push(...nested);
      }
    }

    startCursor = data.has_more ? data.next_cursor : undefined;
  } while (startCursor);

  return out;
}

/**
 * @param {string} token
 * @param {string} databaseId
 */
export async function queryAllDatabasePages(token, databaseId) {
  /** @type {object[]} */
  const pages = [];
  let startCursor = undefined;

  do {
    const body = { page_size: 100 };
    if (startCursor) body.start_cursor = startCursor;
    const data = await notionRequest(token, `/databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    pages.push(...(data.results || []));
    startCursor = data.has_more ? data.next_cursor : undefined;
  } while (startCursor);

  return pages;
}

/**
 * Normalizza URL per dedup (rimuove frammenti comuni, trailing slash opzionale).
 * @param {string} url
 */
export function normalizeUrlKey(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    let s = u.toString();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * @param {string[]} ignoreSubstrings case-insensitive
 */
export function buildIgnorePatterns(ignoreSubstrings) {
  const list = (ignoreSubstrings || []).filter(Boolean);
  return list.map((s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
}
