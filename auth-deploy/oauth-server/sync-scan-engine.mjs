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

function normalizeBearerToken(input) {
  const token = typeof input === 'string' ? input.trim() : '';
  if (!token) return '';
  return /^bearer\s+/i.test(token) ? token : `Bearer ${token}`;
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
    headers['Authorization'] = normalizeBearerToken(authToken);
  }
  let authRejected = false;

  for (const path of STORYBOOK_LIST_PATHS) {
    const url = normalized + path;
    let timeoutId;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.status === 401 || res.status === 403) {
        authRejected = true;
        continue;
      }
      if (!res.ok) continue;
      const data = await res.json();
      const parsed = parseStorybookListResponse(data);
      if (parsed) {
        const storyCount = Array.isArray(parsed.stories) ? parsed.stories.length : 0;
        const componentCount = Array.isArray(parsed.components) ? parsed.components.length : 0;
        return {
          ...parsed,
          connectionStatus: 'ok',
          endpointPath: path,
          endpointUrl: url,
          entryCount: storyCount + componentCount,
          storyCount,
          componentCount,
        };
      }
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      continue;
    }
  }

  return {
    connectionStatus: 'unreachable',
    error: authRejected
      ? 'Storybook rejected the access token. Check that the token is valid and has access to this Storybook.'
      : 'Could not connect to Storybook. Ensure it is deployed and that the URL exposes a story list (e.g. /index.json, /api/stories, or see the guide in the plugin).',
  };
}

/**
 * Estrae nomi componenti dalla risposta Storybook.
 * @param {{ stories?: any[], components?: any[] }} sbData
 * @returns {string[]}
 */
const STORYBOOK_GROUP_PREFIXES = new Set([
  'component',
  'components',
  'ui',
  'atom',
  'atoms',
  'molecule',
  'molecules',
  'organism',
  'organisms',
  'foundation',
  'foundations',
]);

function asCleanString(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

function normalizeMatchName(input) {
  const s = asCleanString(input);
  if (!s) return '';
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function titleSegments(input) {
  const raw = asCleanString(input);
  if (!raw) return [];
  return raw
    .split(/[\/\\>|.]+/g)
    .map((p) => p.trim())
    .filter(Boolean);
}

function addAlias(out, raw) {
  const normalized = normalizeMatchName(raw);
  if (normalized) out.add(normalized);
}

function buildNameAliases(values) {
  const aliases = new Set();
  for (const value of values) {
    const raw = asCleanString(value);
    if (!raw) continue;
    addAlias(aliases, raw);

    const idReadable = raw.replace(/--/g, '/').replace(/[-_]+/g, ' ');
    addAlias(aliases, idReadable);

    const segments = titleSegments(idReadable);
    if (segments.length) {
      addAlias(aliases, segments[segments.length - 1]);
      if (segments.length >= 2) addAlias(aliases, `${segments[segments.length - 2]} ${segments[segments.length - 1]}`);

      const withoutPrefixes = segments.filter((seg, idx) => {
        if (idx > 1) return true;
        return !STORYBOOK_GROUP_PREFIXES.has(seg.toLowerCase());
      });
      if (withoutPrefixes.length) {
        addAlias(aliases, withoutPrefixes.join(' '));
        addAlias(aliases, withoutPrefixes[withoutPrefixes.length - 1]);
      }
    }
  }
  return aliases;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function similarity(a, b) {
  const aa = normalizeMatchName(a);
  const bb = normalizeMatchName(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 1;
  if (aa.includes(bb) || bb.includes(aa)) return Math.min(0.92, Math.min(aa.length, bb.length) / Math.max(aa.length, bb.length) + 0.15);
  const maxLen = Math.max(aa.length, bb.length);
  return maxLen ? 1 - levenshtein(aa, bb) / maxLen : 0;
}

function variantValuesFromRecord(record) {
  const values = new Set();
  const add = (v) => {
    const s = asCleanString(v);
    if (s) values.add(s);
  };
  if (!record || typeof record !== 'object') return values;
  add(record.name);
  const args = record.args && typeof record.args === 'object' && !Array.isArray(record.args) ? record.args : null;
  if (args) {
    for (const value of Object.values(args)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') add(String(value));
    }
  }
  const argTypes = record.argTypes && typeof record.argTypes === 'object' && !Array.isArray(record.argTypes) ? record.argTypes : null;
  if (argTypes) {
    for (const v of Object.values(argTypes)) {
      const options = v && typeof v === 'object' && Array.isArray(v.options) ? v.options : [];
      for (const opt of options) add(opt);
    }
  }
  return values;
}

function storybookEntryFromRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const component = asCleanString(record.component);
  const title = asCleanString(record.title);
  const name = asCleanString(record.name);
  const id = asCleanString(record.id);
  const importPath = asCleanString(record.importPath);
  const path = asCleanString(record.path);
  const rawName = component || titleSegments(title).at(-1) || title || name || id || importPath;
  if (!rawName) return null;
  const storyId = id || asCleanString(record.storyId);
  return {
    rawName,
    title,
    name,
    id: storyId,
    path,
    variantValues: variantValuesFromRecord(record),
    aliases: buildNameAliases([
      component,
      title,
      name,
      id,
      importPath,
      title && name ? `${title} ${name}` : '',
    ]),
  };
}

function storybookStoryUrl(baseUrl, entry) {
  if (!entry) return null;
  const base = normalizeStorybookBaseUrl(baseUrl);
  const rawPath = asCleanString(entry.path);
  if (rawPath) {
    const p = rawPath.trim();
    // Common Storybook payloads return either absolute URLs, iframe URLs, or logical paths like /story/foo--bar.
    if (/^https?:\/\//i.test(p)) return p;
    if (p.startsWith('/iframe.html') || p.startsWith('iframe.html')) {
      try {
        return new URL(p.startsWith('/') ? p : `/${p}`, base).toString();
      } catch {
        return null;
      }
    }
    if (p.startsWith('/story/') || p.startsWith('/docs/')) {
      return `${base}/?path=${encodeURIComponent(p)}`;
    }
    // Some hosts expose `path` already as `?path=/story/...`.
    if (p.startsWith('?path=')) return `${base}/${p}`;
    // Fallback for relative filesystem-like paths.
    try {
      return new URL(p.startsWith('/') ? p : `/${p}`, base).toString();
    } catch {
      return null;
    }
  }
  if (entry.id) return `${base}/?path=/story/${entry.id}`;
  return null;
}

function extractStorybookEntries(sbData) {
  const entries = [];

  if (Array.isArray(sbData.stories)) {
    for (const s of sbData.stories) {
      const entry = storybookEntryFromRecord(s);
      if (entry) entries.push(entry);
    }
  }
  if (Array.isArray(sbData.components)) {
    for (const c of sbData.components) {
      const entry = storybookEntryFromRecord(c);
      if (entry) entries.push(entry);
    }
  }

  return entries;
}

function buildFigmaEntries(figma) {
  const byAlias = new Map();
  const add = (name, id, variantProperties) => {
    const rawName = asCleanString(name);
    if (!rawName) return;
    const aliases = buildNameAliases([rawName]);
    const key = [...aliases][0] || normalizeMatchName(rawName);
    if (!key) return;
    const variantValues = new Set();
    if (variantProperties && typeof variantProperties === 'object' && !Array.isArray(variantProperties)) {
      for (const value of Object.values(variantProperties)) {
        const s = asCleanString(value);
        if (s) variantValues.add(s);
      }
    }
    if (byAlias.has(key)) {
      const existing = byAlias.get(key);
      for (const v of variantValues) existing.variantValues.add(v);
      if (!existing.layerId && id) existing.layerId = id;
      return;
    }
    byAlias.set(key, { rawName, layerId: id || null, aliases, variantValues });
  };
  for (const c of figma.components) add(c.name, c.id, c.variantProperties);
  for (const inst of figma.instances) add(inst.mainName || inst.name, inst.id, null);
  return [...byAlias.values()];
}

function indexStorybookEntries(entries) {
  const map = new Map();
  for (const entry of entries) {
    for (const alias of entry.aliases) {
      if (!map.has(alias)) map.set(alias, []);
      map.get(alias).push(entry);
    }
  }
  return map;
}

function findStorybookMatch(figmaEntry, aliasIndex) {
  for (const alias of figmaEntry.aliases) {
    const matches = aliasIndex.get(alias);
    if (matches?.length) return { entry: matches[0], alias };
  }
  return null;
}

function findPotentialStorybookMatch(figmaEntry, entries) {
  let best = null;
  for (const entry of entries) {
    const score = similarity(figmaEntry.rawName, entry.rawName);
    if (!best || score > best.score) best = { entry, score };
  }
  return best && best.score >= 0.72 ? best : null;
}

function missingVariantValues(figmaEntry, storyEntry) {
  if (!figmaEntry?.variantValues?.size || !storyEntry) return [];
  const storyAliases = new Set(storyEntry.aliases || []);
  for (const value of storyEntry.variantValues || []) {
    storyAliases.add(normalizeMatchName(value));
  }
  const missing = [];
  for (const value of figmaEntry.variantValues) {
    const normalized = normalizeMatchName(value);
    if (normalized && !storyAliases.has(normalized)) missing.push(value);
  }
  return missing;
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
    const variantProperties =
      c && c.variantProperties && typeof c.variantProperties === 'object' && !Array.isArray(c.variantProperties)
        ? c.variantProperties
        : null;
    if (name) components.push({ name, id: layerId || name, variantProperties });
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
  const sbResult = await fetchStorybookMetadata(storybookUrl, storybookToken);
  if (sbResult.connectionStatus !== 'ok') {
    return {
      items: [],
      connectionStatus: sbResult.connectionStatus || 'unreachable',
      error: sbResult.error,
    };
  }

  const figmaEntries = buildFigmaEntries(figma);
  const sbEntries = extractStorybookEntries(sbResult);
  const sbAliasIndex = indexStorybookEntries(sbEntries);
  const matchedStorybookEntries = new Set();
  const items = [];
  let idx = 0;

  for (const entry of figmaEntries) {
    const match = findStorybookMatch(entry, sbAliasIndex);
    if (match) {
      matchedStorybookEntries.add(match.entry);
      const missingVariants = missingVariantValues(entry, match.entry);
      if (missingVariants.length) {
        items.push({
          id: `drift-${idx++}`,
          name: entry.rawName,
          status: 'VARIANT_MISMATCH',
          lastEdited: '—',
          desc: `Component "${entry.rawName}" has Figma variants not represented in the matched Storybook entry: ${missingVariants.join(', ')}.`,
          layerId: entry.layerId,
          reason: `Matched Storybook "${match.entry.rawName}" via normalized alias "${match.alias}", but variant values are missing.`,
          confidence: 'medium',
          figmaName: entry.rawName,
          storybookName: match.entry.rawName,
          storybookUrl: storybookStoryUrl(storybookUrl, match.entry),
          suggestedAction: 'Add matching Storybook stories/args for the missing Figma variants.',
          syncAction: null,
        });
      } else if (normalizeMatchName(entry.rawName) !== normalizeMatchName(match.entry.rawName)) {
        items.push({
          id: `drift-${idx++}`,
          name: entry.rawName,
          status: 'NAME_MISMATCH',
          lastEdited: '—',
          desc: `Figma "${entry.rawName}" appears to match Storybook "${match.entry.rawName}", but names are not aligned.`,
          layerId: entry.layerId,
          reason: `Matched via normalized alias "${match.alias}".`,
          confidence: 'medium',
          figmaName: entry.rawName,
          storybookName: match.entry.rawName,
          storybookUrl: storybookStoryUrl(storybookUrl, match.entry),
          suggestedAction: 'Align naming on one side to make future sync deterministic.',
          syncAction: entry.layerId
            ? {
                kind: 'rename_figma',
                layerId: entry.layerId,
                targetName: match.entry.rawName,
              }
            : null,
        });
      }
    } else {
      const potential = findPotentialStorybookMatch(entry, sbEntries);
      if (potential) {
        matchedStorybookEntries.add(potential.entry);
        items.push({
          id: `drift-${idx++}`,
          name: entry.rawName,
          status: 'POTENTIAL_MATCH',
          lastEdited: '—',
          desc: `Figma "${entry.rawName}" may match Storybook "${potential.entry.rawName}", but confidence is not high enough to auto-sync.`,
          layerId: entry.layerId,
          reason: `Best fuzzy score: ${Math.round(potential.score * 100)}%.`,
          confidence: 'low',
          figmaName: entry.rawName,
          storybookName: potential.entry.rawName,
          storybookUrl: storybookStoryUrl(storybookUrl, potential.entry),
          suggestedAction: 'Review and align names, or confirm this match before applying changes.',
          syncAction: null,
        });
        continue;
      }
      items.push({
        id: `drift-${idx++}`,
        name: entry.rawName,
        status: 'MISSING_IN_STORYBOOK',
        lastEdited: '—',
        desc: `Component "${entry.rawName}" exists in Figma but has no matching story in Storybook. Add a story or align naming.`,
        layerId: entry.layerId,
        reason: 'No Storybook entry matched any normalized Figma aliases.',
        confidence: 'high',
        figmaName: entry.rawName,
        storybookName: null,
        storybookUrl: null,
        suggestedAction: 'Create a Storybook story or rename an existing story so it matches this Figma component.',
        syncAction: null,
      });
    }
  }

  for (const entry of sbEntries) {
    if (!matchedStorybookEntries.has(entry)) {
      items.push({
        id: `drift-${idx++}`,
        name: entry.rawName,
        status: 'MISSING_IN_FIGMA',
        lastEdited: '—',
        desc: `Story "${entry.rawName}" exists in Storybook but no matching component found in this Figma file. Verify design coverage.`,
        layerId: null,
        reason: 'No Figma component or instance matched this Storybook entry aliases.',
        confidence: 'high',
        figmaName: null,
        storybookName: entry.rawName,
        storybookUrl: storybookStoryUrl(storybookUrl, entry),
        suggestedAction: 'Create or rename the matching Figma component, or mark this story as intentionally code-only.',
        syncAction: {
          kind: 'create_figma_placeholder',
          targetName: entry.rawName,
          storybookUrl: storybookStoryUrl(storybookUrl, entry),
        },
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
