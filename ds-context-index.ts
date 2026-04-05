/// <reference types="@figma/plugin-typings" />

/**
 * Compact design-system context for the generation engine (Phase 1).
 * Built on the Figma main thread; UI requests via `get-ds-context-index`.
 */

export const DS_CONTEXT_INDEX_VERSION = 1;

/** Dopo modifiche al file, aspetta prima di scansione completa (file grandi + meno rivalidazioni ravvicinate). */
const DEBOUNCE_MS = 1500;
const MAX_COMPONENTS_IN_INDEX = 500;
const MAX_VARIABLE_NAMES_IN_INDEX = 1500;
const MAX_PROPERTY_KEYS = 24;
const MAX_SLOT_HINTS = 12;
const MAX_NAME_LEN = 160;

export type DsComponentSummary = {
  id: string;
  name: string;
  type: 'COMPONENT' | 'COMPONENT_SET';
  variantAxes?: string[];
  propertyKeys?: string[];
  slotHints?: string[];
};

export type DsContextIndexPayload = {
  version: number;
  ds_source: 'file';
  fileName: string;
  hash: string;
  components: DsComponentSummary[];
  components_truncated?: boolean;
  total_components_in_file?: number;
  token_categories: Record<string, number>;
  modes: string[];
  styles_summary?: { paintStyles: number; textStyles: number; effectStyles: number };
  total_tokens: number;
  /** Nomi variabili locali (per governance Fase 4 lato server). */
  variable_names?: string[];
  variable_names_truncated?: boolean;
};

type BuildResult = { index: DsContextIndexPayload; canonicalJson: string };

let cache: BuildResult | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Increments on every `documentchange` so we know if a cached index predates edits. */
let docEpoch = 0;
/** `docEpoch` value for which `cache` was built; if !== `docEpoch`, cached payload is stale. */
let cacheBuiltAtEpoch: number | null = null;

const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

function isIndexCacheFresh(): boolean {
  return cache !== null && cacheBuiltAtEpoch !== null && cacheBuiltAtEpoch === docEpoch;
}

/**
 * Durante `executeActionPlanOnCanvas` il documento riceve molti `documentchange`; un rebuild
 * completo dell’indice in parallelo impallerebbe Figma su file grandi. Si sospende il refresh
 * e si fa al massimo un debounce dopo la fine.
 */
let refreshSuspended = false;
let dirtyWhileSuspended = false;

/**
 * true = non schedulare rebuild su documentchange (es. mentre si applica un action plan).
 * Alla ripresa, un solo refresh debounced se nel frattempo il file è cambiato.
 */
export function setDsContextIndexRefreshSuspended(suspended: boolean): void {
  if (suspended) {
    refreshSuspended = true;
    if (debounceTimer != null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  } else {
    refreshSuspended = false;
    if (dirtyWhileSuspended) {
      dirtyWhileSuspended = false;
      runDebouncedRefresh();
    }
  }
}

/** Evita più `loadAllPagesAsync` sovrapposti (init + primo build spesso in sequenza ravvicinata). */
let loadAllPagesInFlight: Promise<void> | null = null;
async function ensureAllPagesLoaded(): Promise<void> {
  if (!loadAllPagesInFlight) {
    loadAllPagesInFlight = figma.loadAllPagesAsync().finally(() => {
      loadAllPagesInFlight = null;
    });
  }
  return loadAllPagesInFlight;
}

function stableStringifyForHash(obj: unknown): string {
  const sortObjectDeep = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(sortObjectDeep);
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = sortObjectDeep(o[k]);
    return out;
  };
  return JSON.stringify(sortObjectDeep(obj));
}

async function digestHex(s: string): Promise<string> {
  try {
    const enc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
    const c = typeof crypto !== 'undefined' ? crypto : null;
    if (enc && c && c.subtle) {
      const buf = await c.subtle.digest('SHA-256', enc.encode(s));
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch (_) {
    /* fallthrough */
  }
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 'djb2:' + (h >>> 0).toString(16);
}

function summarizeComponent(node: ComponentNode | ComponentSetNode): DsComponentSummary {
  const defs = node.componentPropertyDefinitions;
  const propertyKeys = defs ? Object.keys(defs).slice(0, MAX_PROPERTY_KEYS) : [];
  const slotHints: string[] = [];
  if (defs) {
    for (const [k, def] of Object.entries(defs)) {
      if (def && def.type === 'INSTANCE_SWAP') {
        slotHints.push(k.length > 48 ? k.slice(0, 48) : k);
        if (slotHints.length >= MAX_SLOT_HINTS) break;
      }
    }
  }
  let variantAxes: string[] | undefined;
  if (node.type === 'COMPONENT_SET') {
    const vgp = node.variantGroupProperties;
    if (vgp && typeof vgp === 'object') {
      variantAxes = Object.keys(vgp).slice(0, 16);
    }
  }
  const name = node.name.length > MAX_NAME_LEN ? node.name.slice(0, MAX_NAME_LEN) : node.name;
  const out: DsComponentSummary = { id: node.id, name, type: node.type };
  if (variantAxes && variantAxes.length) out.variantAxes = variantAxes;
  if (propertyKeys.length) out.propertyKeys = propertyKeys;
  if (slotHints.length) out.slotHints = slotHints;
  return out;
}

async function collectAllLocalComponents(): Promise<(ComponentNode | ComponentSetNode)[]> {
  await ensureAllPagesLoaded();
  const out: (ComponentNode | ComponentSetNode)[] = [];
  let pageIdx = 0;
  for (const child of figma.root.children) {
    if (child.type !== 'PAGE') continue;
    try {
      await child.loadAsync();
    } catch (_) {
      continue;
    }
    const found = child.findAll(
      (n): n is ComponentNode | ComponentSetNode =>
        n.type === 'COMPONENT' || n.type === 'COMPONENT_SET'
    );
    for (const n of found) out.push(n);
    pageIdx++;
    // `findAll` è sincrono e su file grandi blocca il main thread: cedi tra una pagina e l’altra.
    if (pageIdx % 2 === 0) await yieldToMain();
  }
  return out;
}

export async function buildDsContextIndex(): Promise<BuildResult> {
  const [componentsRaw, variables, collections, paintStyles, textStyles, effectStyles] =
    await Promise.all([
      collectAllLocalComponents(),
      figma.variables.getLocalVariablesAsync(),
      figma.variables.getLocalVariableCollectionsAsync(),
      figma.getLocalPaintStylesAsync(),
      figma.getLocalTextStylesAsync(),
      figma.getLocalEffectStylesAsync(),
    ]);

  const totalInFile = componentsRaw.length;
  const sorted = componentsRaw.slice().sort((a, b) => a.id.localeCompare(b.id));
  const truncated = sorted.length > MAX_COMPONENTS_IN_INDEX;
  const componentsSlice = truncated ? sorted.slice(0, MAX_COMPONENTS_IN_INDEX) : sorted;
  const components = componentsSlice.map(summarizeComponent);

  const token_categories: Record<string, number> = {};
  for (const v of variables) {
    const t = v.resolvedType;
    token_categories[t] = (token_categories[t] || 0) + 1;
  }

  const modeNames = new Set<string>();
  for (const c of collections) {
    for (const m of c.modes) {
      if (m.name) modeNames.add(m.name);
    }
  }
  const modes = Array.from(modeNames).sort();

  const variableNamesSorted = variables
    .map((v) => String(v.name || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const variableNamesTruncated = variableNamesSorted.length > MAX_VARIABLE_NAMES_IN_INDEX;
  const variable_names = variableNamesTruncated
    ? variableNamesSorted.slice(0, MAX_VARIABLE_NAMES_IN_INDEX)
    : variableNamesSorted;

  const styles_summary = {
    paintStyles: paintStyles.length,
    textStyles: textStyles.length,
    effectStyles: effectStyles.length,
  };

  const bodyForHash = {
    fileName: figma.root.name || '',
    components: components.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      variantAxes: c.variantAxes,
      propertyKeys: c.propertyKeys,
      slotHints: c.slotHints,
    })),
    token_categories: Object.keys(token_categories)
      .sort()
      .reduce<Record<string, number>>((acc, k) => {
        acc[k] = token_categories[k];
        return acc;
      }, {}),
    modes,
    styles_summary,
    components_truncated: truncated || undefined,
    total_components_in_file: totalInFile,
    variable_names,
    variable_names_truncated: variableNamesTruncated || undefined,
  };

  const canonicalJson = stableStringifyForHash(bodyForHash);
  const hash = await digestHex(canonicalJson);

  const index: DsContextIndexPayload = {
    version: DS_CONTEXT_INDEX_VERSION,
    ds_source: 'file',
    fileName: figma.root.name || '',
    hash,
    components,
    total_tokens: variables.length,
    token_categories,
    modes,
    styles_summary,
    variable_names,
  };
  if (variableNamesTruncated) index.variable_names_truncated = true;
  if (truncated) {
    index.components_truncated = true;
    index.total_components_in_file = totalInFile;
  }

  return { index, canonicalJson };
}

function runDebouncedRefresh(): void {
  if (refreshSuspended) {
    dirtyWhileSuspended = true;
    return;
  }
  if (debounceTimer != null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const e0 = docEpoch;
    buildDsContextIndex()
      .then((r) => {
        if (docEpoch !== e0) {
          runDebouncedRefresh();
          return;
        }
        cache = r;
        cacheBuiltAtEpoch = e0;
      })
      .catch((e) => console.error('[ds-context-index]', e));
  }, DEBOUNCE_MS);
}

function onDocumentOrStructureChange(): void {
  docEpoch++;
  runDebouncedRefresh();
}

/**
 * Call once at plugin startup: refresh index after edits (debounced).
 * With `documentAccess: "dynamic-page"`, Figma requires `loadAllPagesAsync` before
 * registering `documentchange` (incremental document mode); otherwise the plugin crashes on startup.
 */
export async function initDsContextIndexLifecycle(): Promise<void> {
  await ensureAllPagesLoaded();
  figma.on('documentchange', onDocumentOrStructureChange);
  figma.on('currentpagechange', runDebouncedRefresh);
  /** Nessun build immediato: alleggerisce l'apertura del plugin; l'indice si costruisce su prima Generate / get-ds-context-index / documentchange. */
}

/**
 * Usato dalla UI prima di `/api/agents/generate`: se il file non è cambiato dall’ultimo build,
 * evita una seconda scansione completa (spesso ~secondi su migliaia di nodi).
 */
export async function resolveDsContextIndexForRequest(options?: {
  reuseCached?: boolean;
}): Promise<DsContextIndexPayload> {
  if (options?.reuseCached !== false && isIndexCacheFresh()) {
    return cache!.index;
  }
  return buildAndCacheDsContextIndex();
}

/**
 * Fresh build (cancels pending debounced run), updates cache. Use for explicit UI requests.
 */
export async function buildAndCacheDsContextIndex(): Promise<DsContextIndexPayload> {
  if (debounceTimer != null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  for (;;) {
    const e0 = docEpoch;
    const r = await buildDsContextIndex();
    if (docEpoch === e0) {
      cache = r;
      cacheBuiltAtEpoch = e0;
      return r.index;
    }
    await yieldToMain();
  }
}

export function getCachedDsContextIndex(): DsContextIndexPayload | null {
  return cache?.index ?? null;
}
