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
    description:
      'Our servers are busy or restarting. Wait a couple of minutes, avoid hammering the same action, then try again from where you left off.',
    variant: 'warning',
  },
  throttle_discount_ok: {
    title: "Here's a little something",
    description:
      'Use code `{CODE}` for 5% off your next plan. Apply it at checkout before it expires — sorry for the wait.',
    variant: 'default',
  },
  throttle_code_not_ready: {
    title: 'Not ready yet',
    description:
      'The goodwill code unlocks 15 minutes after the outage started. Check back then from the same screen, or continue working and request it later.',
    variant: 'info',
  },
  throttle_code_failed: {
    title: "Couldn't fetch the code",
    description:
      'We could not issue the discount right now. Your account is fine — wait a bit and use “Request discount code” again, or contact support if it persists.',
    variant: 'error',
  },
  // 2 — Auth
  session_expired: {
    title: 'Session expired',
    description:
      'Your sign-in expired for security. Open the profile menu → Log out, then sign in again with email or Figma to continue.',
    variant: 'warning',
    ctaLabel: 'Log in',
  },
  login_failed: {
    title: "Login didn't go through",
    description:
      "We couldn't reach the login service. Check Wi‑Fi or VPN, confirm figma.com opens in a browser, then try signing in again from the plugin.",
    variant: 'error',
    ctaLabel: 'Try sign-in again',
  },
  login_timed_out: {
    title: 'Login timed out',
    description:
      'The browser window may have closed too soon. Start sign-in again and complete it in one go; disable popup blockers for this site if needed.',
    variant: 'warning',
    ctaLabel: 'Try again',
  },
  // 3 — Figma
  figma_connection_lost: {
    title: 'Figma connection lost',
    description:
      'Comtra needs permission to read your file on the server. Reconnect Figma from login if you see it — or, with email login, add a Personal Access Token under Profile → Personal details.',
    variant: 'warning',
    ctaLabel: 'Reconnect Figma',
  },
  file_not_saved: {
    title: 'Save your file first',
    description:
      'This flow needs a real file key. Save in Figma (⌘S / Ctrl+S), wait until the tab shows saved, then run Comtra again.',
    variant: 'info',
  },
  /** When figma.fileKey is unavailable (all/page scope). Don't say "save" — Figma auto-saves. */
  file_link_unavailable: {
    title: 'File link not available',
    description:
      'For “All pages” or “Single page” we need a normal cloud file. Switch audit scope to Current selection, or open a file you own / have access to — drafts without a link cannot be used here.',
    variant: 'info',
  },
  // 4 — Credits
  out_of_credits: {
    title: 'Out of credits',
    description:
      'This action needs {N} credits and your balance is too low. Open Subscription to top up or upgrade, then return to the audit.',
    variant: 'warning',
    ctaLabel: 'View plans',
  },
  payment_hiccup: {
    title: 'Payment hiccup',
    description:
      "We couldn't add credits — nothing was charged. Confirm your card and network, then retry checkout from Subscription.",
    variant: 'error',
  },
  checkout_failed: {
    title: "Couldn't open checkout",
    description:
      'The payment tab was blocked or failed to load. Allow pop-ups for this origin, disable aggressive ad blockers for Stripe, then open checkout again.',
    variant: 'error',
    ctaLabel: 'Open checkout again',
  },
  discount_unavailable: {
    title: 'Discount unavailable',
    description:
      "We couldn't load your promo code this time. Your subscription is unchanged — try again later from Subscription or contact support.",
    variant: 'info',
  },
  // 5 — Audit
  audit_couldnt_start: {
    title: "Audit couldn't start",
    description:
      "We couldn't finish this run. Narrow the scope (Current selection or one page), ensure you're online, then start the audit again — avoid starting multiple scans at once.",
    variant: 'warning',
    ctaLabel: 'Run audit again',
  },
  audit_timed_out: {
    title: 'Audit timed out',
    description:
      'The scan ran too long or the connection dropped. Wait a minute, pick a smaller frame or page, then run the audit again.',
    variant: 'warning',
    ctaLabel: 'Run audit again',
  },
  analysis_interrupted: {
    title: 'Analysis interrupted',
    description:
      'Our AI pipeline returned an error — usually load-related. Wait briefly, reduce selection size, and start the audit again; contact us if it repeats.',
    variant: 'error',
  },
  figma_not_responding: {
    title: "Figma isn't responding",
    description:
      "Figma's API is slow or failing. Check status.figma.com, pause heavy edits, then retry the action from Comtra.",
    variant: 'warning',
  },
  audit_not_available: {
    title: 'Audit not available',
    description:
      'This audit type does not apply to the current selection. Choose a frame, instance, or page that matches the audit, then try again.',
    variant: 'info',
  },
  // 6 — Generate
  generation_failed: {
    title: 'Generation failed',
    description:
      'The model returned invalid layout data. Retry with a simpler prompt or fewer components; if it persists, pick a smaller area on the canvas.',
    variant: 'error',
  },
  generate_something_wrong: {
    title: 'Something went wrong',
    description:
      "Comtra couldn't build the output. Check your connection, confirm DS components exist in this file, then generate again.",
    variant: 'error',
    ctaLabel: 'Try generate again',
  },
  generation_timed_out: {
    title: 'Generation timed out',
    description:
      'The request took too long. Split the work: fewer components per run, or a tighter frame selection, then generate again.',
    variant: 'warning',
    ctaLabel: 'Try again',
  },
  // 7 — Code & Sync
  scan_failed: {
    title: 'Scan failed',
    description:
      "The Storybook sync couldn't finish. Verify the URL and token, confirm Storybook is running, then run the scan again from the Code tab.",
    variant: 'error',
  },
  unexpected_data: {
    title: 'Unexpected data',
    description:
      'The server sent a response we could not parse — often a transient glitch. Run the scan once more; if it keeps happening, re-save the file and retry.',
    variant: 'warning',
  },
  cant_read_design_tokens: {
    title: "Can't read design tokens",
    description:
      'Variables may be unpublished or remote libraries unavailable. Publish local variables (or enable library sync), then open Code → Tokens again.',
    variant: 'error',
  },
  storybook_not_reachable: {
    title: 'Storybook not reachable',
    description:
      'We could not reach your Storybook URL. Confirm the URL (https), start your dev server, fix VPN/firewall rules, then paste the URL again and retry.',
    variant: 'warning',
  },
  sync_timed_out: {
    title: 'Sync timed out',
    description:
      'The file or Storybook response was too heavy. Sync fewer pages or components, or increase local Storybook heap, then run sync again.',
    variant: 'warning',
  },
  // 8 — Affiliate (inline, but copy here for consistency)
  affiliate_load_failed: {
    title: "Couldn't load affiliate data",
    description:
      'Refresh the page or reopen the plugin. If loading still fails, copy any error text and contact support with your account email.',
    variant: 'error',
  },
  affiliate_registration_failed: {
    title: "Registration didn't go through",
    description:
      'Check required fields and try again. If the form keeps failing, email support with the time you tried — we will enroll you manually.',
    variant: 'error',
  },
  // 9 — Count nodes
  count_layers_failed: {
    title: "Couldn't count the layers",
    description:
      'Counting stopped mid-way — the file may have changed. Click away and reselect your target frame, then start the audit again.',
    variant: 'warning',
  },
  // 10 — DS Import wizard (plugin toast)
  ds_import_snapshot_missing: {
    title: 'Catalog snapshot incomplete',
    description:
      'Finish the Components step in the import wizard so we capture the full index, then confirm again. Without it the server catalog stays empty.',
    variant: 'warning',
  },
  ds_import_server_save_failed: {
    title: "Couldn't save your design system",
    description:
      'The server did not accept this import. Fix any message shown above, check your connection, then save again from the wizard.',
    variant: 'warning',
  },
  ds_import_metadata_local_failed: {
    title: 'Local catalog metadata not updated',
    description:
      'The snapshot is on the server, but writing metadata beside your file failed. You can keep working; repeat import later to refresh local metadata.',
    variant: 'warning',
  },
  // 11 — Catch-all
  something_went_wrong: {
    title: 'Something went wrong',
    description:
      'An unexpected error occurred. Note what you clicked, try once more after a short wait, and contact support with your email if it continues.',
    variant: 'error',
    ctaLabel: 'Try once more',
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
  ) || m.includes('no figma token') || m.includes('figma non connesso')
    || m.includes('figma_reconnect') || m.includes('figma api token not stored') || m.includes('figma rejected this token')
    || m.includes('re-login') || m.includes('grant file access')
    || (m.includes('oauth') && (m.includes('figma') || m.includes('token')))
    || (m.includes('403') && m.includes('token'));
}
