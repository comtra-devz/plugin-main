import React, { useState } from 'react';
import { BRUTAL, COLORS } from '../constants_test';
import { UserPlan } from '../types_test';

interface Props { 
  plan: UserPlan; 
  onUnlockRequest: () => void;
  usageCount: number;
  onUse: () => void;
}

const LANGUAGES = [
  { id: 'REACT', label: 'React + Tailwind' },
  { id: 'STORYBOOK', label: 'Storybook (.stories.tsx)' },
  { id: 'LIQUID', label: 'Shopify Liquid' },
  { id: 'CSS', label: 'HTML + Clean CSS' },
  { id: 'VUE', label: 'Vue 3' },
  { id: 'SVELTE', label: 'Svelte' },
  { id: 'ANGULAR', label: 'Angular' },
];

const MAX_FREE_USES = 3;

type Tab = 'TOKENS' | 'TARGET';

export const Code: React.FC<Props> = ({ plan, onUnlockRequest, usageCount, onUse }) => {
  const [activeTab, setActiveTab] = useState<Tab>('TOKENS');
  
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
  const [lastSyncedTokens, setLastSyncedTokens] = useState<Date | null>(null);
  const [generatedCss, setGeneratedCss] = useState<string | null>(null);
  const [isGeneratingCss, setIsGeneratingCss] = useState(false);
  const [copiedCss, setCopiedCss] = useState(false);

  const isPro = plan === 'PRO';
  const remaining = Math.max(0, MAX_FREE_USES - usageCount);
  const canUseFeature = isPro || remaining > 0;

  const handleAction = (action: () => void) => {
    if (!canUseFeature) {
      onUnlockRequest();
      return;
    }
    action();
  };

  // --- MOCK GENERATORS ---
  const generateCodeString = () => {
    if (lang === 'CSS') return `.btn {\n  background: #ff90e8;\n  border: 2px solid #000;\n  padding: 8px 16px;\n  cursor: pointer;\n}`;
    if (lang === 'VUE') return `<template>\n  <button class="btn">Click me</button>\n</template>`;
    if (lang === 'LIQUID') return `{% render 'button', label: 'Click me', class: 'btn-primary' %}`;
    if (lang === 'STORYBOOK') return `import type { Meta, StoryObj } from '@storybook/react';\nimport { Button } from './Button';\n\nconst meta: Meta<typeof Button> = {\n  component: Button,\n};\nexport default meta;\n\ntype Story = StoryObj<typeof Button>;\n\nexport const Primary: Story = {\n  args: {\n    primary: true,\n    label: 'Button',\n  },\n};`;
    return `export const Button = () => (\n  <button className="bg-[#ff90e8] border-2 border-black p-2 hover:bg-[#ffc900] transition-all">\n    Click me\n  </button>\n);`;
  };

  const getRawCss = () => {
    return `:root {\n  --primary: #ff90e8;\n  --surface: #ffffff;\n  --border: 2px solid #000;\n}\n\n.component-base {\n  background: var(--primary);\n  border: var(--border);\n}`;
  };

  // --- HANDLERS ---
  const handleGenerate = () => {
     handleAction(() => {
        setIsGenerating(true);
        if(!isPro) onUse();
        setTimeout(() => {
          setGeneratedCode(generateCodeString());
          setIsGenerating(false);
        }, 1500);
     });
  };

  const handleGenerateCss = () => {
    handleAction(() => {
      setIsGeneratingCss(true);
      if(!isPro) onUse();
      setTimeout(() => {
        setGeneratedCss(getRawCss());
        setIsGeneratingCss(false);
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
  
  const handleSyncComp = () => {
    if (!isPro) {
      onUnlockRequest();
      return;
    }
    if (!selectedLayer) return;
    setIsSyncingComp(true);
    setTimeout(() => {
      setLastSyncedComp(new Date());
      setIsSyncingComp(false);
    }, 2000);
  };

  const handleTokenSync = () => {
     if (!isPro) {
       onUnlockRequest();
       return;
     }
     setIsSyncingTokens(true);
     setTimeout(() => {
       setLastSyncedTokens(new Date());
       setIsSyncingTokens(false);
     }, 2000);
  };

  return (
    <div className="p-4 pb-24 flex flex-col gap-4">
      
      {/* Credit Banner (Visible for Pro too) */}
      <div className="flex justify-center mb-2">
        <div className={`transform -rotate-2 border-2 border-black px-3 py-1 text-[10px] font-black uppercase shadow-[3px_3px_0_0_#000] ${remaining === 0 && !isPro ? 'bg-red-100 text-red-600' : 'bg-[#ffc900] text-black'}`}>
          {isPro ? 'Credits: ∞' : `Free Exports Remaining: ${remaining}/${MAX_FREE_USES}`}
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 border-2 border-black bg-white shadow-[4px_4px_0_0_#000]">
        <button 
          onClick={() => setActiveTab('TOKENS')}
          className={`py-2 text-xs font-black uppercase transition-colors ${activeTab === 'TOKENS' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
        >
          CSS & Tokens
        </button>
        <button 
          onClick={() => setActiveTab('TARGET')}
          className={`py-2 text-xs font-black uppercase transition-colors ${activeTab === 'TARGET' ? 'bg-black text-white' : 'hover:bg-gray-100 border-l-2 border-black'}`}
        >
          Single Target
        </button>
      </div>

      {/* TAB 1: CSS & TOKENS */}
      {activeTab === 'TOKENS' && (
        <div className="flex flex-col gap-4 animate-in slide-in-from-left-2">
           <div className="bg-white border-2 border-black p-3 text-[10px] font-medium leading-tight shadow-[4px_4px_0_0_#000]">
              <span className="font-bold uppercase block mb-1">⚠️ Crucial Step</span>
              You must copy/paste this code into your project's global stylesheet first. It defines the core variables required for individual components to work correctly.
           </div>

           <div className="flex flex-col gap-1 border-2 border-black bg-black p-4 text-white shadow-[4px_4px_0_0_#000]">
            <div className="flex justify-between items-end mb-2 border-b border-gray-700 pb-2">
                <label className="text-[10px] font-bold uppercase pl-1 inline-block w-fit px-1 text-[#ff90e8]">Raw CSS & Tokens</label>
                
                <div className={`px-2 py-0.5 border border-white text-[9px] font-bold uppercase ${lastSyncedTokens ? 'bg-[#ffc900] text-black border-none' : 'bg-gray-800 text-gray-400'}`}>
                    {lastSyncedTokens ? 'Synced' : 'Not Synced'}
                </div>
            </div>
            
            {lastSyncedTokens && (
                <div className="text-[9px] font-mono text-gray-400 mb-2 p-1 text-right">
                    Last update: {lastSyncedTokens.toLocaleDateString()} {lastSyncedTokens.toLocaleTimeString()}
                </div>
            )}

            {!generatedCss ? (
              <button 
                  onClick={handleGenerateCss} 
                  className={`${BRUTAL.btn} bg-white text-black border-white w-full text-xs flex justify-center items-center gap-2 mt-2 hover:bg-gray-200`}
                  disabled={isGeneratingCss}
                >
                  {isGeneratingCss ? 'Generating CSS...' : 'Generate CSS & Tokens'}
                </button>
            ) : (
              <div className="animate-in fade-in">
                <div className="bg-[#1a1a1a] border border-gray-700 p-2 font-mono text-[9px] text-[#ffc900] h-32 overflow-y-auto mb-3 custom-scrollbar">
                  <pre>{generatedCss}</pre>
                </div>
                <div className="flex gap-2">
                    <button className={`${BRUTAL.btn} flex-1 text-[10px] bg-white text-black border-white hover:bg-gray-200`} onClick={handleCopyCss}>
                      {copiedCss ? 'COPIED!' : 'Copy CSS'}
                    </button>
                    <button 
                        className={`${BRUTAL.btn} flex-1 text-[10px] bg-transparent text-white border-white relative hover:bg-white hover:text-black`} 
                        onClick={handleTokenSync}
                        disabled={isSyncingTokens}
                    >
                      {isSyncingTokens ? 'Syncing...' : 'Sync Storybook'}
                      <span className="absolute bottom-0.5 right-1 text-[8px] bg-[#ff90e8] text-black px-1 font-bold rounded-sm">PRO</span>
                    </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SINGLE TARGET */}
      {activeTab === 'TARGET' && (
        <div className="flex flex-col gap-4 animate-in slide-in-from-right-2">
          {/* Layer Selection */}
          <div className={`${BRUTAL.card} bg-white py-3 flex flex-col gap-2`}>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase">Target Layer</span>
              <button onClick={() => { setSelectedLayer(selectedLayer ? null : "Button_Primary"); setGeneratedCode(null); }} className="text-[10px] font-bold bg-black text-white px-2 py-1">
                {selectedLayer ? 'Deselect' : 'Select Frame'}
              </button>
            </div>
            {selectedLayer ? (
              <span className="font-mono text-xs text-gray-500">{selectedLayer}</span>
            ) : (
              <span className="text-[10px] text-red-500 italic">No layer selected in Figma</span>
            )}
          </div>

          {selectedLayer && (
            <>
              {/* Code Generation */}
              <div className="flex flex-col gap-2 animate-in slide-in-from-top-2">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] font-bold uppercase pl-1">Output Format</label>
                  <div className="relative w-1/2">
                    <select 
                      value={lang} 
                      onChange={(e) => { setLang(e.target.value); setGeneratedCode(null); }}
                      className={`${BRUTAL.input} appearance-none bg-white pr-8 text-[10px] font-bold uppercase py-1 h-8`}
                    >
                      {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none font-bold text-[8px]">▼</div>
                  </div>
                </div>

                {!generatedCode ? (
                  <button 
                    onClick={handleGenerate} 
                    className={`${BRUTAL.btn} bg-white w-full text-xs flex justify-center items-center gap-2`}
                    disabled={isGenerating}
                  >
                    {isGenerating ? 'Generating...' : 'Generate Code'}
                  </button>
                ) : (
                  <div className="animate-in fade-in">
                    <div className={`${BRUTAL.card} font-mono text-[10px] bg-[#1a1a1a] text-gray-300 overflow-x-auto h-48 p-3 relative mb-2`}>
                      <div className="absolute top-2 right-2 text-[9px] text-gray-500 uppercase">{lang}</div>
                      <pre>{generatedCode}</pre>
                    </div>
                    <button onClick={handleCopy} className={`${BRUTAL.btn} bg-white w-full text-xs`}>
                      {copied ? 'COPIED!' : 'COPY CODE'}
                    </button>
                  </div>
                )}
              </div>

              {/* Component Sync Section */}
              <div className={`${BRUTAL.card} bg-[#e0f2fe] border-black border-2 relative overflow-hidden animate-in slide-in-from-top-2`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex flex-col">
                    <h3 className="font-black uppercase text-sm">Storybook Connect</h3>
                    <p className="text-[10px] text-gray-600">Sync this component.</p>
                  </div>
                  <div className={`px-2 py-0.5 border-2 border-black text-[9px] font-bold uppercase ${lastSyncedComp ? 'bg-[#ffc900] text-black' : 'bg-gray-200 text-gray-500'}`}>
                    {lastSyncedComp ? 'Synced' : 'Not Synced'}
                  </div>
                </div>

                <button 
                  onClick={handleSyncComp} 
                  disabled={isSyncingComp}
                  className={`${BRUTAL.btn} w-full flex justify-center items-center gap-2 relative ${isSyncingComp ? 'bg-gray-300' : `bg-[${COLORS.primary}]`}`}
                >
                  {isSyncingComp ? (
                    <span>Weaving connection...</span>
                  ) : (
                    <>
                      <span className="text-lg">⚡</span>
                      <span>Sync Component</span>
                    </>
                  )}
                  <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">PRO</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
};