/**
 * Fetch leggero di pagine web pubbliche → testo semplice (no DOM/browser).
 * Per HTML usa stripping euristico; per text/plain usa il body così com’è (troncato).
 *
 * Non sostituisce Apify per LinkedIn, JS-heavy SPAs, paywall, ecc.
 */

const DEFAULT_TIMEOUT_MS = 18_000;
const DEFAULT_MAX_RESPONSE_BYTES = 900_000;
const DEFAULT_MAX_TEXT_CHARS = 48_000;

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isWebFetchCandidateUrl(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/i.test(u.protocol)) return false;
    const h = u.hostname.toLowerCase();
    if (h.includes('linkedin.com') || h.includes('lnkd.in')) return false;
    if (h.includes('notion.so')) return false;
    if (h === 'localhost' || h.endsWith('.local')) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} htmlOrText
 * @returns {string}
 */
export function htmlToPlainText(htmlOrText) {
  let s = String(htmlOrText || '');
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
  s = s.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ');
  s = s.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  s = s.replace(/<\/(p|div|br|tr|h1|h2|h3|h4|li)\b[^>]*>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/&nbsp;/gi, ' ');
  s = s.replace(/&amp;/gi, '&');
  s = s.replace(/&lt;/gi, '<');
  s = s.replace(/&gt;/gi, '>');
  s = s.replace(/&quot;/gi, '"');
  s = s.replace(/\s*\n\s*/g, '\n');
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/**
 * @param {string} url
 * @param {{ timeoutMs?: number, maxResponseBytes?: number, maxTextChars?: number, userAgent?: string }} [opts]
 * @returns {Promise<{ url: string, text?: string, contentType?: string, error?: string }>}
 */
export async function fetchWebPagePlainText(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxResponseBytes = opts.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const maxTextChars = opts.maxTextChars ?? DEFAULT_MAX_TEXT_CHARS;
  const userAgent =
    opts.userAgent ||
    process.env.PRODUCT_SOURCES_FETCH_USER_AGENT ||
    'ComtraProductSources/1.0 (product intelligence; contact: team)';

  if (!isWebFetchCandidateUrl(url)) {
    return { url, error: 'URL escluso da fetch web (protocollo, LinkedIn, Notion, …)' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,application/json;q=0.1,*/*;q=0.05',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
      },
    });

    const contentType = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();

    if (!r.ok) {
      return { url, error: `HTTP ${r.status}`, contentType: contentType || undefined };
    }

    const buf = await r.arrayBuffer();
    const slice = buf.byteLength > maxResponseBytes ? buf.slice(0, maxResponseBytes) : buf;
    const u8 = new Uint8Array(slice);
    const pdfMagic =
      u8.length >= 5 && u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46 && u8[4] === 0x2d; // %PDF-
    if (contentType.includes('application/pdf') || pdfMagic) {
      return {
        url,
        error:
          'PDF rilevato (Content-Type o firma binaria). Decodifica non attiva: usa viewer manuale, Apify PDF o Fase 3.',
        contentType: contentType || 'application/pdf',
      };
    }

    const raw = new TextDecoder('utf-8', { fatal: false }).decode(slice);

    let text = '';
    if (contentType.includes('text/html') || contentType.includes('application/xhtml') || /<html[\s>]/i.test(raw.slice(0, 500))) {
      text = htmlToPlainText(raw);
    } else if (contentType.includes('text/plain')) {
      text = raw.trim();
    } else if (contentType.includes('application/json')) {
      text = raw.trim();
    } else {
      // Ultimo tentativo euristico (alcuni server non mandano Content-Type corretto)
      text = /<html[\s>]/i.test(raw.slice(0, 800)) ? htmlToPlainText(raw) : raw.trim();
      if (!text.length) {
        return {
          url,
          error: `Tipo non gestito: ${contentType || 'sconosciuto'}`,
          contentType: contentType || undefined,
        };
      }
    }

    if (text.length > maxTextChars) {
      text = text.slice(0, maxTextChars) + '\n\n…(troncato per limite PRODUCT_SOURCES_WEB_FETCH_MAX_CHARS)';
    }

    return { url, text, contentType: contentType || undefined };
  } catch (e) {
    const name = e?.name || '';
    if (name === 'AbortError') {
      return { url, error: `Timeout dopo ${timeoutMs}ms` };
    }
    return { url, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch sequenziale di una lista di URL (rispetto rate implicito).
 * @param {string[]} urls
 * @param {{ max?: number }} [opts]
 * @returns {Promise<Array<{ url: string, text?: string, contentType?: string, error?: string }>>}
 */
export async function fetchWebPagesPlainTextSequential(urls, opts = {}) {
  const max = opts.max ?? urls.length;
  const slice = urls.slice(0, max);
  const out = [];
  for (const url of slice) {
    out.push(await fetchWebPagePlainText(url, opts.fetchOpts));
  }
  return out;
}
