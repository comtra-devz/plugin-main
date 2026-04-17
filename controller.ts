// This file runs in the Figma main thread (sandbox)
// It handles API calls to the Figma document
/// <reference types="@figma/plugin-typings" />

import { executeActionPlanOnCanvas } from './action-plan-executor';
import {
  initDsContextIndexLifecycle,
  resolveDsContextIndexForRequest,
  setDsContextIndexRefreshSuspended,
  buildDsContextIndexRulesOnly,
  buildDsContextIndexTokensOnly,
  buildDsContextIndexComponentsMerge,
} from './ds-context-index';

declare const __html__: string;

figma.showUI(__html__, { width: 400, height: 700, themeColors: true });
/* Ritarda loadAllPagesAsync + registrazione handler: la finestra UI compare prima del lavoro pesante. */
setTimeout(() => {
  void initDsContextIndexLifecycle().catch((err) =>
    console.error('[ds-context-index] lifecycle init failed', err),
  );
}, 0);

const SESSION_DAYS = 30; // Durata sessione in giorni; 0 = nessuna scadenza (solo logout manuale)
const DS_IMPORT_META_STORAGE_KEY = 'comtra-ds-import-meta-v1';

type DsImportMetaRow = {
  fileKey: string;
  importedAt: string;
  dsCacheHash: string;
  componentCount: number;
  tokenCount: number;
  name: string;
};

async function readDsImportMetaMap(): Promise<Record<string, DsImportMetaRow>> {
  try {
    const raw = await figma.clientStorage.getAsync(DS_IMPORT_META_STORAGE_KEY);
    if (!raw || typeof raw !== 'object') return {};
    return raw as Record<string, DsImportMetaRow>;
  } catch {
    return {};
  }
}

async function writeDsImportMetaRow(row: DsImportMetaRow): Promise<void> {
  if (!row.fileKey) return;
  const map = await readDsImportMetaMap();
  map[row.fileKey] = row;
  await figma.clientStorage.setAsync(DS_IMPORT_META_STORAGE_KEY, map);
}

async function getStoredUser(): Promise<any> {
  try {
    const raw = await figma.clientStorage.getAsync('figmaOAuthUser');
    if (!raw) return null;
    const payload = raw as { user?: any; savedAt?: number };
    const user = payload?.user ?? (typeof raw === 'object' && (raw as any).authToken ? raw : null);
    if (!user) return null;
    if (SESSION_DAYS > 0 && typeof payload?.savedAt === 'number') {
      const maxAge = SESSION_DAYS * 24 * 60 * 60 * 1000;
      if (Date.now() - payload.savedAt > maxAge) {
        await figma.clientStorage.deleteAsync('figmaOAuthUser');
        return null;
      }
    }
    return user;
  } catch (_) {
    return null;
  }
}

// Invia sessione salvata quando l'UI è pronta (risposta a get-saved-user) e all'avvio (per compatibilità)
(async () => {
  const user = await getStoredUser();
  figma.ui.postMessage({ type: 'restore-user', user });
})();

// Cache for node count by scope+pageId so we don't re-scan when user runs another audit (DS, A11Y, etc.) on same scope.
// Invalidated when scope or pageId changes; not used for scope 'current' (selection-dependent).
let nodeCountCache: { scope: string; pageId: string | undefined; count: number; target: string } | null = null;

/**
 * Switch to the page containing the node, select it, and reveal it in the viewport.
 * Works whether the user is already on that page or on another tab (dynamic-page safe).
 *
 * With manifest `documentAccess: "dynamic-page"`: use `loadAllPagesAsync` / `page.loadAsync` so
 * `getNodeByIdAsync` resolves; use `setCurrentPageAsync` to change page (sync assignment forbidden).
 * Re-resolve the node by id after async work — handles can go stale after load/switch.
 */
async function selectLayerAndReveal(layerId: string): Promise<boolean> {
  const id = typeof layerId === 'string' ? layerId.trim() : '';
  if (!id) return false;

  async function resolveSceneAndPage(): Promise<{ sceneNode: SceneNode; pageNode: PageNode } | null> {
    const n = await figma.getNodeByIdAsync(id);
    if (!n || !('id' in n)) return null;
    const sceneNode = n as SceneNode;
    let pageNode: PageNode | null = null;
    for (let current: BaseNode | null = n; current; current = current.parent) {
      if (current.type === 'PAGE') {
        pageNode = current as PageNode;
        break;
      }
    }
    if (!pageNode) return null;
    return { sceneNode, pageNode };
  }

  let resolved = await resolveSceneAndPage();
  if (!resolved) {
    try {
      await figma.loadAllPagesAsync();
    } catch (_) {
      /* continue */
    }
    resolved = await resolveSceneAndPage();
  }
  if (!resolved) return false;

  const targetPageId = resolved.pageNode.id;
  const needPageSwitch = figma.currentPage.id !== targetPageId;

  if (needPageSwitch) {
    try {
      await figma.loadAllPagesAsync();
    } catch (_) {
      /* still try page.loadAsync */
    }
  }

  const pageNode = resolved.pageNode;
  try {
    await pageNode.loadAsync();
  } catch (_) {
    /* proceed */
  }

  if (needPageSwitch) {
    try {
      await figma.setCurrentPageAsync(pageNode);
    } catch (_) {
      return false;
    }
  }

  await new Promise<void>((r) => setTimeout(r, 0));

  try {
    await pageNode.loadAsync();
  } catch (_) {
    /* proceed */
  }

  if (figma.currentPage.id !== targetPageId) {
    try {
      await figma.setCurrentPageAsync(pageNode);
    } catch (_) {
      return false;
    }
    await new Promise<void>((r) => setTimeout(r, 0));
  }

  const fresh = await resolveSceneAndPage();
  if (!fresh || fresh.pageNode.id !== targetPageId) return false;
  const sceneNode = fresh.sceneNode;

  try {
    figma.currentPage.selection = [sceneNode];
  } catch (_) {
    return false;
  }

  await new Promise<void>((r) => setTimeout(r, 0));
  try {
    figma.viewport.scrollAndZoomIntoView([sceneNode]);
  } catch (_) {
    /* ignore */
  }
  return true;
}

// --- Contrast fix: same-hue, meet WCAG AA (4.5:1). Variables → styles → hardcoded.
const CONTRAST_AA_MIN = 4.5;

function rgbToLuminance(r: number, g: number, b: number): number {
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(L1: number, L2: number): number {
  if (L1 <= 0 && L2 <= 0) return 0;
  const l1 = Math.max(L1, L2);
  const l2 = Math.min(L1, L2);
  return (l1 + 0.05) / (l2 + 0.05);
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = h / 360;
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r, g, b };
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

/** Same hue, adjust L so contrast vs background meets minRatio. Assume we darken text on light bg or lighten on dark bg. */
function adjustForContrast(
  r: number, g: number, b: number,
  backgroundLuminance: number,
  minRatio: number
): { r: number; g: number; b: number } {
  const fgLum = rgbToLuminance(r, g, b);
  const cr = contrastRatio(fgLum, backgroundLuminance);
  if (cr >= minRatio) return { r, g, b };
  const { h, s, l } = rgbToHsl(r, g, b);
  const bgDark = backgroundLuminance < 0.5;
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const newRgb = hslToRgb(h, s, mid);
    const lum = rgbToLuminance(newRgb.r, newRgb.g, newRgb.b);
    const ratio = contrastRatio(lum, backgroundLuminance);
    if (ratio >= minRatio) {
      if (bgDark) lo = mid;
      else hi = mid;
    } else {
      if (bgDark) hi = mid;
      else lo = mid;
    }
  }
  const L = (lo + hi) / 2;
  return hslToRgb(h, s, L);
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (x: number) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

async function resolveVariableToRgb(variableId: string, modeId?: string): Promise<{ r: number; g: number; b: number } | null> {
  const variable = await figma.variables.getVariableByIdAsync(variableId);
  if (!variable || variable.resolvedType !== 'COLOR') return null;
  const mode = modeId || variable.variableCollectionId ? (await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId!))?.defaultModeId : undefined;
  const raw = mode ? (variable.valuesByMode as Record<string, unknown>)[mode] : Object.values(variable.valuesByMode)[0];
  if (!raw || typeof raw !== 'object') return null;
  const alias = raw as { type?: string; id?: string };
  if (alias.type === 'VARIABLE_ALIAS' && alias.id) return resolveVariableToRgb(alias.id, modeId);
  const c = raw as { r?: number; g?: number; b?: number };
  if (typeof c.r === 'number' && typeof c.g === 'number' && typeof c.b === 'number')
    return { r: c.r, g: c.g, b: c.b };
  return null;
}

function getFillFromNode(node: SceneNode): { r: number; g: number; b: number; variableId?: string; styleId?: string } | null {
  const fills = (node as any).fills;
  if (!Array.isArray(fills)) return null;
  const bound = (node as any).boundVariables?.fills;
  for (let i = 0; i < fills.length; i++) {
    const f = fills[i];
    if (f.type === 'SOLID' && f.visible !== false) {
      const color = (f as SolidPaint).color;
      const r = color.r, g = color.g, b = color.b;
      const alias = bound?.[i]?.color ?? (f as any).boundVariables?.color;
      const variableId = alias?.id ?? undefined;
      const styleId = (node as any).fillStyleId && typeof (node as any).fillStyleId === 'string' ? (node as any).fillStyleId : undefined;
      return { r, g, b, variableId, styleId };
    }
  }
  return null;
}

function getBackgroundLuminanceFromNode(node: SceneNode): number {
  let parent = node.parent;
  while (parent && parent.type !== 'PAGE') {
    const p = parent as SceneNode;
    const fill = getFillFromNode(p);
    if (fill && (fill.r !== undefined)) {
      return rgbToLuminance(fill.r, fill.g, fill.b);
    }
    parent = parent.parent;
  }
  return 1; // white
}

export type ContrastFixPreviewPayload =
  | { source: 'external_library'; message: string }
  | {
      source: 'variable' | 'style' | 'hardcoded';
      label: string;
      message: string;
      variableId?: string;
      styleId?: string;
      r?: number;
      g?: number;
      b?: number;
      /** Text sits inside a local component instance; fix applies to this instance on canvas only */
      instanceLocalMain?: boolean;
    };

async function getContrastInstanceContext(layerId: string): Promise<'none' | 'local_instance' | 'remote_instance'> {
  const node = (await figma.getNodeByIdAsync(layerId)) as SceneNode | null;
  if (!node) return 'none';
  let p: BaseNode | null = node.parent;
  while (p) {
    if (p.type === 'INSTANCE') {
      const main = await getMainComponentSafe(p as InstanceNode);
      if (main?.remote) return 'remote_instance';
      return 'local_instance';
    }
    p = p.parent;
  }
  return 'none';
}

async function getContrastFixPreview(layerId: string): Promise<ContrastFixPreviewPayload | null> {
  const node = await figma.getNodeByIdAsync(layerId) as SceneNode | null;
  if (!node || !('fills' in node)) return null;

  const instCtx = await getContrastInstanceContext(layerId);
  if (instCtx === 'remote_instance') {
    return {
      source: 'external_library',
      message:
        'This text lives inside a component from an external published library. Open that library file in Figma, run Comtra there, and fix contrast on the main component (or its text styles) — then publish so this file updates.',
    };
  }

  const fill = getFillFromNode(node);
  if (!fill) return null;
  const currentHex = rgbToHex(fill.r, fill.g, fill.b);
  const bgLum = getBackgroundLuminanceFromNode(node);
  const target = adjustForContrast(fill.r, fill.g, fill.b, bgLum, CONTRAST_AA_MIN);
  const targetHex = rgbToHex(target.r, target.g, target.b);
  const instanceNote =
    instCtx === 'local_instance'
      ? ' This text is inside a local component instance — the fix applies to this instance on the canvas; edit the main component for the same change everywhere.'
      : '';

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const defaultModeByColl: Record<string, string> = {};
  const primitives: { id: string; name: string; r: number; g: number; b: number }[] = [];
  for (const coll of collections) {
    defaultModeByColl[coll.id] = coll.defaultModeId;
    for (const variableId of coll.variableIds) {
      const variable = await figma.variables.getVariableByIdAsync(variableId);
      if (!variable || variable.resolvedType !== 'COLOR') continue;
      const rgb = await resolveVariableToRgb(variableId);
      if (rgb) primitives.push({ id: variableId, name: variable.name, ...rgb });
    }
  }

  const { h: targetH } = rgbToHsl(target.r, target.g, target.b);
  const hueDist = (r: number, g: number, b: number) => {
    const { h } = rgbToHsl(r, g, b);
    let d = Math.abs(h - targetH);
    if (d > 180) d = 360 - d;
    return d;
  };

  if (primitives.length > 0) {
    let best: { id: string; name: string; d: number } | null = null;
    for (const p of primitives) {
      const ratio = contrastRatio(rgbToLuminance(p.r, p.g, p.b), bgLum);
      if (ratio >= CONTRAST_AA_MIN && hueDist(p.r, p.g, p.b) < 30) {
        const d = hueDist(p.r, p.g, p.b);
        if (!best || d < best.d) best = { id: p.id, name: p.name, d };
      }
    }
    if (best) {
      const picked = primitives.find((p) => p.id === best.id);
      const pickedHex = picked ? rgbToHex(picked.r, picked.g, picked.b) : null;
      return {
        source: 'variable',
        label: best.name,
        message: `We'll bind text color to variable «${best.name}»${pickedHex ? ` (${pickedHex})` : ''} to meet WCAG AA contrast (same tone).${instanceNote}`,
        variableId: best.id,
        instanceLocalMain: instCtx === 'local_instance',
      };
    }
  }

  const paintStyles = await figma.getLocalPaintStylesAsync();
  if (fill.styleId || paintStyles.length > 0) {
    const withSameHue: { id: string; name: string; r: number; g: number; b: number }[] = [];
    for (const style of paintStyles) {
      const paints = style.paints;
      if (Array.isArray(paints) && paints[0]?.type === 'SOLID') {
        const c = (paints[0] as SolidPaint).color;
        if (contrastRatio(rgbToLuminance(c.r, c.g, c.b), bgLum) >= CONTRAST_AA_MIN && hueDist(c.r, c.g, c.b) < 30)
          withSameHue.push({ id: style.id, name: style.name, r: c.r, g: c.g, b: c.b });
      }
    }
    if (withSameHue.length > 0) {
      const chosen = withSameHue[0];
      const styleHex = rgbToHex(chosen.r, chosen.g, chosen.b);
      return {
        source: 'style',
        label: chosen.name,
        message: `We'll apply paint style «${chosen.name}» (${styleHex}) to the text fill to meet WCAG AA (same tone).${instanceNote}`,
        styleId: chosen.id,
        instanceLocalMain: instCtx === 'local_instance',
      };
    }
  }

  return {
    source: 'hardcoded',
    label: targetHex,
    message: `No variables or styles found. We'll apply a direct text fill update: ${currentHex} -> ${targetHex} (same tone) to meet WCAG AA.${instanceNote}`,
    r: target.r,
    g: target.g,
    b: target.b,
    instanceLocalMain: instCtx === 'local_instance',
  };
}

async function applyContrastFix(
  layerId: string,
  strategy: { source: 'variable' | 'style' | 'hardcoded'; variableId?: string; styleId?: string; r?: number; g?: number; b?: number }
): Promise<boolean> {
  const node = await figma.getNodeByIdAsync(layerId) as SceneNode | null;
  if (!node || !('fills' in node)) return false;
  const fills = (node as any).fills as Paint[];
  if (!Array.isArray(fills) || fills.length === 0) return false;

  if (strategy.source === 'variable' && strategy.variableId) {
    const variable = await figma.variables.getVariableByIdAsync(strategy.variableId);
    if (variable) {
      const newFills = fills.map((f, i) => {
        if (f.type !== 'SOLID') return f;
        const alias = figma.variables.createVariableAlias(variable);
        return { ...f, boundVariables: { color: alias } } as SolidPaint;
      });
      (node as any).fills = newFills;
      return true;
    }
  }

  if (strategy.source === 'style' && strategy.styleId) {
    (node as any).fillStyleId = strategy.styleId;
    return true;
  }

  if (strategy.source === 'hardcoded' && typeof strategy.r === 'number' && typeof strategy.g === 'number' && typeof strategy.b === 'number') {
    const newFills = fills.map(f => {
      if (f.type !== 'SOLID') return f;
      return { ...f, color: { r: strategy.r!, g: strategy.g!, b: strategy.b! }, opacity: (f as SolidPaint).opacity ?? 1 } as SolidPaint;
    });
    (node as any).fills = newFills;
    return true;
  }

  return false;
}

// --- Touch target fix: variables (FLOAT spacing) → additive padding → resize. Prefer main component for INSTANCE (local library only).
const SPACING_FLOAT_NAME_HINT = /space|spacing|padding|pad|gap|inset|margin|sizing|dimension|scale|stack|xs|sm|md|lg|xl|2xs|3xs|4xl|5xl/i;
/** Prefer variables from collections that look like spacing/layout (not opacity, effects, etc.) */
const SPACING_COLLECTION_HINT = /spacing|space|layout|grid|sizing|dimension|scale|stack|token|primitives/i;
/** FLOAT names that are almost never spacing tokens (avoid radius/opacity/etc. false positives) */
const FLOAT_SPACING_EXCLUDE = /radius|radii|corner|opacity|alpha|blur|spread|shadow|elevation|font|leading|line-?height|letter|tracking|stroke|border-?width|icon|avatar|breakpoint|z-?index|duration|delay|easing|rotation|angle|perspective/i;

async function getMainComponentSafe(inst: InstanceNode): Promise<ComponentNode | null> {
  const anyInst = inst as any;
  if (typeof anyInst.getMainComponentAsync === 'function') {
    try {
      const c = await anyInst.getMainComponentAsync();
      if (c) return c;
    } catch (_) { /* fall through */ }
  }
  return inst.mainComponent ?? null;
}

async function resolveFloatVariableValue(variableId: string, depth = 0): Promise<number | null> {
  if (depth > 8) return null;
  const variable = await figma.variables.getVariableByIdAsync(variableId);
  if (!variable || variable.resolvedType !== 'FLOAT') return null;
  const coll = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
  const modeId = coll?.defaultModeId;
  const raw =
    modeId && variable.valuesByMode[modeId] !== undefined
      ? variable.valuesByMode[modeId]
      : Object.values(variable.valuesByMode)[0];
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
  if (raw && typeof raw === 'object' && (raw as { type?: string; id?: string }).type === 'VARIABLE_ALIAS') {
    const id = (raw as { id?: string }).id;
    if (id) return resolveFloatVariableValue(id, depth + 1);
  }
  return null;
}

type TouchEditResolution =
  | { ok: true; measure: SceneNode; apply: SceneNode; appliesToMain: boolean }
  | { ok: false; reason: 'external_library' | 'unsupported'; message: string };

async function resolveTouchEditTargets(layerId: string): Promise<TouchEditResolution> {
  const node = (await figma.getNodeByIdAsync(layerId)) as SceneNode | null;
  if (!node) return { ok: false, reason: 'unsupported', message: 'Layer not found.' };

  let measure: SceneNode = node;
  let apply: SceneNode = node;
  let appliesToMain = false;

  if (node.type === 'INSTANCE') {
    const main = await getMainComponentSafe(node);
    if (!main) return { ok: false, reason: 'unsupported', message: 'Could not resolve component for this instance.' };
    if (main.remote) {
      return {
        ok: false,
        reason: 'external_library',
        message:
          'This component lives in an external published library. Open that library file in Figma, run Comtra there, and apply the touch-area fix on the main component — then publish so this file updates.',
      };
    }
    apply = main;
    appliesToMain = true;
  }

  return { ok: true, measure, apply, appliesToMain };
}

function isFrameLike(n: BaseNode): n is FrameNode | ComponentNode | InstanceNode {
  return n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE';
}

function getAutoLayoutHost(n: SceneNode): (FrameNode | ComponentNode | InstanceNode) | null {
  if (!isFrameLike(n)) return null;
  const f = n as FrameNode;
  if (f.layoutMode && f.layoutMode !== 'NONE') return f;
  return null;
}

export type TouchFixPreviewPayload = {
  source: 'variable' | 'hardcoded' | 'resize' | 'external_library' | 'unsupported';
  message: string;
  label?: string;
  applyLayerId: string;
  /** Original issue layer (instance on canvas) */
  sourceLayerId: string;
  variableId?: string;
  paddingDelta?: number;
  newWidth?: number;
  newHeight?: number;
  appliesToMainComponent?: boolean;
  targetMin: number;
};

async function getTouchFixPreview(layerId: string, targetMin: number): Promise<TouchFixPreviewPayload | null> {
  const resolved = await resolveTouchEditTargets(layerId);
  if (!resolved.ok) {
    return {
      source: resolved.reason,
      message: resolved.message,
      applyLayerId: layerId,
      sourceLayerId: layerId,
      targetMin,
    };
  }

  const { measure, apply, appliesToMain } = resolved;
  const mw = 'width' in measure && typeof (measure as LayoutMixin).width === 'number' ? (measure as LayoutMixin).width : 0;
  const mh = 'height' in measure && typeof (measure as LayoutMixin).height === 'number' ? (measure as LayoutMixin).height : 0;
  if (mw <= 0 || mh <= 0) {
    return {
      source: 'unsupported',
      message: 'Could not read layer dimensions. Try selecting a frame or component with explicit size.',
      applyLayerId: apply.id,
      sourceLayerId: layerId,
      targetMin,
    };
  }

  const minSide = Math.min(mw, mh);
  if (minSide >= targetMin) {
    return {
      source: 'unsupported',
      message: 'This layer already meets the minimum touch target for this rule.',
      applyLayerId: apply.id,
      sourceLayerId: layerId,
      targetMin,
    };
  }

  const paddingDelta = Math.max(1, Math.ceil((targetMin - minSide) / 2));
  const layoutHost = getAutoLayoutHost(apply);

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const floatCandidates: { id: string; name: string; value: number; preferred: boolean }[] = [];
  for (const coll of collections) {
    const collPreferred = SPACING_COLLECTION_HINT.test(coll.name);
    for (const vid of coll.variableIds) {
      const variable = await figma.variables.getVariableByIdAsync(vid);
      if (!variable || variable.resolvedType !== 'FLOAT') continue;
      if (FLOAT_SPACING_EXCLUDE.test(variable.name)) continue;
      const nameHint = SPACING_FLOAT_NAME_HINT.test(variable.name);
      if (!collPreferred && !nameHint) continue;
      const val = await resolveFloatVariableValue(variable.id);
      if (val == null || val <= 0) continue;
      floatCandidates.push({
        id: variable.id,
        name: variable.name,
        value: val,
        preferred: collPreferred,
      });
    }
  }
  floatCandidates.sort((a, b) => {
    if (a.preferred !== b.preferred) return a.preferred ? -1 : 1;
    return a.value - b.value;
  });
  const spacingVar = floatCandidates.find((c) => c.value >= paddingDelta);

  const dsNote = appliesToMain
    ? ' We will update the main component in this file so instances stay in sync.'
    : '';

  if (layoutHost) {
    if (spacingVar) {
      return {
        source: 'variable',
        message: `We'll expand the hit area using your spacing token «${spacingVar.name}» (${spacingVar.value}px) on all sides of the auto-layout frame.${dsNote}`,
        label: spacingVar.name,
        applyLayerId: layoutHost.id,
        sourceLayerId: layerId,
        variableId: spacingVar.id,
        paddingDelta,
        appliesToMainComponent: appliesToMain,
        targetMin,
      };
    }
    return {
      source: 'hardcoded',
      message: `We'll add ${paddingDelta}px padding on each side of the auto-layout frame to reach at least ${targetMin}px on the shorter edge.${dsNote}`,
      label: `${paddingDelta}px`,
      applyLayerId: layoutHost.id,
      sourceLayerId: layerId,
      paddingDelta,
      appliesToMainComponent: appliesToMain,
      targetMin,
    };
  }

  if ('resize' in apply && typeof (apply as LayoutMixin).width === 'number' && typeof (apply as LayoutMixin).height === 'number') {
    const nw = Math.max(mw, targetMin);
    const nh = Math.max(mh, targetMin);
    return {
      source: 'resize',
      message: `No auto-layout on this layer. We'll resize it from ${Math.round(mw)}×${Math.round(mh)} to ${Math.round(nw)}×${Math.round(nh)} px to meet the minimum touch target.${dsNote}`,
      applyLayerId: apply.id,
      sourceLayerId: layerId,
      newWidth: nw,
      newHeight: nh,
      appliesToMainComponent: appliesToMain,
      targetMin,
    };
  }

  return {
    source: 'unsupported',
    message: 'Enable auto layout on this component or use a frame we can resize; we could not apply a safe automatic touch fix.',
    applyLayerId: apply.id,
    sourceLayerId: layerId,
    targetMin,
  };
}

async function applyTouchFix(
  preview: {
    source: 'variable' | 'hardcoded' | 'resize';
    applyLayerId: string;
    variableId?: string;
    paddingDelta?: number;
    newWidth?: number;
    newHeight?: number;
  }
): Promise<boolean> {
  const node = (await figma.getNodeByIdAsync(preview.applyLayerId)) as SceneNode | null;
  if (!node) return false;

  if (preview.source === 'resize' && preview.newWidth != null && preview.newHeight != null && 'resize' in node) {
    try {
      (node as LayoutMixin).resize(preview.newWidth, preview.newHeight);
      return true;
    } catch (_) {
      return false;
    }
  }

  const host = getAutoLayoutHost(node);
  if (!host || preview.paddingDelta == null) return false;

  const f = host as FrameNode;
  const setVar = (f as any).setBoundVariable as undefined | ((field: string, alias: VariableAlias) => void);

  if (preview.source === 'variable' && preview.variableId) {
    const variable = await figma.variables.getVariableByIdAsync(preview.variableId);
    if (variable && typeof setVar === 'function') {
      try {
        const alias = figma.variables.createVariableAlias(variable);
        for (const field of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const) {
          setVar.call(f, field, alias);
        }
        return true;
      } catch (_) {
        /* fall through to hardcoded */
      }
    }
  }

  try {
    f.paddingTop = (f.paddingTop || 0) + preview.paddingDelta;
    f.paddingRight = (f.paddingRight || 0) + preview.paddingDelta;
    f.paddingBottom = (f.paddingBottom || 0) + preview.paddingDelta;
    f.paddingLeft = (f.paddingLeft || 0) + preview.paddingDelta;
    return true;
  } catch (_) {
    return false;
  }
}

/** Keywords in frame name that suggest label/section/doc rather than a prototype screen (case-insensitive). */
const PROTO_LABEL_NAME_PATTERN = /\b(label|section|header|title|doc|note|indicator|legend|caption|placeholder|divider|spacer|rules\s+with|tiers?|group\s*\d*)\b/i;

/**
 * Heuristic: frame likely used as label, section header, or doc block — not a prototype screen.
 * Skip P-02 (orphan) for these to reduce noise. Criteria: name keywords, banner-like size, or only text child.
 */
function isLikelyNonPrototypeFrame(frame: FrameNode | ComponentNode): boolean {
  const name = (frame.name || '').toLowerCase();
  if (PROTO_LABEL_NAME_PATTERN.test(name)) return true;

  const w = 'width' in frame ? (frame as { width: number }).width : 0;
  const h = 'height' in frame ? (frame as { height: number }).height : 0;
  if (w <= 0 || h <= 0) return false;
  const aspect = w / h;
  if (aspect > 5 || aspect < 1 / 5) return true;
  if (h < 120 && w > 300) return true;

  const children = 'children' in frame ? (frame as ChildrenMixin).children : [];
  if (children.length === 1 && children[0].type === 'TEXT') return true;

  return false;
}

type ProtoIssue = { id: string; rule_id: string; categoryId: string; msg: string; severity: 'HIGH' | 'MED' | 'LOW'; layerId: string; fix: string; pageName?: string; flowName?: string; isOnHiddenLayer?: boolean; hideLayerActions?: boolean };

/** Yield to event loop so UI (loader, messages) can update during long prototype audit. */
const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

/** Semantic context per frame: nomi, keyword e testi per affinare le regole (es. schermate terminali, pulsanti Back). */
export interface FlowFrameContext {
  frameName: string;
  keywords: string[];
  hotspotNames: string[];
  textSnippets: string[];
}

const TERMINAL_FRAME_KEYWORDS = /\b(success|thank|grazie|confirmato|confirmed|done|complete|completo|finale|end|submitted|ordine\s*ricevuto|concluso|final|done|successo)\b/i;
const BACK_LIKE_BUTTON_NAMES = /\b(back|indietro|return|torna|prev|previous|anterior|close|chiudi)\b/i;

function tokenizeForSemantics(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function looksLikeTerminalFrame(keywords: string[], frameName: string): boolean {
  if (TERMINAL_FRAME_KEYWORDS.test(frameName)) return true;
  return keywords.some((k) => TERMINAL_FRAME_KEYWORDS.test(k));
}

/** Raccolta contesto semantico da nomi frame, hotspot e testi (base per audit semantico). */
function collectFlowSemanticContext(topFrames: readonly (FrameNode | ComponentNode)[]): Map<string, FlowFrameContext> {
  const map = new Map<string, FlowFrameContext>();
  for (const frame of topFrames) {
    const frameName = frame.name || '';
    const keywords = tokenizeForSemantics(frameName);
    const hotspotNames: string[] = [];
    const textSnippets: string[] = [];
    function walk(n: BaseNode) {
      if ('reactions' in n && Array.isArray((n as SceneNode & { reactions?: unknown[] }).reactions) && (n as SceneNode & { reactions: unknown[] }).reactions.length > 0)
        hotspotNames.push((n as BaseNode & { name?: string }).name || '');
      if (n.type === 'TEXT' && 'characters' in n)
        textSnippets.push(String((n as TextNode).characters).slice(0, 80));
      if ('children' in n)
        for (const c of (n as ChildrenMixin).children as BaseNode[]) walk(c);
    }
    walk(frame);
    map.set(frame.id, { frameName, keywords, hotspotNames, textSnippets: textSnippets.slice(0, 5) });
  }
  return map;
}

/** Cached check: node or any ancestor has visible === false. */
async function isNodeHidden(nodeId: string, cache: Map<string, boolean>): Promise<boolean> {
  if (cache.has(nodeId)) return cache.get(nodeId)!;
  const node = await figma.getNodeByIdAsync(nodeId);
  let hidden = false;
  if (node) {
    let n: BaseNode | null = node;
    while (n) {
      if ('visible' in n && (n as SceneNode).visible === false) {
        hidden = true;
        break;
      }
      n = n.parent;
    }
  }
  cache.set(nodeId, hidden);
  return hidden;
}

/** Prototype Audit: P-01–P-20. In-plugin, deterministic. */
async function runProtoAudit(page: PageNode, selectedFlowNodeIds: string[]): Promise<ProtoIssue[]> {
  const pageName = page.name || 'Current page';
  const issues: ProtoIssue[] = [];
  const hiddenCache = new Map<string, boolean>();
  let p01Count = 0, p02Count = 0, p03Count = 0, p04Count = 0, p05Count = 0, p06Count = 0, p07Count = 0;
  let p08Count = 0, p09Count = 0, p10Count = 0, p11Count = 0, p12Count = 0, p13Count = 0;
  let p14Count = 0, p15Count = 0, p16Count = 0, p17Count = 0, p18Count = 0, p19Count = 0, p20Count = 0;

  const flows = (page as any).flowStartingPoints != null
    ? Array.from((page as any).flowStartingPoints as ReadonlyArray<{ nodeId: string; name: string }>)
    : [];
  const flowStartIds = new Set(flows.map((f: { nodeId: string }) => f.nodeId));
  const flowStartNames: Record<string, string> = {};
  flows.forEach((f: { nodeId: string; name: string }) => { flowStartNames[f.nodeId] = f.name || 'Flow'; });

  const topFrames = page.children.filter((n): n is FrameNode | ComponentNode => n.type === 'FRAME' || n.type === 'COMPONENT');
  const topFrameIds = new Set(topFrames.map((f) => f.id));

  function getRootFrameId(node: BaseNode): string | null {
    let n: BaseNode | null = node;
    while (n) {
      if (topFrameIds.has(n.id)) return n.id;
      n = n.parent;
    }
    return null;
  }

  /** All FRAME/COMPONENT ancestor ids from node up to page (so flow starting points that are nested frames get marked). */
  function getAncestorFrameIds(node: BaseNode): string[] {
    const ids: string[] = [];
    let n: BaseNode | null = node;
    while (n && n.type !== 'PAGE') {
      if (n.type === 'FRAME' || n.type === 'COMPONENT') ids.push(n.id);
      n = n.parent;
    }
    return ids;
  }

  const outgoingByFrame = new Map<string, boolean>();
  const destinationFrameIds = new Set<string>();
  const brokenReactions: Array<{ nodeId: string; nodeName: string; destId: string; flowName: string }> = [];
  const hasBackByFrame = new Map<string, boolean>();
  const outgoingTargetByFrame = new Map<string, Set<string>>();
  const incomingEdges: Array<{ to: string; from: string; navigation: string; triggerType: string }> = [];
  const reactionDetails: Array<{ rootFrameId: string; nodeId: string; nodeName: string; triggerType: string; actions: Array<{ type: string; destinationId?: string | null; navigation?: string; transition?: { type?: string; duration?: number; easing?: { type?: string } } }> }> = [];
  const overlayTargetFrameIds = new Set<string>();

  function addOutgoingTarget(frameId: string, targetFrameId: string) {
    if (!outgoingTargetByFrame.has(frameId)) outgoingTargetByFrame.set(frameId, new Set());
    outgoingTargetByFrame.get(frameId)!.add(targetFrameId);
  }

  function markFrameOutgoing(frameId: string) {
    outgoingByFrame.set(frameId, true);
  }

  async function walkReactions(node: BaseNode, rootFrameId: string | null, flowName: string) {
    const r = (node as SceneNode & { reactions?: ReadonlyArray<{ trigger?: { type?: string }; actions?: Array<{ type: string; destinationId?: string | null; navigation?: string }> }> }).reactions;
    if (!Array.isArray(r)) return;
    const ancestorFrameIds = getAncestorFrameIds(node);
    let reactIndex = 0;
    for (const reaction of r) {
      if (++reactIndex % 8 === 0) await yieldToMain();
      const triggerType = (reaction as any).trigger?.type ?? '';
      const actions = reaction.actions ?? (reaction as any).action ? [(reaction as any).action] : [];
      const actionsForDetail = actions.map((a: any) => ({
        type: a?.type,
        destinationId: a?.destinationId,
        navigation: a?.navigation,
        transition: a?.transition,
      }));
      if (rootFrameId && actionsForDetail.length) {
        reactionDetails.push({ rootFrameId, nodeId: node.id, nodeName: node.name || 'Node', triggerType, actions: actionsForDetail });
      }
      for (const a of actions) {
        if (!a || typeof a !== 'object') continue;
        if (a.destinationId) {
          const dest = await figma.getNodeByIdAsync(a.destinationId);
          const nav = (a as any).navigation ?? 'NAVIGATE';
          if (nav === 'OVERLAY' && dest) {
            const destRoot = getRootFrameId(dest);
            if (destRoot) overlayTargetFrameIds.add(destRoot);
          }
          if (!dest) {
            brokenReactions.push({ nodeId: node.id, nodeName: node.name || 'Node', destId: a.destinationId, flowName });
          } else {
            const destRoot = getRootFrameId(dest);
            const destAncestorFrames = getAncestorFrameIds(dest);
            if (destRoot) {
              destinationFrameIds.add(destRoot);
              incomingEdges.push({ to: destRoot, from: rootFrameId || destRoot, navigation: nav, triggerType });
              if (rootFrameId) addOutgoingTarget(rootFrameId, destRoot);
              ancestorFrameIds.forEach((fid) => addOutgoingTarget(fid, destRoot));
            }
            destAncestorFrames.forEach((id) => destinationFrameIds.add(id));
            const outKey = rootFrameId || destRoot;
            if (outKey) markFrameOutgoing(outKey);
            ancestorFrameIds.forEach(markFrameOutgoing);
          }
        } else if (a.type === 'BACK' || a.type === 'CLOSE') {
          if (rootFrameId) {
            markFrameOutgoing(rootFrameId);
            if (a.type === 'BACK') hasBackByFrame.set(rootFrameId, true);
          }
          ancestorFrameIds.forEach((fid) => {
            markFrameOutgoing(fid);
            if (a.type === 'BACK') hasBackByFrame.set(fid, true);
          });
        }
      }
    }
  }

  async function walk(node: BaseNode, rootFrameId: string | null, flowName: string) {
    if ('reactions' in node && node.reactions) await walkReactions(node, rootFrameId, flowName);
    if ('children' in node && Array.isArray((node as ChildrenMixin).children)) {
      for (const c of (node as ChildrenMixin).children as BaseNode[]) {
        await walk(c, rootFrameId || getRootFrameId(c), flowName);
      }
    }
  }

  for (const child of page.children) {
    await yieldToMain();
    const rid = topFrameIds.has(child.id) ? (getRootFrameId(child) || child.id) : null;
    const flowName = topFrameIds.has(child.id) ? (flowStartNames[child.id] || '') : '';
    await walk(child, rid, flowName);
  }

  for (const br of brokenReactions) {
    p04Count++;
    issues.push({
      id: `P-04-${String(p04Count).padStart(3, '0')}`,
      rule_id: 'P-04',
      categoryId: 'flow-integrity',
      msg: 'Broken destination: target frame not found',
      severity: 'HIGH',
      layerId: br.nodeId,
      fix: 'Reconnect to an existing frame or remove the link. The target frame may have been deleted or moved.',
      pageName,
      flowName: br.flowName,
    });
  }

  if (flows.length === 0) {
    p03Count++;
    issues.push({
      id: `P-03-${String(p03Count).padStart(3, '0')}`,
      rule_id: 'P-03',
      categoryId: 'flow-integrity',
      msg: 'No flow starting point on this page',
      severity: 'HIGH',
      layerId: page.id,
      fix: 'Set at least one frame as flow starting point so the prototype can be previewed.',
      pageName,
      hideLayerActions: true,
    });
  }

  const reachable = new Set<string>();
  const toVisit = [...selectedFlowNodeIds];
  const visited = new Set<string>();
  let visitCount = 0;
  while (toVisit.length > 0) {
    if (++visitCount % 5 === 0) await yieldToMain();
    const fid = toVisit.pop()!;
    if (visited.has(fid)) continue;
    visited.add(fid);
    const node = await figma.getNodeByIdAsync(fid);
    if (node && (topFrameIds.has(fid) || flowStartIds.has(fid))) reachable.add(fid);
    if (node && 'children' in node) {
      const collectDests = async (n: BaseNode) => {
        const r = (n as SceneNode & { reactions?: ReadonlyArray<{ actions?: Array<{ type: string; destinationId?: string | null }> }> }).reactions;
        if (Array.isArray(r)) {
          for (const re of r) {
            const acts = re.actions ?? (re as any).action ? [(re as any).action] : [];
            for (const a of acts) {
              if (a?.destinationId) {
                const dest = await figma.getNodeByIdAsync(a.destinationId);
                if (dest) {
                  const destRoot = getRootFrameId(dest);
                  if (destRoot && !visited.has(destRoot)) toVisit.push(destRoot);
                }
              }
            }
          }
        }
        if ('children' in n) for (const c of (n as ChildrenMixin).children as BaseNode[]) await collectDests(c);
      };
      await collectDests(node);
    }
  }

  for (const fid of reachable) {
    if (flowStartIds.has(fid)) {
      if (!outgoingByFrame.get(fid)) {
        p03Count++;
        const flowName = flowStartNames[fid] || 'Flow';
        issues.push({
          id: `P-03-${String(p03Count).padStart(3, '0')}`,
          rule_id: 'P-03',
          categoryId: 'flow-integrity',
          msg: 'Flow starting point has no outgoing connection',
          severity: 'HIGH',
          layerId: fid,
          fix: 'Add at least one interaction from this starting frame to another frame.',
          pageName,
          flowName,
        });
      }
    } else if (!outgoingByFrame.get(fid)) {
      p01Count++;
      const flowName = Object.values(flowStartNames)[0] || 'Flow';
      issues.push({
        id: `P-01-${String(p01Count).padStart(3, '0')}`,
        rule_id: 'P-01',
        categoryId: 'flow-integrity',
        msg: 'Dead-end frame: no outgoing connections or Back actions',
        severity: 'HIGH',
        layerId: fid,
        fix: 'Add a Back action or Navigate to action so the user can leave this screen.',
        pageName,
        flowName,
      });
    }
  }

  for (const frame of topFrames) {
    const fid = frame.id;
    if (isLikelyNonPrototypeFrame(frame)) continue;
    if (!flowStartIds.has(fid) && !destinationFrameIds.has(fid) && !outgoingByFrame.get(fid)) {
      p02Count++;
      issues.push({
        id: `P-02-${String(p02Count).padStart(3, '0')}`,
        rule_id: 'P-02',
        categoryId: 'flow-integrity',
        msg: 'Orphan frame: not connected to any flow',
        severity: 'HIGH',
        layerId: fid,
        fix: 'Connect this frame to a flow (add a Navigate to or Open overlay from another frame) or remove it if unused.',
        pageName,
      });
    }
  }

  // P-06: Unreachable frame (has incoming but not reachable from any flow start)
  for (const fid of topFrameIds) {
    if (flowStartIds.has(fid)) continue;
    if (destinationFrameIds.has(fid) && !reachable.has(fid)) {
      p06Count++;
      issues.push({
        id: `P-06-${String(p06Count).padStart(3, '0')}`,
        rule_id: 'P-06',
        categoryId: 'navigation-coverage',
        msg: 'Frame has incoming connections but is not reachable from any flow start',
        severity: 'HIGH',
        layerId: fid,
        fix: 'Reconnect the flow or add a path from a starting frame.',
        pageName,
      });
    }
  }

  // P-05: Missing back navigation (reached via NAVIGATE but no BACK nor Navigate to source)
  const navigateInByFrame = new Map<string, Set<string>>();
  for (const e of incomingEdges) {
    if (e.navigation !== 'NAVIGATE') continue;
    if (!navigateInByFrame.has(e.to)) navigateInByFrame.set(e.to, new Set());
    navigateInByFrame.get(e.to)!.add(e.from);
  }
  for (const fid of reachable) {
    if (flowStartIds.has(fid)) continue;
    const fromFrames = navigateInByFrame.get(fid);
    if (!fromFrames?.size) continue;
    const hasBack = hasBackByFrame.get(fid);
    const canNavigateTo = outgoingTargetByFrame.get(fid);
    const canReturn = hasBack || Array.from(fromFrames).some((fromId) => canNavigateTo?.has(fromId));
    if (!canReturn) {
      p05Count++;
      issues.push({
        id: `P-05-${String(p05Count).padStart(3, '0')}`,
        rule_id: 'P-05',
        categoryId: 'navigation-coverage',
        msg: 'Missing back navigation: no way to return from this screen',
        severity: 'HIGH',
        layerId: fid,
        fix: 'Add a Back action or a button that navigates to the previous screen so users can go back.',
        pageName,
      });
    }
  }

  // P-07: Circular loop with only AFTER_TIMEOUT (no user exit)
  const timeoutEdges: Array<[string, string]> = [];
  for (const e of incomingEdges) {
    if (e.triggerType === 'AFTER_TIMEOUT') timeoutEdges.push([e.from, e.to]);
  }
  const timeoutAdj = new Map<string, string[]>();
  for (const [from, to] of timeoutEdges) {
    if (!topFrameIds.has(from) || !topFrameIds.has(to)) continue;
    if (!timeoutAdj.has(from)) timeoutAdj.set(from, []);
    timeoutAdj.get(from)!.push(to);
  }
  const cycleVisited = new Set<string>();
  const cycleStack = new Set<string>();
  const cyclePath: string[] = [];
  const cycleStart = new Map<string, number>();
  function findTimeoutCycles(nodeId: string): string[] | null {
    if (cycleStack.has(nodeId)) {
      const idx = cycleStart.get(nodeId) ?? cyclePath.indexOf(nodeId);
      return cyclePath.slice(idx);
    }
    if (cycleVisited.has(nodeId)) return null;
    cycleVisited.add(nodeId);
    cycleStack.add(nodeId);
    cycleStart.set(nodeId, cyclePath.length);
    cyclePath.push(nodeId);
    const nextIds = timeoutAdj.get(nodeId) ?? [];
    for (const nextId of nextIds) {
      const cycle = findTimeoutCycles(nextId);
      if (cycle?.length) {
        cycleStack.delete(nodeId);
        cyclePath.pop();
        return cycle;
      }
    }
    cycleStack.delete(nodeId);
    cyclePath.pop();
    return null;
  }
  const reportedCycles = new Set<string>();
  for (const fid of topFrameIds) {
    const cycle = findTimeoutCycles(fid);
    if (!cycle?.length) continue;
    const key = [...cycle].sort().join(',');
    if (reportedCycles.has(key)) continue;
    reportedCycles.add(key);
    p07Count++;
    issues.push({
      id: `P-07-${String(p07Count).padStart(3, '0')}`,
      rule_id: 'P-07',
      categoryId: 'navigation-coverage',
      msg: 'Circular loop with only automatic transitions (After delay) and no user exit',
      severity: 'HIGH',
      layerId: cycle[0],
      fix: 'Add an On click path out of the loop or reduce to a single loading frame.',
      pageName,
    });
  }

  // P-08: Duplicate trigger on same layer (same type twice) — Figma also warns; we mirror for audit.
  // Do NOT group by parent: siblings (e.g. two links) may legitimately use different triggers (Hover + Key).
  const triggerCountsByNode = new Map<string, Map<string, number>>();
  for (const rd of reactionDetails) {
    const t = rd.triggerType || 'ON_CLICK';
    if (!triggerCountsByNode.has(rd.nodeId)) triggerCountsByNode.set(rd.nodeId, new Map());
    const m = triggerCountsByNode.get(rd.nodeId)!;
    m.set(t, (m.get(t) ?? 0) + 1);
  }
  for (const [nodeId, counts] of triggerCountsByNode) {
    for (const [triggerType, count] of counts) {
      if (count > 1) {
        p08Count++;
        issues.push({
          id: `P-08-${String(p08Count).padStart(3, '0')}`,
          rule_id: 'P-08',
          categoryId: 'interaction-quality',
          msg: `Duplicate "${triggerType}" interactions on the same layer (${count})`,
          severity: 'HIGH',
          layerId: nodeId,
          fix: 'Merge into one interaction or use different layers. Figma warns when two identical triggers compete on the same hotspot.',
          pageName,
        });
      }
    }
  }

  // P-09: Smart Animate — layer name/hierarchy match (source frame vs destination frame)
  let detailIndex = 0;
  for (const rd of reactionDetails) {
    if (++detailIndex % 12 === 0) await yieldToMain();
    for (const a of rd.actions) {
      if ((a as any).transition?.type !== 'SMART_ANIMATE' || !a.destinationId) continue;
      const destNode = await figma.getNodeByIdAsync(a.destinationId);
      if (!destNode) continue;
      const destRootId = getRootFrameId(destNode);
      const srcFrame = await figma.getNodeByIdAsync(rd.rootFrameId);
      const destFrame = destRootId ? await figma.getNodeByIdAsync(destRootId) : null;
      if (!srcFrame || !destFrame || !('children' in srcFrame) || !('children' in destFrame)) continue;
      const srcNames = new Set((srcFrame as ChildrenMixin).children.map((c) => c.name));
      const destNames = new Set((destFrame as ChildrenMixin).children.map((c) => c.name));
      const onlyInSrc = [...srcNames].filter((n) => !destNames.has(n));
      const onlyInDest = [...destNames].filter((n) => !srcNames.has(n));
      if (onlyInSrc.length || onlyInDest.length) {
        p09Count++;
        issues.push({
          id: `P-09-${String(p09Count).padStart(3, '0')}`,
          rule_id: 'P-09',
          categoryId: 'interaction-quality',
          msg: 'Smart Animate: layer names differ between source and destination frame',
          severity: 'HIGH',
          layerId: rd.nodeId,
          fix: 'Match layer names and hierarchy between frames so Smart Animate can interpolate correctly.',
          pageName,
        });
        break;
      }
    }
  }

  // P-10: Duration boundaries (e.g. Navigate 200–500 ms)
  const DURATION_MIN_MS = 150;
  const DURATION_MAX_MS = 800;
  for (const rd of reactionDetails) {
    for (const a of rd.actions) {
      const t = (a as any).transition;
      if (!t?.duration) continue;
      const ms = t.duration * 1000;
      if (ms < DURATION_MIN_MS || ms > DURATION_MAX_MS) {
        p10Count++;
        issues.push({
          id: `P-10-${String(p10Count).padStart(3, '0')}`,
          rule_id: 'P-10',
          categoryId: 'interaction-quality',
          msg: `Transition duration ${Math.round(ms)}ms outside recommended range (${DURATION_MIN_MS}–${DURATION_MAX_MS}ms)`,
          severity: 'MED',
          layerId: rd.nodeId,
          fix: 'Set duration within 200–500ms for navigation so the transition feels clear but not sluggish.',
          pageName,
        });
        break;
      }
    }
  }

  // P-11: Easing consistency per navigation type
  const easingByNav = new Map<string, Set<string>>();
  for (const rd of reactionDetails) {
    for (const a of rd.actions) {
      const nav = (a as any).navigation ?? 'NAVIGATE';
      const easing = (a as any).transition?.easing?.type ?? 'LINEAR';
      if (!easingByNav.has(nav)) easingByNav.set(nav, new Set());
      easingByNav.get(nav)!.add(easing);
    }
  }
  for (const [nav, easings] of easingByNav) {
    if (easings.size > 2) {
      p11Count++;
      issues.push({
        id: `P-11-${String(p11Count).padStart(3, '0')}`,
        rule_id: 'P-11',
        categoryId: 'interaction-quality',
        msg: `Inconsistent easing for ${nav} transitions`,
        severity: 'MED',
        layerId: topFrames[0]?.id ?? page.id,
        fix: 'Use a consistent easing (e.g. Ease Out for entrances) across the flow.',
        pageName,
      });
    }
  }

  // P-12: Overlay configuration (target frames should have close path)
  for (const fid of overlayTargetFrameIds) {
    if (!topFrameIds.has(fid)) continue;
    const hasClose = hasBackByFrame.get(fid) || outgoingByFrame.get(fid);
    if (!hasClose) {
      p12Count++;
      issues.push({
        id: `P-12-${String(p12Count).padStart(3, '0')}`,
        rule_id: 'P-12',
        categoryId: 'overlay-scroll',
        msg: 'Overlay frame has no close path (Back or Close overlay)',
        severity: 'MED',
        layerId: fid,
        fix: 'Set overlay position, background, and ensure at least one Close overlay or close when clicking outside.',
        pageName,
      });
    }
  }

  // P-13: Scroll overflow — heuristic: frame with overflow scroll should have content
  for (const frame of topFrames) {
    const overflow = (frame as any).overflowDirection;
    if (overflow === 'NONE' || !overflow) continue;
    const children = 'children' in frame ? (frame as ChildrenMixin).children : [];
    const hasContent = children.length > 0;
    if (!hasContent) {
      p13Count++;
      issues.push({
        id: `P-13-${String(p13Count).padStart(3, '0')}`,
        rule_id: 'P-13',
        categoryId: 'overlay-scroll',
        msg: 'Frame has scroll direction set but no child content',
        severity: 'MED',
        layerId: frame.id,
        fix: 'Enable scroll only when content extends beyond bounds, or add content.',
        pageName,
      });
    }
  }

  // P-14: Interactive component (simplified: component with CHANGE_TO should have variants)
  for (const rd of reactionDetails) {
    for (const a of rd.actions) {
      if ((a as any).navigation !== 'CHANGE_TO') continue;
      p14Count++;
      issues.push({
        id: `P-14-${String(p14Count).padStart(3, '0')}`,
        rule_id: 'P-14',
        categoryId: 'component-advanced',
        msg: 'Verify component has required variants (Default, Hover, Pressed, Disabled) for Change to',
        severity: 'HIGH',
        layerId: rd.nodeId,
        fix: 'Edit the main component: add missing state variants (Default, Hover, Pressed, Disabled) and wire interactions (e.g. Hover → Default on Mouse leave). States are defined on the main component, not on the instance.',
        pageName,
      });
      break;
    }
  }

  // P-15: Variable usage (SET_VARIABLE — variable should exist)
  if (typeof figma.variables?.getVariableByIdAsync === 'function') {
    for (const rd of reactionDetails) {
      for (const a of rd.actions) {
        if (a.type !== 'SET_VARIABLE') continue;
        const vid = (a as any).variableId;
        if (!vid) continue;
        try {
          const v = await figma.variables.getVariableByIdAsync(vid);
          if (!v) {
            p15Count++;
            issues.push({
              id: `P-15-${String(p15Count).padStart(3, '0')}`,
              rule_id: 'P-15',
              categoryId: 'component-advanced',
              msg: 'Set variable references a variable that may not exist',
              severity: 'MED',
              layerId: rd.nodeId,
              fix: 'Create the variable in a collection or fix the variable ID.',
              pageName,
            });
          }
        } catch {
          p15Count++;
          issues.push({
            id: `P-15-${String(p15Count).padStart(3, '0')}`,
            rule_id: 'P-15',
            categoryId: 'component-advanced',
            msg: 'Set variable references an invalid or missing variable',
            severity: 'MED',
            layerId: rd.nodeId,
            fix: 'Create the variable in a collection and ensure set/read usage match.',
            pageName,
          });
        }
        break;
      }
    }
  }

  // P-16: Conditional logic (both branches should have actions)
  for (const rd of reactionDetails) {
    for (const a of rd.actions) {
      if (a.type !== 'CONDITIONAL') continue;
      const blocks = (a as any).conditionalBlocks;
      if (!Array.isArray(blocks) || blocks.length < 2) continue;
      const empty = blocks.some((b: any) => !Array.isArray(b.actions) || b.actions.length === 0);
      if (empty) {
        p16Count++;
        issues.push({
          id: `P-16-${String(p16Count).padStart(3, '0')}`,
          rule_id: 'P-16',
          categoryId: 'component-advanced',
          msg: 'Conditional has an empty branch (no actions)',
          severity: 'MED',
          layerId: rd.nodeId,
          fix: 'Ensure both IF and ELSE branches have the intended actions.',
          pageName,
        });
      }
      break;
    }
  }

  // P-17: Multiple actions order (multiple Navigate to same trigger)
  for (const rd of reactionDetails) {
    const navigateCount = rd.actions.filter((a: any) => a.type === 'NODE' && a.navigation === 'NAVIGATE').length;
    if (navigateCount > 1) {
      p17Count++;
      issues.push({
        id: `P-17-${String(p17Count).padStart(3, '0')}`,
        rule_id: 'P-17',
        categoryId: 'component-advanced',
        msg: 'Multiple Navigate actions on same trigger — only the last will run',
        severity: 'MED',
        layerId: rd.nodeId,
        fix: 'Keep a single Navigate per trigger or reorder so Set variable runs before Navigate.',
        pageName,
      });
    }
  }

  // P-18: Flow naming (default names)
  const defaultFlowName = /^flow\s*\d+$/i;
  for (const f of flows) {
    if (defaultFlowName.test(f.name || '')) {
      p18Count++;
      issues.push({
        id: `P-18-${String(p18Count).padStart(3, '0')}`,
        rule_id: 'P-18',
        categoryId: 'documentation-coverage',
        msg: 'Flow has default name (e.g. "Flow 1"). Use a descriptive name.',
        severity: 'LOW',
        layerId: f.nodeId,
        fix: "Rename the flow (e.g. 'Onboarding', 'Checkout') and add a short description.",
        pageName,
      });
    }
  }

  // P-19: Hotspot coverage — leaf-like nodes that look interactive but have no reactions
  /** Groups and multi-child frames are layout containers, not a single interactive block. */
  function isLikelyLayoutContainer(n: BaseNode): boolean {
    if (n.type === 'GROUP') return true;
    if (n.type === 'FRAME' || n.type === 'COMPONENT') {
      const ch = 'children' in n ? ((n as ChildrenMixin).children as BaseNode[]) : [];
      if (ch.length > 1) return true;
    }
    return false;
  }

  function collectInteractiveLikelyNodes(n: BaseNode, acc: BaseNode[]) {
    const name = (n.name || '').toLowerCase();
    const nameLooksInteractive =
      /^(btn|button|cta|link|icon-)/.test(name) || name.includes('button') || name.includes('link');
    if (nameLooksInteractive) {
      const hasReactions =
        'reactions' in n && Array.isArray((n as any).reactions) && (n as any).reactions.length > 0;
      if (!hasReactions && !isLikelyLayoutContainer(n)) acc.push(n);
    }
    if ('children' in n) for (const c of (n as ChildrenMixin).children as BaseNode[]) collectInteractiveLikelyNodes(c, acc);
  }
  const interactiveLikely: BaseNode[] = [];
  for (const child of page.children) collectInteractiveLikelyNodes(child, interactiveLikely);
  for (const node of interactiveLikely.slice(0, 10)) {
    p19Count++;
    issues.push({
      id: `P-19-${String(p19Count).padStart(3, '0')}`,
      rule_id: 'P-19',
      categoryId: 'documentation-coverage',
      msg: 'Element looks interactive but has no prototype interaction',
      severity: 'MED',
      layerId: node.id,
      fix: 'Add a prototype interaction (e.g. On click → Navigate to or Open overlay).',
      pageName,
    });
  }

  // P-20: Presentation (simplified: advisory)
  const startCount = flows.length;
  if (startCount > 5) {
    p20Count++;
    issues.push({
      id: `P-20-${String(p20Count).padStart(3, '0')}`,
      rule_id: 'P-20',
      categoryId: 'documentation-coverage',
      msg: 'More than 5 flows on this page — consider splitting or naming clearly',
      severity: 'LOW',
      layerId: page.id,
      fix: 'Consider splitting this prototype into smaller sections/pages (<= 5 flows each) or rename flows clearly so each flow can be tested independently. Many flows on one page makes navigation and test planning harder.',
      pageName,
      hideLayerActions: true,
    });
  }

  for (let i = 0; i < issues.length; i++) {
    if (i % 15 === 0) await yieldToMain();
    issues[i].isOnHiddenLayer = await isNodeHidden(issues[i].layerId, hiddenCache);
  }
  return issues;
}

/**
 * Flow starting points for the editor's current page → UI (prototype tab).
 * Must run again when the user switches page in Figma, otherwise the list stays stale.
 */
function postFlowStartingPointsToUi(): void {
  try {
    const page = figma.currentPage;
    const raw = (page as PageNode & { flowStartingPoints?: ReadonlyArray<{ nodeId: string; name: string }> })
      .flowStartingPoints;
    const flows =
      raw != null ? Array.from(raw).map((f) => ({ nodeId: f.nodeId, name: f.name })) : [];
    figma.ui.postMessage({
      type: 'flow-starting-points-result',
      flows,
      pageId: page.id,
      pageName: page.name,
    });
  } catch (_e) {
    const page = figma.currentPage;
    figma.ui.postMessage({
      type: 'flow-starting-points-result',
      flows: [],
      pageId: page?.id ?? '',
      pageName: page?.name ?? '',
    });
  }
}

function postSelectionToUi(): void {
  const selection = figma.currentPage.selection;
  const nodes = selection.map((node: SceneNode) => ({
    id: node.id,
    name: node.name,
    type: node.type,
  }));
  figma.ui.postMessage({ type: 'selection-changed', nodes });
}

function collectSubtreeTextMetrics(node: SceneNode): { textNodes: number; charCount: number } {
  if (!node || node.removed) return { textNodes: 0, charCount: 0 };
  try {
    const host = node as { findAll?: (filter: (n: SceneNode) => boolean) => SceneNode[] };
    if (typeof host.findAll !== 'function') return { textNodes: 0, charCount: 0 };
    const texts = host.findAll((n): n is TextNode => n.type === 'TEXT');
    let charCount = 0;
    for (const t of texts) {
      try {
        charCount += t.characters.length;
      } catch {
        /* mixed font / bound */
      }
    }
    return { textNodes: texts.length, charCount };
  } catch {
    return { textNodes: 0, charCount: 0 };
  }
}

figma.ui.onmessage = async (raw: any) => {
  const msg = raw?.pluginMessage ?? raw;
  if (msg.type === 'resize-window') {
    figma.ui.resize(msg.width, msg.height);
  }

  /** UI: set isOnHiddenLayer (node or any ancestor visible === false) — same semantics as prototype / A11Y toggle. */
  if (msg.type === 'enrich-issues-hidden') {
    const issues = Array.isArray(msg.issues) ? msg.issues : [];
    const requestId = msg.requestId;
    const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));
    (async () => {
      try {
        await figma.loadAllPagesAsync();
        const hiddenCache = new Map<string, boolean>();
        const out: any[] = [];
        for (let i = 0; i < issues.length; i++) {
          if (i > 0 && i % 25 === 0) await yieldToMain();
          const rawIssue = issues[i];
          const copy = { ...rawIssue };
          let lid = '';
          if (rawIssue?.layerId) lid = String(rawIssue.layerId).trim();
          else if (Array.isArray(rawIssue?.layerIds) && rawIssue.layerIds.length > 0)
            lid = String(rawIssue.layerIds[0]).trim();
          let isOnHiddenLayer = false;
          if (lid) {
            try {
              isOnHiddenLayer = await isNodeHidden(lid, hiddenCache);
            } catch (_) {
              isOnHiddenLayer = false;
            }
          }
          copy.isOnHiddenLayer = isOnHiddenLayer;
          out.push(copy);
        }
        figma.ui.postMessage({ type: 'enrich-issues-hidden-result', requestId, issues: out });
      } catch (e) {
        console.error('[enrich-issues-hidden]', e);
        figma.ui.postMessage({ type: 'enrich-issues-hidden-result', requestId, issues });
      }
    })();
    return;
  }

  if (msg.type === 'open-oauth-url') {
    if (msg.authUrl) figma.openExternal(msg.authUrl);
  }

  if (msg.type === 'oauth-complete') {
    const user = msg.user;
    if (user) {
      await figma.clientStorage.setAsync('figmaOAuthUser', { user, savedAt: Date.now() });
      figma.ui.postMessage({ type: 'login-success', user });
    }
  }

  if (msg.type === 'get-saved-user') {
    const user = await getStoredUser();
    figma.ui.postMessage({ type: 'restore-user', user });
  }

  if (msg.type === 'logout') {
    await figma.clientStorage.deleteAsync('figmaOAuthUser');
  }

  if (msg.type === 'get-selection') {
    postSelectionToUi();
  }

  if (msg.type === 'execute-action-plan') {
    const requestId = msg.requestId;
    const actionPlan = msg.actionPlan;
    const modifyMode = msg.modifyMode === true;
    const serverRequestId = typeof msg.serverRequestId === 'string' ? msg.serverRequestId.trim() : '';
    const figmaFileKeyForQuality = typeof msg.figmaFileKey === 'string' ? msg.figmaFileKey.trim() : '';
    const qualityWatch = msg.qualityWatch === true && Boolean(serverRequestId);
    (async () => {
      setDsContextIndexRefreshSuspended(true);
      try {
        figma.ui.postMessage({ type: 'action-plan-execute-progress', requestId, phase: 'start' });
        const { rootId } = await executeActionPlanOnCanvas(actionPlan, {
          modifyMode,
          onProgress: (p) => {
            figma.ui.postMessage({
              type: 'action-plan-execute-progress',
              requestId,
              phase: p.phase,
              actionIndex: p.actionIndex,
            });
          },
        });
        figma.ui.postMessage({ type: 'action-plan-executed', requestId, rootId });
        if (qualityWatch && rootId) {
          try {
            const rootNode = await figma.getNodeByIdAsync(rootId);
            if (rootNode && 'findAll' in rootNode) {
              const baseline = collectSubtreeTextMetrics(rootNode as SceneNode);
              let debounceTimer: ReturnType<typeof setTimeout> | null = null;
              let fired = false;
              const handler = () => {
                if (fired) return;
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(async () => {
                  debounceTimer = null;
                  try {
                    const n = await figma.getNodeByIdAsync(rootId);
                    if (!n || !('findAll' in n) || ('removed' in n && n.removed)) {
                      fired = true;
                      figma.off('documentchange', handler);
                      figma.ui.postMessage({
                        type: 'generation-quality-signal',
                        requestId,
                        serverRequestId,
                        figmaFileKey: figmaFileKeyForQuality,
                        payload: { root_id: rootId, reason: 'root_removed_or_missing' },
                      });
                      return;
                    }
                    const after = collectSubtreeTextMetrics(n as SceneNode);
                    if (after.textNodes !== baseline.textNodes || after.charCount !== baseline.charCount) {
                      fired = true;
                      figma.off('documentchange', handler);
                      figma.ui.postMessage({
                        type: 'generation-quality-signal',
                        requestId,
                        serverRequestId,
                        figmaFileKey: figmaFileKeyForQuality,
                        payload: {
                          root_id: rootId,
                          reason: 'subtree_text_metrics_changed',
                          before: baseline,
                          after,
                        },
                      });
                    }
                  } catch {
                    /* ignore */
                  }
                }, 1200);
              };
              figma.on('documentchange', handler);
              setTimeout(() => {
                if (fired) return;
                figma.off('documentchange', handler);
                fired = true;
              }, 10 * 60 * 1000);
            }
          } catch {
            /* ignore */
          }
        }
        figma.notify(
          modifyMode
            ? 'Comtra: copia modificata sulla pagina (originale invariata).'
            : 'Comtra: interfaccia creata sulla pagina corrente.',
        );
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        figma.ui.postMessage({ type: 'action-plan-execute-error', requestId, error: errMsg });
        figma.notify(`Comtra: errore creazione — ${errMsg}`);
      } finally {
        setDsContextIndexRefreshSuspended(false);
      }
    })();
    return;
  }

  if (msg.type === 'get-pages') {
    await figma.loadAllPagesAsync();
    const pages = figma.root.children.map((p: PageNode) => ({ id: p.id, name: p.name }));
    figma.ui.postMessage({ type: 'pages-result', pages });
  }

  if (msg.type === 'get-ds-context-index') {
    const requestId = msg.requestId;
    const reuseCached = msg.reuseCached !== false;
    (async () => {
      try {
        const index = await resolveDsContextIndexForRequest({ reuseCached });
        figma.ui.postMessage({ type: 'ds-context-index-result', requestId, index, hash: index.hash });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error('[get-ds-context-index]', e);
        figma.ui.postMessage({
          type: 'ds-context-index-result',
          requestId,
          index: null,
          hash: null,
          error: errMsg,
        });
      }
    })();
    return;
  }

  if (msg.type === 'get-ds-context-index-phase') {
    const requestId = msg.requestId;
    const phase =
      msg.phase === 'components' ? 'components' : msg.phase === 'rules' ? 'rules' : 'tokens';
    (async () => {
      try {
        const r =
          phase === 'components'
            ? await buildDsContextIndexComponentsMerge({
                onPageProgress: ({ pageName, pageIndex, pageTotal, scanned }) => {
                  figma.ui.postMessage({
                    type: 'ds-import-progress',
                    requestId,
                    phase: 'components',
                    pageName,
                    pageIndex,
                    pageTotal,
                    scanned,
                  });
                },
              })
            : phase === 'rules'
              ? await buildDsContextIndexRulesOnly()
              : await buildDsContextIndexTokensOnly();
        figma.ui.postMessage({
          type: 'ds-context-index-result',
          requestId,
          index: r.index,
          hash: r.index.hash,
        });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error('[get-ds-context-index-phase]', phase, e);
        figma.ui.postMessage({
          type: 'ds-context-index-result',
          requestId,
          index: null,
          hash: null,
          error: errMsg,
        });
      }
    })();
    return;
  }

  if (msg.type === 'get-flow-starting-points') {
    postFlowStartingPointsToUi();
  }

  if (msg.type === 'run-proto-audit') {
    const selectedFlowNodeIds: string[] = Array.isArray(msg.selectedFlowNodeIds) ? msg.selectedFlowNodeIds : [];
    (async () => {
      try {
        const issues = await runProtoAudit(figma.currentPage, selectedFlowNodeIds);
        figma.ui.postMessage({ type: 'proto-audit-result', issues });
      } catch (e) {
        console.error('[run-proto-audit]', e);
        figma.ui.postMessage({ type: 'proto-audit-result', issues: [], error: String(e) });
      }
    })();
  }

  // Serialize document tree for audit. Chunked + yield so the main thread never blocks for long.
  /** Extra margin for SECTION → frame → card → INSTANCE → … chains in DS audit export. */
  const MAX_SERIALIZE_DEPTH = 8;
  const SERIALIZE_CHUNK = 20;
  const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

  function serializeFills(fills: readonly Paint[]): { type: 'SOLID'; color?: { r: number; g: number; b: number; a: number }; opacity?: number }[] {
    const arr = Array.isArray(fills) ? fills : [];
    const out = arr.filter((p: any) => p.type === 'SOLID').map((p: any) => ({
      type: 'SOLID' as const,
      color: p.color ? { r: p.color.r, g: p.color.g, b: p.color.b, a: p.color.a ?? 1 } : undefined,
      opacity: p.opacity,
    })).filter((p: any) => p.color);
    return out;
  }

  /** Paint variable bindings for DS audit (2.1 / 2.2). Keeps payload small — only fills/strokes keys. */
  function serializeBoundVariablesPaint(node: BaseNode): Record<string, unknown> | undefined {
    const bv = (node as any).boundVariables as Record<string, unknown> | undefined;
    if (!bv || typeof bv !== 'object') return undefined;
    const out: Record<string, unknown> = {};
    if (bv.fills != null) out.fills = bv.fills;
    if (bv.strokes != null) out.strokes = bv.strokes;
    return Object.keys(out).length > 0 ? out : undefined;
  }

  function serializeNodeShallow(node: BaseNode): any {
    const out: any = { id: node.id, name: node.name, type: node.type, children: [] };
    if ('absoluteBoundingBox' in node && node.absoluteBoundingBox) {
      const b = node.absoluteBoundingBox;
      out.absoluteBoundingBox = { x: b.x, y: b.y, width: b.width, height: b.height };
    }
    if ('fillStyleId' in node) {
      const fid = (node as any).fillStyleId;
      if (typeof fid === 'string' && fid.trim() !== '') out.fillStyleId = fid;
    }
    if ('strokeStyleId' in node) {
      const sid = (node as any).strokeStyleId;
      if (typeof sid === 'string' && sid.trim() !== '') out.strokeStyleId = sid;
    }
    const bvPaint = serializeBoundVariablesPaint(node);
    if (bvPaint) out.boundVariables = bvPaint;
    if ('fills' in node) {
      let fillsToSerialize: readonly Paint[] | null = null;
      if (node.fills !== figma.mixed && Array.isArray(node.fills)) {
        fillsToSerialize = node.fills;
      } else if (node.type === 'TEXT') {
        try {
          const segments = (node as TextNode).getStyledTextSegments?.(['fills']);
          const first = segments?.[0];
          if (first?.fills && Array.isArray(first.fills)) fillsToSerialize = first.fills;
        } catch (_) { /* ignore */ }
      }
      if (fillsToSerialize && fillsToSerialize.length > 0) {
        const serialized = serializeFills(fillsToSerialize);
        if (serialized.length > 0) out.fills = serialized;
      }
    }
    if ('strokes' in node && node.strokes !== figma.mixed && Array.isArray(node.strokes) && node.strokes.length > 0) {
      const serialized = serializeFills(node.strokes as readonly Paint[]);
      if (serialized.length > 0) out.strokes = serialized;
    }
    if ('strokeWeight' in node && typeof (node as any).strokeWeight === 'number' && (node as any).strokeWeight > 0) {
      out.strokeWeight = (node as any).strokeWeight;
    }
    if (node.type === 'TEXT') {
      const tn = node as TextNode;
      const tst = (tn as any).textStyleId;
      if (typeof tst === 'string' && tst.trim() !== '') out.textStyleId = tst;

      let segBest: {
        fontSize?: number;
        fontWeight?: number;
        lineHeightPx?: number;
        fontFamily?: string;
      } = {};
      try {
        const segs = tn.getStyledTextSegments?.(['fontSize', 'fontName', 'fontWeight', 'lineHeightPx']);
        if (Array.isArray(segs) && segs.length > 0) {
          let bestIdx = 0;
          let bestLen = -1;
          for (let i = 0; i < segs.length; i++) {
            const ch = segs[i].characters;
            const len = typeof ch === 'string' ? ch.length : 0;
            if (len > bestLen) {
              bestLen = len;
              bestIdx = i;
            }
          }
          const best = segs[bestIdx];
          if (typeof best.fontSize === 'number') segBest.fontSize = best.fontSize;
          if (typeof best.fontWeight === 'number') segBest.fontWeight = best.fontWeight;
          if (typeof (best as { lineHeightPx?: number }).lineHeightPx === 'number')
            segBest.lineHeightPx = (best as { lineHeightPx?: number }).lineHeightPx!;
          const fn = best.fontName;
          if (fn && typeof fn.family === 'string') segBest.fontFamily = fn.family;
        }
      } catch (_) {
        /* ignore */
      }

      out.style = {};
      const tnAny = tn as any;
      if (typeof tnAny.fontSize === 'number') out.style.fontSize = tnAny.fontSize;
      else if (segBest.fontSize != null) out.style.fontSize = segBest.fontSize;

      if (typeof tnAny.fontWeight === 'number') out.style.fontWeight = tnAny.fontWeight;
      else if (segBest.fontWeight != null) out.style.fontWeight = segBest.fontWeight;

      if (segBest.lineHeightPx != null) out.style.lineHeightPx = segBest.lineHeightPx;
      if (segBest.fontFamily) out.style.fontFamily = segBest.fontFamily;

      try {
        const t = tn.characters;
        if (typeof t === 'string' && t.length > 0) out.characters = t.length > 120 ? `${t.slice(0, 120)}…` : t;
      } catch (_) {
        /* ignore */
      }

      const bv = (tn as any).boundVariables as Record<string, unknown> | undefined;
      if (bv && typeof bv === 'object') {
        const textBv: Record<string, unknown> = {};
        for (const k of ['fontSize', 'fontFamily', 'fontWeight', 'lineHeight', 'letterSpacing', 'paragraphSpacing']) {
          if (bv[k] != null) textBv[k] = bv[k];
        }
        if (Object.keys(textBv).length > 0) {
          out.boundVariables = { ...(out.boundVariables || {}), ...textBv };
        }
      }
    }
    if ('visible' in node && node.visible === false) out.visible = false;
    return out;
  }

  type SerializeQueueItem = { node: BaseNode; depth: number; parentArr: any[] };
  async function buildDocumentJsonAsync(opts: { scope?: string; nodeIds?: string[]; pageId?: string }): Promise<{ document: any }> {
    const scope = opts.scope ?? 'all';
    // Required with documentAccess: dynamic-page (Figma 2024+): load pages before accessing nodes
    await figma.loadAllPagesAsync();

    const processQueue = async (queue: SerializeQueueItem[]): Promise<void> => {
      while (queue.length > 0) {
        const batch = queue.splice(0, SERIALIZE_CHUNK);
        for (const { node, depth, parentArr } of batch) {
          if (depth < 0) continue;
          const ser = serializeNodeShallow(node);
          parentArr.push(ser);
          // Must use depth > 0 (not > 1): otherwise nodes at depth 1 never enqueue their children → false empty frames in audit JSON.
          if ('children' in node && Array.isArray((node as ChildrenMixin).children) && depth > 0) {
            const kids = (node as ChildrenMixin).children as BaseNode[];
            for (const c of kids) queue.push({ node: c, depth: depth - 1, parentArr: ser.children });
          }
        }
        if (queue.length > 0) await yieldToMain();
      }
    };

    if (scope === 'current' && opts.nodeIds?.length) {
      const children: any[] = [];
      const queue: SerializeQueueItem[] = [];
      for (const id of opts.nodeIds) {
        const node = await figma.getNodeByIdAsync(id);
        if (node && 'id' in node) queue.push({ node: node as BaseNode, depth: MAX_SERIALIZE_DEPTH, parentArr: children });
      }
      await processQueue(queue);
      return { document: { id: 'selection', name: 'Current Selection', type: 'CANVAS', children } };
    }

    if (scope === 'page' && opts.pageId) {
      const page = await figma.getNodeByIdAsync(opts.pageId) as PageNode | null;
      if (page && page.type === 'PAGE') {
        const children: any[] = [];
        const queue: SerializeQueueItem[] = [{ node: page as BaseNode, depth: MAX_SERIALIZE_DEPTH, parentArr: children }];
        await processQueue(queue);
        const doc = { id: page.id, name: page.name, type: 'CANVAS' as const, children };
        return { document: doc };
      }
    }

    const root = figma.root;
    const docChildren: any[] = [];
    const queue: SerializeQueueItem[] = [];
    for (const page of root.children) queue.push({ node: page as BaseNode, depth: MAX_SERIALIZE_DEPTH, parentArr: docChildren });
    await processQueue(queue);
    return { document: { id: root.id, name: root.name, type: root.type, children: docChildren } };
  }

  function buildFileContextSync(scope: string | undefined, pageId: string | undefined): Omit<any, 'fileJson'> {
    let pageIdOut: string | undefined;
    let nodeIds: string[] | undefined;
    if (scope === 'page' && pageId) pageIdOut = pageId;
    else if (scope === 'current') {
      const sel = figma.currentPage.selection;
      nodeIds = sel.map((n: BaseNode) => n.id);
    }
    const fileKey = (figma as any).fileKey ?? null;
    const fileName = typeof figma.root?.name === 'string' ? figma.root.name : null;
    return {
      fileKey,
      fileName,
      scope: scope ?? 'all',
      pageId: pageIdOut ?? null,
      nodeIds: nodeIds ?? null,
    };
  }

  /** Extra fields for Code → Target generation (layout + text). */
  function augmentCodeGenNode(node: BaseNode, out: any): void {
    if (node.type === 'TEXT') {
      const tn = node as TextNode;
      try {
        const t = tn.characters;
        if (typeof t === 'string' && t.length > 0) {
          out.characters = t.length > 400 ? `${t.slice(0, 400)}…` : t;
        }
      } catch (_) {
        /* ignore */
      }
    }
    if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
      const f = node as FrameNode;
      if (f.layoutMode && f.layoutMode !== 'NONE') {
        out.layout = {
          mode: f.layoutMode,
          primaryAxisAlignItems: f.primaryAxisAlignItems,
          counterAxisAlignItems: f.counterAxisAlignItems,
          itemSpacing: typeof f.itemSpacing === 'number' ? f.itemSpacing : undefined,
          paddingTop: f.paddingTop,
          paddingRight: f.paddingRight,
          paddingBottom: f.paddingBottom,
          paddingLeft: f.paddingLeft,
        };
      }
    }
  }

  const CODE_GEN_MAX_DEPTH = 12;
  const CODE_GEN_MAX_NODES = 350;
  type CodeGenQueueItem = { node: BaseNode; depth: number; parentSer: any };

  async function buildCodeGenSubtreeFromSelection(): Promise<{ root?: any; error?: string; fileKey: string | null }> {
    await figma.loadAllPagesAsync();
    const sel = figma.currentPage.selection;
    const fileKey = ((figma as any).fileKey ?? null) as string | null;
    if (!sel.length) return { error: 'No layer selected', fileKey };
    const first = sel[0] as BaseNode;
    const rootSer = serializeNodeShallow(first);
    augmentCodeGenNode(first, rootSer);
    let nodeCount = 1;
    const queue: CodeGenQueueItem[] = [];
    if ('children' in first && CODE_GEN_MAX_DEPTH > 1) {
      const kids = (first as ChildrenMixin).children as BaseNode[];
      for (const c of kids) queue.push({ node: c, depth: CODE_GEN_MAX_DEPTH - 1, parentSer: rootSer });
    }
    while (queue.length > 0 && nodeCount < CODE_GEN_MAX_NODES) {
      const batch = queue.splice(0, SERIALIZE_CHUNK);
      for (const { node, depth, parentSer } of batch) {
        if (nodeCount >= CODE_GEN_MAX_NODES) break;
        if (depth < 0) continue;
        const ser = serializeNodeShallow(node);
        augmentCodeGenNode(node, ser);
        parentSer.children.push(ser);
        nodeCount++;
        if (depth > 0 && 'children' in node && nodeCount < CODE_GEN_MAX_NODES) {
          const kids = (node as ChildrenMixin).children as BaseNode[];
          for (const c of kids) queue.push({ node: c, depth: depth - 1, parentSer: ser });
        }
      }
      if (queue.length > 0) await yieldToMain();
    }
    if (queue.length > 0) {
      rootSer._meta = {
        ...(rootSer._meta && typeof rootSer._meta === 'object' ? rootSer._meta : {}),
        truncated: true,
        reason: 'node_cap',
        nodeCount,
        maxNodes: CODE_GEN_MAX_NODES,
      };
    }
    return { root: rootSer, fileKey };
  }

  if (msg.type === 'get-code-gen-subtree') {
    (async () => {
      try {
        const built = await buildCodeGenSubtreeFromSelection();
        if (built.error) {
          figma.ui.postMessage({ type: 'code-gen-subtree-result', error: built.error, fileKey: built.fileKey });
          return;
        }
        if (!built.root) {
          figma.ui.postMessage({ type: 'code-gen-subtree-result', error: 'Empty selection', fileKey: built.fileKey });
          return;
        }
        const payload = JSON.stringify(built.root);
        const LIMIT = 900000;
        if (payload.length > LIMIT) {
          figma.ui.postMessage({
            type: 'code-gen-subtree-result',
            error: 'Selection too large to send; select a smaller frame or component.',
            fileKey: built.fileKey,
          });
          return;
        }
        figma.ui.postMessage({ type: 'code-gen-subtree-result', root: built.root, fileKey: built.fileKey });
      } catch (e) {
        console.error('[get-code-gen-subtree]', e);
        figma.ui.postMessage({ type: 'code-gen-subtree-result', error: String(e) });
      }
    })();
    return;
  }

  // File context: for "current" selection we send fileJson from plugin (no token needed). For all/page we send identifiers and backend fetches via REST API (requires fileKey).
  if (msg.type === 'get-file-context') {
    const scope = msg.scope as 'all' | 'current' | 'page' | undefined;
    const pageId = msg.pageId;
    const POST_MESSAGE_SIZE_LIMIT = 1.4e6;
    const CHUNK_SIZE = 1e6;
    (async () => {
      try {
        const base = buildFileContextSync(scope, pageId);
        let selectionType: string = 'Page';
        let selectionName: string = '';
        if (scope === 'current' && base.nodeIds?.length) {
          const first = await figma.getNodeByIdAsync(base.nodeIds[0]);
          if (first) {
            selectionName = first.name || 'Selection';
            const t = first.type;
            selectionType = t === 'FRAME' ? 'Frame' : t === 'COMPONENT' ? 'Component' : t === 'INSTANCE' ? 'Instance' : t === 'GROUP' ? 'Group' : t === 'SECTION' ? 'Section' : t === 'PAGE' ? 'Page' : 'Selection';
          }
        }

        if (scope === 'current') {
          const fileJson = await buildDocumentJsonAsync({ scope: 'current', nodeIds: base.nodeIds ?? undefined });
          const jsonString = JSON.stringify(fileJson);
          if (jsonString.length > POST_MESSAGE_SIZE_LIMIT) {
            const totalChunks = Math.ceil(jsonString.length / CHUNK_SIZE);
            figma.ui.postMessage({ type: 'file-context-chunked-start', ...base, selectionType, selectionName, totalChunks });
            for (let i = 0; i < totalChunks; i++) {
              figma.ui.postMessage({ type: 'file-context-chunk', index: i, chunk: jsonString.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE) });
            }
          } else {
            figma.ui.postMessage({ type: 'file-context-result', ...base, fileJson, selectionType, selectionName });
          }
          return;
        }

        if (!base.fileKey) {
          figma.ui.postMessage({ type: 'file-context-result', ...base, error: 'FILE_LINK_UNAVAILABLE' });
          return;
        }
        if (scope === 'all') {
          await figma.loadAllPagesAsync();
          const pageIds = figma.root.children.map((p: PageNode) => p.id);
          figma.ui.postMessage({ type: 'file-context-result', ...base, pageIds, selectionType, selectionName });
        } else {
          figma.ui.postMessage({ type: 'file-context-result', ...base, selectionType, selectionName });
        }
      } catch (e) {
        console.error('[get-file-context]', e);
        figma.ui.postMessage({ type: 'file-context-result', fileKey: null, scope: scope ?? 'all', pageId: null, nodeIds: null, error: String(e) });
      }
    })();
  }

  if (msg.type === 'get-ds-import-meta') {
    const requestId = String(msg.requestId || '');
    const fileKey = String(msg.fileKey || '').trim();
    const map = await readDsImportMetaMap();
    figma.ui.postMessage({
      type: 'ds-import-meta-result',
      requestId,
      fileKey,
      meta: fileKey ? map[fileKey] ?? null : null,
    });
    return;
  }

  if (msg.type === 'set-ds-import-meta') {
    const requestId = String(msg.requestId || '');
    const payload = msg.payload && typeof msg.payload === 'object' ? msg.payload : {};
    const row: DsImportMetaRow = {
      fileKey: String((payload as { fileKey?: unknown }).fileKey || '').trim(),
      importedAt: String((payload as { importedAt?: unknown }).importedAt || new Date().toISOString()),
      dsCacheHash: String((payload as { dsCacheHash?: unknown }).dsCacheHash || ''),
      componentCount: Number((payload as { componentCount?: unknown }).componentCount || 0),
      tokenCount: Number((payload as { tokenCount?: unknown }).tokenCount || 0),
      name: String((payload as { name?: unknown }).name || ''),
    };
    if (!row.fileKey) {
      figma.ui.postMessage({ type: 'ds-import-meta-set-result', requestId, ok: false, error: 'fileKey required' });
      return;
    }
    try {
      await writeDsImportMetaRow(row);
      figma.ui.postMessage({ type: 'ds-import-meta-set-result', requestId, ok: true });
    } catch (e) {
      figma.ui.postMessage({
        type: 'ds-import-meta-set-result',
        requestId,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    return;
  }

  // Count nodes: batch traversal with yield between batches only. Fast; UI stays responsive.
  // Same scope+pageId reuses cached count so DS / A11Y / (future UX, Prototype) don't wait again.
  // background: true = silent pre-warm after login; fill cache only, no result to UI.
  if (msg.type === 'count-nodes') {
    const scope = msg.scope as 'all' | 'current' | 'page';
    const pageId = scope === 'page' ? msg.pageId : undefined;
    const isBackground = msg.background === true;
    const useCache = !isBackground && scope !== 'current' && nodeCountCache && nodeCountCache.scope === scope && nodeCountCache.pageId === pageId;
    if (useCache && nodeCountCache) {
      figma.ui.postMessage({
        type: 'count-nodes-result',
        count: nodeCountCache.count,
        target: nodeCountCache.target,
        fromCache: true,
      });
      return;
    }

    const rawCap = msg.countCap;
    const countCap = (rawCap === undefined || rawCap === null || Number(rawCap) <= 0 || !Number.isFinite(Number(rawCap)))
      ? Infinity
      : Math.max(1, Number(rawCap));
    let target = '';
    const yieldTick = () => new Promise<void>(r => setTimeout(r, 0));
    const BATCH_SIZE = 6000;
    const PUSH_CHUNK = 4000;
    const INIT_PUSH_CHUNK = 4000;

    const stack: SceneNode[] = [];

    const pushChunk = (arr: readonly SceneNode[], fromIdx: number, toIdx: number) => {
      for (let i = toIdx; i >= fromIdx; i--) stack.push(arr[i]);
    };

    (async () => {
      let count = 0;
      try {
        await yieldTick();
        await figma.loadAllPagesAsync();
        if (!isBackground) figma.ui.postMessage({ type: 'count-nodes-progress', count: 0, percent: 1 });

        if (scope === 'current') {
          const sel = figma.currentPage.selection;
          target = sel.length > 0 ? 'Current Selection' : 'Current Selection (empty)';
          for (let i = sel.length - 1; i >= 0; i -= INIT_PUSH_CHUNK) {
            const start = Math.max(0, i - INIT_PUSH_CHUNK + 1);
            pushChunk(sel as readonly SceneNode[], start, i);
            if (start > 0) await yieldTick();
          }
        } else if (scope === 'page' && msg.pageId) {
          const page = (await figma.getNodeByIdAsync(msg.pageId)) as PageNode | null;
          if (page && page.type === 'PAGE') {
            target = page.name;
            await yieldTick();
            const ch = page.children as readonly SceneNode[];
            for (let i = ch.length - 1; i >= 0; i -= INIT_PUSH_CHUNK) {
              const start = Math.max(0, i - INIT_PUSH_CHUNK + 1);
              pushChunk(ch, start, i);
              if (start > 0) await yieldTick();
            }
          }
        } else {
          target = 'All Pages';
          for (const page of figma.root.children) {
            await yieldTick();
            const ch = page.children as readonly SceneNode[];
            for (let i = ch.length - 1; i >= 0; i -= INIT_PUSH_CHUNK) {
              const start = Math.max(0, i - INIT_PUSH_CHUNK + 1);
              pushChunk(ch, start, i);
              if (start > 0) await yieldTick();
            }
          }
        }

        let hitCap = false;
        const PROGRESS_STEP = 2000;
        let lastSentCount = 0;

        while (stack.length > 0 && count < countCap) {
          let processed = 0;
          while (stack.length > 0 && processed < BATCH_SIZE && count < countCap) {
            const node = stack.pop()!;
            count++;
            if ('children' in node && node.children) {
              const ch = node.children as readonly SceneNode[];
              if (ch.length <= PUSH_CHUNK) {
                for (let i = ch.length - 1; i >= 0; i--) stack.push(ch[i]);
              } else {
                for (let i = ch.length - 1; i >= 0; i -= PUSH_CHUNK) {
                  const start = Math.max(0, i - PUSH_CHUNK + 1);
                  for (let j = i; j >= start; j--) stack.push(ch[j]);
                  if (start > 0) await yieldTick();
                }
              }
            }
            processed++;
            if (!isBackground && countCap !== Infinity && count - lastSentCount >= PROGRESS_STEP) {
              lastSentCount = count;
              const pct = Math.min(100, Math.floor((count / countCap) * 100));
              figma.ui.postMessage({ type: 'count-nodes-progress', count, percent: pct });
            }
          }
          if (!isBackground) {
            if (countCap === Infinity) {
              const pct = Math.min(95, Math.floor(count / 5000));
              figma.ui.postMessage({ type: 'count-nodes-progress', count, percent: pct });
            } else if (count - lastSentCount > 0 || stack.length === 0 || count >= countCap) {
              lastSentCount = count;
              const pct = count >= countCap ? 100 : Math.min(100, Math.floor((count / countCap) * 100));
              figma.ui.postMessage({ type: 'count-nodes-progress', count, percent: pct });
            }
          }
          if (stack.length > 0 && count < countCap) await yieldTick();
        }

        if (countCap !== Infinity && count >= countCap) hitCap = true;
        const resultCount = hitCap ? countCap : count;
        const resultTarget = hitCap ? `${target} (${countCap.toLocaleString()}+ nodes)` : target;
        if (scope !== 'current') {
          nodeCountCache = { scope, pageId: scope === 'page' ? msg.pageId : undefined, count: resultCount, target: resultTarget };
        }
        if (isBackground) {
          figma.ui.postMessage({ type: 'count-nodes-background-done' });
        } else {
          figma.ui.postMessage({ type: 'count-nodes-progress', count: resultCount, percent: 100 });
          figma.ui.postMessage({ type: 'count-nodes-result', count: resultCount, target: resultTarget, fromCache: false });
        }
      } catch (e: any) {
        const errMsg = String(e?.message || e);
        if (!isBackground) figma.notify(`Count failed at ${count} nodes: ${errMsg}`, { error: true });
        figma.ui.postMessage({
          type: 'count-nodes-error',
          error: errMsg,
          count
        });
      }
    })();
  }

  if (msg.type === 'select-layer') {
    const layerId = typeof msg.layerId === 'string' ? msg.layerId : '';
    if (layerId.trim()) {
      let ok = false;
      try {
        ok = await selectLayerAndReveal(layerId);
      } catch (e) {
        console.error('[select-layer]', e);
        ok = false;
      }
      figma.ui.postMessage({
        type: 'select-layer-result',
        layerId,
        ok,
      });
      if (!ok) {
        figma.notify(
          'Could not select that layer — the file may have changed since the audit, or the layer was removed.',
          { error: true },
        );
      }
    } else {
      figma.notify('No layer ID for this issue.', { error: true });
      figma.ui.postMessage({ type: 'select-layer-result', layerId: '', ok: false });
    }
  }

  if (msg.type === 'switch-to-page') {
    const pageId = msg.pageId as string | undefined;
    if (pageId) {
      const page = (await figma.getNodeByIdAsync(pageId)) as PageNode | null;
      if (page && page.type === 'PAGE') {
        try {
          await figma.setCurrentPageAsync(page);
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          figma.notify(`Could not switch page: ${errMsg}`, { error: true });
        }
      }
    }
  }

  if (msg.type === 'get-contrast-fix-preview') {
    const layerId = msg.layerId;
    if (layerId) {
      try {
        const preview = await getContrastFixPreview(layerId);
        figma.ui.postMessage({ type: 'contrast-fix-preview', layerId, preview });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        figma.ui.postMessage({ type: 'contrast-fix-preview', layerId, preview: null, error: errMsg });
      }
    }
  }

  if (msg.type === 'get-touch-fix-preview') {
    const layerId = msg.layerId as string | undefined;
    const rawMin = Number((msg as { targetMin?: number }).targetMin);
    const targetMin = Number.isFinite(rawMin) ? Math.max(24, Math.min(120, Math.floor(rawMin))) : 24;
    if (layerId) {
      try {
        const preview = await getTouchFixPreview(layerId, targetMin);
        figma.ui.postMessage({ type: 'touch-fix-preview', layerId, preview });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        figma.ui.postMessage({ type: 'touch-fix-preview', layerId, preview: null, error: errMsg });
      }
    }
  }

  if (msg.type === 'apply-fix') {
    const layerId = msg.layerId;
    const categoryId = msg.categoryId;
    const fixPreview = msg.fixPreview;

    if (categoryId === 'contrast' && fixPreview && (fixPreview.source === 'variable' || fixPreview.source === 'style' || fixPreview.source === 'hardcoded')) {
      const ok = await applyContrastFix(layerId, {
        source: fixPreview.source,
        variableId: fixPreview.variableId,
        styleId: fixPreview.styleId,
        r: fixPreview.r,
        g: fixPreview.g,
        b: fixPreview.b
      });
      if (ok) {
        const node = await figma.getNodeByIdAsync(layerId);
        figma.notify("Contrast fix applied — " + (node ? node.name : 'layer'));
        await selectLayerAndReveal(layerId);
      } else {
        figma.notify("Could not apply contrast fix", { error: true });
      }
      return;
    }

    if (categoryId === 'touch' && fixPreview && (fixPreview.source === 'variable' || fixPreview.source === 'hardcoded' || fixPreview.source === 'resize')) {
      const touchPayload = fixPreview as {
        source: 'variable' | 'hardcoded' | 'resize';
        applyLayerId: string;
        variableId?: string;
        paddingDelta?: number;
        newWidth?: number;
        newHeight?: number;
      };
      const applyId = touchPayload.applyLayerId || layerId;
      const ok = await applyTouchFix({ ...touchPayload, applyLayerId: applyId });
      if (ok) {
        const node = await figma.getNodeByIdAsync(applyId);
        figma.notify('Touch target fix applied — ' + (node ? node.name : 'layer'));
        await selectLayerAndReveal(applyId);
      } else {
        figma.notify('Could not apply touch target fix', { error: true });
      }
      return;
    }

    const node = await figma.getNodeByIdAsync(layerId);
    if (node && 'fills' in node) {
      figma.notify("Fix applied to " + node.name);
      await selectLayerAndReveal(layerId);
    } else {
      figma.notify("Layer not found", { error: true });
    }
  }

  if (msg.type === 'undo-fix') {
    const node = await figma.getNodeByIdAsync(msg.layerId);
    if (node) {
      figma.notify("Changes reverted");
      // Logic to revert specific properties would go here
      await selectLayerAndReveal(msg.layerId);
    }
  }

  // Design tokens: read Figma Variables and send serialized payload for CSS/JSON generation (Comtra ruleset)
  if (msg.type === 'get-design-tokens') {
    (async () => {
      try {
        const fileKey = (figma as any).fileKey ?? null;
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        const payload: {
          fileKey: string | null;
          collections: Array<{
            id: string;
            name: string;
            defaultModeId: string;
            modes: Array<{ modeId: string; name: string }>;
          }>;
          variables: Array<{
            id: string;
            name: string;
            description: string;
            variableCollectionId: string;
            resolvedType: string;
            valuesByMode: Record<string, unknown>;
            codeSyntax?: Record<string, string>;
            hiddenFromPublishing?: boolean;
          }>;
        } = {
          fileKey,
          collections: [],
          variables: []
        };

        for (const coll of collections) {
          payload.collections.push({
            id: coll.id,
            name: coll.name,
            defaultModeId: coll.defaultModeId,
            modes: coll.modes.map(m => ({ modeId: m.modeId, name: m.name }))
          });
          for (const variableId of coll.variableIds) {
            const variable = await figma.variables.getVariableByIdAsync(variableId);
            if (!variable) continue;
            const valuesByMode: Record<string, unknown> = {};
            for (const [modeId, val] of Object.entries(variable.valuesByMode)) {
              if (val === undefined) continue;
              if (typeof val === 'object' && val !== null && 'type' in val && (val as { type: string }).type === 'VARIABLE_ALIAS') {
                valuesByMode[modeId] = { type: 'VARIABLE_ALIAS', id: (val as { id: string }).id };
              } else if (typeof val === 'object' && val !== null && 'r' in val) {
                const c = val as { r: number; g: number; b: number; a?: number };
                valuesByMode[modeId] = { r: c.r, g: c.g, b: c.b, a: c.a };
              } else {
                valuesByMode[modeId] = val;
              }
            }
            payload.variables.push({
              id: variable.id,
              name: variable.name,
              description: variable.description ?? '',
              variableCollectionId: variable.variableCollectionId,
              resolvedType: variable.resolvedType,
              valuesByMode,
              codeSyntax: variable.codeSyntax ? { ...variable.codeSyntax } : undefined,
              hiddenFromPublishing: variable.hiddenFromPublishing
            });
          }
        }

        figma.ui.postMessage({ type: 'design-tokens-result', payload });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        figma.ui.postMessage({ type: 'design-tokens-error', error: errMsg });
      }
    })();
  }
};

figma.on('currentpagechange', () => {
  postFlowStartingPointsToUi();
  postSelectionToUi();
});

figma.on('selectionchange', () => {
  postSelectionToUi();
});