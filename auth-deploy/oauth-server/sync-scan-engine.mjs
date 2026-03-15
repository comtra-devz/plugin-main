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
 * Prova a fetchare Storybook API. Supporta:
 * - storybook-api: /api/stories, /api/components
 * - index.json (alcuni static export)
 * @param {string} baseUrl - URL base Storybook (es. https://storybook.example.com, può contenere ?path=... che verrà rimosso)
 * @param {string} [authToken] - Token opzionale per Storybook privato (Authorization: Bearer)
 * @returns {Promise<{ stories?: any[], components?: any[], connectionStatus: string, error?: string }>}
 */
export async function fetchStorybookMetadata(baseUrl, authToken) {
  const normalized = normalizeStorybookBaseUrl(baseUrl);
  const urlsToTry = [
    `${normalized}/api/stories`,
    `${normalized}/api/components`,
    `${normalized}/index.json`,
  ];
  const headers = { Accept: 'application/json' };
  if (authToken && typeof authToken === 'string' && authToken.trim()) {
    headers['Authorization'] = `Bearer ${authToken.trim()}`;
  }

  for (const url of urlsToTry) {
    let timeoutId;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) continue;
      const data = await res.json();

      // storybook-api: { stories: [...] } o { components: [...] }
      if (Array.isArray(data.stories)) {
        return { stories: data.stories, connectionStatus: 'ok' };
      }
      if (Array.isArray(data.components)) {
        return { components: data.components, connectionStatus: 'ok' };
      }
      // index.json: spesso { entries: { ... } } o struttura simile
      if (data.entries && typeof data.entries === 'object') {
        const stories = Object.values(data.entries).filter(Boolean);
        return { stories, connectionStatus: 'ok' };
      }
      if (Array.isArray(data)) {
        return { stories: data, connectionStatus: 'ok' };
      }
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      continue;
    }
  }

  return {
    connectionStatus: 'unreachable',
    error: 'Could not connect to Storybook. Ensure it is deployed and publicly accessible. If using storybook-api (npm), ensure /api/stories is exposed.',
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
 * Genera drift items confrontando Figma e Storybook.
 * @param {object} fileJson - { document: { children: [...] } }
 * @param {string} storybookUrl
 * @param {string} [storybookToken] - Token opzionale per Storybook con accesso protetto
 * @returns {Promise<{ items: Array<{id: string, name: string, status: string, lastEdited: string, desc: string}>, connectionStatus: string, error?: string }>}
 */
export async function runSyncScan(fileJson, storybookUrl, storybookToken) {
  const doc = fileJson?.document || fileJson;
  const figma = extractFigmaComponents(doc);
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

  // Map component name -> first node id (for Select Layer in Figma)
  const nameToLayerId = new Map();
  for (const inst of figma.instances) {
    const key = inst.mainName || inst.name;
    if (key && !nameToLayerId.has(key)) nameToLayerId.set(key, inst.id);
  }
  for (const c of figma.components) {
    if (c.name && !nameToLayerId.has(c.name)) nameToLayerId.set(c.name, c.id);
  }

  // In Figma ma non in Storybook
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

  // In Storybook ma non in Figma
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
