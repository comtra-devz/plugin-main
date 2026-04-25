import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPEC_RESOLVER_PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'generate-spec-resolver.md');

function compactComponentOverview(dsContextIndex, max = 160) {
  const components = Array.isArray(dsContextIndex?.components) ? dsContextIndex.components : [];
  return components.slice(0, max).map((c) => ({
    name: String(c?.name || ''),
    pageName: String(c?.pageName || ''),
    type: String(c?.type || ''),
    variantAxes: Array.isArray(c?.variantAxes) ? c.variantAxes.slice(0, 6) : undefined,
    slotHints: Array.isArray(c?.slotHints) ? c.slotHints.slice(0, 6) : undefined,
  }));
}

function compactTokenOverview(dsContextIndex, max = 120) {
  const variableNames = Array.isArray(dsContextIndex?.variable_names) ? dsContextIndex.variable_names : [];
  return {
    token_categories:
      dsContextIndex?.token_categories && typeof dsContextIndex.token_categories === 'object'
        ? dsContextIndex.token_categories
        : {},
    variable_names: variableNames.slice(0, max).map((x) => String(x || '')).filter(Boolean),
  };
}

function normalizeSlot(raw, fallbackIndex, requiredDefault) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = String(raw.id || raw.slot_id || raw.label || `slot_${fallbackIndex}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!id) return null;
  const terms = Array.isArray(raw.component_search_terms)
    ? raw.component_search_terms
    : Array.isArray(raw.search_terms)
      ? raw.search_terms
      : Array.isArray(raw.hints)
        ? raw.hints
        : [];
  return {
    id,
    label: String(raw.label || raw.name || id).trim() || id,
    kind: String(raw.kind || 'generic').trim() || 'generic',
    required: typeof raw.required === 'boolean' ? raw.required : requiredDefault,
    component_search_terms: terms.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 12),
  };
}

export function normalizeGenerationSpec(rawSpec) {
  if (!rawSpec || typeof rawSpec !== 'object' || Array.isArray(rawSpec)) return null;
  const required = Array.isArray(rawSpec.required_slots) ? rawSpec.required_slots : [];
  const optional = Array.isArray(rawSpec.optional_slots) ? rawSpec.optional_slots : [];
  const requiredSlots = required.map((s, i) => normalizeSlot(s, i, true)).filter(Boolean);
  const optionalSlots = optional.map((s, i) => normalizeSlot(s, i, false)).filter(Boolean);
  const archetypeId = String(rawSpec.archetype_id || rawSpec.archetype || rawSpec.type || 'custom_pattern')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const searchTerms = Array.isArray(rawSpec.ds_search_terms)
    ? rawSpec.ds_search_terms
    : Array.isArray(rawSpec.search_terms)
      ? rawSpec.search_terms
      : [];
  return {
    version: 'generation_spec_v1',
    confidence: Math.max(0, Math.min(1, Number(rawSpec.confidence) || 0)),
    archetype_id: archetypeId || 'custom_pattern',
    archetype_label: String(rawSpec.archetype_label || rawSpec.label || archetypeId || 'Custom pattern').trim(),
    surface: String(rawSpec.surface || 'screen').trim(),
    complexity: String(rawSpec.complexity || 'standard').trim(),
    layout_intent: String(rawSpec.layout_intent || rawSpec.intent || '').trim(),
    required_slots: requiredSlots.slice(0, 12),
    optional_slots: optionalSlots.slice(0, 12),
    layout_rules: Array.isArray(rawSpec.layout_rules)
      ? rawSpec.layout_rules.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 12)
      : [],
    negative_constraints: Array.isArray(rawSpec.negative_constraints)
      ? rawSpec.negative_constraints.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 12)
      : [],
    ds_search_terms: searchTerms.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 32),
    content_defaults:
      rawSpec.content_defaults && typeof rawSpec.content_defaults === 'object' && !Array.isArray(rawSpec.content_defaults)
        ? rawSpec.content_defaults
        : {},
  };
}

export function generationSpecToPromptBlock(spec) {
  if (!spec || typeof spec !== 'object') return '';
  return ['', '[GENERATION_SPEC — Kimi-resolved pattern contract]', JSON.stringify(spec), '[END GENERATION_SPEC]'].join('\n');
}

export function generationSpecSearchText(spec) {
  if (!spec || typeof spec !== 'object') return '';
  const slotTerms = [...(spec.required_slots || []), ...(spec.optional_slots || [])]
    .flatMap((slot) => [slot.id, slot.label, slot.kind, ...(slot.component_search_terms || [])])
    .filter(Boolean);
  return [
    spec.archetype_id,
    spec.archetype_label,
    spec.surface,
    spec.layout_intent,
    ...(spec.ds_search_terms || []),
    ...slotTerms,
  ]
    .filter(Boolean)
    .join(' ');
}

export async function runGenerationSpecResolver({
  callKimi,
  extractJsonFromContent,
  userPrompt,
  inferredScreenArchetype,
  packV2ArchetypeId,
  dsContextIndex,
  patternsPayload,
}) {
  let systemPrompt;
  try {
    systemPrompt = readFileSync(SPEC_RESOLVER_PROMPT_PATH, 'utf8');
    if (!String(systemPrompt || '').trim()) throw new Error('empty');
  } catch (e) {
    throw new Error(`generation-spec-resolver prompt: ${e?.message || e}`);
  }

  const overview = {
    deterministic_inference: {
      legacy_screen_archetype: inferredScreenArchetype || null,
      pack_v2_archetype: packV2ArchetypeId || null,
    },
    ds_overview: {
      fileName: String(dsContextIndex?.fileName || ''),
      total_components_in_file: Number(dsContextIndex?.total_components_in_file || 0) || undefined,
      components: compactComponentOverview(dsContextIndex),
      tokens: compactTokenOverview(dsContextIndex),
    },
    known_pattern_keys: patternsPayload?.screen_checklists ? Object.keys(patternsPayload.screen_checklists).slice(0, 80) : [],
  };

  const user = [
    `User request:\n${String(userPrompt || '').trim()}`,
    '',
    'Context overview:',
    JSON.stringify(overview),
    '',
    'Return only the generation_spec JSON object.',
  ].join('\n');

  const { content, usage } = await callKimi([{ role: 'system', content: systemPrompt }, { role: 'user', content: user }], 2200);
  const parsed = extractJsonFromContent(content);
  return {
    spec: normalizeGenerationSpec(parsed),
    usage: {
      input: Math.max(0, Number(usage?.input_tokens ?? usage?.prompt_tokens ?? 0)),
      output: Math.max(0, Number(usage?.output_tokens ?? usage?.completion_tokens ?? 0)),
    },
  };
}
