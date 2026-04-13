import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BRUTAL } from '../constants';
import { Button } from '../components/ui/Button';
import {
  loadDsImports,
  upsertDsImport,
  hasImportForFileKey,
  setSessionCatalogPrepared,
  enforceSingleImportForFreeTier,
  canFreeTierUseFileForDsImport,
  type StoredDsImport,
} from '../lib/dsImportsStorage';
import { safeLocalStorageGetItem, safeLocalStorageSetItem } from '../lib/safeWebStorage';

const INTRO_SEEN_KEY = 'comtra-generate-ds-intro-seen';

export type RequestDsContextIndexFn = (opts: {
  reuseCached: boolean;
  timeoutMs?: number;
  /** Wizard: read tokens/styles only, or merge component scan (after tokens). */
  phase?: 'rules' | 'tokens' | 'components';
}) => Promise<{ index: object | null; hash: string | null; error?: string }>;

type DsIndexSummary = {
  fileName?: string;
  total_tokens: number;
  token_categories: Record<string, number>;
  styles_summary?: { paintStyles: number; textStyles: number; effectStyles: number };
  components: unknown[];
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

function readIntroSeen(): boolean {
  return safeLocalStorageGetItem(INTRO_SEEN_KEY) === '1';
}

function writeIntroSeen(): void {
  safeLocalStorageSetItem(INTRO_SEEN_KEY, '1');
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
    <div className="w-full px-3 pb-1" role="navigation" aria-label="Import steps">
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
                  className="flex min-h-[5.5rem] min-w-0 flex-col items-center justify-start gap-2 pt-0"
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
                  <span className="flex min-h-[2.75rem] w-full items-start justify-center px-1 text-center text-[12px] font-black uppercase leading-snug tracking-wide text-gray-600">
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
                className="flex min-h-[5.5rem] min-w-0 flex-col items-center justify-start gap-2 pt-0"
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
                  className={`flex min-h-[2.75rem] w-full items-start justify-center px-1 text-center text-[12px] font-black uppercase leading-snug tracking-wide text-balance ${
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
      body: 'Tokens tie color, spacing, and typography to a single source of truth. When none exist, Generate still runs, but values are less likely to match your published system and library modes.',
    });
  }
  const st = s.styles_summary;
  const stylesEmpty = !st || st.paintStyles + st.textStyles + st.effectStyles === 0;
  if (stylesEmpty) {
    hints.push({
      id: 'styles',
      title: 'No local paint, text, or effect styles',
      body: 'Styles capture how type and surfaces are meant to look in production. Many teams rely only on variables — that is fine — but if you use styles elsewhere, adding them here keeps generated frames closer to your real UI polish.',
    });
  }
  return hints;
}

/** Step Components: after full merge only. */
function buildComponentsGapHints(s: DsIndexSummary): ImportGapHint[] {
  if (s.components.length === 0) {
    return [
      {
        id: 'components',
        title: 'No components in the index',
        body: 'Comtra maps generated layouts to real Figma components and variants. Without a catalog, we cannot anchor screens to the instances you maintain — outputs stay more generic and harder to hand off.',
      },
    ];
  }
  return [];
}

function WizardImportGapSnackbars({
  hints,
  dismissedIds,
  onDismiss,
  ariaLabel,
}: {
  hints: ImportGapHint[];
  dismissedIds: Set<string>;
  onDismiss: (id: string) => void;
  ariaLabel: string;
}) {
  const visible = hints.filter((h) => !dismissedIds.has(h.id));
  if (visible.length === 0) return null;
  return (
    <div className="shrink-0 space-y-2 border-t-2 border-dashed border-gray-300 bg-neutral-50 px-3 py-3" role="region" aria-label={ariaLabel}>
      {visible.map((h) => (
        <div
          key={h.id}
          className="flex gap-2 border-2 border-amber-800 bg-amber-50 p-2.5 shadow-[3px_3px_0_0_#000]"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase leading-tight tracking-wide text-amber-950">{h.title}</p>
            <p className="mt-1 text-[11px] font-medium leading-snug text-amber-950/95">{h.body}</p>
          </div>
          <button
            type="button"
            className="shrink-0 size-7 border-2 border-black bg-white text-sm font-black leading-none text-black shadow-[2px_2px_0_0_#000] hover:bg-amber-100"
            aria-label={`Dismiss: ${h.title}`}
            onClick={() => onDismiss(h.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function ImportComponentsCatalogCard({
  components,
  components_truncated,
  total_components_in_file,
}: {
  components: unknown[];
  components_truncated?: boolean;
  total_components_in_file?: number;
}) {
  const { sets, singles } = countIndexedCatalogParts(components);
  const n = components.length;
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
      {truncated && fileTotal != null && (
        <div className="flex gap-2 border-t-2 border-amber-700 bg-amber-50 px-3 py-2.5 text-[11px] font-bold leading-snug text-amber-950">
          <span className="shrink-0 rounded-sm border border-amber-800 bg-amber-200 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-950">
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
  /** If false, only one DS file on Free; another Figma file triggers Pro upsell. */
  isPro: boolean;
  onUnlockRequest: () => void;
  persistDsImportToServer: (body: {
    figma_file_key: string;
    display_name: string;
    figma_file_name: string;
    ds_cache_hash: string;
    ds_context_index: object;
  }) => Promise<void>;
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
}) => {
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
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [rulesSummary, setRulesSummary] = useState<DsIndexSummary['rules_summary'] | null>(null);
  /** Tokens loaded vs full index with components (for split Figma reads). */
  const [importFlowPhase, setImportFlowPhase] = useState<ImportFlowPhase>('none');
  /** Minimum dwell on intro steps (Rules + Guidance) with CTA progress bar. */
  const [introStepLoading, setIntroStepLoading] = useState<IntroStepLoading>(null);
  const importFlowCancelledRef = useRef(false);
  const [dismissedStep2GapIds, setDismissedStep2GapIds] = useState<string[]>([]);
  const [dismissedStep3GapIds, setDismissedStep3GapIds] = useState<string[]>([]);
  const dismissedStep2GapSet = useMemo(() => new Set(dismissedStep2GapIds), [dismissedStep2GapIds]);
  const dismissedStep3GapSet = useMemo(() => new Set(dismissedStep3GapIds), [dismissedStep3GapIds]);

  const step2GapHints = useMemo(() => {
    if (wizardStep !== 2 || !indexResult || importFlowPhase === 'none') return [];
    return buildTokenAndStyleGapHints(indexResult);
  }, [wizardStep, indexResult, importFlowPhase]);

  const step3GapHints = useMemo(() => {
    if (wizardStep !== 3 || !indexResult || importFlowPhase !== 'full') return [];
    return buildComponentsGapHints(indexResult);
  }, [wizardStep, indexResult, importFlowPhase]);

  useEffect(() => {
    if (wizardStep !== 2) setDismissedStep2GapIds([]);
  }, [wizardStep]);

  useEffect(() => {
    if (wizardStep !== 3) setDismissedStep3GapIds([]);
  }, [wizardStep]);

  const dismissStep2Gap = useCallback((id: string) => {
    setDismissedStep2GapIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const dismissStep3Gap = useCallback((id: string) => {
    setDismissedStep3GapIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const keyMatch = Boolean(fileKey && hasImportForFileKey(fileKey));
  const hasCatalogForCurrentFile = keyMatch || catalogReady;
  const freeTierFileBlocked =
    !isPro &&
    fileKey &&
    canFreeTierUseFileForDsImport(fileKey, isPro).ok === false;
  /** Free: at most one record; Pro: show select only when more than one import exists. */
  const showImportSelect = isPro && imports.length > 1;

  useEffect(() => {
    if (!isPro) enforceSingleImportForFreeTier();
    setImports(loadDsImports());
  }, [fileKey, wizardOpen, isPro]);

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

  const mismatchLabel =
    selectedImport && fileKey && selectedImport.fileKey !== fileKey
      ? 'The catalog is always read from the Figma file you have open. The selected entry refers to a different file saved earlier.'
      : null;

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
    importFlowCancelledRef.current = false;
    setWizardOpen(true);
  }, [fileKey, isPro, onUnlockRequest]);

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

  const finishWizard = useCallback(() => {
    if (fileKey) {
      const gate = canFreeTierUseFileForDsImport(fileKey, isPro);
      if (!gate.ok) {
        onBusyChange(false);
        setWizardOpen(false);
        onUnlockRequest();
        return;
      }
      const label =
        selectedImport?.fileKey === fileKey
          ? selectedImport.displayName
          : fileName || 'This file';
      upsertDsImport({
        fileKey,
        displayName: label,
        figmaFileName: fileName || '',
      });
      if (!isPro) enforceSingleImportForFreeTier();
      setImports(loadDsImports());
      if (wizardCapture?.fullIndex) {
        const h =
          wizardCapture.hash.trim() ||
          String((wizardCapture.fullIndex as { hash?: string }).hash || '').trim() ||
          '';
        void persistDsImportToServer({
          figma_file_key: fileKey,
          display_name: label,
          figma_file_name: fileName || '',
          ds_cache_hash: h,
          ds_context_index: wizardCapture.fullIndex,
        }).catch(() => {
          /* offline / 403: local state still valid */
        });
      }
    }
    if (fileKey) setSessionCatalogPrepared(fileKey);
    onCatalogReady();
    setWizardOpen(false);
    onBusyChange(false);
  }, [
    fileKey,
    fileName,
    selectedImport,
    wizardCapture,
    persistDsImportToServer,
    onCatalogReady,
    onBusyChange,
    isPro,
    onUnlockRequest,
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
    if (!wizardOpen || wizardStep !== 0 || rulesSummary || wizardError) return;
    let cancelled = false;
    (async () => {
      const res = await requestDsContextIndex({ reuseCached: false, timeoutMs: 60000, phase: 'rules' });
      if (cancelled) return;
      if (res.error || !res.index || typeof res.index !== 'object') return;
      const parsed = parseIndexToSummary(res.index as object);
      if (parsed.rules_summary) setRulesSummary(parsed.rules_summary);
    })();
    return () => {
      cancelled = true;
    };
  }, [wizardOpen, wizardStep, rulesSummary, wizardError, requestDsContextIndex, parseIndexToSummary]);

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
      setIndexResult(parseIndexToSummary(res.index as object));
      setImportFlowPhase('tokens');
      onBusyChange(false);
    })();
    return () => {
      cancelled = true;
      onBusyChange(false);
    };
  }, [wizardOpen, wizardStep, importFlowPhase, wizardError, requestDsContextIndex, onBusyChange, parseIndexToSummary]);

  // Step 3: component scan + merge (final hash for persist)
  useEffect(() => {
    if (!wizardOpen || wizardStep !== 3 || importFlowPhase !== 'tokens' || wizardError) return;
    let cancelled = false;
    onBusyChange(true);
    (async () => {
      const res = await requestDsContextIndex({ reuseCached: false, timeoutMs: 120000, phase: 'components' });
      if (cancelled) return;
      if (res.error || !res.index || typeof res.index !== 'object') {
        setWizardError(res.error || 'Could not scan components in this file.');
        onBusyChange(false);
        return;
      }
      setIndexResult(parseIndexToSummary(res.index as object));
      const hash =
        (res.hash && String(res.hash).trim()) ||
        String((res.index as { hash?: string }).hash || '').trim() ||
        '';
      setWizardCapture({ fullIndex: res.index as object, hash });
      setImportFlowPhase('full');
      onBusyChange(false);
    })();
    return () => {
      cancelled = true;
      onBusyChange(false);
    };
  }, [wizardOpen, wizardStep, importFlowPhase, wizardError, requestDsContextIndex, onBusyChange, parseIndexToSummary]);

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

  if (freeTierFileBlocked) {
    return (
      <div className={`${BRUTAL.card} bg-violet-50 border-2 border-black p-3 space-y-3`}>
        <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold leading-snug text-black">
              On <strong>Free</strong> you already linked a design system. To import and use Generate with{' '}
              <strong>another</strong> Figma file you need <strong>Pro</strong> (multiple files and DS).
            </p>
            <span className="shrink-0 text-[9px] font-black uppercase bg-black text-white px-2 py-1 border-2 border-black shadow-[2px_2px_0_0_#ff90e8]">
              Pro
            </span>
          </div>
        <Button variant="primary" fullWidth className="relative text-xs" onClick={onUnlockRequest}>
          Unlock Pro
          <span className="absolute bottom-0.5 right-1 text-[8px] bg-[#ff90e8] text-black px-1 font-bold rounded-sm border border-black">
            PRO
          </span>
        </Button>
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
                onClick={() => setShowWhyModal(true)}
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

        {hasCatalogForCurrentFile ? (
          <>
            {showImportSelect ? (
              <>
                <label className="block text-sm font-bold text-gray-700">Your imported design systems</label>
                <select
                  className="w-full border-2 border-black p-2 text-sm font-bold bg-white"
                  value={selectedImportId ?? ''}
                  onChange={(e) => setSelectedImportId(e.target.value || null)}
                  disabled={dsImportBusy}
                >
                  {imports.map((imp) => (
                    <option key={imp.id} value={imp.id}>
                      {imp.displayName}
                      {imp.figmaFileName && imp.figmaFileName !== imp.displayName
                        ? ` · ${imp.figmaFileName}`
                        : ''}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <p className="text-sm font-normal text-gray-900 leading-normal">
                <span className="font-bold">Linked DS:</span>{' '}
                {selectedImport?.displayName || fileName || 'This file'}
              </p>
            )}
            <p className="text-sm font-normal text-gray-900 leading-normal">
              This file is already in your imported design systems. You can update the snapshot anytime.
            </p>
            {mismatchLabel && (
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-300 p-2 leading-snug">{mismatchLabel}</p>
            )}
            <Button
              variant="primary"
              fullWidth
              className="text-lg font-black leading-[1.15] py-3.5 px-4 text-center"
              onClick={openWizard}
              disabled={dsImportBusy}
            >
              {dsImportBusy ? 'Importing…' : 'Update Design System'}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm font-normal text-gray-900 leading-normal">
              This file is not yet among the design systems you imported. Start an import from this Figma file.
            </p>
            <Button
              variant="primary"
              fullWidth
              className="text-lg font-black leading-[1.15] py-3.5 px-4 text-center"
              onClick={openWizard}
              disabled={dsImportBusy}
            >
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
              Import design system
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

          <div className="shrink-0 border-b-2 border-black bg-neutral-100 pt-4 pb-4">
            <ImportFlowStepper currentStep={wizardStep} />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-5">
            <div className="flex w-full flex-col gap-4">
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
                <p className="text-xs font-black uppercase animate-pulse">Scanning components and variant sets…</p>
              )}

              {wizardStep === 3 && indexResult && importFlowPhase === 'full' && (
                <ImportComponentsCatalogCard
                  components={indexResult.components}
                  components_truncated={indexResult.components_truncated}
                  total_components_in_file={indexResult.total_components_in_file}
                />
              )}

              {wizardStep === 4 && indexResult && importFlowPhase === 'full' && (
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
                    <strong>Components in index:</strong> {indexResult.components.length}
                    {indexResult.components_truncated ? ' (truncated)' : ''}
                  </li>
                </ul>
              )}

              {step2GapHints.length > 0 && (
                <WizardImportGapSnackbars
                  hints={step2GapHints}
                  dismissedIds={dismissedStep2GapSet}
                  onDismiss={dismissStep2Gap}
                  ariaLabel="Variables and styles notes"
                />
              )}

              {step3GapHints.length > 0 && (
                <WizardImportGapSnackbars
                  hints={step3GapHints}
                  dismissedIds={dismissedStep3GapSet}
                  onDismiss={dismissStep3Gap}
                  ariaLabel="Components catalog notes"
                />
              )}
            </div>
          </div>

          <footer className="shrink-0 border-t-2 border-black bg-white px-3 py-4 shadow-[0_-4px_0_0_rgba(0,0,0,0.06)]">
            <div className="flex w-full gap-2 items-stretch">
              {wizardStep === 0 ? (
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
                    className="flex-1 text-xs font-black py-3"
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
                      className="relative flex-1 overflow-hidden text-xs font-black py-3"
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
                    </span>
                    </Button>
                  )}
                  {wizardStep === 2 && importFlowPhase !== 'none' && indexResult && !wizardError && (
                    <Button variant="primary" className="flex-1 text-xs font-black py-3" onClick={() => setWizardStep(3)}>
                      Continue
                    </Button>
                  )}
                  {wizardStep === 2 && wizardError && (
                    <Button
                      variant="primary"
                      className="flex-1 text-xs font-black py-3"
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
                    <Button variant="primary" className="flex-1 text-xs font-black py-3" onClick={() => setWizardStep(4)}>
                      Continue
                    </Button>
                  )}
                  {wizardStep === 3 && wizardError && (
                    <Button
                      variant="primary"
                      className="flex-1 text-xs font-black py-3"
                      onClick={() => {
                        setWizardError(null);
                        setWizardCapture(null);
                      }}
                    >
                      Retry
                    </Button>
                  )}
                  {wizardStep === 4 && importFlowPhase === 'full' && wizardCapture && (
                    <Button variant="primary" className="flex-1 text-xs font-black uppercase py-3" onClick={finishWizard}>
                      Confirm and import
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
