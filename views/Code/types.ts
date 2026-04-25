
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
  handleGenerate: () => void;
  handleCopy: () => void;
  handleSyncComp: (target: 'SB' | 'GH' | 'BB') => void;
  isSyncingComp: boolean;
  lastSyncedComp: Date | null;
  getRemainingTime: (key: string) => string | null;
  setLastSyncedComp: (date: Date | null) => void;
  isPro: boolean;
  onUnlockRequest: () => void;
  isSbConnected: boolean;
  /** Stima crediti per export PRO AI (Kimi), da GET estimate code_gen_ai */
  proCodeGenAiCredits: number | null;
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
  onConnectSourceProvider?: () => void;
  lastSyncAllDate: Date | null;
}
