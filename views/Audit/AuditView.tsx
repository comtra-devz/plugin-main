
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BRUTAL, TIER_LIMITS, PRIVACY_CONTENT, getScanCostAndSize, getA11yCostAndSize, getPrototypeAuditCost, UX_AUDIT_CREDITS, COUNT_CAP } from '../../constants';
import { UserPlan, AuditIssue } from '../../types';
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
  fetchDsAudit?: (body: { file_key: string; depth?: number }) => Promise<{ issues: AuditIssue[] }>;
  /** A11Y Audit agent: fetch issues from backend (no Kimi). Called after confirm when fileKey is available. */
  fetchA11yAudit?: (body: { file_key: string; depth?: number }) => Promise<{ issues: AuditIssue[] }>;
  /** UX Audit agent: fetch issues from backend (Kimi). Called after confirm when fileKey/fileJson is available. */
  fetchUxAudit?: (body: { file_key?: string; file_json?: object; scope?: string; page_id?: string; node_ids?: string[]; page_ids?: string[] }) => Promise<{ issues: AuditIssue[] }>;
}

type AuditTab = 'DS' | 'A11Y' | 'UX' | 'PROTOTYPE';

import { getSystemToastOptions, isFileNotSavedError, isFigmaConnectionError } from '../../lib/errorCopy';

export const Audit: React.FC<Props> = ({ plan, userTier, onUnlockRequest, onRetryConnection, onCheckTokenStatus, tokenVerifiedAt, creditsRemaining, useInfiniteCreditsForTest, estimateCredits, consumeCredits, onNavigateToGenerate, fetchFigmaFile, fetchDsAudit, fetchA11yAudit, fetchUxAudit }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<AuditTab>('DS');
  const [hasAudited, setHasAudited] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0]);
  const [a11yLoaderMsg, setA11yLoaderMsg] = useState(A11Y_LOADING_MSGS[0]);
  
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
  const [scanProgress, setScanProgress] = useState({ percent: 0, count: 0 });
  const [fakeProgressPercent, setFakeProgressPercent] = useState(0);
  const fakeProgressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Component Deviation Navigator State
  const [deviationNavIndex, setDeviationNavIndex] = useState<{ [issueId: string]: number }>({});
  const [layerSelectionFeedback, setLayerSelectionFeedback] = useState<string | null>(null);
  /** When user clicks Auto-Fix on a contrast issue we request a preview; this holds pending data until we get the response. */
  const pendingContrastFixRef = useRef<{ issueId: string; layerId: string; cost: number } | null>(null);

  // Pending confirm scan: after user confirms we request file context, then in message handler we consume + fetch file
  const confirmPayloadRef = useRef<{ cost: number; score: number; pendingScanType: 'MAIN' | 'DEEP' | 'A11Y' | 'UX' } | null>(null);
  const chunkedRef = useRef<{ totalChunks: number; meta: Record<string, unknown>; chunks: Record<number, string> } | null>(null);
  // Ref so "Authorize" always sees the scan type that was set when the receipt was shown (avoids stale closure)
  const pendingScanTypeRef = useRef<'MAIN' | 'DEEP' | 'A11Y' | null>(null);
  // DS Audit agent: real issues from backend (Kimi)
  const [dsAuditIssues, setDsAuditIssues] = useState<AuditIssue[] | null>(null);
  const [dsAuditLoading, setDsAuditLoading] = useState(false);
  const [dsAuditError, setDsAuditError] = useState<string | null>(null);
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

  /** One surface per error: file not saved = banner only; connection/Figma = toast only; others = toast only (no duplicate banner). */
  const showAuditError = useCallback(
    (message: string, isA11y: boolean, isUx?: boolean) => {
      setPendingScanType(null);
      setWaitingForFileContext(false);
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
          return;
        }
        setDsAuditError(null);
        setDsAuditIssues(null);
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
      const opts = /timeout|504|timed out/i.test(message)
        ? getSystemToastOptions('audit_timed_out')
        : getSystemToastOptions('audit_couldnt_start');
      showToast({
        ...opts,
        dismissible: true,
        actions: onRetryConnection ? [{ label: opts.ctaLabel ?? 'Retry', onClick: onRetryConnection }] : [],
      });
    },
    [showToast, onRetryConnection]
  );

  const isPro = plan === 'PRO';
  const infiniteForTest = !!useInfiniteCreditsForTest;
  const remaining = infiniteForTest || isPro ? Infinity : (creditsRemaining === null ? Infinity : creditsRemaining);
  const creditsDisplay = infiniteForTest || isPro ? '∞' : (creditsRemaining === null ? '—' : `${creditsRemaining}`);
  const knownZeroCredits = !infiniteForTest && !isPro && creditsRemaining !== null && creditsRemaining <= 0;

  // A11Y: filter by scope (all vs page) when we have results
  const a11yIssuesRaw = a11yAuditIssues != null ? a11yAuditIssues : A11Y_ISSUES;
  const selectedPageName = scanScope === 'page' && selectedPageId ? documentPages.find(p => p.id === selectedPageId)?.name : null;
  const a11yIssuesScoped = activeTab === 'A11Y' && a11yAuditIssues != null && selectedPageName
    ? a11yAuditIssues.filter(i => i.pageName === selectedPageName)
    : activeTab === 'A11Y' ? a11yIssuesRaw : [];

  // Determine which issue set to use (DS / A11Y use real issues from agent when available)
  let currentIssues = activeTab === 'DS' && dsAuditIssues != null ? dsAuditIssues : DS_ISSUES;
  if (activeTab === 'A11Y') currentIssues = a11yAuditIssues != null ? (selectedPageName ? a11yIssuesScoped : a11yAuditIssues) : A11Y_ISSUES;
  if (activeTab === 'UX') currentIssues = hasUxAudited && uxAuditIssues != null ? uxAuditIssues : [];
  if (activeTab === 'PROTOTYPE') currentIssues = hasProtoAudited && protoAuditIssues ? protoAuditIssues : [];

  // Filter out excluded pages (categories and list both use this base)
  const filteredIssues = currentIssues.filter(i => !i.pageName || !excludedPages.includes(i.pageName));
  // A11Y: apply WCAG filter only to the list; categories always show full counts
  const listIssues =
    activeTab === 'A11Y' && wcagLevelFilter === 'AA'
      ? filteredIssues.filter(i => i.wcag_level !== 'AAA')
      : filteredIssues;
  const activeIssues = activeCat ? listIssues.filter(i => i.categoryId === activeCat) : listIssues;
  const displayIssues = isPro ? activeIssues : activeIssues.slice(0, 6);
  const totalHiddenCount = isPro ? 0 : Math.max(0, activeIssues.length - 6);

  // DS tab: dynamic categories, score from full issue set (so changing scope doesn't change score until next scan)
  const dsCategories = activeTab === 'DS' ? buildDsCategoriesFromIssues(filteredIssues) : [];
  const dsFullForScore = activeTab === 'DS' && dsAuditIssues != null
    ? dsAuditIssues.filter(i => !i.pageName || !excludedPages.includes(i.pageName)).filter(i => !fixedIds.has(i.id) && !discardedIds.has(i.id))
    : filteredIssues.filter(i => !fixedIds.has(i.id) && !discardedIds.has(i.id));
  const dsScore = activeTab === 'DS' ? computeDsScoreFromIssues(dsFullForScore) : score;
  const dsScoreCopy = activeTab === 'DS' ? getDsScoreCopy(dsScore) : { status: '', target: '' };

  // A11Y tab: categories from full filtered set (ignore AA/AAA filter so totals stay fixed)
  const a11yFullForScore = activeTab === 'A11Y' && a11yAuditIssues != null
    ? a11yAuditIssues.filter(i => !i.pageName || !excludedPages.includes(i.pageName)).filter(i => !fixedIds.has(i.id) && !discardedIds.has(i.id))
    : [];
  const a11yScore = activeTab === 'A11Y' ? (a11yAuditIssues != null ? computeDsScoreFromIssues(a11yFullForScore) : 100) : 100;
  const a11yCategories = activeTab === 'A11Y' ? buildA11yCategoriesFromIssues(filteredIssues) : [];
  const a11yScoreCopy = activeTab === 'A11Y' ? getDsScoreCopy(a11yScore) : { status: '', target: '' };

  // UX tab: categories and score from UX Logic ruleset (no scope / no "All Pages")
  const uxCategories = activeTab === 'UX' ? buildUxCategoriesFromIssues(filteredIssues) : [];
  const uxScore = activeTab === 'UX' ? computeUxHealthScoreFromIssues(filteredIssues) : 100;
  const uxScoreCopy = activeTab === 'UX' ? getUxScoreCopy(uxScore) : { badge: 'EXCELLENT' as const, status: '' };

  // Prototype tab: categories and score from Prototype audit result
  const protoCategories = activeTab === 'PROTOTYPE' ? buildPrototypeCategoriesFromIssues(filteredIssues) : [];
  const protoScore = activeTab === 'PROTOTYPE' ? computePrototypeHealthScoreFromIssues(filteredIssues) : 100;
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

  // Fetch document pages after first paint so mount stays snappy (get-pages is light; no traversal).
  useEffect(() => {
    const t = requestAnimationFrame(() => {
      window.parent.postMessage({ pluginMessage: { type: 'get-pages' } }, '*');
    });
    return () => cancelAnimationFrame(t);
  }, []);

  // Fetch flow starting points when Prototype tab is active (current page only).
  useEffect(() => {
    if (activeTab === 'PROTOTYPE') {
      window.parent.postMessage({ pluginMessage: { type: 'get-flow-starting-points' } }, '*');
    }
  }, [activeTab]);

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
      if (msg.type === 'pages-result' && msg.pages) {
        setDocumentPages(msg.pages);
        setSelectedPageId((prev) => (prev ? prev : msg.pages[0]?.id ?? null));
      }
      if (msg.type === 'flow-starting-points-result' && Array.isArray(msg.flows)) {
        setFlowStartingPoints(msg.flows);
      }
      if (msg.type === 'proto-audit-result') {
        const issues = Array.isArray(msg.issues) ? msg.issues as AuditIssue[] : [];
        const err = msg.error as string | undefined;
        setProtoAuditIssues(issues);
        setProtoAuditLoading(false);
        setScanProgress({ percent: 100, count: 0 });
        setTimeout(() => setIsCalculating(false), 200);
        if (err) {
          setProtoAuditError(err);
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
          const preview = msg.preview as { source: string; message: string; variableId?: string; styleId?: string; r?: number; g?: number; b?: number } | null;
          const err = msg.error as string | undefined;
          if (err || !preview) {
            setAuditFixError(err || 'Could not get fix suggestion.');
            pendingContrastFixRef.current = null;
            return;
          }
          const cost = pending.cost;
          setConfirmConfig({
            isOpen: true,
            title: 'Confirm Auto-Fix',
            message: `${preview.message}\n\nConsume ${cost} credit${cost !== 1 ? 's' : ''}?`,
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
              pendingContrastFixRef.current = null;
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
          pendingContrastFixRef.current = null;
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
        setWaitingForFileContext(false);
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
        const auditBody = hasFileJson
          ? { file_json: msg.fileJson as object }
          : {
              file_key: msg.fileKey as string,
              scope: msg.scope ?? 'all',
              page_id: msg.pageId ?? undefined,
              node_ids: Array.isArray(msg.nodeIds) ? msg.nodeIds : undefined,
              page_ids: Array.isArray(msg.pageIds) ? msg.pageIds : undefined,
            };

        const setAuditError = (message: string) => {
          showAuditError(message, isA11yScan, isUxScan);
        };

        (async () => {
          try {
            if (!useInfiniteCreditsForTest && !isPro && payload.cost > 0) {
              const result = await consumeCredits({
                action_type: isUxScan ? 'ux_audit' : isA11yScan ? 'a11y_audit' : 'audit',
                credits_consumed: payload.cost,
                max_health_score: payload.score,
              });
              if (result.error === 'Insufficient credits') {
                onUnlockRequest();
                setWaitingForFileContext(false);
                return;
              }
              if (result.error) {
                setAuditError(result.error);
                return;
              }
            }
            setShowReceipt(false);
            if (isUxScan) {
              if (!fetchUxAudit) {
                setAuditError('Audit not available');
                return;
              }
              setUxAuditError(null);
              setUxAuditLoading(true);
              const data = await fetchUxAudit(auditBody);
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
              setA11yAuditIssues(Array.isArray(data?.issues) ? data.issues : []);
              setLastA11yAuditDate(new Date());
            } else if (fetchDsAudit) {
              setDsAuditError(null);
              setDsAuditLoading(true);
              const data = await fetchDsAudit(auditBody);
              setDsAuditIssues(Array.isArray(data?.issues) ? data.issues : []);
            } else {
              setAuditError('Audit not available');
              return;
            }
            if (payload.pendingScanType === 'MAIN') setIsScanning(true);
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
    const cost = UX_AUDIT_CREDITS;
    setConfirmConfig({
      isOpen: true,
      title: 'Run UX Audit',
      message: `This audit will use ${cost} credit${cost !== 1 ? 's' : ''}. Continue?`,
      confirmLabel: `Run (-${cost} credit${cost !== 1 ? 's' : ''})`,
      onConfirm: () => {
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
      confirmLabel: `Run (-${cost} credit${cost !== 1 ? 's' : ''})`,
      onConfirm: () => {
        setConfirmConfig(null);
        setProtoAuditError(null);
        setProtoAuditLoading(true);
        setIsCalculating(true);
        setScanProgress({ percent: 0, count: 0 });
        const start = Date.now();
        const tick = () => {
          const elapsed = Date.now() - start;
          const pct = Math.min(90, Math.floor((elapsed / 1500) * 90));
          setScanProgress(prev => ({ ...prev, percent: pct }));
          if (pct < 90) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
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

    if (issue?.categoryId === 'contrast' && layerId) {
      pendingContrastFixRef.current = { issueId: id, layerId, cost };
      window.parent.postMessage({ pluginMessage: { type: 'get-contrast-fix-preview', layerId } }, '*');
      return;
    }

    setConfirmConfig({
        isOpen: true,
        title: "Confirm Auto-Fix",
        message: `This action will apply changes to your layer and consume ${cost} credit${cost !== 1 ? 's' : ''}. Are you sure?`,
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
      const unfixed = activeIssues.filter(i => !fixedIds.has(i.id) && i.id !== 'p2' && !discardedIds.has(i.id)); 
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
          } else if (feedbackType === 'BAD_FIX') {
              const newSent = new Set(feedbackSentIds);
              newSent.add(feedbackTargetId);
              setFeedbackSentIds(newSent);
          }
      }
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
      setFeedbackOpen(false);
  };

  const handleSelectLayer = (e: React.MouseEvent, layerId: string) => {
    e.stopPropagation();
    setLayerSelectionFeedback(layerId);
    setTimeout(() => setLayerSelectionFeedback(null), 2000);
    window.parent.postMessage({ pluginMessage: { type: 'select-layer', layerId } }, '*');
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
    onNavDeviation: handleNavDeviation,
    onFixAll: handleFixAll,
    onUnlockRequest: onUnlockRequest,
    totalHiddenCount: totalHiddenCount,
    wcagLevelFilter,
    setWcagLevelFilter,
  };

  const wordCount = feedbackText.trim().split(/\s+/).filter(w => w.length > 0).length;
  const canSubmitFeedback = wordCount >= 2;

  // Full-page loader only after Authorize (not during first scan / count nodes). DS: isScanning. A11Y: waitingForFileContext + a11yAuditLoading. UX: waitingForFileContext + uxAuditLoading.
  const showFullPageLoader = isScanning || waitingForFileContext || (activeTab === 'A11Y' && a11yAuditLoading) || (activeTab === 'UX' && uxAuditLoading);
  const fullPageLoaderMsg = isA11yLoader ? a11yLoaderMsg : loadingMsg;
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
         <div 
           className="h-full bg-[#ff90e8] rounded-full" 
           style={{ animation: `fill-bar ${loaderBarDuration}s ease-in-out forwards` }}
         />
      </div>
      {isLargeFile && (
        <p className="mt-4 text-xs font-medium text-gray-600 max-w-xs">
          Large file — analysis may take a minute or more.
        </p>
      )}
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
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={handleSubmitFeedback}
                    disabled={!canSubmitFeedback}
                  >
                    Send Feedback
                  </Button>
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
            onRetryConnection={onRetryConnection}
            onCheckTokenStatus={onCheckTokenStatus}
            disableAllPages={false}
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
