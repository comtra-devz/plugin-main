
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BRUTAL, TIER_LIMITS, PRIVACY_CONTENT, getScanCostAndSize, getA11yCostAndSize, getPrototypeAuditCost, UX_AUDIT_CREDITS, COUNT_CAP, AUTH_BACKEND_URL } from '../../constants';
import { UserPlan, AuditIssue, DsAuditSummary, DsQualityGates } from '../../types';
import { Button } from '../../components/ui/Button';
import { CircularScore } from '../../components/widgets/CircularScore';
import { Confetti } from '../../components/Confetti';
import { SuccessModal } from '../../components/SuccessModal';
import { ScanReceiptModal } from '../../components/ScanReceiptModal';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { DesignSystemTab, ScanScope } from './tabs/DesignSystemTab';
import { AccessibilityTab } from './tabs/AccessibilityTab';
import { UxAuditTab } from './tabs/UxAuditTab';
import { PrototypeAuditTab } from './tabs/PrototypeAuditTab';
import { 
  LOADING_MSGS,
  A11Y_LOADING_MSGS,
  PROTO_LOADING_MSGS,
  DS_ISSUES, 
  A11Y_ISSUES, 
  buildDsCategoriesFromIssues,
  buildA11yCategoriesFromIssues,
  buildUxCategoriesFromIssues,
  buildPrototypeCategoriesFromIssues,
  computeDsScoreFromIssues,
  computeUxHealthScoreFromIssues,
  computePrototypeHealthScoreFromIssues,
  getDsScoreCopy,
  getUxScoreCopy,
  getPrototypeScoreCopy,
} from './data';
import { getCreditsForIssue, getCreditsForFixAll, ACTION_AUTO_FIX, ACTION_AUTO_FIX_ALL } from './autoFixConfig';
import { useToast } from '../../contexts/ToastContext';

export interface FetchFigmaFileBody {
  file_key: string;
  scope?: string;
  depth?: number;
  page_id?: string | null;
  node_ids?: string[] | null;
}

interface Props { 
  plan: UserPlan; 
  userTier?: string;
  onUnlockRequest: () => void;
  /** When audit fails for missing Figma token, call this to open login and start OAuth. */
  onRetryConnection?: () => void;
  /** Debug: check if backend has a Figma token for current user (see docs/FIGMA-TOKEN-TROUBLESHOOTING.md). */
  onCheckTokenStatus?: () => void;
  /** When set (timestamp), clear token-related audit errors so banner disappears after "Verifica token" success. */
  tokenVerifiedAt?: number | null;
  creditsRemaining: number | null;
  useInfiniteCreditsForTest?: boolean;
  estimateCredits: (payload: { action_type: string; node_count?: number }) => Promise<{ estimated_credits: number }>;
  consumeCredits: (payload: { action_type: string; credits_consumed: number; file_id?: string; max_health_score?: number }) => Promise<{ credits_remaining?: number; error?: string }>;
  onNavigateToGenerate?: (prompt: string) => void;
  /** Pipeline to agents: fetch file JSON from backend (Figma REST). Called after confirm scan when fileKey is available. */
  fetchFigmaFile?: (body: FetchFigmaFileBody) => Promise<unknown>;
  /** DS Audit agent: fetch issues from backend (Kimi). Called after confirm scan when fileKey is available. */
  fetchDsAudit?: (body: { file_key?: string; file_json?: object; scope?: string; page_id?: string; node_ids?: string[]; page_ids?: string[] }) => Promise<{
    issues: AuditIssue[];
    libraryContextHint?: { type: string; message: string };
    spec_coverage_summary?: DsAuditSummary;
    readability_summary?: DsAuditSummary;
    quality_gates?: DsQualityGates;
  }>;
  /** A11Y Audit agent: fetch issues from backend (no Kimi). Called after confirm when fileKey is available. */
  fetchA11yAudit?: (body: { file_key?: string; file_json?: object; scope?: string; page_id?: string; node_ids?: string[]; page_ids?: string[] }) => Promise<{ issues: AuditIssue[] }>;
  /** UX Audit agent: fetch issues from backend (Kimi). Called after confirm when fileKey/fileJson is available. */
  fetchUxAudit?: (body: { file_key?: string; file_json?: object; scope?: string; page_id?: string; node_ids?: string[]; page_ids?: string[] }) => Promise<{ issues: AuditIssue[] }>;
  /** JWT for auth backend, used for audit feedback tickets. */
  authToken?: string | null;
  /** True when one or more layers are selected on the Figma canvas (synced via selection-changed). */
  canvasSelectionActive: boolean;
}

type AuditTab = 'DS' | 'A11Y' | 'UX' | 'PROTOTYPE';

import { getSystemToastOptions, isFileNotSavedError, isFigmaConnectionError } from '../../lib/errorCopy';

export const Audit: React.FC<Props> = ({ plan, userTier, onUnlockRequest, onRetryConnection, onCheckTokenStatus, tokenVerifiedAt, creditsRemaining, useInfiniteCreditsForTest, estimateCredits, consumeCredits, onNavigateToGenerate, fetchFigmaFile, fetchDsAudit, fetchA11yAudit, fetchUxAudit, authToken, canvasSelectionActive }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<AuditTab>('DS');
  const [hasAudited, setHasAudited] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0]);
  const [a11yLoaderMsg, setA11yLoaderMsg] = useState(A11Y_LOADING_MSGS[0]);
  const [protoLoaderMsg, setProtoLoaderMsg] = useState(PROTO_LOADING_MSGS[0]);
  
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [score, setScore] = useState(78);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // UX Audit: no scope (no "All Pages"); result state
  const [hasUxAudited, setHasUxAudited] = useState(false);
  const [lastUxAuditDate, setLastUxAuditDate] = useState<Date | null>(null);
  const [uxAuditIssues, setUxAuditIssues] = useState<AuditIssue[] | null>(null);
  const [uxAuditLoading, setUxAuditLoading] = useState(false);
  const [uxAuditError, setUxAuditError] = useState<string | null>(null);

  // Prototype Audit: flow multi-select and result state
  const [flowStartingPoints, setFlowStartingPoints] = useState<{ nodeId: string; name: string }[]>([]);
  const [selectedFlowIds, setSelectedFlowIds] = useState<string[]>([]);
  const [isFlowDropdownOpen, setIsFlowDropdownOpen] = useState(false);
  const [hasProtoAudited, setHasProtoAudited] = useState(false);
  const [lastProtoAuditDate, setLastProtoAuditDate] = useState<Date | null>(null);
  const [protoAuditIssues, setProtoAuditIssues] = useState<AuditIssue[] | null>(null);
  const [protoAuditLoading, setProtoAuditLoading] = useState(false);
  const [protoAuditError, setProtoAuditError] = useState<string | null>(null);
  /** Figma canvas page for prototype flows (synced on tab open + currentpagechange). */
  const [prototypeCanvasPageId, setPrototypeCanvasPageId] = useState<string>('');
  /** Prototype full-page loader: indeterminate-style bar (never sits at 100% until done). */
  const [protoLoaderBarPercent, setProtoLoaderBarPercent] = useState(0);
  const protoCostRef = useRef<number>(0);

  // A11Y / legacy deep scan (receipt flow)
  const [hasDeepScanned, setHasDeepScanned] = useState(false);
  const [isDeepScanning, setIsDeepScanning] = useState(false);

  // Receipt Modal State
  const [showReceipt, setShowReceipt] = useState(false);
  const [waitingForFileContext, setWaitingForFileContext] = useState(false);
  const [scanStats, setScanStats] = useState({ nodes: 0, cost: 0, sizeLabel: '', target: 'All Pages' });
  const [pendingScanType, setPendingScanType] = useState<'MAIN' | 'DEEP' | 'A11Y' | null>(null);

  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: {
      rule?: string;
      method?: string;
      action?: string;
      target?: string;
      scope?: string;
      dsPriority?: string;
      note?: string;
      costLabel?: string;
    };
    isWarning?: boolean;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  // Excluded Pages Logic (for issue filtering)
  const [excludedPages, setExcludedPages] = useState<string[]>([]);

  // Scope & Document Pages (for node scan)
  const [documentPages, setDocumentPages] = useState<{ id: string; name: string }[]>([]);
  const [scanScope, setScanScope] = useState<ScanScope>('unselected');
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [isScopeDropdownOpen, setIsScopeDropdownOpen] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  // True right after "Authorize" click to prevent any frame where underlying UI becomes visible.
  const [isLaunchingAudit, setIsLaunchingAudit] = useState(false);
  const [scanProgress, setScanProgress] = useState({ percent: 0, count: 0 });
  const [fakeProgressPercent, setFakeProgressPercent] = useState(0);
  const fakeProgressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Default scope to Current Selection when canvas has a selection; clear invalid current when selection empties. */
  useEffect(() => {
    if (canvasSelectionActive) {
      setScanScope((prev) => (prev === 'unselected' ? 'current' : prev));
    } else {
      setScanScope((prev) => (prev === 'current' ? 'unselected' : prev));
    }
  }, [canvasSelectionActive]);

  // Component Deviation Navigator State
  const [deviationNavIndex, setDeviationNavIndex] = useState<{ [issueId: string]: number }>({});
  const [layerSelectionFeedback, setLayerSelectionFeedback] = useState<string | null>(null);
  const [pendingLayerSelectionId, setPendingLayerSelectionId] = useState<string | null>(null);
  /** When user clicks Auto-Fix on a contrast issue we request a preview; this holds pending data until we get the response. */
  const pendingContrastFixRef = useRef<{ issueId: string; layerId: string; cost: number } | null>(null);
  const pendingTouchFixRef = useRef<{ issueId: string; layerId: string; cost: number; targetMin: number } | null>(null);

  // Pending confirm scan: after user confirms we request file context, then in message handler we consume + fetch file
  const confirmPayloadRef = useRef<{ cost: number; score: number; pendingScanType: 'MAIN' | 'DEEP' | 'A11Y' | 'UX' } | null>(null);
  const chunkedRef = useRef<{ totalChunks: number; meta: Record<string, unknown>; chunks: Record<number, string> } | null>(null);
  // Ref so "Authorize" always sees the scan type that was set when the receipt was shown (avoids stale closure)
  const pendingScanTypeRef = useRef<'MAIN' | 'DEEP' | 'A11Y' | null>(null);
  // DS Audit agent: real issues from backend (Kimi)
  const [dsAuditIssues, setDsAuditIssues] = useState<AuditIssue[] | null>(null);
  const [dsAuditLoading, setDsAuditLoading] = useState(false);
  const [dsAuditError, setDsAuditError] = useState<string | null>(null);
  /** Advisory when file has no design system (0 components) — e.g. Preline CTA */
  const [dsAdvisory, setDsAdvisory] = useState<{ type: string; message: string; ctaLabel: string; ctaUrl: string } | null>(null);
  /** In-file-only masters (no remote components in JSON) — explains audit scope vs external library */
  const [dsLibraryContextHint, setDsLibraryContextHint] = useState<{ type: string; message: string } | null>(null);
  const [dsSpecCoverageSummary, setDsSpecCoverageSummary] = useState<DsAuditSummary | null>(null);
  const [dsReadabilitySummary, setDsReadabilitySummary] = useState<DsAuditSummary | null>(null);
  const [dsQualityGates, setDsQualityGates] = useState<DsQualityGates | null>(null);
  // A11Y Audit agent: real issues from backend (no Kimi)
  const [a11yAuditIssues, setA11yAuditIssues] = useState<AuditIssue[] | null>(null);
  const [a11yAuditLoading, setA11yAuditLoading] = useState(false);
  const [a11yAuditError, setA11yAuditError] = useState<string | null>(null);
  const [lastA11yAuditDate, setLastA11yAuditDate] = useState<Date | null>(null);
  const pendingAuditKindRef = useRef<'DS' | 'A11Y' | null>(null);
  /** Scope label for issue list (Page, Frame, Component, Instance, Group) from last file-context-result */
  const [auditScopeLabel, setAuditScopeLabel] = useState<string>('Page');
  /** Selection name when scope is 'current' (so we show "Type: Name" from the plugin) */
  const [auditScopeName, setAuditScopeName] = useState<string>('');
  /** True when last audit was run on current selection (so we show one group with plugin label) */
  const [auditScopeIsCurrent, setAuditScopeIsCurrent] = useState<boolean>(false);

  // Timestamps
  const [lastAuditDate, setLastAuditDate] = useState<Date | null>(null);
  const [lastDeepScanDate, setLastDeepScanDate] = useState<Date | null>(null);

  // New State for Fix/Undo/Discard
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());
  const [discardedIds, setDiscardedIds] = useState<Set<string>>(new Set());
  const [feedbackSentIds, setFeedbackSentIds] = useState<Set<string>>(new Set());
  const [wcagLevelFilter, setWcagLevelFilter] = useState<'AA' | 'AAA'>('AA');
  const [showHiddenLayers, setShowHiddenLayers] = useState(false);
  /** Resolves when plugin finishes isOnHiddenLayer enrichment for DS audit issues */
  const dsEnrichHiddenResolveRef = useRef<((issues: AuditIssue[]) => void) | null>(null);

  // Feedback Modal State
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackTargetId, setFeedbackTargetId] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'DISCARD' | 'BAD_FIX'>('DISCARD');
  const [feedbackText, setFeedbackText] = useState('');

  // Privacy Modal State
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  /** Error from last auto-fix credit consumption (e.g. Insufficient credits). Cleared when opening a new confirm or on success. */
  const [auditFixError, setAuditFixError] = useState<string | null>(null);

  // When parent signals token verified (e.g. after "Verifica token" success), clear token-related audit errors immediately
  useEffect(() => {
    if (tokenVerifiedAt == null) return;
    setDsAuditError(prev => (prev != null && isFigmaConnectionError(prev) ? null : prev));
    setA11yAuditError(prev => (prev != null && isFigmaConnectionError(prev) ? null : prev));
  }, [tokenVerifiedAt]);

  // Scope/page change invalidates DS/A11Y/UX snapshots. Reset to initial state so we never
  // show stale 100% (or stale issues) for a new selection before a fresh scan.
  useEffect(() => {
    setWcagLevelFilter('AA');
    setActiveCat(null);
    setExpandedIssue(null);
    setFixedIds(new Set());
    setDiscardedIds(new Set());
    setFeedbackSentIds(new Set());

    // DS
    setHasAudited(false);
    setDsAuditIssues(null);
    setDsAuditError(null);
    setDsAdvisory(null);
    setDsLibraryContextHint(null);
    setDsSpecCoverageSummary(null);
    setDsReadabilitySummary(null);
    setDsQualityGates(null);
    setLastAuditDate(null);

    // A11Y
    setHasDeepScanned(false);
    setA11yAuditIssues(null);
    setA11yAuditError(null);
    setLastA11yAuditDate(null);
    setAuditScopeLabel('Page');
    setAuditScopeName('');
    setAuditScopeIsCurrent(false);

    // UX
    setHasUxAudited(false);
    setUxAuditIssues(null);
    setUxAuditError(null);
    setLastUxAuditDate(null);
  }, [selectedPageId, scanScope]);

  /** One surface per error: file not saved = banner only; connection/Figma = toast only; others = toast only (no duplicate banner). */
  const showAuditError = useCallback(
    (message: string, isA11y: boolean, isUx?: boolean) => {
      setPendingScanType(null);
      setWaitingForFileContext(false);
      setIsLaunchingAudit(false);
      if (isUx) {
        setUxAuditLoading(false);
        if (isFileNotSavedError(message)) {
          const opts = getSystemToastOptions('file_link_unavailable');
          setUxAuditError(opts.description ?? opts.title);
          return;
        }
        setUxAuditError(null);
      } else if (isA11y) {
        setA11yAuditLoading(false);
        if (isFileNotSavedError(message)) {
          const opts = getSystemToastOptions('file_link_unavailable');
          setA11yAuditError(opts.description ?? opts.title);
          return;
        }
        setA11yAuditError(null);
      } else {
        setDsAuditLoading(false);
        if (isFileNotSavedError(message)) {
          const opts = getSystemToastOptions('file_link_unavailable');
          setDsAuditError(opts.description ?? opts.title);
          setDsAuditIssues(null);
          setDsLibraryContextHint(null);
          setDsSpecCoverageSummary(null);
          setDsReadabilitySummary(null);
          setDsQualityGates(null);
          return;
        }
        setDsAuditError(null);
        setDsAuditIssues(null);
        setDsAdvisory(null);
        setDsLibraryContextHint(null);
        setDsSpecCoverageSummary(null);
        setDsReadabilitySummary(null);
        setDsQualityGates(null);
      }
      if (isFigmaConnectionError(message)) {
        const opts = getSystemToastOptions('figma_connection_lost');
        showToast({
          ...opts,
          dismissible: true,
          actions: onRetryConnection ? [{ label: opts.ctaLabel ?? 'Reconnect Figma', onClick: onRetryConnection }] : [],
        });
        return;
      }
      const isTimeout = /timeout|504|timed out/i.test(message);
      const lowerMsg = message.toLowerCase();
      const isRateLimited = lowerMsg.includes('kimi_rate_limit') || lowerMsg.includes('rate limit') || lowerMsg.includes('rate-limited');
      const isUxInputTooLarge = lowerMsg.includes('ux_audit_input_too_large') || lowerMsg.includes('selection too large for ux audit');
      const isDsInputTooLarge =
        lowerMsg.includes('ds_audit_input_too_large') ||
        lowerMsg.includes('selection too large for ds audit') ||
        lowerMsg.includes('total message size') ||
        lowerMsg.includes('exceeds limit');
      const isInputTooLarge = isUxInputTooLarge || isDsInputTooLarge;
      const isKimiValidation = /kimi api error|context|token|too large|max(_| )?completion|invalid_request|model/i.test(lowerMsg);
      const busyDescription = isUx
        ? 'The UX audit is temporarily busy. Please retry in about a minute.'
        : isA11y
          ? 'The accessibility audit is temporarily busy. Please retry in about a minute.'
          : 'The DS audit is temporarily busy. Please retry in about a minute.';
      const tooLargeDescription = isUx
        ? 'This selection is too large for UX Audit. Try a smaller frame group or a tighter page section.'
        : isA11y
          ? 'This selection is too large for Accessibility Audit. Try Current Selection or a single page, then retry.'
          : 'This selection is too large for DS Audit. Try Current Selection or a single page, then retry.';
      const kimiValidationDescription = isUx
        ? 'UX audit request was rejected by the AI engine. Try Current Selection or a single page, then retry.'
        : isA11y
          ? 'Accessibility audit request was rejected by the AI engine. Try Current Selection or a single page, then retry.'
          : 'DS audit request was rejected by the AI engine. Try Current Selection or a single page, then retry.';
      const opts = isTimeout
        ? getSystemToastOptions('audit_timed_out')
        : isRateLimited
          ? getSystemToastOptions('service_unavailable', {
              description: busyDescription,
            })
        : isInputTooLarge
          ? getSystemToastOptions('audit_timed_out', {
              description: tooLargeDescription,
            })
        : isKimiValidation
          ? getSystemToastOptions('audit_couldnt_start', {
              description: kimiValidationDescription,
            })
          : getSystemToastOptions('audit_couldnt_start');
      showToast({
        ...opts,
        dismissible: true,
        actions: onRetryConnection ? [{ label: opts.ctaLabel ?? 'Retry', onClick: onRetryConnection }] : [],
      });
      if (isUx && (isKimiValidation || isRateLimited || isInputTooLarge)) {
        setUxAuditError(opts.description ?? opts.title);
      }
    },
    [showToast, onRetryConnection]
  );

  const isPro = plan === 'PRO';
  const infiniteForTest = !!useInfiniteCreditsForTest;
  const remaining = infiniteForTest || isPro ? Infinity : (creditsRemaining === null ? Infinity : creditsRemaining);
  const creditsDisplay = infiniteForTest || isPro ? '∞' : (creditsRemaining === null ? '—' : `${creditsRemaining}`);
  const knownZeroCredits = !infiniteForTest && !isPro && creditsRemaining !== null && creditsRemaining <= 0;

  // A11Y: filter by page only when scope is explicitly "page".
  // For "current" selection, issues already come scoped by selected nodes and can be on any page:
  // filtering again by selectedPageId (dropdown state) can hide valid issues.
  const a11yIssuesRaw = a11yAuditIssues != null ? a11yAuditIssues : A11Y_ISSUES;
  const isPageScoped = scanScope === 'page' && !!selectedPageId;
  const selectedPageName = isPageScoped && selectedPageId
    ? documentPages.find(p => p.id === selectedPageId)?.name
    : null;
  const a11yIssuesScoped = activeTab === 'A11Y' && a11yAuditIssues != null && selectedPageName
    ? a11yAuditIssues.filter(i => i.pageName === selectedPageName)
    : activeTab === 'A11Y' ? a11yIssuesRaw : [];

  // DS: same snapshot as A11Y — when audit scope is a single page, only list issues for that canvas (name from file JSON).
  const dsAuditIssuesForList =
    dsAuditIssues != null && selectedPageName
      ? dsAuditIssues.filter(i => !i.pageName || i.pageName === selectedPageName)
      : dsAuditIssues;

  // Determine which issue set to use (DS / A11Y use real issues from agent when available)
  let currentIssues = activeTab === 'DS' && dsAuditIssuesForList != null ? dsAuditIssuesForList : DS_ISSUES;
  if (activeTab === 'A11Y') currentIssues = a11yAuditIssues != null ? (selectedPageName ? a11yIssuesScoped : a11yAuditIssues) : A11Y_ISSUES;
  if (activeTab === 'UX') currentIssues = hasUxAudited && uxAuditIssues != null ? uxAuditIssues : [];
  if (activeTab === 'PROTOTYPE') currentIssues = hasProtoAudited && protoAuditIssues ? protoAuditIssues : [];

  // Filter out excluded pages (categories and list both use this base)
  const filteredIssues = currentIssues.filter(i => !i.pageName || !excludedPages.includes(i.pageName));
  // A11Y & Prototype: when "Show hidden layers" is off (default), exclude issues on hidden layers
  const a11yVisibleIssues =
    activeTab === 'A11Y'
      ? (showHiddenLayers ? filteredIssues : filteredIssues.filter(i => i.isOnHiddenLayer !== true))
      : filteredIssues;
  const protoVisibleIssues =
    activeTab === 'PROTOTYPE'
      ? (showHiddenLayers ? filteredIssues : filteredIssues.filter(i => i.isOnHiddenLayer !== true))
      : filteredIssues;
  const dsVisibleIssues =
    activeTab === 'DS'
      ? (showHiddenLayers ? filteredIssues : filteredIssues.filter(i => i.isOnHiddenLayer !== true))
      : filteredIssues;
  // A11Y: apply WCAG filter to the list AND to category counts (same source), so AA mode does not
  // show category totals that include hidden AAA rows (e.g. touch TGT-003) while the list is empty.
  const listIssues =
    activeTab === 'A11Y'
      ? (wcagLevelFilter === 'AA' ? a11yVisibleIssues.filter(i => i.wcag_level !== 'AAA') : a11yVisibleIssues)
      : activeTab === 'PROTOTYPE'
        ? protoVisibleIssues
        : activeTab === 'DS'
          ? dsVisibleIssues
          : filteredIssues;
  const activeIssues = activeCat ? listIssues.filter(i => i.categoryId === activeCat) : listIssues;
  const displayIssues = isPro ? activeIssues : activeIssues.slice(0, 6);
  const totalHiddenCount = isPro ? 0 : Math.max(0, activeIssues.length - 6);

  // DS tab: dynamic categories, score respect "Show hidden layers" like A11Y / Prototype
  const dsCategories = activeTab === 'DS' ? buildDsCategoriesFromIssues(dsVisibleIssues) : [];
  const dsFullForScore = activeTab === 'DS' && dsAuditIssuesForList != null
    ? dsAuditIssuesForList
        .filter(i => !i.pageName || !excludedPages.includes(i.pageName))
        .filter(i => showHiddenLayers || i.isOnHiddenLayer !== true)
        .filter(i => !fixedIds.has(i.id) && !discardedIds.has(i.id))
    : filteredIssues.filter(i => !fixedIds.has(i.id) && !discardedIds.has(i.id));
  const dsScore = activeTab === 'DS'
    ? (dsFullForScore.length === 0 ? 100 : computeDsScoreFromIssues(dsFullForScore))
    : score;
  const dsScoreCopy = activeTab === 'DS' ? getDsScoreCopy(dsScore) : { status: '', target: '' };

  // A11Y tab: categories and score from visible set when "Show hidden layers" is off
  const a11yFullForScore = activeTab === 'A11Y' && a11yAuditIssues != null
    ? a11yVisibleIssues.filter(i => !fixedIds.has(i.id) && !discardedIds.has(i.id))
    : [];
  const a11yScore = activeTab === 'A11Y'
    ? (a11yAuditIssues != null ? (a11yFullForScore.length === 0 ? 100 : computeDsScoreFromIssues(a11yFullForScore)) : 100)
    : 100;
  const a11yCategories = activeTab === 'A11Y' ? buildA11yCategoriesFromIssues(listIssues) : [];
  const a11yScoreCopy = activeTab === 'A11Y' ? getDsScoreCopy(a11yScore) : { status: '', target: '' };

  // UX tab: categories and score from UX Logic ruleset (no scope / no "All Pages")
  const uxCategories = activeTab === 'UX' ? buildUxCategoriesFromIssues(filteredIssues) : [];
  const uxScore = activeTab === 'UX' ? computeUxHealthScoreFromIssues(filteredIssues) : 100;
  const uxScoreCopy = activeTab === 'UX' ? getUxScoreCopy(uxScore) : { badge: 'EXCELLENT' as const, status: '' };

  // Prototype tab: categories and score from Prototype audit result (respect "Show hidden layers" toggle)
  const protoCategories = activeTab === 'PROTOTYPE' ? buildPrototypeCategoriesFromIssues(protoVisibleIssues) : [];
  const protoScore = activeTab === 'PROTOTYPE' ? computePrototypeHealthScoreFromIssues(protoVisibleIssues) : 100;
  const protoScoreCopy = activeTab === 'PROTOTYPE' ? getPrototypeScoreCopy(protoScore) : { advisoryLevel: 'healthy' as const, status: '' };

  const highSeverityCount = activeIssues.filter(i => i.severity === 'HIGH').length; 

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isScanning) {
      let i = 0;
      interval = setInterval(() => {
        i = (i + 1) % LOADING_MSGS.length;
        setLoadingMsg(LOADING_MSGS[i]);
      }, 1500);
      
      setTimeout(() => {
        setIsScanning(false);
        setHasAudited(true);
        setLastAuditDate(new Date());
      }, 4500);
    }
    return () => clearInterval(interval);
  }, [isScanning]);

  // Rotate A11Y/UX loader messages (after Authorize only)
  const isA11yLoader = waitingForFileContext || (activeTab === 'A11Y' && a11yAuditLoading) || (activeTab === 'UX' && uxAuditLoading);
  useEffect(() => {
    if (!isA11yLoader) return;
    let i = 0;
    setA11yLoaderMsg(A11Y_LOADING_MSGS[0]);
    const interval = setInterval(() => {
      i = (i + 1) % A11Y_LOADING_MSGS.length;
      setA11yLoaderMsg(A11Y_LOADING_MSGS[i]);
    }, 1500);
    return () => clearInterval(interval);
  }, [isA11yLoader]);

  // Guardrail: if plugin/file-context messaging gets stuck, fail fast instead of infinite loading.
  useEffect(() => {
    if (!waitingForFileContext) return;
    const t = setTimeout(() => {
      setWaitingForFileContext(false);
      setIsLaunchingAudit(false);
      setIsCalculating(false);
      showAuditError('File context request timed out. Please retry the scan.', activeTab === 'A11Y', activeTab === 'UX');
    }, 25000);
    return () => clearTimeout(t);
  }, [waitingForFileContext, activeTab, showAuditError]);

  // Rotate Prototype loader messages (same ToV)
  const isProtoLoader = activeTab === 'PROTOTYPE' && protoAuditLoading;
  useEffect(() => {
    if (!isProtoLoader) return;
    let i = 0;
    setProtoLoaderMsg(PROTO_LOADING_MSGS[0]);
    const interval = setInterval(() => {
      i = (i + 1) % PROTO_LOADING_MSGS.length;
      setProtoLoaderMsg(PROTO_LOADING_MSGS[i]);
    }, 1500);
    return () => clearInterval(interval);
  }, [isProtoLoader]);

  // Fetch document pages after first paint so mount stays snappy (get-pages is light; no traversal).
  useEffect(() => {
    const t = requestAnimationFrame(() => {
      window.parent.postMessage({ pluginMessage: { type: 'get-pages' } }, '*');
    });
    return () => cancelAnimationFrame(t);
  }, []);

  // Fetch flow starting points when Prototype tab is active (current Figma page).
  useEffect(() => {
    if (activeTab === 'PROTOTYPE') {
      window.parent.postMessage({ pluginMessage: { type: 'get-flow-starting-points' } }, '*');
    }
  }, [activeTab]);

  // Figma fires currentpagechange → controller sends flow-starting-points-result; close flow dropdown when page changes.
  useEffect(() => {
    if (prototypeCanvasPageId) setIsFlowDropdownOpen(false);
  }, [prototypeCanvasPageId]);

  // Prototype audit: creep progress bar slowly, cap ~87% until proto-audit-result (avoids “full bar but still working”).
  useEffect(() => {
    if (!protoAuditLoading) {
      setProtoLoaderBarPercent(0);
      return;
    }
    setProtoLoaderBarPercent(6);
    const id = window.setInterval(() => {
      setProtoLoaderBarPercent((p) => (p >= 87 ? p : Math.min(87, p + 1 + Math.floor(Math.random() * 4))));
    }, 480);
    return () => clearInterval(id);
  }, [protoAuditLoading]);

  // Fake progress: slow creep so we don't sit at 95% for long; real count-nodes-progress overrides when available
  useEffect(() => {
    if (!isCalculating) {
      setFakeProgressPercent(0);
      if (fakeProgressRef.current) {
        clearTimeout(fakeProgressRef.current);
        fakeProgressRef.current = null;
      }
      return;
    }
    setFakeProgressPercent(0);
    let cancelled = false;
    const FAKE_CAP = 82; // stop before "looking done"; real result will jump to 100%
    const scheduleNext = (current: number) => {
      if (cancelled || current >= FAKE_CAP) return;
      const step = Math.floor(Math.random() * 4) + 2; // 2–5% per step
      const delay = 280 + Math.floor(Math.random() * 320); // 280–600ms
      fakeProgressRef.current = setTimeout(() => {
        if (cancelled) return;
        setFakeProgressPercent(prev => {
          const next = Math.min(FAKE_CAP, prev + step);
          scheduleNext(next);
          return next;
        });
      }, delay);
    };
    const firstDelay = 400 + Math.floor(Math.random() * 400);
    fakeProgressRef.current = setTimeout(() => {
      if (cancelled) return;
      setFakeProgressPercent(prev => {
        const step = Math.floor(Math.random() * 4) + 2;
        const next = Math.min(FAKE_CAP, prev + step);
        scheduleNext(next);
        return next;
      });
    }, firstDelay);
    return () => {
      cancelled = true;
      if (fakeProgressRef.current) {
        clearTimeout(fakeProgressRef.current);
        fakeProgressRef.current = null;
      }
    };
  }, [isCalculating]);

  // Listen for plugin messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      let msg = e.data?.pluginMessage ?? e.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'enrich-issues-hidden-result') {
        const fn = dsEnrichHiddenResolveRef.current;
        if (fn) {
          dsEnrichHiddenResolveRef.current = null;
          fn(Array.isArray(msg.issues) ? (msg.issues as AuditIssue[]) : []);
        }
      }
      if (msg.type === 'pages-result' && msg.pages) {
        setDocumentPages(msg.pages);
        setSelectedPageId((prev) => (prev ? prev : msg.pages[0]?.id ?? null));
      }
      if (msg.type === 'flow-starting-points-result' && Array.isArray(msg.flows)) {
        setFlowStartingPoints(msg.flows);
        if (typeof msg.pageId === 'string') setPrototypeCanvasPageId(msg.pageId);
        setSelectedFlowIds((prev) => {
          const valid = new Set((msg.flows as { nodeId: string }[]).map((f) => f.nodeId));
          return prev.filter((id) => valid.has(id));
        });
      }
      if (msg.type === 'proto-audit-result') {
        const issues = Array.isArray(msg.issues) ? msg.issues as AuditIssue[] : [];
        const err = msg.error as string | undefined;
        setIsLaunchingAudit(false);
        setProtoAuditIssues(issues);
        setProtoLoaderBarPercent(100);
        setProtoAuditLoading(false);
        setScanProgress({ percent: 100, count: 0 });
        setTimeout(() => setIsCalculating(false), 200);
        if (err) {
          setProtoAuditError(err);
          // Even if audit fails, show the UI error state instead of returning to a "silent" ready screen.
          setHasProtoAudited(true);
          setLastProtoAuditDate(new Date());
        } else {
          setHasProtoAudited(true);
          setLastProtoAuditDate(new Date());
          const cost = protoCostRef.current;
          if (cost > 0 && !useInfiniteCreditsForTest && !(plan === 'PRO')) {
            consumeCredits({ action_type: 'proto_audit', credits_consumed: cost }).then((result) => {
              if (result.error === 'Insufficient credits') onUnlockRequest();
              else if (result.error) setProtoAuditError(result.error);
            });
          }
        }
      }
      if (msg.type === 'select-layer-result') {
        const ok = msg.ok === true;
        const selectedId = typeof msg.layerId === 'string' ? msg.layerId : pendingLayerSelectionId;
        setPendingLayerSelectionId(null);
        if (ok && selectedId) {
          setLayerSelectionFeedback(selectedId);
          setTimeout(() => setLayerSelectionFeedback(null), 2000);
        }
      }
      if (msg.type === 'count-nodes-progress') {
        setScanProgress({ percent: msg.percent ?? 0, count: msg.count ?? 0 });
      }
      // Shared node scan across DS / A11Y / (future UX, Prototype): same scope+page reuses cached count; receipt shows credits for current audit type and selection.
      if (msg.type === 'count-nodes-result') {
        const count = msg.count ?? 0;
        const target = msg.target ?? 'All Pages';
        const fromCache = msg.fromCache === true;
        const isA11y = pendingAuditKindRef.current === 'A11Y';
        pendingAuditKindRef.current = null;
        const scanTypeForReceipt: 'MAIN' | 'A11Y' = isA11y ? 'A11Y' : 'MAIN';
        const { cost, sizeLabel } = isA11y ? getA11yCostAndSize(count) : getScanCostAndSize(count);
        setScanStats({ nodes: count, cost, sizeLabel, target });
        setPendingScanType(scanTypeForReceipt);
        pendingScanTypeRef.current = scanTypeForReceipt;
        setScanProgress({ percent: 100, count });
        const minLoadingMs = fromCache ? 350 : 1200 + Math.floor(Math.random() * 1000);
        setTimeout(() => {
          setIsCalculating(false);
          setShowReceipt(true);
        }, minLoadingMs);
      }
      if (msg.type === 'count-nodes-error') {
        setIsCalculating(false);
        setScanProgress({ percent: 0, count: msg.count ?? 0 });
        console.error('[count-nodes-error]', msg.error, 'count so far:', msg.count);
      }
      if (msg.type === 'contrast-fix-preview') {
        const pending = pendingContrastFixRef.current;
        if (pending && pending.layerId === msg.layerId) {
          const preview = msg.preview as {
            source: string;
            message: string;
            label?: string;
            variableId?: string;
            styleId?: string;
            r?: number;
            g?: number;
            b?: number;
          } | null;
          const err = msg.error as string | undefined;
          if (err || !preview) {
            setAuditFixError(err || 'Could not get fix suggestion.');
            pendingContrastFixRef.current = null;
            return;
          }
          pendingContrastFixRef.current = null;
          if (preview.source === 'external_library') {
            setAuditFixError(null);
            setConfirmConfig({
              isOpen: true,
              title: 'External library',
              message: preview.message,
              confirmLabel: 'OK',
              onConfirm: () => setConfirmConfig(null),
              onCancel: () => setConfirmConfig(null),
            });
            return;
          }
          if (preview.source !== 'variable' && preview.source !== 'style' && preview.source !== 'hardcoded') {
            setAuditFixError('Unexpected contrast preview state.');
            return;
          }
          const cost = pending.cost;
          const action =
            preview.source === 'variable'
              ? `Bind text fill to variable "${preview.label ?? 'selected token'}".`
              : preview.source === 'style'
                ? `Apply paint style "${preview.label ?? 'selected style'}" to text fill.`
                : 'Update text fill directly with computed accessible color.';
          setConfirmConfig({
            isOpen: true,
            title: 'Confirm Auto-Fix',
            message: `${preview.message}\n\nConsume ${cost} credit${cost !== 1 ? 's' : ''}?`,
            details: {
              method: preview.source === 'hardcoded' ? 'Direct update' : preview.source === 'style' ? 'Paint style' : 'Variable token',
              action,
              target: 'Text fill',
              scope: 'Current layer',
              dsPriority: 'A11Y priority: fix at design-system source when possible.',
              costLabel: `${cost} credit${cost !== 1 ? 's' : ''}`,
            },
            confirmLabel: `Apply Fix (-${cost} Credits)`,
            onConfirm: async () => {
              const result = await consumeCredits({ action_type: ACTION_AUTO_FIX, credits_consumed: cost });
              if (result.error) {
                setAuditFixError(result.error === 'Insufficient credits' ? 'Insufficient credits. Upgrade or try again later.' : result.error);
                return;
              }
              applySingleFix(pending.issueId);
              setAuditFixError(null);
              setConfirmConfig(null);
              window.parent.postMessage({
                pluginMessage: {
                  type: 'apply-fix',
                  layerId: pending.layerId,
                  categoryId: 'contrast',
                  fixPreview: { source: preview.source, variableId: preview.variableId, styleId: preview.styleId, r: preview.r, g: preview.g, b: preview.b },
                },
              }, '*');
            },
          });
        }
      }
      if (msg.type === 'touch-fix-preview') {
        const pending = pendingTouchFixRef.current;
        if (pending && pending.layerId === msg.layerId) {
          const cost = pending.cost;
          const issueId = pending.issueId;
          pendingTouchFixRef.current = null;
          const preview = msg.preview as {
            source: string;
            message: string;
            applyLayerId: string;
            variableId?: string;
            paddingDelta?: number;
            newWidth?: number;
            newHeight?: number;
            appliesToMainComponent?: boolean;
          } | null;
          const err = msg.error as string | undefined;
          if (err || !preview) {
            setAuditFixError(err || 'Could not compute touch target fix.');
            return;
          }
          if (preview.source === 'external_library' || preview.source === 'unsupported') {
            setAuditFixError(null);
            setConfirmConfig({
              isOpen: true,
              title: preview.source === 'external_library' ? 'External library' : 'Touch fix',
              message: preview.message,
              confirmLabel: 'OK',
              onConfirm: () => setConfirmConfig(null),
              onCancel: () => setConfirmConfig(null),
            });
            return;
          }
          if (preview.source !== 'variable' && preview.source !== 'hardcoded' && preview.source !== 'resize') {
            setAuditFixError('Unexpected preview state.');
            return;
          }
          const method = preview.source === 'variable' ? 'Spacing token' : preview.source === 'hardcoded' ? 'Padding update' : 'Resize';
          const action =
            preview.source === 'variable'
              ? `Apply spacing variable to auto-layout paddings${preview.paddingDelta ? ` (>= ${preview.paddingDelta}px target delta)` : ''}.`
              : preview.source === 'hardcoded'
                ? `Add ${preview.paddingDelta ?? 0}px padding on each side of the auto-layout host.`
                : `Resize layer to ${Math.round(preview.newWidth ?? 0)} x ${Math.round(preview.newHeight ?? 0)} px.`;
          setConfirmConfig({
            isOpen: true,
            title: 'Confirm Auto-Fix',
            message: `${preview.message}\n\nConsume ${cost} credit${cost !== 1 ? 's' : ''}?`,
            details: {
              method,
              action,
              target: preview.source === 'resize' ? 'Layer size' : 'Hit area',
              scope: preview.appliesToMainComponent ? 'Main component in this file' : 'Current layer',
              dsPriority: 'A11Y priority: fix at design-system source (main + spacing tokens when possible).',
              costLabel: `${cost} credit${cost !== 1 ? 's' : ''}`,
            },
            confirmLabel: `Apply Fix (-${cost} Credits)`,
            onConfirm: async () => {
              const result = await consumeCredits({
                action_type: ACTION_AUTO_FIX,
                credits_consumed: cost,
              });
              if (result.error) {
                setAuditFixError(
                  result.error === 'Insufficient credits'
                    ? 'Insufficient credits. Upgrade or try again later.'
                    : result.error
                );
                return;
              }
              applySingleFix(issueId);
              setAuditFixError(null);
              setConfirmConfig(null);
              window.parent.postMessage(
                {
                  pluginMessage: {
                    type: 'apply-fix',
                    layerId: preview.applyLayerId,
                    categoryId: 'touch',
                    fixPreview: {
                      source: preview.source,
                      applyLayerId: preview.applyLayerId,
                      variableId: preview.variableId,
                      paddingDelta: preview.paddingDelta,
                      newWidth: preview.newWidth,
                      newHeight: preview.newHeight,
                    },
                  },
                },
                '*'
              );
            },
            onCancel: () => setConfirmConfig(null),
          });
        }
      }
      if (msg.type === 'file-context-chunked-start') {
        chunkedRef.current = {
          totalChunks: msg.totalChunks ?? 0,
          meta: { fileKey: msg.fileKey, scope: msg.scope, pageId: msg.pageId, selectionType: msg.selectionType, selectionName: msg.selectionName },
          chunks: {},
        };
      }
      if (msg.type === 'file-context-chunk' && chunkedRef.current) {
        const state = chunkedRef.current;
        state.chunks[msg.index] = msg.chunk;
        if (Object.keys(state.chunks).length !== state.totalChunks) return;
        const parts: string[] = [];
        for (let i = 0; i < state.totalChunks; i++) parts.push(state.chunks[i]);
        chunkedRef.current = null;
        let fileJson: object;
        try {
          fileJson = JSON.parse(parts.join('')) as object;
        } catch {
          const payload = confirmPayloadRef.current;
          const msg = 'Invalid data received. Try again.';
          const isA11y = payload?.pendingScanType === 'A11Y';
          if (payload) showAuditError(msg, isA11y);
          return;
        }
        msg = { type: 'file-context-result', ...state.meta, fileJson };
      }
      if (msg.type === 'file-context-result') {
        const payload = confirmPayloadRef.current;
        if (!payload) return;
        confirmPayloadRef.current = null;
        if (msg.error) {
          setShowReceipt(false);
          const errMsg = String(msg.error);
          const isA11y = payload.pendingScanType === 'A11Y';
          const isUx = payload.pendingScanType === 'UX';
          if (isUx) setIsCalculating(false);
          showAuditError(errMsg, isA11y, isUx);
          return;
        }
        const hasFileKey = !!msg.fileKey;
        const hasFileJson = !!(msg.fileJson && typeof msg.fileJson === 'object' && (msg.fileJson as { document?: unknown }).document);
        if (!hasFileKey && !hasFileJson) {
          setShowReceipt(false);
          const saveMsg = (msg as { error?: string }).error || 'FILE_LINK_UNAVAILABLE';
          const isA11y = payload.pendingScanType === 'A11Y';
          const isUx = payload.pendingScanType === 'UX';
          if (isUx) setIsCalculating(false);
          showAuditError(saveMsg, isA11y, isUx);
          return;
        }
        const isA11yScan = payload.pendingScanType === 'A11Y';
        const isUxScan = payload.pendingScanType === 'UX';
        if (isA11yScan) setActiveTab('A11Y');
        if (msg.selectionType) setAuditScopeLabel(String(msg.selectionType));
        else setAuditScopeLabel('Page');
        setAuditScopeName(typeof msg.selectionName === 'string' ? msg.selectionName : '');
        setAuditScopeIsCurrent(msg.scope === 'current');
        // Prefer file_key whenever available to keep request payload small and avoid 413 on large files.
        const auditBody = hasFileKey
          ? {
              file_key: msg.fileKey as string,
              scope: msg.scope ?? 'all',
              page_id: msg.pageId ?? undefined,
              node_ids: Array.isArray(msg.nodeIds) ? msg.nodeIds : undefined,
              page_ids: Array.isArray(msg.pageIds) ? msg.pageIds : undefined,
            }
          : { file_json: msg.fileJson as object };

        const setAuditError = (message: string) => {
          showAuditError(message, isA11yScan, isUxScan);
        };

        (async () => {
          try {
            // Charge only after a successful provider response (all audits),
            // so failed scans never consume credits.
            setShowReceipt(false);
            if (isUxScan) {
              if (!fetchUxAudit) {
                setAuditError('Audit not available');
                return;
              }
              setUxAuditError(null);
              setUxAuditLoading(true);
              const data = await fetchUxAudit(auditBody);
              if (!useInfiniteCreditsForTest && !isPro && payload.cost > 0) {
                const chargeResult = await consumeCredits({
                  action_type: 'ux_audit',
                  credits_consumed: payload.cost,
                  max_health_score: payload.score,
                });
                if (chargeResult.error === 'Insufficient credits') {
                  onUnlockRequest();
                  setWaitingForFileContext(false);
                  return;
                }
                if (chargeResult.error) {
                  setAuditError(chargeResult.error);
                  return;
                }
              }
              setUxAuditIssues(Array.isArray(data?.issues) ? data.issues : []);
              setHasUxAudited(true);
              setLastUxAuditDate(new Date());
            } else if (isA11yScan) {
              if (!fetchA11yAudit) {
                setAuditError('Audit not available');
                return;
              }
              setA11yAuditError(null);
              setA11yAuditLoading(true);
              const data = await fetchA11yAudit(auditBody);
              if (!useInfiniteCreditsForTest && !isPro && payload.cost > 0) {
                const chargeResult = await consumeCredits({
                  action_type: 'a11y_audit',
                  credits_consumed: payload.cost,
                  max_health_score: payload.score,
                });
                if (chargeResult.error === 'Insufficient credits') {
                  onUnlockRequest();
                  setWaitingForFileContext(false);
                  return;
                }
                if (chargeResult.error) {
                  setAuditError(chargeResult.error);
                  return;
                }
              }
              setA11yAuditIssues(Array.isArray(data?.issues) ? data.issues : []);
              setLastA11yAuditDate(new Date());
              if (msg.scope === 'page' && msg.pageId) {
                window.parent.postMessage({ pluginMessage: { type: 'switch-to-page', pageId: msg.pageId } }, '*');
              }
            } else if (fetchDsAudit) {
              setDsAuditError(null);
              setDsAdvisory(null);
              setDsLibraryContextHint(null);
              setDsSpecCoverageSummary(null);
              setDsReadabilitySummary(null);
              setDsQualityGates(null);
              setDsAuditLoading(true);
              const data = await fetchDsAudit(auditBody);
              const rawIssues = Array.isArray(data?.issues) ? (data.issues as AuditIssue[]) : [];
              const enriched = await new Promise<AuditIssue[]>((resolve) => {
                if (rawIssues.length === 0) {
                  resolve([]);
                  return;
                }
                const timeout = setTimeout(() => {
                  if (dsEnrichHiddenResolveRef.current) dsEnrichHiddenResolveRef.current = null;
                  resolve(rawIssues);
                }, 12000);
                dsEnrichHiddenResolveRef.current = (issues: AuditIssue[]) => {
                  clearTimeout(timeout);
                  dsEnrichHiddenResolveRef.current = null;
                  resolve(issues.length > 0 ? issues : rawIssues);
                };
                window.parent.postMessage(
                  {
                    pluginMessage: {
                      type: 'enrich-issues-hidden',
                      issues: rawIssues,
                      requestId: Date.now(),
                    },
                  },
                  '*',
                );
              });
              setDsAuditIssues(enriched);
              if (data?.advisory && typeof data.advisory === 'object' && data.advisory.message && data.advisory.ctaUrl) {
                setDsAdvisory({
                  type: data.advisory.type || 'no_design_system',
                  message: data.advisory.message,
                  ctaLabel: data.advisory.ctaLabel || 'Learn more',
                  ctaUrl: data.advisory.ctaUrl,
                });
              }
              const hint = data?.libraryContextHint;
              if (hint && typeof hint.message === 'string' && hint.message.trim() && typeof hint.type === 'string') {
                setDsLibraryContextHint({ type: hint.type, message: hint.message.trim() });
              } else {
                setDsLibraryContextHint(null);
              }
              setDsSpecCoverageSummary(
                data?.spec_coverage_summary && typeof data.spec_coverage_summary === 'object'
                  ? data.spec_coverage_summary
                  : null,
              );
              setDsReadabilitySummary(
                data?.readability_summary && typeof data.readability_summary === 'object'
                  ? data.readability_summary
                  : null,
              );
              setDsQualityGates(
                data?.quality_gates && typeof data.quality_gates === 'object' ? data.quality_gates : null,
              );
              if (!useInfiniteCreditsForTest && !isPro && payload.cost > 0) {
                const chargeResult = await consumeCredits({
                  action_type: 'audit',
                  credits_consumed: payload.cost,
                  max_health_score: payload.score,
                });
                if (chargeResult.error === 'Insufficient credits') {
                  onUnlockRequest();
                  setWaitingForFileContext(false);
                  return;
                }
                if (chargeResult.error) {
                  setAuditError(chargeResult.error);
                  return;
                }
              }
            } else {
              setAuditError('Audit not available');
              return;
            }
            if (payload.pendingScanType === 'MAIN') {
              setHasAudited(true);
              setLastAuditDate(new Date());
            }
            else if (payload.pendingScanType === 'DEEP' || payload.pendingScanType === 'A11Y') {
              setIsDeepScanning(true);
              setTimeout(() => {
                setIsDeepScanning(false);
                setHasDeepScanned(true);
                setLastDeepScanDate(new Date());
              }, 1500);
            }
            if (isUxScan) {
              setScanProgress(prev => ({ ...prev, percent: 100 }));
              setTimeout(() => setIsCalculating(false), 200);
            }
          } catch (err) {
            let message = err instanceof Error ? err.message : 'Something went wrong';
            if (/timeout|504|timed out/i.test(message)) {
              message = 'Audit timed out. Try a single page or smaller selection.';
            }
            setAuditError(message);
          } finally {
            setPendingScanType(null);
            setWaitingForFileContext(false);
            setIsLaunchingAudit(false);
            setA11yAuditLoading((prev) => (isA11yScan ? false : prev));
            setDsAuditLoading((prev) => (!isA11yScan ? false : prev));
            setUxAuditLoading((prev) => (isUxScan ? false : prev));
          }
        })();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [consumeCredits, fetchFigmaFile, fetchDsAudit, fetchA11yAudit, fetchUxAudit, onUnlockRequest, useInfiniteCreditsForTest, plan, showAuditError]);

  const handleStartScan = useCallback(() => {
    if (scanScope === 'unselected' || (scanScope === 'page' && !selectedPageId)) return;
    if (knownZeroCredits) {
      onUnlockRequest();
      return;
    }
    setIsCalculating(true);
    setScanProgress({ percent: 0, count: 0 });
    const scope = scanScope;
    const pageId = scope === 'page' ? selectedPageId : undefined;
    window.parent.postMessage({ pluginMessage: { type: 'count-nodes', scope, pageId, countCap: COUNT_CAP } }, '*');
  }, [knownZeroCredits, onUnlockRequest, scanScope, selectedPageId]);

  const handleRunA11yAudit = useCallback(() => {
    if (scanScope === 'unselected' || (scanScope === 'page' && !selectedPageId)) return;
    if (knownZeroCredits) {
      onUnlockRequest();
      return;
    }
    pendingAuditKindRef.current = 'A11Y';
    setIsCalculating(true);
    setScanProgress({ percent: 0, count: 0 });
    window.parent.postMessage(
      { pluginMessage: { type: 'count-nodes', scope: scanScope, pageId: scanScope === 'page' ? selectedPageId ?? undefined : undefined, countCap: COUNT_CAP } },
      '*'
    );
  }, [knownZeroCredits, onUnlockRequest, scanScope, selectedPageId]);

  /** UX Audit: scope = Current Selection or single page (no "All Pages" option). Confirm → get-file-context → fetchUxAudit + consume credits. */
  const handleRunUxAudit = useCallback(() => {
    if (scanScope === 'unselected' || (scanScope === 'page' && !selectedPageId)) return;
    if (knownZeroCredits) {
      onUnlockRequest();
      return;
    }
    if (!fetchUxAudit) return;
    const cost: number = UX_AUDIT_CREDITS;
    setConfirmConfig({
      isOpen: true,
      title: 'Run UX Audit',
      message: `This audit will use ${cost} credit${cost !== 1 ? 's' : ''}. Continue?`,
      confirmLabel: `Run (-${cost} credit${cost !== 1 ? 's' : ''})`,
      onConfirm: () => {
        setIsLaunchingAudit(true);
        setConfirmConfig(null);
        setUxAuditError(null);
        confirmPayloadRef.current = { cost, score: 0, pendingScanType: 'UX' };
        setWaitingForFileContext(true);
        setIsCalculating(true);
        setScanProgress({ percent: 0, count: 0 });
        const scope = scanScope === 'page' ? 'page' : 'current';
        const pageId = scanScope === 'page' ? selectedPageId ?? undefined : undefined;
        requestAnimationFrame(() => {
          window.parent.postMessage(
            { pluginMessage: { type: 'get-file-context', scope, pageId } },
            '*'
          );
        });
      },
    });
  }, [knownZeroCredits, onUnlockRequest, scanScope, selectedPageId, fetchUxAudit]);

  /** Prototype Audit: confirm then run in-plugin audit; cost from getPrototypeAuditCost(selectedFlowIds.length). */
  const handleRunProtoAudit = useCallback(() => {
    if (flowStartingPoints.length === 0 || selectedFlowIds.length === 0) return;
    if (knownZeroCredits) {
      onUnlockRequest();
      return;
    }
    const { cost } = getPrototypeAuditCost(selectedFlowIds.length);
    protoCostRef.current = cost;
    const flowWord = selectedFlowIds.length === 1 ? 'flow' : 'flows';
    setConfirmConfig({
      isOpen: true,
      title: 'Run Prototype Audit',
      message: `This audit will use ${cost} credit${cost !== 1 ? 's' : ''} (${selectedFlowIds.length} ${flowWord}). Continue?`,
      confirmLabel: 'Authorize Charge',
      onConfirm: () => {
        setIsLaunchingAudit(true);
        setConfirmConfig(null);
        setProtoAuditError(null);
        setProtoAuditLoading(true);
        setIsCalculating(true);
        setScanProgress({ percent: 0, count: 0 });
        window.parent.postMessage(
          { pluginMessage: { type: 'run-proto-audit', selectedFlowNodeIds: selectedFlowIds } },
          '*'
        );
      },
    });
  }, [flowStartingPoints.length, selectedFlowIds, knownZeroCredits, onUnlockRequest]);

  const handleConfirmScan = () => {
    const cost = scanStats.cost;
    const scanType = pendingScanTypeRef.current ?? pendingScanType ?? (activeTab === 'A11Y' ? 'A11Y' : 'MAIN');
    if (!scanType) return;
    pendingScanTypeRef.current = null;
    setIsLaunchingAudit(true);
    confirmPayloadRef.current = { cost, score, pendingScanType: scanType };
    setShowReceipt(false);
    setWaitingForFileContext(true);
    // Defer postMessage so React commits the loader state and the full-page loader is visible before we request file context
    const scope = scanScope;
    const pageId = scanScope === 'page' ? selectedPageId : undefined;
    requestAnimationFrame(() => {
      window.parent.postMessage(
        { pluginMessage: { type: 'get-file-context', scope, pageId } },
        '*'
      );
    });
  };

  const handleFix = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (id === 'p2' && onNavigateToGenerate) {
        onNavigateToGenerate("Create a confirmation wireframe for the checkout flow with success state");
        return;
    }

    setAuditFixError(null);
    const issue = activeIssues.find(i => i.id === id);
    const cost = issue ? getCreditsForIssue(issue) : 2;
    const layerId = issue?.layerIds?.[deviationNavIndex[id] ?? 0] ?? issue?.layerId;
    const isOklchAdvisory = issue?.rule_id === 'CLR-002';

    if (isOklchAdvisory) {
      setConfirmConfig({
        isOpen: true,
        title: 'OKLCH Suggestion',
        message:
          'Figma does not support native OKLCH variables yet, so this is a design-system recommendation (no direct canvas auto-fix).',
        details: {
          rule: 'CLR-002',
          method: 'Advisory (no auto-apply)',
          action: 'Define/adjust the token in OKLCH in your DS source, then sync its HEX/sRGB fallback to Figma.',
          target: 'Color tokens',
          scope: 'Design system source',
          dsPriority: 'Check contrast using WCAG as usual; use OKLCH for more perceptual consistency across steps.',
          note: issue?.fix,
          costLabel: '0 credits',
        },
        confirmLabel: 'OK',
        onConfirm: () => setConfirmConfig(null),
      });
      return;
    }

    if (issue?.categoryId === 'contrast' && layerId) {
      pendingContrastFixRef.current = { issueId: id, layerId, cost };
      window.parent.postMessage({ pluginMessage: { type: 'get-contrast-fix-preview', layerId } }, '*');
      return;
    }

    if (issue?.categoryId === 'touch' && layerId && activeTab === 'A11Y') {
      if (issue.passes === true) {
        setAuditFixError('This target already passes via spacing; no auto-fix needed.');
        return;
      }
      const targetMin = issue.rule_id === 'TGT-003' ? 44 : 24;
      pendingTouchFixRef.current = { issueId: id, layerId, cost, targetMin };
      window.parent.postMessage(
        { pluginMessage: { type: 'get-touch-fix-preview', layerId, targetMin } },
        '*'
      );
      return;
    }

    setConfirmConfig({
        isOpen: true,
        title: "Confirm Auto-Fix",
        message: `This action will apply changes to your layer.\n\nConsume ${cost} credit${cost !== 1 ? 's' : ''}?`,
        details: {
          method: 'Automatic fix',
          action: 'Apply suggested fix for this issue category.',
          target: issue?.categoryId ? `Category: ${issue.categoryId}` : 'Selected issue layer',
          scope: 'Current layer',
          costLabel: `${cost} credit${cost !== 1 ? 's' : ''}`,
        },
        confirmLabel: `Apply Fix (-${cost} Credits)`,
        onConfirm: async () => {
            const result = await consumeCredits({
              action_type: ACTION_AUTO_FIX,
              credits_consumed: cost,
            });
            if (result.error) {
              setAuditFixError(result.error === 'Insufficient credits' ? 'Insufficient credits. Upgrade or try again later.' : result.error);
              return;
            }
            applySingleFix(id);
            setAuditFixError(null);
            setConfirmConfig(null);
            if (layerId) {
              window.parent.postMessage({ pluginMessage: { type: 'apply-fix', layerId } }, '*');
            }
        }
    });
  };

  function applySingleFix(id: string) {
    const newFixed = new Set(fixedIds);
    newFixed.add(id);
    setFixedIds(newFixed);
    const newScore = Math.min(100, score + 5);
    setScore(newScore);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2000);
    if (newScore > 80 && score <= 80) setShowSuccess(true);
    if (newScore > 90 && score <= 90) setShowSuccess(true);
    if (newScore === 100 && score < 100) setShowSuccess(true);
  }

  const handleFixAll = () => {
      const unfixed = activeIssues.filter(
        (i) =>
          !fixedIds.has(i.id) &&
          i.id !== 'p2' &&
          !discardedIds.has(i.id) &&
          !(i.categoryId === 'touch' && i.passes === true) &&
          i.rule_id !== 'CLR-002'
      );
      if (unfixed.length === 0) return;

      const totalCredits = getCreditsForFixAll(unfixed);
      setAuditFixError(null);
      setConfirmConfig({
        isOpen: true,
        title: `Fix All (${unfixed.length})`,
        message: `You are about to apply ${unfixed.length} fixes (${totalCredits} credits). For safety, we recommend duplicating the file or page before proceeding. Confirm?`,
        confirmLabel: `Apply All (-${totalCredits} Credits)`,
        onConfirm: async () => {
            const result = await consumeCredits({
              action_type: ACTION_AUTO_FIX_ALL,
              credits_consumed: totalCredits,
            });
            if (result.error) {
              setAuditFixError(result.error === 'Insufficient credits' ? 'Insufficient credits. Upgrade or try again later.' : result.error);
              return;
            }
            const newFixed = new Set(fixedIds);
            unfixed.forEach(i => newFixed.add(i.id));
            setFixedIds(newFixed);
            const addedScore = unfixed.length * 5;
            setScore(Math.min(100, score + addedScore));
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 2000);
            setAuditFixError(null);
            setConfirmConfig(null);
        }
      });
  };

  const handleUndo = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmConfig({
        isOpen: true,
        title: "Undo Changes?",
        message: "Are you sure you want to undo? Warning: spent credits will NOT be refunded.",
        isWarning: true,
        confirmLabel: "Undo Anyway",
        onConfirm: () => {
            const newFixed = new Set(fixedIds);
            newFixed.delete(id);
            setFixedIds(newFixed);
            
            // Also remove from feedbackSentIds if present, to restore to initial state
            const newFeedbackSent = new Set(feedbackSentIds);
            newFeedbackSent.delete(id);
            setFeedbackSentIds(newFeedbackSent);

            setScore(s => Math.max(0, s - 5));
            setConfirmConfig(null);
        }
    });
  };

  const handleDiscard = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      handleOpenFeedback(e, id, 'DISCARD');
  };

  const handleUndoDiscard = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const newDiscarded = new Set(discardedIds);
      newDiscarded.delete(id);
      setDiscardedIds(newDiscarded);
  };

  const handleOpenFeedback = (e: React.MouseEvent, id: string, type: 'DISCARD' | 'BAD_FIX') => {
      e.stopPropagation();
      setFeedbackTargetId(id);
      setFeedbackType(type);
      setFeedbackOpen(true);
      setFeedbackText('');
  };

  const handleSubmitFeedback = () => {
      if (feedbackTargetId) {
          if (feedbackType === 'DISCARD') {
              const newDiscarded = new Set(discardedIds);
              newDiscarded.add(feedbackTargetId);
              setDiscardedIds(newDiscarded);
              // Mark feedback as sent for this discard
              const newSent = new Set(feedbackSentIds);
              newSent.add(feedbackTargetId);
              setFeedbackSentIds(newSent);
              // Send audit feedback ticket to admin dashboard (notifications + support view)
              const comment = feedbackText.trim();
              if (authToken && comment.length >= 2) {
                const tabLabel =
                  activeTab === 'DS' ? 'Design System' :
                  activeTab === 'A11Y' ? 'Accessibility' :
                  activeTab === 'UX' ? 'UX Logic' :
                  activeTab === 'PROTOTYPE' ? 'Prototype' :
                  'Audit';
                const scope =
                  auditScopeIsCurrent ? `Scope: Current selection (${auditScopeName || auditScopeLabel})` :
                  `Scope: ${auditScopeLabel}${auditScopeName ? ` – ${auditScopeName}` : ''}`;
                const payload = {
                  type: 'AUDIT',
                  message: `[DISCARD] Tab: ${tabLabel}. ${scope}. IssueId: ${feedbackTargetId}. Comment: ${comment}`,
                };
                // Fire-and-forget, ma logghiamo se l'endpoint risponde non-OK
                void fetch(`${AUTH_BACKEND_URL}/api/support/ticket`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                  },
                  body: JSON.stringify(payload),
                }).then(async (r) => {
                  if (r.ok) {
                    console.info('[Comtra] POST /api/support/ticket ok', {
                      source: 'audit-discard',
                      status: r.status,
                      issueId: feedbackTargetId,
                    });
                    return;
                  }
                  let text: string | null = null;
                  try {
                    text = await r.text();
                  } catch {
                    text = null;
                  }
                  console.warn('[Comtra] POST /api/support/ticket failed', {
                    status: r.status,
                    feedbackType: 'DISCARD',
                    issueId: feedbackTargetId,
                    commentLength: comment.length,
                    body: text ? text.slice(0, 200) : null,
                  });
                }).catch((err) => {
                  console.warn('[Comtra] POST /api/support/ticket network error', err);
                });
              }
          } else if (feedbackType === 'BAD_FIX') {
              const newSent = new Set(feedbackSentIds);
              newSent.add(feedbackTargetId);
              setFeedbackSentIds(newSent);
              const comment = feedbackText.trim();
              if (authToken && comment.length >= 2) {
                const tabLabel =
                  activeTab === 'DS' ? 'Design System' :
                  activeTab === 'A11Y' ? 'Accessibility' :
                  activeTab === 'UX' ? 'UX Logic' :
                  activeTab === 'PROTOTYPE' ? 'Prototype' :
                  'Audit';
                const scope =
                  auditScopeIsCurrent ? `Scope: Current selection (${auditScopeName || auditScopeLabel})` :
                  `Scope: ${auditScopeLabel}${auditScopeName ? ` – ${auditScopeName}` : ''}`;
                const payload = {
                  type: 'AUDIT',
                  message: `[BAD_FIX] Tab: ${tabLabel}. ${scope}. IssueId: ${feedbackTargetId}. Comment: ${comment}`,
                };
                void fetch(`${AUTH_BACKEND_URL}/api/support/ticket`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                  },
                  body: JSON.stringify(payload),
                }).then(async (r) => {
                  if (r.ok) {
                    console.info('[Comtra] POST /api/support/ticket ok', {
                      source: 'audit-bad-fix',
                      status: r.status,
                      issueId: feedbackTargetId,
                    });
                    return;
                  }
                  let text: string | null = null;
                  try {
                    text = await r.text();
                  } catch {
                    text = null;
                  }
                  console.warn('[Comtra] POST /api/support/ticket failed', {
                    status: r.status,
                    feedbackType: 'BAD_FIX',
                    issueId: feedbackTargetId,
                    commentLength: comment.length,
                    body: text ? text.slice(0, 200) : null,
                  });
                }).catch((err) => {
                  console.warn('[Comtra] POST /api/support/ticket network error', err);
                });
              }
          }
      }
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
      setFeedbackOpen(false);
  };

  const postSelectLayer = (layerId: string) => {
    setPendingLayerSelectionId(layerId || null);
    window.parent.postMessage({ pluginMessage: { type: 'select-layer', layerId } }, '*');
  };

  const handleSelectLayer = (e: React.MouseEvent, layerId: string) => {
    e.stopPropagation();
    postSelectLayer(layerId);
  };

  const handleSelectFlow = (e: React.MouseEvent, flowName: string) => {
    e.stopPropagation();
    const normalize = (v: string) => v.trim().toLowerCase();
    const byName = flowStartingPoints.find((f) => normalize(f.name || '') === normalize(flowName));
    const fallback = !byName ? flowStartingPoints.find((f) => selectedFlowIds.includes(f.nodeId)) : null;
    const targetNodeId = byName?.nodeId || fallback?.nodeId;
    if (!targetNodeId) return;
    postSelectLayer(targetNodeId);
  };

  const handleShare = () => {
     window.open('https://www.linkedin.com/sharing/share-offsite/?url=https://comtra.dev', '_blank');
  };

  const handleNavDeviation = (e: React.MouseEvent, issueId: string, layerIds: string[], direction: 'prev' | 'next') => {
      e.stopPropagation();
      const currentIndex = deviationNavIndex[issueId] || 0;
      let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
      
      if (newIndex >= layerIds.length) newIndex = 0;
      if (newIndex < 0) newIndex = layerIds.length - 1;

      setDeviationNavIndex(prev => ({ ...prev, [issueId]: newIndex }));
      handleSelectLayer(e, layerIds[newIndex]); 
  };

  // Shared props for IssueList to avoid repetition
  const issueListProps = {
    expandedIssue,
    setExpandedIssue,
    fixedIds,
    discardedIds,
    feedbackSentIds,
    deviationNavIndex,
    layerSelectionFeedback,
    isPro,
    activeTab,
    scopeLabel: auditScopeLabel,
    scopeName: auditScopeName,
    scopeIsCurrent: auditScopeIsCurrent,
    getCreditsForIssue,
    onFix: handleFix,
    onUndo: handleUndo,
    onDiscard: handleDiscard,
    onUndoDiscard: handleUndoDiscard,
    onOpenFeedback: handleOpenFeedback,
    onSelectLayer: handleSelectLayer,
    onSelectFlow: handleSelectFlow,
    onNavDeviation: handleNavDeviation,
    onFixAll: handleFixAll,
    onUnlockRequest: onUnlockRequest,
    totalHiddenCount: totalHiddenCount,
    wcagLevelFilter,
    setWcagLevelFilter,
    showHiddenLayers,
    setShowHiddenLayers,
  };

  const wordCount = feedbackText.trim().split(/\s+/).filter(w => w.length > 0).length;
  const canSubmitFeedback = wordCount >= 2;

  // Keep one continuous blocking loader during the whole audit pipeline, avoiding visual "back-and-forth" flashes.
  const showFullPageLoader =
    isLaunchingAudit ||
    waitingForFileContext ||
    dsAuditLoading ||
    (activeTab === 'A11Y' && a11yAuditLoading) ||
    (activeTab === 'UX' && uxAuditLoading) ||
    (activeTab === 'PROTOTYPE' && protoAuditLoading);
  const fullPageLoaderMsg = isProtoLoader ? protoLoaderMsg : isA11yLoader ? a11yLoaderMsg : loadingMsg;
  const nodeCount = scanStats.nodes || 0;
  const loaderBarDuration = nodeCount >= 10000 ? 28 : nodeCount >= 5000 ? 20 : nodeCount >= 2000 ? 14 : nodeCount >= 500 ? 9 : 6;
  const isLargeFile = nodeCount >= 3000;

  if (showFullPageLoader) return (
    <div className="p-8 h-[70vh] flex flex-col items-center justify-center text-center overflow-hidden">
      <style>{`
        @keyframes fill-bar {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
      <div className="text-4xl mb-6 animate-bounce">✨</div>
      <h3 className="text-xl font-black uppercase mb-4 leading-tight">{fullPageLoaderMsg}</h3>
      <div className="w-full max-w-sm h-4 border-2 border-black p-0.5 rounded-full bg-white">
         {isProtoLoader ? (
           <div
             className="h-full bg-[#ff90e8] rounded-full transition-[width] duration-500 ease-out"
             style={{ width: `${protoLoaderBarPercent}%` }}
           />
         ) : (
           <div
             className="h-full bg-[#ff90e8] rounded-full"
             style={{ animation: `fill-bar ${loaderBarDuration}s ease-in-out forwards` }}
           />
         )}
      </div>
    </div>
  );

  return (
    <div className="p-4 flex flex-col gap-4 pb-16 relative">
      {showConfetti && <Confetti />}
      {showSuccess && <SuccessModal score={score} onClose={() => setShowSuccess(false)} />}
      {showReceipt && (
          <ScanReceiptModal 
            nodeCount={scanStats.nodes}
            cost={scanStats.cost}
            sizeLabel={scanStats.sizeLabel}
            target={scanStats.target}
            onConfirm={handleConfirmScan} 
            onCancel={() => { pendingScanTypeRef.current = null; setShowReceipt(false); }} 
          />
      )}
      {confirmConfig && confirmConfig.isOpen && (
          <ConfirmationModal
            title={confirmConfig.title}
            message={confirmConfig.message}
            details={confirmConfig.details}
            onConfirm={confirmConfig.onConfirm}
            onCancel={() => { setConfirmConfig(null); setAuditFixError(null); }}
            confirmLabel={confirmConfig.confirmLabel}
            isWarning={confirmConfig.isWarning}
          />
      )}

      {auditFixError && (
        <div className="py-2 px-3 bg-red-100 border-2 border-red-500 text-red-800 text-[10px] font-bold uppercase">
          {auditFixError}
        </div>
      )}

      {((activeTab === 'DS' && dsAuditError && isFigmaConnectionError(dsAuditError)) || (activeTab === 'A11Y' && a11yAuditError && isFigmaConnectionError(a11yAuditError)) || (activeTab === 'UX' && uxAuditError && isFigmaConnectionError(uxAuditError))) && (
        <div className="py-2 px-3 bg-amber-100 border-2 border-amber-600 text-amber-900 text-[10px] font-bold uppercase flex flex-col gap-2">
          <span>Connection isn't complete. Try again in a moment.</span>
          {onRetryConnection && (
            <button type="button" onClick={onRetryConnection} className="w-fit py-1.5 px-3 bg-black text-white text-[10px] font-bold uppercase border-2 border-black hover:bg-gray-800">
              Retry
            </button>
          )}
        </div>
      )}

      {/* FEEDBACK MODAL OVERLAY */}
      {feedbackOpen && (
          <div onClick={() => setFeedbackOpen(false)} className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
              <div onClick={(e) => e.stopPropagation()} className={`${BRUTAL.card} max-w-sm w-full bg-white relative`}>
                  <button onClick={() => setFeedbackOpen(false)} className="absolute top-2 right-2 text-xl font-bold">×</button>
                  <h3 className="font-black uppercase text-sm mb-2 bg-black text-white inline-block px-1">
                      {feedbackType === 'DISCARD' ? 'Why was this not an error?' : 'What went wrong?'}
                  </h3>
                  <textarea 
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Describe context (min 2 words)..."
                    className="w-full border-2 border-black p-2 text-xs font-mono mb-2 min-h-[80px] bg-white text-black"
                  />
                  <div className="mb-4">
                      <p className="text-[10px] text-gray-500 leading-tight">
                          You accept to send data to improve the plugin quality and the <button onClick={() => setShowPrivacyModal(true)} className="underline cursor-pointer hover:text-black">Privacy & Policy</button>.
                      </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSubmitFeedback}
                    disabled={!canSubmitFeedback}
                    className="w-full bg-[#ff90e8] text-black border-2 border-black shadow-[4px_4px_0px_0px_#000] px-4 py-3 text-xs font-black uppercase disabled:bg-gray-200 disabled:cursor-not-allowed"
                  >
                    Send Feedback
                  </button>
              </div>
          </div>
      )}

      {/* PRIVACY MODAL OVERLAY */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-6" onClick={() => setShowPrivacyModal(false)}>
           <div className={`${BRUTAL.card} bg-white max-w-lg w-full relative`} onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowPrivacyModal(false)} className="absolute top-2 right-2 text-2xl font-bold">×</button>
              <h2 className="text-2xl font-black uppercase mb-4 bg-black text-white inline-block px-2">Privacy Policy</h2>
              <div className="space-y-4 text-xs leading-relaxed font-medium text-gray-700 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {PRIVACY_CONTENT.map((item, index) => (
                    <p key={index}>
                    <strong className="block text-black uppercase mb-1">{item.title}</strong>
                    {item.text}
                    </p>
                ))}
              </div>
           </div>
        </div>
      )}

      <div className="flex justify-center mb-2">
        <div className={`transform -rotate-2 border-2 border-black px-3 py-1 text-[10px] font-black uppercase shadow-[3px_3px_0_0_#000] ${knownZeroCredits ? 'bg-red-100 text-red-600' : 'bg-[#ffc900] text-black'}`}>
          Credits: {creditsDisplay}
        </div>
      </div>

      <div className="grid grid-cols-2 border-2 border-black bg-white shadow-[4px_4px_0_0_#000]">
        <button 
          onClick={() => { setActiveTab('DS'); setActiveCat(null); }}
          className={`py-2 text-[10px] font-black uppercase transition-colors border-b-2 border-black ${activeTab === 'DS' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
        >
          Design System
        </button>
        <button 
          onClick={() => { setActiveTab('A11Y'); setActiveCat(null); }}
          className={`py-2 text-[10px] font-black uppercase transition-colors border-l-2 border-b-2 border-black ${activeTab === 'A11Y' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
        >
          Accessibility
        </button>
        <button 
          onClick={() => { setActiveTab('UX'); setActiveCat(null); }}
          className={`py-2 text-[10px] font-black uppercase transition-colors ${activeTab === 'UX' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
        >
          UX Audit
        </button>
        <button 
          onClick={() => { setActiveTab('PROTOTYPE'); setActiveCat(null); }}
          className={`py-2 text-[10px] font-black uppercase transition-colors border-l-2 border-black ${activeTab === 'PROTOTYPE' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
        >
          Prototype
        </button>
      </div>

      {activeTab === 'DS' && (
        <DesignSystemTab 
            hasAudited={hasAudited}
            score={dsScore}
            lastAuditDate={lastAuditDate}
            categories={dsCategories}
            statusCopy={dsScoreCopy.status}
            targetCopy={dsScoreCopy.target}
            highSeverityCount={highSeverityCount}
            activeCat={activeCat}
            setActiveCat={setActiveCat}
            documentPages={documentPages}
            scanScope={scanScope}
            setScanScope={setScanScope}
            selectedPageId={selectedPageId}
            setSelectedPageId={setSelectedPageId}
            isScopeDropdownOpen={isScopeDropdownOpen}
            setIsScopeDropdownOpen={setIsScopeDropdownOpen}
            isPro={isPro}
            displayIssues={displayIssues}
            activeIssues={activeIssues}
            onStartScan={handleStartScan}
            onShare={handleShare}
            isCalculating={isCalculating}
            scanProgress={{ ...scanProgress, percent: Math.max(scanProgress.percent, fakeProgressPercent) }}
            issueListProps={issueListProps}
            dsAuditLoading={dsAuditLoading}
            dsAuditError={dsAuditError}
            dsAdvisory={dsAdvisory}
            dsLibraryContextHint={dsLibraryContextHint}
            specCoverageSummary={dsSpecCoverageSummary}
            readabilitySummary={dsReadabilitySummary}
            qualityGates={dsQualityGates}
            onRetryConnection={onRetryConnection}
            onCheckTokenStatus={onCheckTokenStatus}
            disableAllPages={false}
            canvasSelectionActive={canvasSelectionActive}
        />
      )}

      {activeTab === 'A11Y' && (
        <AccessibilityTab
            hasA11yResult={a11yAuditIssues !== null}
            score={a11yScore}
            lastAuditDate={lastA11yAuditDate}
            categories={a11yCategories}
            statusCopy={a11yScoreCopy.status}
            targetCopy={a11yScoreCopy.target}
            highSeverityCount={highSeverityCount}
            activeCat={activeCat}
            setActiveCat={setActiveCat}
            documentPages={documentPages}
            scanScope={scanScope}
            setScanScope={setScanScope}
            selectedPageId={selectedPageId}
            setSelectedPageId={setSelectedPageId}
            isScopeDropdownOpen={isScopeDropdownOpen}
            setIsScopeDropdownOpen={setIsScopeDropdownOpen}
            isPro={isPro}
            displayIssues={displayIssues}
            activeIssues={activeIssues}
            onRunA11yAudit={handleRunA11yAudit}
            isCalculating={isCalculating}
            scanProgress={{ ...scanProgress, percent: Math.max(scanProgress.percent, fakeProgressPercent) }}
            issueListProps={issueListProps}
            a11yAuditLoading={a11yAuditLoading}
            a11yAuditError={a11yAuditError}
            onRetryConnection={onRetryConnection}
            onCheckTokenStatus={onCheckTokenStatus}
            disableAllPages={true}
            canvasSelectionActive={canvasSelectionActive}
        />
      )}

      {activeTab === 'UX' && (
        <UxAuditTab
            hasUxResult={hasUxAudited}
            score={uxScore}
            lastAuditDate={lastUxAuditDate}
            categories={uxCategories}
            statusCopy={uxScoreCopy.status}
            targetCopy={uxScoreCopy.badge}
            highSeverityCount={highSeverityCount}
            activeCat={activeCat}
            setActiveCat={setActiveCat}
            documentPages={documentPages}
            scanScope={scanScope}
            setScanScope={setScanScope}
            selectedPageId={selectedPageId}
            setSelectedPageId={setSelectedPageId}
            isScopeDropdownOpen={isScopeDropdownOpen}
            setIsScopeDropdownOpen={setIsScopeDropdownOpen}
            isPro={isPro}
            displayIssues={displayIssues}
            activeIssues={activeIssues}
            onRunUxAudit={handleRunUxAudit}
            isCalculating={isCalculating}
            scanProgress={{ ...scanProgress, percent: Math.max(scanProgress.percent, fakeProgressPercent) }}
            issueListProps={issueListProps}
            uxAuditLoading={uxAuditLoading}
            uxAuditError={uxAuditError}
            onRetryConnection={onRetryConnection}
            onCheckTokenStatus={onCheckTokenStatus}
            canvasSelectionActive={canvasSelectionActive}
        />
      )}

      {activeTab === 'PROTOTYPE' && (
        <PrototypeAuditTab
          flowStartingPoints={flowStartingPoints}
          selectedFlowIds={selectedFlowIds}
          setSelectedFlowIds={setSelectedFlowIds}
          isFlowDropdownOpen={isFlowDropdownOpen}
          setIsFlowDropdownOpen={setIsFlowDropdownOpen}
          hasProtoResult={hasProtoAudited}
          score={protoScore}
          lastAuditDate={lastProtoAuditDate}
          categories={protoCategories}
          statusCopy={protoScoreCopy.status}
          highSeverityCount={highSeverityCount}
          activeCat={activeCat}
          setActiveCat={setActiveCat}
          isPro={isPro}
          displayIssues={displayIssues}
          activeIssues={activeIssues}
          onRunProtoAudit={handleRunProtoAudit}
          isCalculating={isCalculating}
          scanProgress={{ ...scanProgress, percent: Math.max(scanProgress.percent, fakeProgressPercent) }}
          issueListProps={issueListProps}
          protoAuditLoading={protoAuditLoading}
          protoAuditError={protoAuditError}
        />
      )}
    </div>
  );
};
