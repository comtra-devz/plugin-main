
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  SyncTabProps,
  BRUTAL,
  type SourceConnectionInput,
  type SourceProvider,
  type SourceScanResult,
  type StorybookConnectionInfo,
  type SyncDriftItem,
} from '../types';
import { Button } from '../../../components/ui/Button';
import { BrutalToggle } from '../../../components/ui/BrutalToggle';
import { SyncStorybookGuideModal } from '../../../components/SyncStorybookGuideModal';
import {
  BrutalDropdown,
  brutalSelectOptionRowClass,
  brutalSelectOptionSelectedClass,
} from '../../../components/ui/BrutalSelect';

const PRESET_STORYBOOKS: { label: string; value: string }[] = [
  { label: 'Custom URL…', value: '' },
  { label: 'Carbon Design System (IBM)', value: 'https://react.carbondesignsystem.com' },
  { label: 'Chakra UI', value: 'https://chakra-ui.netlify.app' },
  { label: 'SAP Fundamental Styles', value: 'https://sap.github.io/fundamental-styles' },
  { label: 'Grafana UI', value: 'https://developers.grafana.com/ui/latest' },
  { label: 'Ring UI (JetBrains)', value: 'https://jetbrains.github.io/ring-ui/master' },
  { label: 'GitLab UI', value: 'https://gitlab-org.gitlab.io/gitlab/storybook' },
];

/**
 * Host per cui il plugin può fare fetch diretto (devono essere in manifest.json networkAccess.allowedDomains).
 * Per URL con altri host usiamo solo il backend, così non scattano errori CSP e il server fa la richiesta.
 */
const CLIENT_ALLOWED_STORYBOOK_ORIGINS = new Set([
  'https://jetbrains.github.io',
  'https://react.carbondesignsystem.com',
  'https://chakra-ui.netlify.app',
  'https://sap.github.io',
  'https://developers.grafana.com',
  'https://gitlab-org.gitlab.io',
  'https://chromatic.com',
]);

/** Normalizza URL Storybook: rimuove query e hash così il check usa la base corretta (es. .../master/?path=... → .../master). */
function normalizeStorybookUrl(input: string): string {
  const s = (input || '').trim();
  if (!s) return s;
  try {
    const u = new URL(s);
    const pathname = u.pathname.replace(/\/$/, '') || '';
    return u.origin + pathname;
  } catch {
    return s.replace(/\/$/, '');
  }
}

/** Path comuni per la lista stories (allineati al backend): più varianti = meno rigidità. */
const STORYBOOK_LIST_PATHS = [
  '/api/stories',
  '/api/components',
  '/index.json',
  '/stories.json',
  '/storybook/index.json',
  '/api/storybook/stories',
];

type SyncCategoryId = 'ALL' | 'MISSING' | 'NAMING' | 'VARIANTS' | 'SOURCE' | 'AUTO_FIXABLE' | 'MANUAL';
type SourceWizardStep = 0 | 1 | 2;

const SOURCE_PROVIDER_LABELS: Record<SourceProvider, string> = {
  github: 'GitHub',
  bitbucket: 'Bitbucket',
  gitlab: 'GitLab',
  custom: 'Custom source',
};

const SOURCE_WIZARD_STEPS = [
  { title: 'Source', body: 'Choose provider, connect auth, then configure repository details in the same step.' },
  { title: 'Detect', body: 'Scan the source for Storybook config, stories, package manager, and component paths.' },
  { title: 'Review', body: 'Confirm the source connection before running code-side sync.' },
] as const;

const SOURCE_STEPPER_TOTAL = SOURCE_WIZARD_STEPS.length;
const SOURCE_STEPPER_NODE_HALF = 20; // 40px node
const SOURCE_STEPPER_RAIL_LEFT_PCT = 100 / (SOURCE_STEPPER_TOTAL * 2);
const SOURCE_STEPPER_RAIL_WIDTH_PCT = 100 - SOURCE_STEPPER_RAIL_LEFT_PCT * 2;

const DEEP_SYNC_LOADER_STEPS = [
  'Reading Storybook index',
  'Fetching repo structure',
  'Mapping component identities',
  'Analyzing drift',
  'Generating sync plan',
] as const;

const SYNC_CATEGORY_META: Record<Exclude<SyncCategoryId, 'ALL' | 'AUTO_FIXABLE' | 'MANUAL'>, { label: string; desc: string; tone: string }> = {
  MISSING: {
    label: 'Missing Coverage',
    desc: 'Components or stories exist only on one side.',
    tone: 'bg-red-50 border-red-200 text-red-700',
  },
  NAMING: {
    label: 'Naming & Mapping',
    desc: 'Likely matches need naming alignment or confirmation.',
    tone: 'bg-blue-50 border-blue-200 text-blue-700',
  },
  VARIANTS: {
    label: 'Variants & States',
    desc: 'Variant values, states or story args do not line up.',
    tone: 'bg-purple-50 border-purple-200 text-purple-700',
  },
  SOURCE: {
    label: 'Source Setup',
    desc: 'Repository/source connection required for code-side sync.',
    tone: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  },
};

const FILTER_LABELS: Record<SyncCategoryId, string> = {
  ALL: 'All',
  MISSING: 'Missing',
  NAMING: 'Naming',
  VARIANTS: 'Variants',
  SOURCE: 'Source',
  AUTO_FIXABLE: 'Auto-fixable',
  MANUAL: 'Manual',
};

const MAX_ITEMS_PER_SECTION = 80;

function getSyncCategory(item: SyncDriftItem): Exclude<SyncCategoryId, 'ALL' | 'AUTO_FIXABLE' | 'MANUAL'> {
  if (item.status === 'NAME_MISMATCH' || item.status === 'POTENTIAL_MATCH') return 'NAMING';
  if (item.status === 'VARIANT_MISMATCH') return 'VARIANTS';
  return 'MISSING';
}

function getSyncHealthScore(items: SyncDriftItem[]): number {
  if (items.length === 0) return 100;
  const penalty = Math.min(95, Math.round(Math.log10(items.length + 1) * 28));
  return Math.max(5, 100 - penalty);
}

function SourceWizardStepper({ currentStep }: { currentStep: SourceWizardStep }) {
  const trackProgress = SOURCE_STEPPER_TOTAL > 1 ? currentStep / (SOURCE_STEPPER_TOTAL - 1) : 0;
  const railTop = `${SOURCE_STEPPER_NODE_HALF}px`;
  return (
    <div className="w-full px-3" role="navigation" aria-label="Connect source steps">
      <p className="sr-only">
        Step {currentStep + 1} of {SOURCE_STEPPER_TOTAL}
      </p>
      <div className="relative py-0.5">
        <div
          className="pointer-events-none absolute z-0 h-1 rounded-full bg-gray-300"
          style={{ left: `${SOURCE_STEPPER_RAIL_LEFT_PCT}%`, width: `${SOURCE_STEPPER_RAIL_WIDTH_PCT}%`, top: railTop }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute z-0 h-1 rounded-full bg-black transition-[width] duration-300 ease-out"
          style={{
            left: `${SOURCE_STEPPER_RAIL_LEFT_PCT}%`,
            top: railTop,
            width: `calc(${SOURCE_STEPPER_RAIL_WIDTH_PCT}% * ${trackProgress})`,
          }}
          aria-hidden
        />
        <div
          className="relative z-10 grid w-full gap-0"
          style={{ gridTemplateColumns: `repeat(${SOURCE_STEPPER_TOTAL}, minmax(0, 1fr))` }}
        >
          {SOURCE_WIZARD_STEPS.map((step, index) => {
            const active = index === currentStep;
            const completed = index < currentStep;
            return (
              <div key={step.title} className="flex min-h-[4.75rem] min-w-0 flex-col items-center justify-start gap-2 pt-0">
                <div
                  className={`flex size-10 shrink-0 items-center justify-center border-2 border-black text-xs font-black tabular-nums leading-none shadow-[3px_3px_0_0_#000] transition-transform duration-200 ${
                    completed
                      ? 'bg-black text-white'
                      : active
                        ? 'bg-[#ff90e8] text-black ring-2 ring-black ring-offset-2 ring-offset-neutral-100'
                        : 'bg-white text-gray-400'
                  } ${active ? 'z-20 scale-[1.02]' : ''}`}
                >
                  {completed ? <span className="text-base leading-none">✓</span> : index + 1}
                </div>
                <span
                  className={`flex min-h-[2rem] w-full items-start justify-center px-1 text-center text-[12px] font-black uppercase leading-snug tracking-wide ${
                    active ? 'text-black' : completed ? 'text-gray-800' : 'text-gray-400'
                  }`}
                >
                  {step.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Verifica se il JSON di risposta contiene una lista stories/componenti in formato riconosciuto. */
function isStorybookListResponse(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.stories)) return true;
  if (Array.isArray(d.components)) return true;
  if (Array.isArray(data)) return true;
  if (d.entries && typeof d.entries === 'object' && !Array.isArray(d.entries)) return Object.keys(d.entries as object).length > 0;
  if (d.stories && typeof d.stories === 'object' && !Array.isArray(d.stories)) return true;
  const v2 = d.v2 && typeof d.v2 === 'object' ? (d.v2 as Record<string, unknown>) : null;
  if (v2?.entries && typeof v2.entries === 'object') return true;
  return false;
}

/** Check Storybook lato client (browser): prova tutti i path comuni e accetta più strutture JSON. Per URL pubblici evita il backend. */
async function checkStorybookFromClient(
  baseUrl: string,
  token?: string
): Promise<{ ok: boolean; error?: string } & StorybookConnectionInfo> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token?.trim()) headers['Authorization'] = /^bearer\s+/i.test(token.trim()) ? token.trim() : `Bearer ${token.trim()}`;

  for (const path of STORYBOOK_LIST_PATHS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(baseUrl + path, { headers, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) continue;
      const data = await res.json();
      if (isStorybookListResponse(data)) {
        const d = data as Record<string, unknown>;
        const storyCount = Array.isArray(d.stories)
          ? d.stories.length
          : d.stories && typeof d.stories === 'object' && !Array.isArray(d.stories)
            ? Object.keys(d.stories as object).length
            : d.entries && typeof d.entries === 'object' && !Array.isArray(d.entries)
              ? Object.keys(d.entries as object).length
              : Array.isArray(data)
                ? data.length
                : d.v2 && typeof d.v2 === 'object' && (d.v2 as Record<string, unknown>).entries && typeof (d.v2 as Record<string, unknown>).entries === 'object'
                  ? Object.keys((d.v2 as { entries: object }).entries).length
                  : 0;
        const componentCount = Array.isArray(d.components) ? d.components.length : 0;
        return {
          ok: true,
          endpointPath: path,
          endpointUrl: baseUrl + path,
          entryCount: storyCount + componentCount,
          storyCount,
          componentCount,
          checkedVia: 'client',
        };
      }
    } catch {
      // CORS, network, timeout: try next URL
    }
  }
  return { ok: false, error: 'Stories API not found at this URL. Add an endpoint (see guide below) or check the URL.' };
}

export const SyncTab: React.FC<SyncTabProps> = ({
  isPro,
  onUnlockRequest,
  activeSyncTab,
  setActiveSyncTab,
  isSbConnected,
  storybookUrl,
  storybookToken,
  handleConnectSb,
  fetchCheckStorybook,
  onDisconnectSb,
  hasSyncScanned,
  handleSyncScan,
  isSyncScanning,
  getRemainingTime,
  syncItems,
  syncScanError,
  syncScanUpgradeUrl,
  expandedDriftId,
  setExpandedDriftId,
  handleSelectLayer,
  layerSelectionFeedback,
  handleSyncItem,
  handleSyncAll,
  sourceConnection,
  sourceConnectionLoading,
  sourceConnectionSaving,
  sourceConnectionError,
  sourceAuthStartUrl,
  activeSyncFileKey,
  activeSyncFileName,
  syncLinkedFiles,
  rememberedStorybooksForFile,
  onRestoreStorybookForFile,
  onSelectSyncFile,
  onLoadSourceConnection,
  onSaveSourceConnection,
  onDeleteSourceConnection,
  onScanSourceConnection,
  onStartSourceAuth,
  lastSyncAllDate,
  syncScanVariant = 'legacy',
  syncReconcileMeta = null,
}) => {
  const [connectInput, setConnectInput] = useState(storybookUrl || '');
  const [tokenInput, setTokenInput] = useState(storybookToken || '');
  const [usePrivateToken, setUsePrivateToken] = useState(!!storybookToken);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isPresetOpen, setIsPresetOpen] = useState(false);
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<SyncCategoryId>('ALL');
  const [sourceWhyDialogOpen, setSourceWhyDialogOpen] = useState(false);
  const [sourceWizardOpen, setSourceWizardOpen] = useState(false);
  const [sourceWizardStep, setSourceWizardStep] = useState<SourceWizardStep>(0);
  const [sourceProvider, setSourceProvider] = useState<SourceProvider>('github');
  const [sourceRepoUrl, setSourceRepoUrl] = useState('');
  const [sourceBranch, setSourceBranch] = useState('main');
  const [sourceStorybookPath, setSourceStorybookPath] = useState('');
  const [sourceTokenInput, setSourceTokenInput] = useState('');
  const [sourceScanDraft, setSourceScanDraft] = useState<SourceScanResult | null>(null);
  const [sourceWizardError, setSourceWizardError] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<
    Partial<Record<Exclude<SyncCategoryId, 'ALL' | 'AUTO_FIXABLE' | 'MANUAL'>, boolean>>
  >({});
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [deepLoaderIx, setDeepLoaderIx] = useState(0);
  const filtersRowRef = useRef<HTMLDivElement | null>(null);
  const draggingFiltersRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollRef = useRef(0);

  const selectedPresetLabel = PRESET_STORYBOOKS.find((p) => p.value === connectInput)?.label ?? 'Custom URL…';
  const quickPickOptions = useMemo(() => {
    const recent = (rememberedStorybooksForFile || []).map((u) => ({
      label: `Recent for this file: ${u}`,
      value: u,
    }));
    const preset = PRESET_STORYBOOKS.filter((p) => !recent.some((r) => r.value === p.value));
    return [...recent, ...preset];
  }, [rememberedStorybooksForFile]);
  const syncFileOptions = useMemo(
    () =>
      syncLinkedFiles.length > 0
        ? syncLinkedFiles
        : [
            {
              fileKey: activeSyncFileKey || 'current',
              fileName: activeSyncFileName || 'Current file',
              storybookUrl: storybookUrl || '',
              lastUsedAt: new Date().toISOString(),
            },
          ],
    [activeSyncFileKey, activeSyncFileName, storybookUrl, syncLinkedFiles],
  );
  useEffect(() => {
    if (!isSyncScanning || syncScanVariant !== 'deep') {
      setDeepLoaderIx(0);
      return;
    }
    const t = window.setInterval(() => {
      setDeepLoaderIx((i) => (i + 1) % DEEP_SYNC_LOADER_STEPS.length);
    }, 2000);
    return () => window.clearInterval(t);
  }, [isSyncScanning, syncScanVariant]);

  const deepBuckets = useMemo(() => {
    const inSync: SyncDriftItem[] = [];
    const needsReview: SyncDriftItem[] = [];
    const drift: SyncDriftItem[] = [];
    const unFigma: SyncDriftItem[] = [];
    const unStory: SyncDriftItem[] = [];
    for (const it of syncItems) {
      const c = it.syncCategory;
      if (c === 'in_sync') inSync.push(it);
      else if (c === 'needs_review') needsReview.push(it);
      else if (c === 'unmatched_figma') unFigma.push(it);
      else if (c === 'unmatched_story') unStory.push(it);
      else if (c === 'drift' || !c) drift.push(it);
      else drift.push(it);
    }
    return { inSync, needsReview, drift, unFigma, unStory };
  }, [syncItems]);

  const syncOverview = useMemo(() => {
    const sections: Record<Exclude<SyncCategoryId, 'ALL' | 'AUTO_FIXABLE' | 'MANUAL'>, SyncDriftItem[]> = {
      MISSING: [],
      NAMING: [],
      VARIANTS: [],
      SOURCE: [],
    };
    for (const item of syncItems) sections[getSyncCategory(item)].push(item);
    if (syncItems.length > 0 && !sourceConnection) {
      sections.SOURCE.push({
        id: 'source-setup-required',
        name: 'Connect source repository',
        status: 'SOURCE_REQUIRED',
        lastEdited: '—',
        desc: 'Sync All requires the repository or source that builds this Storybook.',
        reason: 'Storybook is read-only metadata. Code changes must be pushed to the source repository/provider.',
        confidence: 'high',
        suggestedAction: 'Connect GitHub, Bitbucket, GitLab, or a custom source before running Sync All.',
        layerId: null,
        syncAction: null,
      });
    } else if (syncItems.length > 0 && sourceConnection?.status !== 'ready') {
      sections.SOURCE.push({
        id: 'source-setup-attention',
        name: 'Source needs attention',
        status: 'SOURCE_REQUIRED',
        lastEdited: '—',
        desc: 'The source repository is connected, but detection is not fully ready yet.',
        reason: sourceConnection.scan?.issues?.[0] || 'Run source detection or review manual setup before code-side Sync All.',
        confidence: sourceConnection.scan?.confidence || 'medium',
        suggestedAction: 'Open Connect Source, run detection again, or confirm the Storybook path manually.',
        layerId: null,
        syncAction: null,
      });
    }
    const autoFixable = syncItems.filter((item) => item.syncAction).length;
    const manual = syncItems.length - autoFixable;
    const score = getSyncHealthScore(syncItems);
    return {
      sections,
      autoFixable,
      manual,
      score,
      total: syncItems.length,
    };
  }, [syncItems, sourceConnection]);

  const visibleSections = useMemo(() => {
    const entries = Object.entries(syncOverview.sections) as Array<[Exclude<SyncCategoryId, 'ALL' | 'AUTO_FIXABLE' | 'MANUAL'>, SyncDriftItem[]]>;
    if (activeFilter === 'ALL') return entries.filter(([, items]) => items.length > 0);
    if (activeFilter === 'AUTO_FIXABLE') {
      return entries
        .map(([id, items]) => [id, items.filter((item) => item.syncAction)] as const)
        .filter(([, items]) => items.length > 0);
    }
    if (activeFilter === 'MANUAL') {
      return entries
        .map(([id, items]) => [id, items.filter((item) => !item.syncAction)] as const)
        .filter(([, items]) => items.length > 0);
    }
    return [[activeFilter, syncOverview.sections[activeFilter]] as const].filter(([, items]) => items.length > 0);
  }, [activeFilter, syncOverview]);

  const getDriftBadgeClass = (status: string) => {
    if (status === 'SOURCE_REQUIRED') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (status === 'POTENTIAL_MATCH') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (status === 'NAME_MISMATCH') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (status === 'VARIANT_MISMATCH') return 'bg-purple-100 text-purple-700 border-purple-200';
    return 'bg-red-100 text-red-600 border-red-200';
  };

  const handleScanClick = () => {
    handleSyncScan();
  };

  const requestDisconnect = () => setShowDisconnectConfirm(true);

  const confirmDisconnect = async () => {
    if (sourceConnection) {
      await onDeleteSourceConnection();
    }
    onDisconnectSb?.();
    setShowDisconnectConfirm(false);
  };

  const startFiltersDrag = (clientX: number) => {
    const el = filtersRowRef.current;
    if (!el) return;
    draggingFiltersRef.current = true;
    dragStartXRef.current = clientX;
    dragStartScrollRef.current = el.scrollLeft;
    el.style.cursor = 'grabbing';
  };

  const moveFiltersDrag = (clientX: number) => {
    const el = filtersRowRef.current;
    if (!el || !draggingFiltersRef.current) return;
    const delta = clientX - dragStartXRef.current;
    el.scrollLeft = dragStartScrollRef.current - delta;
  };

  const endFiltersDrag = () => {
    draggingFiltersRef.current = false;
    const el = filtersRowRef.current;
    if (el) el.style.cursor = 'grab';
  };

  const resetSourceWizard = () => {
    setSourceWizardStep(0);
    setSourceProvider('github');
    setSourceRepoUrl('');
    setSourceBranch('main');
    setSourceStorybookPath('');
    setSourceTokenInput('');
    setSourceScanDraft(null);
    setSourceWizardError(null);
  };

  const openSourceWizardImmediate = (opts?: { editExisting: boolean }) => {
    const edit = opts?.editExisting === true;
    if (edit && sourceConnection) {
      setSourceProvider(sourceConnection.provider);
      setSourceRepoUrl(sourceConnection.repoUrl);
      setSourceBranch(sourceConnection.branch);
      setSourceStorybookPath(sourceConnection.storybookPath);
      setSourceTokenInput('');
      setSourceScanDraft(sourceConnection.scan ?? null);
    } else if (!edit) {
      resetSourceWizard();
    }
    setSourceWizardError(null);
    setSourceWhyDialogOpen(false);
    setSourceWizardStep(0);
    setSourceWizardOpen(true);
  };

  /** New connection: show Why dialog first; edit: go straight into the wizard at Source. */
  const openSourceWizardFromEntry = () => {
    if (sourceConnection) {
      openSourceWizardImmediate({ editExisting: true });
      return;
    }
    setSourceWhyDialogOpen(true);
  };

  const confirmSourceWhyDialog = () => {
    setSourceWhyDialogOpen(false);
    openSourceWizardImmediate({ editExisting: false });
  };

  const sourceInput: SourceConnectionInput = {
    provider: sourceProvider,
    repoUrl: sourceRepoUrl.trim(),
    branch: sourceBranch.trim() || 'main',
    storybookPath: sourceStorybookPath.trim(),
    sourceToken: sourceTokenInput.trim() || undefined,
  };

  const canContinueSourceWizard =
    (sourceWizardStep === 0 && sourceRepoUrl.trim().length > 0 && sourceBranch.trim().length > 0) ||
    sourceWizardStep === 1 ||
    sourceWizardStep === 2;

  const runSourceDetection = async () => {
    setSourceWizardError(null);
    const scan = await onScanSourceConnection(sourceInput);
    setSourceScanDraft(scan);
    if (scan?.status === 'failed') {
      setSourceWizardError(scan.issues?.[0] || 'Source detection failed.');
    }
    return scan;
  };

  const completeSourceWizard = async () => {
    setSourceWizardError(null);
    const saved = await onSaveSourceConnection(sourceInput);
    if (!saved) {
      setSourceWizardError('Could not save source connection.');
      return;
    }
    setSourceScanDraft(saved.scan ?? sourceScanDraft);
    setSourceWizardOpen(false);
  };

  const handleConnectClick = async () => {
    const raw = connectInput.trim();
    if (!raw || (!raw.startsWith('http://') && !raw.startsWith('https://'))) return;
    const url = normalizeStorybookUrl(raw);
    const token = usePrivateToken ? tokenInput.trim() || undefined : undefined;
    setConnectError(null);
    setIsConnecting(true);
    try {
      let result: ({ ok: boolean; error?: string } & StorybookConnectionInfo);
      let origin: string;
      try {
        origin = new URL(url).origin;
      } catch {
        origin = '';
      }
      const canFetchFromClient = !token && CLIENT_ALLOWED_STORYBOOK_ORIGINS.has(origin);
      if (canFetchFromClient) {
        result = await checkStorybookFromClient(url);
        if (!result.ok && fetchCheckStorybook) result = await fetchCheckStorybook(url, token);
      } else {
        // URL custom o token privato: solo backend. I token non passano mai dal browser/plugin fetch.
        result = fetchCheckStorybook ? await fetchCheckStorybook(url, token) : { ok: false, error: 'Backend not available.' };
      }
      if (result.ok) {
        handleConnectSb(url, token, result);
        if (url !== raw) setConnectInput(url);
      } else {
        setConnectError(result.error || 'Connection failed.');
      }
    } catch {
      setConnectError('Connection failed. If your Storybook URL is correct, check your internet connection and try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] relative overflow-hidden animate-in slide-in-from-right-2">
      <style>{`
        @keyframes fill-cta-bar {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="p-3 border-b-2 border-black bg-black text-white flex justify-between items-center">
        <h3 className="font-bold uppercase text-xs">Deep Sync</h3>
      </div>

      {/* TEMPORARY: PRO gate disabled for Deep Sync until Lemon Squeezy store is live — see docs/TO-DO-BEFORE-GOING-LIVE.md "Restore PRO gate for Deep Sync". When restoring, show upgrade block when !isPro with copy: "Need to connect a private Storybook or one behind SSO? Book a call for an enterprise setup." (Calendly link: https://calendly.com/comtra-enterprise) */}
      <div>
          <div className="grid grid-cols-3 border-b-2 border-black">
            <button 
              onClick={() => setActiveSyncTab('SB')}
              className={`py-3 px-2 text-[10px] font-bold uppercase transition-colors ${activeSyncTab === 'SB' ? 'bg-[#ff90e8] text-black' : 'bg-white hover:bg-gray-100'}`}
            >
              Storybook
            </button>
            <button 
              onClick={() => setActiveSyncTab('GH')}
              className={`py-3 px-2 text-[10px] font-bold uppercase transition-colors border-l-2 border-black ${activeSyncTab === 'GH' ? 'bg-[#ff90e8] text-black' : 'bg-white hover:bg-gray-100'}`}
            >
              GitHub
            </button>
            <button 
              onClick={() => setActiveSyncTab('BB')}
              className={`py-3 px-2 text-[10px] font-bold uppercase transition-colors border-l-2 border-black ${activeSyncTab === 'BB' ? 'bg-[#ff90e8] text-black' : 'bg-white hover:bg-gray-100'}`}
            >
              Bitbucket
            </button>
          </div>

          {activeSyncTab === 'SB' && (
            <div className="px-2 py-2 animate-in slide-in-from-left-2">
              {!isSbConnected ? (
                <div className="space-y-3">
                  <p className="text-xs font-medium">Pick a public Storybook or enter your own URL. We’ll check that it exposes the stories API.</p>
                  <div className="flex flex-col gap-2 relative z-20">
                    <label className="text-[10px] font-bold uppercase text-gray-600">Quick pick</label>
                    <BrutalDropdown
                      open={isPresetOpen}
                      onOpenChange={setIsPresetOpen}
                      className="w-full"
                      maxHeightClassName="max-h-48"
                      trigger={
                        <button
                          type="button"
                          onClick={() => setIsPresetOpen(!isPresetOpen)}
                          className={`${BRUTAL.input} w-full flex justify-between items-center gap-2 cursor-pointer h-10 bg-white px-3 py-2 text-left`}
                        >
                          <span className="text-xs font-bold uppercase truncate min-w-0" title={selectedPresetLabel}>
                            {selectedPresetLabel}
                          </span>
                          <span className="shrink-0 text-[10px]" aria-hidden>
                            {isPresetOpen ? '▲' : '▼'}
                          </span>
                        </button>
                      }
                    >
                      {quickPickOptions.map((p) => (
                        <div
                          key={p.value || 'custom'}
                          role="option"
                          onClick={() => {
                            setConnectInput(p.value);
                            setIsPresetOpen(false);
                          }}
                          className={`${brutalSelectOptionRowClass} ${p.value === connectInput ? brutalSelectOptionSelectedClass : ''}`.trim()}
                        >
                          {p.label}
                        </div>
                      ))}
                    </BrutalDropdown>
                    {rememberedStorybooksForFile && rememberedStorybooksForFile.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {rememberedStorybooksForFile.slice(0, 3).map((url) => (
                          <button
                            key={url}
                            type="button"
                            className="border border-black bg-neutral-100 px-1.5 py-0.5 text-[9px] font-bold hover:bg-[#ff90e8]"
                            onClick={() => {
                              onRestoreStorybookForFile?.(url);
                            }}
                          >
                            Reopen {url}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <label className="text-[10px] font-bold uppercase text-gray-600">Or paste URL</label>
                    <input
                      type="text"
                      inputMode="url"
                      autoComplete="url"
                      placeholder="https://jetbrains.github.io/ring-ui/master"
                      value={connectInput}
                      onChange={(e) => {
                        setConnectInput(e.target.value);
                      }}
                      className="w-full border-2 border-black px-3 py-2 text-xs font-mono placeholder:text-gray-400 outline-none min-w-0"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 border border-dashed border-gray-400 bg-gray-50 p-2">
                    <span className="text-[10px] font-bold uppercase text-gray-700">Private Storybook (use access token)</span>
                    <BrutalToggle
                      pressed={usePrivateToken}
                      onPressedChange={setUsePrivateToken}
                      aria-label="Use private Storybook access token"
                    />
                  </div>
                  {usePrivateToken && (
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Access token</label>
                      <input
                        type="password"
                        placeholder="Bearer token"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        className="w-full border-2 border-black px-3 py-2 text-xs font-mono placeholder:text-gray-400 outline-none"
                      />
                      <p className="text-[9px] text-gray-400 mt-0.5">Paste either the raw token or <code className="bg-gray-100 px-0.5">Bearer &lt;token&gt;</code>. Private checks run through the backend only.</p>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-500">If your build doesn’t expose GET /api/stories yet, add <strong>storybook-api</strong> to your project (same URL will then work). Use ngrok for local.</p>
                  {connectError && (
                    <div className="p-2 bg-red-50 border border-red-200 text-[10px] text-red-700">
                      {connectError}
                    </div>
                  )}
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={handleConnectClick}
                    disabled={!connectInput.trim() || isConnecting}
                    className="relative"
                  >
                    {isConnecting ? 'Checking…' : 'Connect Storybook'}
                    {!isPro ? (
                      <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">PRO</span>
                    ) : null}
                  </Button>
                  <div className="pt-2 mt-2 border-t border-gray-200">
                    <p className="text-[9px] text-gray-500 leading-relaxed">
                      <strong className="text-gray-700">Security:</strong> Your token is only sent over HTTPS to our backend for the scan and is not stored anywhere. We never log or persist it.
                    </p>
                  </div>
                  <div className="mt-3 p-2 border-2 border-dashed border-gray-300 bg-gray-50">
                    <p className="text-[10px] text-gray-600 mb-1.5">Your URL doesn’t work yet?</p>
                    <button
                      type="button"
                      onClick={() => setShowGuideModal(true)}
                      className="text-[10px] font-bold uppercase underline hover:text-pink-600"
                    >
                      How to expose the stories API →
                    </button>
                  </div>
                  {showGuideModal && <SyncStorybookGuideModal onClose={() => setShowGuideModal(false)} />}
                </div>
              ) : (
                <div>
                  {storybookUrl && (
                    <div className="mb-2">
                      <div className="space-y-1">
                        <label htmlFor="storybook-connected-url" className="block text-[10px] font-black uppercase text-gray-600">
                          Storybook Connected
                        </label>
                        <div className="flex items-center">
                          <div className="flex h-10 min-w-0 flex-1 items-center border-2 border-black bg-white pr-1">
                            <input
                              id="storybook-connected-url"
                              type="text"
                              readOnly
                              value={storybookUrl}
                              title={storybookUrl}
                              className="h-full min-w-0 flex-1 truncate bg-transparent px-2 text-xs font-mono outline-none"
                            />
                            {onDisconnectSb ? (
                              <button
                                type="button"
                                onClick={requestDisconnect}
                                className="flex size-7 shrink-0 items-center justify-center rounded-sm border border-transparent text-sm font-black text-red-700 hover:border-black hover:bg-red-50"
                                aria-label="Disconnect Storybook"
                              >
                                ×
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <label className="mb-1 block text-[10px] font-black uppercase text-gray-600">Figma file</label>
                        {syncFileOptions.length <= 1 ? (
                          <div className={`${BRUTAL.input} flex h-10 w-full items-center bg-white px-3 py-2`}>
                            <span className="min-w-0 truncate text-xs font-bold uppercase" title={activeSyncFileName || syncFileOptions[0]?.fileName || 'Current file'}>
                              {activeSyncFileName || syncFileOptions[0]?.fileName || 'Current file'}
                            </span>
                          </div>
                        ) : (
                          <BrutalDropdown
                            open={isFilePickerOpen}
                            onOpenChange={setIsFilePickerOpen}
                            className="w-full"
                            maxHeightClassName="max-h-44"
                            trigger={
                              <button
                                type="button"
                                onClick={() => setIsFilePickerOpen(!isFilePickerOpen)}
                                className={`${BRUTAL.input} w-full flex justify-between items-center gap-2 cursor-pointer h-10 bg-white px-3 py-2 text-left`}
                              >
                                <span className="text-xs font-bold uppercase truncate min-w-0" title={activeSyncFileName || 'Current file'}>
                                  {activeSyncFileName || 'Current file'}
                                </span>
                                <span className="shrink-0 text-[10px]" aria-hidden>
                                  {isFilePickerOpen ? '▲' : '▼'}
                                </span>
                              </button>
                            }
                          >
                            {syncFileOptions.map((f) => (
                              <div
                                key={`${f.fileKey}-${f.storybookUrl}`}
                                role="option"
                                onClick={() => {
                                  onSelectSyncFile(f.fileKey);
                                  setIsFilePickerOpen(false);
                                }}
                                className={`${brutalSelectOptionRowClass} ${f.fileKey === activeSyncFileKey ? brutalSelectOptionSelectedClass : ''}`.trim()}
                              >
                                <div className="flex w-full items-center justify-between gap-2">
                                  <span className="truncate">{f.fileName || f.fileKey}</span>
                                  {f.fileKey === activeSyncFileKey ? (
                                    <span className="shrink-0 border border-black bg-black px-1 text-[8px] font-black uppercase text-white">
                                      current
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </BrutalDropdown>
                        )}
                      </div>
                      <div
                        className={`mt-2 flex items-center gap-2 border-2 px-2 py-1.5 text-[9px] font-bold uppercase ${
                          sourceConnection?.status === 'ready'
                            ? 'border-green-600 bg-green-50 text-green-800'
                            : 'border-gray-400 bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span
                          className={`inline-block size-2 rounded-full ${sourceConnection?.status === 'ready' ? 'animate-pulse bg-green-500' : 'bg-gray-400'}`}
                          aria-hidden
                        />
                        {sourceConnection?.status === 'ready' ? (
                          <span>AI Agent ready</span>
                        ) : (
                          <span className="flex flex-wrap items-center gap-1">
                            Connect source to enable AI Sync
                            <button type="button" className="underline" onClick={openSourceWizardFromEntry}>
                              Open wizard
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {syncScanError && (
                    <div className="mb-3 p-2 bg-red-50 border border-red-200 text-[10px] text-red-700 space-y-1">
                      <p>{syncScanError}</p>
                      {syncScanUpgradeUrl ? (
                        <a
                          href={syncScanUpgradeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold underline text-red-900 block"
                        >
                          Upgrade your Figma plan for higher limits
                        </a>
                      ) : null}
                    </div>
                  )}
                  {!hasSyncScanned ? (
                    <div className="text-center">
                      {isSyncScanning && syncScanVariant === 'deep' ? (
                        <div className="mb-3 min-h-[100px] border-2 border-black bg-black p-3 text-left font-mono text-[10px] leading-relaxed text-green-400">
                          <div className="text-green-300">{DEEP_SYNC_LOADER_STEPS[deepLoaderIx]}</div>
                          <div className="mt-2 text-[9px] text-gray-500">
                            Deep Sync: Storybook + repository + Qwen mapping (or standard fallback if AI is unavailable).
                          </div>
                        </div>
                      ) : null}
                      {sourceConnectionLoading ? (
                        <p className="text-[10px] text-gray-500 mb-2">Checking existing source connection…</p>
                      ) : sourceConnection ? (
                        <>
                          <p className="text-[10px] text-gray-500 mb-2">Source connected. Start analysis.</p>
                          <Button
                            variant="black"
                            fullWidth
                            layout="row"
                            onClick={handleScanClick}
                            disabled={isSyncScanning || !!getRemainingTime('scan_sync')}
                            className={
                              `relative overflow-hidden${isSyncScanning ? ' disabled:!bg-[#ffc900] disabled:!text-black disabled:hover:!bg-[#ffb700] disabled:cursor-wait' : ''}`
                            }
                          >
                            {isSyncScanning ? (
                              <span className="absolute inset-0">
                                <span
                                  className="absolute inset-y-0 left-0 bg-yellow-300"
                                  style={{ animation: 'fill-cta-bar 45000ms linear 1 forwards' }}
                                  aria-hidden
                                />
                              </span>
                            ) : null}
                            <span className="relative z-10">
                              {isSyncScanning ? 'Analyzing Drift...' : getRemainingTime('scan_sync') ? `Wait ${getRemainingTime('scan_sync')}` : `Start Analysis`}
                            </span>
                            {!isSyncScanning && !getRemainingTime('scan_sync') && (
                              <span className="absolute bottom-0.5 right-1 z-10 text-[8px] bg-[#ff90e8] text-black px-1 font-bold rounded-sm">
                                {isPro ? 'Included' : '-15 Credits'}
                              </span>
                            )}
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] text-gray-500 mb-2">Step required before analysis: connect source.</p>
                          <Button variant="primary" fullWidth layout="row" onClick={openSourceWizardFromEntry} className="relative">
                            <span>Open Connect Source Wizard</span>
                            <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm border border-black">
                              Required
                            </span>
                          </Button>
                        </>
                      )}
                    </div>
                  ) : (
                    <div>
                      {syncItems.length === 0 ? (
                        null
                      ) : (
                        <>
                          <div className="mb-2 flex justify-end">
                            {syncReconcileMeta?.analysis_mode === 'ai' ? (
                              <span
                                className="border-2 border-violet-600 bg-violet-100 px-2 py-0.5 text-[8px] font-black uppercase text-violet-900"
                                title={syncReconcileMeta.reasoning_summary || 'AI analysis'}
                              >
                                AI Analysis
                              </span>
                            ) : syncReconcileMeta?.analysis_mode === 'standard' ? (
                              <span
                                className="border-2 border-gray-500 bg-gray-100 px-2 py-0.5 text-[8px] font-black uppercase text-gray-800"
                                title="AI agent temporarily unavailable — standard analysis."
                              >
                                Standard Analysis
                              </span>
                            ) : null}
                          </div>
                          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                            <div className={`${BRUTAL.card} bg-[#ffc900] p-2`}>
                              <div className="text-[9px] font-black uppercase">Sync Health</div>
                              <div className="text-2xl font-black leading-none">{syncOverview.score}</div>
                            </div>
                            <div className={`${BRUTAL.card} p-2`}>
                              <div className="text-[9px] font-black uppercase text-gray-500">Total Drift</div>
                              <div className="text-2xl font-black leading-none">{syncOverview.total}</div>
                            </div>
                            <div className={`${BRUTAL.card} p-2`}>
                              <div className="text-[9px] font-black uppercase text-gray-500">Auto-fixable</div>
                              <div className="text-xl font-black leading-none">{syncOverview.autoFixable}</div>
                            </div>
                            <div className={`${BRUTAL.card} p-2`}>
                              <div className="text-[9px] font-black uppercase text-gray-500">Manual Review</div>
                              <div className="text-xl font-black leading-none">{syncOverview.manual}</div>
                            </div>
                            <div className={`${BRUTAL.card} p-2`}>
                              <div className="text-[9px] font-black uppercase text-gray-500">AI confidence</div>
                              <div
                                className={`text-2xl font-black leading-none ${
                                  syncReconcileMeta?.avg_confidence == null
                                    ? 'text-gray-400'
                                    : syncReconcileMeta.avg_confidence >= 0.8
                                      ? 'text-green-700'
                                      : syncReconcileMeta.avg_confidence >= 0.6
                                        ? 'text-amber-700'
                                        : 'text-red-600'
                                }`}
                                title={
                                  syncReconcileMeta?.avg_confidence == null
                                    ? 'N/A when only legacy scan ran'
                                    : syncReconcileMeta.reasoning_summary || ''
                                }
                              >
                                {syncReconcileMeta?.avg_confidence == null
                                  ? 'N/A'
                                  : `${Math.round(syncReconcileMeta.avg_confidence * 100)}%`}
                              </div>
                            </div>
                          </div>
                          {(deepBuckets.inSync.length > 0 ||
                            deepBuckets.needsReview.length > 0 ||
                            deepBuckets.unFigma.length > 0 ||
                            deepBuckets.unStory.length > 0) && (
                            <div className="mb-3 space-y-2 border-2 border-black bg-white p-2 text-left text-[10px]">
                              {deepBuckets.inSync.length > 0 ? (
                                <details className="border border-gray-200 p-1">
                                  <summary className="cursor-pointer font-black uppercase">
                                    In sync ({deepBuckets.inSync.length})
                                  </summary>
                                  <ul className="mt-1 max-h-28 overflow-y-auto font-mono text-[9px] text-green-800">
                                    {deepBuckets.inSync.map((x) => (
                                      <li key={x.id}>{x.figmaName || x.name}</li>
                                    ))}
                                  </ul>
                                </details>
                              ) : null}
                              {deepBuckets.needsReview.length > 0 ? (
                                <div className="border border-amber-300 bg-amber-50 p-2">
                                  <div className="font-black uppercase text-amber-900">
                                    Needs review ({deepBuckets.needsReview.length})
                                  </div>
                                  <ul className="mt-1 space-y-1">
                                    {deepBuckets.needsReview.map((x) => (
                                      <li
                                        key={x.id}
                                        className="flex flex-wrap justify-between gap-1 border-b border-amber-200 pb-1 font-mono text-[9px]"
                                      >
                                        <span>{x.figmaName || x.layerId}</span>
                                        <span className="text-gray-600">↔ {x.storybookName || x.storyId}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              {(deepBuckets.unFigma.length > 0 || deepBuckets.unStory.length > 0) && (
                                <details className="border border-gray-200 p-1">
                                  <summary className="cursor-pointer font-black uppercase">
                                    Unmatched (Figma {deepBuckets.unFigma.length} / Story {deepBuckets.unStory.length})
                                  </summary>
                                  <div className="mt-1 grid grid-cols-2 gap-2 font-mono text-[8px]">
                                    <ul className="max-h-24 overflow-y-auto">
                                      {deepBuckets.unFigma.map((x) => (
                                        <li key={x.id}>{x.layerId || x.name}</li>
                                      ))}
                                    </ul>
                                    <ul className="max-h-24 overflow-y-auto">
                                      {deepBuckets.unStory.map((x) => (
                                        <li key={x.id}>{x.storybookName || x.name}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </details>
                              )}
                            </div>
                          )}

                          <div
                            ref={filtersRowRef}
                            className="hide-scrollbar mb-3 flex gap-1 overflow-x-auto pb-1"
                            style={{ cursor: 'grab' }}
                            onMouseDown={(e) => startFiltersDrag(e.clientX)}
                            onMouseMove={(e) => moveFiltersDrag(e.clientX)}
                            onMouseUp={endFiltersDrag}
                            onMouseLeave={endFiltersDrag}
                            onTouchStart={(e) => startFiltersDrag(e.touches[0]?.clientX ?? 0)}
                            onTouchMove={(e) => moveFiltersDrag(e.touches[0]?.clientX ?? 0)}
                            onTouchEnd={endFiltersDrag}
                          >
                            {(Object.keys(FILTER_LABELS) as SyncCategoryId[]).map((filter) => {
                              const count =
                                filter === 'ALL'
                                  ? syncOverview.total
                                  : filter === 'AUTO_FIXABLE'
                                    ? syncOverview.autoFixable
                                    : filter === 'MANUAL'
                                      ? syncOverview.manual + syncOverview.sections.SOURCE.length
                                      : syncOverview.sections[filter].length;
                              return (
                                <button
                                  key={filter}
                                  type="button"
                                  onClick={() => setActiveFilter(filter)}
                                  className={`shrink-0 border-2 border-black px-2 py-1 text-[9px] font-black uppercase ${activeFilter === filter ? 'bg-[#ff90e8]' : 'bg-white hover:bg-[#ffc900]'}`}
                                >
                                  {FILTER_LABELS[filter]} <span className="font-mono">{count}</span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="space-y-3 mb-4 max-h-[360px] overflow-y-auto pr-1">
                            {visibleSections.map(([categoryId, items]) => {
                              const meta = SYNC_CATEGORY_META[categoryId];
                              const visibleItems = items.slice(0, MAX_ITEMS_PER_SECTION);
                              const hiddenCount = Math.max(0, items.length - visibleItems.length);
                              const collapsed = collapsedSections[categoryId] === true;
                              return (
                                <section key={categoryId} className="border-2 border-black bg-white">
                                  <div className={`border-b-2 border-black px-2 py-2 ${meta.tone}`}>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10px] font-black uppercase">{meta.label}</span>
                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-1 border border-black bg-white px-1.5 py-0.5 text-[9px] font-black text-black hover:bg-neutral-100"
                                        aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${meta.label}`}
                                        onClick={() =>
                                          setCollapsedSections((prev) => ({ ...prev, [categoryId]: !collapsed }))
                                        }
                                      >
                                        <span>{items.length}</span>
                                        <span aria-hidden>{collapsed ? '▼' : '▲'}</span>
                                      </button>
                                    </div>
                                    <p className="mt-1 text-[9px] font-bold leading-snug opacity-80">{meta.desc}</p>
                                  </div>

                                  {!collapsed ? <div className="space-y-2 p-2">
                                    {visibleItems.map(item => {
                                      const isExpanded = expandedDriftId === item.id;
                                      return (
                                        <div
                                          key={item.id}
                                          onClick={() => setExpandedDriftId(isExpanded ? null : item.id)}
                                          className={`${BRUTAL.card} p-3 transition-all ${isExpanded ? 'shadow-[6px_6px_0_0_#000] border-black' : 'bg-white hover:shadow-[6px_6px_0_0_#000] cursor-pointer'}`}
                                        >
                                          <div className="flex justify-between items-start gap-2">
                                              <div className="min-w-0">
                                                  <div className="flex items-center gap-2 mb-1">
                                                      <span className={`text-[8px] px-1 font-bold border uppercase ${getDriftBadgeClass(item.status)}`}>
                                                        {item.status.replace(/_/g, ' ')}
                                                      </span>
                                                      <span className="font-bold text-xs truncate">{item.name}</span>
                                                  </div>
                                                  <div className="text-[10px] text-gray-500 font-mono">Last Edit: {item.lastEdited}</div>
                                              </div>
                                              <span className="text-[10px] font-bold underline hover:text-[#ff90e8]">{isExpanded ? 'CLOSE' : 'VIEW'}</span>
                                          </div>

                                          {isExpanded && (
                                              <div className="mt-4 pt-3 border-t-2 border-dashed border-black animate-in slide-in-from-top-1">
                                                  <p className="text-xs font-medium mb-4 leading-relaxed">
                                                      Issue: {item.desc}.<br/>Action: Sync to resolve drift.
                                                  </p>
                                                  <div className="mb-3 space-y-1 border border-dashed border-gray-300 bg-gray-50 p-2 text-[10px] text-gray-600">
                                                    {item.reason ? <p><strong>Why:</strong> {item.reason}</p> : null}
                                                    {item.confidence ? <p><strong>Confidence:</strong> {item.confidence}</p> : null}
                                                    {item.figmaName ? <p><strong>Figma:</strong> {item.figmaName}</p> : null}
                                                    {item.storybookName ? <p><strong>Storybook:</strong> {item.storybookName}</p> : null}
                                                    {item.suggestedAction ? <p><strong>Suggested:</strong> {item.suggestedAction}</p> : null}
                                                    {item.storybookUrl ? (
                                                      <a
                                                        href={item.storybookUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="block font-bold underline hover:text-[#ff90e8]"
                                                        onClick={(e) => e.stopPropagation()}
                                                      >
                                                        Open Storybook story
                                                      </a>
                                                    ) : null}
                                                  </div>
                                                  <div className="flex gap-2">
                                                      <button
                                                          onClick={(e) => handleSelectLayer(item.id, item.layerId ?? null, e)}
                                                          disabled={!item.layerId}
                                                          className={`flex-1 border-2 border-black text-[10px] font-bold uppercase py-2 transition-colors ${layerSelectionFeedback === item.id ? 'bg-white text-black' : 'bg-white hover:bg-gray-100'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                                      >
                                                          {layerSelectionFeedback === item.id ? 'SELECTED!' : item.layerId ? 'Select Layer' : 'No layer'}
                                                      </button>
                                                      <Button
                                                          variant="primary"
                                                          layout="row"
                                                          size="sm"
                                                          onClick={(e) => handleSyncItem(item, e)}
                                                          disabled={!item.syncAction}
                                                          className="flex-1 h-12 relative"
                                                      >
                                                          {item.syncAction ? 'Apply in Figma' : 'Manual Review'}
                                                          {item.syncAction ? (
                                                            <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">-5 Credits</span>
                                                          ) : null}
                                                      </Button>
                                                  </div>
                                              </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                    {hiddenCount > 0 ? (
                                      <div className="border border-dashed border-gray-300 bg-gray-50 p-2 text-center text-[10px] font-bold uppercase text-gray-500">
                                        +{hiddenCount} more in this category
                                      </div>
                                    ) : null}
                                  </div> : null}
                                </section>
                              );
                            })}
                          </div>
                        </>
                      )}

                      {syncItems.length > 0 && (
                        <>
                          <Button
                            variant="secondary"
                            fullWidth
                            layout="row"
                            onClick={() => void onLoadSourceConnection()}
                            className="mb-2 h-10"
                          >
                            Refresh
                          </Button>
                          <Button
                            variant="primary"
                            fullWidth
                            layout="row"
                            onClick={sourceConnection ? handleSyncAll : openSourceWizardFromEntry}
                            className="relative h-12"
                          >
                            <span>Fix All</span>
                            <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm border border-black">
                              {sourceConnection ? 'Source Connected' : 'Connect Source'}
                            </span>
                          </Button>
                          <button
                            type="button"
                            className="mt-3 block w-full text-center text-[10px] font-black uppercase text-red-700 underline"
                            onClick={requestDisconnect}
                          >
                            Disconnect
                          </button>
                          {sourceConnectionError ? (
                            <p className="mt-2 text-[10px] font-bold text-red-700">{sourceConnectionError}</p>
                          ) : null}
                        </>
                      )}

                      {/* Rescan Button */}
                      {syncItems.length === 0 && (
                          <Button
                            variant="primary"
                            fullWidth
                            layout="row"
                            onClick={handleScanClick}
                            disabled={isSyncScanning || !!getRemainingTime('scan_sync')}
                            className={
                              `mt-2 h-12 overflow-hidden${isSyncScanning ? ' disabled:!bg-[#ffc900] disabled:!text-black disabled:hover:!bg-[#ffb700] disabled:cursor-wait' : ''}`
                            }
                          >
                            {isSyncScanning ? (
                              <span className="absolute inset-0">
                                <span
                                  className="absolute inset-y-0 left-0 bg-yellow-300"
                                  style={{ animation: 'fill-cta-bar 45000ms linear 1 forwards' }}
                                  aria-hidden
                                />
                              </span>
                            ) : null}
                            <span className="relative z-10">
                              {isSyncScanning
                                ? 'Analyzing Drift...'
                                : getRemainingTime('scan_sync')
                                  ? `Cooldown ${getRemainingTime('scan_sync')}`
                                  : 'Start New Scan'}
                            </span>
                            {(!isSyncScanning && !getRemainingTime('scan_sync')) && (
                                <span className="absolute bottom-0.5 right-1 z-10 text-[8px] bg-black text-white px-1 font-bold rounded-sm border border-black">
                                   {isPro ? 'Included' : '-15 Credits'}
                                </span>
                            )}
                          </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeSyncTab === 'GH' && (
            <div className="p-6 text-center animate-in slide-in-from-right-2">
              <p className="text-xs font-bold uppercase text-gray-400 mb-2">Integration In Progress</p>
              <Button variant="secondary" fullWidth disabled className="bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed">
                Connect GitHub (Soon)
              </Button>
            </div>
          )}

          {activeSyncTab === 'BB' && (
            <div className="p-6 text-center animate-in slide-in-from-right-2">
              <p className="text-xs font-bold uppercase text-gray-400 mb-2">Integration In Progress</p>
              <Button variant="secondary" fullWidth disabled className="bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed">
                Connect Bitbucket (Soon)
              </Button>
            </div>
          )}

          {showDisconnectConfirm && (
            <div
              className="fixed inset-0 z-[320] flex items-center justify-center bg-black/45 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="sync-disconnect-title"
              onClick={() => setShowDisconnectConfirm(false)}
            >
              <div
                className={`${BRUTAL.card} max-w-md w-full border-2 border-black bg-white p-4 shadow-[6px_6px_0_0_#000]`}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="sync-disconnect-title" className="text-sm font-black uppercase leading-tight">
                  Replace current sync connection?
                </h3>
                <p className="mt-2 text-[11px] leading-snug text-gray-700">
                  If you continue, we will remove the current Storybook link and the source wizard data saved for this sync.
                  You will need to reconnect and re-enter details manually.
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button
                    variant="secondary"
                    className="min-h-[40px] text-xs font-black uppercase"
                    onClick={() => setShowDisconnectConfirm(false)}
                  >
                    Keep current
                  </Button>
                  <Button
                    variant="primary"
                    className="min-h-[40px] text-xs font-black uppercase !bg-red-600 !text-white hover:!bg-red-700"
                    onClick={() => void confirmDisconnect()}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            </div>
          )}

          {sourceWhyDialogOpen && (
            <div
              className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="sync-source-why-title"
              onClick={() => setSourceWhyDialogOpen(false)}
            >
              <div
                className={`${BRUTAL.card} max-w-md w-full border-2 border-black bg-white p-4 shadow-[6px_6px_0_0_#000]`}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="sync-source-why-title" className="text-sm font-black uppercase leading-tight">
                  Why connect source?
                </h3>
                <p className="mt-2 text-sm font-bold leading-relaxed text-neutral-800">
                  We ask for this setup to avoid wrong comparisons and broken links. Storybook shows the final result, but
                  real changes happen in the source repository.
                </p>
                <p className="mt-2 text-[11px] leading-snug text-gray-600">
                  Once connected, Comtra can read what is live, compare it with your Figma file, and suggest concrete fixes in
                  the right place.
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button variant="secondary" className="min-h-[40px] text-xs font-black uppercase" onClick={() => setSourceWhyDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" className="min-h-[40px] text-xs font-black uppercase" onClick={confirmSourceWhyDialog}>
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          )}

          {sourceWizardOpen && (
            <div
              className="fixed inset-0 z-[300] flex flex-col bg-[#fdfdfd] text-black"
              role="dialog"
              aria-modal="true"
              aria-labelledby="sync-source-title"
            >
              <header className="shrink-0 border-b-2 border-black bg-white shadow-[0_2px_0_0_#000] flex items-center justify-between gap-2 px-3 py-3">
                <div className="min-w-0">
                  <h2 id="sync-source-title" className="text-xs font-black uppercase tracking-wide truncate pr-2">
                    Connect source for Fix All
                  </h2>
                  <p className="text-[10px] font-bold text-gray-500 truncate">
                    {storybookUrl || 'Storybook source'}
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 size-9 border-2 border-black bg-white font-black text-sm shadow-[3px_3px_0_0_#000] hover:bg-gray-100 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_2px_0_0_#000]"
                  aria-label="Close source wizard"
                  onClick={() => {
                    setSourceWhyDialogOpen(false);
                    setSourceWizardOpen(false);
                    if (!sourceConnection) resetSourceWizard();
                  }}
                >
                  x
                </button>
              </header>

              <div className="shrink-0 border-b-2 border-black bg-neutral-100 pt-4 pb-0">
                <SourceWizardStepper currentStep={sourceWizardStep} />
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4">
                <div className="mx-auto flex w-full max-w-lg flex-col gap-3">
                  <div className={`${BRUTAL.card} bg-white p-3`}>
                    <h3 className="font-black uppercase text-base leading-tight">
                      {SOURCE_WIZARD_STEPS[sourceWizardStep].title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-800 leading-relaxed">
                      {SOURCE_WIZARD_STEPS[sourceWizardStep].body}
                    </p>
                  </div>

                  {(sourceWizardError || sourceConnectionError) && (
                    <div className="border-2 border-red-500 bg-red-50 p-3 text-xs font-bold text-red-800">
                      {sourceWizardError || sourceConnectionError}
                    </div>
                  )}

                  {sourceWizardStep === 0 && (
                    <div className={`${BRUTAL.card} bg-white p-3 space-y-3`}>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(SOURCE_PROVIDER_LABELS) as SourceProvider[]).map((provider) => (
                          <button
                            key={provider}
                            type="button"
                            onClick={() => setSourceProvider(provider)}
                            className={`border-2 border-black p-3 text-left shadow-[3px_3px_0_0_#000] ${
                              sourceProvider === provider ? 'bg-[#ff90e8]' : 'bg-white hover:bg-[#ffc900]'
                            }`}
                          >
                            <span className="block text-xs font-black uppercase">{SOURCE_PROVIDER_LABELS[provider]}</span>
                            <span className="mt-1 block text-[10px] font-bold text-gray-600">
                              {provider === 'custom' ? 'Enterprise API or other Git host' : 'Repository provider'}
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase">{SOURCE_PROVIDER_LABELS[sourceProvider]}</p>
                          <p className="mt-1 text-[10px] text-gray-600 leading-snug">
                            Provider auth is used to read repository contents. PR/write permissions will be requested only when patch sync is enabled.
                          </p>
                        </div>
                        <span className="shrink-0 border-2 border-black bg-yellow-100 px-2 py-1 text-[9px] font-black uppercase">
                          {sourceProvider === 'custom' ? 'Manual' : 'Needs auth'}
                        </span>
                      </div>
                      <Button
                        variant="black"
                        fullWidth
                        className="min-h-[44px] text-xs font-black py-3"
                        onClick={async () => {
                          const result = await onStartSourceAuth(sourceProvider);
                          if (!result.ok && result.error) setSourceWizardError(result.error);
                          if (result.ok && !result.url) setSourceWizardError(null);
                        }}
                      >
                        {sourceProvider === 'custom' ? 'Use Manual Setup' : `Connect ${SOURCE_PROVIDER_LABELS[sourceProvider]}`}
                      </Button>
                      {sourceAuthStartUrl ? (
                        <a
                          href={sourceAuthStartUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-[10px] font-bold underline"
                        >
                          Open provider install page
                        </a>
                      ) : null}
                      <p className="text-[10px] text-gray-500 leading-snug">
                        The selected provider opens external OAuth (browser). After completing access, return here and continue.
                      </p>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-gray-600 mb-1">
                          Token / app password (for private repos)
                        </label>
                        <input
                          type="password"
                          value={sourceTokenInput}
                          onChange={(e) => setSourceTokenInput(e.target.value)}
                          placeholder="ghp_... / glpat-... / bitbucket app password"
                          className="w-full border-2 border-black px-3 py-2 text-xs font-mono outline-none"
                        />
                        <p className="mt-1 text-[10px] text-gray-500 leading-snug">
                          Optional for public repos. Required for private repos. Saved server-side and never shown again here.
                        </p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-gray-600 mb-1">Repository URL</label>
                        <input
                          type="url"
                          value={sourceRepoUrl}
                          onChange={(e) => setSourceRepoUrl(e.target.value)}
                          placeholder="https://github.com/org/repo"
                          className="w-full border-2 border-black px-3 py-2 text-xs font-mono outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-black uppercase text-gray-600 mb-1">Branch</label>
                          <input
                            type="text"
                            value={sourceBranch}
                            onChange={(e) => setSourceBranch(e.target.value)}
                            placeholder="main"
                            className="w-full border-2 border-black px-3 py-2 text-xs font-mono outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black uppercase text-gray-600 mb-1">Storybook path</label>
                          <input
                            type="text"
                            value={sourceStorybookPath}
                            onChange={(e) => setSourceStorybookPath(e.target.value)}
                            placeholder="apps/docs"
                            className="w-full border-2 border-black px-3 py-2 text-xs font-mono outline-none"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-snug">
                        In monorepos, set the Storybook package path, for example `apps/docs` or `packages/ui`.
                      </p>
                    </div>
                  )}

                  {sourceWizardStep === 1 && (
                    <div className={`${BRUTAL.card} bg-white p-3 space-y-3`}>
                      <Button
                        variant="secondary"
                        fullWidth
                        className="min-h-[44px] text-xs font-black py-3 bg-[#ffc900] hover:bg-[#ffb700]"
                        disabled={sourceConnectionSaving || !sourceRepoUrl.trim()}
                        onClick={runSourceDetection}
                      >
                        {sourceConnectionSaving ? 'Detecting…' : 'Detect Storybook Source'}
                      </Button>
                      {sourceScanDraft ? (
                        <div className="space-y-2 border-2 border-black bg-neutral-50 p-3 text-[10px]">
                          <div className="flex justify-between gap-2">
                            <strong>Status</strong>
                            <span className="font-black uppercase">{sourceScanDraft.status}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <strong>Config</strong>
                            <span className="font-mono text-right">{sourceScanDraft.storybookConfigPath || 'Not found'}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <strong>Stories</strong>
                            <span>{sourceScanDraft.storiesCount ?? 'Unknown'}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <strong>Package manager</strong>
                            <span>{sourceScanDraft.packageManager || 'Unknown'}</span>
                          </div>
                          {sourceScanDraft.issues?.length ? (
                            <div className="border-t border-dashed border-gray-400 pt-2 text-gray-600">
                              {sourceScanDraft.issues.slice(0, 3).map((issue, i) => (
                                <p key={`source-issue-${i}`}>- {issue}</p>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-[10px] text-gray-500 leading-snug">
                          Detection checks branch, Storybook config, stories, package manager, and likely component paths.
                        </p>
                      )}
                    </div>
                  )}

                  {sourceWizardStep === 2 && (
                    <div className={`${BRUTAL.card} bg-[#fff8e7] p-3 space-y-2`}>
                      <div className="flex justify-between gap-3 border-b border-dashed border-gray-400 pb-2">
                        <span className="text-[10px] font-black uppercase text-gray-600">Provider</span>
                        <span className="text-xs font-black">{SOURCE_PROVIDER_LABELS[sourceProvider]}</span>
                      </div>
                      <div className="flex justify-between gap-3 border-b border-dashed border-gray-400 pb-2">
                        <span className="text-[10px] font-black uppercase text-gray-600">Repo</span>
                        <span className="text-[10px] font-mono text-right break-all">{sourceRepoUrl || 'Missing'}</span>
                      </div>
                      <div className="flex justify-between gap-3 border-b border-dashed border-gray-400 pb-2">
                        <span className="text-[10px] font-black uppercase text-gray-600">Branch</span>
                        <span className="text-xs font-mono">{sourceBranch || 'main'}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[10px] font-black uppercase text-gray-600">Storybook path</span>
                        <span className="text-xs font-mono">{sourceStorybookPath || 'root'}</span>
                      </div>
                      <div className="flex justify-between gap-3 border-t border-dashed border-gray-400 pt-2">
                        <span className="text-[10px] font-black uppercase text-gray-600">Detection</span>
                        <span className="text-xs font-black uppercase">{sourceScanDraft?.status || 'not run'}</span>
                      </div>
                      <div className="flex justify-between gap-3 border-t border-dashed border-gray-400 pt-2">
                        <span className="text-[10px] font-black uppercase text-gray-600">Token</span>
                        <span className="text-xs font-black uppercase">
                          {sourceTokenInput.trim() ? 'Provided' : sourceConnection?.hasToken ? 'Saved on server' : 'Not provided'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <footer className="shrink-0 border-t-2 border-black bg-white px-3 py-4 shadow-[0_-4px_0_0_rgba(0,0,0,0.06)]">
                <div className="mx-auto flex w-full max-w-lg gap-2 items-stretch">
                  <Button
                    variant="secondary"
                    className="flex-1 min-h-[44px] text-xs font-black py-3"
                    onClick={() => {
                      if (sourceWizardStep === 0) {
                        setSourceWhyDialogOpen(false);
                        setSourceWizardOpen(false);
                        if (!sourceConnection) resetSourceWizard();
                      } else {
                        setSourceWizardStep((prev) => Math.max(0, prev - 1) as SourceWizardStep);
                      }
                    }}
                  >
                    {sourceWizardStep === 0 ? 'Cancel' : 'Back'}
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1 min-h-[44px] text-xs font-black py-3"
                    disabled={!canContinueSourceWizard || sourceConnectionSaving}
                    onClick={async () => {
                      if (sourceWizardStep === 1) {
                        const scan = sourceScanDraft ?? await runSourceDetection();
                        if (!scan || scan.status === 'failed') return;
                      }
                      if (sourceWizardStep < 2) {
                        setSourceWizardStep((prev) => Math.min(2, prev + 1) as SourceWizardStep);
                      } else {
                        await completeSourceWizard();
                      }
                    }}
                  >
                    {sourceWizardStep === 2 ? (sourceConnectionSaving ? 'Saving…' : 'Save Source') : 'Continue'}
                  </Button>
                </div>
              </footer>
            </div>
          )}

          <p className="text-[10px] text-gray-500 px-4 pb-3 pt-2 border-t border-gray-100 mt-2 leading-relaxed">
            Need to connect a private Storybook or one behind SSO?{' '}
            <a
              href="https://calendly.com/comtra-enterprise"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline hover:text-[#ff90e8]"
            >
              Book a call
            </a>{' '}
            for an enterprise setup.
          </p>
        </div>
    </div>
  );
};
