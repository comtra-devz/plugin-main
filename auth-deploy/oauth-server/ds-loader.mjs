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
