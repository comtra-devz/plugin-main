/**
 * Auto-fix credits mapping and config.
 * Single source of truth for cost per fix and action_type sent to the credits API.
 */

import type { AuditIssue } from '../../types';

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
  'CLR-002': 2,
  // Component deviation (multiple layers) could cost more
  // adoption + layerIds: already handled as single fix per issue
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
