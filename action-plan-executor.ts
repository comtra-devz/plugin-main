/**
 * Esegue l'action plan (JSON da /api/agents/generate) sulla pagina Figma corrente.
 * v1: root da `frame`, poi `actions` in ordine — token DS legati se esistono variabili locali con lo stesso path/nome.
 */

type VarMap = Map<string, Variable>;

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

function applyFillsToNode(node: GeometryMixin, fills: unknown, varMap: VarMap): void {
  const list = Array.isArray(fills) ? fills : [];
  const defaultColor = { r: 0.97, g: 0.97, b: 0.97 };
  if (list.length === 0) {
    (node as GeometryMixin).fills = [{ type: 'SOLID', color: defaultColor }];
    return;
  }
  const out: SolidPaint[] = [];
  for (const entry of list) {
    if (!isRecord(entry) || entry.type !== 'SOLID') continue;
    const paint: SolidPaint = { type: 'SOLID', color: defaultColor, opacity: 1 };
    out.push(paint);
  }
  if (out.length === 0) out.push({ type: 'SOLID', color: defaultColor });
  (node as GeometryMixin).fills = out;
  const first = list[0];
  if (isRecord(first) && typeof first.variable === 'string' && first.variable.trim()) {
    const v = lookupVariable(varMap, first.variable);
    const fillsNow = node.fills;
    if (v && v.resolvedType === 'COLOR' && Array.isArray(fillsNow) && fillsNow[0]?.type === 'SOLID') {
      try {
        const bound = figma.variables.setBoundVariableForPaint(fillsNow[0] as SolidPaint, 'color', v);
        node.fills = [bound];
      } catch {
        /* lascia colore fallback */
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
  applyFillsToNode(f, spec.fills, varMap);
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

function findComponentByHint(hint: string): ComponentNode | null {
  const h = hint.toLowerCase().trim();
  if (!h) return null;
  const nodes = figma.currentPage.findAll(
    (n): n is ComponentNode | ComponentSetNode => n.type === 'COMPONENT' || n.type === 'COMPONENT_SET'
  );
  for (const n of nodes) {
    const nm = n.name.toLowerCase();
    if (nm.includes(h) || n.id.toLowerCase() === h) {
      if (n.type === 'COMPONENT') return n;
      const set = n as ComponentSetNode;
      return set.defaultVariant ?? set.children?.[0] ?? null;
    }
  }
  return null;
}

/**
 * Crea frame + figli sulla pagina corrente. Supporta: CREATE_FRAME, CREATE_TEXT, CREATE_RECT, INSTANCE_COMPONENT (best-effort).
 */
export async function executeActionPlanOnCanvas(actionPlan: unknown): Promise<{ rootId: string }> {
  if (!isRecord(actionPlan)) throw new Error('Action plan non valido');
  const frameSpec = actionPlan.frame;
  const actions = actionPlan.actions;
  if (!isRecord(frameSpec)) throw new Error('Action plan: manca frame');
  if (!Array.isArray(actions)) throw new Error('Action plan: manca actions');

  const varMap = await buildLocalVariableMap();
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' }).catch(() => undefined);

  const page = figma.currentPage;
  const pos = nextPlacementOnPage(page);

  const root = figma.createFrame();
  root.x = pos.x;
  root.y = pos.y;
  applyFrameGeometry(root, frameSpec, varMap);
  page.appendChild(root);

  const idMap = new Map<string, SceneNode>();
  idMap.set('root', root);

  for (let i = 0; i < actions.length; i++) {
    const raw = actions[i];
    if (!isRecord(raw)) continue;
    const type = String(raw.type || '').trim();

    if (type === 'CREATE_FRAME') {
      const parent = resolveParent(raw, idMap, root);
      const f = figma.createFrame();
      parent.appendChild(f);
      applyFrameGeometry(f, raw, varMap);
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
        applyFillsToNode(t, raw.fills, varMap);
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
      applyFillsToNode(r, raw.fills, varMap);
      if (typeof raw.name === 'string' && raw.name.trim()) r.name = raw.name.trim();
      if (typeof raw.ref === 'string' && raw.ref.trim()) idMap.set(raw.ref.trim(), r);
      continue;
    }

    if (type === 'INSTANCE_COMPONENT') {
      const parent = resolveParent(raw, idMap, root);
      const key = String(raw.component_key || raw.componentKey || raw.component_id || '').trim();
      const comp = findComponentByHint(key);
      if (comp) {
        const inst = comp.createInstance();
        parent.appendChild(inst);
        if (typeof raw.ref === 'string' && raw.ref.trim()) idMap.set(raw.ref.trim(), inst);
      } else {
        const ph = figma.createFrame();
        ph.name = key ? `Component: ${key}` : 'Component (not found)';
        ph.resize(200, 48);
        ph.layoutMode = 'VERTICAL';
        parent.appendChild(ph);
        try {
          const hint = figma.createText();
          try {
            hint.fontName = { family: 'Inter', style: 'Regular' };
          } catch {
            /* default font */
          }
          hint.characters = key ? `Missing: ${key}` : 'Component not found in file';
          ph.appendChild(hint);
        } catch {
          /* frame vuoto se testo non creabile */
        }
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

  return { rootId: root.id };
}
