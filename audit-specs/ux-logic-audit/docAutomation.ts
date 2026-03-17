export type DocSourceType = 'article' | 'video' | 'book' | 'guideline' | 'linkedin_post' | 'spec' | 'other';

export type TargetRulesSection = 'UX Rules' | 'Accessibility Rules' | 'Escalation Rules' | 'Quality/Performance';

/** Singola risorsa nel Google Doc (link o riferimento bibliografico). */
export interface DocResource {
  id: string;
  title: string;
  url?: string;
  sourceType: DocSourceType;
  /** Categoria logica del documento (es. "Heuristic evaluation", "Dark patterns"). */
  category: string;
  /** Breve sintesi utile per le rules. */
  keyInsights: string;
  /** True se nuova, 'updated' se modificata rispetto allo snapshot precedente, false/undefined se già nota. */
  noveltyFlag?: boolean | 'updated';
  /** Per i post LinkedIn: testo del post, commenti di primo livello, ed eventuali link nei commenti. */
  linkedinMeta?: {
    postText: string;
    comments: Array<{
      author: string;
      text: string;
      urls: string[];
    }>;
  };
}

/** Categoria del Google Doc (blocco con titolo + elenco fonti). */
export interface DocCategory {
  id: string;
  /** Titolo così come appare nel doc. */
  title: string;
  /** Nome normalizzato per collegamento alle rules. */
  slug: string;
  resources: DocResource[];
}

/** Snapshot strutturato del documento, dopo il parsing. */
export interface ParsedDocSnapshot {
  fetchedAt: string;
  /** Hash globale del documento (es. sha256 del testo grezzo). */
  docHash: string;
  categories: DocCategory[];
}

/** Differenza tra due snapshot del doc, usata per ignorare contenuti già noti. */
export interface DocDiff {
  newCategories: DocCategory[];
  /** Stesse categorie ma con nuove risorse o risorse aggiornate. */
  updatedCategories: DocCategory[];
  /** Id delle categorie rimosse. */
  removedCategoryIds: string[];
}

/** Config minima per il parser (es. termini da ignorare). */
export interface ParserConfig {
  /** Termini decorativi da ignorare nel titolo o nel corpo (es. "Antigravity"). */
  ignoreTokens: string[];
}

/** Input logico per il parser (testo estratto o struttura già segmentata). */
export interface RawDocInput {
  /** Testo completo del doc, se disponibile. */
  fullText?: string;
  /**
   * Segmenti già separati per heading, se l’estrattore dal Google Doc li fornisce.
   * Ogni segmento rappresenta una sezione/categoria del documento.
   */
  sections?: Array<{
    heading: string;
    body: string;
  }>;
}

/**
 * Parser di alto livello: prende l’input grezzo dal Google Doc (testo o sezioni)
 * e lo converte in un ParsedDocSnapshot con categorie e risorse strutturate.
 *
 * La responsabilità di autenticarsi su Google e ottenere RawDocInput
 * sta fuori da questo modulo.
 */
export function parseGoogleDocToSnapshot(input: RawDocInput, config: ParserConfig): ParsedDocSnapshot {
  const now = new Date().toISOString();
  const baseText = input.fullText ?? input.sections?.map(s => `${s.heading}\n${s.body}`).join('\n\n') ?? '';
  const docHash = simpleHash(baseText);

  const sections = input.sections && input.sections.length > 0
    ? input.sections
    : fallbackSplitIntoSections(baseText);

  const categories: DocCategory[] = sections.map((section, index) => {
    const cleanedHeading = stripIgnoredTokens(section.heading, config.ignoreTokens);
    const slug = toSlug(cleanedHeading || `section-${index + 1}`);
    const resources = extractResourcesFromSection(section.body, cleanedHeading);
    return {
      id: slug,
      title: cleanedHeading || section.heading || `Section ${index + 1}`,
      slug,
      resources,
    };
  });

  return {
    fetchedAt: now,
    docHash,
    categories,
  };
}

/** Confronta due snapshot e restituisce solo le parti nuove/aggiornate. */
export function diffSnapshots(prev: ParsedDocSnapshot | null, next: ParsedDocSnapshot): DocDiff {
  if (!prev) {
    return {
      newCategories: next.categories,
      updatedCategories: [],
      removedCategoryIds: [],
    };
  }

  const prevById = new Map(prev.categories.map(c => [c.id, c]));
  const nextById = new Map(next.categories.map(c => [c.id, c]));

  const newCategories: DocCategory[] = [];
  const updatedCategories: DocCategory[] = [];
  const removedCategoryIds: string[] = [];

  for (const cat of next.categories) {
    const prevCat = prevById.get(cat.id);
    if (!prevCat) {
      newCategories.push(markResourcesNovelty(cat, 'new'));
      continue;
    }
    const updated = diffCategory(prevCat, cat);
    if (updated) {
      updatedCategories.push(updated);
    }
  }

  for (const prevCat of prev.categories) {
    if (!nextById.has(prevCat.id)) {
      removedCategoryIds.push(prevCat.id);
    }
  }

  return { newCategories, updatedCategories, removedCategoryIds };
}

function diffCategory(prev: DocCategory, next: DocCategory): DocCategory | null {
  const prevByKey = new Map(prev.resources.map(r => [resourceKey(r), r]));
  const nextByKey = new Map(next.resources.map(r => [resourceKey(r), r]));

  const changedResources: DocResource[] = [];

  for (const res of next.resources) {
    const key = resourceKey(res);
    const prevRes = prevByKey.get(key);
    if (!prevRes) {
      changedResources.push({ ...res, noveltyFlag: true });
      continue;
    }
    if (res.keyInsights !== prevRes.keyInsights) {
      changedResources.push({ ...res, noveltyFlag: 'updated' });
    }
  }

  if (changedResources.length === 0) return null;

  return {
    ...next,
    resources: changedResources,
  };
}

function markResourcesNovelty(cat: DocCategory, _kind: 'new'): DocCategory {
  return {
    ...cat,
    resources: cat.resources.map(r => ({ ...r, noveltyFlag: true })),
  };
}

function resourceKey(r: DocResource): string {
  // Usa URL se presente, altrimenti titolo+categoria come chiave stabile.
  if (r.url) return r.url.toLowerCase();
  return `${r.category.toLowerCase()}::${r.title.toLowerCase()}`;
}

function stripIgnoredTokens(text: string, ignoreTokens: string[]): string {
  if (!text) return text;
  let out = text;
  for (const token of ignoreTokens) {
    if (!token) continue;
    const re = new RegExp(`\\b${escapeRegExp(token)}\\b`, 'gi');
    out = out.replace(re, '').trim();
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

function fallbackSplitIntoSections(text: string): RawDocInput['sections'] {
  if (!text.trim()) return [];
  const lines = text.split('\n');
  const sections: { heading: string; body: string }[] = [];
  let currentHeading = 'Untitled';
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    sections.push({ heading: currentHeading, body: buffer.join('\n').trim() });
    buffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (/^#{1,6}\s+/.test(line)) {
      flush();
      currentHeading = line.replace(/^#{1,6}\s+/, '').trim();
      continue;
    }
    if (/^\S.*:$/g.test(line)) {
      flush();
      currentHeading = line.replace(/:$/, '').trim();
      continue;
    }
    buffer.push(raw);
  }
  flush();
  return sections;
}

function extractResourcesFromSection(body: string, heading: string): DocResource[] {
  const lines = body.split('\n');
  const resources: DocResource[] = [];
  let index = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (!/^[-*•]\s+/.test(line)) continue;

    const content = line.replace(/^[-*•]\s+/, '').trim();
    const urlMatch = content.match(/\bhttps?:\/\/\S+/i);
    const url = urlMatch ? urlMatch[0].replace(/[),.]+$/, '') : undefined;
    const title = content.replace(/\bhttps?:\/\/\S+/i, '').trim() || content;
    const sourceType = classifySourceType(url, heading, content);

    resources.push({
      id: `res-${++index}`,
      title,
      url,
      sourceType,
      category: heading,
      keyInsights: '', // compilato dal motore di analisi UX, non dal parser puro
    });
  }

  return resources;
}

function classifySourceType(url: string | undefined, heading: string, content: string): DocSourceType {
  if (url && /linkedin\.com/i.test(url)) return 'linkedin_post';
  if (/heuristic|guideline|guidelines|design system|pattern/i.test(heading) || /heuristic|guideline/i.test(content)) {
    return 'guideline';
  }
  if (/material design|human interface|design system/i.test(content)) return 'spec';
  if (/youtube\.com|vimeo\.com/i.test(content)) return 'video';
  return 'article';
}

function simpleHash(text: string): string {
  let hash = 0;
  if (!text) return '0';
  for (let i = 0; i < text.length; i++) {
    const chr = text.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return String(hash >>> 0);
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Sezione delle rules interessata da una proposta di miglioria. */
export interface RulesTarget {
  section: TargetRulesSection;
  /** Sottocategoria opzionale (es. "Forms", "Data tables"). */
  subSection?: string;
}

export interface ImprovementProposal {
  id: string;
  /** Categoria di origine nel doc. */
  categoryId: string;
  /** Mapping verso la sezione rules del plugin. */
  target: RulesTarget;
  summary: string;
  /** Elenco di risorse che supportano la proposta. */
  sources: DocResource[];
  /** Score 0–100; più alto = più urgente/importante. */
  priorityScore: number;
  /** Dimensione approssimativa dello sforzo di implementazione. */
  effort: 'low' | 'medium' | 'high';
  /** Stato della copertura test attuale. */
  testCoverage: 'covered' | 'partial' | 'missing' | 'not_applicable';
  /** Note sui rischi o sugli impatti. */
  riskNotes?: string;
}

export interface PriorityInput {
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  evidenceCount: number;
  novelty: 'new' | 'updated' | 'known';
  projectFocus?: 'accessibility' | 'ux' | 'escalation' | 'general';
  targetSection: TargetRulesSection;
}

/** Calcola uno score 0–100 basato su impatto, sforzo, evidenze e focus progetto. */
export function computePriorityScore(input: PriorityInput): number {
  const impactWeight = weightFromLevel(input.impact);
  const effortPenalty = effortPenaltyFromLevel(input.effort);
  const evidenceBoost = Math.min(3, input.evidenceCount) * 0.1;
  const noveltyBoost = input.novelty === 'new' ? 0.15 : input.novelty === 'updated' ? 0.08 : 0;
  const focusBoost = focusMultiplier(input.projectFocus, input.targetSection);

  const base = 50 * impactWeight * focusBoost;
  const adjusted = base * (1 - effortPenalty) * (1 + evidenceBoost + noveltyBoost);
  return Math.max(0, Math.min(100, Math.round(adjusted)));
}

function weightFromLevel(level: 'low' | 'medium' | 'high'): number {
  if (level === 'high') return 2;
  if (level === 'medium') return 1;
  return 0.5;
}

function effortPenaltyFromLevel(level: 'low' | 'medium' | 'high'): number {
  if (level === 'high') return 0.35;
  if (level === 'medium') return 0.18;
  return 0.05;
}

function focusMultiplier(focus: PriorityInput['projectFocus'], section: TargetRulesSection): number {
  if (!focus || focus === 'general') return 1;
  if (focus === 'accessibility' && section === 'Accessibility Rules') return 1.3;
  if (focus === 'ux' && section === 'UX Rules') return 1.25;
  if (focus === 'escalation' && section === 'Escalation Rules') return 1.25;
  return 1;
}

/** Mappatura semplice categoria doc → sezione rules, basata su slug/titolo. */
export function inferTargetSectionFromCategory(categorySlug: string): RulesTarget {
  const slug = categorySlug.toLowerCase();
  if (/a11y|accessibility|contrast|focus|keyboard|wcag/.test(slug)) {
    return { section: 'Accessibility Rules' };
  }
  if (/dark-pattern|deceptive|ethic/.test(slug)) {
    return { section: 'Escalation Rules', subSection: 'Dark patterns' };
  }
  if (/table|data-table/.test(slug)) {
    return { section: 'UX Rules', subSection: 'Data tables' };
  }
  if (/responsive|breakpoint|layout|auto-layout/.test(slug)) {
    return { section: 'Quality/Performance', subSection: 'Responsive layout' };
  }
  if (/form|checkout|validation/.test(slug)) {
    return { section: 'UX Rules', subSection: 'Forms & checkout' };
  }
  if (/i18n|internationalization|localization/.test(slug)) {
    return { section: 'Quality/Performance', subSection: 'i18n readiness' };
  }
  return { section: 'UX Rules' };
}

/** Snapshot delle rules correnti, usato solo per referenze logiche durante la pianificazione. */
export interface RulesSnapshot {
  uxSections: string[];
  accessibilitySections: string[];
  escalationIds: string[];
}

/** Risultato complessivo di un’analisi (input per Discord/Notion). */
export interface AnalysisRunResult {
  runId: string;
  runDate: string;
  /** Proposte ordinate per priorityScore decrescente. */
  proposals: ImprovementProposal[];
}

/** Payload compatto per Discord webhook (embed singolo). */
export function buildDiscordPayload(run: AnalysisRunResult) {
  const top = run.proposals.slice(0, 3);
  const fields = top.map((p) => ({
    name: `#${p.id} — ${p.target.section}${p.target.subSection ? ` · ${p.target.subSection}` : ''}`,
    value:
      `**Priority:** ${p.priorityScore}/100 · **Effort:** ${p.effort}\n` +
      `**Doc Category:** ${p.categoryId}\n` +
      `**Summary:** ${p.summary}\n` +
      (p.sources[0]?.url ? `[Source](${p.sources[0].url})` : ''),
  }));

  return {
    username: 'Comtra UX Rules Bot',
    embeds: [
      {
        title: `UX Rules Doc Audit — ${run.runDate}`,
        description: `Found ${run.proposals.length} improvement candidate(s). Showing top ${top.length} by priority.`,
        fields,
      },
    ],
  };
}

/** Rappresentazione tabellare per Notion: una riga per proposta. */
export interface NotionRow {
  runDate: string;
  categoryDoc: string;
  targetRulesSection: string;
  improvementSummary: string;
  priorityScore: number;
  novelty: 'new' | 'updated' | 'known';
  sources: string[];
  testCoverage: ImprovementProposal['testCoverage'];
  status: 'to_review' | 'accepted' | 'rejected' | 'implemented';
}

export function buildNotionRows(run: AnalysisRunResult): NotionRow[] {
  return run.proposals.map((p) => ({
    runDate: run.runDate,
    categoryDoc: p.categoryId,
    targetRulesSection: p.target.subSection
      ? `${p.target.section} · ${p.target.subSection}`
      : p.target.section,
    improvementSummary: p.summary,
    priorityScore: p.priorityScore,
    novelty: deriveNovelty(p),
    sources: p.sources.map((s) => s.url).filter((u): u is string => !!u),
    testCoverage: p.testCoverage,
    status: 'to_review',
  }));
}

function deriveNovelty(p: ImprovementProposal): NotionRow['novelty'] {
  if (p.sources.some((s) => s.noveltyFlag === true)) return 'new';
  if (p.sources.some((s) => s.noveltyFlag === 'updated')) return 'updated';
  return 'known';
}

/** Run manuale di validazione: costruisce un risultato fittizio senza toccare il codice del plugin. */
export function simulateManualAnalysis(
  snapshot: ParsedDocSnapshot,
  rulesSnapshot: RulesSnapshot,
  projectFocus: PriorityInput['projectFocus'] = 'general',
): AnalysisRunResult {
  const proposals: ImprovementProposal[] = [];
  let counter = 0;

  for (const cat of snapshot.categories) {
    const target = inferTargetSectionFromCategory(cat.slug);
    const impact: PriorityInput['impact'] =
      target.section === 'Escalation Rules' || target.section === 'Accessibility Rules' ? 'high' : 'medium';

    if (cat.resources.length === 0) continue;
    const main = cat.resources[0];

    const score = computePriorityScore({
      impact,
      effort: 'medium',
      evidenceCount: cat.resources.length,
      novelty: main.noveltyFlag ? (main.noveltyFlag === 'updated' ? 'updated' : 'new') : 'known',
      projectFocus,
      targetSection: target.section,
    });

    const testCoverage: ImprovementProposal['testCoverage'] =
      hasCoverageForSection(target, rulesSnapshot) ? 'covered' : 'missing';

    proposals.push({
      id: `P-${++counter}`,
      categoryId: cat.id,
      target,
      summary: `Refine rules for "${cat.title}" based on latest sources.`,
      sources: cat.resources,
      priorityScore: score,
      effort: 'medium',
      testCoverage,
    });
  }

  proposals.sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    runId: `run-${Date.now()}`,
    runDate: new Date().toISOString(),
    proposals,
  };
}

function hasCoverageForSection(target: RulesTarget, rulesSnapshot: RulesSnapshot): boolean {
  if (target.section === 'Escalation Rules') {
    return rulesSnapshot.escalationIds.length > 0;
  }
  if (target.section === 'Accessibility Rules') {
    return rulesSnapshot.accessibilitySections.length > 0;
  }
  if (target.section === 'UX Rules') {
    return rulesSnapshot.uxSections.length > 0;
  }
  return false;
}


