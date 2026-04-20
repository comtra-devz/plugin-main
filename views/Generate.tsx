
import React, { useState, useRef, useEffect, useCallback, startTransition } from 'react';
import { BRUTAL } from '../constants';
import { Button } from '../components/ui/Button';
import { GenerateDsImport, type RequestDsContextIndexFn } from './GenerateDsImport';
import {
  clearSessionCatalogPrepared,
  hasImportForFileKey,
  isSessionCatalogPreparedForFile,
  setSessionCatalogPrepared,
} from '../lib/dsImportsStorage';
import {
  BrutalDropdown,
  brutalSelectOptionRowClass,
  brutalSelectOptionSelectedClass,
} from '../components/ui/BrutalSelect';
import { UserPlan } from '../types';
import { getSystemToastOptions } from '../lib/errorCopy';
import { Confetti } from '../components/Confetti.tsx';
import {
  REFINEMENT_CHIPS,
  activeThreadStorageKey,
  evaluatePreflightClarifier,
  localConversationStorageKey,
  reasoningSummaryLinesFromPlan,
  refinementEstimateActionType,
  tierCreditHint,
  formatShortRelativeTime,
} from '../lib/generateConversationHelpers';
import {
  safeLocalStorageGetItem,
  safeLocalStorageRemoveItem,
  safeLocalStorageSetItem,
} from '../lib/safeWebStorage';

/** Hybrid UX §8 — cockpit plugin (questa view); archivio/ricerca/analytics via web/API admin. */

interface Props { 
  plan: UserPlan; 
  userTier?: string;
  onUnlockRequest: () => void;
  creditsRemaining: number | null;
  useInfiniteCreditsForTest?: boolean;
  estimateCredits: (payload: { action_type: string; node_count?: number; has_screenshot?: boolean }) => Promise<{ estimated_credits: number }>;
  consumeCredits: (payload: { action_type: string; credits_consumed: number; file_id?: string }) => Promise<{ credits_remaining?: number; error?: string }>;
  initialPrompt?: string;
  fetchGenerate: (body: {
    file_key: string;
    prompt: string;
    mode?: string;
    ds_source?: string;
    screenshot_base64?: string | null;
    ds_context_index?: object | null;
    ds_cache_hash?: string | null;
    component_assignment_overrides?: Record<
      string,
      { component_key?: string | null; component_node_id?: string | null }
    > | null;
  }) => Promise<{ action_plan: object; variant?: string; request_id?: string | null }>;
  requestFileContext: () => Promise<{
    fileKey: string | null;
    fileName?: string | null;
    error?: string | null;
  }>;
  writeDsImportMeta: (payload: {
    fileKey: string;
    importedAt: string;
    dsCacheHash: string;
    componentCount: number;
    tokenCount: number;
    name: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  requestDsContextIndex: RequestDsContextIndexFn;
  /** When the plugin has no session cache, check the backend for a stored DS snapshot for this file. */
  checkServerHasDsContext: (fileKey: string) => Promise<boolean>;
  persistDsImportToServer: (body: {
    figma_file_key: string;
    display_name: string;
    figma_file_name: string;
    ds_cache_hash: string;
    ds_context_index: object;
  }) => Promise<void>;
  fetchGenerateFeedback: (body: { request_id: string; thumbs: 'up' | 'down'; comment?: string }) => Promise<void>;
  /** Kimi mini-agent: structured prompt (billed; PRO free on server). */
  fetchEnhancePlus?: (body: {
    prompt: string;
    mode: string;
    ds_source: string;
    has_screenshot?: boolean;
    selection_label?: string | null;
  }) => Promise<{
    enhanced_prompt: string;
    credits_consumed?: number;
    credits_remaining?: number;
    credits_total?: number;
    credits_used?: number;
  }>;
  /** Kimi: short playful import-wizard copy (0 credits; see /api/agents/import-narration). */
  fetchImportNarration?: (body: {
    kind: 'welcome' | 'session_locked' | 'tokens_done' | 'components_done';
    file_name?: string | null;
    hint?: string | null;
  }) => Promise<{ text: string }>;
  /** Telemetria / learning loop (DI v2): eventi post-generazione lato plugin. */
  fetchGenerationPluginEvent?: (body: {
    event_type: string;
    request_id?: string | null;
    figma_file_key?: string;
    payload?: Record<string, unknown>;
  }) => Promise<void>;
  /** Scope user id for thread persistence (§7). */
  userId?: string | null;
  /** Resolve DS hash for thread key (Custom Current). */
  fetchDsImportContextSnapshot?: (
    fileKey: string,
  ) => Promise<{ ds_context_index: object; ds_cache_hash: string | null } | null>;
  /** Backend sync for generate_threads / generate_messages (§9–10). */
  /** Pack-driven preflight (§2.6): inference-only, zero credits. */
  fetchConversationHints?: (prompt: string) => Promise<{
    legacy_screen_key?: string | null;
    pack_v2_archetype_id?: string | null;
    preflight: {
      title?: string;
      chips: Array<{ id: string; label: string }>;
      source: string;
    } | null;
  } | null>;
  generateConversationApi?: {
    listThreads: (q: {
      file_key: string;
      ds_cache_hash: string;
    }) => Promise<{ threads: Array<{ id: string; title: string | null; updated_at_ms?: number }> }>;
    createThread: (body: {
      file_key: string;
      ds_cache_hash: string;
      title?: string;
    }) => Promise<{ id: string }>;
    fetchMessages: (threadId: string) => Promise<{
      messages: Array<{ id: string; role: string; content_json?: { text?: string } }>;
    }>;
    appendMessages: (
      threadId: string,
      messages: Array<{
        role: 'user' | 'assistant' | 'system';
        content_json: Record<string, unknown>;
        message_type?: string;
      }>,
    ) => Promise<void>;
  };
  selectedNode: { id: string; name: string; type: string } | null;
  /** Runs the action plan on the Figma main thread (frame + actions on the current page). */
  applyActionPlanToCanvas: (
    plan: object,
    opts?: {
      modifyMode?: boolean;
      serverRequestId?: string | null;
      figmaFileKey?: string | null;
      qualityWatch?: boolean;
    },
  ) => Promise<{ ok: boolean; error?: string; rootId?: string }>;
  designSystems?: string[];
}

const DEFAULT_DESIGN_SYSTEMS = [
  "Custom (Current)",
  "Material Design 3",
  "iOS Human Interface",
  "Ant Design",
  "Carbon Design",
  "Bootstrap 5",
  "Salesforce Lightning",
  "Uber Base Web"
];

function normalizeTerminalText(s: string): string {
  return s.replace(/\r\n/g, '\n').trim();
}

/** Strips duplicate "Goal:" prefixes when Enhance is used more than once. */
function extractBaseForEnhance(raw: string): string {
  let t = normalizeTerminalText(raw);
  while (t.toLowerCase().startsWith('goal:')) {
    t = t.slice(5).trimStart();
  }
  const lower = t.toLowerCase();
  const cut = lower.indexOf('\ncontext:');
  if (cut !== -1) {
    t = t.slice(0, cut).trim();
  }
  return t.trim() || normalizeTerminalText(raw);
}

function getPlainTerminalText(el: HTMLDivElement | null): string {
  if (!el) return '';
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('span[data-url]').forEach((c) => c.remove());
  return normalizeTerminalText(clone.innerText);
}

function humanizeCanvasError(raw: string): string {
  const msg = String(raw || '').trim();
  if (!msg) return 'Canvas apply failed.';
  if (msg.includes('CUSTOM_DS_INSTANCE_PREFLIGHT_FAILED')) {
    return 'Generate: i componenti del DS non sono risolvibili in questo file (chiavi pubblicate o librerie collegate). Abilita le librerie usate dal DS, riesegui l’import da questa schermata e riprova.';
  }
  if (msg.includes('INSTANCE_UNRESOLVED')) {
    return 'Some DS component instances are not resolvable in this file. Check DS import and linked libraries.';
  }
  if (msg.includes('VARIABLE_UNRESOLVED')) {
    return 'Some DS variables are not available/importable in this file. Check linked libraries and token availability.';
  }
  return msg;
}

type ConversationTurn = {
  id: string;
  role: 'user' | 'assistant';
  body: string;
  createdAt: number;
};

const MAX_CONVERSATION_MESSAGES = 32;

function promptGateKey(raw: string): string {
  const t = raw.trim();
  return `${t.length}:${t.slice(0, 96)}`;
}

function buildAssistantSummaryFromPlan(
  plan: object,
  opts: { rootId?: string | null },
): string {
  const rec = plan as {
    metadata?: Record<string, unknown>;
    actions?: unknown[];
  };
  const meta = rec.metadata && typeof rec.metadata === 'object' ? rec.metadata : {};
  const actions = Array.isArray(rec.actions) ? rec.actions : [];
  const archetype =
    meta.inferred_screen_archetype != null ? String(meta.inferred_screen_archetype).trim() : '';
  const pipeline =
    meta.generation_pipeline != null ? String(meta.generation_pipeline).trim() : '';
  const lines: string[] = [];
  lines.push('Ok — ho capito: layout pronto sul file, allineato al DS.');
  lines.push('');
  const reasoning = reasoningSummaryLinesFromPlan(plan);
  if (reasoning.length) {
    lines.push('Sintesi (sicura, senza catena di pensiero):');
    for (const r of reasoning) lines.push(`• ${r}`);
    lines.push('');
  }
  lines.push(`Azioni nel piano: ${actions.length}`);
  if (archetype) lines.push(`Archetipo schermo: ${archetype}`);
  if (pipeline) lines.push(`Pipeline: ${pipeline}`);
  if (opts.rootId) lines.push('Frame creato sulla pagina corrente — controlla il canvas.');
  lines.push('');
  lines.push('Prossimo passo: affina con i chip sotto o scrivi una modifica nel terminale.');
  return lines.join('\n');
}

export const Generate: React.FC<Props> = ({
  plan,
  userTier,
  onUnlockRequest,
  creditsRemaining,
  useInfiniteCreditsForTest,
  estimateCredits,
  consumeCredits,
  initialPrompt,
  fetchGenerate,
  requestFileContext,
  writeDsImportMeta,
  requestDsContextIndex,
  checkServerHasDsContext,
  persistDsImportToServer,
  fetchGenerateFeedback,
  fetchEnhancePlus,
  fetchImportNarration,
  fetchGenerationPluginEvent,
  userId,
  fetchDsImportContextSnapshot,
  fetchConversationHints,
  generateConversationApi,
  selectedNode,
  applyActionPlanToCanvas,
  designSystems,
}) => {
  const [res, setRes] = useState('');
  const [loading, setLoading] = useState(false);
  /** Dove siamo nel flusso Generate (visibile durante loading). */
  const [generateStep, setGenerateStep] = useState<'idle' | 'context' | 'ai' | 'canvas' | 'credits'>('idle');
  const [genError, setGenError] = useState<string | null>(null);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);
  const [lastVariant, setLastVariant] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showReadFirstModal, setShowReadFirstModal] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [showCatalogReadyModal, setShowCatalogReadyModal] = useState(false);
  /** Increment to remount canvas confetti (same pattern as LevelUpModal). */
  const [catalogConfettiKey, setCatalogConfettiKey] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [hasContent, setHasContent] = useState(!!initialPrompt);
  const [promptText, setPromptText] = useState(initialPrompt || '');
  /** Screenshot/reference image: full data URL or raw base64 sent to generate API. */
  const [screenshotAttachment, setScreenshotAttachment] = useState<{ name: string; dataUrl: string } | null>(null);
  const screenshotFileInputRef = useRef<HTMLInputElement>(null);
  const [creditEstimate, setCreditEstimate] = useState(3);
  const availableSystems =
    Array.isArray(designSystems) && designSystems.length > 0 ? designSystems : DEFAULT_DESIGN_SYSTEMS;
  
  // Design System State
  const [selectedSystem, setSelectedSystem] = useState(availableSystems[0] || 'Custom (Current)');
  const [isSystemOpen, setIsSystemOpen] = useState(false);
  const [systemSearch, setSystemSearch] = useState('');

  // ContentEditable Ref
  const inputRef = useRef<HTMLDivElement>(null);
  /** After Enhance: button stays off until the user edits the terminal (avoids nested enhance). */
  const [enhanceLocked, setEnhanceLocked] = useState(false);
  /** Clean goal text used to rebuild the block when DS or context changes. */
  const [enhancedGoalSnapshot, setEnhancedGoalSnapshot] = useState<string | null>(null);
  const lastEnhancedBodyRef = useRef<string | null>(null);
  const enhanceLockedRef = useRef(false);
  useEffect(() => {
    enhanceLockedRef.current = enhanceLocked;
  }, [enhanceLocked]);

  const [enhancePlusBusy, setEnhancePlusBusy] = useState(false);
  const [enhancePlusCost, setEnhancePlusCost] = useState(1);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { estimated_credits } = await estimateCredits({ action_type: 'enhance_plus' });
        if (!cancelled) setEnhancePlusCost(Math.max(0, Number(estimated_credits) || 1));
      } catch {
        if (!cancelled) setEnhancePlusCost(1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [estimateCredits]);

  // New State for Report Flow
  const [showReport, setShowReport] = useState(false);
  /** Timeline conversazione (Phase 1): una coppia user/assistant per ogni click Generate rilevante. */
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([]);
  const [dsScopeHash, setDsScopeHash] = useState<string>('');
  const [serverThreadId, setServerThreadId] = useState<string | null>(null);
  const [threadList, setThreadList] = useState<
    Array<{ id: string; title: string | null; updated_at_ms?: number }>
  >([]);
  /** §7.2 — Chat vs dedicated Conversazioni panel (Phase 3). */
  const [generateComposerTab, setGenerateComposerTab] = useState<'chat' | 'threads'>('chat');
  const [showPreflight, setShowPreflight] = useState(false);
  const [preflightPromptSnapshot, setPreflightPromptSnapshot] = useState('');
  /** Server pack chips override rule-based when present (Phase 2.6). */
  const [preflightRemote, setPreflightRemote] = useState<{
    title?: string;
    chips: Array<{ id: string; label: string }>;
    source: string;
  } | null>(null);
  const [preflightPick, setPreflightPick] = useState<Record<string, boolean>>({});
  /** After a successful canvas run: show refinement chips (§5–6). */
  const [showRefinementChips, setShowRefinementChips] = useState(false);
  /** §6 — per-chip estimates from POST /api/credits/estimate (preview). */
  const [refinementEstimates, setRefinementEstimates] = useState<Record<string, number>>({});
  const [lastDiagLine, setLastDiagLine] = useState<string | null>(null);
  const pendingPreflightPromptRef = useRef<string | null>(null);
  const skippedPreflightHashRef = useRef<string | null>(null);
  const serverThreadIdRef = useRef<string | null>(null);
  useEffect(() => {
    serverThreadIdRef.current = serverThreadId;
  }, [serverThreadId]);
  const lastActionPlanRef = useRef<object | null>(null);
  /** For “View in Figma” / re-apply: same modify vs create as the last run. */
  const lastApplyWasModifyRef = useRef(false);
  const [canvasApplyResult, setCanvasApplyResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [canvasBusy, setCanvasBusy] = useState(false);

  /** For “Custom (Current)” only: Figma catalog required before generate. */
  const [genFileKey, setGenFileKey] = useState<string | null>(null);
  const [genFileName, setGenFileName] = useState<string | null>(null);
  const [fileCtxLoading, setFileCtxLoading] = useState(false);
  const [genFileCtxError, setGenFileCtxError] = useState<string | null>(null);
  const [catalogReady, setCatalogReady] = useState(false);
  const [dsImportBusy, setDsImportBusy] = useState(false);

  /** Must run before hooks that list `usesFileDs` in deps (avoid TDZ / "Cannot access before initialization"). */
  const isPro = plan === 'PRO';
  const infiniteForTest = !!useInfiniteCreditsForTest;
  const remaining = infiniteForTest || isPro ? Infinity : (creditsRemaining === null ? Infinity : creditsRemaining);
  const canGenerate = isPro || remaining > 0;
  const usesFileDs = selectedSystem === availableSystems[0];
  const dsGateBlocked = usesFileDs && (!catalogReady || dsImportBusy);
  /** Custom (Current): hide the full composer until the step-by-step DS import is done. */
  const showGenerateComposer = !usesFileDs || catalogReady;

  const runCanvasApply = useCallback(
    async (actionPlan: object, opts?: { modifyMode?: boolean }) => {
      const r = await applyActionPlanToCanvas(actionPlan, opts);
      setCanvasApplyResult(r.ok ? { ok: true } : { ok: false, error: r.error });
      return r;
    },
    [applyActionPlanToCanvas]
  );

  const persistTurnsLocal = useCallback(
    (turns: ConversationTurn[]) => {
      if (!userId || !genFileKey) return;
      const h =
        dsScopeHash ||
        (usesFileDs ? '' : `preset:${selectedSystem.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`);
      const key = localConversationStorageKey(userId, genFileKey, h);
      try {
        safeLocalStorageSetItem(key, JSON.stringify(turns.slice(-MAX_CONVERSATION_MESSAGES)));
      } catch {
        /* ignore */
      }
    },
    [userId, genFileKey, dsScopeHash, usesFileDs, selectedSystem],
  );

  const refreshThreadList = useCallback(async () => {
    const fk = genFileKey;
    const dh = dsScopeHash;
    if (!generateConversationApi || !fk || !dh) return;
    try {
      const r = await generateConversationApi.listThreads({
        file_key: fk,
        ds_cache_hash: dh,
      });
      setThreadList(
        (r.threads || []).map((t) => ({
          id: t.id,
          title: t.title ?? null,
          updated_at_ms: typeof t.updated_at_ms === 'number' ? t.updated_at_ms : undefined,
        })),
      );
    } catch {
      /* offline */
    }
  }, [generateConversationApi, genFileKey, dsScopeHash]);

  const appendGenerateTurn = useCallback(
    (userPrompt: string, assistantMarkdown: string) => {
      const t = Date.now();
      const u = userPrompt.slice(0, 1200);
      const pair = [
        { id: `u-${t}`, role: 'user' as const, body: u, createdAt: t },
        { id: `a-${t}`, role: 'assistant' as const, body: assistantMarkdown, createdAt: t },
      ];
      setConversationTurns((prev) => {
        const next: ConversationTurn[] = [...prev, ...pair];
        const trimmed =
          next.length > MAX_CONVERSATION_MESSAGES
            ? next.slice(next.length - MAX_CONVERSATION_MESSAGES)
            : next;
        persistTurnsLocal(trimmed);
        return trimmed;
      });
      const api = generateConversationApi;
      const fk = genFileKey;
      const dh =
        dsScopeHash ||
        (usesFileDs ? '' : `preset:${selectedSystem.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`);
      if (api && userId && fk && dh !== undefined) {
        void (async () => {
          try {
            let tid = serverThreadIdRef.current;
            if (!tid) {
              const created = await api.createThread({
                file_key: fk,
                ds_cache_hash: dh || '',
                title: u.slice(0, 80),
              });
              tid = created.id;
              setServerThreadId(tid);
              safeLocalStorageSetItem(activeThreadStorageKey(userId, fk, dh || ''), tid);
            }
            if (tid) {
              await api.appendMessages(tid, [
                { role: 'user', content_json: { text: u }, message_type: 'chat' },
                { role: 'assistant', content_json: { text: assistantMarkdown }, message_type: 'reasoning_summary' },
              ]);
              await refreshThreadList();
            }
          } catch {
            /* offline — local timeline remains */
          }
        })();
      }
    },
    [
      generateConversationApi,
      userId,
      genFileKey,
      dsScopeHash,
      usesFileDs,
      selectedSystem,
      persistTurnsLocal,
      refreshThreadList,
    ],
  );

  /** DS scope hash for thread persistence (file + snapshot or preset slug). */
  useEffect(() => {
    let cancelled = false;
    if (!usesFileDs) {
      const slug = selectedSystem.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      setDsScopeHash(`preset:${slug}`);
      return;
    }
    if (!genFileKey || !catalogReady || !fetchDsImportContextSnapshot) {
      setDsScopeHash('');
      return;
    }
    void fetchDsImportContextSnapshot(genFileKey).then((snap) => {
      if (cancelled) return;
      setDsScopeHash(snap?.ds_cache_hash ? String(snap.ds_cache_hash).trim() : '');
    });
    return () => {
      cancelled = true;
    };
  }, [usesFileDs, selectedSystem, genFileKey, catalogReady, fetchDsImportContextSnapshot]);

  useEffect(() => {
    if (!userId || !genFileKey || !dsScopeHash) return;
    const tid = safeLocalStorageGetItem(activeThreadStorageKey(userId, genFileKey, dsScopeHash));
    setServerThreadId(tid || null);
  }, [userId, genFileKey, dsScopeHash]);

  useEffect(() => {
    if (!generateConversationApi || !userId || !genFileKey || !dsScopeHash) return;
    let cancelled = false;
    void generateConversationApi
      .listThreads({ file_key: genFileKey, ds_cache_hash: dsScopeHash })
      .then((r) => {
        if (cancelled) return;
        setThreadList(
          (r.threads || []).map((t) => ({
            id: t.id,
            title: t.title ?? null,
            updated_at_ms: typeof t.updated_at_ms === 'number' ? t.updated_at_ms : undefined,
          })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [generateConversationApi, userId, genFileKey, dsScopeHash]);

  useEffect(() => {
    if (!userId || !genFileKey || !dsScopeHash) return;
    const raw = safeLocalStorageGetItem(localConversationStorageKey(userId, genFileKey, dsScopeHash));
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      const turns = parsed.filter(
        (x): x is ConversationTurn =>
          !!x &&
          typeof x === 'object' &&
          (x as ConversationTurn).role !== undefined &&
          typeof (x as ConversationTurn).body === 'string',
      );
      if (turns.length > 0) setConversationTurns(turns.slice(-MAX_CONVERSATION_MESSAGES));
    } catch {
      /* ignore */
    }
  }, [userId, genFileKey, dsScopeHash]);

  // Set initial prompt if provided
  useEffect(() => {
    if (initialPrompt && inputRef.current) {
      setEnhanceLocked(false);
      setEnhancedGoalSnapshot(null);
      lastEnhancedBodyRef.current = null;
      inputRef.current.innerText = initialPrompt;
      setHasContent(true);
      setPromptText(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    if (!availableSystems.length) return;
    if (!availableSystems.includes(selectedSystem)) {
      setSelectedSystem(availableSystems[0]);
    }
  }, [availableSystems, selectedSystem]);

  useEffect(() => {
    if (!usesFileDs) {
      setCatalogReady(true);
      setGenFileKey(null);
      setGenFileName(null);
      setGenFileCtxError(null);
      setFileCtxLoading(false);
      return;
    }
    setCatalogReady(false);
    let cancelled = false;
    setFileCtxLoading(true);
    setGenFileCtxError(null);
    void requestFileContext().then(async (r) => {
      if (cancelled) return;
      setFileCtxLoading(false);
      setGenFileKey(r.fileKey ?? null);
      setGenFileName(r.fileName ?? null);
      const err =
        r.error != null && String(r.error).trim() !== ''
          ? String(r.error) === 'FILE_LINK_UNAVAILABLE'
            ? 'Save this file in Figma and try again (file not linked).'
            : String(r.error)
          : !r.fileKey
            ? 'Open a saved file in Figma.'
            : null;
      setGenFileCtxError(err);
      if (err || !r.fileKey) return;
      const localListed = hasImportForFileKey(r.fileKey);
      const sessionPrepared = isSessionCatalogPreparedForFile(r.fileKey);
      let serverOk = false;
      try {
        serverOk = await checkServerHasDsContext(r.fileKey);
      } catch {
        serverOk = false;
      }
      if (cancelled) return;
      if (serverOk || localListed || sessionPrepared) {
        if (serverOk || localListed) setSessionCatalogPrepared(r.fileKey);
        setCatalogReady(true);
      } else {
        setCatalogReady(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [usesFileDs, requestFileContext, checkServerHasDsContext]);

  const handleInvalidateCatalog = useCallback(() => {
    clearSessionCatalogPrepared();
    setCatalogReady(false);
  }, []);

  const handleCatalogReady = useCallback(() => {
    setCatalogReady(true);
    // Defer modal + confetti so the wizard can unmount and the main thread breathes (avoids “frozen” dialog).
    startTransition(() => {
      setCatalogConfettiKey((k) => k + 1);
      setShowCatalogReadyModal(true);
    });
  }, []);
  const creditsDisplay = infiniteForTest || isPro ? '∞' : (creditsRemaining === null ? '—' : `${creditsRemaining}`);
  const knownZeroCredits = !infiniteForTest && !isPro && creditsRemaining !== null && creditsRemaining <= 0;
  const hasSelection = !!selectedNode;
  const selectedLayerName = selectedNode?.name || null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const actionType = hasSelection ? 'wireframe_modified' : 'generate';
      const { estimated_credits } = await estimateCredits({
        action_type: actionType,
        has_screenshot: !!screenshotAttachment && !hasSelection,
      });
      if (!cancelled) setCreditEstimate(typeof estimated_credits === 'number' ? estimated_credits : 3);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasSelection, screenshotAttachment, estimateCredits]);

  /** §6 — Stima crediti per chip affinamento (preview API; addebito finale dal piano server). */
  useEffect(() => {
    if (!showRefinementChips) {
      setRefinementEstimates({});
      return;
    }
    let cancelled = false;
    const hasShot = Boolean(screenshotAttachment) && !hasSelection;
    void (async () => {
      const pairs = await Promise.all(
        REFINEMENT_CHIPS.map(async (chip) => {
          try {
            const { estimated_credits } = await estimateCredits({
              action_type: refinementEstimateActionType(chip.tier),
              has_screenshot: hasShot,
            });
            return [chip.id, Math.max(0, Number(estimated_credits) || 0)] as const;
          } catch {
            return [chip.id, tierCreditHint(chip.tier)] as const;
          }
        }),
      );
      if (!cancelled) setRefinementEstimates(Object.fromEntries(pairs));
    })();
    return () => {
      cancelled = true;
    };
  }, [showRefinementChips, hasSelection, screenshotAttachment, estimateCredits]);

  const promptPlaceholder = hasSelection
    ? `> Modify "${selectedLayerName}": keep layout, improve hierarchy and spacing.`
    : screenshotAttachment
      ? '> Using this screenshot as reference, recreate it with my design system.'
      : '> Describe the screen to generate (you can also paste Figma frame links).';

  const ctaLabel = knownZeroCredits
    ? 'Unlock Unlimited AI'
    : hasSelection
      ? 'Modify Selection'
      : screenshotAttachment
        ? 'Generate From Screenshot'
        : 'Create Wireframes';

  const contextSuggestions = hasSelection
    ? [
        `Keep "${selectedLayerName}" structure but improve spacing and typography hierarchy.`,
        `Adapt "${selectedLayerName}" for mobile while preserving content priority.`,
        `Create two stronger variants for "${selectedLayerName}" aligned to ${selectedSystem}.`,
      ]
    : screenshotAttachment
      ? [
          `Recreate this screenshot using ${selectedSystem} tokens and components.`,
          'Keep layout intent, but simplify visual density and improve contrast.',
          userTier === 'PRO'
            ? 'Generate two alternatives: one safe and one exploratory.'
            : 'Use this screenshot as inspiration and make it production-ready.',
        ]
      : [
          `Create a desktop login screen aligned to ${selectedSystem}.`,
          'Create a mobile checkout summary with sticky CTA and trust cues.',
          userTier === 'PRO'
            ? 'Create a hero section with 2 variants and clear conversion hierarchy.'
            : 'Create a hero section with headline, social proof, and primary CTA.',
        ];

  const promptHints: string[] = [];
  if (promptText.trim().length > 0 && promptText.trim().length < 24) {
    promptHints.push('Prompt is short: add a clear goal and expected outcome.');
  }
  if (!/(mobile|desktop|responsive|tablet)/i.test(promptText)) {
    promptHints.push('Specify target viewport (mobile, desktop, responsive).');
  }
  if (!/(keep|avoid|do not|must|constraint|vincolo|non)/i.test(promptText)) {
    promptHints.push('Add at least one constraint (what to keep or avoid).');
  }
  if (!/(cta|conversion|goal|obiettivo|hierarchy|accessibility|contrast)/i.test(promptText)) {
    promptHints.push('Add success criteria (CTA clarity, hierarchy, accessibility, conversion).');
  }

  const buildEnhancedPrompt = useCallback(
    (base: string) => {
      const context = hasSelection
        ? `Context: modify selection — ${selectedLayerName} (${selectedNode?.type}).`
        : screenshotAttachment
          ? 'Context: screenshot reference (layout inspiration).'
          : 'Context: create from scratch on the current page.';
      return [
        `Goal: ${base}`,
        context,
        `DS: ${selectedSystem} (Comtra applies the catalog during Generate — add only screen-specific detail here).`,
        'Add if missing: viewport, must-have sections/components, copy tone, edge states (empty/error). Skip generic “use DS / WCAG / spacing” advice.',
      ].join('\n');
    },
    [hasSelection, selectedLayerName, selectedNode?.type, screenshotAttachment, selectedSystem]
  );

  /** After Enhance, if DS/context changes, rewrite the terminal without mixing versions. */
  useEffect(() => {
    if (showReport || !enhanceLocked || enhancedGoalSnapshot == null || !inputRef.current) return;
    const next = buildEnhancedPrompt(enhancedGoalSnapshot);
    lastEnhancedBodyRef.current = next;
    inputRef.current.innerText = next;
    setPromptText(next);
  }, [buildEnhancedPrompt, enhancedGoalSnapshot, enhanceLocked, showReport]);

  // Helper to update content state - Ignores Chips, requires text
  const checkContent = () => {
    if (!inputRef.current) return;
    const clone = inputRef.current.cloneNode(true) as HTMLElement;
    const chips = clone.querySelectorAll('span[data-url]');
    chips.forEach((chip) => chip.remove());
    const text = normalizeTerminalText(clone.innerText);
    setHasContent(text.length > 0);
    setPromptText(text);
    skippedPreflightHashRef.current = null;
    if (enhanceLockedRef.current && lastEnhancedBodyRef.current !== null) {
      if (text !== normalizeTerminalText(lastEnhancedBodyRef.current)) {
        setEnhanceLocked(false);
        setEnhancedGoalSnapshot(null);
        lastEnhancedBodyRef.current = null;
      }
    }
  };

  /** Prompt starters replace the terminal content (mutually exclusive), they do not stack. */
  const setPromptFromSuggestion = (snippet: string) => {
    if (!inputRef.current) return;
    setEnhanceLocked(false);
    setEnhancedGoalSnapshot(null);
    lastEnhancedBodyRef.current = null;
    inputRef.current.innerText = snippet;
    setPromptText(snippet);
    setHasContent(snippet.trim().length > 0);
    inputRef.current.focus();
    const sel = window.getSelection();
    if (sel && inputRef.current.firstChild) {
      const range = document.createRange();
      range.selectNodeContents(inputRef.current);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  // Helper to insert chip and move cursor
  const insertChip = (text: string, url: string) => {
        if (!inputRef.current) return;
        inputRef.current.focus();
        
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        range.deleteContents(); 

        const chip = document.createElement('span');
        chip.contentEditable = "false";
        chip.setAttribute('data-url', url);
        chip.style.cssText = "display: inline-block; vertical-align: middle; cursor: pointer; border: 2px solid black; background-color: white; padding: 2px 6px; font-family: monospace; font-size: 10px; font-weight: bold; margin: 0 4px; border-radius: 4px; user-select: none;";
        chip.innerText = `🔗 Ref: ${text}`;

        const space = document.createTextNode("\u00A0"); 

        range.insertNode(space);
        range.insertNode(chip);
        
        range.setStartAfter(space);
        range.setEndAfter(space);
        
        selection.removeAllRanges();
        selection.addRange(range);
        
        checkContent(); 
  };

  // Handles pasting Figma links and converting them to "Chips"
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    
    const figmaRegex = /(https?:\/\/(www\.)?figma\.com\/file\/[a-zA-Z0-9]+\/?([a-zA-Z0-9_-]+)?)/g;
    
    if (figmaRegex.test(text)) {
        const cleanName = text.split('/').pop()?.split('?')[0] || "Ref_Link";
        insertChip(cleanName, text);
    } else {
        document.execCommand('insertText', false, text);
    }
    checkContent();
  };

  const handleContentClick = (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'SPAN' && target.innerText.includes('Ref:')) {
          const url = target.getAttribute('data-url');
          if (url) {
              console.log("[Future Integration] Calling figma.viewport.scrollAndZoomIntoView for:", url);
          }
      }
  };

  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (showPreflight) return;
      if (!loading && hasContent && !dsGateBlocked) void handleGen();
    }
  };

  const handleEnhancePrompt = () => {
    if (!inputRef.current || enhanceLocked) return;
    const raw = getPlainTerminalText(inputRef.current);
    if (!raw) return;
    const base = extractBaseForEnhance(raw);
    if (!base) return;
    const enhanced = buildEnhancedPrompt(base);
    lastEnhancedBodyRef.current = enhanced;
    inputRef.current.innerText = enhanced;
    setPromptText(enhanced);
    setHasContent(true);
    setEnhancedGoalSnapshot(base);
    setEnhanceLocked(true);
  };

  const handleEnhancePlusPrompt = useCallback(async () => {
    if (!inputRef.current || !fetchEnhancePlus || enhancePlusBusy) return;
    const raw = getPlainTerminalText(inputRef.current);
    if (!raw.trim()) return;
    const base = extractBaseForEnhance(raw) || raw.trim();
    const isProLocal = plan === 'PRO';
    const infiniteForTest = !!useInfiniteCreditsForTest;
    if (!isProLocal && !infiniteForTest) {
      const { estimated_credits } = await estimateCredits({ action_type: 'enhance_plus' });
      const cost = Math.max(0, Number(estimated_credits) || 1);
      const rem = creditsRemaining === null ? Infinity : creditsRemaining;
      if (rem < cost) {
        onUnlockRequest();
        return;
      }
    }
    const mode = hasSelection ? 'modify' : screenshotAttachment ? 'screenshot' : 'create';
    const dsSource = usesFileDs ? 'custom' : selectedSystem;
    const selectionLabel =
      hasSelection && selectedNode
        ? `${selectedNode.name || 'Selection'} (${selectedNode.type || 'LAYER'})`
        : null;
    setEnhancePlusBusy(true);
    setGenError(null);
    try {
      const data = await fetchEnhancePlus({
        prompt: raw.slice(0, 8000),
        mode,
        ds_source: dsSource,
        has_screenshot: Boolean(screenshotAttachment),
        selection_label: selectionLabel,
      });
      const next = String(data.enhanced_prompt || '').trim();
      if (!next) {
        setGenError('Enhance Plus returned empty text.');
        return;
      }
      lastEnhancedBodyRef.current = next;
      inputRef.current.innerText = next;
      setPromptText(next);
      setHasContent(true);
      setEnhancedGoalSnapshot(extractBaseForEnhance(next) || base);
      setEnhanceLocked(true);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : String(e));
    } finally {
      setEnhancePlusBusy(false);
    }
  }, [
    fetchEnhancePlus,
    enhancePlusBusy,
    hasSelection,
    screenshotAttachment,
    usesFileDs,
    selectedSystem,
    plan,
    useInfiniteCreditsForTest,
    estimateCredits,
    creditsRemaining,
    onUnlockRequest,
    selectedNode,
  ]);

  const runGeneratePipeline = useCallback(
    async (finalPrompt: string, opts?: { chipId?: string }) => {
      if (!canGenerate) {
        onUnlockRequest();
        return;
      }
      if (usesFileDs && !catalogReady) {
        setGenError('Finish the design system import above before generating.');
        return;
      }
      setLoading(true);
      setGenerateStep('context');
      setShowReport(false);
      setGenError(null);
      setCanvasApplyResult(null);
      lastActionPlanRef.current = null;
      setShowRefinementChips(false);
      setLastDiagLine(null);

      void fetchGenerationPluginEvent?.({
        event_type: 'generate_chat_turn_started',
        payload: { prompt_len: finalPrompt.trim().length },
      });

      const trimmed = finalPrompt.trim();
      if (!trimmed) {
        setLoading(false);
        setGenerateStep('idle');
        return;
      }

      const { fileKey, error: ctxError } = await requestFileContext();
      if (ctxError || !fileKey) {
        setLoading(false);
        setGenerateStep('idle');
        const opts = getSystemToastOptions('file_link_unavailable');
        setGenError(opts.description ?? opts.title);
        return;
      }

      const mode = hasSelection ? 'modify' : screenshotAttachment ? 'screenshot' : 'create';
      const dsSource = usesFileDs ? 'custom' : selectedSystem;

      setGenerateStep('ai');
      try {
        const data = await fetchGenerate({
          file_key: fileKey,
          prompt: trimmed,
          mode,
          ds_source: dsSource,
          screenshot_base64:
            !hasSelection && screenshotAttachment ? screenshotAttachment.dataUrl : null,
        });
        const actionPlan = data?.action_plan;
        if (!actionPlan || typeof actionPlan !== 'object') {
          appendGenerateTurn(
            trimmed,
            'Errore: risposta dal server non valida (action plan mancante o malformato).',
          );
          setGenError('Invalid response from server.');
          setLoading(false);
          setGenerateStep('idle');
          return;
        }
        const metaDiag = (actionPlan as { metadata?: { generation_diagnostics?: { phase_timers?: { total_ms?: number } } } })
          .metadata?.generation_diagnostics;
        const totalMs = metaDiag?.phase_timers?.total_ms;
        if (typeof totalMs === 'number' && Number.isFinite(totalMs)) {
          setLastDiagLine(`Ultimo round-trip server ~${Math.round(totalMs / 1000)}s`);
        }

        lastActionPlanRef.current = actionPlan;
        const isModify = mode === 'modify';
        lastApplyWasModifyRef.current = isModify;
        setRes(JSON.stringify(actionPlan, null, 2));
        setLastRequestId(data?.request_id ?? null);
        setLastVariant(data?.variant ?? null);
        setFeedbackSent(false);

        setGenerateStep('canvas');
        const canvasResult = await runCanvasApply(actionPlan, {
          modifyMode: isModify,
          serverRequestId: data?.request_id ?? null,
          figmaFileKey: fileKey,
          qualityWatch: Boolean(data?.request_id),
        });
        if (!canvasResult.ok) {
          appendGenerateTurn(
            trimmed,
            `Canvas: ${humanizeCanvasError(canvasResult.error || 'Canvas apply failed.')}`,
          );
          void fetchGenerationPluginEvent?.({
            event_type: 'generate_canvas_apply_failed',
            figma_file_key: fileKey,
            payload: { error: canvasResult.error, chip_id: opts?.chipId },
          });
          setGenError(humanizeCanvasError(canvasResult.error || 'Canvas apply failed.'));
          setLoading(false);
          setGenerateStep('idle');
          return;
        }

        void fetchGenerationPluginEvent?.({
          event_type: 'generation_applied',
          request_id: data?.request_id ?? null,
          figma_file_key: fileKey,
          payload: { mode, success: true, root_id: canvasResult.rootId ?? null },
        });

        setGenerateStep('credits');
        const meta = (actionPlan as { metadata?: { estimated_credits?: number } }).metadata;
        const creditsToConsume = meta?.estimated_credits ?? 3;
        let consumeActionType: string = mode === 'modify' ? 'wireframe_modified' : 'generate';
        if (opts?.chipId) {
          const chipDef = REFINEMENT_CHIPS.find((c) => c.id === opts.chipId);
          if (chipDef) consumeActionType = refinementEstimateActionType(chipDef.tier);
        }
        const consumed = await consumeCredits({
          action_type: consumeActionType,
          credits_consumed: creditsToConsume,
          file_id: fileKey,
        });
        if (consumed?.error) {
          appendGenerateTurn(
            trimmed,
            `Crediti: ${consumed.error}\n\nIl frame era già stato creato sulla canvas; controlla il saldo e riprova.`,
          );
          setGenError(consumed.error);
          setLoading(false);
          setGenerateStep('idle');
          return;
        }
        appendGenerateTurn(
          trimmed,
          buildAssistantSummaryFromPlan(actionPlan, { rootId: canvasResult.rootId ?? null }),
        );
        setShowReport(true);
        setShowRefinementChips(true);
        void fetchGenerationPluginEvent?.({
          event_type: 'generate_chat_turn_succeeded',
          request_id: data?.request_id ?? null,
          figma_file_key: fileKey,
        });
        if (opts?.chipId) {
          void fetchGenerationPluginEvent?.({
            event_type: 'generate_chip_succeeded',
            payload: { chip_id: opts.chipId },
            figma_file_key: fileKey,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        appendGenerateTurn(trimmed, `Errore: ${humanizeCanvasError(msg)}`);
        void fetchGenerationPluginEvent?.({
          event_type: 'generate_chat_turn_failed',
          figma_file_key: fileKey,
          payload: { message: msg, chip_id: opts?.chipId },
        });
        if (opts?.chipId) {
          void fetchGenerationPluginEvent?.({
            event_type: 'generate_chip_failed',
            payload: { chip_id: opts.chipId },
            figma_file_key: fileKey,
          });
        }
        setGenError(humanizeCanvasError(msg));
      } finally {
        setLoading(false);
        setGenerateStep('idle');
      }
    },
    [
      canGenerate,
      onUnlockRequest,
      usesFileDs,
      catalogReady,
      requestFileContext,
      hasSelection,
      screenshotAttachment,
      fetchGenerate,
      selectedSystem,
      runCanvasApply,
      appendGenerateTurn,
      consumeCredits,
      fetchGenerationPluginEvent,
      humanizeCanvasError,
    ],
  );

  const handlePreflightDismissRun = useCallback(async () => {
    const raw = pendingPreflightPromptRef.current || preflightPromptSnapshot || getPlainTerminalText(inputRef.current);
    if (!raw.trim()) {
      setShowPreflight(false);
      return;
    }
    skippedPreflightHashRef.current = promptGateKey(raw);
    setShowPreflight(false);
    void fetchGenerationPluginEvent?.({
      event_type: 'generate_preflight_dismissed',
      payload: { prompt_len: raw.trim().length },
    });
    await runGeneratePipeline(raw);
  }, [preflightPromptSnapshot, runGeneratePipeline, fetchGenerationPluginEvent]);

  const handlePreflightConfirm = useCallback(async () => {
    const raw = pendingPreflightPromptRef.current || preflightPromptSnapshot || '';
    const ev = evaluatePreflightClarifier(raw);
    const chipList =
      preflightRemote?.chips?.length ? preflightRemote.chips : ev.chips;
    const labels = chipList.filter((c) => preflightPick[c.id]).map((c) => c.label);
    const merged =
      labels.length > 0
        ? `${raw.trim()}\n\n[Vincoli da chiarimento]\n${labels.map((l) => `- ${l}`).join('\n')}`
        : raw.trim();
    setShowPreflight(false);
    void fetchGenerationPluginEvent?.({
      event_type: 'generate_preflight_completed',
      payload: { variant: ev.variant, picks: labels.length },
    });
    await runGeneratePipeline(merged);
  }, [
    preflightPick,
    preflightPromptSnapshot,
    preflightRemote,
    runGeneratePipeline,
    fetchGenerationPluginEvent,
  ]);

  const handleGen = async () => {
    if (!canGenerate) {
      onUnlockRequest();
      return;
    }
    if (usesFileDs && !catalogReady) {
      setGenError('Finish the design system import above before generating.');
      return;
    }
    const rawText = getPlainTerminalText(inputRef.current);
    if (!rawText.trim()) return;

    const ev = evaluatePreflightClarifier(rawText);
    const gate = promptGateKey(rawText);
    if (ev.show && skippedPreflightHashRef.current !== gate) {
      pendingPreflightPromptRef.current = rawText;
      setPreflightPromptSnapshot(rawText);
      setPreflightPick({});
      setPreflightRemote(null);
      setShowPreflight(true);
      void fetchGenerationPluginEvent?.({
        event_type: 'generate_preflight_opened',
        payload: { variant: ev.variant },
      });
      if (fetchConversationHints) {
        void fetchConversationHints(rawText).then((h) => {
          if (h?.preflight?.chips?.length) setPreflightRemote(h.preflight);
        });
      }
      return;
    }

    await runGeneratePipeline(rawText);
  };

  const handleNewConversation = useCallback(() => {
    setConversationTurns([]);
    setServerThreadId(null);
    serverThreadIdRef.current = null;
    setShowRefinementChips(false);
    setShowPreflight(false);
    setPreflightRemote(null);
    skippedPreflightHashRef.current = null;
    if (userId && genFileKey && dsScopeHash) {
      safeLocalStorageRemoveItem(localConversationStorageKey(userId, genFileKey, dsScopeHash));
      safeLocalStorageRemoveItem(activeThreadStorageKey(userId, genFileKey, dsScopeHash));
    }
    void fetchGenerationPluginEvent?.({ event_type: 'generate_thread_new', payload: {} });
  }, [userId, genFileKey, dsScopeHash, fetchGenerationPluginEvent]);

  const handleSelectThread = useCallback(
    async (threadId: string) => {
      if (!generateConversationApi || !threadId) return;
      try {
        const { messages } = await generateConversationApi.fetchMessages(threadId);
        const turns: ConversationTurn[] = [];
        for (const m of messages) {
          const txt =
            m.content_json && typeof m.content_json === 'object' && m.content_json.text != null
              ? String(m.content_json.text)
              : '';
          const role = m.role === 'assistant' ? 'assistant' : 'user';
          turns.push({
            id: m.id,
            role,
            body: txt.slice(0, 1200),
            createdAt: Date.now(),
          });
        }
        setConversationTurns(turns.slice(-MAX_CONVERSATION_MESSAGES));
        setServerThreadId(threadId);
        serverThreadIdRef.current = threadId;
        if (userId && genFileKey && dsScopeHash) {
          safeLocalStorageSetItem(activeThreadStorageKey(userId, genFileKey, dsScopeHash), threadId);
          persistTurnsLocal(turns.slice(-MAX_CONVERSATION_MESSAGES));
        }
      } catch {
        setGenError('Impossibile caricare la conversazione.');
      }
    },
    [generateConversationApi, userId, genFileKey, dsScopeHash, persistTurnsLocal],
  );

  const applyRefinementChip = useCallback(
    async (chip: (typeof REFINEMENT_CHIPS)[number]) => {
      if (!inputRef.current || loading) return;
      void fetchGenerationPluginEvent?.({
        event_type: 'generate_chip_clicked',
        payload: { chip_id: chip.id, tier: chip.tier },
      });
      const base = getPlainTerminalText(inputRef.current);
      const next = `${base}${chip.append}`.trim();
      inputRef.current.innerText = next;
      setPromptText(next);
      setHasContent(true);
      await runGeneratePipeline(next, { chipId: chip.id });
    },
    [loading, runGeneratePipeline, fetchGenerationPluginEvent],
  );

  const generateStepLabel =
    generateStep === 'context'
      ? 'Contesto file…'
      : generateStep === 'ai'
        ? 'Generazione layout (server)…'
        : generateStep === 'canvas'
          ? 'Creazione su Figma (può richiedere un minuto con molti componenti)…'
          : generateStep === 'credits'
            ? 'Aggiornamento crediti…'
            : '';

  const handleViewFigma = async () => {
    const plan = lastActionPlanRef.current;
    if (!plan || canvasBusy) return;
    setCanvasBusy(true);
    try {
      const r = await runCanvasApply(plan, { modifyMode: lastApplyWasModifyRef.current });
      if (!r.ok) setGenError(humanizeCanvasError(r.error || 'Canvas apply failed.'));
    } finally {
      setCanvasBusy(false);
    }
  };

  const handleInsertInspiration = (txt: string) => {
    setPromptFromSuggestion(txt);
  };

  const handleUploadClick = () => {
    screenshotFileInputRef.current?.click();
  };

  const handleScreenshotFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const maxBytes = 6 * 1024 * 1024;
    if (file.size > maxBytes) {
      setGenError('Image too large (max 6MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      setScreenshotAttachment({ name: file.name, dataUrl });
      setGenError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteUpload = () => {
    setScreenshotAttachment(null);
  };

  const handleFeedback = async (thumbs: 'up' | 'down') => {
    if (!lastRequestId || feedbackSent) return;
    if (thumbs === 'down') {
      setShowFeedbackModal(true);
      return;
    }
    try {
      await fetchGenerateFeedback({ request_id: lastRequestId, thumbs });
      setFeedbackSent(true);
    } catch {
      // silent fail
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!lastRequestId || feedbackSent) return;
    try {
      await fetchGenerateFeedback({
        request_id: lastRequestId,
        thumbs: 'down',
        comment: feedbackComment.trim() || undefined,
      });
      setFeedbackSent(true);
      setShowFeedbackModal(false);
      setFeedbackComment('');
    } catch {
      // silent fail
    }
  };

  // Filter Design Systems
  const filteredSystems = availableSystems.filter(s => s.toLowerCase().includes(systemSearch.toLowerCase()));
  const dsConnectionText = usesFileDs
    ? catalogReady
      ? 'Connected to this file. Generate will use imported rules, tokens, and components.'
      : dsImportBusy
        ? 'Importing design system data for this file…'
        : 'Import the design system for this file to unlock Generate with Custom (Current).'
    : `Using ${selectedSystem} as the active reference system.`;
  const dsConnectionTone = usesFileDs
    ? catalogReady
      ? 'bg-emerald-50 text-emerald-900'
      : dsImportBusy
        ? 'bg-amber-50 text-amber-900'
        : 'bg-yellow-50 text-yellow-900'
    : 'bg-sky-50 text-sky-900';

  const generateContextSummary = hasSelection
    ? `Modifica · ${selectedLayerName ?? 'layer'}`
    : screenshotAttachment
      ? `Screenshot · ${screenshotAttachment.name}`
      : 'Creazione wireframe';
  const generatePhaseActiveIndex =
    generateStep === 'context'
      ? 0
      : generateStep === 'ai'
        ? 1
        : generateStep === 'canvas'
          ? 2
          : generateStep === 'credits'
            ? 3
            : -1;
  const generatePhaseLabels = ['Contesto', 'Server AI', 'Canvas', 'Crediti'] as const;

  const dsCardHeaderRight =
    usesFileDs && genFileName ? (
      <span
        data-component="Generate: DS Name Header"
        className="max-w-[60%] truncate text-[9px] font-black uppercase text-emerald-900 tracking-tight"
        title={genFileName}
      >
        {genFileName}
      </span>
    ) : usesFileDs && fileCtxLoading ? (
      <span className="text-[9px] font-bold uppercase text-gray-400" aria-hidden>
        …
      </span>
    ) : !usesFileDs ? (
      <span className="max-w-[60%] truncate text-right" title={selectedSystem}>
        {selectedSystem}
      </span>
    ) : undefined;

  const threadScopeReady = !!(
    userId &&
    generateConversationApi &&
    genFileKey &&
    dsScopeHash
  );
  const showChatComposerShell = !threadScopeReady || generateComposerTab === 'chat';
  const hasConversationStarted = conversationTurns.length > 0;

  return (
    <div
      data-component="Generate: View Container"
      className="relative flex min-h-full flex-col gap-3 p-3 pb-28 sm:gap-4 sm:p-4"
    >
      <div data-component="Generate: Global header" className="shrink-0">
        <div className="flex items-center justify-center">
          <div
            data-component="Generate: Credit Banner"
            className={`transform -rotate-2 border-2 border-black px-3 py-1 text-[10px] font-black uppercase shadow-[3px_3px_0_0_#000] ${knownZeroCredits ? 'bg-red-100 text-red-600' : 'bg-[#ffc900] text-black'}`}
          >
            Credits · {creditsDisplay}
          </div>
        </div>
        <div className="mt-2 border-t-2 border-black/10 pt-2">
          <button
            type="button"
            onClick={() => setShowReadFirstModal(true)}
            className="w-full text-left text-[10px] font-black uppercase tracking-wide text-gray-600 underline decoration-black/25 underline-offset-2 hover:text-black"
          >
            Read first + Design system data
          </button>
        </div>
        <div className="mt-2 h-[2px] w-full bg-black/10" />
      </div>

      {/* Error from generation or file context */}
      {genError && (
        <div className="bg-red-50 border-2 border-red-400 p-3 text-[10px] font-medium text-red-800 flex justify-between items-start gap-2">
          <span>{genError}</span>
          <button type="button" onClick={() => setGenError(null)} className="font-bold shrink-0" aria-label="Dismiss">✕</button>
        </div>
      )}

      {usesFileDs && !showReport && (
        <GenerateDsImport
          fileKey={genFileKey}
          fileName={genFileName}
          fileContextLoading={fileCtxLoading}
          fileContextError={genFileCtxError}
          requestDsContextIndex={requestDsContextIndex}
          persistDsImportToServer={persistDsImportToServer}
          writeDsImportMeta={writeDsImportMeta}
          catalogReady={catalogReady}
          onCatalogReady={handleCatalogReady}
          onInvalidateCatalog={handleInvalidateCatalog}
          dsImportBusy={dsImportBusy}
          onBusyChange={setDsImportBusy}
          isPro={isPro || !!useInfiniteCreditsForTest}
          onUnlockRequest={onUnlockRequest}
          fetchImportNarration={fetchImportNarration}
        />
      )}

      {showGenerateComposer && !showReport && (
        <div className="shrink-0">
          <div className="border-2 border-black bg-white p-2">
            <BrutalDropdown
              open={isSystemOpen}
              onOpenChange={setIsSystemOpen}
              maxHeightClassName="max-h-[260px]"
              panelClassName="!overflow-hidden flex flex-col p-0"
              trigger={
                <button
                  type="button"
                  data-component="Generate: DS Selector"
                  onClick={() => setIsSystemOpen(!isSystemOpen)}
                  className="w-full p-2 flex justify-between items-center cursor-pointer text-xs font-black bg-white text-left uppercase"
                >
                  <span className="truncate min-w-0">
                    <span className="text-gray-500">Target &amp; DS</span> · {generateContextSummary} · {selectedSystem}
                  </span>
                  <span aria-hidden>{isSystemOpen ? '▲' : '▼'}</span>
                </button>
              }
            >
              <div className="p-2 border-t border-black/10 space-y-2">
                <div className="text-[10px] font-bold">
                  {hasSelection
                    ? `Target: ${selectedLayerName}`
                    : screenshotAttachment
                      ? `Screenshot: ${screenshotAttachment.name}`
                      : 'Target will be inferred from your conversational request.'}
                </div>
                {!hasSelection && !screenshotAttachment ? (
                  <>
                    <input
                      ref={screenshotFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      aria-hidden
                      onChange={handleScreenshotFileChange}
                    />
                    <button
                      type="button"
                      data-component="Generate: Upload Button"
                      onClick={handleUploadClick}
                      className="w-full border-2 border-black border-dashed py-2 text-[10px] font-bold uppercase hover:bg-gray-50 text-gray-600"
                    >
                      Upload image
                    </button>
                  </>
                ) : null}
                {screenshotAttachment ? (
                  <button
                    type="button"
                    onClick={handleDeleteUpload}
                    className="w-full text-left text-[10px] font-bold underline"
                  >
                    Remove screenshot
                  </button>
                ) : null}
                <input
                  type="text"
                  placeholder="Search System..."
                  autoFocus
                  value={systemSearch}
                  onChange={(e) => setSystemSearch(e.target.value)}
                  className="w-full p-2 text-xs border-2 border-black outline-none font-mono bg-yellow-50"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="overflow-y-auto custom-scrollbar border-2 border-black max-h-[160px] bg-white">
                  {filteredSystems.map((sys) => (
                    <div
                      key={sys}
                      role="option"
                      onClick={() => {
                        setSelectedSystem(sys);
                        setIsSystemOpen(false);
                        setSystemSearch('');
                      }}
                      className={`${brutalSelectOptionRowClass} ${selectedSystem === sys ? brutalSelectOptionSelectedClass : ''}`.trim()}
                    >
                      {sys}
                    </div>
                  ))}
                </div>
                <div
                  data-component="Generate: DS Connection Status"
                  className={`border-2 border-black px-2.5 py-2 text-[10px] leading-snug font-bold ${dsConnectionTone}`}
                >
                  {dsConnectionText}
                </div>
                {usesFileDs && catalogReady ? (
                  <div className="pt-2 pb-1">
                    <Button
                      variant="secondary"
                      className="w-full text-[10px] uppercase"
                      onClick={handleInvalidateCatalog}
                    >
                      Update Design System
                    </Button>
                  </div>
                ) : null}
              </div>
            </BrutalDropdown>
          </div>
          <div className="mt-2 h-[2px] w-full bg-black/10" />
        </div>
      )}

      {showGenerateComposer && !showReport ? (
        <div data-component="Generate: Conversational column" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {userId && generateConversationApi && genFileKey && dsScopeHash ? (
            <>
              <div
                className="inline-flex w-fit max-w-full flex-wrap gap-0 border-2 border-black bg-white"
                data-component="Generate: Chat / Conversazioni tabs"
              >
                <button
                  type="button"
                  className={`text-[10px] font-black uppercase px-2.5 py-1 border-r-2 border-black ${
                    generateComposerTab === 'chat' ? 'bg-[#ffc900]' : 'bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => setGenerateComposerTab('chat')}
                >
                  Chat
                </button>
                <button
                  type="button"
                  className={`text-[10px] font-black uppercase px-2.5 py-1 ${
                    generateComposerTab === 'threads' ? 'bg-[#ffc900]' : 'bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => setGenerateComposerTab('threads')}
                >
                  Threads
                </button>
              </div>
              <div className="h-[2px] w-full bg-black/10 mt-2 shrink-0" />
            </>
          ) : null}

          {showChatComposerShell ? (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar py-2">
                {showPreflight ? (
                  <div data-component="Generate: Preflight clarifier" className="space-y-2 px-1 pb-2">
                    <p className="text-[10px] font-black uppercase">
                      {preflightRemote?.title || 'Chiarimenti leggeri (opzionale)'}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(preflightRemote?.chips?.length
                        ? preflightRemote.chips
                        : evaluatePreflightClarifier(preflightPromptSnapshot).chips
                      ).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setPreflightPick((p) => ({
                              ...p,
                              [c.id]: !p[c.id],
                            }))
                          }
                          className={`text-[9px] px-2 py-1 border-2 border-black font-bold ${
                            preflightPick[c.id] ? 'bg-[#ffc900]' : 'bg-white'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" className="text-[10px]" type="button" onClick={() => void handlePreflightDismissRun()}>
                        Continua senza
                      </Button>
                      <Button variant="primary" className="text-[10px]" type="button" onClick={() => void handlePreflightConfirm()}>
                        Genera
                      </Button>
                    </div>
                    <div className="h-[2px] w-full bg-black/10" />
                  </div>
                ) : null}

                <div className="px-1 space-y-2">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-mono leading-tight">
                    <span><span className="font-black uppercase text-gray-500">DS </span>{selectedSystem}</span>
                    <span><span className="font-black uppercase text-gray-500">Contesto </span>{generateContextSummary}</span>
                    {usesFileDs && genFileName ? (
                      <span className="truncate max-w-full">
                        <span className="font-black uppercase text-gray-500">File </span>{genFileName}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {generatePhaseLabels.map((label, i) => {
                      const active = loading && generatePhaseActiveIndex === i;
                      const done = loading && generatePhaseActiveIndex > i;
                      return (
                        <span
                          key={label}
                          className={`text-[9px] font-black uppercase px-1.5 py-0.5 border-2 border-black ${
                            active ? 'bg-[#ffc900]' : done ? 'bg-emerald-100' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>
                  {lastDiagLine ? (
                    <p className="text-[9px] text-emerald-900 font-mono leading-snug">{lastDiagLine}</p>
                  ) : null}
                </div>

                <div className="px-1 pt-1 space-y-2">
                  {conversationTurns.length === 0 ? (
                    <div className="text-[10px] leading-snug text-gray-700 space-y-2">
                      <p>Start chatting with Generate. I will reason live on context, AI, canvas, and credits steps.</p>
                      <div className="flex flex-wrap gap-1.5">
                        {contextSuggestions.map((txt, i) => (
                          <button
                            key={`starter-empty-${i}`}
                            type="button"
                            onClick={() => handleInsertInspiration(txt)}
                            disabled={!canGenerate || dsGateBlocked}
                            className={`text-[9px] border-2 border-black px-2 py-1 bg-white font-bold ${canGenerate && !dsGateBlocked ? 'hover:bg-[#ffc900]' : 'opacity-50'}`}
                          >
                            {txt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    conversationTurns.map((turn) => (
                      <div key={turn.id} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[95%] border-2 border-black px-2 py-1.5 text-[10px] whitespace-pre-wrap leading-snug ${
                            turn.role === 'user' ? 'bg-[#ffc900]/90 font-mono' : 'bg-white'
                          }`}
                        >
                          {turn.body}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {showRefinementChips ? (
                  <div data-component="Generate: Refinement chips" className="px-1 pt-2">
                    <p className="text-[9px] font-black uppercase text-gray-600 mb-1.5">Refinement chips</p>
                    <div className="flex flex-wrap gap-1.5">
                      {REFINEMENT_CHIPS.map((chip) => (
                        <button
                          key={chip.id}
                          type="button"
                          disabled={loading || dsGateBlocked}
                          onClick={() => void applyRefinementChip(chip)}
                          title={`Stima: ${refinementEstimates[chip.id] ?? tierCreditHint(chip.tier)} crediti (preview)`}
                          className="text-[9px] border-2 border-black px-2 py-1 bg-gray-50 hover:bg-[#ffc900] disabled:opacity-40 font-bold"
                        >
                          {chip.label} (~{refinementEstimates[chip.id] ?? tierCreditHint(chip.tier)} cr)
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="h-[2px] w-full bg-black/10 shrink-0" />
              <div data-component="Generate: Composer dock" className="shrink-0 bg-white pt-2">
                <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleEnhancePrompt}
                      disabled={!hasContent || loading || enhancePlusBusy || enhanceLocked || dsGateBlocked}
                      className={`text-[9px] border-2 border-black px-2 py-0.5 uppercase font-black ${!hasContent || loading || enhancePlusBusy || enhanceLocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#ffc900]'}`}
                    >
                      Enhance
                    </button>
                    {fetchEnhancePlus ? (
                      <button
                        type="button"
                        onClick={() => void handleEnhancePlusPrompt()}
                        disabled={!hasContent || loading || enhancePlusBusy || dsGateBlocked}
                        className={`text-[9px] border-2 border-black px-2 py-0.5 uppercase font-black ${!hasContent || loading || enhancePlusBusy ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#ffc900]'}`}
                      >
                        {enhancePlusBusy ? '…' : plan === 'PRO' ? 'Enhance+' : `Enhance+ ${enhancePlusCost}cr`}
                      </button>
                    ) : null}
                  </div>
                  <span className="text-[9px] font-mono text-gray-500">Cmd/Ctrl + Enter</span>
                </div>
                <div
                  ref={inputRef}
                  contentEditable
                  onPaste={handlePaste}
                  onInput={checkContent}
                  onKeyDown={handlePromptKeyDown}
                  onClick={handleContentClick}
                  data-component="Generate: Rich Input"
                  className={`${BRUTAL.input} min-h-[120px] text-sm bg-white focus:bg-white cursor-text ${dsGateBlocked ? 'opacity-50 pointer-events-none' : ''}`}
                  style={{ whiteSpace: 'pre-wrap' }}
                  data-placeholder={promptPlaceholder}
                />
                {promptHints.length > 0 && (
                  <div className="mt-1 bg-yellow-50 border border-yellow-300 p-2 text-[10px] text-yellow-900">
                    {promptHints.slice(0, 2).map((hint) => (
                      <p key={hint}>- {hint}</p>
                    ))}
                  </div>
                )}
                <Button
                  data-component="Generate: Generate Button"
                  variant="primary"
                  fullWidth
                  layout="row"
                  onClick={handleGen}
                  disabled={!hasContent || loading || (!canGenerate && !isPro) || dsGateBlocked}
                  className="relative overflow-hidden min-h-[48px] mt-2"
                  aria-busy={loading}
                >
                  {loading ? (
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      <span className="w-2 h-2 shrink-0 bg-black animate-pulse" aria-hidden />
                      Weaving Magic...
                    </span>
                  ) : (
                    <>
                      <span className="relative z-10">{ctaLabel}</span>
                      {canGenerate && (
                        <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">
                          -{creditEstimate} Credits
                        </span>
                      )}
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="py-2 text-[10px] text-gray-600">Open Chat tab to continue.</div>
          )}
        </div>
      ) : showReport ? (
        <div data-component="Generate: Report Container" className="animate-in slide-in-from-bottom-2 fade-in duration-300">
            {/* AI Report Card */}
            <div className={`${BRUTAL.card} bg-white mb-4`}>
                <div className="flex justify-between items-center mb-3 border-b-2 border-black/10 pb-2">
                    <h3 className="font-black uppercase text-sm">AI Implementation Report</h3>
                    <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 font-bold rounded-sm border border-yellow-200">Attention Needed</span>
                </div>
                
                <div className="space-y-3">
                    <div className="flex items-start gap-2">
                        <span className="text-green-500 font-bold">✓</span>
                        <p className="text-[10px] text-gray-600">Generated using <strong>{selectedSystem}</strong> conventions.</p>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-green-500 font-bold">✓</span>
                        <p className="text-[10px] text-gray-600">
                          Action plan with <strong>{(() => { try { const p = res ? JSON.parse(res) : null; return Array.isArray(p?.actions) ? p.actions.length : 0; } catch { return 0; } })()}</strong> actions.
                          {res && (
                            <details className="mt-2">
                              <summary className="cursor-pointer font-bold uppercase text-[9px]">JSON</summary>
                              <pre className="mt-1 p-2 bg-gray-100 text-[9px] overflow-x-auto max-h-[200px] overflow-y-auto border border-black">{res}</pre>
                            </details>
                          )}
                        </p>
                    </div>
                    {canvasApplyResult && (
                      <div className="flex items-start gap-2">
                        <span className={canvasApplyResult.ok ? 'text-green-500 font-bold' : 'text-red-600 font-bold'}>
                          {canvasApplyResult.ok ? '✓' : '✕'}
                        </span>
                        <p className="text-[10px] text-gray-600">
                          {canvasApplyResult.ok
                            ? 'Frame created on the current page (check the Figma canvas).'
                            : `Canvas: ${canvasApplyResult.error || 'operation failed'}`}
                        </p>
                      </div>
                    )}
                </div>

                {/* Feedback: Thumbs up/down */}
                {lastRequestId && (
                  <div className="mt-3 pt-3 border-t border-black/10">
                    <p className="text-[9px] font-bold uppercase text-gray-500 mb-2">Was this output helpful?</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleFeedback('up')}
                        disabled={feedbackSent}
                        className={`p-2 rounded border-2 border-black transition-colors ${feedbackSent ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-100'}`}
                        title="Thumbs up"
                      >
                        <span className="text-base">👍</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFeedback('down')}
                        disabled={feedbackSent}
                        className={`p-2 rounded border-2 border-black transition-colors ${feedbackSent ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-100'}`}
                        title="Thumbs down"
                      >
                        <span className="text-base">👎</span>
                      </button>
                      {feedbackSent && <span className="text-[10px] text-gray-500 self-center">Thanks for your feedback!</span>}
                    </div>
                  </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setShowReport(false)} className="flex-1 text-xs">
                    Back
                </Button>
                <Button
                    variant="primary"
                    layout="row"
                    onClick={() => void handleViewFigma()}
                    disabled={canvasBusy || !lastActionPlanRef.current}
                    className="flex-[2] text-xs"
                >
                    {canvasBusy ? 'Applying…' : 'Apply again on canvas'}
                </Button>
            </div>
        </div>
      ) : null}

      {/* Feedback Modal (thumbs down) */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowFeedbackModal(false)}>
          <div className={`${BRUTAL.card} bg-white max-w-sm w-full mx-4 p-4`} onClick={e => e.stopPropagation()}>
            <h3 className="font-black uppercase text-sm mb-2">Share your feedback</h3>
            <p className="text-[10px] text-gray-600 mb-3">What could we improve? (optional)</p>
            <textarea
              value={feedbackComment}
              onChange={e => setFeedbackComment(e.target.value)}
              placeholder="Your comment..."
              className="w-full p-2 text-[12px] border-2 border-black mb-3 min-h-[80px] resize-none"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setShowFeedbackModal(false); setFeedbackComment(''); }} className="flex-1 text-xs">
                Cancel
              </Button>
              <Button variant="black" onClick={handleFeedbackSubmit} className="flex-1 text-xs">
                Send feedback
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Read First Modal */}
      {showReadFirstModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowReadFirstModal(false)}>
          <div className={`${BRUTAL.card} bg-white max-w-lg w-full mx-4 p-4`} onClick={e => e.stopPropagation()}>
            <h3 className="font-black uppercase text-sm mb-2">Generation Logic</h3>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-gray-700 leading-tight">
              <li><strong>Step 1 - Context:</strong> pick one visual source: a current Figma selection <strong>or</strong> an uploaded screenshot.</li>
              <li><strong>Step 2 - Design System:</strong> choose the style perimeter (default is current/linked library).</li>
              <li><strong>Step 3 - AI Prompt:</strong> write your intent in the terminal and optionally paste Figma frame links.</li>
              <li><strong>Execution:</strong> Comtra selects the best generation strategy in the background and returns a production-ready action plan.</li>
            </ul>
            <div className="flex justify-end mt-4">
              <Button variant="secondary" onClick={() => setShowReadFirstModal(false)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {showCatalogReadyModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setShowCatalogReadyModal(false)}
        >
          <Confetti key={catalogConfettiKey} density="lite" />
          <div
            className={`${BRUTAL.card} bg-white max-w-sm w-full p-4 relative`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-black uppercase text-sm mb-2">Design system imported</h3>
            <p className="text-xs text-gray-700 leading-snug mb-4">
              The catalog for this file is ready. You can now generate screens with your linked rules, tokens, and
              components.
            </p>
            <Button variant="primary" className="text-xs w-full" onClick={() => setShowCatalogReadyModal(false)}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {showLegalModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowLegalModal(false)}
        >
          <div className={`${BRUTAL.card} bg-white max-w-lg w-full p-4`} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black uppercase text-sm mb-2">Design system data</h3>
            <p className="text-xs text-gray-700 leading-[1.4]">
              Comtra uses your design system data to run Generate and the features you requested. DS content is not
              used to train generic AI models. Privacy and retention details are provided in product legal docs.
            </p>
            <div className="flex justify-end mt-4">
              <Button variant="secondary" onClick={() => setShowLegalModal(false)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
