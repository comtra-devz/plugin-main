
import React, { useState, useEffect } from 'react';
import { TIER_LIMITS } from '../constants';
import { UserPlan } from '../types';
import { Confetti } from '../components/Confetti.tsx';
import { TokensTab } from './Code/tabs/TokensTab.tsx';
import { TargetTab } from './Code/tabs/TargetTab.tsx';
import { SyncTab } from './Code/tabs/SyncTab.tsx';
import { LevelUpModal } from '../components/LevelUpModal.tsx';

interface Props { 
  plan: UserPlan; 
  userTier?: string;
  onUnlockRequest: () => void;
  usageCount: number;
  onUse: () => void;
}

const SYNC_ITEMS_MOCK = [
  { id: 'c1', name: 'Primary Button', status: 'DRIFT', lastEdited: '2h ago', desc: 'Padding inconsistency: Figma 12px vs Code 16px' },
  { id: 'c2', name: 'Input Field', status: 'DRIFT', lastEdited: '5h ago', desc: 'Missing focus state definition in Figma' },
  { id: 'c3', name: 'Navbar', status: 'DRIFT', lastEdited: '1d ago', desc: 'Color token mismatch: primary-500 vs primary-600' },
];

const COOLDOWN_MS = 120000; // 2 Minutes

type Tab = 'TOKENS' | 'TARGET' | 'SYNC';

export const Code: React.FC<Props> = ({ plan, userTier, onUnlockRequest, usageCount, onUse }) => {
  const [activeTab, setActiveTab] = useState<Tab>('TOKENS');
  
  // Cooldown State
  const [cooldowns, setCooldowns] = useState<{ [key: string]: number }>({});
  const [now, setNow] = useState(Date.now());

  // Single Target State
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
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
  const [isSyncScanning, setIsSyncScanning] = useState(false);
  const [syncItems, setSyncItems] = useState<typeof SYNC_ITEMS_MOCK>([]);
  const [hasSyncScanned, setHasSyncScanned] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [lastSyncAllDate, setLastSyncAllDate] = useState<Date | null>(null);
  const [expandedDriftId, setExpandedDriftId] = useState<string | null>(null);
  const [layerSelectionFeedback, setLayerSelectionFeedback] = useState<string | null>(null);

  // Level Up State
  const [showLevelUp, setShowLevelUp] = useState(false);

  const isPro = plan === 'PRO';
  const isAnnual = userTier === '1y';
  
  // Credit Limit Logic
  const limit = isPro 
    ? (userTier && TIER_LIMITS[userTier] ? TIER_LIMITS[userTier] : TIER_LIMITS['PRO']) 
    : TIER_LIMITS['FREE'];
    
  // Mocking previous usage for Pro to make it look realistic (450 used), Free starts at 0 + session usage
  const effectiveUsage = isPro ? 450 + usageCount : usageCount;
  const remaining = Math.max(0, limit - effectiveUsage);
  
  const canUseFeature = isPro || remaining > 0;
  const creditsDisplay = isPro ? `${limit - effectiveUsage}/${limit}` : `${remaining}/${limit}`;

  // Calculated State for Tokens Sync Status
  // If Storybook date is newer or equal to CSS/JSON date, we are synced.
  const isTokensSynced = lastSyncedStorybookDate && lastGeneratedCssDate && lastSyncedStorybookDate >= lastGeneratedCssDate;
  const isJsonSynced = lastSyncedStorybookDate && lastGeneratedJsonDate && lastSyncedStorybookDate >= lastGeneratedJsonDate;

  // Timer Tick
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

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

  const handleAction = (action: () => void, requiresCredit = false) => {
    if (!canUseFeature) {
      onUnlockRequest();
      return;
    }
    if (requiresCredit && !isPro) onUse();
    action();
  };

  const getTimeStamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // --- MOCK GENERATORS ---
  const generateCodeString = () => {
    const ts = getTimeStamp();
    if (lang === 'CSS') return `/* Generated on ${ts} */\n.btn {\n  background: #ff90e8;\n  border: 2px solid #000;\n  padding: 8px 16px;\n  cursor: pointer;\n}`;
    if (lang === 'VUE') return `<!-- Generated on ${ts} -->\n<template>\n  <button class="btn">Click me</button>\n</template>`;
    if (lang === 'LIQUID') return `{% comment %} Generated on ${ts} {% endcomment %}\n{% render 'button', label: 'Click me', class: 'btn-primary' %}`;
    if (lang === 'STORYBOOK') return `// Generated on ${ts}\nimport type { Meta, StoryObj } from '@storybook/react';\nimport { Button } from './Button';\n\nconst meta: Meta<typeof Button> = {\n  component: Button,\n};\nexport default meta;\n\ntype Story = StoryObj<typeof Button>;\n\nexport const Primary: Story = {\n  args: {\n    primary: true,\n    label: 'Button',\n  },\n};`;
    return `// Generated on ${ts}\nexport const Button = () => (\n  <button className="bg-[#ff90e8] border-2 border-black p-2 hover:bg-[#ffc900] transition-all">\n    Click me\n  </button>\n);`;
  };

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
  const handleGenerate = () => {
     handleAction(() => {
        setIsGenerating(true);
        // Generation always uses generic credits if not Pro
        if(!isPro) onUse();
        setTimeout(() => {
          setGeneratedCode(generateCodeString());
          setIsGenerating(false);
          // Reset sync if code changes
          setLastSyncedComp(null);
        }, 1500);
     });
  };

  const handleGenerateCss = () => {
    // Uses CSS Update Cooldown
    handleAction(() => {
      setIsGeneratingCss(true);
      if(!isPro) onUse();
      setTimeout(() => {
        setGeneratedCss(getRawCss());
        setIsGeneratingCss(false);
        // Update CSS Gen Date. This will make "Sync Storybook" active again if it was synced.
        setLastGeneratedCssDate(new Date()); 
        startCooldown('css_update');
      }, 1000);
    });
  };

  const handleGenerateJson = () => {
    handleAction(() => {
      setIsGeneratingJson(true);
      if(!isPro) onUse();
      setTimeout(() => {
        setGeneratedJson(getRawJson());
        setIsGeneratingJson(false);
        setLastGeneratedJsonDate(new Date());
        startCooldown('json_update');
      }, 1000);
    });
  };

  const handleCopy = () => { 
    setCopied(true); 
    navigator.clipboard.writeText(generatedCode || "");
    setTimeout(() => setCopied(false), 2000); 
  };

  const handleCopyCss = () => {
    setCopiedCss(true);
    navigator.clipboard.writeText(generatedCss || "");
    setTimeout(() => setCopiedCss(false), 2000);
  };

  const handleCopyJson = () => {
    setCopiedJson(true);
    navigator.clipboard.writeText(generatedJson || "");
    setTimeout(() => setCopiedJson(false), 2000);
  };
  
  const handleSyncComp = (target: 'SB' | 'GH' | 'BB') => {
    if (!isPro) {
      onUnlockRequest();
      return;
    }
    if (!selectedLayer) return;
    if (target === 'GH' || target === 'BB') return; 

    // Credit usage for sync
    if(!isAnnual) onUse(); 

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

     // Credit usage for sync
     if(!isAnnual) onUse();

     setIsSyncingTokens(true);
     setTimeout(() => {
       setLastSyncedStorybookDate(new Date());
       setTokenSyncSource(target === 'SB' ? 'Storybook' : target === 'GH' ? 'GitHub' : 'Bitbucket');
       setIsSyncingTokens(false);
       startCooldown('token_sync');
     }, 2000);
  };

  const handleSelectLayer = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLayerSelectionFeedback(id);
    setTimeout(() => setLayerSelectionFeedback(null), 2000);
  };

  // Sync Logic
  const handleConnectSb = () => {
    setIsSbConnected(true);
  };

  const handleSyncScan = () => {
    // Check Cooldown
    if (getRemainingTime('scan_sync')) return;

    if(!isAnnual) onUse(); // Uses credits

    setIsSyncScanning(true);
    setTimeout(() => {
      setIsSyncScanning(false);
      setSyncItems(SYNC_ITEMS_MOCK);
      setHasSyncScanned(true);
      startCooldown('scan_sync');
    }, 2000);
  };

  const handleSyncItem = (id: string, e?: React.MouseEvent) => {
    if(e) e.stopPropagation();
    setSyncItems(prev => prev.filter(i => i.id !== id));
  };

  const handleSyncAll = () => {
    if(!isAnnual) onUse(); // Uses credits
    setSyncItems([]);
    setLastSyncAllDate(new Date());
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2000);
  };

  return (
    <div className="p-4 pb-24 flex flex-col gap-4 relative">
      {showConfetti && <Confetti />}
      {showLevelUp && (
          <LevelUpModal 
            oldLevel={4}
            newLevel={5}
            discount={5}
            onClose={() => setShowLevelUp(false)}
          />
      )}
      
      {/* Credit Banner */}
      <div className="flex justify-center mb-2">
        <div className={`transform -rotate-2 border-2 border-black px-3 py-1 text-[10px] font-black uppercase shadow-[3px_3px_0_0_#000] ${remaining === 0 && !isPro ? 'bg-red-100 text-red-600' : 'bg-[#ffc900] text-black'}`}>
          {isPro ? `Credits: ${creditsDisplay}` : `Free Credits Remaining: ${remaining}/${limit}`}
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 border-2 border-black bg-white shadow-[4px_4px_0_0_#000]">
        <button 
          onClick={() => setActiveTab('TOKENS')}
          className={`py-2 text-[10px] font-black uppercase transition-colors ${activeTab === 'TOKENS' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
        >
          Tokens
        </button>
        <button 
          onClick={() => setActiveTab('TARGET')}
          className={`py-2 text-[10px] font-black uppercase transition-colors border-l-2 border-black ${activeTab === 'TARGET' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
        >
          Target
        </button>
        <button 
          onClick={() => setActiveTab('SYNC')}
          className={`py-2 text-[10px] font-black uppercase transition-colors border-l-2 border-black ${activeTab === 'SYNC' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
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
            setSelectedLayer={setSelectedLayer}
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
            handleConnectSb={handleConnectSb}
            hasSyncScanned={hasSyncScanned}
            handleSyncScan={handleSyncScan}
            isSyncScanning={isSyncScanning}
            getRemainingTime={getRemainingTime}
            syncItems={syncItems}
            expandedDriftId={expandedDriftId}
            setExpandedDriftId={setExpandedDriftId}
            handleSelectLayer={handleSelectLayer}
            layerSelectionFeedback={layerSelectionFeedback}
            handleSyncItem={handleSyncItem}
            handleSyncAll={handleSyncAll}
            lastSyncAllDate={lastSyncAllDate}
            onScanComplete={() => setShowLevelUp(true)}
        />
      )}

    </div>
  );
};
