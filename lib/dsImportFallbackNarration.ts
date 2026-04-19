import type { ImportNarrationKind } from './importNarrationTypes';

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

const WELCOME = [
  "Hey — we're about to read your design system straight from this Figma file. No uploads, no treasure hunt.",
  "You're already in the file, so we'll pull tokens, styles, and components from the live canvas. Fancy, right?",
  "Comtra's going to snoop this document like it pays rent here — then we wire everything into Generate.",
] as const;

const SESSION_LOCKED = [
  "Locked in — I'm freeloading context from your live session and I'm not sorry.",
  "You confirmed: I'll read this file from your open session. Fast, nosy, efficient.",
  "Perfect. I'm borrowing your Figma session to sponge up the DS — hold tight.",
  "Session confirmed. I'm pulling rules and foundations from the file you already have open.",
] as const;

const TOKENS_DONE = [
  "Foundations are on the radar — variables and styles are in view.",
  "Tokens and local styles: bagged. Next we hunt components.",
  "Nice — your token layer and styles just got a proper read.",
] as const;

const COMPONENTS_DONE = [
  "Catalog scan wrapped — your components and variants are mapped. Almost party time.",
  "Heavy lifting done: component universe indexed. You're one confirm away from Generate.",
  "That's the big scan. Your DS inventory is ready to back real generations.",
] as const;

export function fallbackImportNarration(kind: ImportNarrationKind): string {
  switch (kind) {
    case 'welcome':
      return pick(WELCOME);
    case 'session_locked':
      return pick(SESSION_LOCKED);
    case 'tokens_done':
      return pick(TOKENS_DONE);
    case 'components_done':
      return pick(COMPONENTS_DONE);
    default:
      return pick(WELCOME);
  }
}
