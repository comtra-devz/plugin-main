import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DS_PACKAGES_ROOT = path.join(__dirname, '..', 'ds_packages');

const DS_ALIASES = new Map([
  ['material design 3', 'material3'],
  ['material 3', 'material3'],
  ['m3', 'material3'],
  ['material3', 'material3'],
  ['material', 'material3'],
  ['antd', 'ant'],
  ['ant design', 'ant'],
  ['ant', 'ant'],
  ['carbon', 'carbon'],
  ['bootstrap', 'bootstrap5'],
  ['bootstrap 5', 'bootstrap5'],
  ['salesforce lightning', 'sls'],
  ['lightning', 'sls'],
  ['base web', 'baseweb'],
  ['uber base web', 'baseweb'],
  ['ios', 'ios-hig'],
  ['ios hig', 'ios-hig'],
]);

function normalizeDsSource(dsSource) {
  return String(dsSource || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function mapDsSourceToId(dsSource) {
  const normalized = normalizeDsSource(dsSource);
  if (!normalized || normalized === 'custom' || normalized === 'current file') {
    return null;
  }
  return DS_ALIASES.get(normalized) || normalized.replace(/[^a-z0-9-]/g, '');
}

/** True when the request uses file-scoped / custom DS (no bundled ds_package id). */
export function isCustomDsSource(dsSource) {
  return mapDsSourceToId(dsSource) == null;
}

function collectTokenPaths(obj, prefix = '') {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const out = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    const next = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, 'value')) {
      out.push(next);
      continue;
    }
    out.push(...collectTokenPaths(value, next));
  }
  return out;
}

function collectComponentIds(componentsJson) {
  const node = componentsJson?.components;
  if (!node || typeof node !== 'object') return [];
  return Object.keys(node);
}

function collectScaffoldComponentIds(componentsJson) {
  const components = componentsJson?.components;
  if (!components || typeof components !== 'object') return [];
  return Object.entries(components)
    .filter(([, c]) =>
      Array.isArray(c?.constraints) &&
      c.constraints.some((x) => x?.rule === 'm3-scaffold-needs-refinement')
    )
    .map(([id]) => id);
}

function createTokenAliasSet(tokenPaths) {
  const set = new Set();
  for (const raw of tokenPaths || []) {
    const p = String(raw || '').toLowerCase().trim();
    if (!p) continue;
    set.add(p);
    set.add(p.replace(/\./g, '/'));
  }
  return set;
}

export function loadDsPackage(dsSource) {
  const dsId = mapDsSourceToId(dsSource);
  if (!dsId) return null;

  const dsDir = path.join(DS_PACKAGES_ROOT, dsId);
  try {
    const manifest = JSON.parse(readFileSync(path.join(dsDir, 'manifest.json'), 'utf8'));
    const tokens = JSON.parse(readFileSync(path.join(dsDir, manifest?.files?.tokens || 'tokens.json'), 'utf8'));
    const rules = JSON.parse(readFileSync(path.join(dsDir, manifest?.files?.rules || 'rules.json'), 'utf8'));
    const components = JSON.parse(readFileSync(path.join(dsDir, manifest?.files?.components || 'components.json'), 'utf8'));
    let conformance = null;
    try {
      conformance = JSON.parse(readFileSync(path.join(dsDir, 'conformance-report.json'), 'utf8'));
    } catch {}
    const tokenPaths = collectTokenPaths(tokens);
    const componentIds = collectComponentIds(components);
    const scaffoldComponentIds = collectScaffoldComponentIds(components);
    return {
      ds_id: dsId,
      manifest,
      tokens,
      rules,
      components,
      conformance,
      tokenPaths,
      componentIds,
      scaffoldComponentIds,
      tokenAliasSet: createTokenAliasSet(tokenPaths),
    };
  } catch (err) {
    console.warn('[ds_loader] package not available', { dsId, reason: err?.message || String(err) });
    return null;
  }
}

function compactList(list, maxItems = 60) {
  if (!Array.isArray(list) || list.length === 0) return 'none';
  if (list.length <= maxItems) return list.join(', ');
  return `${list.slice(0, maxItems).join(', ')} ... (+${list.length - maxItems} more)`;
}

function getByPath(source, path) {
  return String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), source);
}

function matchWhen(condition, ctx) {
  if (!condition || typeof condition !== 'object') return true;
  return Object.entries(condition).every(([k, v]) => {
    const cv = getByPath(ctx, k);
    if (Array.isArray(v)) return v.includes(cv);
    return cv === v;
  });
}

function filterObjectByWhen(node, ctx) {
  if (Array.isArray(node)) {
    return node
      .filter((item) => !item?.applies_when || matchWhen(item.applies_when, ctx))
      .map((item) => filterObjectByWhen(item, ctx));
  }
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'applies_when') continue;
    if (v && typeof v === 'object' && v.applies_when && !matchWhen(v.applies_when, ctx)) {
      continue;
    }
    out[k] = filterObjectByWhen(v, ctx);
  }
  return out;
}

export function resolveContextProfile(input = {}) {
  const platform = ['web', 'android', 'ios'].includes(String(input.platform || '').toLowerCase())
    ? String(input.platform).toLowerCase()
    : 'web';
  const density = ['compact', 'default', 'comfortable'].includes(String(input.density || '').toLowerCase())
    ? String(input.density).toLowerCase()
    : 'default';
  const inputMode = ['create', 'modify', 'screenshot', 'reference'].includes(String(input.input_mode || '').toLowerCase())
    ? String(input.input_mode).toLowerCase()
    : 'create';
  const selectionType = String(input.selection_type || 'none').toLowerCase();
  return { platform, density, input_mode: inputMode, selection_type: selectionType };
}

export function buildDsContextForPrompt(dsPackage, contextProfile = null) {
  if (!dsPackage) return '';
  const ruleGroups = Object.entries(dsPackage.rules || {})
    .filter(([k, v]) => !k.startsWith('$') && Array.isArray(v))
    .map(([group, items]) => `${group}: ${items.length}`);
  return [
    'Resolved DS package (authoritative):',
    `- ds_id: ${dsPackage.ds_id}`,
    `- name: ${dsPackage.manifest?.ds_name || dsPackage.ds_id}`,
    `- version: ${dsPackage.manifest?.version || 'n/a'}`,
    `- supported themes: ${(dsPackage.manifest?.supported_themes || []).join(', ') || 'n/a'}`,
    contextProfile ? `- context profile: platform=${contextProfile.platform}, density=${contextProfile.density}, input_mode=${contextProfile.input_mode}, selection_type=${contextProfile.selection_type}` : '- context profile: not provided',
    `- token refs available: ${compactList(dsPackage.tokenPaths, 100)}`,
    `- component ids available: ${compactList(dsPackage.componentIds, 50)}`,
    `- rulesets: ${ruleGroups.join(' | ') || 'none'}`,
    dsPackage?.conformance?.summary
      ? `- conformance summary: components_ok=${Boolean(dsPackage.conformance.summary.components_ok)}, rules_ok=${Boolean(dsPackage.conformance.summary.rule_ok)}, token_ok=${Boolean(dsPackage.conformance.summary.token_ok)}`
      : '- conformance summary: not available',
    `- scaffold components to avoid unless needed: ${compactList(dsPackage.scaffoldComponentIds || [], 30)}`,
    'Hard constraints:',
    '- Use ONLY token/component references listed above when assigning style/component semantics.',
    '- Never invent DS token paths or component ids.',
    '- If a needed UI primitive is missing, build with neutral layout tokens and note it in metadata.notes.',
  ].join('\n');
}

export function resolveDsPackageForContext(dsPackage, contextProfile = null) {
  if (!dsPackage || !contextProfile) return dsPackage;
  return {
    ...dsPackage,
    rules: filterObjectByWhen(dsPackage.rules, contextProfile),
    components: filterObjectByWhen(dsPackage.components, contextProfile),
  };
}

function walk(value, fn) {
  if (Array.isArray(value)) {
    value.forEach((v) => walk(v, fn));
    return;
  }
  if (!value || typeof value !== 'object') return;
  fn(value);
  for (const child of Object.values(value)) walk(child, fn);
}

function extractStringRefsFromActionPlan(actionPlan) {
  const tokenRefs = new Set();
  const componentRefs = new Set();
  const tokenLike = /\b(?:color|typography|spacing|borderradius|elevation|border|breakpoints|opacity|motion)[./][a-z0-9./-]+\b/gi;

  walk(actionPlan, (obj) => {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v !== 'string') continue;
      const key = k.toLowerCase();
      if (key.includes('component') || key === 'kind' || key === 'component_id') {
        const normalized = v.trim().toLowerCase();
        if (normalized) componentRefs.add(normalized);
      }
      const matches = v.match(tokenLike);
      if (matches) matches.forEach((m) => tokenRefs.add(m.toLowerCase()));
    }
  });
  return { tokenRefs: [...tokenRefs], componentRefs: [...componentRefs] };
}

function likelyComponentRef(name) {
  return name.includes('-') || name.includes('/');
}

function normalizeTokenRef(tokenRef) {
  return String(tokenRef || '')
    .trim()
    .toLowerCase()
    .replace(/@.+$/, '')
    .replace(/\//g, '.');
}

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

const ALLOWED_MODES = new Set(['create', 'modify', 'screenshot', 'reference']);
const ALLOWED_LAYOUT = new Set(['NONE', 'HORIZONTAL', 'VERTICAL']);
const ALLOWED_ACTION_TYPES = new Set([
  'CREATE_FRAME',
  'CREATE_GROUP',
  'CREATE_TEXT',
  'CREATE_RECT',
  'CREATE_ELLIPSE',
  'SET_LAYOUT',
  'SET_STYLE',
  'INSTANCE_COMPONENT',
  'ADD_CHILD',
  'SET_CONSTRAINTS',
]);

export function validateActionPlanSchema(actionPlan) {
  const errors = [];
  const warnings = [];

  if (!isPlainObject(actionPlan)) {
    return { valid: false, errors: ['Action plan must be a JSON object'], warnings };
  }
  if (String(actionPlan.version || '').trim() !== '1.0') {
    errors.push('version must be "1.0".');
  }
  if (!isPlainObject(actionPlan.metadata)) {
    errors.push('metadata must be an object.');
  } else {
    if (!String(actionPlan.metadata.prompt || '').trim()) errors.push('metadata.prompt is required.');
    if (!ALLOWED_MODES.has(String(actionPlan.metadata.mode || '').trim())) {
      errors.push('metadata.mode must be one of create|modify|screenshot|reference.');
    }
    if (!Number.isFinite(Number(actionPlan.metadata.estimated_credits ?? NaN))) {
      warnings.push('metadata.estimated_credits is missing or invalid.');
    }
  }

  if (!isPlainObject(actionPlan.frame)) {
    errors.push('frame must be an object.');
  } else {
    if (!String(actionPlan.frame.name || '').trim()) errors.push('frame.name is required.');
    if (!Number.isFinite(Number(actionPlan.frame.width))) errors.push('frame.width must be numeric.');
    if (!Number.isFinite(Number(actionPlan.frame.height))) errors.push('frame.height must be numeric.');
    const layout = String(actionPlan.frame.layoutMode || '').trim();
    if (layout && !ALLOWED_LAYOUT.has(layout)) warnings.push(`frame.layoutMode "${layout}" is unusual.`);
  }

  if (!Array.isArray(actionPlan.actions) || actionPlan.actions.length === 0) {
    errors.push('actions must be a non-empty array.');
  } else {
    let hasCreateFrame = false;
    actionPlan.actions.forEach((a, idx) => {
      if (!isPlainObject(a)) {
        errors.push(`actions[${idx}] must be an object.`);
        return;
      }
      const t = String(a.type || '').trim();
      if (!t) errors.push(`actions[${idx}].type is required.`);
      if (t === 'CREATE_FRAME') hasCreateFrame = true;
      if (t && !ALLOWED_ACTION_TYPES.has(t)) warnings.push(`actions[${idx}].type "${t}" is not in allowed list.`);
    });
    if (!hasCreateFrame && String(actionPlan.metadata?.mode || '') === 'create') {
      errors.push('create mode requires at least one CREATE_FRAME action.');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * create/screenshot: reject empty structural shells (only nested frames, no leaves).
 * Counts any CREATE_TEXT, CREATE_RECT, or INSTANCE_COMPONENT at any depth (parentId any ref or root).
 * Public DS still cannot emit INSTANCE_COMPONENT (separate gate); custom DS may be instance-first.
 */
export function validateActionPlanVisiblePrimitives(actionPlan) {
  if (!actionPlan || typeof actionPlan !== 'object') {
    return { valid: true, errors: [] };
  }
  const genMode = String(actionPlan.metadata?.mode || '').trim();
  if (genMode !== 'create' && genMode !== 'screenshot') {
    return { valid: true, errors: [] };
  }
  const actions = Array.isArray(actionPlan.actions) ? actionPlan.actions : [];
  for (let i = 0; i < actions.length; i++) {
    const da = actions[i];
    if (!da || typeof da !== 'object') continue;
    const t = String(da.type || '').trim();
    if (t === 'CREATE_TEXT' || t === 'CREATE_RECT' || t === 'INSTANCE_COMPONENT') {
      return { valid: true, errors: [] };
    }
  }
  return {
    valid: false,
    errors: [
      'VISIBLE_CONTENT_REQUIRED: create/screenshot mode requires at least one CREATE_TEXT, CREATE_RECT, or INSTANCE_COMPONENT action (any parentId). Pure CREATE_FRAME-only trees are not allowed.',
    ],
  };
}

/** Bundled public DS packages: no INSTANCE_COMPONENT (frames / text / rects + tokens only). */
export function validateActionPlanNoInstanceForPublicDs(actionPlan, dsSource) {
  if (isCustomDsSource(dsSource)) {
    return { valid: true, errors: [] };
  }
  if (!actionPlan || typeof actionPlan !== 'object') {
    return { valid: true, errors: [] };
  }
  const actions = Array.isArray(actionPlan.actions) ? actionPlan.actions : [];
  const errors = [];
  for (let i = 0; i < actions.length; i++) {
    const da = actions[i];
    if (!da || typeof da !== 'object') continue;
    if (String(da.type || '').trim() === 'INSTANCE_COMPONENT') {
      errors.push(
        `PUBLIC_DS_NO_INSTANCE: actions[${i}] INSTANCE_COMPONENT is not allowed for public DS packages; use CREATE_FRAME / CREATE_TEXT / CREATE_RECT with DS tokens only (ds_source is not custom).`,
      );
    }
  }
  return { valid: errors.length === 0, errors };
}

const FIGMA_NODE_ID_RE = /^\d+:\d+$/;

function normalizeFileVarRef(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Alias set for variable names: slash/dot variants. */
function buildFileVariableAliasSet(variableNames) {
  const set = new Set();
  for (const raw of variableNames || []) {
    const n = normalizeFileVarRef(raw);
    if (!n) continue;
    set.add(n);
    set.add(n.replace(/\//g, '.'));
    set.add(n.replace(/\./g, '/'));
  }
  return set;
}

function extractExplicitVariableRefsFromActionPlan(actionPlan) {
  const refs = new Set();
  walk(actionPlan, (obj) => {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v !== 'string') continue;
      if (String(k).toLowerCase() === 'variable' && v.trim()) refs.add(v.trim());
    }
  });
  return [...refs];
}

function semanticComponentKeyMatchesIndex(key, components) {
  const k = String(key || '').trim().toLowerCase();
  if (!k) return false;
  for (const c of components) {
    const ck = String(c?.componentKey || c?.component_key || '').trim().toLowerCase();
    if (ck && ck === k) return true;
    const cid = String(c?.id || '').trim().toLowerCase();
    if (cid && cid === k) return true;
    const name = String(c?.name || '').trim();
    if (!name) continue;
    const nl = name.toLowerCase();
    if (nl === k) return true;
    const last = nl.split('/').pop().trim();
    if (last === k) return true;
  }
  return false;
}

/**
 * Fase 4 — governance su indice file dal plugin (`ds_context_index`).
 * Se l’indice non c’è o non ha dati utili → skipped (valid: true).
 * Con `components_truncated` non si validano id componente (falsi negativi); restano variabili se elencate.
 */
export function validateActionPlanAgainstFileDsIndex(actionPlan, dsContextIndex) {
  const emptyUsed = { componentNodeIds: [], componentKeys: [], variableRefs: [] };
  if (!actionPlan || typeof actionPlan !== 'object') {
    return { valid: true, skipped: true, errors: [], warnings: [], used: emptyUsed };
  }
  if (!dsContextIndex || typeof dsContextIndex !== 'object') {
    return { valid: true, skipped: true, errors: [], warnings: [], used: emptyUsed };
  }

  const components = Array.isArray(dsContextIndex.components) ? dsContextIndex.components : [];
  const variableNames = Array.isArray(dsContextIndex.variable_names) ? dsContextIndex.variable_names : [];
  const truncatedComponents = Boolean(dsContextIndex.components_truncated);

  if (components.length === 0 && variableNames.length === 0) {
    return {
      valid: true,
      skipped: true,
      errors: [],
      warnings: ['ds_context_index has no components or variable_names — file index checks skipped.'],
      used: emptyUsed,
    };
  }

  const errors = [];
  const warnings = [];
  const usedComponentNodeIds = [];
  const usedComponentKeys = [];
  const usedVariableRefs = [];

  const allowedIds = new Set(components.map((c) => (c && c.id ? String(c.id) : '')).filter(Boolean));
  const allowedComponentKeys = new Set(
    components
      .map((c) => (c && (c.componentKey || c.component_key) ? String(c.componentKey || c.component_key).toLowerCase() : ''))
      .filter(Boolean),
  );

  if (truncatedComponents && components.length > 0) {
    warnings.push(
      'DS CONTEXT INDEX has components_truncated=true; INSTANCE_COMPONENT is not validated against the partial component list.',
    );
  }

  const actions = Array.isArray(actionPlan.actions) ? actionPlan.actions : [];
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    if (!a || typeof a !== 'object') continue;
    if (String(a.type || '').trim() !== 'INSTANCE_COMPONENT') continue;

    const nodeId = String(a.component_node_id || a.componentNodeId || '').trim();
    const key = String(a.component_key || a.componentKey || a.component_id || '').trim();

    let figmaId = '';
    if (FIGMA_NODE_ID_RE.test(nodeId)) figmaId = nodeId;
    else if (FIGMA_NODE_ID_RE.test(key)) figmaId = key;

    if (!truncatedComponents) {
      if (figmaId) {
        usedComponentNodeIds.push(figmaId);
        if (!allowedIds.has(figmaId)) {
          errors.push(
            `actions[${i}] INSTANCE_COMPONENT: unknown Figma component id "${figmaId}" (not in DS CONTEXT INDEX).`,
          );
        }
      } else if (key) {
        const keyLower = key.toLowerCase();
        if (/^[a-z0-9_-]{20,}$/i.test(key)) usedComponentKeys.push(key);
        if (!allowedComponentKeys.has(keyLower) && !semanticComponentKeyMatchesIndex(key, components)) {
          errors.push(
            `actions[${i}] INSTANCE_COMPONENT: unknown component reference "${key}" (no matching key/id/name in index).`,
          );
        }
      } else {
        warnings.push(`actions[${i}] INSTANCE_COMPONENT: empty reference — plugin may insert a placeholder.`);
      }
    } else if (figmaId && allowedIds.has(figmaId)) {
      usedComponentNodeIds.push(figmaId);
    } else if (key && allowedComponentKeys.has(key.toLowerCase())) {
      usedComponentKeys.push(key);
    }
  }

  const varAliasSet = buildFileVariableAliasSet(variableNames);
  const varRefs = extractExplicitVariableRefsFromActionPlan(actionPlan);
  const truncatedVars = Boolean(dsContextIndex.variable_names_truncated);

  let warnedVarTruncate = false;
  for (const r of varRefs) {
    usedVariableRefs.push(r);
    if (varAliasSet.size === 0) continue;
    const nr = normalizeFileVarRef(r);
    const candidates = [nr, nr.replace(/\//g, '.'), nr.replace(/\./g, '/')];
    const ok = candidates.some((c) => varAliasSet.has(c));
    if (!ok) {
      if (truncatedVars) {
        if (!warnedVarTruncate) {
          warnings.push(
            'Some variable references could not be verified against a truncated variable_names list in DS CONTEXT INDEX.',
          );
          warnedVarTruncate = true;
        }
      } else {
        errors.push(`Unknown variable reference "${r}" (not in file variable_names / DS CONTEXT INDEX).`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    skipped: false,
    errors,
    warnings,
    used: { componentNodeIds: usedComponentNodeIds, componentKeys: usedComponentKeys, variableRefs: usedVariableRefs },
  };
}

export function validateActionPlanAgainstDs(actionPlan, dsPackage) {
  if (!dsPackage || !actionPlan || typeof actionPlan !== 'object') {
    return { valid: true, errors: [], warnings: [], used: { tokenRefs: [], componentRefs: [] } };
  }

  const allowedTokens = dsPackage.tokenAliasSet || new Set((dsPackage.tokenPaths || []).map((t) => t.toLowerCase()));
  const allowedComponents = new Set((dsPackage.componentIds || []).map((c) => c.toLowerCase()));
  const scaffoldComponents = new Set((dsPackage.scaffoldComponentIds || []).map((c) => c.toLowerCase()));
  const { tokenRefs, componentRefs } = extractStringRefsFromActionPlan(actionPlan);

  const missingTokens = tokenRefs
    .map((t) => ({ raw: t, normalized: normalizeTokenRef(t) }))
    .filter((t) => !allowedTokens.has(t.raw) && !allowedTokens.has(t.normalized))
    .map((t) => t.raw);
  const missingComponents = componentRefs.filter((c) => likelyComponentRef(c) && !allowedComponents.has(c));

  const warnings = [];
  if (tokenRefs.length === 0) warnings.push('No DS token references found in action plan.');
  if (componentRefs.length === 0) warnings.push('No DS component references found in action plan.');
  const scaffoldUsed = componentRefs.filter((c) => scaffoldComponents.has(c));
  if (scaffoldUsed.length) {
    warnings.push(`Scaffold components used (refine preferred): ${scaffoldUsed.slice(0, 20).join(', ')}`);
  }

  const errors = [];
  if (missingTokens.length) errors.push(`Unknown DS tokens: ${missingTokens.slice(0, 20).join(', ')}`);
  if (missingComponents.length) errors.push(`Unknown DS components: ${missingComponents.slice(0, 20).join(', ')}`);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    used: { tokenRefs, componentRefs },
  };
}
