import { AuditIssue, AuditCategory } from '../../types';

// Extended interface for local UI needs
export interface ExtendedAuditCategory extends AuditCategory {
  desc: string;
  locked?: boolean;
}

/** DS-only category config (no Accessibility — that lives in A11Y tab). See audit-specs/ds-audit/TYPES-AND-CATEGORIES.md */
export const DS_CATEGORIES_CONFIG: { id: string; label: string; desc: string; icon: string; color: string }[] = [
  { id: 'adoption', label: 'Adoption Rate', desc: 'DS Components vs. Detached Layers', icon: '❖', color: 'bg-[#ff90e8]' },
  { id: 'coverage', label: 'Token Coverage', desc: 'Linked Variables vs. Hardcoded Values', icon: '🎨', color: 'bg-blue-300' },
  { id: 'naming', label: 'Naming Accuracy', desc: 'Layer Naming Conventions', icon: '✎', color: 'bg-yellow-300' },
  { id: 'structure', label: 'Structure', desc: 'Hierarchy, Auto-layout & Constraints', icon: '▣', color: 'bg-purple-200' },
  { id: 'consistency', label: 'Consistency', desc: 'Grid, Spacing & Type Scale', icon: '◫', color: 'bg-teal-200' },
  { id: 'copy', label: 'Copywriting', desc: 'Tone, Localization & Microcopy', icon: '¶', color: 'bg-orange-300' },
  { id: 'optimization', label: 'Optimization', desc: 'Merge, Slots & Variants', icon: '◇', color: 'bg-indigo-200' },
];

/** Build DS categories from issues (dynamic). Only categories that appear in config and in issues are included. */
export function buildDsCategoriesFromIssues(issues: AuditIssue[]): ExtendedAuditCategory[] {
  const ids = DS_CATEGORIES_CONFIG.map(c => c.id);
  return DS_CATEGORIES_CONFIG.map(config => {
    const catIssues = issues.filter(i => i.categoryId === config.id);
    const count = catIssues.length;
    const high = catIssues.filter(i => i.severity === 'HIGH').length;
    const med = catIssues.filter(i => i.severity === 'MED').length;
    const low = catIssues.filter(i => i.severity === 'LOW').length;
    const score = count === 0 ? 100 : Math.max(0, 100 - (high * 12 + med * 6 + low * 2));
    return {
      id: config.id,
      label: config.label,
      desc: config.desc,
      icon: config.icon,
      color: config.color,
      score: count === 0 ? -1 : score,
      issuesCount: count,
    };
  }).filter(c => c.issuesCount > 0);
}

/** Score → status copy and target (same ToV). Used for dynamic DS score. */
export interface DsScoreCopy {
  status: string;
  target: string;
}

export const DS_SCORE_MATRIX: { min: number; max: number; status: string; target: string }[] = [
  { min: 0, max: 29, status: 'Your system needs urgent care. The garden is overgrown.', target: 'Reach 30% to start pruning.' },
  { min: 30, max: 49, status: 'A few weeds are blocking the light. Time to tidy up.', target: 'Reach 50% to let it breathe.' },
  { min: 50, max: 69, status: 'Growing stronger, but some branches are still crooked.', target: 'Reach 70% to straighten the path.' },
  { min: 70, max: 89, status: 'Your system is blooming, but a few petals are out of place.', target: 'Reach 90% to harmonize.' },
  { min: 90, max: 99, status: 'Almost there. One last polish and the stars will align.', target: 'Reach 100% to become legend.' },
  { min: 100, max: 100, status: 'Absolute perfection! The stars align with your grid.', target: 'You are a design legend.' },
];

/** Formatta il conteggio issue per display: 1.2k, 10k, 100k, 1.1M oltre le migliaia. */
export function formatIssueCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  if (n < 100_000) return `${Math.round(n / 1000)}k`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
  if (n < 10_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return `${Math.round(n / 1_000_000)}M`;
}

export function getDsScoreCopy(score: number): DsScoreCopy {
  const row = DS_SCORE_MATRIX.find(r => score >= r.min && score <= r.max);
  return row ? { status: row.status, target: row.target } : DS_SCORE_MATRIX[0];
}

/** Compute 0–100 health score from issue list (HIGH/MED/LOW penalties). */
export function computeDsScoreFromIssues(issues: AuditIssue[]): number {
  if (issues.length === 0) return 100;
  const high = issues.filter(i => i.severity === 'HIGH').length;
  const med = issues.filter(i => i.severity === 'MED').length;
  const low = issues.filter(i => i.severity === 'LOW').length;
  return Math.max(0, Math.min(100, 100 - (high * 12 + med * 6 + low * 2)));
}

/** A11Y tab: category config (same model as DS). See audit-specs/a11y-audit/TYPES-AND-CATEGORIES.md, ISSUE-TYPES.md */
export const A11Y_CATEGORIES_CONFIG: { id: string; label: string; desc: string; icon: string; color: string }[] = [
  { id: 'contrast', label: 'Contrast', desc: 'Text/background WCAG ratio (AA 4.5:1)', icon: '◐', color: 'bg-red-200' },
  { id: 'touch', label: 'Touch target', desc: 'Min 24×24 px (AA) / 44×44 px (AAA) interactive area', icon: '☝', color: 'bg-amber-200' },
  { id: 'focus', label: 'Focus state', desc: 'Visible focus for keyboard nav', icon: '⌘', color: 'bg-blue-200' },
  { id: 'alt', label: 'Alt text', desc: 'Descriptions for icons/images', icon: '🖼', color: 'bg-cyan-200' },
  { id: 'semantics', label: 'Semantics', desc: 'Heading hierarchy & structure', icon: '▤', color: 'bg-violet-200' },
  { id: 'color', label: 'Color & OKLCH', desc: 'Not color-only; OKLCH tokens', icon: '🎨', color: 'bg-emerald-200' },
];

/** Build A11Y categories from issues (dynamic). Only categories that appear in config and in issues are included. */
export function buildA11yCategoriesFromIssues(issues: AuditIssue[]): ExtendedAuditCategory[] {
  return A11Y_CATEGORIES_CONFIG.map(config => {
    const catIssues = issues.filter(i => i.categoryId === config.id);
    const count = catIssues.length;
    const high = catIssues.filter(i => i.severity === 'HIGH').length;
    const med = catIssues.filter(i => i.severity === 'MED').length;
    const low = catIssues.filter(i => i.severity === 'LOW').length;
    const score = count === 0 ? 100 : Math.max(0, 100 - (high * 12 + med * 6 + low * 2));
    return {
      id: config.id,
      label: config.label,
      desc: config.desc,
      icon: config.icon,
      color: config.color,
      score: count === 0 ? -1 : score,
      issuesCount: count,
    };
  }).filter(c => c.issuesCount > 0);
}

/** UX Logic Audit: category config. See audit-specs/ux-logic-audit/README.md, UX-LOGIC-AUDIT-RULES.md. */
export const UX_LOGIC_CATEGORIES_CONFIG: { id: string; label: string; desc: string; icon: string; color: string }[] = [
  { id: 'system-feedback', label: 'System Feedback', desc: 'Loading, progress, success/error states', icon: '◉', color: 'bg-blue-200' },
  { id: 'interaction-safety', label: 'Interaction Safety', desc: 'Modals, destructive actions, undo', icon: '⚠', color: 'bg-amber-200' },
  { id: 'form-ux', label: 'Form UX', desc: 'Labels, validation, required, error messages', icon: '▢', color: 'bg-cyan-200' },
  { id: 'navigation-ia', label: 'Navigation & IA', desc: 'Breadcrumbs, active state, back nav', icon: '▤', color: 'bg-violet-200' },
  { id: 'content-copy', label: 'Content & Copy', desc: 'CTAs, jargon, terminology, microcopy', icon: '¶', color: 'bg-orange-200' },
  { id: 'error-handling', label: 'Error & Empty States', desc: 'What/Why/Fix, empty states, recovery', icon: '◐', color: 'bg-red-200' },
  { id: 'data-tables', label: 'Data Tables & Lists', desc: 'Alignment, sort, sticky header, empty', icon: '▦', color: 'bg-slate-200' },
  { id: 'responsive-layout', label: 'Responsive & Layout', desc: 'Breakpoints, auto-layout, spacing', icon: '▣', color: 'bg-teal-200' },
  { id: 'cognitive-load', label: 'Cognitive Load', desc: 'Hierarchy, grouping, progressive disclosure', icon: '◈', color: 'bg-indigo-200' },
  { id: 'dark-patterns', label: 'Dark Patterns & Ethics', desc: 'Asymmetric actions, pre-selected opt-in', icon: '⚡', color: 'bg-rose-200' },
  { id: 'i18n', label: 'Internationalization', desc: 'Text expansion, RTL, date/currency format', icon: '🌐', color: 'bg-emerald-200' },
];

/** UX Health Score formula: 100 - (HIGH×5 + MED×2 + LOW×1). See audit-specs/ux-logic-audit/SEVERITY-AND-SCORE.md */
export function computeUxHealthScoreFromIssues(issues: AuditIssue[]): number {
  if (issues.length === 0) return 100;
  const high = issues.filter(i => i.severity === 'HIGH').length;
  const med = issues.filter(i => i.severity === 'MED').length;
  const low = issues.filter(i => i.severity === 'LOW').length;
  return Math.max(0, Math.min(100, 100 - (high * 5 + med * 2 + low * 1)));
}

/** Badge ranges: 90–100 EXCELLENT, 70–89 GOOD, 50–69 NEEDS WORK, 0–49 CRITICAL */
export interface UxScoreCopy {
  badge: 'EXCELLENT' | 'GOOD' | 'NEEDS WORK' | 'CRITICAL';
  status: string;
}

export const UX_SCORE_MATRIX: { min: number; max: number; badge: UxScoreCopy['badge']; status: string }[] = [
  { min: 0, max: 49, badge: 'CRITICAL', status: 'Serious UX failures requiring immediate attention.' },
  { min: 50, max: 69, badge: 'NEEDS WORK', status: 'Multiple UX problems impacting experience.' },
  { min: 70, max: 89, badge: 'GOOD', status: 'Solid foundation with some gaps.' },
  { min: 90, max: 100, badge: 'EXCELLENT', status: 'File follows UX best practices.' },
];

export function getUxScoreCopy(score: number): UxScoreCopy {
  const row = UX_SCORE_MATRIX.find(r => score >= r.min && score <= r.max);
  return row ? { badge: row.badge, status: row.status } : { badge: 'CRITICAL', status: UX_SCORE_MATRIX[0].status };
}

/** Build UX Logic categories from issues (dynamic). Uses UX Health Score formula per category. */
export function buildUxCategoriesFromIssues(issues: AuditIssue[]): ExtendedAuditCategory[] {
  return UX_LOGIC_CATEGORIES_CONFIG.map(config => {
    const catIssues = issues.filter(i => i.categoryId === config.id);
    const count = catIssues.length;
    const high = catIssues.filter(i => i.severity === 'HIGH').length;
    const med = catIssues.filter(i => i.severity === 'MED').length;
    const low = catIssues.filter(i => i.severity === 'LOW').length;
    const score = count === 0 ? 100 : Math.max(0, 100 - (high * 5 + med * 2 + low * 1));
    return {
      id: config.id,
      label: config.label,
      desc: config.desc,
      icon: config.icon,
      color: config.color,
      score: count === 0 ? -1 : score,
      issuesCount: count,
    };
  }).filter(c => c.issuesCount > 0);
}

/** Prototype Audit: category config. See audit-specs/prototype-audit/TYPES-AND-CATEGORIES.md, PROTOTYPE-AUDIT-RULES.md. */
export const PROTOTYPE_CATEGORIES_CONFIG: { id: string; label: string; desc: string; icon: string; color: string }[] = [
  { id: 'flow-integrity', label: 'Flow Integrity', desc: 'Dead-ends, orphans, start point, broken refs', icon: '▣', color: 'bg-red-200' },
  { id: 'navigation-coverage', label: 'Navigation & Coverage', desc: 'Back nav, unreachable frames, loops', icon: '↩', color: 'bg-amber-200' },
  { id: 'interaction-quality', label: 'Interaction & Animation', desc: 'Triggers, Smart Animate, duration, easing', icon: '◇', color: 'bg-blue-200' },
  { id: 'overlay-scroll', label: 'Overlay & Scroll', desc: 'Overlay config, scroll overflow', icon: '▢', color: 'bg-cyan-200' },
  { id: 'component-advanced', label: 'Components & Advanced', desc: 'Interactive components, variables, conditionals', icon: '⚡', color: 'bg-violet-200' },
  { id: 'documentation-coverage', label: 'Documentation & Coverage', desc: 'Flow naming, hotspot coverage, presentation', icon: '¶', color: 'bg-slate-200' },
];

/** Rule IDs that count as Critical (8 pt) in Prototype Health Score. All other HIGH = 5 pt. */
const PROTO_HEALTH_CRITICAL_RULES = ['P-01', 'P-02', 'P-03', 'P-04'];

/** Prototype Health Score: 100 - (critical×8 + high×5 + medium×3 + low×1). See audit-specs/prototype-audit/SEVERITY-AND-SCORE.md */
export function computePrototypeHealthScoreFromIssues(issues: AuditIssue[]): number {
  if (issues.length === 0) return 100;
  let pts = 0;
  for (const i of issues) {
    if (i.severity === 'HIGH')
      pts += i.rule_id && PROTO_HEALTH_CRITICAL_RULES.includes(i.rule_id) ? 8 : 5;
    else if (i.severity === 'MED') pts += 3;
    else if (i.severity === 'LOW') pts += 1;
  }
  return Math.max(0, Math.min(100, 100 - pts));
}

/** Advisory levels: 80–100 Healthy, 50–79 Needs Attention, 26–49 At Risk, 0–25 Critical */
export interface PrototypeScoreCopy {
  advisoryLevel: 'healthy' | 'needs_attention' | 'at_risk' | 'critical';
  status: string;
}

export const PROTOTYPE_SCORE_MATRIX: { min: number; max: number; advisoryLevel: PrototypeScoreCopy['advisoryLevel']; status: string }[] = [
  { min: 0, max: 25, advisoryLevel: 'critical', status: 'Fundamental prototype issues. Fix flows and connections first.' },
  { min: 26, max: 49, advisoryLevel: 'at_risk', status: 'Structural gaps. Review flow architecture and prioritise fixes.' },
  { min: 50, max: 79, advisoryLevel: 'needs_attention', status: 'Functional with quality gaps. Address findings to improve confidence.' },
  { min: 80, max: 100, advisoryLevel: 'healthy', status: 'No blocking issues. Safe to share and test.' },
];

export function getPrototypeScoreCopy(score: number): PrototypeScoreCopy {
  const row = PROTOTYPE_SCORE_MATRIX.find(r => score >= r.min && score <= r.max);
  return row ? { advisoryLevel: row.advisoryLevel, status: row.status } : { advisoryLevel: 'critical', status: PROTOTYPE_SCORE_MATRIX[0].status };
}

/** Build Prototype categories from issues (dynamic). Uses same score weights as computePrototypeHealthScoreFromIssues per category. */
export function buildPrototypeCategoriesFromIssues(issues: AuditIssue[]): ExtendedAuditCategory[] {
  return PROTOTYPE_CATEGORIES_CONFIG.map(config => {
    const catIssues = issues.filter(i => i.categoryId === config.id);
    const count = catIssues.length;
    let pts = 0;
    for (const i of catIssues) {
      if (i.severity === 'HIGH') pts += i.rule_id && PROTO_HEALTH_CRITICAL_RULES.includes(i.rule_id) ? 8 : 5;
      else if (i.severity === 'MED') pts += 3;
      else if (i.severity === 'LOW') pts += 1;
    }
    const score = count === 0 ? 100 : Math.max(0, 100 - pts);
    return {
      id: config.id,
      label: config.label,
      desc: config.desc,
      icon: config.icon,
      color: config.color,
      score: count === 0 ? -1 : score,
      issuesCount: count,
    };
  }).filter(c => c.issuesCount > 0);
}

export const LOADING_MSGS = [
  "Admiring the magnificent colors...",
  "Reading the beautiful story...",
  "Observing class naming...",
  "Gathering stardust...",
  "Whispering to the pixels..."
];

/** Loader messages for A11Y audit flow (same ToV: playful, design‑centric). Shown after Authorize. */
export const A11Y_LOADING_MSGS = [
  "Checking contrast and touch targets...",
  "Reading the layers for accessibility...",
  "Gathering focus and semantics...",
  "Whispering to the pixels (a11y pass)...",
  "Observing contrast ratios and labels..."
];

/** Loader messages for Prototype audit (flows, connections, dead-ends). Same ToV. */
export const PROTO_LOADING_MSGS = [
  "Following the flows...",
  "Checking connections and back navigation...",
  "Tracing dead-ends and orphans...",
  "Reading prototype arrows...",
  "Whispering to the prototype..."
];

/** Legacy list (includes a11y for any non-DS use). For DS tab use buildDsCategoriesFromIssues instead. */
export const CATEGORIES: ExtendedAuditCategory[] = [
  { id: 'adoption', label: 'Adoption Rate', desc: 'DS Components vs. Detached Layers', score: 92, icon: '❖', color: 'bg-[#ff90e8]', issuesCount: 3 },
  { id: 'coverage', label: 'Token Coverage', desc: 'Linked Variables vs. Hardcoded Values', score: 85, icon: '🎨', color: 'bg-blue-300', issuesCount: 4 },
  { id: 'a11y', label: 'Accessibility Pass', desc: 'WCAG Contrast & Touch Targets', score: 100, icon: '♿', color: 'bg-green-300', issuesCount: 0 },
  { id: 'naming', label: 'Naming Accuracy', desc: 'Layer Naming Conventions', score: 60, icon: '✎', color: 'bg-yellow-300', issuesCount: 5 },
  { id: 'copy', label: 'Copywriting', desc: 'Tone, Localization & Microcopy', score: -1, icon: '¶', color: 'bg-orange-300', issuesCount: 0 },
];

export const MOCK_PAGES = ["Home V2", "Design System", "Archive 2023", "Playground", "Checkout Flow", "Auth Screens"];

export const DS_ISSUES: AuditIssue[] = [
  { id: '1', categoryId: 'coverage', msg: 'Hardcoded Hex', severity: 'HIGH', layerId: 'n1', fix: 'Use var(--primary)', tokenPath: 'sys.color.primary.500', pageName: 'Home V2' },
  { id: '2', categoryId: 'naming', msg: 'Layer "Frame 432"', severity: 'LOW', layerId: 'n2', fix: 'Rename to "Card_Header"', pageName: 'Home V2' },
  { id: '3', categoryId: 'adoption', msg: 'Detached Instance', severity: 'MED', layerId: 'n3', fix: 'Reattach to master', pageName: 'Design System' },
  { id: '4', categoryId: 'naming', msg: 'Misaligned 2px', severity: 'LOW', layerId: 'n4', fix: 'Snap to 8px grid', pageName: 'Archive 2023' },
  { id: '5', categoryId: 'coverage', msg: 'Unknown Font', severity: 'HIGH', layerId: 'n5', fix: 'Use Space Grotesk', pageName: 'Home V2' },
  { 
    id: '6', 
    categoryId: 'adoption', 
    msg: 'Component Deviation', 
    severity: 'HIGH', 
    layerId: 'cta-primary', 
    layerIds: ['cta-1', 'cta-2', 'cta-3', 'cta-4', 'cta-5', 'cta-6', 'cta-7', 'cta-8', 'cta-9', 'cta-10'], 
    fix: 'Font is 12px (Master is 26px). Suggestion: Create "Small" variant & apply to all.', 
    pageName: 'Home V2' 
  },
  { id: 'c1', categoryId: 'copy', msg: 'Localization Risk', severity: 'MED', layerId: 'txt-checkout', fix: 'Text container width is fixed. Expand for German translation overflow.', pageName: 'Checkout Flow' },
  { id: 'c2', categoryId: 'copy', msg: 'Inconsistent Tone', severity: 'LOW', layerId: 'txt-error', fix: 'Error message is too robotic ("Invalid Input"). Suggestion: "Please check your email".', pageName: 'Auth Screens' },
];

export const A11Y_ISSUES: AuditIssue[] = [
  { id: 'a1', categoryId: 'contrast', msg: 'Contrast Fail 3.2:1', severity: 'HIGH', layerId: 'btn-txt', fix: 'Darken text to #4A4A4A', pageName: 'Home V2' },
  { id: 'a2', categoryId: 'touch', msg: 'Touch Target 32px', severity: 'MED', layerId: 'icon-btn', fix: 'Increase padding to 44px', pageName: 'Home V2' },
  { id: 'a3', categoryId: 'focus', msg: 'Missing :focus state', severity: 'MED', layerId: 'input-field', fix: 'Add Focus Variant', pageName: 'Design System' },
];

/** Mock UX Logic issues (categoryIds from audit-specs/ux-logic-audit). Replace with real Kimi output. */
export const UX_ISSUES: AuditIssue[] = [
  { id: 'UXL-002', categoryId: 'system-feedback', msg: 'No Success/Error outcome state', severity: 'HIGH', layerId: 'submit-btn', fix: 'Add success/done or error/fail variant to component set', pageName: 'Home V2', rule_id: 'UXL-002', heuristic: 'H1 - Visibility of System Status' },
  { id: 'UXL-012', categoryId: 'form-ux', msg: 'Input missing visible label', severity: 'HIGH', layerId: 'email-input', fix: 'Add persistent visible label (above or left); avoid placeholder-only', pageName: 'Home V2', rule_id: 'UXL-012', heuristic: 'H5 - Error Prevention' },
  { id: 'UXL-001', categoryId: 'system-feedback', msg: 'No loading state variant', severity: 'LOW', layerId: 'card-list', fix: 'Add loading/spinner or skeleton variant for async content', pageName: 'Home V2', rule_id: 'UXL-001', heuristic: 'H1 - Visibility of System Status' },
];

/** Mock Prototype Audit issues (categoryIds from audit-specs/prototype-audit). Replace with real in-plugin or API results. */
export const PROTO_ISSUES: AuditIssue[] = [
  { id: 'P-04-001', rule_id: 'P-04', categoryId: 'flow-integrity', msg: 'Broken destination: target frame not found', severity: 'HIGH', layerId: 'nav-home', fix: 'Reconnect to an existing frame or remove the link.', pageName: 'Home V2', flowName: 'Main Flow' },
  { id: 'P-01-001', rule_id: 'P-01', categoryId: 'flow-integrity', msg: 'Dead-end frame: no outgoing connections or Back actions', severity: 'HIGH', layerId: 'flow-end', fix: 'Add a Back action or Navigate to to return to previous screen.', pageName: 'Home V2', flowName: 'Checkout Flow' },
];
