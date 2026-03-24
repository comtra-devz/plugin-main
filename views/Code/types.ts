
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
}

export interface SyncTabProps {
  isPro: boolean;
  onUnlockRequest: () => void;
  activeSyncTab: 'SB' | 'GH' | 'BB';
  setActiveSyncTab: (tab: 'SB' | 'GH' | 'BB') => void;
  isSbConnected: boolean;
  storybookUrl: string | null;
  storybookToken: string | null;
  handleConnectSb: (url: string, token?: string) => void;
  fetchCheckStorybook?: (url: string, token?: string) => Promise<{ ok: boolean; error?: string }>;
  onDisconnectSb?: () => void;
  hasSyncScanned: boolean;
  handleSyncScan: () => void;
  isSyncScanning: boolean;
  getRemainingTime: (key: string) => string | null;
  syncItems: Array<{ id: string; name: string; status: string; lastEdited: string; desc: string; layerId?: string | null }>;
  syncScanError: string | null;
  expandedDriftId: string | null;
  setExpandedDriftId: (id: string | null) => void;
  handleSelectLayer: (id: string, layerId: string | null | undefined, e: React.MouseEvent) => void;
  layerSelectionFeedback: string | null;
  handleSyncItem: (id: string, e?: React.MouseEvent) => void;
  handleSyncAll: () => void;
  lastSyncAllDate: Date | null;
}
