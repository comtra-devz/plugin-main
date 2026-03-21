/**
 * Fase 2 — Strategia per tipo di URL: classificazione, allow/block list, GitHub raw, stub social/video, PDF rilevato.
 * Il fetch HTTP grezzo resta in fetch-generic-web.mjs.
 */

import { fetchWebPagePlainText, isWebFetchCandidateUrl } from './fetch-generic-web.mjs';

/**
 * @typedef {'html'|'github'|'youtube'|'social_x'|'pdf_path'|'excluded'|'invalid'} ProductSourceKind
 */

/**
 * @param {string} raw
 * @returns {string[]}
 */
export function parseHostnameList(raw) {
  if (raw == null || String(raw).trim() === '') return [];
  return String(raw)
    .split(/[,;\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Match hostname contro lista (esatta o sottodominio di voce lista).
 * @param {string} hostname
 * @param {string[]} list
 */
export function hostnameInList(hostname, list) {
  const h = hostname.toLowerCase();
  for (const entry of list) {
    if (!entry) continue;
    if (h === entry) return true;
    if (h.endsWith('.' + entry)) return true;
  }
  return false;
}

/**
 * Legge env una tantum per policy (chiamare a ogni request va bene su serverless).
 */
export function getDomainPolicyFromEnv() {
  const blocklist = parseHostnameList(process.env.PRODUCT_SOURCES_DOMAIN_BLOCKLIST || '');
  const allowlist = parseHostnameList(process.env.PRODUCT_SOURCES_DOMAIN_ALLOWLIST || '');
  return {
    blocklist,
    allowlist,
    allowOnly: allowlist.length > 0,
  };
}

/**
 * @param {string} url
 * @returns {{ kind: ProductSourceKind, detail?: string }}
 */
export function classifyProductSourceUrl(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/i.test(u.protocol)) return { kind: 'invalid', detail: 'protocollo' };
    const host = u.hostname.toLowerCase();
    const path = u.pathname;

    if (host === 'youtu.be' || host === 'www.youtube.com' || host === 'youtube.com' || host === 'm.youtube.com') {
      return { kind: 'youtube' };
    }
    if (host === 'x.com' || host === 'twitter.com' || host === 'www.twitter.com' || host === 'mobile.twitter.com') {
      return { kind: 'social_x' };
    }
    if (host === 'github.com' || host === 'www.github.com' || host === 'gist.github.com') {
      return { kind: 'github' };
    }
    if (/\.pdf$/i.test(path) || /\.pdf\?/i.test(url)) {
      return { kind: 'pdf_path' };
    }
    return { kind: 'html' };
  } catch {
    return { kind: 'invalid', detail: 'URL malformato' };
  }
}

/**
 * Converte URL "blob" GitHub in raw.githubusercontent.com quando possibile.
 * @param {string} url
 * @returns {string} URL da usare per GET (può essere uguale all’originale)
 */
export function githubBlobToRawUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host !== 'github.com' && host !== 'www.github.com') return url;
    const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
    if (!m) return url;
    const [, owner, repo, ref, rest] = m;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${rest}`;
  } catch {
    return url;
  }
}

/**
 * Limiti condivisi cron + API manuale.
 */
export function getWebFetchLimitsFromEnv() {
  return {
    max: Math.min(100, Math.max(0, Number(process.env.PRODUCT_SOURCES_MAX_WEB_FETCH_PER_RUN || 15) || 15)),
    timeoutMs: Math.min(
      120_000,
      Math.max(3000, Number(process.env.PRODUCT_SOURCES_WEB_FETCH_TIMEOUT_MS || 18_000) || 18_000),
    ),
    maxTextChars: Math.min(
      200_000,
      Math.max(2000, Number(process.env.PRODUCT_SOURCES_WEB_FETCH_MAX_CHARS || 48_000) || 48_000),
    ),
  };
}

/**
 * Blocklist su tutti. Allowlist (se valorizzata) solo su fetch HTTP reale — **esclusi** stub YouTube/X (nessuna richiesta di rete oltre al controllo).
 * @param {string} url
 * @param {string} kind da classifyProductSourceUrl
 * @param {ReturnType<getDomainPolicyFromEnv>} policy
 */
export function policyCheckForFetch(url, kind, policy) {
  let hostname = '';
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return { blocked: true, reason: 'URL non valido per policy' };
  }

  if (policy.blocklist.length && hostnameInList(hostname, policy.blocklist)) {
    return { blocked: true, reason: `Host in PRODUCT_SOURCES_DOMAIN_BLOCKLIST (${hostname})` };
  }
  if (kind === 'youtube' || kind === 'social_x') {
    return { blocked: false };
  }
  if (policy.allowOnly && !hostnameInList(hostname, policy.allowlist)) {
    return { blocked: true, reason: `Host non in PRODUCT_SOURCES_DOMAIN_ALLOWLIST (${hostname})` };
  }
  return { blocked: false };
}

/**
 * @param {string} url
 * @param {Parameters<typeof fetchWebPagePlainText>[1]} [fetchOpts]
 * @returns {Promise<{ url: string, text?: string, contentType?: string, error?: string, kind?: string, strategyNote?: string }>}
 */
export async function fetchProductSourceContent(url, fetchOpts = {}) {
  const policy = getDomainPolicyFromEnv();

  if (!isWebFetchCandidateUrl(url)) {
    return { url, kind: 'excluded', error: 'URL escluso (LinkedIn, Notion, protocollo, …)' };
  }

  const { kind } = classifyProductSourceUrl(url);
  if (kind === 'invalid') {
    return { url, kind: 'invalid', error: 'URL non classificabile' };
  }

  const pc = policyCheckForFetch(url, kind, policy);
  if (pc.blocked) {
    return { url, kind, error: pc.reason };
  }

  if (kind === 'youtube') {
    return {
      url,
      kind: 'youtube',
      text:
        '**[YouTube]** Trascrizione automatica non attiva in questa fase. Apri il video e annota punti utili per il plugin.\n\n' +
        `_URL:_ ${url}`,
      contentType: 'application/vnd.comtra.source-stub',
      strategyNote: 'Stub Fase 2 — nessun download video',
    };
  }

  if (kind === 'social_x') {
    return {
      url,
      kind: 'social_x',
      text:
        '**[X / Twitter]** Contenuto spesso limitato senza API o login. Nessun fetch automatico del thread.\n\n' +
        `_URL:_ ${url}`,
      contentType: 'application/vnd.comtra.source-stub',
      strategyNote: 'Stub Fase 2 — considera Apify actor dedicato se serve',
    };
  }

  if (kind === 'github') {
    const rawUrl = githubBlobToRawUrl(url);
    const note = rawUrl !== url ? `Richiesta come file raw: \`${rawUrl}\`` : 'URL GitHub non convertibile in raw (es. issue, PR): fetch HTML.';
    let result = await fetchWebPagePlainText(rawUrl, fetchOpts);
    if (result.error && rawUrl !== url) {
      result = await fetchWebPagePlainText(url, fetchOpts);
    }
    return {
      ...result,
      url,
      kind: 'github',
      strategyNote:
        note +
        (rawUrl !== url && !result.error ? ' — OK' : result.error ? ' — fallback pagina HTML se raw fallisce' : ''),
    };
  }

  /** pdf_path: tentativo GET; fetch-generic-web segnala PDF binario */
  const result = await fetchWebPagePlainText(url, fetchOpts);
  if (result.error && kind === 'pdf_path') {
    return {
      ...result,
      kind: 'pdf_path',
      strategyNote: 'Estensione .pdf nell’URL; se il server risponde PDF, serve parser dedicato o Apify.',
    };
  }
  return { ...result, kind: kind === 'pdf_path' ? 'pdf_path' : 'html' };
}

/**
 * @param {string[]} urls
 * @param {{ max?: number, fetchOpts?: Parameters<typeof fetchWebPagePlainText>[1] }} [opts]
 */
export async function fetchProductSourcesSequential(urls, opts = {}) {
  const max = opts.max ?? urls.length;
  const slice = urls.slice(0, max);
  const out = [];
  for (const url of slice) {
    out.push(await fetchProductSourceContent(url, opts.fetchOpts));
  }
  return out;
}
