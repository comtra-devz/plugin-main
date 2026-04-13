/**
 * Prompt-scoped retrieval over plugin DS context index.
 * Goal: keep model context slim while preserving relevant DS anchors.
 */

const STOPWORDS = new Set([
  'the','and','for','with','from','this','that','your','into','using','create','screen','layout','design',
  'component','components','token','tokens','style','styles','page','pages','file','current','custom','mobile',
  'desktop','responsive','make','build','add','remove','show','hide','new','edit','update','view','section',
]);

function tokenize(text) {
  const raw = String(text || '').toLowerCase();
  const parts = raw.split(/[^a-z0-9]+/g).filter(Boolean);
  return parts.filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function overlapScore(querySet, haystackTokens) {
  if (!haystackTokens.length) return 0;
  let hits = 0;
  for (const t of haystackTokens) if (querySet.has(t)) hits++;
  return hits;
}

function topByScore(items, scoreFn, k) {
  return items
    .map((item) => ({ item, score: scoreFn(item) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, k))
    .map((x) => x.item);
}

function normalizeComponent(c) {
  return {
    id: String(c?.id || ''),
    name: String(c?.name || ''),
    type: String(c?.type || ''),
    variantAxes: Array.isArray(c?.variantAxes) ? c.variantAxes.slice(0, 8) : undefined,
    propertyKeys: Array.isArray(c?.propertyKeys) ? c.propertyKeys.slice(0, 8) : undefined,
    slotHints: Array.isArray(c?.slotHints) ? c.slotHints.slice(0, 8) : undefined,
  };
}

function normalizeTokenName(v) {
  return String(v || '').trim();
}

export function buildDsSlimIndex(dsIndex, opts = {}) {
  if (!dsIndex || typeof dsIndex !== 'object') return null;
  const maxComponents = Number.isFinite(opts.maxComponents) ? opts.maxComponents : 120;
  const maxVars = Number.isFinite(opts.maxVariables) ? opts.maxVariables : 180;
  const components = Array.isArray(dsIndex.components) ? dsIndex.components : [];
  const variableNames = Array.isArray(dsIndex.variable_names) ? dsIndex.variable_names : [];
  return {
    version: dsIndex.version ?? 1,
    fileName: dsIndex.fileName || '',
    hash: dsIndex.hash || '',
    total_tokens: Number(dsIndex.total_tokens || 0),
    token_categories: dsIndex.token_categories && typeof dsIndex.token_categories === 'object' ? dsIndex.token_categories : {},
    modes: Array.isArray(dsIndex.modes) ? dsIndex.modes.slice(0, 24) : [],
    styles_summary: dsIndex.styles_summary && typeof dsIndex.styles_summary === 'object' ? dsIndex.styles_summary : undefined,
    components: components.slice(0, maxComponents).map(normalizeComponent),
    components_truncated:
      Boolean(dsIndex.components_truncated) || components.length > maxComponents || undefined,
    total_components_in_file: Number(dsIndex.total_components_in_file || components.length || 0) || undefined,
    variable_names: variableNames.slice(0, maxVars).map(normalizeTokenName),
    variable_names_truncated:
      Boolean(dsIndex.variable_names_truncated) || variableNames.length > maxVars || undefined,
  };
}

export function buildPromptScopedDsIndex(dsIndex, prompt, opts = {}) {
  if (!dsIndex || typeof dsIndex !== 'object') return null;
  const queryTokens = tokenize(prompt);
  const querySet = new Set(queryTokens);
  const components = Array.isArray(dsIndex.components) ? dsIndex.components : [];
  const variableNames = Array.isArray(dsIndex.variable_names) ? dsIndex.variable_names : [];
  const topKComponents = Number.isFinite(opts.topKComponents) ? opts.topKComponents : 32;
  const topKVariables = Number.isFinite(opts.topKVariables) ? opts.topKVariables : 48;

  const selectedComponents = topByScore(
    components,
    (c) => {
      const bag = [
        String(c?.name || ''),
        ...(Array.isArray(c?.variantAxes) ? c.variantAxes : []),
        ...(Array.isArray(c?.propertyKeys) ? c.propertyKeys : []),
        ...(Array.isArray(c?.slotHints) ? c.slotHints : []),
      ];
      return overlapScore(querySet, tokenize(bag.join(' ')));
    },
    topKComponents,
  );

  const selectedVars = topByScore(
    variableNames,
    (v) => overlapScore(querySet, tokenize(String(v || ''))),
    topKVariables,
  );

  const fallbackComponents = selectedComponents.length ? selectedComponents : components.slice(0, Math.min(24, components.length));
  const fallbackVars = selectedVars.length ? selectedVars : variableNames.slice(0, Math.min(32, variableNames.length));

  const scoped = {
    version: dsIndex.version ?? 1,
    fileName: dsIndex.fileName || '',
    hash: dsIndex.hash || '',
    total_tokens: Number(dsIndex.total_tokens || 0),
    token_categories: dsIndex.token_categories && typeof dsIndex.token_categories === 'object' ? dsIndex.token_categories : {},
    modes: Array.isArray(dsIndex.modes) ? dsIndex.modes.slice(0, 24) : [],
    styles_summary: dsIndex.styles_summary && typeof dsIndex.styles_summary === 'object' ? dsIndex.styles_summary : undefined,
    components: fallbackComponents.map(normalizeComponent),
    total_components_in_file: Number(dsIndex.total_components_in_file || components.length || 0) || undefined,
    components_retrieval: {
      selected: fallbackComponents.length,
      total: components.length,
      used_prompt_match: selectedComponents.length > 0,
    },
    variable_names: fallbackVars.map(normalizeTokenName),
    variable_names_retrieval: {
      selected: fallbackVars.length,
      total: variableNames.length,
      used_prompt_match: selectedVars.length > 0,
    },
  };
  if (components.length > fallbackComponents.length || dsIndex.components_truncated) scoped.components_truncated = true;
  if (variableNames.length > fallbackVars.length || dsIndex.variable_names_truncated) scoped.variable_names_truncated = true;
  return scoped;
}
