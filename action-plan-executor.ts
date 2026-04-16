/**
 * Esegue l'action plan (JSON da /api/agents/generate) sulla pagina Figma corrente.
 * Problem 1 (Fase 5): risoluzione componenti con `getNodeByIdAsync` + `loadAllPagesAsync`, `createInstance`,
 * `setProperties` (variantProperties/properties), fills con variabili, `boundLayout` opzionale sui frame.
 */

type VarMap = Map<string, Variable>;

const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function normTokenKey(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '/');
}

async function buildLocalVariableMap(): Promise<VarMap> {
  const map: VarMap = new Map();
  try {
    const vars = await figma.variables.getLocalVariablesAsync();
    for (const v of vars) {
      const n = v.name.toLowerCase().trim();
      map.set(n, v);
      map.set(n.replace(/\//g, '.'), v);
      map.set(normTokenKey(n), v);
    }
  } catch {
    /* variabili assenti o API limitata */
  }
  return map;
}

function lookupVariable(varMap: VarMap, ref: string): Variable | null {
  const r = String(ref || '').trim();
  if (!r) return null;
  const lower = r.toLowerCase();
  return (
    varMap.get(lower) ||
    varMap.get(lower.replace(/\//g, '.')) ||
    varMap.get(normTokenKey(lower)) ||
    null
  );
}

const VARIABLE_ID_CACHE_PREFIX = 'comtra_var_key::';

function registerVariableInMap(varMap: VarMap, variable: Variable): void {
  const name = String(variable.name || '').toLowerCase().trim();
  if (name) {
    varMap.set(name, variable);
    varMap.set(name.replace(/\//g, '.'), variable);
    varMap.set(normTokenKey(name), variable);
  }
  const key = String((variable as { key?: string }).key || '').toLowerCase().trim();
  if (key) varMap.set(key, variable);
}

function looksLikeVariableKey(raw: string): boolean {
  const s = String(raw || '').trim();
  return /^[a-zA-Z0-9_-]{20,}$/.test(s) && !s.includes('/') && !s.includes('.');
}

async function resolveVariableForExecution(varMap: VarMap, ref: string): Promise<Variable | null> {
  const raw = String(ref || '').trim();
  if (!raw) return null;
  const local = lookupVariable(varMap, raw);
  if (local) return local;
  if (!looksLikeVariableKey(raw)) return null;

  const cacheKey = `${VARIABLE_ID_CACHE_PREFIX}${raw}`;
  try {
    const cachedId = await figma.clientStorage.getAsync(cacheKey);
    if (typeof cachedId === 'string' && cachedId.trim()) {
      try {
        const cachedVar = await figma.variables.getVariableByIdAsync(cachedId.trim());
        if (cachedVar) {
          registerVariableInMap(varMap, cachedVar);
          return cachedVar;
        }
      } catch {
        /* stale cache -> continue with import */
      }
    }
  } catch {
    /* storage best effort */
  }

  try {
    const imported = await figma.variables.importVariableByKeyAsync(raw);
    registerVariableInMap(varMap, imported);
    try {
      await figma.clientStorage.setAsync(cacheKey, imported.id);
    } catch {
      /* cache best effort */
    }
    return imported;
  } catch {
    return null;
  }
}

function nextPlacementOnPage(page: PageNode): { x: number; y: number } {
  let maxRight = -Infinity;
  let minTop = Infinity;
  let any = false;
  for (const n of page.children) {
    if (!('absoluteBoundingBox' in n) || !n.absoluteBoundingBox) continue;
    any = true;
    const box = n.absoluteBoundingBox;
    maxRight = Math.max(maxRight, box.x + box.width);
    minTop = Math.min(minTop, box.y);
  }
  if (!any) return { x: 0, y: 0 };
  if (!Number.isFinite(maxRight)) return { x: 0, y: 0 };
  return { x: maxRight + 100, y: Number.isFinite(minTop) ? minTop : 0 };
}

function parseLayoutMode(raw: unknown): 'NONE' | 'HORIZONTAL' | 'VERTICAL' {
  const s = String(raw || 'NONE').toUpperCase();
  if (s === 'HORIZONTAL' || s === 'VERTICAL' || s === 'NONE') return s;
  return 'VERTICAL';
}

function applyNumericOrBound(
  node: FrameNode,
  field: 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft' | 'itemSpacing',
  value: unknown,
  varMap: VarMap,
  fallback: number
): void {
  if (typeof value === 'number' && Number.isFinite(value)) {
    node[field] = value;
    return;
  }
  if (typeof value === 'string' && value.trim()) {
    const v = lookupVariable(varMap, value);
    if (v && v.resolvedType === 'FLOAT') {
      try {
        node.setBoundVariable(field, v);
        return;
      } catch {
        /* fallback sotto */
      }
    }
  }
  node[field] = fallback;
}

/** Sfondo / forme: leggibile su bianco senza essere troppo invadente. */
const DEFAULT_FILL_SURFACE: RGB = { r: 0.9, g: 0.92, b: 0.95 };
/** Testo: default scuro; se il modello manda quasi-bianco, si corregge (evita “frame vuoto”). */
const DEFAULT_FILL_TEXT: RGB = { r: 0.12, g: 0.12, b: 0.14 };

function clampUnitChannel(x: number): number {
  if (!Number.isFinite(x)) return 0;
  if (x > 1 && x <= 255) return Math.max(0, Math.min(1, x / 255));
  return Math.max(0, Math.min(1, x));
}

function parseRgbFromUnknown(c: unknown): RGB | null {
  if (!isRecord(c)) return null;
  if (c.r === undefined && c.g === undefined && c.b === undefined) return null;
  return {
    r: clampUnitChannel(Number(c.r)),
    g: clampUnitChannel(Number(c.g)),
    b: clampUnitChannel(Number(c.b)),
  };
}

function solidLuminance(rgb: RGB): number {
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

function ensureTextFillReadable(rgb: RGB): RGB {
  if (solidLuminance(rgb) > 0.92) return { ...DEFAULT_FILL_TEXT };
  return rgb;
}

/** `text` = riempimenti tipografici (contrasto); `surface` = frame/rettangoli. */
function applyFillsToNode(
  node: GeometryMixin,
  fills: unknown,
  varMap: VarMap,
  role: 'text' | 'surface' = 'surface',
): void {
  const list = Array.isArray(fills) ? fills : [];
  const baseDefault: RGB = role === 'text' ? DEFAULT_FILL_TEXT : DEFAULT_FILL_SURFACE;

  if (list.length === 0) {
    const c = role === 'text' ? ensureTextFillReadable(baseDefault) : baseDefault;
    node.fills = [{ type: 'SOLID', color: c, opacity: 1 }];
    return;
  }

  const out: SolidPaint[] = [];
  for (const entry of list) {
    if (!isRecord(entry) || entry.type !== 'SOLID') continue;
    const fromModel = parseRgbFromUnknown(entry.color);
    const raw = fromModel ?? baseDefault;
    const color = role === 'text' ? ensureTextFillReadable(raw) : raw;
    const op = Number((entry as Record<string, unknown>).opacity);
    const opacity = Number.isFinite(op) && op >= 0 && op <= 1 ? op : 1;
    out.push({ type: 'SOLID', color, opacity });
  }
  if (out.length === 0) {
    const c = role === 'text' ? ensureTextFillReadable(baseDefault) : baseDefault;
    node.fills = [{ type: 'SOLID', color: c, opacity: 1 }];
  } else {
    node.fills = out;
  }

  const first = list[0];
  if (isRecord(first) && typeof first.variable === 'string' && first.variable.trim()) {
    const v = lookupVariable(varMap, first.variable);
    const fillsNow = node.fills;
    if (v && v.resolvedType === 'COLOR' && Array.isArray(fillsNow) && fillsNow[0]?.type === 'SOLID') {
      try {
        const bound = figma.variables.setBoundVariableForPaint(fillsNow[0] as SolidPaint, 'color', v);
        node.fills = [bound];
      } catch {
        /* lascia colori parsati sopra */
      }
    }
  }
}

function applyFrameGeometry(f: FrameNode, spec: Record<string, unknown>, varMap: VarMap): void {
  const w = Number(spec.width);
  const h = Number(spec.height);
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) f.resize(w, h);

  const lm = parseLayoutMode(spec.layoutMode);
  f.layoutMode = lm;
  if (lm !== 'NONE') {
    f.primaryAxisSizingMode = 'FIXED';
    f.counterAxisSizingMode = 'FIXED';
    applyNumericOrBound(f, 'paddingTop', spec.paddingTop, varMap, 16);
    applyNumericOrBound(f, 'paddingRight', spec.paddingRight, varMap, 16);
    applyNumericOrBound(f, 'paddingBottom', spec.paddingBottom, varMap, 16);
    applyNumericOrBound(f, 'paddingLeft', spec.paddingLeft, varMap, 16);
    applyNumericOrBound(f, 'itemSpacing', spec.itemSpacing, varMap, 8);
  }
  applyFillsToNode(f, spec.fills, varMap, 'surface');
  if (typeof spec.name === 'string' && spec.name.trim()) f.name = spec.name.trim();
}

function asChildHost(n: SceneNode): ChildrenMixin | null {
  if (n.type === 'FRAME' || n.type === 'GROUP' || n.type === 'SECTION') return n as ChildrenMixin;
  return null;
}

function resolveParent(action: Record<string, unknown>, idMap: Map<string, SceneNode>, root: FrameNode): ChildrenMixin {
  const pid = String(action.parentId || action.parent || 'root').trim();
  if (pid === 'root') return root;
  const node = idMap.get(pid);
  if (!node) return root;
  return asChildHost(node) ?? root;
}

/** True se c’è testo, forme, istanze — non solo frame vuoti annidati. */
function subtreeHasUserVisibleContent(node: SceneNode): boolean {
  if (node.type === 'TEXT') {
    const t = node as TextNode;
    return t.characters.replace(/\s/g, '').length > 0;
  }
  if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE') return true;
  if (node.type === 'INSTANCE') return true;
  if (node.type === 'VECTOR' || node.type === 'STAR' || node.type === 'LINE' || node.type === 'POLYGON') return true;
  if ('children' in node) {
    const ch = (node as ChildrenMixin).children;
    for (let i = 0; i < ch.length; i++) {
      if (subtreeHasUserVisibleContent(ch[i])) return true;
    }
  }
  return false;
}

/**
 * Se il modello restituisce solo shell senza testo/rette/istanze, aggiunge contenuto minimo leggibile
 * (API Plugin: createFrame, createText dopo loadFontAsync, createRectangle — vedi developer docs Figma).
 */
async function injectFallbackScaffold(
  root: FrameNode,
  frameSpec: Record<string, unknown>,
  plan: Record<string, unknown>
): Promise<void> {
  const boldOk = await figma.loadFontAsync({ family: 'Inter', style: 'Bold' }).then(
    () => true,
    () => false
  );
  const regularOk = await figma.loadFontAsync({ family: 'Inter', style: 'Regular' }).then(
    () => true,
    () => false
  );

  if (root.layoutMode === 'NONE') {
    root.layoutMode = 'VERTICAL';
    root.primaryAxisSizingMode = 'FIXED';
    root.counterAxisSizingMode = 'FIXED';
    root.paddingTop = 24;
    root.paddingRight = 24;
    root.paddingBottom = 24;
    root.paddingLeft = 24;
    root.itemSpacing = 16;
  }

  const meta = isRecord(plan.metadata) ? plan.metadata : {};
  const promptHint = String(meta.prompt || '').trim().slice(0, 220);

  const title = figma.createText();
  try {
    if (boldOk) title.fontName = { family: 'Inter', style: 'Bold' };
    else if (regularOk) title.fontName = { family: 'Inter', style: 'Regular' };
  } catch {
    /* font di default */
  }
  title.characters = String(frameSpec.name || 'Screen').slice(0, 100);
  title.fontSize = 22;
  if (root.layoutMode !== 'NONE') title.layoutSizingHorizontal = 'FILL';
  root.appendChild(title);

  const body = figma.createText();
  try {
    if (regularOk) body.fontName = { family: 'Inter', style: 'Regular' };
  } catch {
    /* ignore */
  }
  body.characters =
    promptHint ||
    'Describe buttons, fields, and links in your prompt for a richer layout.';
  body.fontSize = 13;
  body.opacity = 0.85;
  if (root.layoutMode !== 'NONE') body.layoutSizingHorizontal = 'FILL';
  root.appendChild(body);

  const row = figma.createFrame();
  row.name = 'Placeholders';
  row.layoutMode = 'VERTICAL';
  row.itemSpacing = 10;
  row.primaryAxisSizingMode = 'AUTO';
  row.counterAxisSizingMode = 'AUTO';
  row.fills = [];
  if (root.layoutMode !== 'NONE') row.layoutSizingHorizontal = 'FILL';

  const btn1 = figma.createRectangle();
  btn1.resize(280, 44);
  btn1.name = 'Primary';
  btn1.fills = [{ type: 'SOLID', color: { r: 0.12, g: 0.35, b: 0.85 } }];
  const btn2 = figma.createRectangle();
  btn2.resize(280, 36);
  btn2.name = 'Secondary / link row';
  btn2.strokes = [{ type: 'SOLID', color: { r: 0.4, g: 0.4, b: 0.45 } }];
  btn2.strokeWeight = 1;
  btn2.fills = [{ type: 'SOLID', color: { r: 0.96, g: 0.96, b: 0.97 } }];
  row.appendChild(btn1);
  row.appendChild(btn2);
  root.appendChild(row);
}

const FIGMA_NODE_ID_RE = /^\d+:\d+$/;

function collectAllLocalComponents(): (ComponentNode | ComponentSetNode)[] {
  const out: (ComponentNode | ComponentSetNode)[] = [];
  for (const page of figma.root.children) {
    if (page.type !== 'PAGE') continue;
    const found = page.findAll(
      (n): n is ComponentNode | ComponentSetNode => n.type === 'COMPONENT' || n.type === 'COMPONENT_SET'
    );
    out.push(...found);
  }
  return out;
}

function pickFromSet(n: ComponentNode | ComponentSetNode): ComponentNode | null {
  if (n.type === 'COMPONENT') return n;
  const set = n as ComponentSetNode;
  return set.defaultVariant ?? (set.children[0] as ComponentNode | undefined) ?? null;
}

/**
 * Risolve `COMPONENT` / `COMPONENT_SET` per id nodo (Problem 1 — indice plugin).
 * Con `documentAccess: "dynamic-page"` carica le pagine prima di `getNodeByIdAsync`.
 */
async function getComponentNodeByFigmaId(nodeId: string): Promise<ComponentNode | null> {
  const id = String(nodeId || '').trim();
  if (!FIGMA_NODE_ID_RE.test(id)) return null;

  async function resolveOnce(): Promise<BaseNode | null> {
    try {
      const n = await figma.getNodeByIdAsync(id);
      return n && 'id' in n ? n : null;
    } catch {
      return null;
    }
  }

  let node = await resolveOnce();
  if (!node) {
    try {
      await figma.loadAllPagesAsync();
    } catch {
      /* best-effort */
    }
    node = await resolveOnce();
  }
  if (!node) return null;

  if (node.type === 'COMPONENT') return node;
  if (node.type === 'COMPONENT_SET') return pickFromSet(node);

  if (node.type === 'INSTANCE') {
    try {
      const main = await (node as InstanceNode).getMainComponentAsync();
      return main;
    } catch {
      return null;
    }
  }
  return null;
}

async function resolveComponentForInstance(hints: {
  nodeId?: string;
  componentKey?: string;
  componentName?: string;
}): Promise<ComponentNode | null> {
  const rawNodeId = String(hints.nodeId || '').trim();
  const rawComponentKey = String(hints.componentKey || '').trim();
  const rawComponentName = String(hints.componentName || '').trim().toLowerCase();

  if (rawComponentKey) {
    try {
      return await figma.importComponentByKeyAsync(rawComponentKey);
    } catch {
      /* key non importabile nel file corrente */
    }
  }
  if (rawNodeId) {
    const byId = await getComponentNodeByFigmaId(rawNodeId);
    if (byId) return byId;
  }
  if (rawComponentName) {
    const nodes = collectAllLocalComponents();
    for (const n of nodes) {
      if (String(n.name || '').trim().toLowerCase() === rawComponentName) {
        return pickFromSet(n);
      }
    }
  }
  return null;
}

type PreflightIssue = {
  index: number;
  type: 'INSTANCE_COMPONENT' | 'VARIABLE';
  code: string;
  reason: string;
};

type PreflightResult = {
  issues: PreflightIssue[];
  skippedInstanceIndexes: Set<number>;
  resolvedComponentsByIndex: Map<number, ComponentNode>;
  instanceRequested: number;
  instanceResolved: number;
  variableRequested: number;
  variableResolved: number;
};

function collectVariableRefsFromPlan(plan: Record<string, unknown>): string[] {
  const out = new Set<string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const x of v) walk(x);
      return;
    }
    if (!isRecord(v)) return;
    for (const [k, val] of Object.entries(v)) {
      if (k.toLowerCase() === 'variable' && typeof val === 'string' && val.trim()) out.add(val.trim());
      walk(val);
    }
  };
  walk(plan);
  return [...out];
}

async function preflightActionPlanExecution(
  actionPlan: Record<string, unknown>,
  actions: unknown[],
  varMap: VarMap,
): Promise<PreflightResult> {
  const issues: PreflightIssue[] = [];
  const skippedInstanceIndexes = new Set<number>();
  const resolvedComponentsByIndex = new Map<number, ComponentNode>();
  let instanceRequested = 0;
  let instanceResolved = 0;

  for (let i = 0; i < actions.length; i++) {
    const raw = actions[i];
    if (!isRecord(raw)) continue;
    if (String(raw.type || '').trim() !== 'INSTANCE_COMPONENT') continue;
    instanceRequested += 1;
    const componentNodeId = String(raw.component_node_id || raw.componentNodeId || '').trim();
    const componentKey = String(raw.component_key || raw.componentKey || raw.component_id || '').trim();
    const componentName = String(raw.name || '').trim();
    const comp = await resolveComponentForInstance({
      nodeId: componentNodeId,
      componentKey,
      componentName,
    });
    if (!comp) {
      skippedInstanceIndexes.add(i);
      issues.push({
        index: i,
        type: 'INSTANCE_COMPONENT',
        code: 'INSTANCE_UNRESOLVED',
        reason: `INSTANCE_COMPONENT non risolvibile (key="${componentKey || 'n/a'}", nodeId="${componentNodeId || 'n/a'}", name="${componentName || 'n/a'}").`,
      });
      continue;
    }
    resolvedComponentsByIndex.set(i, comp);
    instanceResolved += 1;
  }

  const variableRefs = collectVariableRefsFromPlan(actionPlan);
  let variableResolved = 0;
  for (let i = 0; i < variableRefs.length; i++) {
    const ref = variableRefs[i];
    const v = await resolveVariableForExecution(varMap, ref);
    if (v) {
      variableResolved += 1;
    } else {
      issues.push({
        index: -1,
        type: 'VARIABLE',
        code: 'VARIABLE_UNRESOLVED',
        reason: `Variabile non risolvibile/importabile: "${ref}".`,
      });
    }
  }

  return {
    issues,
    skippedInstanceIndexes,
    resolvedComponentsByIndex,
    instanceRequested,
    instanceResolved,
    variableRequested: variableRefs.length,
    variableResolved,
  };
}

/** Applica `variantProperties` / `properties` / `componentProperties` (valori stringa o boolean) come da API `instance.setProperties`. */
function applyInstanceComponentProperties(inst: InstanceNode, raw: Record<string, unknown>): void {
  const vp = raw.variantProperties ?? raw.properties ?? raw.componentProperties;
  if (!vp || typeof vp !== 'object' || Array.isArray(vp)) return;
  const out: { [prop: string]: string | boolean } = {};
  for (const [k, v] of Object.entries(vp as Record<string, unknown>)) {
    if (typeof v === 'string' && v.length > 0) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
  }
  if (Object.keys(out).length === 0) return;
  try {
    inst.setProperties(out);
  } catch {
    /* combinazione non valida per questo componente */
  }
}

/** Lega nome variabile locale o id variabile Figma (`123:456`) a un campo layout su frame (Problem 1 / dynamic-page-safe). */
async function applyBoundVariableToFrameField(
  f: FrameNode,
  field: VariableBindableNodeField,
  variableIdOrName: string,
  varMap: VarMap,
): Promise<void> {
  const raw = String(variableIdOrName || '').trim();
  if (!raw) return;
  let v: Variable | null = lookupVariable(varMap, raw);
  if (!v && FIGMA_NODE_ID_RE.test(raw)) {
    try {
      v = await figma.variables.getVariableByIdAsync(raw);
    } catch {
      v = null;
    }
  }
  if (!v) return;
  try {
    f.setBoundVariable(field, v);
  } catch {
    /* tipo o field incompatibile */
  }
}

/**
 * Opzionale: `boundLayout` / `layoutBindings` con id o nomi variabile per padding/spacing (oltre ai token già in applyFrameGeometry).
 */
async function applyOptionalLayoutBindingsFromRaw(
  raw: Record<string, unknown>,
  node: FrameNode,
  varMap: VarMap,
): Promise<void> {
  if (node.layoutMode === 'NONE') return;
  const b = raw.boundLayout ?? raw.layoutBindings;
  if (!b || typeof b !== 'object' || Array.isArray(b)) return;
  const rec = b as Record<string, unknown>;
  const pairs: [string, VariableBindableNodeField][] = [
    ['paddingTop', 'paddingTop'],
    ['paddingRight', 'paddingRight'],
    ['paddingBottom', 'paddingBottom'],
    ['paddingLeft', 'paddingLeft'],
    ['itemSpacing', 'itemSpacing'],
  ];
  for (const [key, field] of pairs) {
    const vid = rec[key];
    if (typeof vid === 'string' && vid.trim())
      await applyBoundVariableToFrameField(node, field, vid.trim(), varMap);
  }
}

function humanizeComponentKey(key: string): string {
  return key
    .replace(/[/._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 56);
}

/** Sostituisce “Component not found” con un blocco leggibile (stile wireframe), non solo testo tagliato. */
async function appendMissingComponentWireframe(
  parent: ChildrenMixin,
  key: string,
  varMap: VarMap,
): Promise<void> {
  const label = humanizeComponentKey(key) || 'Control';
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' }).catch(() => undefined);

  const ph = figma.createFrame();
  ph.name = `Placeholder · ${label}`;
  ph.layoutMode = 'VERTICAL';
  ph.itemSpacing = 6;
  ph.paddingTop = 8;
  ph.paddingBottom = 8;
  ph.paddingLeft = 10;
  ph.paddingRight = 10;
  ph.primaryAxisSizingMode = 'AUTO';
  ph.counterAxisSizingMode = 'FIXED';
  ph.layoutSizingHorizontal = 'FILL';
  ph.fills = [{ type: 'SOLID', color: { r: 0.96, g: 0.96, b: 0.98 } }];
  ph.strokes = [{ type: 'SOLID', color: { r: 0.65, g: 0.68, b: 0.75 } }];
  ph.strokeWeight = 1;
  ph.cornerRadius = 6;
  parent.appendChild(ph);

  const bar = figma.createRectangle();
  bar.resize(280, 40);
  bar.name = label;
  bar.cornerRadius = 4;
  bar.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.45, b: 0.95 } }];
  ph.appendChild(bar);

  const cap = figma.createText();
  try {
    cap.fontName = { family: 'Inter', style: 'Regular' };
  } catch {
    /* default */
  }
  cap.characters =
    `Nessun componente nel file per “${label}”. Collega la libreria del DS o usa rettangoli/testo nel prompt.`;
  cap.fontSize = 10;
  cap.opacity = 0.75;
  cap.layoutSizingHorizontal = 'FILL';
  ph.appendChild(cap);
  applyFillsToNode(cap, [], varMap, 'text');
}

export type ExecuteActionPlanOptions = {
  /** Fase 6: duplica la selezione e costruisce il nuovo layout nella copia (frame/gruppo/sezione) o sotto di essa. */
  modifyMode?: boolean;
};

function prepareModifyModeCloneHost(page: PageNode): {
  appendParent: ChildrenMixin;
  rootPos: { x: number; y: number };
  clonedFromId: string | null;
} {
  const rawSel = page.selection[0];
  if (!rawSel || !('clone' in rawSel)) {
    figma.notify('Nessuna selezione adatta: layout creato come nuovo blocco sulla pagina.');
    return { appendParent: page, rootPos: nextPlacementOnPage(page), clonedFromId: null };
  }
  if (rawSel.type === 'COMPONENT' || rawSel.type === 'COMPONENT_SET') {
    figma.notify('Per “modifica” seleziona un frame, gruppo o istanza — non un componente master.');
    return { appendParent: page, rootPos: nextPlacementOnPage(page), clonedFromId: null };
  }

  const sel = rawSel as SceneNode;
  const dup = sel.clone();
  const par = sel.parent;
  if (par && 'insertChild' in par) {
    const idx = par.children.indexOf(sel);
    if (idx >= 0) par.insertChild(idx + 1, dup);
    else page.appendChild(dup);
  } else {
    page.appendChild(dup);
  }

  if ('x' in dup && 'x' in sel && 'width' in sel) {
    const w = (sel as LayoutMixin).width;
    dup.x = sel.x + (typeof w === 'number' && Number.isFinite(w) ? w : 0) + 48;
    dup.y = sel.y;
  }

  if (dup.type === 'FRAME' || dup.type === 'GROUP' || dup.type === 'SECTION') {
    const host = dup as ChildrenMixin;
    while (host.children.length > 0) {
      host.children[0].remove();
    }
    return { appendParent: host, rootPos: { x: 0, y: 0 }, clonedFromId: sel.id };
  }

  figma.notify('Copia creata; il nuovo layout è sotto la copia (selezione non contenitrice).');
  if ('x' in dup && 'y' in dup && 'height' in dup) {
    const h = (dup as LayoutMixin).height;
    const yOff = typeof h === 'number' && Number.isFinite(h) ? h : 0;
    return {
      appendParent: page,
      rootPos: { x: dup.x, y: dup.y + yOff + 32 },
      clonedFromId: sel.id,
    };
  }
  return { appendParent: page, rootPos: nextPlacementOnPage(page), clonedFromId: sel.id };
}

/**
 * Crea frame + figli sulla pagina corrente. Supporta: CREATE_FRAME, CREATE_TEXT, CREATE_RECT, INSTANCE_COMPONENT (best-effort).
 * Con `modifyMode`, duplica la selezione e inserisce il wireframe nella copia (o sotto di essa) lasciando l’originale intatto.
 */
export async function executeActionPlanOnCanvas(
  actionPlan: unknown,
  options?: ExecuteActionPlanOptions,
): Promise<{ rootId: string; clonedFromId?: string | null }> {
  if (!isRecord(actionPlan)) throw new Error('Action plan non valido');
  const frameSpec = actionPlan.frame;
  const actions = actionPlan.actions;
  if (!isRecord(frameSpec)) throw new Error('Action plan: manca frame');
  if (!Array.isArray(actions)) throw new Error('Action plan: manca actions');

  const varMap = await buildLocalVariableMap();
  try {
    await figma.loadAllPagesAsync();
  } catch {
    /* best-effort: ricerca componenti su pagine non caricate */
  }
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' }).catch(() => undefined);

  const preflight = await preflightActionPlanExecution(actionPlan, actions, varMap);
  const meta = isRecord(actionPlan.metadata) ? actionPlan.metadata : {};
  const mode = String(meta.mode || '').trim().toLowerCase();
  const dsSource = String(meta.ds_source || meta.dsSource || '').trim().toLowerCase();
  const isCreateLike = mode === 'create' || mode === 'screenshot';
  const isCustomDs = dsSource === '' || dsSource === 'custom' || dsSource === 'file' || dsSource === 'current';
  if (isCreateLike && isCustomDs && preflight.instanceRequested > 0 && preflight.instanceResolved === 0) {
    const reasons = preflight.issues
      .filter((x) => x.type === 'INSTANCE_COMPONENT')
      .map((x) => `#${x.index}: ${x.reason}`)
      .slice(0, 8)
      .join(' | ');
    throw new Error(`CUSTOM_DS_INSTANCE_PREFLIGHT_FAILED: nessuna istanza DS risolvibile. ${reasons}`);
  }

  const page = figma.currentPage;
  let appendParent: ChildrenMixin = page;
  let rootPos = nextPlacementOnPage(page);
  let clonedFromId: string | null = null;

  if (options?.modifyMode) {
    const prep = prepareModifyModeCloneHost(page);
    appendParent = prep.appendParent;
    rootPos = prep.rootPos;
    clonedFromId = prep.clonedFromId;
  }

  const root = figma.createFrame();
  root.x = rootPos.x;
  root.y = rootPos.y;
  applyFrameGeometry(root, frameSpec, varMap);
  await applyOptionalLayoutBindingsFromRaw(frameSpec, root, varMap);
  appendParent.appendChild(root);

  const idMap = new Map<string, SceneNode>();
  idMap.set('root', root);

  for (let i = 0; i < actions.length; i++) {
    if (i > 0 && i % 15 === 0) await yieldToMain();
    const raw = actions[i];
    if (!isRecord(raw)) continue;
    const type = String(raw.type || '').trim();

    if (type === 'CREATE_FRAME') {
      const parent = resolveParent(raw, idMap, root);
      const f = figma.createFrame();
      parent.appendChild(f);
      applyFrameGeometry(f, raw, varMap);
      await applyOptionalLayoutBindingsFromRaw(raw, f, varMap);
      if (parent !== root && 'layoutMode' in parent && (parent as FrameNode).layoutMode !== 'NONE') {
        f.layoutSizingHorizontal = 'FILL';
      }
      const ref = typeof raw.ref === 'string' && raw.ref.trim() ? raw.ref.trim() : `auto_${i}`;
      idMap.set(ref, f);
      continue;
    }

    if (type === 'CREATE_TEXT') {
      try {
        const parent = resolveParent(raw, idMap, root);
        const t = figma.createText();
        try {
          t.fontName = { family: 'Inter', style: 'Regular' };
        } catch {
          /* font default */
        }
        parent.appendChild(t);
        t.characters = String(raw.characters || raw.text || 'Text');
        const fs = Number(raw.fontSize);
        if (Number.isFinite(fs) && fs > 0) t.fontSize = fs;
        applyFillsToNode(t, raw.fills, varMap, 'text');
        if (typeof raw.name === 'string' && raw.name.trim()) t.name = raw.name.trim();
        if ('layoutMode' in parent && (parent as FrameNode).layoutMode !== 'NONE') {
          t.layoutSizingHorizontal = 'FILL';
        }
        if (typeof raw.ref === 'string' && raw.ref.trim()) idMap.set(raw.ref.trim(), t);
      } catch {
        /* testo saltato se font / API non disponibili */
      }
      continue;
    }

    if (type === 'CREATE_RECT') {
      const parent = resolveParent(raw, idMap, root);
      const r = figma.createRectangle();
      parent.appendChild(r);
      const rw = Number(raw.width) || 120;
      const rh = Number(raw.height) || 40;
      r.resize(rw, rh);
      applyFillsToNode(r, raw.fills, varMap, 'surface');
      if (typeof raw.name === 'string' && raw.name.trim()) r.name = raw.name.trim();
      if (typeof raw.ref === 'string' && raw.ref.trim()) idMap.set(raw.ref.trim(), r);
      continue;
    }

    if (type === 'INSTANCE_COMPONENT') {
      if (preflight.skippedInstanceIndexes.has(i)) {
        continue;
      }
      const parent = resolveParent(raw, idMap, root);
      const componentNodeId = String(raw.component_node_id || raw.componentNodeId || '').trim();
      const componentKey = String(raw.component_key || raw.componentKey || raw.component_id || '').trim();
      const componentName = String(raw.name || '').trim();
      const comp =
        preflight.resolvedComponentsByIndex.get(i) ||
        (await resolveComponentForInstance({
          nodeId: componentNodeId,
          componentKey,
          componentName,
        }));
      if (comp) {
        const inst = comp.createInstance();
        parent.appendChild(inst);
        if ('layoutMode' in parent && (parent as FrameNode).layoutMode !== 'NONE') {
          inst.layoutSizingHorizontal = 'FILL';
        }
        const iw = Number(raw.width);
        const ih = Number(raw.height);
        if (Number.isFinite(iw) && iw > 0 && Number.isFinite(ih) && ih > 0) {
          try {
            inst.resize(iw, ih);
          } catch {
            /* ignore */
          }
        }
        applyInstanceComponentProperties(inst, raw);
        if (raw.fills !== undefined) applyFillsToNode(inst, raw.fills, varMap, 'surface');
        if (typeof raw.name === 'string' && raw.name.trim()) inst.name = raw.name.trim();
        if (typeof raw.ref === 'string' && raw.ref.trim()) idMap.set(raw.ref.trim(), inst);
      }
      continue;
    }

    /* SET_LAYOUT, SET_STYLE, ADD_CHILD, … — v1 ignora */
  }

  if (!subtreeHasUserVisibleContent(root)) {
    await injectFallbackScaffold(root, frameSpec, actionPlan as Record<string, unknown>);
  }

  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);

  const skippedInstances = preflight.instanceRequested - preflight.instanceResolved;
  if (skippedInstances > 0) {
    figma.notify(
      `Generate: ${skippedInstances}/${preflight.instanceRequested} istanze DS saltate (key/id non risolvibili).`,
    );
  }
  if (preflight.variableRequested > preflight.variableResolved) {
    figma.notify(
      `Generate: ${preflight.variableRequested - preflight.variableResolved}/${preflight.variableRequested} variabili non risolte.`,
    );
  }

  return { rootId: root.id, clonedFromId: clonedFromId ?? undefined };
}
