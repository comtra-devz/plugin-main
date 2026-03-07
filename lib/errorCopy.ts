/**
 * Central error copy and toast options — see docs/comtra-error-messages.md.
 * Use getSystemToastOptions() for consistent title, description, variant, and optional CTA.
 * Rule: one surface per error; when showing toast, do not also show the same message in a banner.
 */

export type ToastVariant = 'default' | 'error' | 'warning' | 'info';

export interface SystemToastOptions {
  title: string;
  description?: string;
  variant: ToastVariant;
  /** CTA label when action is provided by caller */
  ctaLabel?: string;
}

const COPY: Record<string, SystemToastOptions> = {
  // 1 — Service & connectivity
  service_unavailable: {
    title: 'Comtra is taking a breather',
    description: 'Our servers are busy. Try again in a few minutes.',
    variant: 'warning',
  },
  throttle_discount_ok: {
    title: "Here's a little something",
    description: 'Use code `{CODE}` for 5% off your next plan. Sorry for the wait.',
    variant: 'default',
  },
  throttle_code_not_ready: {
    title: 'Not ready yet',
    description: 'The discount code unlocks 15 min after the outage. Hang tight.',
    variant: 'info',
  },
  throttle_code_failed: {
    title: "Couldn't fetch the code",
    description: "Something went wrong on our end. Try again shortly.",
    variant: 'error',
  },
  // 2 — Auth
  session_expired: {
    title: 'Session expired',
    description: 'Log in again to pick up where you left off.',
    variant: 'warning',
    ctaLabel: 'Log in',
  },
  login_failed: {
    title: "Login didn't go through",
    description: "We couldn't connect to the login service. Check your connection and try again.",
    variant: 'error',
    ctaLabel: 'Retry',
  },
  login_timed_out: {
    title: 'Login timed out',
    description: 'The login window may have closed. Give it another go.',
    variant: 'warning',
    ctaLabel: 'Try again',
  },
  // 3 — Figma
  figma_connection_lost: {
    title: 'Figma connection lost',
    description: 'Comtra needs access to your Figma file. Reconnect to continue.',
    variant: 'warning',
    ctaLabel: 'Reconnect Figma',
  },
  file_not_saved: {
    title: 'Save your file first',
    description: 'Comtra needs a saved file to work with. Hit ⌘S and try again.',
    variant: 'info',
  },
  /** When figma.fileKey is unavailable (all/page scope). Don't say "save" — Figma auto-saves. */
  file_link_unavailable: {
    title: 'File link not available',
    description: "For \"All pages\" or \"Single page\" we need a Figma file link. Use Current selection to run the audit, or open a file that's in your Figma account.",
    variant: 'info',
  },
  // 4 — Credits
  out_of_credits: {
    title: 'Out of credits',
    description: 'This action costs {N} credits. Top up or upgrade to keep going.',
    variant: 'warning',
    ctaLabel: 'Upgrade',
  },
  payment_hiccup: {
    title: 'Payment hiccup',
    description: "We couldn't process the credits. Nothing was charged. Try again.",
    variant: 'error',
  },
  checkout_failed: {
    title: "Couldn't open checkout",
    description: "The payment page didn't load. Check your popup blocker and try again.",
    variant: 'error',
    ctaLabel: 'Retry',
  },
  discount_unavailable: {
    title: 'Discount unavailable',
    description: "We couldn't load your discount code. It'll show up next time.",
    variant: 'info',
  },
  // 5 — Audit
  audit_couldnt_start: {
    title: "Audit couldn't start",
    description: "Comtra lost the connection to your file. This usually fixes itself — try again.",
    variant: 'warning',
    ctaLabel: 'Retry',
  },
  audit_timed_out: {
    title: 'Audit timed out',
    description: 'Your file is too large to scan in one go. Select fewer frames or a single page and retry.',
    variant: 'warning',
    ctaLabel: 'Retry',
  },
  analysis_interrupted: {
    title: 'Analysis interrupted',
    description: "Our AI engine hit a snag. This is on us — try again in a moment.",
    variant: 'error',
  },
  figma_not_responding: {
    title: "Figma isn't responding",
    description: "Figma's servers are slow right now. Wait a minute and retry.",
    variant: 'warning',
  },
  audit_not_available: {
    title: 'Audit not available',
    description: "This audit type isn't available for your current selection. Pick a different frame or page.",
    variant: 'info',
  },
  // 6 — Generate
  generation_failed: {
    title: 'Generation failed',
    description: 'The output came back malformed. Try again — if it persists, try a simpler selection.',
    variant: 'error',
  },
  generate_something_wrong: {
    title: 'Something went wrong',
    description: "Comtra couldn't generate the output. Give it another try.",
    variant: 'error',
    ctaLabel: 'Retry',
  },
  generation_timed_out: {
    title: 'Generation timed out',
    description: 'Complex selections take longer. Try generating fewer components at once.',
    variant: 'warning',
    ctaLabel: 'Retry',
  },
  // 7 — Code & Sync
  scan_failed: {
    title: 'Scan failed',
    description: "Comtra couldn't complete the sync scan. Try again.",
    variant: 'error',
  },
  unexpected_data: {
    title: 'Unexpected data',
    description: "The scan returned something we didn't expect. Retry — it's usually a one-off.",
    variant: 'warning',
  },
  cant_read_design_tokens: {
    title: "Can't read design tokens",
    description: "Comtra couldn't pull the tokens from your file. Make sure variables are published and try again.",
    variant: 'error',
  },
  storybook_not_reachable: {
    title: 'Storybook not reachable',
    description: "Comtra can't connect to your Storybook instance. Check the URL and make sure the server is running.",
    variant: 'warning',
  },
  sync_timed_out: {
    title: 'Sync timed out',
    description: 'Large files need more time. Try syncing fewer components.',
    variant: 'warning',
  },
  // 8 — Affiliate (inline, but copy here for consistency)
  affiliate_load_failed: {
    title: "Couldn't load affiliate data",
    description: 'Try refreshing. If it keeps happening, reach out to us.',
    variant: 'error',
  },
  affiliate_registration_failed: {
    title: "Registration didn't go through",
    description: 'Something went wrong while signing you up. Try again or contact support.',
    variant: 'error',
  },
  // 9 — Count nodes
  count_layers_failed: {
    title: "Couldn't count the layers",
    description: 'Comtra needs to count your layers before scanning. Deselect and reselect your frame, then retry.',
    variant: 'warning',
  },
  // 10 — Catch-all
  something_went_wrong: {
    title: 'Something went wrong',
    description: "That wasn't supposed to happen. Try again — if it keeps up, let us know.",
    variant: 'error',
    ctaLabel: 'Retry',
  },
};

export type SystemToastType = keyof typeof COPY;

/** Get toast options for a system error type. Replace placeholders (e.g. {CODE}, {N}) in description/title. */
export function getSystemToastOptions(
  type: SystemToastType,
  overrides?: { code?: string; credits?: number; description?: string }
): SystemToastOptions & { description?: string } {
  const base = COPY[type];
  if (!base) return { ...COPY.something_went_wrong };
  let description = base.description;
  if (overrides?.code && description) description = description.replace('{CODE}', overrides.code);
  if (overrides?.credits != null && description) description = description.replace('{N}', String(overrides.credits));
  if (overrides?.description) description = overrides.description;
  return { ...base, description };
}

/** True if the error is typically retriable (timeout, 503, 502 external, etc.). */
export function isRetriableError(messageOrStatus: string | number): boolean {
  if (typeof messageOrStatus === 'number') {
    return [408, 429, 502, 503, 504].includes(messageOrStatus);
  }
  const m = messageOrStatus.toLowerCase();
  return /timeout|timed out|504|503|busy|try again|retry/i.test(m);
}

/** File-context unavailable (no fileKey for all/page, or legacy "save the file"): show only inline banner, no toast (per spec). */
export function isFileNotSavedError(message: string | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes('file_link_unavailable') || m.includes('save the file') || m.includes('salva il file') || m.includes('saved file');
}

/** Figma/token reconnect: show single toast, not banner (per spec). */
export function isFigmaConnectionError(message: string | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes('figma') && (m.includes('token') || m.includes('conness') || m.includes('reconnect') || m.includes('riconnetti'))
  ) || m.includes('no figma token') || m.includes('figma non connesso');
}
