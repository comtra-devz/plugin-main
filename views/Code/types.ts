
import React from 'react';
import { BRUTAL, COLORS } from '../../constants';

// Re-export constants for easy access in tabs
export { BRUTAL, COLORS };

export interface TokensTabProps {
  lastGeneratedCssDate: Date | null;
  lastSyncedStorybookDate: Date | null;
  generatedCss: string | null;
  isGeneratingCss: boolean;
  copiedCss: boolean;
  handleGenerateCss: () => void;
  handleCopyCss: () => void;
  handleTokenSync: (target: 'SB' | 'GH' | 'BB') => void;
  isSyncingTokens: boolean;
  getRemainingTime: (key: string) => string | null;
  isTokensSynced: boolean | null;
  generatedJson: string | null;
  lastGeneratedJsonDate: Date | null;
  isGeneratingJson: boolean;
  copiedJson: boolean;
  handleGenerateJson: () => void;
  handleCopyJson: () => void;
  isJsonSynced: boolean | null;
}

export interface TargetTabProps {
  selectedLayer: string | null;
  setSelectedLayer: (id: string | null) => void;
  lang: string;
  setLang: (lang: string) => void;
  generatedCode: string | null;
  setGeneratedCode: (code: string | null) => void;
  copied: boolean;
  isGenerating: boolean;
  handleGenerate: (opts?: { aiPowered?: boolean }) => void;
  handleCopy: () => void;
  handleSyncComp: (target: 'SB' | 'GH' | 'BB') => void;
  isSyncingComp: boolean;
  lastSyncedComp: Date | null;
  getRemainingTime: (key: string) => string | null;
  setLastSyncedComp: (date: Date | null) => void;
  isPro: boolean;
  onUnlockRequest: () => void;
  isSbConnected: boolean;
}

export interface StorybookConnectionInfo {
  endpointPath?: string;
  endpointUrl?: string;
  entryCount?: number;
  storyCount?: number;
  componentCount?: number;
  checkedVia?: 'client' | 'backend';
}

export type SyncDriftAction =
  | { kind: 'rename_figma'; layerId: string; targetName: string }
  | { kind: 'create_figma_placeholder'; targetName: string; storybookUrl?: string | null }
  | null;

export type SyncDriftSyncCategory =
  | 'in_sync'
  | 'needs_review'
  | 'drift'
  | 'unmatched_figma'
  | 'unmatched_story';

export interface SyncDriftItem {
  id: string;
  name: string;
  status: string;
  lastEdited: string;
  desc: string;
  layerId?: string | null;
  reason?: string | null;
  confidence?: string | null;
  figmaName?: string | null;
  storybookName?: string | null;
  storybookUrl?: string | null;
  suggestedAction?: string | null;
  syncAction?: SyncDriftAction;
  /** Deep Sync reconcile grouping (doc UI sections). */
  syncCategory?: SyncDriftSyncCategory;
  repoPath?: string | null;
  diff?: string | null;
  confidenceScore?: number | null;
  storyId?: string | null;
  analysisMode?: 'ai' | 'standard';
}

export interface SyncReconcileMeta {
  sync_session_id: string | null;
  analysis_mode: 'ai' | 'standard' | null;
  reasoning_summary?: string | null;
  avg_confidence?: number | null;
}

export type SourceProvider = 'github' | 'bitbucket' | 'gitlab' | 'custom';

export type SourceConnectionStatus =
  | 'draft'
  | 'needs_auth'
  | 'connected_manual'
  | 'scan_failed'
  | 'ready';

export interface SourceScanResult {
  status: 'ready' | 'partial' | 'failed';
  provider?: SourceProvider;
  defaultBranch?: string | null;
  packageManager?: string | null;
  detectedFramework?: string | null;
  storybookConfigPath?: string | null;
  storiesCount?: number | null;
  componentsCount?: number | null;
  confidence?: 'high' | 'medium' | 'low';
  issues?: string[];
  detectedAt?: string | null;
}

export interface SourceConnection {
  provider: SourceProvider;
  repoUrl: string;
  branch: string;
  storybookPath: string;
  storybookUrl: string;
  figmaFileKey: string;
  status: SourceConnectionStatus;
  authStatus?: 'not_configured' | 'needs_auth' | 'connected';
  hasToken?: boolean;
  scan?: SourceScanResult | null;
  lastScannedAt?: string | null;
  updatedAt?: string | null;
}

export interface SourceConnectionInput {
  provider: SourceProvider;
  repoUrl: string;
  branch: string;
  storybookPath: string;
  sourceToken?: string;
}

export interface SyncLinkedFileOption {
  fileKey: string;
  fileName: string;
  storybookUrl: string;
  lastUsedAt: string;
}

export interface SyncTabProps {
  isPro: boolean;
  onUnlockRequest: () => void;
  activeSyncTab: 'SB' | 'GH' | 'BB';
  setActiveSyncTab: (tab: 'SB' | 'GH' | 'BB') => void;
  isSbConnected: boolean;
  storybookUrl: string | null;
  storybookToken: string | null;
  storybookConnectionInfo?: StorybookConnectionInfo | null;
  handleConnectSb: (url: string, token?: string, info?: StorybookConnectionInfo | null) => void;
  fetchCheckStorybook?: (url: string, token?: string) => Promise<{ ok: boolean; error?: string } & StorybookConnectionInfo>;
  onDisconnectSb?: () => void;
  hasSyncScanned: boolean;
  handleSyncScan: () => void;
  isSyncScanning: boolean;
  getRemainingTime: (key: string) => string | null;
  syncItems: SyncDriftItem[];
  syncScanError: string | null;
  /** Figma pricing / upgrade link when sync-scan returns structured 429. */
  syncScanUpgradeUrl?: string | null;
  expandedDriftId: string | null;
  setExpandedDriftId: (id: string | null) => void;
  handleSelectLayer: (id: string, layerId: string | null | undefined, e: React.MouseEvent) => void;
  layerSelectionFeedback: string | null;
  handleSyncItem: (item: SyncDriftItem, e?: React.MouseEvent) => void;
  handleSyncAll: () => void;
  sourceConnection: SourceConnection | null;
  sourceConnectionLoading: boolean;
  sourceConnectionSaving: boolean;
  sourceConnectionError: string | null;
  sourceAuthStartUrl: string | null;
  activeSyncFileKey: string | null;
  activeSyncFileName: string | null;
  syncLinkedFiles: SyncLinkedFileOption[];
  rememberedStorybooksForFile?: string[];
  onRestoreStorybookForFile?: (url: string) => void;
  onSelectSyncFile: (fileKey: string) => void;
  onLoadSourceConnection: () => Promise<void>;
  onSaveSourceConnection: (input: SourceConnectionInput) => Promise<SourceConnection | null>;
  onDeleteSourceConnection: () => Promise<boolean>;
  onScanSourceConnection: (input: SourceConnectionInput) => Promise<SourceScanResult | null>;
  onStartSourceAuth: (provider: SourceProvider) => Promise<{ ok: boolean; url?: string | null; error?: string }>;
  lastSyncAllDate: Date | null;
  /** When source is ready, scan uses POST /api/agents/sync-reconcile (Qwen + repo). */
  syncScanVariant?: 'legacy' | 'deep';
  /** Last successful reconcile / scan metadata for badges and PR flow. */
  syncReconcileMeta?: SyncReconcileMeta | null;
}
