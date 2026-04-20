/** Helpers for docs/GENERATE-CONVERSATIONAL-UX (preflight §15.2, refinement chips §5–6). */

export type PreflightVariant = 'dashboard' | 'login' | 'generic';

export type PreflightChip = { id: string; label: string };

export type PreflightEvaluation = {
  show: boolean;
  variant: PreflightVariant | null;
  chips: PreflightChip[];
};

/** Rule-based MVP (pack-driven `[CONV_UX]` can extend server-side later §15.6). */
export function evaluatePreflightClarifier(prompt: string): PreflightEvaluation {
  const p = prompt.trim();
  const len = p.length;
  const lower = p.toLowerCase();

  if (len >= 160) return { show: false, variant: null, chips: [] };

  if (
    /\bdashboard\b|\banalytics\b|\bkpi\b|\bmetriche\b|\bmetrics\b|\badmin panel\b|\bbackoffice\b/i.test(lower) &&
    len < 170
  ) {
    return {
      show: true,
      variant: 'dashboard',
      chips: [
        { id: 'kpi', label: 'KPI metrics at top' },
        { id: 'charts', label: 'Charts / trends focus' },
        { id: 'table', label: 'Primary data table' },
        { id: 'filters', label: 'Filters or date range in header' },
      ],
    };
  }

  if (
    /\blogin\b|\bsign\s*-?\s*in\b|\baccedi\b|\baccesso\b|\bauthenticate\b/i.test(lower) &&
    len < 140
  ) {
    return {
      show: true,
      variant: 'login',
      chips: [
        { id: 'sso', label: 'SSO / social login' },
        { id: '2fa', label: 'Optional 2FA' },
        { id: 'reset', label: 'Self-serve password reset' },
      ],
    };
  }

  /** Short prompts: let the run proceed (assistant / server can clarify in-chat). Avoid a robotic “pick layout” gate on every terse message — see conversational UX goals. */
  return { show: false, variant: null, chips: [] };
}

export type RefinementChipDef = {
  id: string;
  label: string;
  /** Appended before POST; keeps DS + validation path unchanged. */
  append: string;
  /** Display tier for credit hint (§6): 1 = light … 3 = heavy */
  tier: 1 | 2 | 3;
};

export const REFINEMENT_CHIPS: RefinementChipDef[] = [
  {
    id: 'tighten_spacing',
    label: 'Tighten spacing',
    append:
      '\n\nRefinement: tighten vertical rhythm and spacing between sections; keep existing hierarchy.',
    tier: 1,
  },
  {
    id: 'hierarchy',
    label: 'Stronger visual hierarchy',
    append:
      '\n\nRefinement: strengthen visual hierarchy (typography scale, section separation, focal points).',
    tier: 1,
  },
  {
    id: 'cta',
    label: 'Stronger CTA',
    append: '\n\nRefinement: make primary call-to-action stronger (contrast, size, placement).',
    tier: 2,
  },
  {
    id: 'mobile',
    label: 'Mobile-friendly',
    append: '\n\nRefinement: adapt layout for narrow viewport; prioritize vertical flow and thumb reach.',
    tier: 2,
  },
  {
    id: 'density',
    label: 'Cleaner density',
    append:
      '\n\nRefinement: reduce visual density; simplify secondary elements while preserving content.',
    tier: 3,
  },
];

export function tierCreditHint(tier: 1 | 2 | 3): number {
  if (tier <= 1) return 1;
  if (tier === 2) return 2;
  return 3;
}

/**
 * §6 — Maps UI tier to `POST /api/credits/estimate` action_type (plugin preview).
 * Final billing follows server action plan after a successful run.
 */
export function refinementEstimateActionType(tier: 1 | 2 | 3): string {
  if (tier <= 1) return 'generate_refinement_light';
  if (tier === 2) return 'generate_refinement_medium';
  return 'generate_refinement_heavy';
}

/** Safe bullets from metadata only (no chain-of-thought). */
export function reasoningSummaryLinesFromPlan(plan: object): string[] {
  const rec = plan as { metadata?: Record<string, unknown> };
  const meta = rec.metadata && typeof rec.metadata === 'object' ? rec.metadata : {};
  const diag = meta.generation_diagnostics as Record<string, unknown> | undefined;
  const lines: string[] = [];
  if (!diag || typeof diag !== 'object') return lines;

  const pipe = diag.pipeline != null ? String(diag.pipeline).trim() : '';
  if (pipe) lines.push(`Server pipeline: ${pipe}`);

  const timers = diag.phase_timers as Record<string, unknown> | undefined;
  if (timers && typeof timers === 'object') {
    const total = timers.total_ms;
    const val = timers.validation_ms;
    if (typeof total === 'number' && Number.isFinite(total)) {
      lines.push(`Server round-trip ~${Math.round(total / 1000)}s (network + model + validation).`);
    } else if (typeof val === 'number' && Number.isFinite(val)) {
      lines.push(`Internal validation ~${Math.round(val / 1000)}s.`);
    }
  }

  const shape = diag.action_plan_shape as Record<string, unknown> | undefined;
  if (shape && typeof shape === 'object') {
    const ac = shape.action_count;
    if (typeof ac === 'number' && ac > 0) lines.push(`Shape: ${ac} planned actions after quality gates.`);
  }

  return lines.slice(0, 4);
}

export function localConversationStorageKey(userId: string, fileKey: string, dsHash: string): string {
  return `comtra-gen-conv:${userId}:${fileKey}:${dsHash}`;
}

export function activeThreadStorageKey(userId: string, fileKey: string, dsHash: string): string {
  return `comtra-gen-thread-id:${userId}:${fileKey}:${dsHash}`;
}

/** Short English relative time for thread lists (§7). */
export function formatShortRelativeTime(updatedAtMs: number): string {
  const n = Number(updatedAtMs);
  if (!Number.isFinite(n)) return '';
  const diff = Date.now() - n;
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(n).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}
