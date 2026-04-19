/** Request body for POST /api/agents/import-narration (Comtra plugin DS import UX). */
export type ImportNarrationKind =
  | 'welcome'
  | 'session_locked'
  | 'tokens_done'
  | 'components_done';

export type ImportNarrationRequest = {
  kind: ImportNarrationKind;
  /** Display name of the open Figma file (optional). */
  file_name?: string | null;
  /** Short hints for Kimi (counts, phase labels). */
  hint?: string | null;
};

export type ImportNarrationResponse = {
  text: string;
};
