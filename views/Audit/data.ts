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

export const UX_ISSUES: AuditIssue[] = [
  { id: 'u1', categoryId: 'flow', msg: 'Dead End Interaction', severity: 'HIGH', layerId: 'submit-btn', fix: 'Add Success/Error State', pageName: 'Home V2' },
  { id: 'u2', categoryId: 'semantics', msg: 'Input missing Label', severity: 'MED', layerId: 'email-input', fix: 'Wrap in <label> component', pageName: 'Home V2' },
  { id: 'u3', categoryId: 'feedback', msg: 'No Loading State', severity: 'LOW', layerId: 'card-list', fix: 'Add Skeleton Loader', pageName: 'Home V2' },
];

export const PROTO_ISSUES: AuditIssue[] = [
  { id: 'p1', categoryId: 'logic', msg: 'Broken Link', severity: 'HIGH', layerId: 'nav-home', fix: 'Link to Frame: Home_V2', pageName: 'Home V2' },
  { id: 'p2', categoryId: 'visual', msg: 'Missing Confirmation Wireframe', severity: 'HIGH', layerId: 'flow-end', fix: 'Create Success State', pageName: 'Home V2' },
];
