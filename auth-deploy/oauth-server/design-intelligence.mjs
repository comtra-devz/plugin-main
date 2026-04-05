/**
 * Fase 7 — Design Intelligence: patterns opzionali nel prompt di generate.
 * Per ora: JSON statico + override path env. Persistenza per-file (DB / KV) da aggiungere quando servirà.
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
    const vocab = payload.correction_vocabulary && typeof payload.correction_vocabulary === 'object' ? payload.correction_vocabulary : null;
    if (vocab && Object.keys(vocab).length) {
      lines.push('', '[CORRECTION_VOCABULARY]', JSON.stringify(vocab, null, 2));
    }
  }

  lines.push('', '[END DESIGN INTELLIGENCE]');
  return lines.join('\n');
}

/**
 * Blocco testo per contextBlob generate; stringa vuota se non c'è nulla da dire.
 * @param {string} fileKey
 * @param {{ focusScreenType?: string | null }} [options] — se impostato (es. da inferenza prompt), contesto compatto: una checklist + glossary ridotto, senza correction_vocabulary.
 */
export function formatDesignIntelligenceForPrompt(fileKey, options = {}) {
  const payload = loadPatternsPayload();
  if (!payload || typeof payload !== 'object') return '';

  const has71 =
    typeof payload.$schema === 'string' ||
    (Array.isArray(payload.principles) && payload.principles.length > 0) ||
    (payload.screen_checklists && typeof payload.screen_checklists === 'object' && Object.keys(payload.screen_checklists).length > 0) ||
    (payload.ds_glossary && typeof payload.ds_glossary === 'object') ||
    (Array.isArray(payload.recurring_patterns) && payload.recurring_patterns.length > 0) ||
    (payload.correction_vocabulary && typeof payload.correction_vocabulary === 'object');

  if (has71) {
    return formatPatterns71(payload, fileKey, options);
  }

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
