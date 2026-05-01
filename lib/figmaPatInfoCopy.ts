/** Copy for PAT gate / info (DS+UX server path). */
export const FIGMA_PAT_BULLETS: string[] = [
  'In Figma: Settings → Security → Personal access tokens → Generate new token.',
  'Copy the token (shown once; store it safely).',
  'In this plugin: Personal details → paste under “Figma file access” → Save.',
];

export const FIGMA_PAT_INTRO =
  'Design System and UX audits need Figma file access on our servers (same as “OAuth connected”). Until Figma login is enabled here, add a Personal Access Token once — otherwise scans rely on a heavy export from the plugin and performance will suffer.';

export const FIGMA_PAT_PRIVACY =
  'Your token is used only so our servers can call Figma’s file API on your behalf. We don’t publish or share it.';
