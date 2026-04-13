#!/usr/bin/env node
/**
 * Verifica lato server che GET /api/user/ds-imports e (opzionale) /context rispondano
 * con lo stesso JWT che usa il plugin. Utile quando il DS risulta “non importato” in UI.
 *
 * Uso (dalla root del repo):
 *   COMTRA_JWT="eyJ..." node scripts/verify-ds-import.mjs
 *   COMTRA_JWT="eyJ..." COMTRA_FILE_KEY="abc123" node scripts/verify-ds-import.mjs
 *
 * Variabili:
 *   COMTRA_AUTH_URL  default https://auth.comtra.dev
 *   COMTRA_JWT       Bearer (obbligatorio)
 *   COMTRA_FILE_KEY  opzionale: stampa se c’è snapshot per quel file_key
 */
const BASE = (process.env.COMTRA_AUTH_URL || 'https://auth.comtra.dev').replace(/\/$/, '');
const token = process.env.COMTRA_JWT || process.env.JWT || '';
const fileKey = process.env.COMTRA_FILE_KEY || '';

if (!token.trim()) {
  console.error('Missing COMTRA_JWT (or JWT). Esempio: COMTRA_JWT="eyJ..." node scripts/verify-ds-import.mjs');
  process.exit(1);
}

const auth = { Authorization: `Bearer ${token.trim()}` };

async function getJson(url) {
  const r = await fetch(url, {
    method: 'GET',
    headers: {
      ...auth,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { _raw: text.slice(0, 500) };
  }
  return { ok: r.ok, status: r.status, headers: Object.fromEntries(r.headers.entries()), data };
}

console.log('Base URL:', BASE);

const list = await getJson(`${BASE}/api/user/ds-imports`);
console.log('\n=== GET /api/user/ds-imports ===');
console.log('status:', list.status);
console.log('response cache-control:', list.headers['cache-control'] || '(none)');
if (!list.ok) {
  console.log('body:', JSON.stringify(list.data, null, 2));
  process.exit(list.status === 401 ? 2 : 3);
}

const imports = Array.isArray(list.data?.imports) ? list.data.imports : [];
console.log('imports count:', imports.length);
if (imports.length) {
  console.log(
    'file_keys:',
    imports.map((i) => i?.file_key || i?.figma_file_key || '?').join(', ')
  );
}

if (fileKey.trim()) {
  const ctx = await getJson(
    `${BASE}/api/user/ds-imports/context?file_key=${encodeURIComponent(fileKey.trim())}&_ts=${Date.now()}`
  );
  console.log('\n=== GET /api/user/ds-imports/context ===');
  console.log('file_key:', fileKey.trim());
  console.log('status:', ctx.status);
  console.log('response cache-control:', ctx.headers['cache-control'] || '(none)');
  if (!ctx.ok) {
    console.log('body:', JSON.stringify(ctx.data, null, 2));
    process.exit(ctx.status === 401 ? 2 : 4);
  }
  const rawIdx = ctx.data?.ds_context_index;
  const hash = ctx.data?.ds_cache_hash ?? null;
  console.log('ds_cache_hash:', hash === null || hash === undefined || hash === '' ? '(empty)' : String(hash).slice(0, 24) + (String(hash).length > 24 ? '…' : ''));
  console.log('ds_context_index typeof:', rawIdx === null ? 'null' : rawIdx === undefined ? 'undefined' : typeof rawIdx);
  let idx = rawIdx;
  if (typeof rawIdx === 'string') {
    try {
      idx = JSON.parse(rawIdx);
      console.log('ds_context_index: parsed JSON string →', typeof idx);
    } catch {
      console.log('ds_context_index: string but not valid JSON (len', rawIdx.length, ')');
    }
  }
  const hasIndex =
    idx &&
    typeof idx === 'object' &&
    !Array.isArray(idx) &&
    Object.keys(idx).length > 0;
  const hasIndexArray = Array.isArray(idx) && idx.length > 0;
  console.log('has usable ds_context_index (non-empty object):', hasIndex);
  if (Array.isArray(idx)) {
    console.log('note: ds_context_index is an array (unexpected); length:', idx.length);
  }
  if (hasIndex) {
    const keys = Object.keys(idx).slice(0, 20);
    console.log('index top-level keys (sample):', keys.join(', '));
  } else if (rawIdx == null) {
    console.log(
      '⚠ ds_context_index is null/undefined: la riga c’è ma lo snapshot non è mai stato salvato (o è stato azzerato). Rifai “Confirm and import” nel wizard.'
    );
  } else if (typeof idx === 'object' && !Array.isArray(idx) && Object.keys(idx).length === 0) {
    console.log('⚠ ds_context_index è {} (oggetto vuoto). Rifai import completo dal plugin.');
  } else if (Array.isArray(idx) && idx.length === 0) {
    console.log('⚠ ds_context_index è array vuoto (inaspettato).');
  }
} else {
  console.log('\n(Tip: imposta COMTRA_FILE_KEY per provare anche /context.)');
}

console.log('\nOK.');
