/**
 * Generate pipeline: status line copy (single-line Claude Code-style UI).
 * Stable ids for locales / iteration. No vendor names in user-facing strings.
 */

export const GPS_UNDERSTAND_REQUEST =
  'Reading your mind (okay, your prompt). Same thing, right?';

export const GPS_DS_SNAPSHOT_CUSTOM =
  "Importing your file's design drama: components, tokens, attitude.";

/** Bundled DS branch: never interpolates a library display name. */
export function gpsDsSnapshotNamed(_selectedSystemDisplayName: string) {
  return "Syncing the library you already love. No name drops, we're shy.";
}

export const GPS_SELECTION_MODIFY =
  "You selected a layer. We're not fighting it, we're giving it a glow-up.";

export const GPS_SCREENSHOT_REF =
  'Screenshot in the building: stealing colors, not your identity.';

export const GPS_FILE_CONTEXT_VALIDATE =
  'Poking Figma until it says yes, the file is real.';

export const GPS_CLASSIFY_ARCHETYPE =
  "Guessing the screen's personality: chill dashboard or stressed checkout?";

export const GPS_KIMI_GENERATION_SPEC =
  'Solving the pattern like a crossword: across "layout", down "no chaos".';

export const GPS_RETRIEVE_DS_COMPONENTS =
  'Foraging the component forest for the least embarrassing picks.';

export const GPS_PLANNING_LAYOUT =
  'Blueprint time: who sits where, who gets the good padding.';

export const GPS_MAPPING_SLOTS =
  "Slot matchmaking: swiping left on anything that's not a real component.";

export const GPS_STRUCTURED_ACTION_PLAN =
  "Turning \"make it pop\" into actual steps. You're welcome.";

export const GPS_VALIDATION_PREP =
  'Bouncer at the door: no sad empty frames get in the club.';

export function gpsArchetypeLine(slots: {
  archetype?: string | null;
  slots_total?: number | null;
} | null) {
  return slots?.archetype
    ? `${slots.archetype} won the election, herding ${slots.slots_total ?? 0} slot(s) into line.`
    : "Archetype's in. Now we see if the layout behaves or throws a tantrum.";
}

export function gpsActionPlanShapeLine(planShape: {
  actions_total?: number;
  create_frame?: number;
  instance_component?: number;
  create_text?: number;
} | null) {
  return planShape
    ? `Plan drop: ${planShape.actions_total ?? 0} moves, ${planShape.create_frame ?? 0} frames, ${planShape.instance_component ?? 0} real components, ${planShape.create_text ?? 0} labels.`
    : 'Plan arrived, unwrapping it like aggressive holiday packaging.';
}

export const GPS_SERVER_VALIDATION_OK =
  'The server nodding: schema good, text visible, library refs not imaginary.';

export const GPS_CANVAS_APPLY_START =
  'Doing the thing. Watch your layers, snacks not included.';

export const GPS_CANVAS_FRAMES =
  'Nesting auto-layout like a very calm matryoshka.';

export const GPS_CANVAS_DS_INSTANCES =
  'Swapping placeholder energy for production component energy.';

export const GPS_CANVAS_CHECK_RESULT = 'Quick reality check: did the canvas cry?';

export const GPS_CREDITS_FINALIZE =
  'Paying the credit piper so nobody gets a surprise invoice.';

export const GPS_DIAGNOSTICS_SAVE =
  'Saving lab notes for the post-mortem (usually "it was fine").';

export const GPS_WRAP_ASSISTANT_REPLY =
  'Last pep talk, then you get a frame and a minor emotional event.';
