
import React, { useState, useRef, useEffect, useCallback, startTransition } from 'react';
import { BRUTAL } from '../constants';
import { Button } from '../components/ui/Button';
import { SectionCard } from '../components/ui/SectionCard';
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
  /** Telemetria / learning loop (DI v2): eventi post-generazione lato plugin. */
  fetchGenerationPluginEvent?: (body: {
    event_type: string;
    request_id?: string | null;
    figma_file_key?: string;
    payload?: Record<string, unknown>;
  }) => Promise<void>;
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
  fetchGenerationPluginEvent,
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

  const runCanvasApply = useCallback(
    async (actionPlan: object, opts?: { modifyMode?: boolean }) => {
      const r = await applyActionPlanToCanvas(actionPlan, opts);
      setCanvasApplyResult(r.ok ? { ok: true } : { ok: false, error: r.error });
      return r;
    },
    [applyActionPlanToCanvas]
  );

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

  const isPro = plan === 'PRO';
  const infiniteForTest = !!useInfiniteCreditsForTest;
  const remaining = infiniteForTest || isPro ? Infinity : (creditsRemaining === null ? Infinity : creditsRemaining);
  const canGenerate = isPro || remaining > 0;
  const usesFileDs = selectedSystem === availableSystems[0];
  const dsGateBlocked = usesFileDs && (!catalogReady || dsImportBusy);
  /** Custom (Current): hide the full composer until the step-by-step DS import is done. */
  const showGenerateComposer = !usesFileDs || catalogReady;

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
      if (!loading && hasContent && !dsGateBlocked) handleGen();
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

  const handleGen = async () => {
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

    const rawText = inputRef.current?.innerText?.trim() || '';
    if (!rawText) {
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
        prompt: rawText,
        mode,
        ds_source: dsSource,
        screenshot_base64:
          !hasSelection && screenshotAttachment ? screenshotAttachment.dataUrl : null,
      });
      const actionPlan = data?.action_plan;
      if (!actionPlan || typeof actionPlan !== 'object') {
        setGenError('Invalid response from server.');
        setLoading(false);
        setGenerateStep('idle');
        return;
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
      const consumed = await consumeCredits({
        action_type: mode === 'modify' ? 'wireframe_modified' : 'generate',
        credits_consumed: creditsToConsume,
        file_id: fileKey,
      });
      if (consumed?.error) {
        setGenError(consumed.error);
        setLoading(false);
        setGenerateStep('idle');
        return;
      }
      setShowReport(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGenError(humanizeCanvasError(msg));
    } finally {
      setLoading(false);
      setGenerateStep('idle');
    }
  };

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

  return (
    <div data-component="Generate: View Container" className="p-4 flex flex-col gap-4 pb-28 min-h-full relative">
      
      {/* Credit Banner */}
      <div className="flex justify-center mb-2">
          <div data-component="Generate: Credit Banner" className={`transform -rotate-2 border-2 border-black px-3 py-1 text-[10px] font-black uppercase shadow-[3px_3px_0_0_#000] ${knownZeroCredits ? 'bg-red-100 text-red-600' : 'bg-[#ffc900] text-black'}`}>
            Credits: {creditsDisplay}
          </div>
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
        />
      )}

      {usesFileDs && catalogReady && !showReport && (
        <div data-component="Generate: DS Re-import" className="flex justify-end -mt-1">
          <button
            type="button"
            onClick={handleInvalidateCatalog}
            className="text-[10px] font-black uppercase underline text-gray-600 hover:text-[#ff90e8]"
          >
            Re-import design system (new server snapshot)
          </button>
        </div>
      )}

      {showGenerateComposer && !showReport && (
        <>
          <div className="flex justify-end -mt-1">
            <button
              type="button"
              onClick={() => setShowReadFirstModal(true)}
              className="text-[10px] font-black uppercase underline hover:text-[#ff90e8]"
            >
              Read First
            </button>
          </div>

          {/* Context Layer + Design System: stessa tipologia (`SectionCard`), header opzionale a destra */}
          <SectionCard
            dataComponent="Generate: Context Card"
            title="Context Layer"
            titleDataComponent="Generate: Context Label"
            headerRight={hasSelection ? selectedNode?.type : 'No selection'}
            className="z-[5]"
          >
            {hasSelection ? (
              <>
                <span data-component="Generate: Selection Value" className="font-mono text-xs text-blue-600 bg-blue-50 p-1 border border-blue-200 block truncate">
                  Target: {selectedLayerName}
                </span>
                <span className="text-[10px] text-gray-500">
                  Selection from canvas is active. Screenshot context is disabled until you deselect in Figma.
                </span>
              </>
            ) : screenshotAttachment ? (
              <div data-component="Generate: Uploaded File" className="flex justify-between items-center bg-gray-100 p-2 border border-black">
                <span className="text-[10px] font-bold truncate">📄 {screenshotAttachment.name}</span>
                <button type="button" onClick={handleDeleteUpload} className="text-red-500 font-bold hover:text-red-700 px-1">✕</button>
              </div>
            ) : (
              <>
                <span data-component="Generate: Selection Empty" className="text-[10px] text-gray-500 italic">
                  No layer selected. Upload a screenshot if you want to start from an existing product reference.
                </span>
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
                  className="w-full border-2 border-black border-dashed py-2 text-[10px] font-bold uppercase hover:bg-gray-50 text-gray-500"
                >
                  Upload Image
                </button>
              </>
            )}
          </SectionCard>

          <SectionCard
            dataComponent="Generate: DS Card"
            title="Design System"
            headerRight={dsCardHeaderRight}
            className="z-[4]"
          >
            <div className="flex flex-col gap-2.5">
              <div className="border-2 border-black bg-white shadow-[4px_4px_0_0_#000] overflow-hidden">
                <BrutalDropdown
                  open={isSystemOpen}
                  onOpenChange={setIsSystemOpen}
                  maxHeightClassName="max-h-[240px]"
                  panelClassName="!overflow-hidden flex flex-col p-0"
                  trigger={
                    <button
                      type="button"
                      data-component="Generate: DS Selector"
                      onClick={() => setIsSystemOpen(!isSystemOpen)}
                      className="w-full border-b-2 border-black p-2 flex justify-between items-center cursor-pointer hover:bg-gray-50 text-xs font-bold bg-white text-left"
                    >
                      <span className="truncate min-w-0">{selectedSystem}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {selectedSystem !== availableSystems[0] && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); setSelectedSystem(availableSystems[0]); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setSelectedSystem(availableSystems[0]); } }}
                            className="hover:bg-red-100 text-red-600 px-1.5 rounded-full font-black text-xs"
                          >
                            ✕
                          </span>
                        )}
                        <span aria-hidden>{isSystemOpen ? '▲' : '▼'}</span>
                      </div>
                    </button>
                  }
                >
                  <input
                    type="text"
                    placeholder="Search System..."
                    autoFocus
                    value={systemSearch}
                    onChange={(e) => setSystemSearch(e.target.value)}
                    className="w-full p-2 text-xs border-b border-black outline-none font-mono bg-yellow-50 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="overflow-y-auto flex-1 min-h-0 custom-scrollbar">
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
                    {filteredSystems.length === 0 && (
                      <div className="p-2 text-[10px] text-gray-500 italic">No system found</div>
                    )}
                  </div>
                </BrutalDropdown>
              </div>
              <div
                data-component="Generate: DS Connection Status"
                className={`border-2 border-black px-2.5 py-2 text-[10px] leading-snug font-bold shadow-[3px_3px_0_0_#000] ${dsConnectionTone}`}
              >
                {dsConnectionText}
              </div>
            </div>
          </SectionCard>
        </>
      )}

      {showGenerateComposer && !showReport ? (
        <>
            <div className="flex flex-col gap-0 relative z-[1]">
                <div data-component="Generate: Terminal Header" className="bg-black text-white p-2 text-xs font-bold uppercase flex justify-between items-center border-2 border-black border-b-0">
                  <span>AI Terminal</span>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    <button
                      type="button"
                      onClick={handleEnhancePrompt}
                      disabled={!hasContent || loading || enhancePlusBusy || enhanceLocked || dsGateBlocked}
                      title={
                        enhanceLocked
                          ? 'Edit the terminal text to unlock Enhance again.'
                          : 'Free: structured template (no AI).'
                      }
                      className={`text-[9px] border border-white/50 px-2 py-0.5 uppercase ${!hasContent || loading || enhancePlusBusy || enhanceLocked ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white hover:text-black'}`}
                    >
                      Enhance
                    </button>
                    {fetchEnhancePlus ? (
                      <button
                        type="button"
                        onClick={() => void handleEnhancePlusPrompt()}
                        disabled={!hasContent || loading || enhancePlusBusy || dsGateBlocked}
                        title={
                          plan === 'PRO'
                            ? 'Kimi: richer prompt (no credit charge on PRO).'
                            : `Uses Kimi — ${enhancePlusCost} credit(s). Charged only after a successful response.`
                        }
                        className={`text-[9px] border border-amber-200/80 px-2 py-0.5 uppercase text-amber-100 ${!hasContent || loading || enhancePlusBusy ? 'opacity-40 cursor-not-allowed' : 'hover:bg-amber-100 hover:text-black'}`}
                      >
                        {enhancePlusBusy ? '…' : plan === 'PRO' ? 'Enhance+' : `Enhance+ ${enhancePlusCost}cr`}
                      </button>
                    ) : null}
                    <span className="opacity-70 font-mono">v1.2</span>
                  </div>
                </div>

                {/* ContentEditable Div replacing Textarea */}
                <div 
                  ref={inputRef}
                  contentEditable
                  onPaste={handlePaste}
                  onInput={checkContent}
                  onKeyDown={handlePromptKeyDown}
                  onClick={handleContentClick}
                  data-component="Generate: Rich Input"
                  className={`${BRUTAL.input} min-h-[120px] text-sm bg-white focus:bg-white overflow-y-auto cursor-text ${dsGateBlocked ? 'opacity-50 pointer-events-none' : ''}`}
                  style={{ whiteSpace: 'pre-wrap' }}
                  data-placeholder={promptPlaceholder}
                />
            </div>
            <p className="text-[10px] text-gray-500 -mt-1">
              {dsGateBlocked ? (
                <span className="text-amber-800 font-bold">
                  Complete the design system import above to unlock the prompt and generation.
                </span>
              ) : (
                <>Tip: include goal, constraints, and expected output. Press Cmd/Ctrl + Enter to run.</>
              )}
            </p>
            {promptHints.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-300 p-2 text-[10px] text-yellow-900">
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
              className="relative overflow-hidden min-h-[48px]"
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
            {loading && generateStepLabel ? (
              <p className="text-[9px] text-gray-600 mt-1.5 text-center font-mono" aria-live="polite">
                {generateStepLabel}
              </p>
            ) : null}

            <div className="mt-2">
                <p data-component="Generate: Inspiration Title" className="text-[10px] font-bold uppercase text-gray-500 mb-2">Prompt starters (context-aware):</p>
                <div className="flex flex-wrap gap-2">
                {contextSuggestions.map((txt, i) => (
                    <button 
                    key={txt} 
                    data-component={`Generate: Inspiration Chip ${i+1}`}
                    onClick={() => handleInsertInspiration(txt)} 
                    disabled={!canGenerate || dsGateBlocked}
                    className={`text-[10px] border border-black px-2 py-1 bg-white transition-colors text-left ${canGenerate && !dsGateBlocked ? 'hover:bg-[#ffc900]' : 'opacity-50'}`}
                    >
                    {txt}
                    </button>
                ))}
                </div>
            </div>
        </>
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

      {/* Sticky above main tab bar: opens full legal copy in a dialog */}
      <div
        data-component="Generate: Legal strip"
        className="fixed left-0 right-0 z-[55] max-w-md mx-auto w-full border-t-2 border-black bg-[#fdfdfd] px-3 pt-2.5 pb-2.5"
        style={{ bottom: '3.5rem' }}
      >
        <button
          type="button"
          onClick={() => setShowLegalModal(true)}
          className="w-full text-left text-[10px] font-black uppercase tracking-wide text-gray-600 underline decoration-black/25 underline-offset-2 hover:text-black"
        >
          Design system data — tap for full notice
        </button>
      </div>

      {showLegalModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowLegalModal(false)}
        >
          <div className={`${BRUTAL.card} bg-white max-w-lg w-full p-4`} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black uppercase text-sm mb-2">Design system data (placeholder)</h3>
            <p className="text-xs text-gray-700 leading-[1.4]">
              Comtra uses your design system data to run Generate and the features you requested. DS content is not
              used to train generic AI models. Final copy, privacy links, and retention details will appear here after
              legal sign-off.
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
