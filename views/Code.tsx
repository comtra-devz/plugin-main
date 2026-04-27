
import React, { useState, useEffect, useRef } from 'react';
import { UserPlan } from '../types';
import { Confetti } from '../components/Confetti.tsx';
import { TokensTab } from './Code/tabs/TokensTab.tsx';
import { TargetTab } from './Code/tabs/TargetTab.tsx';
import { SyncTab } from './Code/tabs/SyncTab.tsx';
import { LevelUpModal } from '../components/LevelUpModal.tsx';
import {
  buildTokenForestFromFigmaPayload,
  tokenForestToCSS,
  tokenForestToDTCG,
  type FigmaDesignTokensPayload
} from '../services/tokenGeneration';
import { getSystemToastOptions } from '../lib/errorCopy';
import { SyncScanRateLimitedError } from '../lib/syncScanRateLimitedError';
import { isLikelyNetworkOrCorsFetchFailure } from '../lib/pluginFetchErrors';
import type { SyncSnapshot } from '../types';
import type {
  SourceConnection,
  SourceConnectionInput,
  SourceProvider,
  SourceScanResult,
  SyncLinkedFileOption,
  StorybookConnectionInfo,
  SyncDriftItem,
} from './Code/types';
import { collectSubtreeNodeIds, exportLocalDeepCode } from '../services/localDeepCodeExport';

interface Props {
  plan: UserPlan;
  userTier?: string;
  onUnlockRequest: () => void;
  creditsRemaining: number | null;
  useInfiniteCreditsForTest?: boolean;
  estimateCredits: (payload: { action_type: string; node_count?: number }) => Promise<{ estimated_credits: number }>;
  consumeCredits: (payload: { action_type: string; credits_consumed: number; file_id?: string }) => Promise<{ credits_remaining?: number; error?: string }>;
  /** Log free (0-credit) actions into activity stream (credit_transactions) without touching balance. */
  logFreeAction?: (actionType: string) => Promise<void>;
  fetchSyncScan?: (body: {
    sync_snapshot?: SyncSnapshot;
    file_key?: string;
    file_json?: object;
    storybook_url: string;
    storybook_token?: string;
    scope?: string;
    page_id?: string;
    page_ids?: string[];
  }) => Promise<{
    items: SyncDriftItem[];
    connectionStatus?: string;
  }>;
  fetchCheckStorybook?: (url: string, token?: string) => Promise<{ ok: boolean; error?: string } & StorybookConnectionInfo>;
  fetchSourceConnection?: (q: { figmaFileKey: string; storybookUrl: string }) => Promise<SourceConnection | null>;
  fetchSyncScanCache?: (q: { figmaFileKey: string; storybookUrl: string }) => Promise<{ items: SyncDriftItem[]; scannedAt?: string | null } | null>;
  saveSourceConnection?: (body: SourceConnectionInput & {
    figmaFileKey: string;
    storybookUrl: string;
    scan?: SourceScanResult | null;
  }) => Promise<SourceConnection>;
  deleteSourceConnection?: (q: { figmaFileKey: string; storybookUrl: string }) => Promise<boolean>;
  scanSourceConnection?: (body: SourceConnectionInput) => Promise<SourceScanResult>;
  startSourceAuth?: (provider: SourceProvider) => Promise<{ ok: boolean; url?: string | null; error?: string }>;
  /** POST /api/agents/code-gen — subtree from plugin + format → code */
  fetchCodeGen?: (body: {
    format: string;
    node_json: object;
    file_key?: string | null;
    storybook_context?: {
      storybook_base_url?: string;
      matched_layers?: Array<{ figma_layer_id?: string | null; name: string; note?: string }>;
    };
  }) => Promise<{ code?: string; error?: string; component_name?: string }>;
  onNavigateToStats?: () => void;
  /** Selezione canvas Figma (automatica). */
  selectedNode?: { id: string; name: string; type: string } | null;
}

const SYNC_ITEMS_MOCK = [
  { id: 'c1', name: 'Primary Button', status: 'DRIFT', lastEdited: '2h ago', desc: 'Padding inconsistency: Figma 12px vs Code 16px' },
  { id: 'c2', name: 'Input Field', status: 'DRIFT', lastEdited: '5h ago', desc: 'Missing focus state definition in Figma' },
  { id: 'c3', name: 'Navbar', status: 'DRIFT', lastEdited: '1d ago', desc: 'Color token mismatch: primary-500 vs primary-600' },
];

const COOLDOWN_MS = 120000; // 2 Minutes
const SYNC_LINKED_FILES_KEY = 'comtra-sync-linked-files-v1';
const SYNC_LAST_SCAN_BY_FILE_KEY = 'comtra-sync-last-scan-by-file-v1';

type SyncCachedResult = {
  syncItems: SyncDriftItem[];
  scannedAt: string;
};

const canonicalStorybookUrl = (url: string) => String(url || '').trim().replace(/\/+$/g, '').toLowerCase();

const buildSyncCacheKey = (fileKey: string, storybookUrl: string) =>
  `comtra-sync-scan-cache:${fileKey}:${canonicalStorybookUrl(storybookUrl)}`;

const buildLegacySyncCacheKey = (fileKey: string, storybookUrl: string) =>
  `comtra-sync-scan-cache:${fileKey}:${String(storybookUrl || '').trim()}`;

const readSyncCachePayload = (
  fileKey: string,
  storybookUrl: string,
): SyncCachedResult | null => {
  const keys = [
    buildSyncCacheKey(fileKey, storybookUrl),
    buildLegacySyncCacheKey(fileKey, storybookUrl),
    buildLegacySyncCacheKey(fileKey, `${storybookUrl}/`),
  ];
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as SyncCachedResult;
      if (Array.isArray(parsed?.syncItems)) return parsed;
    } catch {
      // continue
    }
  }
  return null;
};

const writeLastScanByFile = (fileKey: string, storybookUrl: string, payload: SyncCachedResult) => {
  try {
    const raw = localStorage.getItem(SYNC_LAST_SCAN_BY_FILE_KEY);
    const obj = raw ? (JSON.parse(raw) as Record<string, { storybookUrl: string; payload: SyncCachedResult }>) : {};
    obj[fileKey] = { storybookUrl: canonicalStorybookUrl(storybookUrl), payload };
    localStorage.setItem(SYNC_LAST_SCAN_BY_FILE_KEY, JSON.stringify(obj));
  } catch {
    // noop
  }
};

const readLastScanByFile = (fileKey: string): { storybookUrl: string; payload: SyncCachedResult } | null => {
  try {
    const raw = localStorage.getItem(SYNC_LAST_SCAN_BY_FILE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Record<string, { storybookUrl: string; payload: SyncCachedResult }>;
    const hit = obj[fileKey];
    if (!hit || !Array.isArray(hit?.payload?.syncItems)) return null;
    return hit;
  } catch {
    return null;
  }
};

const readSyncLinkedFiles = (): SyncLinkedFileOption[] => {
  try {
    const raw = localStorage.getItem(SYNC_LINKED_FILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x === 'object')
      .map((x) => ({
        fileKey: String((x as any).fileKey || ''),
        fileName: String((x as any).fileName || 'Untitled file'),
        storybookUrl: String((x as any).storybookUrl || ''),
        lastUsedAt: String((x as any).lastUsedAt || new Date().toISOString()),
      }))
      .filter((x) => x.fileKey && x.storybookUrl);
  } catch {
    return [];
  }
};

const writeSyncLinkedFiles = (items: SyncLinkedFileOption[]) => {
  try {
    localStorage.setItem(SYNC_LINKED_FILES_KEY, JSON.stringify(items.slice(0, 40)));
  } catch {
    /* noop */
  }
};

const upsertSyncLinkedFile = (item: SyncLinkedFileOption) => {
  const list = readSyncLinkedFiles();
  const nextItem = {
    ...item,
    storybookUrl: canonicalStorybookUrl(item.storybookUrl),
  };
  const next = [
    nextItem,
    ...list.filter((x) => !(x.fileKey === nextItem.fileKey && canonicalStorybookUrl(x.storybookUrl) === nextItem.storybookUrl)),
  ];
  writeSyncLinkedFiles(next);
  return next;
};

type Tab = 'TOKENS' | 'TARGET' | 'SYNC';

export const Code: React.FC<Props> = ({ plan, userTier, onUnlockRequest, creditsRemaining, useInfiniteCreditsForTest, estimateCredits, consumeCredits, logFreeAction, fetchSyncScan, fetchCheckStorybook, fetchSourceConnection, fetchSyncScanCache, saveSourceConnection, deleteSourceConnection, scanSourceConnection, startSourceAuth, fetchCodeGen, onNavigateToStats, selectedNode }) => {
  const [activeTab, setActiveTab] = useState<Tab>('TOKENS');
  
  // Cooldown State
  const [cooldowns, setCooldowns] = useState<{ [key: string]: number }>({});
  const [now, setNow] = useState(Date.now());

  // Target: selezione automatica da Figma (selectedNode)
  const selectedLayer = selectedNode?.name ?? null;

  // Reset sync + output generato quando cambia la selezione
  useEffect(() => {
    setLastSyncedComp(null);
    setGeneratedCode(null);
  }, [selectedNode?.id]);
  const [lang, setLang] = useState('REACT');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncingComp, setIsSyncingComp] = useState(false);
  const [lastSyncedComp, setLastSyncedComp] = useState<Date | null>(null);
  
  // Tokens / CSS State
  const [isSyncingTokens, setIsSyncingTokens] = useState(false);
  
  // Dual Timestamp Logic for Tokens Tab
  const [lastGeneratedCssDate, setLastGeneratedCssDate] = useState<Date | null>(null);
  const [lastSyncedStorybookDate, setLastSyncedStorybookDate] = useState<Date | null>(null);
  
  const [tokenSyncSource, setTokenSyncSource] = useState<'Storybook' | 'GitHub' | 'Bitbucket' | null>(null);
  const [generatedCss, setGeneratedCss] = useState<string | null>(null);
  const [isGeneratingCss, setIsGeneratingCss] = useState(false);
  const [copiedCss, setCopiedCss] = useState(false);

  // JSON State
  const [generatedJson, setGeneratedJson] = useState<string | null>(null);
  const [isGeneratingJson, setIsGeneratingJson] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [lastGeneratedJsonDate, setLastGeneratedJsonDate] = useState<Date | null>(null);
  
  // Deep Sync State
  const [activeSyncTab, setActiveSyncTab] = useState<'SB' | 'GH' | 'BB'>('SB');
  const [isSbConnected, setIsSbConnected] = useState(false);
  const [storybookUrl, setStorybookUrl] = useState<string | null>(null);
  const [storybookToken, setStorybookToken] = useState<string | null>(null);
  const [storybookConnectionInfo, setStorybookConnectionInfo] = useState<StorybookConnectionInfo | null>(null);
  const [isSyncScanning, setIsSyncScanning] = useState(false);
  const [syncItems, setSyncItems] = useState<typeof SYNC_ITEMS_MOCK>([]);
  const [syncScanError, setSyncScanError] = useState<string | null>(null);
  const [syncScanUpgradeUrl, setSyncScanUpgradeUrl] = useState<string | null>(null);
  const [hasSyncScanned, setHasSyncScanned] = useState(false);
  const [syncFileKey, setSyncFileKey] = useState<string | null>(null);
  const [syncFileName, setSyncFileName] = useState<string | null>(null);
  const [syncLinkedFiles, setSyncLinkedFiles] = useState<SyncLinkedFileOption[]>(() => readSyncLinkedFiles());
  const [rememberedStorybooksForFile, setRememberedStorybooksForFile] = useState<string[]>([]);
  const [sourceConnection, setSourceConnection] = useState<SourceConnection | null>(null);
  const [sourceConnectionLoading, setSourceConnectionLoading] = useState(false);
  const [sourceConnectionSaving, setSourceConnectionSaving] = useState(false);
  const [sourceConnectionError, setSourceConnectionError] = useState<string | null>(null);
  const [sourceAuthStartUrl, setSourceAuthStartUrl] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [lastSyncAllDate, setLastSyncAllDate] = useState<Date | null>(null);
  const [expandedDriftId, setExpandedDriftId] = useState<string | null>(null);
  const [layerSelectionFeedback, setLayerSelectionFeedback] = useState<string | null>(null);

  // Level Up State
  const [showLevelUp, setShowLevelUp] = useState(false);

  // Token generation: pending request type for design-tokens-result handler
  const pendingTokenRequestRef = useRef<'css' | 'json' | null>(null);
  // Sync scan: waiting for sync-snapshot-result from plugin
  const pendingSyncScanRef = useRef(false);
  const pendingSyncScanTimeoutRef = useRef<number | null>(null);
  const pendingFileContextRef = useRef<((v: { fileKey: string | null; fileName: string | null }) => void) | null>(null);
  const pendingSnapshotFileRef = useRef<((v: { fileKey: string | null; fileName: string | null }) => void) | null>(null);
  const pendingSyncActionRef = useRef(new Map<string, (v: { ok: boolean; itemId?: string; error?: string; message?: string }) => void>());
  const pendingCodeGenRef = useRef<((v: { root?: unknown; error?: string; fileKey?: string | null }) => void) | null>(null);

  const isPro = plan === 'PRO';
  const isAnnual = userTier === '1y';
  const infiniteForTest = !!useInfiniteCreditsForTest;
  const remaining = infiniteForTest || isPro ? Infinity : (creditsRemaining === null ? Infinity : creditsRemaining);
  const canUseFeature = isPro || remaining > 0;
  const creditsDisplay = infiniteForTest || isPro ? '∞' : (creditsRemaining === null ? '—' : `${creditsRemaining}`);
  const knownZeroCredits = !infiniteForTest && !isPro && creditsRemaining !== null && creditsRemaining <= 0;

  // Calculated State for Tokens Sync Status
  // If Storybook date is newer or equal to CSS/JSON date, we are synced.
  const isTokensSynced = lastSyncedStorybookDate && lastGeneratedCssDate && lastSyncedStorybookDate >= lastGeneratedCssDate;
  const isJsonSynced = lastSyncedStorybookDate && lastGeneratedJsonDate && lastSyncedStorybookDate >= lastGeneratedJsonDate;

  // Timer Tick
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for file-context (sync scan) and design-tokens-result
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage ?? event.data;
      if (!msg?.type) return;

      if (msg.type === 'code-gen-subtree-result') {
        const cb = pendingCodeGenRef.current;
        pendingCodeGenRef.current = null;
        cb?.({
          root: msg.root,
          error: msg.error != null ? String(msg.error) : undefined,
          fileKey: msg.fileKey != null ? msg.fileKey : null,
        });
        return;
      }
      if (msg.type === 'file-context-result' && pendingFileContextRef.current) {
        const cb = pendingFileContextRef.current;
        pendingFileContextRef.current = null;
        cb({
          fileKey: msg.fileKey ? String(msg.fileKey) : null,
          fileName: msg.fileName ? String(msg.fileName) : null,
        });
        return;
      }
      if (msg.type === 'sync-snapshot-result' && pendingSnapshotFileRef.current && !pendingSyncScanRef.current) {
        const cb = pendingSnapshotFileRef.current;
        pendingSnapshotFileRef.current = null;
        const snap = msg.sync_snapshot as SyncSnapshot | undefined;
        cb({
          fileKey: snap?.fileKey ? String(snap.fileKey) : null,
          fileName: snap?.fileName ? String(snap.fileName) : null,
        });
        return;
      }

      if (msg.type === 'sync-drift-action-result') {
        const requestId = String(msg.requestId || '');
        const cb = pendingSyncActionRef.current.get(requestId);
        if (cb) {
          pendingSyncActionRef.current.delete(requestId);
          cb({
            ok: msg.ok === true,
            itemId: msg.itemId ? String(msg.itemId) : undefined,
            error: msg.error ? String(msg.error) : undefined,
            message: msg.message ? String(msg.message) : undefined,
          });
        }
        return;
      }

      // --- Sync Scan: plugin-built sync_snapshot (no full file JSON, no backend Figma REST) ---
      if (msg.type === 'sync-snapshot-result' && pendingSyncScanRef.current) {
        pendingSyncScanRef.current = false;
        clearPendingSyncScanTimeout();
        if (msg.error) {
          setSyncScanError(String(msg.error));
          setSyncScanUpgradeUrl(null);
          setSyncItems([]);
          setIsSyncScanning(false);
          return;
        }
        const snap = msg.sync_snapshot as SyncSnapshot | undefined;
        const hasDesignEntries =
          (Array.isArray(snap?.components) && snap.components.length > 0) ||
          (Array.isArray(snap?.instances) && snap.instances.length > 0);
        if (!snap || !hasDesignEntries) {
          const opts = getSystemToastOptions('file_link_unavailable');
          setSyncScanError(opts.description ?? opts.title);
          setSyncScanUpgradeUrl(null);
          setSyncItems([]);
          setIsSyncScanning(false);
          return;
        }
        setSyncFileKey(typeof snap.fileKey === 'string' && snap.fileKey.trim() ? snap.fileKey.trim() : null);
        (async () => {
          if (!fetchSyncScan || !storybookUrl) {
            setIsSyncScanning(false);
            return;
          }
          try {
            const result = await fetchSyncScan({
              sync_snapshot: snap,
              storybook_url: storybookUrl,
              storybook_token: storybookToken ?? undefined,
            });
            setSyncItems(result.items || []);
            setHasSyncScanned(true);
            setSyncScanError(null);
            setSyncScanUpgradeUrl(null);
            if (snap.fileKey && storybookUrl) {
              try {
                const payload: SyncCachedResult = { syncItems: result.items || [], scannedAt: new Date().toISOString() };
                localStorage.setItem(buildSyncCacheKey(String(snap.fileKey), storybookUrl), JSON.stringify(payload));
                writeLastScanByFile(String(snap.fileKey), storybookUrl, payload);
              } catch {
                /* noop */
              }
            }
            startCooldown('scan_sync');
            setShowLevelUp(true);
          } catch (err) {
            if (err instanceof SyncScanRateLimitedError) {
              const sec = err.retryAfterSec;
              const mins =
                sec != null && Number.isFinite(sec) ? Math.max(1, Math.ceil(sec / 60)) : null;
              setSyncScanError(
                mins != null
                  ? `Figma has rate-limited this request. Please retry in ${mins} minute${mins === 1 ? '' : 's'}.`
                  : 'Figma has rate-limited this request. Please retry in a few minutes.',
              );
              setSyncScanUpgradeUrl(err.upgradeUrl && err.upgradeUrl.trim() ? err.upgradeUrl.trim() : null);
            } else {
              setSyncScanError(err instanceof Error ? err.message : 'Sync scan failed');
              setSyncScanUpgradeUrl(null);
            }
            setSyncItems([]);
          } finally {
            setIsSyncScanning(false);
          }
        })();
        return;
      }

      if (msg.type === 'design-tokens-result') {
        const payload = msg.payload as FigmaDesignTokensPayload;
        const pending = pendingTokenRequestRef.current;
        pendingTokenRequestRef.current = null;
        try {
          const forest = buildTokenForestFromFigmaPayload(payload);
          const fileKey = payload.fileKey ?? undefined;
          if (pending === 'css') {
            const css = tokenForestToCSS(forest, { fileKey });
            setGeneratedCss(css);
            setLastGeneratedCssDate(new Date());
            startCooldown('css_update');
          } else if (pending === 'json') {
            const dtcg = tokenForestToDTCG(forest, { fileKey });
            setGeneratedJson(JSON.stringify(dtcg, null, 2));
            setLastGeneratedJsonDate(new Date());
            startCooldown('json_update');
          }
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          if (pending === 'css') setGeneratedCss(`/* Error: ${errMsg} */\n:root {\n  /* No tokens generated */\n}`);
          if (pending === 'json') setGeneratedJson(JSON.stringify({ $schema: 'https://www.designtokens.org/schemas/2025.10/format.json', error: errMsg }, null, 2));
        }
        setIsGeneratingCss(false);
        setIsGeneratingJson(false);
      } else if (msg.type === 'design-tokens-error') {
        pendingTokenRequestRef.current = null;
        setIsGeneratingCss(false);
        setIsGeneratingJson(false);
        const errMsg = msg.error ?? 'Failed to read variables';
        setGeneratedCss(prev => prev ?? `/* Error: ${errMsg} */\n:root {}`);
        setGeneratedJson(prev => prev ?? JSON.stringify({ error: errMsg }, null, 2));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [storybookUrl, storybookToken, fetchSyncScan]);

  const requestCurrentFileContext = () =>
    new Promise<{ fileKey: string | null; fileName: string | null }>((resolve) => {
      let settled = false;
      const t = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        pendingFileContextRef.current = null;
        resolve({ fileKey: null, fileName: null });
      }, 12000);
      pendingFileContextRef.current = (v) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(t);
        resolve(v);
      };
      window.parent.postMessage({ pluginMessage: { type: 'get-file-context', scope: 'all' } }, '*');
    });

  const requestFileFromSyncSnapshot = () =>
    new Promise<{ fileKey: string | null; fileName: string | null }>((resolve) => {
      let settled = false;
      const t = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        pendingSnapshotFileRef.current = null;
        resolve({ fileKey: null, fileName: null });
      }, 12000);
      pendingSnapshotFileRef.current = (v) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(t);
        resolve(v);
      };
      window.parent.postMessage({ pluginMessage: { type: 'get-sync-snapshot' } }, '*');
    });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let ctx = await requestCurrentFileContext();
      if (!ctx.fileKey) {
        const fromSnapshot = await requestFileFromSyncSnapshot();
        if (fromSnapshot.fileKey) ctx = fromSnapshot;
      }
      if (cancelled) return;
      setSyncFileKey(ctx.fileKey);
      setSyncFileName(ctx.fileName);
      // Auto-restore last Storybook used on this exact Figma file (Generate-like behavior).
      if (!ctx.fileKey || isSbConnected) return;
      const allLinked = readSyncLinkedFiles();
      const candidates = allLinked
        .filter((x) => x.fileKey === ctx.fileKey && x.storybookUrl)
        .sort((a, b) => String(b.lastUsedAt || '').localeCompare(String(a.lastUsedAt || '')));
      const latest = candidates[0];
      if (latest?.storybookUrl) {
        setStorybookUrl(latest.storybookUrl);
        setIsSbConnected(true);
        setStorybookToken(null);
        setStorybookConnectionInfo(null);
        setSyncScanError(null);
        setSyncScanUpgradeUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSbConnected]);

  useEffect(() => {
    if (!syncFileKey) {
      setRememberedStorybooksForFile([]);
      return;
    }
    const urls = readSyncLinkedFiles()
      .filter((x) => x.fileKey === syncFileKey && x.storybookUrl)
      .sort((a, b) => String(b.lastUsedAt || '').localeCompare(String(a.lastUsedAt || '')))
      .map((x) => canonicalStorybookUrl(x.storybookUrl));
    setRememberedStorybooksForFile(Array.from(new Set(urls)));
  }, [syncFileKey, isSbConnected]);

  useEffect(() => {
    if (!storybookUrl || !syncFileKey) return;
    let cancelled = false;
    const storybookKey = canonicalStorybookUrl(storybookUrl);
    const related = readSyncLinkedFiles().filter((x) => canonicalStorybookUrl(x.storybookUrl) === storybookKey);
    setSyncLinkedFiles(related);

    (async () => {
      const exact = readSyncCachePayload(syncFileKey, storybookKey);
      if (Array.isArray(exact?.syncItems)) {
        if (cancelled) return;
        setSyncItems(exact.syncItems);
        setHasSyncScanned(true);
        return;
      }
      const lastByFile = readLastScanByFile(syncFileKey);
      if (Array.isArray(lastByFile?.payload?.syncItems) && canonicalStorybookUrl(lastByFile.storybookUrl) === storybookKey) {
        if (cancelled) return;
        setSyncItems(lastByFile.payload.syncItems);
        setHasSyncScanned(true);
        return;
      }
      if (fetchSyncScanCache) {
        try {
          const serverCache = await fetchSyncScanCache({ figmaFileKey: syncFileKey, storybookUrl: storybookKey });
          if (cancelled) return;
          if (serverCache && Array.isArray(serverCache.items)) {
            setSyncItems(serverCache.items);
            setHasSyncScanned(true);
            const payload: SyncCachedResult = {
              syncItems: serverCache.items,
              scannedAt: serverCache.scannedAt || new Date().toISOString(),
            };
            try {
              localStorage.setItem(buildSyncCacheKey(syncFileKey, storybookKey), JSON.stringify(payload));
              writeLastScanByFile(syncFileKey, storybookKey, payload);
            } catch {
              // noop
            }
            return;
          }
        } catch {
          // keep local-first behavior on backend/cache failures
        }
      }
      if (cancelled) return;
      setHasSyncScanned(false);
      setSyncItems([]);
    })();

    return () => {
      cancelled = true;
    };
  }, [storybookUrl, syncFileKey, fetchSyncScanCache]);

  const getRemainingTime = (key: string) => {
    const end = cooldowns[key];
    if (!end || end < now) return null;
    const diff = Math.ceil((end - now) / 1000);
    const m = Math.floor(diff / 60).toString().padStart(2, '0');
    const s = (diff % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startCooldown = (key: string) => {
    setCooldowns(prev => ({ ...prev, [key]: Date.now() + COOLDOWN_MS }));
  };

  const clearPendingSyncScanTimeout = () => {
    if (pendingSyncScanTimeoutRef.current == null) return;
    window.clearTimeout(pendingSyncScanTimeoutRef.current);
    pendingSyncScanTimeoutRef.current = null;
  };

  const handleAction = (action: () => void, requiresCredit = false) => {
    if (!canUseFeature) {
      onUnlockRequest();
      return;
    }
    action();
  };

  const getTimeStamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const requestCodeGenSubtree = () =>
    new Promise<{ root?: unknown; error?: string; fileKey?: string | null }>((resolve) => {
      let settled = false;
      const t = setTimeout(() => {
        if (settled) return;
        settled = true;
        pendingCodeGenRef.current = null;
        resolve({ error: 'Timed out reading selection from Figma.' });
      }, 25000);
      pendingCodeGenRef.current = (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(t);
        resolve(v);
      };
      window.parent.postMessage({ pluginMessage: { type: 'get-code-gen-subtree' } }, '*');
    });

  const requestSyncDriftAction = (item: SyncDriftItem) =>
    new Promise<{ ok: boolean; itemId?: string; error?: string; message?: string }>((resolve) => {
      const requestId = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      pendingSyncActionRef.current.set(requestId, resolve);
      window.parent.postMessage({
        pluginMessage: {
          type: 'apply-sync-drift-action',
          requestId,
          itemId: item.id,
          action: item.syncAction ?? null,
        },
      }, '*');
      window.setTimeout(() => {
        if (!pendingSyncActionRef.current.has(requestId)) return;
        pendingSyncActionRef.current.delete(requestId);
        resolve({ ok: false, itemId: item.id, error: 'Timeout applying sync action.' });
      }, 20000);
    });

  const getRawCss = () => {
    return `/* Generated on ${getTimeStamp()} */\n:root {\n  --primary: #ff90e8;\n  --surface: #ffffff;\n  --border: 2px solid #000;\n}\n\n.component-base {\n  background: var(--primary);\n  border: var(--border);\n}`;
  };

  const getRawJson = () => {
    return JSON.stringify({
      meta: {
        generatedAt: getTimeStamp(),
        version: "1.0.0"
      },
      tokens: {
        colors: {
          primary: "#ff90e8",
          surface: "#ffffff",
          text: "#000000"
        },
        spacing: {
          sm: "4px",
          md: "8px",
          lg: "16px"
        },
        border: "2px solid #000"
      }
    }, null, 2);
  };

  // --- HANDLERS ---
  /** FREE: export locale ricorsivo. PRO: Kimi (code_gen_ai) + hint Storybook se disponibili. */
  const CODE_GEN_AI = 'code_gen_ai';

  const handleGenerate = async (opts?: { aiPowered?: boolean }) => {
    if (!canUseFeature) {
      onUnlockRequest();
      return;
    }
    setIsGenerating(true);
    setGeneratedCode(null);
    try {
      const sub = await requestCodeGenSubtree();
      if (sub.error) {
        setGeneratedCode(`// ${sub.error}\n`);
        return;
      }
      if (!sub.root || typeof sub.root !== 'object') {
        setGeneratedCode('// No node data from Figma.\n');
        return;
      }

      const aiPowered = !!opts?.aiPowered && isPro;
      if (!aiPowered) {
        try {
          if (logFreeAction) await logFreeAction('code_gen_free');
        } catch {
          /* best-effort */
        }
        setGeneratedCode(exportLocalDeepCode(lang, sub.root));
        return;
      }

      if (!fetchCodeGen) {
        setGeneratedCode('// Sign in to run PRO AI export.\n');
        return;
      }

      const cost = 3;
      if (!useInfiniteCreditsForTest && creditsRemaining !== null && creditsRemaining < cost) {
        onUnlockRequest();
        return;
      }

      const consumeResult = await consumeCredits({
        action_type: CODE_GEN_AI,
        credits_consumed: cost,
        file_id: sub.fileKey ?? undefined,
      });
      if (consumeResult?.error) {
        if (consumeResult.error === 'Insufficient credits') onUnlockRequest();
        setGeneratedCode(`// ${consumeResult.error}\n`);
        return;
      }

      const ids = collectSubtreeNodeIds(sub.root);
      const matched = syncItems
        .filter((i) => i.layerId && ids.has(String(i.layerId)))
        .map((i) => ({
          figma_layer_id: i.layerId,
          name: i.name,
          note: i.desc,
        }));
      const storybook_context =
        matched.length > 0 || storybookUrl
          ? {
              storybook_base_url: storybookUrl ?? undefined,
              matched_layers: matched,
            }
          : undefined;

      const data = await fetchCodeGen({
        format: lang,
        node_json: sub.root as object,
        file_key: sub.fileKey,
        storybook_context,
      });
      const code = data.code;
      if (!code) {
        setGeneratedCode(`// ${data.error || 'Empty response from code generation.'}\n`);
        return;
      }
      setGeneratedCode(code);
    } catch (e) {
      setGeneratedCode(`// Error: ${e instanceof Error ? e.message : String(e)}\n`);
    } finally {
      setIsGenerating(false);
      setLastSyncedComp(null);
    }
  };

  // Tokens (CSS / JSON): always free (no credits consumed), but logged as 0-credit activities for Stats + dashboard
  const handleGenerateCss = async () => {
    pendingTokenRequestRef.current = 'css';
    setIsGeneratingCss(true);
    try {
      if (logFreeAction) await logFreeAction('token_css');
    } catch {
      // logging best-effort, ignore errors
    }
    window.parent.postMessage({ pluginMessage: { type: 'get-design-tokens' } }, '*');
  };

  const handleGenerateJson = async () => {
    pendingTokenRequestRef.current = 'json';
    setIsGeneratingJson(true);
    try {
      if (logFreeAction) await logFreeAction('token_json');
    } catch {
      // logging best-effort, ignore errors
    }
    window.parent.postMessage({ pluginMessage: { type: 'get-design-tokens' } }, '*');
  };

  const copyToClipboard = (text: string) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
  };

  const handleCopy = () => {
    setCopied(true);
    copyToClipboard(generatedCode || "");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCss = () => {
    setCopiedCss(true);
    copyToClipboard(generatedCss || "");
    setTimeout(() => setCopiedCss(false), 2000);
  };

  const handleCopyJson = () => {
    setCopiedJson(true);
    copyToClipboard(generatedJson || "");
    setTimeout(() => setCopiedJson(false), 2000);
  };
  
  const handleSyncComp = async (target: 'SB' | 'GH' | 'BB') => {
    if (!isPro) {
      onUnlockRequest();
      return;
    }
    if (!selectedLayer) return;
    if (target === 'GH' || target === 'BB') return;
    if (getRemainingTime('comp_sync')) return;

    const cost = 5;
    if (!useInfiniteCreditsForTest && !isPro && creditsRemaining !== null && creditsRemaining < cost) {
      onUnlockRequest();
      return;
    }

    try {
      const consumeResult = await consumeCredits({ action_type: 'comp_sync', credits_consumed: cost });
      if (consumeResult?.error) {
        if (consumeResult.error === 'Insufficient credits') onUnlockRequest();
        return;
      }
    } catch {
      return;
    }

    setIsSyncingComp(true);
    setTimeout(() => {
      setLastSyncedComp(new Date());
      setIsSyncingComp(false);
      startCooldown('comp_sync');
    }, 2000);
  };

  const handleTokenSync = (target: 'SB' | 'GH' | 'BB') => {
     if (!isPro) {
       onUnlockRequest();
       return;
     }
     
     if (target === 'GH' || target === 'BB') return;

     setIsSyncingTokens(true);
     setTimeout(() => {
       setLastSyncedStorybookDate(new Date());
       setTokenSyncSource(target === 'SB' ? 'Storybook' : target === 'GH' ? 'GitHub' : 'Bitbucket');
       setIsSyncingTokens(false);
       startCooldown('token_sync');
     }, 2000);
  };

  const handleSelectLayer = (id: string, layerId: string | null | undefined, e: React.MouseEvent) => {
    e.stopPropagation();
    setLayerSelectionFeedback(id);
    setTimeout(() => setLayerSelectionFeedback(null), 2000);
    if (layerId) {
      window.parent.postMessage({ pluginMessage: { type: 'select-layer', layerId } }, '*');
    }
  };

  // Sync Logic
  const handleConnectSb = (url: string, token?: string, info?: StorybookConnectionInfo | null) => {
    const normalizedUrl = canonicalStorybookUrl(url);
    setStorybookUrl(normalizedUrl);
    setStorybookToken(token ?? null);
    setStorybookConnectionInfo(info ?? null);
    setIsSbConnected(true);
    setSyncScanError(null);
    setSyncScanUpgradeUrl(null);
    setSourceConnectionError(null);
    if (syncFileKey) {
      const next = upsertSyncLinkedFile({
        fileKey: syncFileKey,
        fileName: syncFileName || 'Untitled file',
        storybookUrl: normalizedUrl,
        lastUsedAt: new Date().toISOString(),
      }).filter((x) => canonicalStorybookUrl(x.storybookUrl) === normalizedUrl);
      setSyncLinkedFiles(next);
    }
  };

  const handleDisconnectSb = () => {
    setIsSbConnected(false);
    setStorybookUrl(null);
    setStorybookToken(null);
    setStorybookConnectionInfo(null);
    clearPendingSyncScanTimeout();
    pendingSyncScanRef.current = false;
    setIsSyncScanning(false);
    setSyncScanError(null);
    setSyncScanUpgradeUrl(null);
    setHasSyncScanned(false);
    setSyncFileKey(null);
    setSyncItems([]);
    setSourceConnection(null);
    setSourceConnectionError(null);
    setSourceAuthStartUrl(null);
  };

  const handleSelectSyncFile = (fileKey: string) => {
    setSyncFileKey(fileKey);
    const hit = syncLinkedFiles.find((x) => x.fileKey === fileKey);
    if (hit) setSyncFileName(hit.fileName);
    setSourceConnection(null);
  };

  const normalizeSourceError = (err: unknown, fallback: string): string => {
    const raw = err instanceof Error ? err.message : String(err || fallback);
    if (isLikelyNetworkOrCorsFetchFailure(err)) {
      return 'Network/backend unavailable. Check deployment, CORS, auth backend URL, and that the plugin manifest allows your Git host (e.g. api.github.com) for offline detect.';
    }
    return raw || fallback;
  };

  const loadSourceConnection = React.useCallback(async () => {
    if (!fetchSourceConnection || !syncFileKey || !storybookUrl) return;
    setSourceConnectionLoading(true);
    try {
      const connection = await fetchSourceConnection({ figmaFileKey: syncFileKey, storybookUrl });
      setSourceConnection(connection);
    } catch (err) {
      // Do not block the wizard on background prefetch failures.
      // Users can still continue with manual source setup/auth.
      setSourceConnection(null);
    } finally {
      setSourceConnectionLoading(false);
    }
  }, [fetchSourceConnection, syncFileKey, storybookUrl]);

  useEffect(() => {
    if (!syncFileKey || !storybookUrl) {
      setSourceConnection(null);
      return;
    }
    void loadSourceConnection();
  }, [syncFileKey, storybookUrl, loadSourceConnection]);

  const handleScanSourceConnection = async (input: SourceConnectionInput): Promise<SourceScanResult | null> => {
    if (!scanSourceConnection) {
      return {
        status: 'partial',
        provider: input.provider,
        defaultBranch: input.branch,
        confidence: 'low',
        issues: ['Source scan backend is not available in this build.'],
        detectedAt: new Date().toISOString(),
      };
    }
    setSourceConnectionSaving(true);
    setSourceConnectionError(null);
    try {
      return await scanSourceConnection(input);
    } catch (err) {
      const message = normalizeSourceError(err, 'Source scan failed.');
      setSourceConnectionError(message);
      return {
        status: 'failed',
        provider: input.provider,
        defaultBranch: input.branch,
        confidence: 'low',
        issues: [message],
        detectedAt: new Date().toISOString(),
      };
    } finally {
      setSourceConnectionSaving(false);
    }
  };

  const handleSaveSourceConnection = async (input: SourceConnectionInput): Promise<SourceConnection | null> => {
    if (!syncFileKey || !storybookUrl) {
      setSourceConnectionError('Run a Storybook sync scan before saving the source connection.');
      return null;
    }
    if (!saveSourceConnection) {
      setSourceConnectionError('Source connection backend is not available in this build.');
      return null;
    }
    setSourceConnectionSaving(true);
    setSourceConnectionError(null);
    try {
      const scan = await handleScanSourceConnection(input);
      const saved = await saveSourceConnection({ ...input, figmaFileKey: syncFileKey, storybookUrl, scan });
      setSourceConnection(saved);
      return saved;
    } catch (err) {
      setSourceConnectionError(normalizeSourceError(err, 'Could not save source connection.'));
      return null;
    } finally {
      setSourceConnectionSaving(false);
    }
  };

  const handleDeleteSourceConnection = async (): Promise<boolean> => {
    if (!syncFileKey || !storybookUrl || !deleteSourceConnection) return false;
    setSourceConnectionSaving(true);
    setSourceConnectionError(null);
    try {
      const ok = await deleteSourceConnection({ figmaFileKey: syncFileKey, storybookUrl });
      if (ok) setSourceConnection(null);
      return ok;
    } catch (err) {
      setSourceConnectionError(normalizeSourceError(err, 'Could not disconnect source.'));
      return false;
    } finally {
      setSourceConnectionSaving(false);
    }
  };

  const handleStartSourceAuth = async (provider: SourceProvider) => {
    if (!startSourceAuth) return { ok: false, error: 'Provider auth backend is not available.' };
    setSourceConnectionError(null);
    setSourceAuthStartUrl(null);
    try {
      const result = await startSourceAuth(provider);
      if (result.url) setSourceAuthStartUrl(result.url);
      if (result.url) {
        window.parent.postMessage({ pluginMessage: { type: 'open-oauth-url', authUrl: result.url } }, '*');
      }
      if (!result.ok && result.error) setSourceConnectionError(result.error);
      return result;
    } catch (err) {
      const error = normalizeSourceError(err, 'Could not start provider auth.');
      setSourceConnectionError(error);
      return { ok: false, error };
    }
  };

  const handleSyncScan = async () => {
    if (getRemainingTime('scan_sync')) return;
    if (!storybookUrl || !fetchSyncScan) return;
    if (!isPro) {
      onUnlockRequest();
      return;
    }
    if (!canUseFeature && !useInfiniteCreditsForTest) {
      onUnlockRequest();
      return;
    }

    setSyncScanError(null);
    setSyncScanUpgradeUrl(null);
    setIsSyncScanning(true);
    pendingSyncScanRef.current = true;

    try {
      const { estimated_credits } = await estimateCredits({ action_type: 'scan_sync' });
      const cost = estimated_credits ?? 15;
      if (!useInfiniteCreditsForTest && !isPro && creditsRemaining !== null && creditsRemaining < cost) {
        setSyncScanError('Insufficient credits');
        setIsSyncScanning(false);
        pendingSyncScanRef.current = false;
        onUnlockRequest();
        return;
      }
      const consumeResult = await consumeCredits({ action_type: 'scan_sync', credits_consumed: cost });
      if (consumeResult.error) {
        setSyncScanError(consumeResult.error === 'Insufficient credits' ? 'Insufficient credits' : consumeResult.error);
        setIsSyncScanning(false);
        pendingSyncScanRef.current = false;
        if (consumeResult.error === 'Insufficient credits') onUnlockRequest();
        return;
      }
      clearPendingSyncScanTimeout();
      pendingSyncScanTimeoutRef.current = window.setTimeout(() => {
        if (!pendingSyncScanRef.current) return;
        pendingSyncScanRef.current = false;
        pendingSyncScanTimeoutRef.current = null;
        setIsSyncScanning(false);
        setSyncItems([]);
        setSyncScanUpgradeUrl(null);
        setSyncScanError('Sync scan timed out while reading Figma. Try again, or reduce the file scope if the file is very large.');
      }, 45000);
      window.parent.postMessage({ pluginMessage: { type: 'get-sync-snapshot' } }, '*');
    } catch (err) {
      clearPendingSyncScanTimeout();
      setSyncScanError(err instanceof Error ? err.message : 'Scan failed');
      setSyncScanUpgradeUrl(null);
      setIsSyncScanning(false);
      pendingSyncScanRef.current = false;
    }
  };

  const handleSyncItem = async (item: SyncDriftItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isPro && !useInfiniteCreditsForTest) {
      onUnlockRequest();
      return;
    }
    const cost = 5;
    if (!useInfiniteCreditsForTest && !isPro && creditsRemaining !== null && creditsRemaining < cost) {
      onUnlockRequest();
      return;
    }
    if (!item.syncAction) {
      setSyncScanError('This drift needs manual review before it can be applied.');
      setSyncScanUpgradeUrl(null);
      return;
    }
    const result = await consumeCredits({ action_type: 'sync_fix', credits_consumed: cost });
    if (result.error) {
      if (result.error === 'Insufficient credits') onUnlockRequest();
      return;
    }
    const applied = await requestSyncDriftAction(item);
    if (!applied.ok) {
      setSyncScanError(applied.error || 'Could not apply sync fix.');
      setSyncScanUpgradeUrl(null);
      return;
    }
    setSyncScanError(null);
    setSyncItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const handleSyncAll = async () => {
    setSyncScanError('Fix All will apply bulk actions in both directions (Figma and source code). Bulk execution is the next implementation step.');
    setSyncScanUpgradeUrl(null);
    setLastSyncAllDate(new Date());
  };

  return (
    <div className="p-4 flex flex-col gap-4 pb-16 relative">
      {showConfetti && <Confetti />}
      {showLevelUp && (
        <LevelUpModal
          oldLevel={4}
          newLevel={5}
          discount={5}
          onClose={() => setShowLevelUp(false)}
          onViewStats={() => {
            setShowLevelUp(false);
            onNavigateToStats?.();
          }}
        />
      )}
      
      {/* Credit Banner */}
      <div className="flex justify-center mb-2">
        <div className={`transform -rotate-2 border-2 border-black px-3 py-1 text-[10px] font-black uppercase shadow-[3px_3px_0_0_#000] ${knownZeroCredits ? 'bg-red-100 text-red-600' : 'bg-[#ffc900] text-black'}`}>
          Credits: {creditsDisplay}
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 border-2 border-black bg-white shadow-[4px_4px_0_0_#000]">
        <button 
          onClick={() => setActiveTab('TOKENS')}
          className={`py-3 px-2 text-[10px] font-black uppercase transition-colors ${activeTab === 'TOKENS' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
        >
          Tokens
        </button>
        <button 
          onClick={() => setActiveTab('TARGET')}
          className={`py-3 px-2 text-[10px] font-black uppercase transition-colors border-l-2 border-black ${activeTab === 'TARGET' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
        >
          Target
        </button>
        <button 
          onClick={() => setActiveTab('SYNC')}
          className={`py-3 px-2 text-[10px] font-black uppercase transition-colors border-l-2 border-black ${activeTab === 'SYNC' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
        >
          Sync
        </button>
      </div>

      {/* TAB 1: CSS & TOKENS */}
      {activeTab === 'TOKENS' && (
        <TokensTab 
            lastGeneratedCssDate={lastGeneratedCssDate}
            lastSyncedStorybookDate={lastSyncedStorybookDate}
            generatedCss={generatedCss}
            isGeneratingCss={isGeneratingCss}
            copiedCss={copiedCss}
            handleGenerateCss={handleGenerateCss}
            handleCopyCss={handleCopyCss}
            handleTokenSync={handleTokenSync}
            isSyncingTokens={isSyncingTokens}
            getRemainingTime={getRemainingTime}
            isTokensSynced={isTokensSynced}
            generatedJson={generatedJson}
            lastGeneratedJsonDate={lastGeneratedJsonDate}
            isGeneratingJson={isGeneratingJson}
            copiedJson={copiedJson}
            handleGenerateJson={handleGenerateJson}
            handleCopyJson={handleCopyJson}
            isJsonSynced={isJsonSynced}
        />
      )}

      {/* TAB 2: SINGLE TARGET */}
      {activeTab === 'TARGET' && (
        <TargetTab
            selectedLayer={selectedLayer}
            setSelectedLayer={() => {}}
            lang={lang}
            setLang={setLang}
            generatedCode={generatedCode}
            setGeneratedCode={setGeneratedCode}
            copied={copied}
            isGenerating={isGenerating}
            handleGenerate={handleGenerate}
            handleCopy={handleCopy}
            handleSyncComp={handleSyncComp}
            isSyncingComp={isSyncingComp}
            lastSyncedComp={lastSyncedComp}
            getRemainingTime={getRemainingTime}
            setLastSyncedComp={setLastSyncedComp}
            isPro={isPro}
            onUnlockRequest={onUnlockRequest}
            isSbConnected={isSbConnected}
        />
      )}

      {/* TAB 3: SYNCHRONIZE */}
      {activeTab === 'SYNC' && (
        <SyncTab 
            isPro={isPro}
            onUnlockRequest={onUnlockRequest}
            activeSyncTab={activeSyncTab}
            setActiveSyncTab={setActiveSyncTab}
            isSbConnected={isSbConnected}
            storybookUrl={storybookUrl}
            storybookToken={storybookToken}
            storybookConnectionInfo={storybookConnectionInfo}
            handleConnectSb={handleConnectSb}
            fetchCheckStorybook={fetchCheckStorybook}
            onDisconnectSb={handleDisconnectSb}
            hasSyncScanned={hasSyncScanned}
            handleSyncScan={handleSyncScan}
            isSyncScanning={isSyncScanning}
            getRemainingTime={getRemainingTime}
            syncItems={syncItems}
            syncScanError={syncScanError}
            syncScanUpgradeUrl={syncScanUpgradeUrl}
            expandedDriftId={expandedDriftId}
            setExpandedDriftId={setExpandedDriftId}
            handleSelectLayer={handleSelectLayer}
            layerSelectionFeedback={layerSelectionFeedback}
            handleSyncItem={handleSyncItem}
            handleSyncAll={handleSyncAll}
            sourceConnection={sourceConnection}
            sourceConnectionLoading={sourceConnectionLoading}
            sourceConnectionSaving={sourceConnectionSaving}
            sourceConnectionError={sourceConnectionError}
            sourceAuthStartUrl={sourceAuthStartUrl}
            activeSyncFileKey={syncFileKey}
            activeSyncFileName={syncFileName}
            syncLinkedFiles={syncLinkedFiles}
            rememberedStorybooksForFile={rememberedStorybooksForFile}
            onRestoreStorybookForFile={(url) => handleConnectSb(url, undefined, null)}
            onSelectSyncFile={handleSelectSyncFile}
            onLoadSourceConnection={loadSourceConnection}
            onSaveSourceConnection={handleSaveSourceConnection}
            onDeleteSourceConnection={handleDeleteSourceConnection}
            onScanSourceConnection={handleScanSourceConnection}
            onStartSourceAuth={handleStartSourceAuth}
            lastSyncAllDate={lastSyncAllDate}
        />
      )}

    </div>
  );
};
