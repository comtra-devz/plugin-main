/**
 * Elenco DS che l’utente ha scelto di importare dai propri file Figma (persistenza locale).
 * Un eventuale backend potrà sostituire o integrare questa fonte in seguito.
 */

import {
  safeLocalStorageGetItem,
  safeLocalStorageSetItem,
  safeSessionStorageGetItem,
  safeSessionStorageRemoveItem,
  safeSessionStorageSetItem,
} from './safeWebStorage';

export type StoredDsImport = {
  id: string;
  fileKey: string;
  displayName: string;
  figmaFileName: string;
  updatedAt: number;
};

const STORAGE_KEY = 'comtra-ds-imports-v1';

function safeParse(raw: string | null): StoredDsImport[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (x): x is StoredDsImport =>
          !!x &&
          typeof x === 'object' &&
          typeof (x as StoredDsImport).id === 'string' &&
          typeof (x as StoredDsImport).fileKey === 'string',
      )
      .map((x) => ({
        id: x.id,
        fileKey: x.fileKey,
        displayName: typeof x.displayName === 'string' ? x.displayName : x.figmaFileName || 'Design system',
        figmaFileName: typeof x.figmaFileName === 'string' ? x.figmaFileName : '',
        updatedAt: typeof x.updatedAt === 'number' ? x.updatedAt : Date.now(),
      }));
  } catch {
    return [];
  }
}

export function loadDsImports(): StoredDsImport[] {
  return safeParse(safeLocalStorageGetItem(STORAGE_KEY));
}

export function saveDsImports(list: StoredDsImport[]): void {
  safeLocalStorageSetItem(STORAGE_KEY, JSON.stringify(list));
}

/** Risposta lista da GET /api/user/ds-imports (senza ds_context_index). */
export type ServerDsImportListRow = {
  figma_file_key: string;
  display_name: string;
  figma_file_name?: string;
  ds_cache_hash?: string;
  updated_at_ms?: number | string | null;
};

export function replaceDsImportsFromServer(rows: ServerDsImportListRow[]): void {
  // Empty list from API must NOT wipe local imports (e.g. token/CORS timing, or server lag after PUT).
  // Local `upsertDsImport` remains source of truth until server returns at least one row.
  if (!Array.isArray(rows) || rows.length === 0) return;

  const list: StoredDsImport[] = rows.map((row, i) => {
    const msRaw = row.updated_at_ms;
    const updatedAt =
      typeof msRaw === 'number' && Number.isFinite(msRaw)
        ? msRaw
        : typeof msRaw === 'string' && msRaw !== ''
          ? Number(msRaw) || Date.now() - i
          : Date.now() - i;
    return {
      id: `srv-${row.figma_file_key}`,
      fileKey: row.figma_file_key,
      displayName:
        typeof row.display_name === 'string' && row.display_name.trim()
          ? row.display_name.trim()
          : typeof row.figma_file_name === 'string'
            ? row.figma_file_name
            : 'Design system',
      figmaFileName: typeof row.figma_file_name === 'string' ? row.figma_file_name : '',
      updatedAt,
    };
  });
  saveDsImports(list);
}

export function upsertDsImport(entry: {
  fileKey: string;
  displayName: string;
  figmaFileName: string;
}): StoredDsImport {
  const list = loadDsImports();
  const now = Date.now();
  const idx = list.findIndex((x) => x.fileKey === entry.fileKey);
  const row: StoredDsImport = {
    id: idx >= 0 ? list[idx].id : `ds-${now}-${Math.random().toString(36).slice(2, 9)}`,
    fileKey: entry.fileKey,
    displayName: entry.displayName.trim() || entry.figmaFileName || 'Design system',
    figmaFileName: entry.figmaFileName,
    updatedAt: now,
  };
  if (idx >= 0) list[idx] = row;
  else list.push(row);
  saveDsImports(list);
  return row;
}

export function hasImportForFileKey(fileKey: string | null | undefined): boolean {
  if (!fileKey) return false;
  return loadDsImports().some((x) => x.fileKey === fileKey);
}

const SESSION_PREPARED_KEY = 'comtra-ds-prepared-session';

/** True se in questa sessione del plugin l’utente ha già completato la preparazione per questo `fileKey`. */
export function isSessionCatalogPreparedForFile(fileKey: string | null | undefined): boolean {
  if (!fileKey) return false;
  try {
    const raw = safeSessionStorageGetItem(SESSION_PREPARED_KEY);
    if (!raw) return false;
    const o = JSON.parse(raw) as { fileKey?: string };
    return o?.fileKey === fileKey;
  } catch {
    return false;
  }
}

export function clearSessionCatalogPrepared(): void {
  safeSessionStorageRemoveItem(SESSION_PREPARED_KEY);
}

export function setSessionCatalogPrepared(fileKey: string): void {
  safeSessionStorageSetItem(
    SESSION_PREPARED_KEY,
    JSON.stringify({ fileKey, ts: Date.now() }),
  );
}

/**
 * Free tier: un solo DS in elenco. Se in passato l’utente aveva più record, mantiene il più recente.
 */
export function enforceSingleImportForFreeTier(): void {
  const list = loadDsImports();
  if (list.length <= 1) return;
  const keep = [...list].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  saveDsImports([keep]);
}

/** Utente non Pro: può associare l’import solo al file già registrato (un solo slot). */
export function canFreeTierUseFileForDsImport(
  fileKey: string | null,
  isPro: boolean,
): { ok: true } | { ok: false; needsProForDifferentFile: true } {
  if (isPro || !fileKey) return { ok: true };
  enforceSingleImportForFreeTier();
  const list = loadDsImports();
  if (list.length === 0) return { ok: true };
  if (list.some((i) => i.fileKey === fileKey)) return { ok: true };
  return { ok: false, needsProForDifferentFile: true };
}
