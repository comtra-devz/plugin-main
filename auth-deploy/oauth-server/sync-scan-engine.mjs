/**
 * Sync Scan Engine — confronto Figma vs Storybook per drift detection.
 * Input: fileJson (Figma document), storybookUrl.
 * Output: drift items (id, name, status, lastEdited, desc) per SyncTab.
 *
 * Storybook: prova /api/stories (storybook-api), /api/components, /index.json.
 * Se Storybook non raggiungibile, restituisce connectionError.
 */

/**
 * Estrae nomi componenti e istanze dal documento Figma (ricorsivo).
 * @param {object} node - Nodo Figma (document tree)
 * @returns {{ components: string[], instances: Array<{name: string, id: string, mainName?: string}> }}
 */
function extractFigmaComponents(node) {
  const components = [];
  const instances = [];

  function walk(n) {
    if (!n || typeof n !== 'object') return;
    const name = n.name || '';
    const id = n.id || '';

    if (n.type === 'COMPONENT') {
      if (name) components.push({ name, id });
    }
    if (n.type === 'INSTANCE') {
      instances.push({ name, id, mainName: n.mainComponent?.name || name });
    }

    if (Array.isArray(n.children)) {
      for (const c of n.children) walk(c);
    }
  }

  walk(node);
  return {
    components,
    instances,
  };
}

/**
 * Normalizza URL Storybook: rimuove query string e hash così /api/stories viene provato sulla base corretta.
 * Es.: https://example.com/storybook/?path=/docs/foo → https://example.com/storybook
 */
function normalizeStorybookBaseUrl(input) {
  const s = (input || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    const pathname = u.pathname.replace(/\/$/, '') || '';
    return u.origin + pathname;
  } catch {
    return s.replace(/\/$/, '');
  }
}

/**
 * Path comuni dove gli Storybook (static export, addon, Chromatic, GitHub Pages, ecc.) espongono la lista stories.
 * Non esiste uno standard unico: proviamo più varianti per massimizzare compatibilità.
 */
const STORYBOOK_LIST_PATHS = [
  '/api/stories',           // storybook-api (npm), vari server custom
  '/api/components',       // storybook-api
  '/index.json',            // static export Storybook, Chromatic, molti host
  '/stories.json',          // alcuni generatori / custom
  '/storybook/index.json',  // export in subpath
  '/api/storybook/stories', // varianti API
];

/**
 * Da una risposta JSON grezza estrae un array di "storie/componenti" se la struttura è riconosciuta.
 * @param {any} data - corpo JSON della risposta
 * @returns {{ stories?: any[], components?: any[] } | null}
 */
function parseStorybookListResponse(data) {
  if (!data || typeof data !== 'object') return null;
  if (Array.isArray(data.stories)) return { stories: data.stories };
  if (Array.isArray(data.components)) return { components: data.components };
  if (Array.isArray(data)) return { stories: data };
  if (data.entries && typeof data.entries === 'object' && !Array.isArray(data.entries)) {
    const list = Object.values(data.entries).filter(Boolean);
    return list.length ? { stories: list } : null;
  }
  if (data.stories && typeof data.stories === 'object' && !Array.isArray(data.stories)) {
    const list = Object.values(data.stories).filter(Boolean);
    return list.length ? { stories: list } : null;
  }
  if (data.v2?.entries && typeof data.v2.entries === 'object') {
    const list = Object.values(data.v2.entries).filter(Boolean);
    return list.length ? { stories: list } : null;
  }
  return null;
}

/**
 * Prova a fetchare Storybook API. Prova tutti i path in STORYBOOK_LIST_PATHS e accetta
 * più strutture JSON (stories[], components[], entries{}, ecc.).
 * @param {string} baseUrl - URL base Storybook (query/hash rimossi)
 * @param {string} [authToken] - Token opzionale (Authorization: Bearer)
 * @returns {Promise<{ stories?: any[], components?: any[], connectionStatus: string, error?: string }>}
 */
export async function fetchStorybookMetadata(baseUrl, authToken) {
  const normalized = normalizeStorybookBaseUrl(baseUrl);
  const headers = { Accept: 'application/json' };
  if (authToken && typeof authToken === 'string' && authToken.trim()) {
    headers['Authorization'] = `Bearer ${authToken.trim()}`;
  }

  for (const path of STORYBOOK_LIST_PATHS) {
    const url = normalized + path;
    let timeoutId;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) continue;
      const data = await res.json();
      const parsed = parseStorybookListResponse(data);
      if (parsed) return { ...parsed, connectionStatus: 'ok' };
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      continue;
    }
  }

  return {
    connectionStatus: 'unreachable',
    error: 'Could not connect to Storybook. Ensure it is deployed and that the URL exposes a story list (e.g. /index.json, /api/stories, or see the guide in the plugin).',
  };
}

/**
 * Estrae nomi componenti dalla risposta Storybook.
 * @param {{ stories?: any[], components?: any[] }} sbData
 * @returns {string[]}
 */
function extractStorybookComponentNames(sbData) {
  const names = new Set();

  if (Array.isArray(sbData.stories)) {
    for (const s of sbData.stories) {
      const name = s.component || s.title || s.name || s.id;
      if (name && typeof name === 'string') names.add(name);
    }
  }
  if (Array.isArray(sbData.components)) {
    for (const c of sbData.components) {
      const name = c.name || c.id || c.title;
      if (name && typeof name === 'string') names.add(name);
    }
  }

  return [...names];
}

/**
 * @param {any} snapshot - sync_snapshot from plugin
 * @returns {{ components: Array<{name: string, id: string}>, instances: Array<{name: string, id: string, mainName?: string}> }}
 */
function figmaExtractFromSyncSnapshot(snapshot) {
  const components = [];
  const instances = [];
  const compList = Array.isArray(snapshot?.components) ? snapshot.components : [];
  for (const c of compList) {
    const name = c && typeof c.name === 'string' ? c.name.trim() : '';
    const layerId =
      c && typeof c.key === 'string' && c.key.trim()
        ? c.key.trim()
        : c && typeof c.id === 'string' && c.id.trim()
          ? c.id.trim()
          : '';
    if (name) components.push({ name, id: layerId || name });
  }
  const instList = Array.isArray(snapshot?.instances) ? snapshot.instances : [];
  for (const i of instList) {
    const name = i && typeof i.name === 'string' ? i.name : '';
    const id = i && typeof i.id === 'string' ? i.id : '';
    const mainName =
      i && typeof i.mainComponentName === 'string' && i.mainComponentName.trim()
        ? i.mainComponentName.trim()
        : null;
    if (!id && !name) continue;
    instances.push({ name, id: id || name, mainName: mainName || undefined });
  }
  return { components, instances };
}

/**
 * @param {{ components: Array<{name: string, id: string}>, instances: Array<{name: string, id: string, mainName?: string}> }} figma
 */
async function runSyncScanWithFigmaExtract(figma, storybookUrl, storybookToken) {
  const figmaComponentNames = new Set([
    ...figma.components.map((c) => c.name),
    ...figma.instances.map((i) => i.mainName || i.name).filter(Boolean),
  ]);

  const sbResult = await fetchStorybookMetadata(storybookUrl, storybookToken);
  if (sbResult.connectionStatus !== 'ok') {
    return {
      items: [],
      connectionStatus: sbResult.connectionStatus || 'unreachable',
      error: sbResult.error,
    };
  }

  const sbNames = new Set(extractStorybookComponentNames(sbResult));
  const items = [];
  let idx = 0;

  const nameToLayerId = new Map();
  for (const inst of figma.instances) {
    const key = inst.mainName || inst.name;
    if (key && !nameToLayerId.has(key)) nameToLayerId.set(key, inst.id);
  }
  for (const c of figma.components) {
    if (c.name && !nameToLayerId.has(c.name)) nameToLayerId.set(c.name, c.id);
  }

  for (const name of figmaComponentNames) {
    if (!sbNames.has(name)) {
      items.push({
        id: `drift-${idx++}`,
        name,
        status: 'DRIFT',
        lastEdited: '—',
        desc: `Component "${name}" exists in Figma but has no matching story in Storybook. Add a story or align naming.`,
        layerId: nameToLayerId.get(name) || null,
      });
    }
  }

  for (const name of sbNames) {
    if (!figmaComponentNames.has(name)) {
      items.push({
        id: `drift-${idx++}`,
        name,
        status: 'DRIFT',
        lastEdited: '—',
        desc: `Story "${name}" exists in Storybook but no matching component found in this Figma file. Verify design coverage.`,
        layerId: null,
      });
    }
  }

  return {
    items,
    connectionStatus: 'ok',
  };
}

/**
 * @param {any} syncSnapshot - plugin-built sync_snapshot
 */
export async function runSyncScanFromSnapshot(syncSnapshot, storybookUrl, storybookToken) {
  const figma = figmaExtractFromSyncSnapshot(syncSnapshot);
  return runSyncScanWithFigmaExtract(figma, storybookUrl, storybookToken);
}

/**
 * Genera drift items confrontando Figma e Storybook.
 * @param {object} fileJson - { document: { children: [...] } }
 * @param {string} storybookUrl
 * @param {string} [storybookToken] - Token opzionale per Storybook con accesso protetto
 * @returns {Promise<{ items: Array<{id: string, name: string, status: string, lastEdited: string, desc: string}>, connectionStatus: string, error?: string }>}
 */
export async function runSyncScan(fileJson, storybookUrl, storybookToken) {
  const doc = fileJson?.document || fileJson;
  const figma = extractFigmaComponents(doc);
  return runSyncScanWithFigmaExtract(figma, storybookUrl, storybookToken);
}
