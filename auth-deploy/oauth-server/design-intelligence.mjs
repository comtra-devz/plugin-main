/**
 * Fase 7 — Design Intelligence: patterns opzionali nel prompt di generate.
 * Per ora: JSON statico + override path env. Persistenza per-file (DB / KV) da aggiungere quando servirà.
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATTERNS_PATH = path.join(__dirname, '..', 'design-intelligence', 'patterns.default.json');

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

function formatPatterns71(payload, fileKey) {
  const lines = [
    '',
    '[DESIGN INTELLIGENCE — patterns 7.1]',
    'Soft guidance only; must still obey DS CONTEXT INDEX and validation rules.',
    `file_key (context): ${String(fileKey || '').trim() || 'n/a'}`,
    '',
    '[PRINCIPLES]',
  ];
  const principles = Array.isArray(payload.principles) ? payload.principles : [];
  for (const p of principles) {
    if (!p || typeof p !== 'object') continue;
    const id = String(p.id || '').trim();
    const sev = String(p.severity || '').trim();
    const stmt = String(p.statement || '').trim();
    const ver = String(p.verification || '').trim();
    if (id) lines.push(`- ${id}${sev ? ` (${sev})` : ''}: ${stmt}`);
    if (ver) lines.push(`  verification: ${ver}`);
  }

  const screens = payload.screen_checklists && typeof payload.screen_checklists === 'object' ? payload.screen_checklists : null;
  if (screens && Object.keys(screens).length) {
    lines.push('', '[SCREEN_CHECKLISTS]');
    for (const [key, sc] of Object.entries(screens)) {
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

  if (payload.ds_glossary && typeof payload.ds_glossary === 'object') {
    lines.push('', '[DS_GLOSSARY]', JSON.stringify(payload.ds_glossary, null, 2));
  }

  const recur = Array.isArray(payload.recurring_patterns) ? payload.recurring_patterns : [];
  if (recur.length) {
    lines.push('', '[RECURRING_PATTERNS]');
    for (const rp of recur) {
      if (rp && typeof rp === 'object') lines.push(JSON.stringify(rp));
    }
  }

  const vocab = payload.correction_vocabulary && typeof payload.correction_vocabulary === 'object' ? payload.correction_vocabulary : null;
  if (vocab && Object.keys(vocab).length) {
    lines.push('', '[CORRECTION_VOCABULARY]', JSON.stringify(vocab, null, 2));
  }

  lines.push('', '[END DESIGN INTELLIGENCE]');
  return lines.join('\n');
}

/** Blocco testo per contextBlob generate; stringa vuota se non c'è nulla da dire. */
export function formatDesignIntelligenceForPrompt(fileKey) {
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
    return formatPatterns71(payload, fileKey);
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
