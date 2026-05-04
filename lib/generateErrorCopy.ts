/**
 * Generate tab — user-facing error copy for toasts and chat.
 * Prefer passing raw API/plugin strings into the toast mapper; use humanize* for conversation text.
 */

import type { ToastVariant } from './errorCopy';

const DEFAULT_CANVAS = 'Something went wrong while updating the canvas.';

type GenerateToastRule = {
  test: (msg: string) => boolean;
  title: string;
  /** User-facing body; receives original message for rare interpolations */
  description: (msg: string) => string;
  variant?: ToastVariant;
};

const RULES: GenerateToastRule[] = [
  {
    test: (m) =>
      /set_layoutSizingVertical|set_layoutSizingHorizontal|layoutSizingVertical|layoutSizingHorizontal/i.test(m) &&
      /HUG|FILL/i.test(m),
    title: 'Canvas layout',
    description: () =>
      'Figma blocked a layout sizing option on a generated layer (usually Hug on a node that is not in auto layout yet). Try Generate again; if it keeps happening, simplify the prompt or update the plugin.',
    variant: 'error',
  },
  {
    test: (m) => m.includes('CUSTOM_DS_INSTANCE_PREFLIGHT_FAILED'),
    title: 'Design system',
    description: () =>
      'Some design-system components could not be resolved in this file. Link the libraries your DS uses, refresh the import from this screen, then try again.',
    variant: 'error',
  },
  {
    test: (m) => m.includes('INSTANCE_UNRESOLVED'),
    title: 'Components',
    description: () =>
      'One or more DS instances could not be matched in the file. Check linked libraries and that component keys in the index match this file.',
    variant: 'error',
  },
  {
    test: (m) => m.includes('VARIABLE_UNRESOLVED'),
    title: 'Variables',
    description: () =>
      'Some DS variables are missing or not linked in this file. Publish or attach the variable collections, then regenerate.',
    variant: 'warning',
  },
  {
    test: (m) =>
      m.includes('Enhance Plus returned empty text') ||
      (m.toLowerCase().includes('enhance plus') && m.toLowerCase().includes('empty')),
    title: 'Enhance Plus',
    description: () =>
      'The model returned no text. Shorten the prompt, check your connection, and try again — or use Enhance without credits.',
    variant: 'warning',
  },
  {
    test: (m) =>
      m.includes('Finish the design system import') ||
      m.includes('design system import above'),
    title: 'Import required',
    description: () =>
      'Finish the design system import (wizard above) before generating so we have a component index for this file.',
    variant: 'warning',
  },
  {
    test: (m) =>
      m.includes('All pages') ||
      m.includes('Single page') ||
      m.includes('cloud file') ||
      m.includes('file link not available') ||
      m.includes('File link not available'),
    title: 'File context',
    description: (msg) =>
      msg.length > 40 && !msg.startsWith('http')
        ? msg
        : 'We need a normal cloud file context. Switch scope to Current selection, or open a file you can link — drafts without a file key cannot run this flow.',
    variant: 'info',
  },
  {
    test: (m) =>
      m.includes('Invalid response from server') ||
      m.includes('invalid server response') ||
      m.includes('malformed action plan'),
    title: 'Server response',
    description: () =>
      'The server reply was incomplete. Wait a moment and run Generate again; if it repeats, try a shorter prompt.',
    variant: 'error',
  },
  {
    test: (m) => /out of credits|not enough credits|credit balance|402|payment required/i.test(m),
    title: 'Credits',
    description: (msg) =>
      /out of credits|not enough|balance/i.test(msg)
        ? 'Not enough credits for this action. Open subscription to top up, then try again.'
        : msg.slice(0, 280),
    variant: 'warning',
  },
  {
    test: (m) => /401|403|unauthorized|forbidden|session expired|sign.?in again/i.test(m),
    title: 'Session',
    description: () =>
      'Your session may have expired. Sign in again from the plugin profile, then retry Generate.',
    variant: 'warning',
  },
  {
    test: (m) => /502|503|504|bad gateway|service unavailable|timed out|timeout|fetch failed|failed to fetch|network/i.test(m),
    title: 'Connection',
    description: () =>
      'We could not reach the service. Check your network or VPN, wait a few seconds, and try again.',
    variant: 'warning',
  },
  {
    test: (m) => m.includes('Could not load this conversation'),
    title: 'Threads',
    description: () =>
      'Could not load this conversation. Go back to Threads and pick again, or start a new chat.',
    variant: 'error',
  },
  {
    test: (m) => m.includes('Image too large') || m.includes('max 6MB') || m.includes('6MB'),
    title: 'Attachment',
    description: () => 'Image is too large (max 6 MB). Use a smaller PNG or JPEG and attach again.',
    variant: 'info',
  },
  {
    test: (m) => m.includes('Paste a valid public Figma frame URL') || m.includes('frame URL'),
    title: 'Frame link',
    description: () =>
      'Paste a public Figma frame URL (Share → copy link). Private or invalid links cannot be attached.',
    variant: 'info',
  },
  {
    test: (m) => /422|ACTION_PLAN|validation failed|schema validation/i.test(m),
    title: 'Plan validation',
    description: (msg) =>
      msg.length < 400
        ? msg
        : 'The generated layout did not pass validation. Tweak the prompt (fewer rare components) and generate again.',
    variant: 'error',
  },
];

function clip(s: string, max = 360): string {
  const t = String(s || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Plain-language line for chat / assistant bubbles (may include raw tail for support). */
export function humanizeGenerateCanvasError(raw: string): string {
  const msg = String(raw || '').trim();
  if (!msg) return DEFAULT_CANVAS;
  for (const r of RULES) {
    if (r.test(msg)) return r.description(msg);
  }
  return clip(msg, 500);
}

export function getGenerateErrorToastPayload(raw: string): {
  title: string;
  description: string;
  variant: ToastVariant;
} {
  const msg = String(raw || '').trim();
  if (!msg) {
    return {
      title: 'Generate',
      description: DEFAULT_CANVAS,
      variant: 'error',
    };
  }
  for (const r of RULES) {
    if (r.test(msg)) {
      return {
        title: r.title,
        description: clip(r.description(msg), 420),
        variant: r.variant ?? 'error',
      };
    }
  }
  return {
    title: 'Generate',
    description: clip(msg, 420),
    variant: 'error',
  };
}
