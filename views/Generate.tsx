
import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, startTransition } from 'react';
import { BRUTAL } from '../constants';
import { Button } from '../components/ui/Button';
import { GenerateDsImport, type RequestDsContextIndexFn } from './GenerateDsImport';
import {
  clearSessionCatalogPrepared,
  hasImportForFileKey,
  isSessionCatalogPreparedForFile,
  loadDsImports,
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
} from '../lib/generateConversationHelpers';
import { classifyIntent, getResponse, type IntentId } from '../lib/intentClassifier';
import {
  safeLocalStorageGetItem,
  safeLocalStorageRemoveItem,
  safeLocalStorageSetItem,
} from '../lib/safeWebStorage';

/** Break out of view `p-3 sm:p-4` so black rules span the full plugin width. */
const FULL_BLEED_OUT = '-mx-3 sm:-mx-4';
const FULL_BLEED_IN = 'px-3 sm:px-4';

/** Hybrid UX §8 — cockpit plugin (this view); archive/search/analytics via web/API admin. */

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
  /** Telemetry / learning loop (DI v2): post-generation events from the plugin. */
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
    return 'Generate: some design-system components cannot be resolved in this file (published keys or linked libraries). Enable the libraries your DS uses, re-run import from this screen, and try again.';
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
  actions?: string[];
  actionIntent?: IntentId;
  actionPrompt?: string;
};

type ComposerAttachment = {
  id: string;
  type: 'image' | 'frame';
  name: string;
  previewUrl?: string;
  sourceUrl?: string;
  status: 'loading' | 'ready';
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
  lines.push('Done — layout is on the file and aligned with your design system.');
  lines.push('');
  const reasoning = reasoningSummaryLinesFromPlan(plan);
  if (reasoning.length) {
    lines.push('Summary (safe, no chain-of-thought):');
    for (const r of reasoning) lines.push(`• ${r}`);
    lines.push('');
  }
  lines.push(`Actions in plan: ${actions.length}`);
  if (archetype) lines.push(`Screen archetype: ${archetype}`);
  if (pipeline) lines.push(`Pipeline: ${pipeline}`);
  if (opts.rootId) lines.push('Frame created on the current page — check the canvas.');
  lines.push('');
  lines.push('Next: refine with the chips below or describe a change in the prompt.');
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
  /** Position in the Generate pipeline (used while loading). */
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
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const [showFrameAttachDialog, setShowFrameAttachDialog] = useState(false);
  const [frameAttachInput, setFrameAttachInput] = useState('');
  const [composerDragActive, setComposerDragActive] = useState(false);
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
  const chatScrollRef = useRef<HTMLDivElement>(null);
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
  const [composerFocused, setComposerFocused] = useState(false);
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
  /** Conversation timeline (Phase 1): one user/assistant pair per relevant Generate action. */
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([]);
  /** Fake typing + first assistant bubble before any timeline message. */
  const [showIntroTyping, setShowIntroTyping] = useState(false);
  const [showIntroBubble, setShowIntroBubble] = useState(false);
  const [dsScopeHash, setDsScopeHash] = useState<string>('');
  const [serverThreadId, setServerThreadId] = useState<string | null>(null);
  const [threadList, setThreadList] = useState<
    Array<{ id: string; title: string | null; updated_at_ms?: number }>
  >([]);
  /** §7.2 — Chat vs dedicated Threads panel (Phase 3). */
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
  /** User typed in the composer while chips were visible — hide chip row, keep history. */
  const [refineChipsHiddenByComposer, setRefineChipsHiddenByComposer] = useState(false);
  /** §6 — per-chip estimates from POST /api/credits/estimate (preview). */
  const [refinementEstimates, setRefinementEstimates] = useState<Record<string, number>>({});
  const [lastDiagLine, setLastDiagLine] = useState<string | null>(null);
  const [liveReasoningLines, setLiveReasoningLines] = useState<string[]>([]);
  const pushLiveReasoning = useCallback((line: string) => {
    const next = String(line || '').trim();
    if (!next) return;
    setLiveReasoningLines((prev) => (prev.includes(next) ? prev : [...prev, next]));
  }, []);
  const pendingPreflightPromptRef = useRef<string | null>(null);
  const skippedPreflightHashRef = useRef<string | null>(null);
  const serverThreadIdRef = useRef<string | null>(null);
  /** When set, `completeGenerateTurn` merges the assistant reply onto this user bubble instead of appending a second user row. */
  const pendingOptimisticUserTurnIdRef = useRef<string | null>(null);
  /** True while `runGeneratePipeline` is in flight (suppresses refinement-chip hide on programmatic prompt fills). */
  const pipelineUiLockRef = useRef(false);
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

  const syncConversationPairToServer = useCallback(
    (u: string, assistantMarkdown: string) => {
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
      refreshThreadList,
    ],
  );

  const beginOptimisticUserTurn = useCallback(
    (body: string) => {
      const t = Date.now();
      const id = `u-${t}`;
      pendingOptimisticUserTurnIdRef.current = id;
      setConversationTurns((prev) => {
        const next: ConversationTurn[] = [
          ...prev,
          { id, role: 'user' as const, body: body.slice(0, 1200), createdAt: t },
        ];
        const trimmed =
          next.length > MAX_CONVERSATION_MESSAGES
            ? next.slice(next.length - MAX_CONVERSATION_MESSAGES)
            : next;
        persistTurnsLocal(trimmed);
        return trimmed;
      });
    },
    [persistTurnsLocal],
  );

  const abortOptimisticUserTurn = useCallback(() => {
    const pid = pendingOptimisticUserTurnIdRef.current;
    pendingOptimisticUserTurnIdRef.current = null;
    if (!pid) return;
    setConversationTurns((prev) => {
      const next = prev.filter((x) => x.id !== pid);
      persistTurnsLocal(next);
      return next;
    });
  }, [persistTurnsLocal]);

  const completeGenerateTurn = useCallback(
    (userPrompt: string, assistantMarkdown: string) => {
      const u = userPrompt.slice(0, 1200);
      const pid = pendingOptimisticUserTurnIdRef.current;
      pendingOptimisticUserTurnIdRef.current = null;
      const t = Date.now();
      setConversationTurns((prev) => {
        let next: ConversationTurn[];
        if (pid) {
          const idx = prev.findIndex((x) => x.id === pid && x.role === 'user');
          if (idx >= 0) {
            next = [...prev];
            next[idx] = { ...next[idx], body: u };
            next.push({ id: `a-${t}`, role: 'assistant' as const, body: assistantMarkdown, createdAt: t });
          } else {
            next = [
              ...prev,
              { id: `u-${t}`, role: 'user' as const, body: u, createdAt: t },
              { id: `a-${t}`, role: 'assistant' as const, body: assistantMarkdown, createdAt: t },
            ];
          }
        } else {
          next = [
            ...prev,
            { id: `u-${t}`, role: 'user' as const, body: u, createdAt: t },
            { id: `a-${t}`, role: 'assistant' as const, body: assistantMarkdown, createdAt: t },
          ];
        }
        const trimmed =
          next.length > MAX_CONVERSATION_MESSAGES
            ? next.slice(next.length - MAX_CONVERSATION_MESSAGES)
            : next;
        persistTurnsLocal(trimmed);
        return trimmed;
      });
      syncConversationPairToServer(u, assistantMarkdown);
    },
    [persistTurnsLocal, syncConversationPairToServer],
  );

  const appendConversationTurns = useCallback(
    (turns: ConversationTurn[]) => {
      if (!turns.length) return;
      setConversationTurns((prev) => {
        const next = [...prev, ...turns];
        const trimmed =
          next.length > MAX_CONVERSATION_MESSAGES
            ? next.slice(next.length - MAX_CONVERSATION_MESSAGES)
            : next;
        persistTurnsLocal(trimmed);
        return trimmed;
      });
    },
    [persistTurnsLocal],
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
      const localListedByKey = hasImportForFileKey(r.fileKey);
      const fileNameNorm = String(r.fileName || '').trim().toLowerCase();
      const localListedByName =
        fileNameNorm.length > 0 &&
        loadDsImports().some((row) => String(row.figmaFileName || '').trim().toLowerCase() === fileNameNorm);
      const localListed = localListedByKey || localListedByName;
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
  }, [usesFileDs, requestFileContext, checkServerHasDsContext, creditsRemaining]);

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

  /** §6 — Per-chip credit estimates for refinement (preview API; final charge from server plan). */
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

  useEffect(() => {
    if (showRefinementChips) setRefineChipsHiddenByComposer(false);
  }, [showRefinementChips]);

  useEffect(() => {
    if (!loading) return;
    if (generateStep === 'context') {
      pushLiveReasoning('I am validating file access and current DS scope...');
      pushLiveReasoning(
        usesFileDs
          ? 'I will anchor generation to the imported Custom (Current) snapshot.'
          : `I will use ${selectedSystem} as style reference.`,
      );
      if (hasSelection) pushLiveReasoning('Selection mode active: I will preserve structure and improve it.');
      if (screenshotAttachment) pushLiveReasoning('Screenshot reference detected: extracting layout intent...');
      return;
    }
    if (generateStep === 'ai') {
      pushLiveReasoning('I am mapping your request to a concrete screen archetype...');
      pushLiveReasoning('I am composing an action plan with constraints, hierarchy, and spacing intent...');
      pushLiveReasoning('I am validating plan consistency before canvas apply...');
      return;
    }
    if (generateStep === 'canvas') {
      pushLiveReasoning('Applying actions on canvas in deterministic order...');
      pushLiveReasoning('Resolving instances/variables and checking unresolved references...');
      return;
    }
    if (generateStep === 'credits') {
      pushLiveReasoning('Final quality check completed, confirming credit consumption...');
    }
  }, [
    loading,
    generateStep,
    usesFileDs,
    selectedSystem,
    hasSelection,
    screenshotAttachment,
    pushLiveReasoning,
  ]);

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
          'Create a desktop login screen with clear hierarchy and primary CTA.',
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
    if (showRefinementChips && text.trim().length > 0 && !pipelineUiLockRef.current) {
      setRefineChipsHiddenByComposer(true);
    }
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

  const clearComposerInput = useCallback(() => {
    if (inputRef.current) inputRef.current.innerText = '';
    setPromptText('');
    setHasContent(false);
    setEnhanceLocked(false);
    setEnhancedGoalSnapshot(null);
    lastEnhancedBodyRef.current = null;
  }, []);

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
    async (finalPrompt: string, opts?: { chipId?: string; clearComposer?: boolean }) => {
      if (!canGenerate) {
        onUnlockRequest();
        return;
      }
      if (usesFileDs && !catalogReady) {
        setGenError('Finish the design system import above before generating.');
        return;
      }
      pipelineUiLockRef.current = true;
      setLoading(true);
      setGenerateStep('context');
      setShowReport(false);
      setGenError(null);
      setCanvasApplyResult(null);
      lastActionPlanRef.current = null;
      setShowRefinementChips(false);
      setLastDiagLine(null);
      setLiveReasoningLines([
        'Understanding your request and preparing generation context...',
        'I will keep this transparent and narrate each step live.',
      ]);

      void fetchGenerationPluginEvent?.({
        event_type: 'generate_chat_turn_started',
        payload: { prompt_len: finalPrompt.trim().length },
      });

      const trimmed = finalPrompt.trim();
      if (!trimmed) {
        abortOptimisticUserTurn();
        pipelineUiLockRef.current = false;
        setLoading(false);
        setGenerateStep('idle');
        return;
      }

      if (opts?.clearComposer) {
        clearComposerInput();
      }

      if (!pendingOptimisticUserTurnIdRef.current) {
        beginOptimisticUserTurn(trimmed);
      }

      const { fileKey, error: ctxError } = await requestFileContext();
      if (ctxError || !fileKey) {
        abortOptimisticUserTurn();
        pipelineUiLockRef.current = false;
        setLoading(false);
        setGenerateStep('idle');
        setLiveReasoningLines([]);
        const opts = getSystemToastOptions('file_link_unavailable');
        setGenError(opts.description ?? opts.title);
        return;
      }

      const mode = hasSelection ? 'modify' : screenshotAttachment ? 'screenshot' : 'create';
      const dsSource = usesFileDs ? 'custom' : selectedSystem;

      setGenerateStep('ai');
      pushLiveReasoning('Generating action plan with DS constraints...');
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
          completeGenerateTurn(
            trimmed,
            'Error: invalid server response (missing or malformed action plan).',
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
          setLastDiagLine(`Last server round-trip ~${Math.round(totalMs / 1000)}s`);
        }

        lastActionPlanRef.current = actionPlan;
        const isModify = mode === 'modify';
        lastApplyWasModifyRef.current = isModify;
        setRes(JSON.stringify(actionPlan, null, 2));
        setLastRequestId(data?.request_id ?? null);
        setLastVariant(data?.variant ?? null);
        setFeedbackSent(false);

        setGenerateStep('canvas');
        pushLiveReasoning('Applying layout to canvas...');
        const canvasResult = await runCanvasApply(actionPlan, {
          modifyMode: isModify,
          serverRequestId: data?.request_id ?? null,
          figmaFileKey: fileKey,
          qualityWatch: Boolean(data?.request_id),
        });
        if (!canvasResult.ok) {
          completeGenerateTurn(
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
        pushLiveReasoning('Finalizing credits and wrapping up...');
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
          completeGenerateTurn(
            trimmed,
            `Credits: ${consumed.error}\n\nThe frame was already created on the canvas; check your balance and try again.`,
          );
          setGenError(consumed.error);
          setLoading(false);
          setGenerateStep('idle');
          return;
        }
        completeGenerateTurn(
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
        completeGenerateTurn(trimmed, `Error: ${humanizeCanvasError(msg)}`);
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
        pipelineUiLockRef.current = false;
        setLoading(false);
        setGenerateStep('idle');
        setLiveReasoningLines([]);
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
      completeGenerateTurn,
      consumeCredits,
      fetchGenerationPluginEvent,
      humanizeCanvasError,
      abortOptimisticUserTurn,
      beginOptimisticUserTurn,
      clearComposerInput,
      pushLiveReasoning,
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
        ? `${raw.trim()}\n\n[Clarification constraints]\n${labels.map((l) => `- ${l}`).join('\n')}`
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
    clearComposerInput();

    const userTurn: ConversationTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      body: rawText.slice(0, 1200),
      createdAt: Date.now(),
    };
    const cls = classifyIntent(rawText);
    const response = getResponse(cls, rawText);
    const actionWithCredits = (action: string): string => {
      if (action === 'Generate now' || action === 'Apply change') {
        return `${action} (~${creditEstimate} cr)`;
      }
      return action;
    };
    const pauseAssistantBriefly = async () => {
      setLoading(true);
      setGenerateStep('context');
      const delayMs = 450 + Math.floor(Math.random() * 451); // 450..900
      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), delayMs);
      });
      setLoading(false);
      setGenerateStep('idle');
    };

    if (!response.callKimi) {
      appendConversationTurns([userTurn]);
      await pauseAssistantBriefly();
      const assistantTurns = response.bubbles.map((b, i) => ({
        id: `a-${Date.now()}-${i}`,
        role: 'assistant' as const,
        body: b.slice(0, 1200),
        createdAt: Date.now() + i,
        actions:
          i === response.bubbles.length - 1 ? response.actions.map((a) => actionWithCredits(a)) : undefined,
        actionIntent: i === response.bubbles.length - 1 ? cls.intent : undefined,
        actionPrompt: i === response.bubbles.length - 1 ? rawText : undefined,
      }));
      appendConversationTurns(assistantTurns);
      return;
    }

    if (cls.intent === 'GENERATE_CLEAR' || cls.intent === 'EDIT') {
      appendConversationTurns([userTurn]);
      await pauseAssistantBriefly();
      const assistantTurns = response.bubbles.map((b, i) => ({
        id: `a-${Date.now()}-${i}`,
        role: 'assistant' as const,
        body: b.slice(0, 1200),
        createdAt: Date.now() + i,
        actions:
          i === response.bubbles.length - 1 ? response.actions.map((a) => actionWithCredits(a)) : undefined,
        actionIntent: i === response.bubbles.length - 1 ? cls.intent : undefined,
        actionPrompt: i === response.bubbles.length - 1 ? rawText : undefined,
      }));
      appendConversationTurns(assistantTurns);
      return;
    }

    let hints:
      | {
          legacy_screen_key?: string | null;
          pack_v2_archetype_id?: string | null;
          preflight: { title?: string; chips: Array<{ id: string; label: string }>; source: string } | null;
        }
      | null = null;
    if (fetchConversationHints) {
      try {
        hints = await fetchConversationHints(rawText);
      } catch {
        hints = null;
      }
    }

    const ev = evaluatePreflightClarifier(rawText);
    const gate = promptGateKey(rawText);
    if (ev.show && skippedPreflightHashRef.current !== gate) {
      pendingPreflightPromptRef.current = rawText;
      setPreflightPromptSnapshot(rawText);
      setPreflightPick({});
      setPreflightRemote(hints?.preflight ?? null);
      setShowPreflight(true);
      void fetchGenerationPluginEvent?.({
        event_type: 'generate_preflight_opened',
        payload: { variant: ev.variant },
      });
      return;
    }

    await runGeneratePipeline(rawText, { clearComposer: true });
  };

  const handleNewConversation = useCallback(() => {
    setConversationTurns([]);
    setServerThreadId(null);
    serverThreadIdRef.current = null;
    pendingOptimisticUserTurnIdRef.current = null;
    setShowIntroTyping(false);
    setShowIntroBubble(false);
    setShowRefinementChips(false);
    setRefineChipsHiddenByComposer(false);
    setShowPreflight(false);
    setPreflightRemote(null);
    skippedPreflightHashRef.current = null;
    if (userId && genFileKey && dsScopeHash) {
      safeLocalStorageRemoveItem(localConversationStorageKey(userId, genFileKey, dsScopeHash));
      safeLocalStorageRemoveItem(activeThreadStorageKey(userId, genFileKey, dsScopeHash));
    }
    void fetchGenerationPluginEvent?.({ event_type: 'generate_thread_new', payload: {} });
  }, [userId, genFileKey, dsScopeHash, fetchGenerationPluginEvent]);

  const handleIntentAction = useCallback(
    (action: string, intent?: IntentId, prompt?: string) => {
      const basePrompt = String(prompt || '').trim();
      if (!basePrompt && action !== 'Start over') return;
      if (action.startsWith('Generate now') || action.startsWith('Apply change')) {
        void runGeneratePipeline(basePrompt, { clearComposer: false });
        return;
      }
      if (action === 'Show examples') {
        const eg = contextSuggestions[0] || 'Create a mobile login screen with social sign-in and primary CTA.';
        setPromptFromSuggestion(eg);
        return;
      }
      if (action === 'Start over') {
        handleNewConversation();
        return;
      }
      if (action === 'Show components' || action === 'Show tokens') {
        const text =
          intent === 'QUESTION_DS' && action === 'Show components'
            ? 'Open the Design System selector above to inspect available component families in this file.'
            : 'Open the Design System selector above to inspect tokens and active DS scope.';
        appendConversationTurns([
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            body: text,
            createdAt: Date.now(),
          },
        ]);
      }
    },
    [appendConversationTurns, contextSuggestions, handleNewConversation, runGeneratePipeline],
  );

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
        setGenError('Could not load this conversation.');
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
      beginOptimisticUserTurn(chip.label);
      const base = getPlainTerminalText(inputRef.current);
      const next = `${base}${chip.append}`.trim();
      inputRef.current.innerText = next;
      setPromptText(next);
      setHasContent(true);
      await runGeneratePipeline(next, { chipId: chip.id });
    },
    [loading, runGeneratePipeline, fetchGenerationPluginEvent, beginOptimisticUserTurn],
  );

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
    if (inputRef.current) {
      inputRef.current.innerText = txt;
    }
    setPromptText(txt);
    setHasContent(true);
    void handleGen();
  };

  const handleUploadClick = () => {
    screenshotFileInputRef.current?.click();
  };

  const ingestScreenshotFile = useCallback((file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const maxBytes = 6 * 1024 * 1024;
    if (file.size > maxBytes) {
      setGenError('Image too large (max 6MB).');
      return;
    }
    const id = `att-${Date.now()}`;
    const objectUrl = URL.createObjectURL(file);
    setComposerAttachments((prev) => [
      ...prev,
      { id, type: 'image', name: file.name, previewUrl: objectUrl, status: 'loading' },
    ]);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      setScreenshotAttachment({ name: file.name, dataUrl });
      setComposerAttachments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, previewUrl: dataUrl, status: 'ready' } : a)),
      );
      setGenError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleScreenshotFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    ingestScreenshotFile(file);
  };

  const handleDeleteUpload = () => {
    setScreenshotAttachment(null);
    setComposerAttachments((prev) => prev.filter((a) => a.type !== 'image'));
  };

  const finalizeFrameAttachment = useCallback((raw: string) => {
    const url = String(raw || '').trim();
    if (!/^https?:\/\/(www\.)?figma\.com\/.+/i.test(url)) {
      setGenError('Paste a valid public Figma frame URL.');
      return;
    }
    const id = `att-${Date.now()}`;
    const label = (() => {
      try {
        const u = new URL(url);
        return u.pathname.split('/').filter(Boolean).pop() || 'Figma frame';
      } catch {
        return 'Figma frame';
      }
    })();
    setComposerAttachments((prev) => [...prev, { id, type: 'frame', name: label, sourceUrl: url, status: 'loading' }]);
    setShowFrameAttachDialog(false);
    setFrameAttachInput('');
    window.setTimeout(() => {
      setComposerAttachments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'ready' } : a)),
      );
    }, 550);
  }, []);

  const handleComposerDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setComposerDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) {
        ingestScreenshotFile(file);
      }
    },
    [ingestScreenshotFile],
  );

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

  /** Threads API still needs file + scope hash; tabs stay visible whenever API is wired. */
  const threadScopeReady = !!(userId && generateConversationApi && genFileKey && dsScopeHash);
  const showComposerThreadTabs = !!(userId && generateConversationApi);
  /** Chat UI vs threads list — follow the active tab (threads shows a stub until scope is ready). */
  const showChatComposerShell = generateComposerTab === 'chat';

  useEffect(() => {
    if (!showGenerateComposer || showReport || conversationTurns.length > 0 || !showChatComposerShell) return;
    setShowIntroTyping(true);
    const t = setTimeout(() => {
      setShowIntroTyping(false);
      setShowIntroBubble(true);
    }, 900);
    return () => clearTimeout(t);
  }, [showGenerateComposer, showReport, conversationTurns.length, showChatComposerShell]);

  /** Keep latest bubbles at the bottom of the fixed-height chat panel (scroll only when content overflows). */
  useLayoutEffect(() => {
    const root = chatScrollRef.current;
    if (!root) return;
    root.scrollTop = root.scrollHeight;
  }, [
    conversationTurns,
    loading,
    generateStep,
    showIntroTyping,
    showIntroBubble,
    showPreflight,
    showRefinementChips,
    refineChipsHiddenByComposer,
  ]);

  /** Solo mentre aspettiamo contesto/modello — non durante canvas/crediti (altrimenti puntini “fantasma” col messaggio già pronto). */
  const showAssistantThinkingDots =
    loading &&
    conversationTurns.length > 0 &&
    conversationTurns[conversationTurns.length - 1]?.role === 'user' &&
    (generateStep === 'context' || generateStep === 'ai');

  const showLiveReasoning = loading && liveReasoningLines.length > 0;

  return (
    <div
      data-component="Generate: View Container"
      className="relative flex min-h-0 flex-1 flex-col gap-2 p-3 pb-28 sm:gap-2 sm:p-4"
    >
      <div data-component="Generate: Global header" className={`${FULL_BLEED_OUT} shrink-0`}>
        <div className={`${FULL_BLEED_IN} pb-1 pt-0`}>
          <div className="mb-2 grid min-h-9 grid-cols-[1fr_auto_1fr] items-center gap-x-2">
            <span className="min-w-0" aria-hidden />
            <div
              data-component="Generate: Credit Banner"
              className={`justify-self-center transform -rotate-2 border-2 border-black px-3 py-1 text-[10px] font-black uppercase shadow-[3px_3px_0_0_#000] ${knownZeroCredits ? 'bg-red-100 text-red-600' : 'bg-[#ffc900] text-black'}`}
            >
              Credits: {creditsDisplay}
            </div>
            <div className="flex min-w-0 justify-end">
              <button
                type="button"
                onClick={() => setShowReadFirstModal(true)}
                className="shrink-0 text-right text-[10px] font-black uppercase tracking-wide text-gray-600 underline decoration-black/25 underline-offset-2 hover:text-black"
              >
                Privacy & Data
              </button>
            </div>
          </div>
        </div>
        <div className="h-[2px] w-full shrink-0 bg-black" aria-hidden />
      </div>

      {/* Error from generation or file context */}
      {genError && (
        <div className="w-full border-2 border-black bg-red-50 p-3 text-[10px] font-bold text-red-900 shadow-[3px_3px_0_0_#000] flex justify-between items-start gap-2">
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
        <div className={`${FULL_BLEED_OUT} shrink-0 flex flex-col`}>
          <div className={`${FULL_BLEED_IN} bg-white`}>
            <BrutalDropdown
              open={isSystemOpen}
              onOpenChange={setIsSystemOpen}
              maxHeightClassName=""
              panelClassName="!overflow-visible flex flex-col p-0"
              trigger={
                <button
                  type="button"
                  data-component="Generate: DS Selector"
                  onClick={() => setIsSystemOpen(!isSystemOpen)}
                  className="flex h-10 w-full cursor-pointer items-center justify-between bg-white px-3 text-left text-xs font-black uppercase"
                >
                  <span className="flex h-full min-w-0 items-center truncate leading-none">
                    <span className="text-gray-500">Design system</span> · {selectedSystem}
                  </span>
                  <span className="flex h-full items-center leading-none" aria-hidden>
                    {isSystemOpen ? '▲' : '▼'}
                  </span>
                </button>
              }
            >
              <div className="space-y-2 border-t border-black/10 p-2">
                <input
                  type="text"
                  placeholder="Search System..."
                  autoFocus
                  value={systemSearch}
                  onChange={(e) => setSystemSearch(e.target.value)}
                  className="w-full p-2 text-xs border-2 border-black outline-none font-mono bg-yellow-50"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="border-2 border-black bg-white">
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
          <div className="h-[2px] w-full shrink-0 bg-black" aria-hidden />
          {showComposerThreadTabs ? (
            <>
              <div
                className="flex w-full border-b-2 border-black bg-white"
                data-component="Generate: Chat / Threads tabs"
              >
                <button
                  type="button"
                  className={`min-h-10 flex-1 basis-0 border-r-2 border-black py-1.5 text-[10px] font-black uppercase ${
                    generateComposerTab === 'chat' ? 'bg-[#ffc900]' : 'bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => setGenerateComposerTab('chat')}
                >
                  Chat
                </button>
                <button
                  type="button"
                  className={`min-h-10 flex-1 basis-0 py-1.5 text-[10px] font-black uppercase ${
                    generateComposerTab === 'threads' ? 'bg-[#ffc900]' : 'bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => setGenerateComposerTab('threads')}
                >
                  Threads
                </button>
              </div>
              <div className="h-[2px] w-full shrink-0 bg-black" aria-hidden />
            </>
          ) : null}
        </div>
      )}

      {showGenerateComposer && !showReport ? (
        <div data-component="Generate: Conversational column" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {showChatComposerShell ? (
            <>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div
                  ref={chatScrollRef}
                  data-component="Generate: Chat scroll"
                  className="generate-chat-scroll flex min-h-0 flex-1 flex-col overflow-y-auto"
                >
                  <div className="flex h-full min-h-full flex-1 flex-col pb-2">
                    <div className="flex-1" aria-hidden />
                    <div className="flex w-full flex-col gap-2 px-1 pb-2 pt-1">
                    {showPreflight ? (
                      <div data-component="Generate: Preflight clarifier" className="shrink-0 space-y-2 px-1 pb-2 pt-2">
                        <p className="text-[10px] font-black uppercase">
                          {preflightRemote?.title || 'Light clarifications (optional)'}
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
                            Continue without
                          </Button>
                          <Button variant="primary" className="text-[10px]" type="button" onClick={() => void handlePreflightConfirm()}>
                            Generate
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    {showIntroTyping && conversationTurns.length === 0 && !showIntroBubble ? (
                      <div className="flex justify-start">
                        <div className="border-2 border-black bg-white px-2 py-1.5 text-[10px] font-black leading-none">
                          <span className="inline-flex items-center gap-0.5" aria-label="Assistant is typing">
                            <span className="animate-bounce">·</span>
                            <span className="animate-bounce delay-100">·</span>
                            <span className="animate-bounce delay-200">·</span>
                          </span>
                        </div>
                      </div>
                    ) : null}
                    {showIntroBubble && conversationTurns.length === 0 ? (
                      <div className="flex justify-start">
                        <div className="max-w-[95%] border-2 border-black bg-white px-2 py-1.5 text-[10px] leading-snug">
                          Hi — I am here to generate on the frame using your design system. Below you have three quick starters, or
                          type what you need: I reason step by step as we go.
                        </div>
                      </div>
                    ) : null}
                    {conversationTurns.map((turn) => (
                      <div key={turn.id} className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-[95%]">
                          <div
                            className={`border-2 border-black px-2 py-1.5 text-[10px] whitespace-pre-wrap leading-snug ${
                              turn.role === 'user' ? 'bg-[#ffc900]/90 font-mono' : 'bg-white'
                            }`}
                          >
                            {turn.body}
                          </div>
                          {turn.role === 'assistant' && turn.actions && turn.actions.length > 0 ? (
                            <div className="mt-1.5 flex flex-wrap gap-1.5 pl-2">
                              {turn.actions.map((action) => {
                                const m = action.match(/^(.*)\s+\(~\s*(\d+)\s*cr\)$/i);
                                const baseAction = m ? m[1].trim() : action;
                                const cost = m ? m[2] : null;
                                const isConfirm = /^Generate now|^Apply change/i.test(baseAction);
                                return (
                                  <button
                                    key={`${turn.id}-${action}`}
                                    type="button"
                                    onClick={() => handleIntentAction(action, turn.actionIntent, turn.actionPrompt)}
                                    className={`inline-flex min-h-9 items-center gap-1.5 border-2 border-black px-3 py-1 text-[10px] font-black ${
                                      isConfirm
                                        ? 'relative bg-[#ffc900] pr-12 text-black shadow-[2px_2px_0_0_#000] hover:bg-yellow-300'
                                        : 'bg-white hover:bg-[#ffc900]'
                                    }`}
                                  >
                                    <span>{baseAction}</span>
                                    {cost ? (
                                      isConfirm ? (
                                        <span className="absolute right-1 top-1/2 -translate-y-1/2 border border-black bg-black px-1 py-0 leading-none text-[8px] text-[#ffc900]">
                                          {cost}CR
                                        </span>
                                      ) : (
                                        <span className="border border-black bg-white px-1 py-0 leading-none text-[8px]">
                                          {cost}CR
                                        </span>
                                      )
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {showAssistantThinkingDots ? (
                      <div className="flex justify-start" aria-live="polite" aria-busy="true">
                        <div className="border-2 border-black bg-white px-2 py-1.5 text-[10px] font-black leading-none">
                          <span className="inline-flex items-center gap-0.5" aria-label="Assistant is thinking">
                            <span className="animate-bounce">·</span>
                            <span className="animate-bounce delay-100">·</span>
                            <span className="animate-bounce delay-200">·</span>
                          </span>
                        </div>
                      </div>
                    ) : null}
                    {showLiveReasoning ? (
                      <div className="flex justify-start" aria-live="polite">
                        <div className="max-w-[95%] border-2 border-black bg-white px-2 py-1.5 text-[10px] leading-snug">
                          <p className="mb-1 font-black uppercase">Live reasoning</p>
                          <div className="space-y-0.5">
                            {liveReasoningLines.map((line, idx) => (
                              <p key={`lr-${idx}`}>- {line}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {showRefinementChips && !refineChipsHiddenByComposer ? (
                      <div data-component="Generate: Refinement chips" className="pt-1">
                        <div className="flex flex-wrap gap-1.5">
                          {REFINEMENT_CHIPS.map((chip) => (
                            <button
                              key={chip.id}
                              type="button"
                              disabled={loading || dsGateBlocked}
                              onClick={() => void applyRefinementChip(chip)}
                              title={`Estimate: ${refinementEstimates[chip.id] ?? tierCreditHint(chip.tier)} credits (preview)`}
                              className="text-[9px] border-2 border-black px-2 py-1 bg-gray-50 hover:bg-[#ffc900] disabled:opacity-40 font-bold"
                            >
                              {chip.label} (~{refinementEstimates[chip.id] ?? tierCreditHint(chip.tier)} cr)
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {conversationTurns.length === 0 ? (
                      <div className="-mx-1 border-t-2 border-black bg-white px-1 py-2">
                        <p className="mb-1.5 px-1 text-[9px] font-black uppercase text-gray-500">Quick starters</p>
                        <div className="flex flex-col gap-1.5">
                          {contextSuggestions.map((txt, i) => (
                            <button
                              key={`starter-empty-${i}`}
                              type="button"
                              onClick={() => handleInsertInspiration(txt)}
                              disabled={!canGenerate || dsGateBlocked || loading}
                              className={`w-full border-2 border-black bg-white px-2 py-1.5 text-left text-[9px] font-bold leading-snug ${canGenerate && !dsGateBlocked && !loading ? 'hover:bg-[#ffc900]' : 'opacity-50'}`}
                            >
                              {txt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div
                data-component="Generate: Composer dock"
                className="fixed inset-x-0 z-[56] border-t-2 border-black bg-[#f7f7f7] px-0 py-0"
                style={{ bottom: 'calc(3.5rem + 5px)' }}
              >
                <input
                  ref={screenshotFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  aria-hidden
                  onChange={handleScreenshotFileChange}
                />
                <div
                  className={`relative w-full bg-[#f7f7f7] ${dsGateBlocked ? 'opacity-50 pointer-events-none' : ''} ${
                    composerDragActive ? 'ring-2 ring-[#4b6bff] ring-inset bg-[#eef2ff]' : ''
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setComposerDragActive(true);
                  }}
                  onDragLeave={() => setComposerDragActive(false)}
                  onDrop={handleComposerDrop}
                >
                  {composerAttachments.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2 px-3 pt-2">
                      {composerAttachments.map((att) => (
                        <div key={att.id} className="relative">
                          {att.type === 'image' && att.previewUrl ? (
                            <img
                              src={att.previewUrl}
                              alt={att.name}
                              className="h-12 w-12 rounded-md border-2 border-black object-cover"
                            />
                          ) : (
                            <div className="flex h-12 min-w-[7rem] items-center border-2 border-black bg-white px-2 text-[9px] font-bold">
                              {att.name}
                            </div>
                          )}
                          {att.status === 'loading' ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/75 text-[9px] font-black">
                              <span className="inline-flex items-center gap-0.5">
                                <span className="animate-bounce">·</span>
                                <span className="animate-bounce delay-100">·</span>
                                <span className="animate-bounce delay-200">·</span>
                              </span>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div
                    ref={inputRef}
                    contentEditable
                    onPaste={handlePaste}
                    onInput={checkContent}
                    onFocus={() => setComposerFocused(true)}
                    onBlur={() => setComposerFocused(false)}
                    onKeyDown={handlePromptKeyDown}
                    onClick={handleContentClick}
                    data-component="Generate: Rich Input"
                    className={`max-h-[160px] min-h-[5.25rem] cursor-text overflow-y-auto px-3 pb-14 ${
                      composerAttachments.length > 0 ? 'pt-1.5' : 'pt-2.5'
                    } text-sm font-mono leading-snug outline-none ${
                      composerFocused ? 'bg-[#ece7cf]' : 'bg-[#f7f7f7]'
                    }`}
                    style={{ whiteSpace: 'pre-wrap' }}
                    data-placeholder={promptPlaceholder}
                  />
                  <div
                    className={`absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 px-2 py-1.5 ${
                      composerFocused ? 'bg-[#ece7cf]' : 'bg-neutral-50'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                      <details className="group relative shrink-0">
                        <summary className="flex size-9 cursor-pointer list-none items-center justify-center border-2 border-black bg-white font-black leading-none hover:bg-[#ffc900] [&::-webkit-details-marker]:hidden">
                          +
                        </summary>
                        <div className="absolute bottom-full left-0 z-[60] mb-1 min-w-[10rem] border-2 border-black bg-white py-1 shadow-[3px_3px_0_0_#000]">
                          <button
                            type="button"
                            className="block w-full px-2 py-1.5 text-left text-[9px] font-black uppercase hover:bg-[#ffc900]"
                            onClick={(e) => {
                              (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
                              handleUploadClick();
                            }}
                          >
                            Add image
                          </button>
                          <button
                            type="button"
                            className="block w-full px-2 py-1.5 text-left text-[9px] font-black uppercase hover:bg-[#ffc900]"
                            onClick={(e) => {
                              (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
                              setShowFrameAttachDialog(true);
                            }}
                          >
                            Add frame
                          </button>
                        </div>
                      </details>
                      <button
                        type="button"
                        onClick={handleEnhancePrompt}
                        disabled={!hasContent || loading || enhancePlusBusy || enhanceLocked || dsGateBlocked}
                        className={`inline-flex h-9 min-w-9 shrink-0 items-center justify-center border-2 border-black bg-white px-2 text-[9px] font-black uppercase ${!hasContent || loading || enhancePlusBusy || enhanceLocked ? 'cursor-not-allowed opacity-40' : 'hover:bg-[#ffc900]'}`}
                      >
                        Enhance
                      </button>
                      {fetchEnhancePlus ? (
                        <button
                          type="button"
                          onClick={() => void handleEnhancePlusPrompt()}
                          disabled={!hasContent || loading || enhancePlusBusy || dsGateBlocked}
                          className={`inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-1 border-2 border-black bg-white px-2 text-[9px] font-black uppercase ${!hasContent || loading || enhancePlusBusy ? 'cursor-not-allowed opacity-40' : 'hover:bg-[#ffc900]'}`}
                        >
                          {enhancePlusBusy ? (
                            '…'
                          ) : (
                            <>
                              <span>Enhance Plus</span>
                              {plan !== 'PRO' ? (
                                <span className="border border-black bg-[#ffc900] px-1 py-0 leading-none text-[8px]">
                                  {enhancePlusCost}CR
                                </span>
                              ) : null}
                            </>
                          )}
                        </button>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleGen}
                      disabled={!hasContent || loading || (!canGenerate && !isPro) || dsGateBlocked}
                      className="flex size-9 shrink-0 items-center justify-center rounded-none bg-white p-0 shadow-[2px_2px_0_0_#000]"
                      aria-label={`Send (~${creditEstimate} credits)`}
                      title={`Estimated cost: ~${creditEstimate} credits`}
                    >
                      ➤
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : threadScopeReady ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1 pt-2 pb-40">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2">
                <p className="text-[10px] font-black uppercase">Threads</p>
                <Button variant="secondary" type="button" className="text-[9px] uppercase" onClick={() => void handleNewConversation()}>
                  New chat
                </Button>
              </div>
              <div className="custom-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto">
                {threadList.length === 0 ? (
                  <p className="text-[10px] text-gray-800">No threads yet. Send a message in Chat to start one.</p>
                ) : (
                  threadList.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => void handleSelectThread(t.id)}
                      className={`w-full border-2 border-black px-2 py-2 text-left text-[10px] font-bold shadow-[2px_2px_0_0_#000] hover:bg-[#ffc900] ${
                        serverThreadId === t.id ? 'bg-[#ffc900]/50' : 'bg-white'
                      }`}
                    >
                      {t.title || 'Untitled conversation'}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="border-2 border-black bg-neutral-50 p-3 text-[10px] font-black uppercase leading-snug shadow-[3px_3px_0_0_#000]">
              Finish design system import for this file to load saved threads.
            </div>
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
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/40" onClick={() => setShowFeedbackModal(false)}>
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
        <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/40" onClick={() => setShowReadFirstModal(false)}>
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
          className="fixed inset-0 z-[330] flex items-center justify-center bg-black/45 p-4"
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
          className="fixed inset-0 z-[320] flex items-center justify-center bg-black/40 p-4"
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
      {showFrameAttachDialog ? (
        <div
          className="fixed inset-0 z-[340] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setShowFrameAttachDialog(false)}
        >
          <div
            className={`${BRUTAL.card} w-full max-w-md bg-white p-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-black">Attach a frame</h3>
            <p className="mt-2 text-xs text-gray-600">
              Paste a public Figma frame URL, or paste copied frame content/link.
            </p>
            <input
              autoFocus
              value={frameAttachInput}
              onChange={(e) => setFrameAttachInput(e.target.value)}
              onPaste={(e) => {
                const t = e.clipboardData.getData('text/plain');
                if (t && /figma\.com/i.test(t)) {
                  e.preventDefault();
                  finalizeFrameAttachment(t);
                }
              }}
              placeholder="Link to a Figma frame"
              className="mt-3 w-full border-2 border-black px-2 py-2 text-xs"
            />
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" className="flex-1 text-xs" onClick={() => setShowFrameAttachDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1 text-xs"
                onClick={() => finalizeFrameAttachment(frameAttachInput)}
              >
                Attach
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
