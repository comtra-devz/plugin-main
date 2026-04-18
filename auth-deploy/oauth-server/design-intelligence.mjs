/**
 * Design Intelligence: optional patterns in the generate prompt.
 * Supports schema 7.1 (`principles`, `screen_checklists`, …) and pack v2
 * (`archetype_registry`, `archetype_inference_rules`, `layout_patterns`, …).
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATTERNS_PATH = path.join(__dirname, '..', 'design-intelligence', 'patterns.default.json');

/** Chiavi valide in `screen_checklists` (patterns 7.1). */
export const SCREEN_ARCHETYPE_KEYS = new Set([
  'login',
  'list',
  'form',
  'empty_state',
  'settings',
  'dashboard',
  'detail',
  'error',
]);

/** Archetipo pack v2 → chiave checklist 7.1 / slot blueprint legacy. */
export const PACK_V2_TO_LEGACY_SCREEN = Object.freeze({
  login: 'login',
  register: 'login',
  forgot_password: 'login',
  onboarding_step: 'login',
  email_verification: 'login',
  pin_biometric: 'login',
  home_dashboard: 'dashboard',
  bottom_nav_shell: 'dashboard',
  sidebar_shell: 'dashboard',
  tab_bar_shell: 'dashboard',
  list_feed: 'list',
  search_results: 'list',
  notification_center: 'list',
  detail_view: 'detail',
  article_reader: 'detail',
  product_detail: 'detail',
  media_gallery: 'list',
  empty_state: 'empty_state',
  form_single: 'form',
  form_multi_step: 'form',
  checkout_cart: 'form',
  confirmation_screen: 'form',
  settings_panel: 'settings',
  error_screen: 'error',
  profile_view: 'detail',
  chat_messaging: 'list',
  map_view: 'dashboard',
});

export function mapPackV2ArchetypeToLegacyScreenKey(v2Id) {
  if (!v2Id || typeof v2Id !== 'string') return null;
  const k = PACK_V2_TO_LEGACY_SCREEN[v2Id];
  return k && SCREEN_ARCHETYPE_KEYS.has(k) ? k : null;
}

export function isPackV2Shape(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const ver = payload.meta && typeof payload.meta === 'object' ? String(payload.meta.pack_version || '') : '';
  if (ver.startsWith('2')) return true;
  if (payload.archetype_registry && typeof payload.archetype_registry === 'object') return true;
  if (payload.archetype_inference_rules && typeof payload.archetype_inference_rules === 'object') return true;
  if (Array.isArray(payload.layout_patterns) && payload.layout_patterns.length) {
    const p0 = payload.layout_patterns[0];
    if (p0 && typeof p0 === 'object' && Array.isArray(p0.segments)) return true;
  }
  return false;
}

function normalizePromptForInference(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Due fasi come in DESIGN-INTELLIGENCE-PACK-v2 §3: strong keywords (per inference_priority),
 * poi keywords_context. Rispetta keywords_negative.
 * @returns {{ id: string, phase: 'strong' | 'context', score: number } | null}
 */
export function inferPackV2ArchetypeId(prompt, payload) {
  const rules = payload?.archetype_inference_rules;
  if (!rules || typeof rules !== 'object') return null;
  const registry =
    payload?.archetype_registry && typeof payload.archetype_registry === 'object' ? payload.archetype_registry : {};
  const norm = normalizePromptForInference(prompt);
  if (!norm) return null;

  const ids = Object.keys(rules).filter((id) => rules[id] && typeof rules[id] === 'object');
  const negVeto = (id) => {
    const neg = rules[id].keywords_negative;
    if (!Array.isArray(neg)) return false;
    return neg.some((phrase) => phrase && norm.includes(String(phrase).toLowerCase()));
  };

  const sorted = [...ids].sort((a, b) => {
    const pa = Number(rules[a].inference_priority);
    const pb = Number(rules[b].inference_priority);
    const sa = Number.isFinite(pa) ? pa : 99;
    const sb = Number.isFinite(pb) ? pb : 99;
    return sa - sb;
  });

  for (const id of sorted) {
    if (negVeto(id)) continue;
    const strong = rules[id].keywords_strong;
    if (!Array.isArray(strong)) continue;
    if (strong.some((kw) => kw && norm.includes(String(kw).toLowerCase()))) {
      const boost = Number(registry[id]?.inference_confidence_boost);
      const b = Number.isFinite(boost) && boost > 0 ? boost : 1;
      return { id, phase: 'strong', score: 1 * b };
    }
  }

  let bestId = null;
  let bestScore = 0;
  let bestPriority = 999;
  for (const id of sorted) {
    if (negVeto(id)) continue;
    const ctx = rules[id].keywords_context;
    if (!Array.isArray(ctx)) continue;
    let s = 0;
    for (const group of ctx) {
      if (!Array.isArray(group)) continue;
      if (group.every((term) => term && norm.includes(String(term).toLowerCase()))) s += 2;
    }
    if (s <= 0) continue;
    const boost = Number(registry[id]?.inference_confidence_boost);
    const b = Number.isFinite(boost) && boost > 0 ? boost : 1;
    const final = s * b;
    const pri = Number(rules[id].inference_priority);
    const p = Number.isFinite(pri) ? pri : 99;
    if (final > bestScore || (final === bestScore && p < bestPriority)) {
      bestScore = final;
      bestId = id;
      bestPriority = p;
    }
  }
  if (!bestId) return null;
  return { id: bestId, phase: 'context', score: bestScore };
}

/**
 * Euristica leggera (zero LLM): tipo schermata per contesto mirato e meno token nel prompt.
 * Ordine delle regole: prima le più specifiche.
 */
export function inferFocusedScreenType(prompt) {
  const t = String(prompt || '');
  if (!t.trim()) return null;
  const rules = [
    ['error', [/404\b/, /500\b/, /error page/i, /not found/i, /something went wrong/i, /pagina errore/i]],
    ['login', [/login/i, /sign[\s-]?in/i, /log[\s-]?in/i, /\baccedi\b/i, /forgot password/i, /password dimenticata/i]],
    [
      'dashboard',
      [/dashboard/i, /\bkpi\b/i, /\banalytics\b/i, /metric cards?/i, /overview/i, /riepilogo/i],
    ],
    ['settings', [/settings/i, /impostazioni/i, /preferences/i, /preferenze/i]],
    [
      'empty_state',
      [/empty state/i, /zero items/i, /no results/i, /nessun element/i, /lista vuota/i],
    ],
    ['form', [/checkout/i, /wizard/i, /multi[- ]?step/i, /\bform\b/i, /\bmodulo\b/i, /survey/i]],
    ['list', [/list view/i, /\blist\b/i, /\belenco\b/i, /catalog/i, /inventory/i]],
    ['detail', [/detail/i, /dettaglio/i, /product page/i, /scheda prodotto/i]],
  ];
  for (const [key, patterns] of rules) {
    if (patterns.some((re) => re.test(t))) return key;
  }
  return null;
}

/**
 * Preferisce inferenza da pack v2 se `archetype_inference_rules` è presente; altrimenti `inferFocusedScreenType`.
 */
export function inferFocusedScreenTypeWithPack(prompt, patternsPayload) {
  const p = patternsPayload;
  const v2 = inferPackV2ArchetypeId(prompt, p);
  if (v2?.id) {
    const legacy = mapPackV2ArchetypeToLegacyScreenKey(v2.id);
    if (legacy) return { legacyScreenKey: legacy, packV2ArchetypeId: v2.id };
  }
  return { legacyScreenKey: inferFocusedScreenType(prompt), packV2ArchetypeId: null };
}

export function loadPatternsPayload() {
  const override = process.env.COMTRA_PATTERNS_JSON_PATH;
  const filePath = override && existsSync(override) ? override : DEFAULT_PATTERNS_PATH;
  try {
    const raw = readFileSync(filePath, 'utf8');
    const j = JSON.parse(raw);
    return j && typeof j === 'object' ? j : null;
  } catch {
    return null;
  }
}

function truncateBlock(label, obj, maxLen) {
  try {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
    if (s.length <= maxLen) return `${label}\n${s}`;
    return `${label}\n${s.slice(0, maxLen - 32)}\n... [truncated ${s.length - maxLen + 32} chars]`;
  } catch {
    return '';
  }
}

function collectSlotIdsFromPack(payload, archetypeId) {
  const ids = new Set();
  const reg = payload?.archetype_registry?.[archetypeId];
  if (reg && typeof reg === 'object') {
    for (const x of reg.required_slots || []) ids.add(String(x));
    for (const x of reg.common_optional_slots || []) ids.add(String(x));
    for (const x of reg.repeatable_slots || []) ids.add(String(x));
  }
  const patterns = Array.isArray(payload.layout_patterns) ? payload.layout_patterns : [];
  for (const pat of patterns) {
    if (!pat || typeof pat !== 'object') continue;
    const matchArc =
      !archetypeId ||
      (Array.isArray(pat.archetypes) && pat.archetypes.includes(archetypeId)) ||
      pat.id === reg?.default_layout_pattern ||
      pat.id === reg?.default_layout_pattern_desktop;
    if (!matchArc && archetypeId) continue;
    for (const seg of pat.segments || []) {
      if (seg && seg.slot) ids.add(String(seg.slot));
    }
  }
  return [...ids];
}

function formatPackV2ForPrompt(payload, fileKey, options = {}) {
  const archetypeId = options.packV2ArchetypeId || null;
  const lines = [
    '',
    '[DESIGN INTELLIGENCE — pack v2]',
    'Soft guidance; obey [DS CONTEXT INDEX] and validation. Runtime prompt omits test_prompts (offline QA only).',
    `file_key (context): ${String(fileKey || '').trim() || 'n/a'}`,
  ];
  if (archetypeId) lines.push(`inferred_pack_v2_archetype: ${archetypeId}`);

  const meta = payload.meta && typeof payload.meta === 'object' ? payload.meta : {};
  const metaSlim = {
    pack_version: meta.pack_version,
    target_product: meta.target_product,
    language: meta.language,
    schema_compatibility: meta.schema_compatibility,
    notes_for_engineers: meta.notes_for_engineers,
  };
  lines.push('', truncateBlock('[PACK_META]', metaSlim, 1200));

  if (archetypeId && payload.archetype_registry?.[archetypeId]) {
    lines.push('', truncateBlock(`[ARCHETYPE_REGISTRY.${archetypeId}]`, payload.archetype_registry[archetypeId], 3500));
  }

  if (archetypeId && payload.archetype_inference_rules?.[archetypeId]) {
    lines.push(
      '',
      truncateBlock(`[ARCHETYPE_INFERENCE_RULES.${archetypeId}]`, payload.archetype_inference_rules[archetypeId], 2000),
    );
  }

  if (payload.disambiguation_protocol && typeof payload.disambiguation_protocol === 'object') {
    lines.push('', truncateBlock('[DISAMBIGUATION_PROTOCOL — CONV_UX]', payload.disambiguation_protocol, 2800));
  }

  if (payload.spacing_rhythm && typeof payload.spacing_rhythm === 'object') {
    lines.push('', truncateBlock('[SPACING_RHYTHM]', payload.spacing_rhythm, 4500));
  }

  if (payload.viewport_rules && typeof payload.viewport_rules === 'object') {
    lines.push('', truncateBlock('[VIEWPORT_RULES]', payload.viewport_rules, 2800));
  }

  if (Array.isArray(payload.layout_patterns) && payload.layout_patterns.length) {
    let pats = payload.layout_patterns;
    if (archetypeId) {
      const reg = payload.archetype_registry?.[archetypeId];
      const pref = [reg?.default_layout_pattern, reg?.default_layout_pattern_desktop].filter(Boolean);
      const filtered = pats.filter(
        (pat) =>
          pat &&
          (pref.includes(pat.id) ||
            (Array.isArray(pat.archetypes) && pat.archetypes.includes(archetypeId))),
      );
      if (filtered.length) pats = filtered;
      else pats = pats.slice(0, 4);
    } else {
      pats = pats.slice(0, 6);
    }
    lines.push('', truncateBlock('[LAYOUT_PATTERNS (subset)]', pats, 9000));
  }

  const slotIds = collectSlotIdsFromPack(payload, archetypeId);
  const defs = payload.slot_definitions && typeof payload.slot_definitions === 'object' ? payload.slot_definitions : {};
  const slotPick = {};
  for (const sid of slotIds.slice(0, 48)) {
    if (defs[sid]) slotPick[sid] = defs[sid];
  }
  if (Object.keys(slotPick).length) {
    lines.push('', truncateBlock('[SLOT_DEFINITIONS (relevant)]', slotPick, 12000));
  }

  if (Array.isArray(payload.component_property_playbook) && payload.component_property_playbook.length) {
    lines.push(
      '',
      truncateBlock(
        '[COMPONENT_PROPERTY_PLAYBOOK (subset)]',
        payload.component_property_playbook.slice(0, 28),
        10000,
      ),
    );
  }

  const cd = payload.content_defaults && typeof payload.content_defaults === 'object' ? payload.content_defaults : {};
  if (archetypeId && cd[archetypeId]) {
    lines.push('', truncateBlock(`[CONTENT_DEFAULTS.${archetypeId}]`, cd[archetypeId], 3500));
  } else if (Object.keys(cd).length) {
    const keys = archetypeId ? [archetypeId].filter((k) => cd[k]) : Object.keys(cd).slice(0, 3);
    const o = {};
    for (const k of keys) o[k] = cd[k];
    if (Object.keys(o).length) lines.push('', truncateBlock('[CONTENT_DEFAULTS (subset)]', o, 4000));
  }

  if (Array.isArray(payload.hierarchy_rules) && payload.hierarchy_rules.length) {
    lines.push('', truncateBlock('[HIERARCHY_RULES]', payload.hierarchy_rules, 6000));
  }

  const cv = payload.correction_vocabulary;
  if (Array.isArray(cv) && cv.length) {
    lines.push('', truncateBlock('[CORRECTION_VOCABULARY — v2 array form]', cv.slice(0, 40), 8000));
  }

  if (payload.wizard_integration && typeof payload.wizard_integration === 'object') {
    lines.push('', truncateBlock('[WIZARD_INTEGRATION]', payload.wizard_integration, 5000));
  }

  if (payload.learning_loop && typeof payload.learning_loop === 'object') {
    lines.push('', truncateBlock('[LEARNING_LOOP]', payload.learning_loop, 4000));
  }

  lines.push('', '[END DESIGN INTELLIGENCE — pack v2]');
  return lines.join('\n');
}

function appendScreenChecklistBlocks(lines, screens, onlyKey) {
  if (!screens || typeof screens !== 'object') return;
  const keys =
    onlyKey && screens[onlyKey] && typeof screens[onlyKey] === 'object'
      ? [[onlyKey, screens[onlyKey]]]
      : Object.entries(screens);
  if (!keys.length) return;
  lines.push('', '[SCREEN_CHECKLISTS]');
  for (const [key, sc] of keys) {
    if (!sc || typeof sc !== 'object') continue;
    lines.push(`## ${key}`);
    for (const field of ['must_have', 'should_have', 'avoid', 'layout_hint']) {
      const v = sc[field];
      if (field === 'layout_hint') {
        if (typeof v === 'string' && v.trim()) lines.push(`layout_hint: ${v.trim()}`);
        continue;
      }
      if (Array.isArray(v) && v.length) {
        lines.push(`${field}:`);
        for (const item of v) lines.push(`  - ${String(item)}`);
      }
    }
  }
}

function formatPatterns71(payload, fileKey, options = {}) {
  const focusKey =
    options.focusScreenType &&
    typeof options.focusScreenType === 'string' &&
    SCREEN_ARCHETYPE_KEYS.has(options.focusScreenType)
      ? options.focusScreenType
      : null;
  const compact = Boolean(focusKey);

  const lines = [
    '',
    '[DESIGN INTELLIGENCE — patterns 7.1]',
    'Soft guidance only; must still obey DS CONTEXT INDEX and validation rules.',
    `file_key (context): ${String(fileKey || '').trim() || 'n/a'}`,
  ];
  if (focusKey) {
    lines.push(
      `focused_screen_archetype: ${focusKey} — prioritize this structure; layout planner should include regions matching must_have where applicable.`,
    );
  }
  lines.push('', '[PRINCIPLES]');

  const principles = Array.isArray(payload.principles) ? payload.principles : [];
  for (const p of principles) {
    if (!p || typeof p !== 'object') continue;
    const id = String(p.id || '').trim();
    const sev = String(p.severity || '').trim();
    const stmt = String(p.statement || '').trim();
    const ver = String(p.verification || '').trim();
    if (compact && id) {
      lines.push(`- ${id}${sev ? ` (${sev})` : ''}: ${stmt}`);
      continue;
    }
    if (id) lines.push(`- ${id}${sev ? ` (${sev})` : ''}: ${stmt}`);
    if (ver) lines.push(`  verification: ${ver}`);
  }

  const screens = payload.screen_checklists && typeof payload.screen_checklists === 'object' ? payload.screen_checklists : null;
  appendScreenChecklistBlocks(lines, screens, focusKey);

  if (payload.ds_glossary && typeof payload.ds_glossary === 'object') {
    if (compact) {
      const g = payload.ds_glossary;
      const slim = {
        ...(g.roles && typeof g.roles === 'object' ? { roles: g.roles } : {}),
        ...(g.spacing_intent && typeof g.spacing_intent === 'object' ? { spacing_intent: g.spacing_intent } : {}),
        ...(typeof g.reading_order === 'string' ? { reading_order: g.reading_order } : {}),
      };
      if (Object.keys(slim).length) {
        lines.push('', '[DS_GLOSSARY]', JSON.stringify(slim, null, 2));
      }
    } else {
      lines.push('', '[DS_GLOSSARY]', JSON.stringify(payload.ds_glossary, null, 2));
    }
  }

  const recur = Array.isArray(payload.recurring_patterns) ? payload.recurring_patterns : [];
  if (recur.length) {
    lines.push('', '[RECURRING_PATTERNS]');
    for (const rp of recur) {
      if (rp && typeof rp === 'object') {
        if (compact) {
          const id = String(rp.id || '').trim();
          const desc = String(rp.description || '').trim();
          if (id) lines.push(`- ${id}: ${desc}`);
        } else lines.push(JSON.stringify(rp));
      }
    }
  }

  if (!compact) {
    const vocab = payload.correction_vocabulary;
    if (vocab && typeof vocab === 'object' && !Array.isArray(vocab) && Object.keys(vocab).length) {
      lines.push('', '[CORRECTION_VOCABULARY]', JSON.stringify(vocab, null, 2));
    }
    if (Array.isArray(vocab) && vocab.length) {
      lines.push('', '[CORRECTION_VOCABULARY]', JSON.stringify(vocab, null, 2));
    }
  }

  lines.push('', '[END DESIGN INTELLIGENCE — patterns 7.1]');
  return lines.join('\n');
}

/**
 * Blocco testo per contextBlob generate; stringa vuota se non c'è nulla da dire.
 * @param {string} fileKey
 * @param {{
 *   focusScreenType?: string | null,
 *   userPrompt?: string | null,
 *   patternsPayload?: object | null,
 *   packV2ArchetypeId?: string | null,
 * }} [options]
 */
export function formatDesignIntelligenceForPrompt(fileKey, options = {}) {
  const payload = options.patternsPayload != null ? options.patternsPayload : loadPatternsPayload();
  if (!payload || typeof payload !== 'object') return '';

  const packV2ArchetypeId =
    options.packV2ArchetypeId ||
    (options.userPrompt != null ? inferPackV2ArchetypeId(String(options.userPrompt), payload)?.id : null) ||
    null;

  const has71 =
    typeof payload.$schema === 'string' ||
    (Array.isArray(payload.principles) && payload.principles.length > 0) ||
    (payload.screen_checklists && typeof payload.screen_checklists === 'object' && Object.keys(payload.screen_checklists).length > 0) ||
    (payload.ds_glossary && typeof payload.ds_glossary === 'object') ||
    (Array.isArray(payload.recurring_patterns) && payload.recurring_patterns.length > 0) ||
    (payload.correction_vocabulary &&
      (typeof payload.correction_vocabulary === 'object' || Array.isArray(payload.correction_vocabulary)));

  const v2shape = isPackV2Shape(payload);

  const parts = [];
  if (has71) {
    parts.push(formatPatterns71(payload, fileKey, options));
  }
  if (v2shape) {
    parts.push(formatPackV2ForPrompt(payload, fileKey, { ...options, packV2ArchetypeId }));
  }

  if (!has71 && !v2shape) {
    const hints = Array.isArray(payload.layout_hints) ? payload.layout_hints : [];
    const cons = Array.isArray(payload.constraints) ? payload.constraints : [];
    const notes = Array.isArray(payload.notes) ? payload.notes : [];
    if (hints.length === 0 && cons.length === 0 && notes.length === 0) {
      return '';
    }
    return [
      '',
      '[DESIGN INTELLIGENCE — patterns]',
      'Soft guidance only; must still obey DS CONTEXT INDEX and validation rules.',
      `file_key (context): ${String(fileKey || '').trim() || 'n/a'}`,
      JSON.stringify(payload),
      '[END DESIGN INTELLIGENCE]',
    ].join('\n');
  }

  return parts.filter(Boolean).join('\n');
}

/**
 * [CONV_UX] Phase 2.6 — chips for preflight from pack (`disambiguation_protocol` or `screen_checklists`).
 * Returns null if pack has nothing usable (client keeps rule-based fallback).
 */
export function buildPreflightFromPack(patternsPayload, { legacyScreenKey, packV2ArchetypeId }) {
  const p = patternsPayload;
  if (!p || typeof p !== 'object') return null;

  let legacy =
    legacyScreenKey && SCREEN_ARCHETYPE_KEYS.has(String(legacyScreenKey))
      ? String(legacyScreenKey)
      : null;
  if (!legacy) {
    const mapped = mapPackV2ArchetypeToLegacyScreenKey(packV2ArchetypeId || null);
    legacy = mapped && SCREEN_ARCHETYPE_KEYS.has(mapped) ? mapped : null;
  }

  const dp = p.disambiguation_protocol;
  if (dp && typeof dp === 'object') {
    const gen = dp.low_confidence_generic;
    if (gen && typeof gen === 'object' && Array.isArray(gen.options) && gen.options.length > 0) {
      return {
        title:
          typeof gen.question === 'string' && gen.question.trim()
            ? gen.question.trim().slice(0, 240)
            : 'Dettaglio rapido prima di generare',
        chips: gen.options.slice(0, 10).map((o, i) => ({
          id: `pack-dp-${i}`,
          label: String(o).slice(0, 200),
        })),
        source: 'pack_disambiguation',
      };
    }
  }

  if (legacy && p.screen_checklists?.[legacy]?.must_have) {
    const mh = p.screen_checklists[legacy].must_have;
    if (Array.isArray(mh) && mh.length > 0) {
      return {
        title: `Elementi tipici (${legacy}, dal pack)`,
        chips: mh.slice(0, 8).map((t, i) => ({
          id: `pack-cl-${legacy}-${i}`,
          label: String(t).slice(0, 200),
        })),
        source: 'pack_checklist',
      };
    }
  }

  return null;
}
