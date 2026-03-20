/**
 * Esecuzione actor Apify per estrarre testo + link da post LinkedIn.
 * L’input dipende dall’actor: usa APIFY_LINKEDIN_INPUT_MODE per adattarlo.
 *
 * Modalità supportate (body inviato all’actor):
 * - postUrls: { postUrls: [{ url: "..." }, ...] }  (comune)
 * - urls:     { urls: ["...", ...] }
 * - startUrls:{ startUrls: [{ url: "..." }, ...] }
 * - targetUrls:{ targetUrls: ["...", ...] } (alcuni actor LinkedIn profile/posts)
 */
const APIFY = 'https://api.apify.com/v2';

/**
 * @param {string} token Apify API token
 * @param {string} actorId es. "username~actor-name" o "username/actor-name"
 * @param {string[]} postUrls URL post LinkedIn
 * @param {{ waitSeconds?: number, inputMode?: string }} [opts]
 * @returns {Promise<object[]>} righe dataset Apify
 */
export async function runLinkedInActor(token, actorId, postUrls, opts = {}) {
  if (!token) throw new Error('APIFY_TOKEN mancante');
  if (!actorId) throw new Error('APIFY_LINKEDIN_ACTOR_ID mancante');
  if (!postUrls.length) return [];

  const actor = actorId.includes('/') ? actorId.replace('/', '~') : actorId;
  /** Min 10s so Hobby/debug can fail fast; default 300 for full Apify runs (needs Vercel maxDuration). */
  const waitSeconds = Math.min(Math.max(opts.waitSeconds ?? 300, 10), 900);
  const inputMode = opts.inputMode || process.env.APIFY_LINKEDIN_INPUT_MODE || 'postUrls';

  const input = buildActorInput(inputMode, postUrls);
  const q = new URLSearchParams({
    token,
    waitForFinish: String(waitSeconds),
  });
  const url = `${APIFY}/acts/${encodeURIComponent(actor)}/runs?${q}`;

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data.error?.message || data.message || JSON.stringify(data) || r.statusText;
    throw new Error(`Apify run failed: ${msg}`);
  }

  const run = data.data || data;
  const datasetId = run.defaultDatasetId;
  if (!datasetId) {
    throw new Error('Apify: nessun defaultDatasetId nella risposta run');
  }

  const itemsUrl = `${APIFY}/datasets/${datasetId}/items?token=${encodeURIComponent(token)}&clean=true&format=json`;
  const ir = await fetch(itemsUrl);
  if (!ir.ok) {
    throw new Error(`Apify dataset read failed: ${ir.status}`);
  }
  return ir.json();
}

function buildActorInput(mode, urls) {
  switch (mode) {
    case 'targetUrls':
      return { targetUrls: urls };
    case 'urls':
      return { urls };
    case 'startUrls':
      return { startUrls: urls.map((url) => ({ url })) };
    case 'postUrls':
    default:
      return { postUrls: urls.map((url) => ({ url })) };
  }
}

/**
 * Normalizza righe dataset in { url, text, outboundLinks }.
 * Prova chiavi comuni; raccoglie URL da stringhe.
 * @param {object[]} items
 * @param {string[]} requestedUrls
 */
export function mapLinkedInDatasetItems(items, requestedUrls) {
  /** @type {Map<string, { url: string, text: string, outboundLinks: string[] }} */
  const byNorm = new Map();

  for (const u of requestedUrls) {
    byNorm.set(normalizeLinkedinKey(u), { url: u, text: '', outboundLinks: [] });
  }

  for (const item of items || []) {
    const itemUrl =
      item.url ||
      item.postUrl ||
      item.link ||
      item.linkedinUrl ||
      item.inputUrl ||
      (Array.isArray(item.postUrls) && item.postUrls[0]) ||
      '';
    const key = itemUrl ? normalizeLinkedinKey(String(itemUrl)) : '';
    let slot = key ? byNorm.get(key) : null;
    if (!slot && requestedUrls.length === 1) {
      slot = byNorm.get(normalizeLinkedinKey(requestedUrls[0]));
    }
    if (!slot) continue;

    const text = extractPrimaryText(item);
    const links = extractAllUrlsFromObject(item);
    if (text && text.length > (slot.text?.length || 0)) slot.text = text;
    for (const l of links) {
      if (!/^https?:\/\//i.test(l)) continue;
      if (!slot.outboundLinks.includes(l)) slot.outboundLinks.push(l);
    }
  }

  return requestedUrls.map((u) => {
    const slot = byNorm.get(normalizeLinkedinKey(u)) || { url: u, text: '', outboundLinks: [] };
    return {
      url: u,
      text: slot.text || '',
      outboundLinks: slot.outboundLinks || [],
    };
  });
}

function normalizeLinkedinKey(u) {
  try {
    const x = new URL(u);
    x.hash = '';
    x.search = '';
    return x.toString().toLowerCase().replace(/\/$/, '');
  } catch {
    return String(u).toLowerCase().trim();
  }
}

function extractPrimaryText(obj) {
  const candidates = [];
  const keys = [
    'text',
    'postText',
    'content',
    'body',
    'description',
    'caption',
    'message',
    'title',
    'headline',
  ];
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim().length > 20) candidates.push(v.trim());
  }
  if (obj.text?.text && typeof obj.text.text === 'string') candidates.push(obj.text.text.trim());
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] || '';
}

function extractAllUrlsFromObject(obj, out = new Set(), depth = 0) {
  if (depth > 8 || obj == null) return out;
  if (typeof obj === 'string') {
    const m = obj.match(/https?:\/\/[^\s"'<>[\]{}]+/gi) || [];
    m.forEach((u) => out.add(u.replace(/[),.]+$/g, '')));
    return out;
  }
  if (Array.isArray(obj)) {
    for (const x of obj) extractAllUrlsFromObject(x, out, depth + 1);
    return out;
  }
  if (typeof obj === 'object') {
    for (const v of Object.values(obj)) extractAllUrlsFromObject(v, out, depth + 1);
  }
  return out;
}

/**
 * @param {string} token
 * @param {string} actorId
 * @param {string[]} linkedinUrls
 * @param {{ maxPosts?: number, waitSeconds?: number, inputMode?: string }} [opts]
 */
export async function enrichLinkedInPosts(token, actorId, linkedinUrls, opts = {}) {
  const max = opts.maxPosts ?? (Number(process.env.PRODUCT_SOURCES_MAX_LINKEDIN_PER_RUN || 20) || 20);
  const slice = linkedinUrls.slice(0, max);
  if (!slice.length) return [];

  const envWaitRaw = process.env.APIFY_LINKEDIN_WAIT_SECONDS;
  const envWait =
    envWaitRaw != null && String(envWaitRaw).trim() !== ''
      ? Number(envWaitRaw)
      : undefined;
  const waitSeconds =
    opts.waitSeconds ?? (Number.isFinite(envWait) ? envWait : undefined);

  try {
    const items = await runLinkedInActor(token, actorId, slice, {
      waitSeconds,
      inputMode: opts.inputMode,
    });
    const mapped = mapLinkedInDatasetItems(items, slice);
    const byKey = new Map(mapped.map((m) => [normalizeLinkedinKey(m.url), m]));
    return slice.map((u) => {
      const m = byKey.get(normalizeLinkedinKey(u));
      if (m && (m.text || (m.outboundLinks && m.outboundLinks.length)))
        return { url: u, text: m.text, outboundLinks: m.outboundLinks || [] };
      if (m) return { url: u, text: m.text || '', outboundLinks: m.outboundLinks || [] };
      return {
        url: u,
        text: '',
        outboundLinks: [],
        error: 'Nessun item nel dataset Apify per questo URL (controlla actor e input mode).',
      };
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return slice.map((url) => ({ url, text: '', outboundLinks: [], error: msg }));
  }
}
