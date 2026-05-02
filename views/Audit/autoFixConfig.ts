/**
 * Auto-fix credits mapping and config.
 * Single source of truth for cost per fix and action_type sent to the credits API.
 *
 * Canvas automation today (controller.ts):
 * - A11Y contrast (CTR-*) → get-contrast-fix-preview + applyContrastFix
 * - A11Y touch (TGT-*) → get-touch-fix-preview + applyTouchFix
 * Everything else (DS, UX, Proto, most A11Y rules) is guidance-only until a handler exists.
 * See audit-specs/AUTO-FIX-ISSUE-MAP.md.
 */

import type { AuditIssue } from '../../types';

/** Re-enable "Fix all" when batch apply is implemented (sequential preview/apply for contrast+touch). */
export const FIX_ALL_BATCH_ENABLED = false;

export type AutoFixCanvasKind = 'automated' | 'guidance_only' | 'wireframe_nav' | 'advisory_dialog';

/**
 * True when the plugin controller can apply a real change (not just select layer + notify).
 * @param activeTab — Audit tab: DS | A11Y | UX | PROTOTYPE
 */
export function canAutomateCanvasFix(issue: AuditIssue, activeTab: string): boolean {
  if (issue.hideLayerActions) return false;
  if (issue.id === 'p2') return true;
  if (issue.rule_id === 'CLR-002') return false;
  const hasLayer = Boolean(
    (issue.layerId && String(issue.layerId).trim()) || (issue.layerIds && issue.layerIds.length > 0),
  );
  if (!hasLayer) return false;
  if (activeTab === 'A11Y') {
    if (issue.categoryId === 'contrast') return true;
    if (issue.categoryId === 'touch' && issue.passes !== true) return true;
    return false;
  }
  return false;
}

/** UX label + routing: wireframe shortcut, OKLCH advisory, real auto-fix, or manual guidance modal. */
export function getAutoFixCanvasKind(issue: AuditIssue, activeTab: string): AutoFixCanvasKind {
  if (issue.id === 'p2') return 'wireframe_nav';
  if (issue.rule_id === 'CLR-002') return 'advisory_dialog';
  if (canAutomateCanvasFix(issue, activeTab)) return 'automated';
  return 'guidance_only';
}

/** Action type sent to API when consuming credits for a single auto-fix. */
export const ACTION_AUTO_FIX = 'audit_auto_fix';

/** Action type sent to API when consuming credits for Fix All. */
export const ACTION_AUTO_FIX_ALL = 'audit_auto_fix_all';

/** Default credits per single fix when no category/rule override. */
export const DEFAULT_CREDITS_PER_FIX = 2;

/** Credits for special wireframe/prototype fix (e.g. "Create Wireframe"). */
export const CREDITS_WIREFRAME_FIX = 3;

/**
 * Credits per fix by category (A11Y and DS).
 * Used when the issue has no rule_id or rule_id is not in the rule override map.
 */
export const CREDITS_BY_CATEGORY: Record<string, number> = {
  // A11Y
  contrast: 2,
  touch: 2,
  focus: 2,
  alt: 2,
  semantics: 2,
  color: 2,
  // DS
  adoption: 2,
  coverage: 2,
  naming: 2,
  structure: 2,
  consistency: 2,
  copy: 2,
  optimization: 2,
  // UX / Prototype (placeholder)
  flow: 2,
  feedback: 2,
  logic: 2,
  visual: 2,
};

/**
 * Optional override by rule_id (e.g. CTR-001 costs 2, component deviation could cost more).
 * If not present, CREDITS_BY_CATEGORY[categoryId] or DEFAULT_CREDITS_PER_FIX is used.
 */
export const CREDITS_BY_RULE: Record<string, number> = {
  // A11Y (engine: auth-deploy/oauth-server/a11y-audit-engine.mjs) — see audit-specs/AUTO-FIX-ISSUE-MAP.md
  'CTR-001': 2,
  'CTR-002': 2,
  'CTR-003': 2,
  'CTR-004': 2,
  'CTR-009': 2, // focus variant heuristic (rule id in engine)
  'TGT-001': 2,
  'TGT-003': 2,
  'CVD-001': 2,
  // OKLCH in Figma is advisory-only for now (no native token space auto-apply)
  'CLR-002': 0,
  // Component deviation (multiple layers) could cost more
  // adoption + layerIds: already handled as single fix per issue
  // DS Optimization (audit-specs/ds-audit/DS-AUDIT-RULES.md §8)
  'DS-OPT-1': 2,
  'DS-OPT-2': 2,
  'DS-OPT-3': 2,
  'DS-OPT-4': 2,
  'DS-OPT-5': 2,
  'DS-OPT-6': 2,
};

/**
 * Returns the credits cost for a single auto-fix on the given issue.
 */
export function getCreditsForIssue(issue: AuditIssue): number {
  if (issue.id === 'p2') return CREDITS_WIREFRAME_FIX;
  if (issue.rule_id && CREDITS_BY_RULE[issue.rule_id] !== undefined) {
    return CREDITS_BY_RULE[issue.rule_id];
  }
  const byCat = issue.categoryId && CREDITS_BY_CATEGORY[issue.categoryId];
  return byCat !== undefined ? byCat : DEFAULT_CREDITS_PER_FIX;
}

/**
 * Returns the total credits cost for applying Fix All to the given issues.
 */
export function getCreditsForFixAll(issues: AuditIssue[]): number {
  return issues.reduce((sum, i) => sum + getCreditsForIssue(i), 0);
}

/** Credits for issues that actually run automated canvas fixes (used when batch exists). */
export function getCreditsForAutomatableIssues(issues: AuditIssue[], activeTab: string): number {
  return issues
    .filter((i) => canAutomateCanvasFix(i, activeTab))
    .reduce((sum, i) => sum + getCreditsForIssue(i), 0);
}
