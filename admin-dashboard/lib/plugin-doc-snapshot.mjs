/**
 * Fase 4 — Snapshot testuale di rules / docs del plugin (contesto per confronto e futuro LLM).
 *
 * Due modalità (combinabili):
 * 1) **URL** — `PRODUCT_SOURCES_DOC_FETCH_URLS` (es. raw GitHub), adatto a Vercel senza repo.
 * 2) **Filesystem** — `PRODUCT_SOURCES_DOC_REPO_ROOT` = root del repo; legge path relativi da env o lista default.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/** Path relativi alla root del repo (alta segnal per prodotto / ruleset). */
export const DEFAULT_DOC_RELATIVE_PATHS = [
  'docs/README.md',
  'docs/GENERATION-ENGINE-RULESET.md',
  'docs/comtra-error-messages.md',
  'docs/GENERATE-TAB-SPEC.md',
  'docs/ERROR-MESSAGES-AND-TOASTS-MAP.md',
  '.cursor/rules/generation-engine.mdc',
  'audit-specs/MAINTAINING-RULES.md',
];

/**
 * @returns {boolean}
 */
export function isPluginDocSnapshotDisabled() {
  return (
    process.env.PRODUCT_SOURCES_PLUGIN_DOC_SNAPSHOT_DISABLE === '1' ||
    process.env.PRODUCT_SOURCES_PLUGIN_DOC_SNAPSHOT_DISABLE === 'true'
  );
}

/**
 * @param {string} raw
 * @returns {string[]}
 */
export function parseUrlListEnv(raw) {
  if (raw == null || !String(raw).trim()) return [];
  return String(raw)
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((u) => /^https?:\/\//i.test(u));
}

/**
 * @param {string} raw
 * @returns {string[]}
 */
export function parsePathListEnv(raw) {
  if (raw == null || !String(raw).trim()) return [];
  return String(raw)
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function getMaxTotalChars() {
  const n = Number(process.env.PRODUCT_SOURCES_DOC_SNAPSHOT_MAX_TOTAL || 450_000);
  return Number.isFinite(n) && n > 1000 ? Math.min(n, 2_000_000) : 450_000;
}

function getMaxFileChars() {
  const n = Number(process.env.PRODUCT_SOURCES_DOC_SNAPSHOT_MAX_FILE || 180_000);
  return Number.isFinite(n) && n > 500 ? Math.min(n, 500_000) : 180_000;
}

function getFetchTimeoutMs() {
  const n = Number(process.env.PRODUCT_SOURCES_DOC_FETCH_TIMEOUT_MS || 20_000);
  return Number.isFinite(n) && n >= 3000 ? Math.min(n, 120_000) : 20_000;
}

/**
 * @param {string} filePath
 * @param {string} repoRootResolved
 * @returns {boolean}
 */
function isPathInsideRoot(filePath, repoRootResolved) {
  const rel = path.relative(repoRootResolved, filePath);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<{ ok: boolean, text?: string, error?: string }>}
 */
async function fetchTextUrl(url, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'text/plain,text/markdown,text/html,application/json;q=0.1,*/*;q=0.05',
        'User-Agent':
          process.env.PRODUCT_SOURCES_DOC_FETCH_USER_AGENT ||
          'ComtraPluginDocSnapshot/1.0 (internal product intelligence)',
      },
    });
    if (!r.ok) {
      return { ok: false, error: `HTTP ${r.status}` };
    }
    const buf = await r.arrayBuffer();
    const maxBytes = getMaxFileChars() * 4;
    const slice = buf.byteLength > maxBytes ? buf.slice(0, maxBytes) : buf;
    const text = new TextDecoder('utf-8', { fatal: false }).decode(slice);
    return { ok: true, text: text.trim() };
  } catch (e) {
    const name = e?.name || '';
    if (name === 'AbortError') {
      return { ok: false, error: `Timeout ${timeoutMs}ms` };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

/**
 * @returns {Promise<{
 *   text: string,
 *   sources: Array<{ label: string, ok: boolean, chars: number, error?: string }>,
 *   truncated: boolean,
 *   skipped: boolean,
 *   skipReason?: string
 * }>}
 */
export async function buildPluginDocSnapshot() {
  if (isPluginDocSnapshotDisabled()) {
    return {
      text: '_Snapshot documentazione disattivato (`PRODUCT_SOURCES_PLUGIN_DOC_SNAPSHOT_DISABLE`)._',
      sources: [],
      truncated: false,
      skipped: true,
      skipReason: 'disabled',
    };
  }

  const maxTotal = getMaxTotalChars();
  const maxFile = getMaxFileChars();
  const timeoutMs = getFetchTimeoutMs();

  /** @type {Array<{ label: string, body: string, ok: boolean, error?: string }>} */
  const parts = [];
  const sources = [];

  const urls = parseUrlListEnv(process.env.PRODUCT_SOURCES_DOC_FETCH_URLS || '');
  for (const url of urls) {
    const r = await fetchTextUrl(url, timeoutMs);
    const label = `url:${url.slice(0, 120)}${url.length > 120 ? '…' : ''}`;
    if (!r.ok) {
      sources.push({ label, ok: false, chars: 0, error: r.error });
      parts.push({ label, body: `_(Errore: ${r.error})_`, ok: false, error: r.error });
      continue;
    }
    let body = r.text || '';
    if (body.length > maxFile) {
      body = body.slice(0, maxFile) + '\n\n…(troncato per PRODUCT_SOURCES_DOC_SNAPSHOT_MAX_FILE)';
    }
    sources.push({ label, ok: true, chars: body.length });
    parts.push({ label, body, ok: true });
  }

  const repoRoot = (process.env.PRODUCT_SOURCES_DOC_REPO_ROOT || '').trim();
  if (repoRoot) {
    let resolvedRoot = null;
    try {
      const r = path.resolve(repoRoot);
      const stat = await fs.stat(r);
      if (!stat.isDirectory()) {
        throw new Error('non è una directory');
      }
      resolvedRoot = r;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      sources.push({ label: `repo:${repoRoot}`, ok: false, chars: 0, error: msg });
      parts.push({
        label: `repo:${repoRoot}`,
        body: `_(Impossibile leggere PRODUCT_SOURCES_DOC_REPO_ROOT: ${msg})_`,
        ok: false,
        error: msg,
      });
    }

    if (resolvedRoot) {
      const customPaths = parsePathListEnv(process.env.PRODUCT_SOURCES_DOC_PATHS || '');
      const relPaths = customPaths.length ? customPaths : DEFAULT_DOC_RELATIVE_PATHS;

      for (const rel of relPaths) {
        const clean = rel.replace(/^\//, '');
        const full = path.resolve(resolvedRoot, clean);
        if (!isPathInsideRoot(full, resolvedRoot)) {
          sources.push({ label: clean, ok: false, chars: 0, error: 'path traversal' });
          continue;
        }
        try {
          const raw = await fs.readFile(full, 'utf8');
          let body = raw.trim();
          if (body.length > maxFile) {
            body = body.slice(0, maxFile) + '\n\n…(troncato per PRODUCT_SOURCES_DOC_SNAPSHOT_MAX_FILE)';
          }
          sources.push({ label: clean, ok: true, chars: body.length });
          parts.push({ label: clean, body, ok: true });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          sources.push({ label: clean, ok: false, chars: 0, error: msg });
          parts.push({ label: clean, body: `_(File assente o non leggibile: ${msg})_`, ok: false, error: msg });
        }
      }
    }
  }

  if (!parts.length) {
    return {
      text:
        '_Nessun snapshot configurato (Fase 4). Imposta **`PRODUCT_SOURCES_DOC_FETCH_URLS`** (URL raw, es. GitHub) e/o **`PRODUCT_SOURCES_DOC_REPO_ROOT`** (path assoluta alla root del repo sul runner che esegue il cron). Opzionale: **`PRODUCT_SOURCES_DOC_PATHS`** (path relativi, virgole/newline). Vedi `NOTION-PRODUCT-SOURCES.md`._',
      sources: [],
      truncated: false,
      skipped: true,
      skipReason: 'not_configured',
    };
  }

  let total = 0;
  let truncated = false;
  const chunks = [];

  for (const p of parts) {
    const header = `\n\n---\n\n### \`${p.label}\`\n\n`;
    const need = header.length + p.body.length;
    if (total + need > maxTotal) {
      truncated = true;
      chunks.push(
        `\n\n---\n\n_(Ulteriori fonti omesse: raggiunto limite \`PRODUCT_SOURCES_DOC_SNAPSHOT_MAX_TOTAL\` = ${maxTotal} caratteri.)_`,
      );
      break;
    }
    chunks.push(header);
    chunks.push(p.body);
    total += need;
  }

  const okCount = parts.filter((p) => p.ok).length;
  const intro =
    `_Contesto **rules/docs** del plugin per confronto con le fonti Notion. File con lettura ok: **${okCount}/${parts.length}**. ` +
    (truncated ? '**Troncato** per `PRODUCT_SOURCES_DOC_SNAPSHOT_MAX_TOTAL`._' : 'Generato in automatico._');

  return {
    text: `${intro}\n${chunks.join('')}`,
    sources: sources.map((s) => ({ label: s.label, ok: s.ok, chars: s.chars, error: s.error })),
    truncated,
    skipped: false,
  };
}
