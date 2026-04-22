import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BRUTAL } from '../constants';
import { Button } from '../components/ui/Button';
import {
  loadDsImports,
  upsertDsImport,
  setSessionCatalogPrepared,
  enforceSingleImportForFreeTier,
  canFreeTierUseFileForDsImport,
  type StoredDsImport,
} from '../lib/dsImportsStorage';
import { safeLocalStorageGetItem, safeLocalStorageSetItem } from '../lib/safeWebStorage';
import { useToast } from '../contexts/ToastContext';
import { ImportConversationalPanel, type ImportFeedItem } from '../components/generate/ImportConversationalPanel';
import { fallbackImportNarration } from '../lib/dsImportFallbackNarration';

const INTRO_SEEN_KEY = 'comtra-generate-ds-intro-seen';

export type RequestDsContextIndexFn = (opts: {
  reuseCached: boolean;
  timeoutMs?: number;
  /** Wizard: read tokens/styles only, or merge component scan (after tokens). */
  phase?: 'rules' | 'tokens' | 'components';
  onProgress?: (p: { phase: 'components'; pageName: string; pageIndex: number; pageTotal: number; scanned: number }) => void;
}) => Promise<{ index: object | null; hash: string | null; error?: string }>;

type DsIndexSummary = {
  fileName?: string;
  total_tokens: number;
  token_categories: Record<string, number>;
  variable_names?: string[];
  styles_summary?: { paintStyles: number; textStyles: number; effectStyles: number };
  components: unknown[];
  /** After heavy component scan: UI counts only (drops full `components[]` from React state to save memory). */
  catalogPreview?: {
    inIndex: number;
    sets: number;
    singles: number;
    logoLike: number;
    titleLike: number;
    descriptionLike: number;
  };
  components_truncated?: boolean;
  total_components_in_file?: number;
  rules_summary?: {
    source: 'plugin_data' | 'documentation_pages' | 'none';
    rules: string[];
    guidance: string[];
  };
};

type ImportFlowPhase = 'none' | 'tokens' | 'full';
type IntroStepLoading = 0 | 1 | null;

const STEP_TOTAL = 5;
const VISIBLE_STEPPER_COLS = 4;

type StepperSlot =
  | { kind: 'step'; stepIndex: number; displayNumber: number }
  | { kind: 'ellipsis' };

function getStepperSlots(currentStep: number): StepperSlot[] {
  if (currentStep < STEP_TOTAL - 1) {
    return [0, 1, 2, 3].map((stepIndex) => ({
      kind: 'step',
      stepIndex,
      displayNumber: stepIndex + 1,
    }));
  }
  return [
    { kind: 'step', stepIndex: 0, displayNumber: 1 },
    { kind: 'step', stepIndex: 1, displayNumber: 2 },
    { kind: 'ellipsis' },
    { kind: 'step', stepIndex: 4, displayNumber: 5 },
  ];
}

/** Indexed component rows from plugin payload (`DsComponentSummary`). */
function countIndexedCatalogParts(components: unknown[]): {
  sets: number;
  singles: number;
} {
  let sets = 0;
  let singles = 0;
  for (const raw of components) {
    if (!raw || typeof raw !== 'object') continue;
    const t = (raw as { type?: string }).type;
    if (t === 'COMPONENT_SET') sets += 1;
    else if (t === 'COMPONENT') singles += 1;
  }
  return { sets, singles };
}

function hasSemanticSignal(
  raw: unknown,
  re: RegExp,
  opts?: { includeSlotHints?: boolean },
): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const row = raw as {
    name?: unknown;
    propertyKeys?: unknown;
    variantAxes?: unknown;
    slotHints?: unknown;
  };
  const name = String(row.name || '').toLowerCase();
  if (re.test(name)) return true;
  const propertyKeys = Array.isArray(row.propertyKeys) ? row.propertyKeys : [];
  for (const k of propertyKeys) {
    if (re.test(String(k || '').toLowerCase())) return true;
  }
  const variantAxes = Array.isArray(row.variantAxes) ? row.variantAxes : [];
  for (const a of variantAxes) {
    if (re.test(String(a || '').toLowerCase())) return true;
  }
  if (opts?.includeSlotHints) {
    const slotHints = Array.isArray(row.slotHints) ? row.slotHints : [];
    for (const s of slotHints) {
      if (re.test(String(s || '').toLowerCase())) return true;
    }
  }
  return false;
}

function readIntroSeen(): boolean {
  return safeLocalStorageGetItem(INTRO_SEEN_KEY) === '1';
}

function writeIntroSeen(): void {
  safeLocalStorageSetItem(INTRO_SEEN_KEY, '1');
}

function blurActiveElement(): void {
  const active = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
  if (active && typeof active.blur === 'function') active.blur();
}

const WIZARD_TEXT = [
  {
    title: 'Rules',
    body: 'Comtra will use this file’s design-system rules and constraints when generating screens: color, spacing, typography, and component conventions stay aligned with what is defined in Figma.',
  },
  {
    title: 'Guidance',
    body: 'Operational guidance (visual hierarchy, content priority, recurring patterns) is derived from the file and the catalog we are about to import so Generate matches how you design.',
  },
  {
    title: 'Variables',
    body: 'We read local variables (tokens) and library styles: paint, text, and effect styles. No component scan yet — that happens on the next step.',
  },
  {
    title: 'Components',
    body: 'We scan pages for component and variant sets and merge them with the variables snapshot. Large files may take a few seconds.',
  },
  {
    title: 'Recap',
    body: 'Review what will be used for Generate. Confirm to save this catalog for the current file.',
  },
] as const;

const STEPPER_NODE_HALF = 20; // half of size-10 (40px), vertical center of nodes

/** Rail spans column centers on a 4-column equal grid (12.5% → 87.5%). */
const STEPPER_RAIL_LEFT_PCT = 12.5;
const STEPPER_RAIL_WIDTH_PCT = 75;

/** 4 columns, rail through dot centers + larger nodes + clearer active state. */
function ImportFlowStepper({ currentStep }: { currentStep: number }) {
  const slots = getStepperSlots(currentStep);
  const trackProgress = STEP_TOTAL > 1 ? currentStep / (STEP_TOTAL - 1) : 0;
  const railTop = `${STEPPER_NODE_HALF}px`;

  return (
    <div className="w-full px-3" role="navigation" aria-label="Import steps">
      <p className="sr-only">
        Step {currentStep + 1} of {STEP_TOTAL}
      </p>
      <div className="relative py-0.5">
        <div
          className="pointer-events-none absolute z-0 h-1 rounded-full bg-gray-300"
          style={{ left: `${STEPPER_RAIL_LEFT_PCT}%`, width: `${STEPPER_RAIL_WIDTH_PCT}%`, top: railTop }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute z-0 h-1 rounded-full bg-black transition-[width] duration-300 ease-out"
          style={{
            left: `${STEPPER_RAIL_LEFT_PCT}%`,
            top: railTop,
            width: `calc(${STEPPER_RAIL_WIDTH_PCT}% * ${trackProgress})`,
          }}
          aria-hidden
        />
        <div
          className="relative z-10 grid w-full gap-0"
          style={{ gridTemplateColumns: `repeat(${VISIBLE_STEPPER_COLS}, minmax(0, 1fr))` }}
        >
          {slots.map((slot, si) => {
            if (slot.kind === 'ellipsis') {
              return (
                <div
                  key={`ellipsis-${si}`}
                  className="flex min-h-[4.75rem] min-w-0 flex-col items-center justify-start gap-2 pt-0"
                  aria-label="Variables and components steps omitted from strip"
                >
                  {/* Same 40×40 box + shadow as other steps; dashed border = collapsed steps; dots only inside (no duplicate under label). */}
                  <div
                    className="flex size-10 shrink-0 items-center justify-center gap-0.5 border-2 border-dashed border-black bg-white text-sm font-black leading-none text-gray-600 shadow-[3px_3px_0_0_#000]"
                    aria-hidden
                  >
                    <span>·</span>
                    <span>·</span>
                    <span>·</span>
                  </div>
                  <span className="flex min-h-[2rem] w-full items-start justify-center px-1 text-center text-[12px] font-black uppercase leading-snug tracking-wide text-gray-600">
                    Var · comp
                  </span>
                </div>
              );
            }
            const { stepIndex, displayNumber } = slot;
            const completed = stepIndex < currentStep;
            const active = stepIndex === currentStep;
            const title = WIZARD_TEXT[stepIndex]?.title ?? '';
            return (
              <div
                key={`step-${stepIndex}`}
                className="flex min-h-[4.75rem] min-w-0 flex-col items-center justify-start gap-2 pt-0"
              >
                <div
                  className={`flex size-10 shrink-0 items-center justify-center border-2 border-black text-xs font-black tabular-nums leading-none shadow-[3px_3px_0_0_#000] transition-transform duration-200 ${
                    completed
                      ? 'bg-black text-white'
                      : active
                        ? 'bg-[#ff90e8] text-black ring-2 ring-black ring-offset-2 ring-offset-neutral-100'
                        : 'bg-white text-gray-400'
                  } ${active ? 'z-20 scale-[1.02]' : ''}`}
                >
                  {completed ? <span className="text-base leading-none">✓</span> : displayNumber}
                </div>
                <span
                  className={`flex min-h-[2rem] w-full items-start justify-center px-1 text-center text-[12px] font-black uppercase leading-snug tracking-wide text-balance ${
                    active ? 'text-black' : completed ? 'text-gray-800' : 'text-gray-400'
                  }`}
                >
                  {title.toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type ImportGapHint = { id: string; title: string; body: string };

/** Step Variables: after tokens/styles read (ignores components — still empty in tokens-only phase). */
function buildTokenAndStyleGapHints(s: DsIndexSummary): ImportGapHint[] {
  const hints: ImportGapHint[] = [];
  if (s.total_tokens === 0) {
    hints.push({
      id: 'tokens',
      title: 'No variables (tokens) in this file',
      body: 'Generate still works, but output is less aligned to your DS color, spacing, and type decisions.',
    });
  }
  const st = s.styles_summary;
  const stylesEmpty = !st || st.paintStyles + st.textStyles + st.effectStyles === 0;
  if (stylesEmpty) {
    hints.push({
      id: 'styles',
      title: 'No local paint, text, or effect styles',
      body: 'Output can be less polished and less consistent with production if your DS relies on local styles.',
    });
  }
  return hints;
}

/** Step Components: after full merge only. */
function buildComponentsGapHints(s: DsIndexSummary): ImportGapHint[] {
  const indexed = s.catalogPreview?.inIndex ?? s.components.length;
  if (indexed === 0) {
    return [
      {
        id: 'components',
        title: 'No components in the index',
        body: 'Without indexed components, Generate cannot anchor layouts to your real variants and stays more generic.',
      },
    ];
  }
  return [];
}

function WizardImportGapSnackbars({
  hints,
  ariaLabel,
}: {
  hints: ImportGapHint[];
  ariaLabel: string;
}) {
  if (hints.length === 0) return null;
  return (
    <div className="shrink-0 space-y-2" role="region" aria-label={ariaLabel}>
      {hints.map((h) => (
        <div key={h.id} className={BRUTAL.snackbarWarning}>
          <p className="text-[10px] font-black uppercase leading-tight tracking-wide text-black">{h.title}</p>
          <p className="mt-1 text-[11px] font-medium leading-snug text-black">{h.body}</p>
        </div>
      ))}
    </div>
  );
}

function ImportComponentsCatalogCard({
  components,
  catalogPreview,
  components_truncated,
  total_components_in_file,
}: {
  components: unknown[];
  catalogPreview?: DsIndexSummary['catalogPreview'];
  components_truncated?: boolean;
  total_components_in_file?: number;
}) {
  const { sets, singles } = catalogPreview
    ? { sets: catalogPreview.sets, singles: catalogPreview.singles }
    : countIndexedCatalogParts(components);
  const n = catalogPreview?.inIndex ?? components.length;
  const truncated = Boolean(components_truncated);
  const fileTotal = total_components_in_file;

  return (
    <div className="border-2 border-black bg-white shadow-[5px_5px_0_0_#000] overflow-hidden">
      <div className="flex items-stretch border-b-2 border-black">
        <div className="min-w-0 flex-1 bg-yellow-300 px-3 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-black/75">Indexed catalog</p>
          <p className="mt-0.5 text-xs font-black uppercase leading-tight text-black">Ready for Generate</p>
        </div>
        <div className="flex w-[36%] max-w-[8.5rem] shrink-0 flex-col items-center justify-center border-l-2 border-black bg-white py-3 px-2">
          <span className="text-[10px] font-black uppercase text-gray-500">In index</span>
          <span className="mt-0.5 text-3xl font-black tabular-nums leading-none tracking-tight">{n}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-0 border-b-2 border-black text-xs">
        <div className="border-r-2 border-black bg-neutral-50 p-3">
          <p className="font-black uppercase text-[10px] text-gray-600">Component sets</p>
          <p className="mt-1 text-xl font-black tabular-nums leading-none">{sets}</p>
          <p className="mt-1 text-[10px] font-bold leading-snug text-gray-500">Variant families</p>
        </div>
        <div className="bg-neutral-50 p-3">
          <p className="font-black uppercase text-[10px] text-gray-600">Standalone</p>
          <p className="mt-1 text-xl font-black tabular-nums leading-none">{singles}</p>
          <p className="mt-1 text-[10px] font-bold leading-snug text-gray-500">Components not in a set</p>
        </div>
      </div>
      {/* logo/title/description internal metrics intentionally hidden from user-facing recap */}
      {truncated && fileTotal != null && (
        <div className="flex gap-2 border-t-2 border-black bg-amber-100 px-3 py-2.5 text-[11px] font-bold leading-snug text-black">
          <span className="shrink-0 border-2 border-black bg-[#ffc900] px-1.5 py-0.5 text-[9px] font-black uppercase text-black">
            Cap
          </span>
          <span>
            This file has <span className="tabular-nums font-black">{fileTotal}</span> catalog nodes; we keep{' '}
            <span className="tabular-nums font-black">{n}</span> in the index for speed. Generate uses this capped
            list.
          </span>
        </div>
      )}
    </div>
  );
}

type ImportWarningRow = {
  key: string;
  status: 'ok' | 'warning';
  area: string;
  what: string;
  impact: string;
  action: string;
};

function buildWizardWarningRows(summary: DsIndexSummary | null): ImportWarningRow[] {
  if (!summary) return [];
  const rows: ImportWarningRow[] = [];
  const styles = summary.styles_summary;
  const catalog = summary.catalogPreview;
  const indexed = catalog?.inIndex ?? summary.components.length;
  const textStyles = styles?.textStyles ?? 0;
  const paintStyles = styles?.paintStyles ?? 0;
  const hasTitleLike = (catalog?.titleLike ?? 0) > 0;
  const hasDescLike = (catalog?.descriptionLike ?? 0) > 0;
  const hasLogoLike = (catalog?.logoLike ?? 0) > 0;
  const variableNames = Array.isArray(summary.variable_names) ? summary.variable_names : [];
  const hasNumericVars = Number(summary.token_categories?.FLOAT || 0) > 0;
  const hasSpacingVars = variableNames.some((n) =>
    /\b(space|spacing|gap|margin|padding|inset|gutter)\b/i.test(String(n).toLowerCase()),
  );

  rows.push({
    key: 'text-styles',
    status: textStyles > 0 ? 'ok' : 'warning',
    area: 'Text styles',
    what: textStyles > 0 ? `${textStyles} local text style(s) found.` : 'No local text styles found.',
    impact:
      textStyles > 0
        ? 'Titles and body text can follow your local styles.'
        : 'Titles may look generic if styles come only from linked libraries.',
    action:
      textStyles > 0
        ? 'No action needed.'
        : 'Optional: create local aliases for key text styles, then re-import.',
  });

  rows.push({
    key: 'paint-styles',
    status: paintStyles > 0 ? 'ok' : 'warning',
    area: 'Paint styles',
    what: paintStyles > 0 ? `${paintStyles} local paint style(s) found.` : 'No local paint styles found.',
    impact:
      paintStyles > 0
        ? 'Surface and accent colors can map more consistently.'
        : 'Color mapping may fallback to variables/components only.',
    action: paintStyles > 0 ? 'No action needed.' : 'Optional: expose key paint styles locally and re-import.',
  });

  rows.push({
    key: 'title-components',
    status: hasTitleLike ? 'ok' : 'warning',
    area: 'Title components',
    what: hasTitleLike ? 'Title/heading-like components found.' : 'No explicit title/heading components found.',
    impact:
      hasTitleLike
        ? 'Generate can use title-oriented DS blocks when appropriate.'
        : 'Generate may fallback to generic text titles.',
    action:
      hasTitleLike
        ? 'No action needed.'
        : 'Optional: add one heading/title component to your DS for stronger matching.',
  });

  rows.push({
    key: 'description-components',
    status: hasDescLike ? 'ok' : 'warning',
    area: 'Description components',
    what: hasDescLike ? 'Description/subtitle-like components found.' : 'No explicit description/subtitle components found.',
    impact:
      hasDescLike
        ? 'Generate can pair title + description with DS components.'
        : 'Description blocks may fallback to plain text.',
    action:
      hasDescLike
        ? 'No action needed.'
        : 'Optional: add one subtitle/description component and re-import.',
  });

  rows.push({
    key: 'logo-components',
    status: hasLogoLike ? 'ok' : 'warning',
    area: 'Logo components',
    what: hasLogoLike ? 'Logo/brand-like components found.' : 'No obvious logo/brand component found.',
    impact:
      hasLogoLike
        ? 'Generate can attempt DS logo placement.'
        : 'Logo can be missing unless a component is clearly named logo/brand.',
    action:
      hasLogoLike
        ? 'No action needed.'
        : 'Optional: publish a logo component named logo/brand mark and re-import.',
  });

  rows.push({
    key: 'spacing-system',
    status: hasNumericVars && hasSpacingVars ? 'ok' : 'warning',
    area: 'Spacing variables',
    what:
      hasNumericVars && hasSpacingVars
        ? 'Numeric spacing tokens found (gap/margin/padding-like).'
        : 'No clear numeric spacing token system found for gap/margins.',
    impact:
      hasNumericVars && hasSpacingVars
        ? 'Generate can map layout spacing directly from DS tokens.'
        : 'Gap/margins may not map 1:1 from DS and can look inconsistent across screens.',
    action:
      hasNumericVars && hasSpacingVars
        ? 'No action needed.'
        : 'Comtra applies a best-practice fallback scale (4/8/12/16/24/32 based on 8pt rhythm). Add local spacing tokens and re-import for exact DS spacing.',
  });

  if ((textStyles === 0 || paintStyles === 0) && indexed > 0) {
    rows.push({
      key: 'linked-library-caveat',
      status: 'warning',
      area: 'Linked libraries',
      what: 'Some styles may exist only in upstream linked libraries.',
      impact: 'Wizard can read your components, but not always every linked style binding.',
      action: 'If output style is off, enable libraries and create local aliases for key styles.',
    });
  }
  return rows;
}

function WizardWarningsTable({ rows }: { rows: ImportWarningRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="border-2 border-black bg-white shadow-[4px_4px_0_0_#000] overflow-hidden">
      <div className="border-b-2 border-black bg-yellow-200 px-3 py-2">
        <p className="text-[10px] font-black uppercase tracking-wide">Warnings check (simple)</p>
        <p className="text-[11px] font-bold">What may be missing and what to do</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="bg-neutral-100 border-b-2 border-black">
            <tr>
              <th className="text-left p-2 border-r border-black">Status</th>
              <th className="text-left p-2 border-r border-black">Area</th>
              <th className="text-left p-2 border-r border-black">Detected</th>
              <th className="text-left p-2 border-r border-black">Impact</th>
              <th className="text-left p-2">Suggested action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-black/20 align-top">
                <td className="p-2 border-r border-black">
                  <span
                    className={`inline-block px-1.5 py-0.5 border text-[9px] font-black uppercase ${
                      r.status === 'ok'
                        ? 'bg-green-100 border-green-800 text-green-900'
                        : 'bg-amber-100 border-amber-800 text-amber-900'
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="p-2 border-r border-black font-black">{r.area}</td>
                <td className="p-2 border-r border-black">{r.what}</td>
                <td className="p-2 border-r border-black">{r.impact}</td>
                <td className="p-2">{r.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type GenerateDsImportProps = {
  fileKey: string | null;
  fileName: string | null;
  fileContextLoading: boolean;
  fileContextError: string | null;
  requestDsContextIndex: RequestDsContextIndexFn;
  catalogReady: boolean;
  onCatalogReady: () => void;
  /** Clears “catalog ready” and session (e.g. Refresh catalog). */
  onInvalidateCatalog: () => void;
  dsImportBusy: boolean;
  onBusyChange: (busy: boolean) => void;
  /** Se false, un solo file DS importabile; altro file → CTA Pro. */
  isPro: boolean;
  onUnlockRequest: () => void;
  persistDsImportToServer: (body: {
    figma_file_key: string;
    display_name: string;
    figma_file_name: string;
    ds_cache_hash: string;
    ds_context_index: object;
  }) => Promise<void>;
  writeDsImportMeta: (payload: {
    fileKey: string;
    importedAt: string;
    dsCacheHash: string;
    componentCount: number;
    tokenCount: number;
    name: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  /** Optional Kimi lines for import wizard (0 credits). */
  fetchImportNarration?: (body: {
    kind: 'welcome' | 'session_locked' | 'tokens_done' | 'components_done';
    file_name?: string | null;
    hint?: string | null;
  }) => Promise<{ text: string }>;
};

export const GenerateDsImport: React.FC<GenerateDsImportProps> = ({
  fileKey,
  fileName,
  fileContextLoading,
  fileContextError,
  requestDsContextIndex,
  catalogReady,
  onCatalogReady,
  onInvalidateCatalog,
  dsImportBusy,
  onBusyChange,
  isPro,
  onUnlockRequest,
  persistDsImportToServer,
  writeDsImportMeta,
  fetchImportNarration,
}) => {
  const { showToast } = useToast();
  const feedIdRef = useRef(0);
  const nextFeedId = () => {
    feedIdRef.current += 1;
    return `imp-feed-${feedIdRef.current}`;
  };
  const progressLogIdRef = useRef<string | null>(null);
  const [importSessionConfirmed, setImportSessionConfirmed] = useState(false);
  const [importFeedItems, setImportFeedItems] = useState<ImportFeedItem[]>([]);
  const [introSeen, setIntroSeen] = useState(readIntroSeen);
  const [imports, setImports] = useState<StoredDsImport[]>(() => loadDsImports());
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [showWhyModal, setShowWhyModal] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [indexResult, setIndexResult] = useState<DsIndexSummary | null>(null);
  /** Full snapshot + hash for backend PUT (same payload as from the plugin). */
  const [wizardCapture, setWizardCapture] = useState<{ fullIndex: object; hash: string } | null>(null);
  /** DI v2 / wizard_integration: salvate nello snapshot come `wizard_signals` (tone + keywords). */
  const [wizardToneOfVoice, setWizardToneOfVoice] = useState('');
  const [wizardBrandKeywords, setWizardBrandKeywords] = useState('');
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [rulesSummary, setRulesSummary] = useState<DsIndexSummary['rules_summary'] | null>(null);
  /** Tokens loaded vs full index with components (for split Figma reads). */
  const [importFlowPhase, setImportFlowPhase] = useState<ImportFlowPhase>('none');
  /** Minimum dwell on intro steps (Rules + Guidance) with CTA progress bar. */
  const [introStepLoading, setIntroStepLoading] = useState<IntroStepLoading>(null);
  const importFlowCancelledRef = useRef(false);
  const rulesDigestDoneRef = useRef(false);
  const [componentsScanProgress, setComponentsScanProgress] = useState<{
    pageName: string;
    pageIndex: number;
    pageTotal: number;
    scanned: number;
  } | null>(null);

  const step2GapHints = useMemo(() => {
    if (wizardStep !== 2 || !indexResult || importFlowPhase === 'none') return [];
    return buildTokenAndStyleGapHints(indexResult);
  }, [wizardStep, indexResult, importFlowPhase]);

  const step3GapHints = useMemo(() => {
    if (wizardStep !== 3 || !indexResult || importFlowPhase !== 'full') return [];
    return buildComponentsGapHints(indexResult);
  }, [wizardStep, indexResult, importFlowPhase]);

  useEffect(() => {
    if (!isPro) enforceSingleImportForFreeTier();
    setImports(loadDsImports());
  }, [fileKey, wizardOpen, isPro]);

  const needsProForCurrentFile =
    Boolean(fileKey) &&
    !isPro &&
    canFreeTierUseFileForDsImport(fileKey, isPro).ok === false;

  useEffect(() => {
    if (!fileKey || !imports.length) {
      setSelectedImportId(null);
      return;
    }
    const match = imports.find((i) => i.fileKey === fileKey);
    setSelectedImportId(match?.id ?? imports[0]?.id ?? null);
  }, [fileKey, imports]);

  const selectedImport = useMemo(
    () => imports.find((i) => i.id === selectedImportId) ?? null,
    [imports, selectedImportId],
  );

  const acknowledgeImportSession = useCallback(() => {
    setImportSessionConfirmed(true);
    setImportFeedItems((prev) => [
      ...prev,
      {
        id: nextFeedId(),
        role: 'assistant',
        text: fallbackImportNarration('session_locked'),
      },
      {
        id: nextFeedId(),
        role: 'action_log',
        title: 'Reading Figma file · DS rules (live session)',
        lines: [
          'requestDsContextIndex · phase: rules',
          fileName ? `Open file: ${fileName}` : 'Open file: this document',
        ],
      },
    ]);
    if (fetchImportNarration) {
      void fetchImportNarration({ kind: 'session_locked', file_name: fileName })
        .then(({ text }) => {
          const t = String(text || '').trim();
          if (!t) return;
          setImportFeedItems((prev) => [
            ...prev,
            { id: nextFeedId(), role: 'assistant', text: t, flavored: true },
          ]);
        })
        .catch(() => {});
    }
  }, [fetchImportNarration, fileName]);

  const openWizard = useCallback(() => {
    if (fileKey && !canFreeTierUseFileForDsImport(fileKey, isPro).ok) {
      onUnlockRequest();
      return;
    }
    setWizardError(null);
    setIndexResult(null);
    setWizardCapture(null);
    setImportFlowPhase('none');
    setRulesSummary(null);
    setWizardStep(0);
    setShowCancelConfirm(false);
    setIntroStepLoading(null);
    blurActiveElement();
    importFlowCancelledRef.current = false;
    progressLogIdRef.current = null;
    rulesDigestDoneRef.current = false;
    setImportSessionConfirmed(false);
    setImportFeedItems([{ id: nextFeedId(), role: 'assistant', text: fallbackImportNarration('welcome') }]);
    if (fetchImportNarration) {
      void fetchImportNarration({ kind: 'welcome', file_name: fileName })
        .then(({ text }) => {
          const t = String(text || '').trim();
          if (!t) return;
          setImportFeedItems((prev) => [
            ...prev,
            { id: nextFeedId(), role: 'assistant', text: t, flavored: true },
          ]);
        })
        .catch(() => {});
    }
    setWizardOpen(true);
  }, [fileKey, isPro, onUnlockRequest, fetchImportNarration, fileName]);

  /** Discard wizard state and exit full-screen flow (after user confirms). */
  const abortImportFlow = useCallback(() => {
    importFlowCancelledRef.current = true;
    setShowCancelConfirm(false);
    setWizardOpen(false);
    setWizardStep(0);
    setWizardError(null);
    setIndexResult(null);
    setWizardCapture(null);
    setImportFlowPhase('none');
    setRulesSummary(null);
    setIntroStepLoading(null);
    setImportSessionConfirmed(false);
    setImportFeedItems([]);
    progressLogIdRef.current = null;
    rulesDigestDoneRef.current = false;
    onBusyChange(false);
  }, [onBusyChange]);

  const INTRO_STEP_MIN_MS = 2000;

  const continueFromIntroStep = useCallback(async (fromStep: 0 | 1, nextStep: number) => {
    importFlowCancelledRef.current = false;
    setIntroStepLoading(fromStep);
    try {
      await Promise.all([
        new Promise<void>((resolve) => setTimeout(resolve, INTRO_STEP_MIN_MS)),
        // Future: add real async prep here; advance only when delay and work both complete.
      ]);
      if (importFlowCancelledRef.current) return;
      setWizardError(null);
      setWizardStep(nextStep);
    } finally {
      setIntroStepLoading(null);
    }
  }, []);

  const finishWizard = useCallback(async () => {
    if (finalizeLoading) return;
    setFinalizeLoading(true);
    if (!fileKey) {
      onBusyChange(false);
      setFinalizeLoading(false);
      return;
    }
    const tierGate = canFreeTierUseFileForDsImport(fileKey, isPro);
    if (!tierGate.ok) {
      onUnlockRequest();
      onBusyChange(false);
      setFinalizeLoading(false);
      return;
    }

    const label =
      selectedImport?.fileKey === fileKey
        ? selectedImport.displayName
        : fileName || 'This file';

    if (!wizardCapture?.fullIndex) {
      showToast({
        title: 'Server: nessuno snapshot inviato',
        description:
          'Manca l’indice completo (wizard). Rifai lo step componenti e conferma di nuovo: altrimenti su /ds-imports/context il payload resta vuoto.',
        variant: 'warning',
        dismissible: true,
      });
      onBusyChange(false);
      setFinalizeLoading(false);
      return;
    }

    const topLevel =
      wizardCapture.fullIndex && typeof wizardCapture.fullIndex === 'object'
        ? (wizardCapture.fullIndex as Record<string, unknown>)
        : null;
    const componentCountFromIndex =
      indexResult?.catalogPreview?.inIndex ??
      (Array.isArray(topLevel?.components) ? topLevel!.components.length : 0);
    const tokenCountFromIndex =
      typeof topLevel?.total_tokens === 'number'
        ? topLevel.total_tokens
        : (indexResult?.total_tokens ?? 0);
    const hashForMeta =
      (wizardCapture?.hash || '').trim() ||
      (typeof topLevel?.hash === 'string' ? topLevel.hash : '') ||
        '';
    const h =
      wizardCapture.hash.trim() ||
      String((wizardCapture.fullIndex as { hash?: string }).hash || '').trim() ||
      '';

    const toneTrim = wizardToneOfVoice.trim();
    const kwList = wizardBrandKeywords
      .split(/[,;\n]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
    const wizardSignals: Record<string, unknown> = {};
    if (toneTrim) wizardSignals.tone_of_voice = toneTrim;
    if (kwList.length) wizardSignals.brand_voice_keywords = kwList;
    const indexToSave =
      Object.keys(wizardSignals).length > 0
        ? { ...(wizardCapture.fullIndex as Record<string, unknown>), wizard_signals: wizardSignals }
        : wizardCapture.fullIndex;

    onBusyChange(true);
    setWizardError(null);
    try {
      await persistDsImportToServer({
        figma_file_key: fileKey,
        display_name: label,
        figma_file_name: fileName || '',
        ds_cache_hash: h,
        ds_context_index: indexToSave,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setWizardError(msg);
      showToast({
        title: 'Salvataggio non completato',
        description: `${msg} Il catalogo non è considerato pronto finché il server non conferma lo snapshot. Riprova.`,
        variant: 'warning',
        dismissible: true,
      });
      onBusyChange(false);
      setFinalizeLoading(false);
      return;
    }

    upsertDsImport({
      fileKey,
      displayName: label,
      figmaFileName: fileName || '',
    });
    if (!isPro) enforceSingleImportForFreeTier();
    setImports(loadDsImports());

    let metaRes: { ok: boolean; error?: string } = { ok: false, error: 'Unknown metadata write error' };
    try {
      metaRes = await writeDsImportMeta({
        fileKey,
        importedAt: new Date().toISOString(),
        dsCacheHash: hashForMeta,
        componentCount: componentCountFromIndex,
        tokenCount: tokenCountFromIndex,
        name: label,
      });
    } catch (err) {
      metaRes = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    if (!metaRes.ok) {
      const err = metaRes.error || 'Timeout writing DS metadata';
      showToast({
        title: 'Metadati Figma non salvati',
        description: `${err} Lo snapshot è comunque sul server e verificato; il catalogo è sbloccato. Puoi ripetere l’import se vuoi riscrivere i metadati locali.`,
        variant: 'warning',
        dismissible: true,
      });
    }

    setSessionCatalogPrepared(fileKey);
    onCatalogReady();
    setWizardOpen(false);
    onBusyChange(false);
    setFinalizeLoading(false);
  }, [
    finalizeLoading,
    fileKey,
    fileName,
    selectedImport,
    wizardCapture,
    persistDsImportToServer,
    onCatalogReady,
    onBusyChange,
    showToast,
    indexResult,
    writeDsImportMeta,
    isPro,
    onUnlockRequest,
    wizardToneOfVoice,
    wizardBrandKeywords,
  ]);

  const parseIndexToSummary = useCallback((raw: object): DsIndexSummary => {
    const idx = raw as Record<string, unknown>;
    return {
      fileName: typeof idx.fileName === 'string' ? idx.fileName : undefined,
      total_tokens: typeof idx.total_tokens === 'number' ? idx.total_tokens : 0,
      token_categories:
        idx.token_categories && typeof idx.token_categories === 'object' && !Array.isArray(idx.token_categories)
          ? (idx.token_categories as Record<string, number>)
          : {},
      variable_names: Array.isArray(idx.variable_names)
        ? idx.variable_names
            .map((x) => String(x || '').trim())
            .filter((x) => x.length > 0)
        : [],
      styles_summary:
        idx.styles_summary &&
        typeof idx.styles_summary === 'object' &&
        idx.styles_summary !== null &&
        !Array.isArray(idx.styles_summary)
          ? (idx.styles_summary as DsIndexSummary['styles_summary'])
          : undefined,
      components: Array.isArray(idx.components) ? idx.components : [],
      components_truncated: idx.components_truncated === true,
      total_components_in_file:
        typeof idx.total_components_in_file === 'number' ? idx.total_components_in_file : undefined,
      rules_summary:
        idx.rules_summary &&
        typeof idx.rules_summary === 'object' &&
        idx.rules_summary !== null &&
        !Array.isArray(idx.rules_summary)
          ? (idx.rules_summary as DsIndexSummary['rules_summary'])
          : undefined,
    };
  }, []);

  // Step 0: read explicit DS rules/guidance from file metadata or documentation pages.
  useEffect(() => {
    if (!wizardOpen || !importSessionConfirmed || wizardStep !== 0 || rulesSummary || wizardError) return;
    let cancelled = false;
    (async () => {
      const res = await requestDsContextIndex({ reuseCached: false, timeoutMs: 60000, phase: 'rules' });
      if (cancelled) return;
      if (res.error || !res.index || typeof res.index !== 'object') return;
      const parsed = parseIndexToSummary(res.index as object);
      if (parsed.rules_summary) setRulesSummary(parsed.rules_summary);
      else setRulesSummary({ source: 'none', rules: [], guidance: [] });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    wizardOpen,
    importSessionConfirmed,
    wizardStep,
    rulesSummary,
    wizardError,
    requestDsContextIndex,
    parseIndexToSummary,
  ]);

  useEffect(() => {
    if (!wizardOpen || !importSessionConfirmed || !rulesSummary || rulesDigestDoneRef.current) return;
    rulesDigestDoneRef.current = true;
    const rCount = rulesSummary.rules?.length ?? 0;
    const gCount = rulesSummary.guidance?.length ?? 0;
    const digest =
      rCount + gCount > 0
        ? `Rules pass: pulled ${rCount} global rule line(s) and ${gCount} guidance snippet(s) from this file — I'll treat them as hard context for Generate.`
        : `No explicit rules doc surfaced — I'll lean harder on tokens, components, and naming in the next passes.`;
    setImportFeedItems((prev) => [...prev, { id: nextFeedId(), role: 'assistant', text: digest }]);
  }, [wizardOpen, importSessionConfirmed, rulesSummary]);

  // Step 2: variables + styles only (no component scan)
  useEffect(() => {
    if (!wizardOpen || wizardStep !== 2 || importFlowPhase !== 'none' || wizardError) return;
    let cancelled = false;
    onBusyChange(true);
    (async () => {
      const res = await requestDsContextIndex({ reuseCached: false, timeoutMs: 120000, phase: 'tokens' });
      if (cancelled) return;
      if (res.error || !res.index || typeof res.index !== 'object') {
        setWizardError(res.error || 'Could not read variables and styles from Figma.');
        onBusyChange(false);
        return;
      }
      const parsed = parseIndexToSummary(res.index as object);
      setIndexResult(parsed);
      setImportFlowPhase('tokens');
      setImportFeedItems((prev) => [
        ...prev,
        {
          id: nextFeedId(),
          role: 'action_log',
          title: 'Reading variables & local styles',
          lines: [
            'requestDsContextIndex · phase: tokens',
            `total_tokens: ${parsed.total_tokens}`,
            parsed.styles_summary
              ? `styles — paint ${parsed.styles_summary.paintStyles}, text ${parsed.styles_summary.textStyles}, effects ${parsed.styles_summary.effectStyles}`
              : 'styles: (none reported)',
          ],
        },
        { id: nextFeedId(), role: 'assistant', text: fallbackImportNarration('tokens_done') },
      ]);
      if (fetchImportNarration) {
        const hint = `total_tokens=${parsed.total_tokens}; paint=${parsed.styles_summary?.paintStyles ?? 0}; text=${parsed.styles_summary?.textStyles ?? 0}`;
        void fetchImportNarration({ kind: 'tokens_done', file_name: fileName, hint })
          .then(({ text }) => {
            const t = String(text || '').trim();
            if (!t) return;
            setImportFeedItems((prev) => [
              ...prev,
              { id: nextFeedId(), role: 'assistant', text: t, flavored: true },
            ]);
          })
          .catch(() => {});
      }
      onBusyChange(false);
    })();
    return () => {
      cancelled = true;
      onBusyChange(false);
    };
  }, [
    wizardOpen,
    wizardStep,
    importFlowPhase,
    wizardError,
    requestDsContextIndex,
    onBusyChange,
    parseIndexToSummary,
    fetchImportNarration,
    fileName,
  ]);

  // Step 3: component scan + merge (final hash for persist)
  useEffect(() => {
    if (!wizardOpen || wizardStep !== 3 || importFlowPhase !== 'tokens' || wizardError) return;
    let cancelled = false;
    onBusyChange(true);
    setComponentsScanProgress(null);
    progressLogIdRef.current = null;
    setImportFeedItems((prev) => [
      ...prev,
      {
        id: nextFeedId(),
        role: 'action_log',
        title: 'Listing Figma file · component catalog',
        lines: [
          'requestDsContextIndex · phase: components',
          'Walking pages for COMPONENT / COMPONENT_SET instances',
        ],
      },
    ]);
    (async () => {
      const res = await requestDsContextIndex({
        reuseCached: false,
        timeoutMs: 120000,
        phase: 'components',
        onProgress: (p) => {
          if (cancelled) return;
          setComponentsScanProgress({
            pageName: p.pageName,
            pageIndex: p.pageIndex,
            pageTotal: p.pageTotal,
            scanned: p.scanned,
          });
          const title = `Scanning components · page ${p.pageIndex}/${p.pageTotal}`;
          const lines = [`${p.pageName || 'Unnamed page'}`, `Indexed so far: ${p.scanned}`];
          setImportFeedItems((prev) => {
            const pid = progressLogIdRef.current;
            if (pid) {
              return prev.map((x) =>
                x.id === pid && x.role === 'action_log' ? { ...x, title, lines } : x,
              );
            }
            const nid = nextFeedId();
            progressLogIdRef.current = nid;
            return [...prev, { id: nid, role: 'action_log', title, lines }];
          });
        },
      });
      if (cancelled) return;
      if (res.error || !res.index || typeof res.index !== 'object') {
        setWizardError(res.error || 'Could not scan components in this file.');
        onBusyChange(false);
        return;
      }
      const parsed = parseIndexToSummary(res.index as object);
      const parts = countIndexedCatalogParts(parsed.components);
      const inIndex = parsed.components.length;
      const logoLike = parsed.components.filter((c) =>
        hasSemanticSignal(c, /\b(logo|brand|wordmark|logotype)\b/i, { includeSlotHints: true }),
      ).length;
      const titleLike = parsed.components.filter((c) =>
        hasSemanticSignal(c, /\b(title|heading|headline|hero title|h1|h2)\b/i, { includeSlotHints: true }),
      ).length;
      const descriptionLike = parsed.components.filter((c) =>
        hasSemanticSignal(
          c,
          /\b(description|subtitle|subheading|helper|supporting text|body|caption|subtext)\b/i,
          { includeSlotHints: true },
        ),
      ).length;
      // Drop full component rows from React state after scan — keeps step 4/5 responsive and lowers memory pressure.
      setIndexResult({
        ...parsed,
        components: [],
        catalogPreview: { inIndex, sets: parts.sets, singles: parts.singles, logoLike, titleLike, descriptionLike },
      });
      const hash =
        (res.hash && String(res.hash).trim()) ||
        String((res.index as { hash?: string }).hash || '').trim() ||
        '';
      setWizardCapture({ fullIndex: res.index as object, hash });
      setImportFlowPhase('full');
      progressLogIdRef.current = null;
      setImportFeedItems((prev) => [
        ...prev,
        { id: nextFeedId(), role: 'assistant', text: fallbackImportNarration('components_done') },
      ]);
      if (fetchImportNarration) {
        const hint = `indexed=${inIndex}; sets=${parts.sets}; singles=${parts.singles}; logoLike=${logoLike}; titleLike=${titleLike}`;
        void fetchImportNarration({ kind: 'components_done', file_name: fileName, hint })
          .then(({ text }) => {
            const t = String(text || '').trim();
            if (!t) return;
            setImportFeedItems((prev) => [
              ...prev,
              { id: nextFeedId(), role: 'assistant', text: t, flavored: true },
            ]);
          })
          .catch(() => {});
      }
      onBusyChange(false);
    })();
    return () => {
      cancelled = true;
      setComponentsScanProgress(null);
      onBusyChange(false);
    };
  }, [
    wizardOpen,
    wizardStep,
    importFlowPhase,
    wizardError,
    requestDsContextIndex,
    onBusyChange,
    parseIndexToSummary,
    fetchImportNarration,
    fileName,
  ]);

  const dismissIntro = () => {
    writeIntroSeen();
    setIntroSeen(true);
  };

  if (fileContextLoading) {
    return (
      <div className={`${BRUTAL.card} bg-white border-2 border-black p-3`}>
        <p className="text-[10px] font-bold uppercase text-gray-600">Connecting to file…</p>
      </div>
    );
  }

  if (fileContextError || !fileKey) {
    return (
      <div className={`${BRUTAL.card} bg-amber-50 border-2 border-amber-700 p-3`}>
        <p className="text-[10px] font-bold text-amber-900">
          {fileContextError ||
            'We could not read the file. Open a saved file in Figma and try again.'}
        </p>
      </div>
    );
  }

  if (catalogReady) return null;

  return (
    <>
      {!introSeen && (
        <div className={`${BRUTAL.card} bg-[#fff8e7] border-2 border-black p-3`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold leading-snug text-black">
              Import your design system for this file before generating.
            </p>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                className="text-[10px] font-black uppercase underline hover:text-[#ff90e8]"
                onClick={() => {
                  blurActiveElement();
                  setShowWhyModal(true);
                }}
              >
                Read first
              </button>
              <Button variant="secondary" className="text-[10px] px-2 py-1" onClick={dismissIntro}>
                OK, I understand
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className={`${BRUTAL.card} bg-white border-2 border-black p-3 space-y-3`}>
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-sm font-black uppercase leading-tight sm:text-base">Design system in file</h3>
          <span className="text-xs font-normal text-gray-500 truncate max-w-[160px] text-right" title={fileKey}>
            {fileName || 'Untitled file'}
          </span>
        </div>

        {needsProForCurrentFile ? (
          <>
            <p className="text-sm font-normal text-gray-900 leading-normal">
              <strong>Free</strong> includes <strong>one</strong> linked Figma file for Custom (Current). The file you
              have open is <strong>not</strong> that linked file — import here requires <strong>Pro</strong> (multiple
              design systems and files).
            </p>
            <Button
              variant="primary"
              fullWidth
              className="relative min-h-[44px]"
              onClick={onUnlockRequest}
              disabled={dsImportBusy}
            >
              <span className="relative z-10">
                {dsImportBusy ? 'Importing…' : 'Import Design System'}
              </span>
              {!dsImportBusy && (
                <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1.5 py-0.5 font-black uppercase rounded-sm border border-black">
                  Pro
                </span>
              )}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm font-normal text-gray-900 leading-normal">
              No verified server snapshot for this file yet. Complete the import wizard: we only unlock Generate after
              the snapshot is saved and read back from your account.
            </p>
            {isPro && imports.length > 1 && (
              <p className="text-[10px] text-gray-600 leading-snug">
                You have {imports.length} design systems saved; this file still needs its own import (or open a file
                that already has one).
              </p>
            )}
            <Button variant="primary" fullWidth className="min-h-[44px]" onClick={openWizard} disabled={dsImportBusy}>
              {dsImportBusy ? 'Importing…' : 'Import Design System'}
            </Button>
          </>
        )}
      </div>

      {showWhyModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowWhyModal(false)}
        >
          <div
            className={`${BRUTAL.card} bg-white max-w-md w-full p-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="font-black uppercase text-sm mb-2">Why import?</h4>
            <p className="text-[11px] text-gray-700 leading-snug mb-3">
              Generate needs to know which components, variables, and conventions exist in <strong>your</strong>{' '}
              file so outputs match your real design system and do not invent patterns that are not in the project.
              We do not use this data to train generic AI — see the notice above the tab bar for more.
            </p>
            <Button variant="secondary" className="text-xs w-full" onClick={() => setShowWhyModal(false)}>
              Close
            </Button>
          </div>
        </div>
      )}

      {wizardOpen && (
        <div
          data-component="GenerateDsImport: Full-screen import flow"
          className="fixed inset-0 z-[300] flex flex-col bg-[#fdfdfd] text-black"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-flow-title"
        >
          <style>{`
            @keyframes fill-cta-bar {
              0% { width: 0%; }
              100% { width: 100%; }
            }
          `}</style>
          <header className="shrink-0 border-b-2 border-black bg-white shadow-[0_2px_0_0_#000] flex items-center justify-between gap-2 px-3 py-3">
            <h2 id="import-flow-title" className="text-xs font-black uppercase tracking-wide truncate pr-2">
              {importSessionConfirmed ? 'Import design system' : 'Connect to this file'}
            </h2>
            <button
              type="button"
              className="shrink-0 size-9 border-2 border-black bg-white font-black text-sm shadow-[3px_3px_0_0_#000] hover:bg-gray-100 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_2px_0_0_#000]"
              aria-label="Close import"
              onClick={() => setShowCancelConfirm(true)}
            >
              ✕
            </button>
          </header>

          {importSessionConfirmed ? (
            <div className="shrink-0 border-b-2 border-black bg-neutral-100 pt-4 pb-0">
              <ImportFlowStepper currentStep={wizardStep} />
            </div>
          ) : null}

          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4">
            <div className="flex w-full flex-col gap-3">
              {!importSessionConfirmed ? (
                <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
                  <p className="text-left text-sm leading-relaxed text-neutral-700">
                    Comtra reads your design system from the <strong>live session</strong> you already have open. Confirm
                    below, then we walk tokens, styles, and components together.
                  </p>
                  <ImportConversationalPanel items={importFeedItems} />
                </div>
              ) : (
                <>
                  <ImportConversationalPanel items={importFeedItems} />
              <div className="flex flex-col gap-1.5">
                <h3 className="font-black uppercase text-base leading-tight">
                  {WIZARD_TEXT[wizardStep]?.title}
                </h3>
                <p className="text-sm text-gray-800 leading-relaxed">{WIZARD_TEXT[wizardStep]?.body}</p>
              </div>

              {wizardError && (
                <div className="bg-red-50 border-2 border-red-500 p-3 text-xs font-medium text-red-900">
                  {wizardError}
                </div>
              )}

              {(wizardStep === 0 || wizardStep === 1) && (
                <div className="border-2 border-black bg-neutral-50 p-3 shadow-[3px_3px_0_0_#000]">
                  {rulesSummary && (rulesSummary.rules.length > 0 || rulesSummary.guidance.length > 0) ? (
                    <div className="space-y-3 text-xs">
                      <p className="font-black uppercase text-[11px]">
                        Source: {rulesSummary.source === 'plugin_data' ? 'Global DS metadata' : 'Documentation pages'}
                      </p>
                      {wizardStep === 0 && rulesSummary.rules.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black uppercase text-gray-600">Global rules found</p>
                          <ul className="mt-1 space-y-1">
                            {rulesSummary.rules.slice(0, 4).map((r, i) => (
                              <li key={`rule-${i}`} className="leading-snug">
                                - {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {wizardStep === 1 && rulesSummary.guidance.length > 0 && (
                        <div>
                          <p className="text-[10px] font-black uppercase text-gray-600">Guidance found</p>
                          <ul className="mt-1 space-y-1">
                            {rulesSummary.guidance.slice(0, 4).map((g, i) => (
                              <li key={`guidance-${i}`} className="leading-snug">
                                - {g}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs leading-snug text-gray-700">
                      No explicit global rules found in this file. Comtra will fallback to inferred guidance from
                      tokens, styles, component structure, and naming conventions in the next steps.
                    </p>
                  )}
                </div>
              )}

              {wizardStep === 2 && dsImportBusy && importFlowPhase === 'none' && !wizardError && (
                <p className="text-xs font-black uppercase animate-pulse">
                  Reading variables and local styles…
                </p>
              )}

              {wizardStep === 2 && indexResult && importFlowPhase !== 'none' && (
                <ul className="text-xs space-y-2 border-2 border-black p-3 bg-gray-50 shadow-[3px_3px_0_0_#000]">
                  <li>
                    <strong>Variables (tokens):</strong> {indexResult.total_tokens}
                  </li>
                  {indexResult.styles_summary && (
                    <li>
                      <strong>Local styles:</strong> paint {indexResult.styles_summary.paintStyles}, text{' '}
                      {indexResult.styles_summary.textStyles}, effects {indexResult.styles_summary.effectStyles}
                    </li>
                  )}
                  {Object.keys(indexResult.token_categories).length > 0 && (
                    <li className="text-gray-600">
                      {Object.entries(indexResult.token_categories)
                        .map(([k, n]) => `${k}: ${n}`)
                        .join(' · ')}
                    </li>
                  )}
                </ul>
              )}

              {wizardStep === 3 && dsImportBusy && importFlowPhase === 'tokens' && !wizardError && (
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase animate-pulse">Scanning components and variant sets…</p>
                  <p className="text-[9px] text-gray-600 leading-snug">
                    File grandi: contare fino a ~1–2 minuti; in coda c’è l’indice per il catalogo e l’hash usato da
                    Generate.
                  </p>
                  {componentsScanProgress && componentsScanProgress.pageTotal > 0 && (
                    <div className="border-2 border-black bg-white p-2 shadow-[2px_2px_0_0_#000]">
                      <p className="text-[10px] font-black uppercase">
                        Page {componentsScanProgress.pageIndex}/{componentsScanProgress.pageTotal}:{' '}
                        <span className="font-bold normal-case">{componentsScanProgress.pageName || 'Unnamed'}</span>
                      </p>
                      <p className="mt-1 text-[10px] font-bold text-gray-700">
                        Indexed so far: {componentsScanProgress.scanned}
                      </p>
                      <div className="mt-1 h-2 border border-black bg-neutral-100">
                        <div
                          className="h-full bg-[#ff90e8] transition-[width] duration-150 ease-out"
                          style={{
                            width: `${Math.max(
                              2,
                              Math.min(
                                100,
                                Math.round((componentsScanProgress.pageIndex / componentsScanProgress.pageTotal) * 100),
                              ),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {wizardStep === 3 && indexResult && importFlowPhase === 'full' && (
                <ImportComponentsCatalogCard
                  components={indexResult.components}
                  catalogPreview={indexResult.catalogPreview}
                  components_truncated={indexResult.components_truncated}
                  total_components_in_file={indexResult.total_components_in_file}
                />
              )}

              {wizardStep === 4 && indexResult && importFlowPhase === 'full' && (
                <div className="space-y-3">
                  <div className="space-y-2 border-2 border-black p-3 bg-white shadow-[2px_2px_0_0_#000]">
                    <p className="text-[10px] font-black uppercase tracking-tight">Brand voice (optional)</p>
                    <p className="text-[10px] text-gray-600 leading-snug">
                      Used for Design Intelligence v2: Kimi enriches on-screen copy to match your tone. Stored in this
                      file&apos;s DS snapshot as <code className="font-mono text-[9px]">wizard_signals</code>.
                    </p>
                    <label className="block text-[10px] font-bold uppercase text-gray-700">Tone of voice</label>
                    <textarea
                      className="w-full min-h-[72px] border-2 border-black p-2 text-xs font-medium"
                      value={wizardToneOfVoice}
                      onChange={(e) => setWizardToneOfVoice(e.target.value)}
                      placeholder="e.g. Confident, minimal, first-person plural"
                      maxLength={800}
                    />
                    <label className="block text-[10px] font-bold uppercase text-gray-700 mt-2">
                      Keywords (comma-separated)
                    </label>
                    <input
                      type="text"
                      className="w-full border-2 border-black p-2 text-xs font-medium"
                      value={wizardBrandKeywords}
                      onChange={(e) => setWizardBrandKeywords(e.target.value)}
                      placeholder="playful, direct, empowering"
                    />
                  </div>
                  <ul className="text-xs space-y-2 border-2 border-black p-3 bg-gray-50 shadow-[3px_3px_0_0_#000]">
                    <li>
                      <strong>File:</strong> {indexResult.fileName || fileName || '—'}
                    </li>
                    <li>
                      <strong>Tokens:</strong> {indexResult.total_tokens}
                    </li>
                    {indexResult.styles_summary && (
                      <li>
                        <strong>Styles:</strong> paint {indexResult.styles_summary.paintStyles}, text{' '}
                        {indexResult.styles_summary.textStyles}, effects {indexResult.styles_summary.effectStyles}
                      </li>
                    )}
                    <li>
                      <strong>Components in index:</strong>{' '}
                      {indexResult.catalogPreview?.inIndex ?? indexResult.components.length}
                      {indexResult.components_truncated ? ' (truncated)' : ''}
                    </li>
                  </ul>
                  <WizardWarningsTable rows={buildWizardWarningRows(indexResult)} />
                </div>
              )}

              {step2GapHints.length > 0 && (
                <WizardImportGapSnackbars
                  hints={step2GapHints}
                  ariaLabel="Variables and styles notes"
                />
              )}

              {step3GapHints.length > 0 && (
                <WizardImportGapSnackbars
                  hints={step3GapHints}
                  ariaLabel="Components catalog notes"
                />
              )}
                </>
              )}
            </div>
          </div>

          <footer className="shrink-0 border-t-2 border-black bg-white px-3 py-4 shadow-[0_-4px_0_0_rgba(0,0,0,0.06)]">
            <div className="flex w-full gap-2 items-stretch">
              {!importSessionConfirmed ? (
                <Button
                  variant="primary"
                  fullWidth
                  className="min-h-[48px] text-xs font-black uppercase py-3 shadow-[3px_3px_0_0_#000]"
                  onClick={acknowledgeImportSession}
                >
                  Use this Figma session — start import
                </Button>
              ) : wizardStep === 0 ? (
                <Button
                  variant="primary"
                  fullWidth
                  disabled={introStepLoading !== null}
                  className="relative overflow-hidden text-sm font-black py-3"
                  onClick={() => void continueFromIntroStep(0, 1)}
                >
                  {introStepLoading === 0 ? (
                    <span className="absolute inset-0">
                      <span
                        className="absolute inset-y-0 left-0 bg-yellow-300"
                        style={{ animation: `fill-cta-bar ${INTRO_STEP_MIN_MS}ms linear forwards` }}
                        aria-hidden
                      />
                    </span>
                  ) : null}
                  <span className="relative z-10 w-full text-center">
                    {introStepLoading === 0 ? 'Loading…' : 'Continue'}
                  </span>
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    className="flex-1 min-h-[44px] text-xs font-black py-3"
                    disabled={
                      introStepLoading !== null ||
                      (wizardStep === 2 && dsImportBusy && importFlowPhase === 'none') ||
                      (wizardStep === 3 && dsImportBusy && importFlowPhase === 'tokens')
                    }
                    onClick={() => {
                      setWizardError(null);
                      setWizardStep((s) => Math.max(0, s - 1));
                    }}
                  >
                    Back
                  </Button>
                  {wizardStep === 1 && (
                    <Button
                      variant="primary"
                      className="relative flex-1 min-h-[44px] overflow-hidden text-xs font-black py-3"
                      disabled={introStepLoading !== null}
                      onClick={() => void continueFromIntroStep(1, 2)}
                    >
                      {introStepLoading === 1 ? (
                        <span className="absolute inset-0">
                          <span
                            className="absolute inset-y-0 left-0 bg-yellow-300"
                            style={{ animation: `fill-cta-bar ${INTRO_STEP_MIN_MS}ms linear forwards` }}
                            aria-hidden
                          />
                        </span>
                      ) : null}
                      <span className="relative z-10 w-full text-center">
                        {introStepLoading === 1 ? 'Loading…' : 'Continue'}
                      </span>
                    </Button>
                  )}
                  {wizardStep === 2 && importFlowPhase !== 'none' && indexResult && !wizardError && (
                    <Button variant="primary" className="flex-1 min-h-[44px] text-xs font-black py-3" onClick={() => setWizardStep(3)}>
                      Continue
                    </Button>
                  )}
                  {wizardStep === 2 && wizardError && (
                    <Button
                      variant="primary"
                      className="flex-1 min-h-[44px] text-xs font-black py-3"
                      onClick={() => {
                        setWizardError(null);
                        setIndexResult(null);
                        setImportFlowPhase('none');
                      }}
                    >
                      Retry
                    </Button>
                  )}
                  {wizardStep === 3 && importFlowPhase === 'full' && indexResult && !wizardError && (
                    <Button variant="primary" className="flex-1 min-h-[44px] text-xs font-black py-3" onClick={() => setWizardStep(4)}>
                      Continue
                    </Button>
                  )}
                  {wizardStep === 3 && wizardError && (
                    <Button
                      variant="primary"
                      className="flex-1 min-h-[44px] text-xs font-black py-3"
                      onClick={() => {
                        setWizardError(null);
                        setWizardCapture(null);
                      }}
                    >
                      Retry
                    </Button>
                  )}
                  {wizardStep === 4 && importFlowPhase === 'full' && wizardCapture && (
                    <Button
                      variant="primary"
                      className="relative flex-1 min-h-[44px] overflow-hidden text-xs font-black uppercase py-3"
                      disabled={finalizeLoading || dsImportBusy}
                      onClick={() => {
                        void finishWizard();
                      }}
                    >
                      {finalizeLoading ? (
                        <span className="absolute inset-0">
                          <span
                            className="absolute inset-y-0 left-0 bg-yellow-300"
                            style={{ animation: `fill-cta-bar ${INTRO_STEP_MIN_MS}ms linear forwards` }}
                            aria-hidden
                          />
                        </span>
                      ) : null}
                      <span className="relative z-10 w-full text-center">
                        {finalizeLoading ? 'Importing…' : 'Confirm and import'}
                      </span>
                    </Button>
                  )}
                  {wizardStep === 2 && dsImportBusy && importFlowPhase === 'none' && !wizardError && (
                    <div className="flex-1 flex items-center justify-center text-[10px] font-black uppercase text-gray-500 border-2 border-dashed border-gray-300 px-2">
                      Please wait…
                    </div>
                  )}
                  {wizardStep === 3 && dsImportBusy && importFlowPhase === 'tokens' && !wizardError && (
                    <div className="flex-1 flex items-center justify-center text-[10px] font-black uppercase text-gray-500 border-2 border-dashed border-gray-300 px-2">
                      Please wait…
                    </div>
                  )}
                </>
              )}
            </div>
          </footer>

          {showCancelConfirm && (
            <div
              className="fixed inset-0 z-[310] flex items-center justify-center bg-black/50 p-4"
              onClick={() => setShowCancelConfirm(false)}
            >
              <div
                className={`${BRUTAL.card} bg-white max-w-sm w-full p-4`}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-black uppercase text-sm mb-2">Cancel import?</h3>
                <p className="text-xs text-gray-700 leading-snug mb-4">
                  Any data loaded in this session will be discarded. You can start the import again later.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                  <Button variant="secondary" className="flex-1 text-xs" onClick={() => setShowCancelConfirm(false)}>
                    Keep importing
                  </Button>
                  <Button variant="black" className="flex-1 text-xs" onClick={abortImportFlow}>
                    Cancel import
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
