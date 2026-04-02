
import React, { useState, useRef, useEffect } from 'react';
import { TargetTabProps, BRUTAL } from '../types';
import { Button } from '../../../components/ui/Button';
import { BrutalSelect, brutalSelectOptionHoverClass } from '../../../components/ui/BrutalSelect';

const LANGUAGES = [
  { id: 'REACT', label: 'React + Tailwind' },
  { id: 'STORYBOOK', label: 'Storybook (.stories.tsx)' },
  { id: 'LIQUID', label: 'Shopify Liquid' },
  { id: 'CSS', label: 'HTML + Clean CSS' },
  { id: 'VUE', label: 'Vue 3' },
  { id: 'SVELTE', label: 'Svelte' },
  { id: 'ANGULAR', label: 'Angular' },
];

export const TargetTab: React.FC<TargetTabProps> = ({
  selectedLayer,
  setSelectedLayer,
  lang,
  setLang,
  generatedCode,
  setGeneratedCode,
  copied,
  isGenerating,
  handleGenerate,
  handleCopy,
  handleSyncComp,
  isSyncingComp,
  lastSyncedComp,
  getRemainingTime,
  setLastSyncedComp,
  isPro,
  onUnlockRequest,
  isSbConnected,
  proCodeGenAiCredits
}) => {
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [showProAiInfo, setShowProAiInfo] = useState(false);
  const [isCodeLangOpen, setIsCodeLangOpen] = useState(false);
  const codeLangDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (codeLangDropdownRef.current && !codeLangDropdownRef.current.contains(target)) {
        setIsCodeLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col gap-4 animate-in slide-in-from-right-2">
      
      {/* Read First link — stesso pattern di Generate */}
      <div className="flex justify-end -mt-1">
        <button
          type="button"
          onClick={() => setShowWorkflowModal(true)}
          className="text-[10px] font-black uppercase underline hover:text-[#ff90e8]"
        >
          Read First
        </button>
      </div>

      {/* Target Layer — selezione automatica da canvas Figma */}
      <div data-component="Code-Target: Target Layer Card" className={`${BRUTAL.card} bg-white px-3 py-4 flex flex-col gap-3 relative z-[5]`}>
        <div className="flex justify-between items-center border-b border-black/10 pb-2">
          <span className="text-xs font-bold uppercase">Target Layer</span>
          <span className="text-[10px] font-bold uppercase text-gray-500">
            {selectedLayer ? 'Frame' : 'No selection'}
          </span>
        </div>

        {selectedLayer ? (
          <>
            <span className="font-mono text-xs text-blue-600 bg-blue-50 p-1 border border-blue-200 block truncate">
              Target: {selectedLayer}
            </span>
            <span className="text-[10px] text-gray-500">
              Selection from canvas is active.
            </span>
          </>
        ) : (
          <span className="text-[10px] text-gray-500 italic">
            No layer selected. Select one in the Figma canvas.
          </span>
        )}
      </div>

      {selectedLayer && (
        <>
          {/* Output Format — stile Design System (Generate) */}
          <div data-component="Code-Target: Output Format Card" className={`${BRUTAL.card} bg-white px-3 py-4 flex flex-col gap-3 relative z-[4]`}>
            <span className="text-xs font-bold uppercase">Output Format</span>
            <p className="text-[10px] text-gray-500">
              Choose the target framework for generated code. Default uses React + Tailwind.
            </p>
            <BrutalSelect
              value={lang}
              onChange={(v) => {
                setLang(v);
                setGeneratedCode(null);
              }}
              options={LANGUAGES.map((l) => ({ value: l.id, label: l.label }))}
              maxHeightClassName="max-h-[200px]"
            />
          </div>

          {/* Generate Code — FREE; box codice = dark mode come Tokens */}
          <div className="flex flex-col gap-1 border-2 border-black bg-black p-4 text-white shadow-[4px_4px_0_0_#000] animate-in slide-in-from-top-2">
            <div className="flex justify-between items-start mb-2 border-b border-gray-700 pb-2">
              <label className="text-[10px] font-bold uppercase pl-1 inline-block w-fit px-1 text-[#ff90e8] self-end">Generate Code</label>
              <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 border ${isPro ? 'border-[#ffc900] text-[#ffc900]' : 'border-gray-500 text-gray-400'}`}>
                {isPro ? 'PRO · AI' : 'Free · local'}
              </span>
            </div>

            {!generatedCode ? (
              <>
              <Button
                variant="primary"
                fullWidth
                layout="row"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="mt-2"
              >
                {isGenerating ? 'Generating...' : 'Generate Code'}
              </Button>
              {isPro ? (
                <div className="mt-2 rounded border border-gray-600 bg-[#111] p-2 text-[9px] text-gray-300 leading-snug">
                  <span className="text-gray-400">PRO export uses Kimi on the server</span>
                  {proCodeGenAiCredits != null ? (
                    <span className="text-[#ffc900] font-bold"> · ~{proCodeGenAiCredits} credits</span>
                  ) : null}
                  <span className="text-gray-500"> · Optional Storybook hints when Sync layers match your selection.</span>
                  <button
                    type="button"
                    className="mt-1 block text-left text-[9px] font-bold uppercase text-[#ff90e8] underline"
                    onClick={() => setShowProAiInfo(true)}
                  >
                    How it works
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-[9px] text-gray-500 leading-snug">
                  Free: full-depth export from Figma JSON (all formats). No AI — runs locally in the plugin.
                </p>
              )}
              </>
            ) : (
              <div className="animate-in fade-in">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[9px] text-gray-400">Output</span>
                  <div className="relative" ref={codeLangDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsCodeLangOpen(!isCodeLangOpen)}
                      className="text-[9px] font-bold uppercase text-[#ffc900] hover:text-white px-2 py-1 border border-gray-600 rounded"
                    >
                      {LANGUAGES.find(l => l.id === lang)?.label ?? lang} ▼
                    </button>
                    {isCodeLangOpen && (
                      <div className="absolute top-full right-0 mt-1 bg-[#1a1a1a] border border-gray-700 shadow-[4px_4px_0_0_#000] z-30 min-w-[160px]">
                        {LANGUAGES.map(l => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => { setLang(l.id); setGeneratedCode(null); setIsCodeLangOpen(false); }}
                            className={`block w-full text-left p-2 text-[10px] border-b border-gray-800 last:border-0 transition-colors ${lang === l.id ? 'bg-[#ffc900] text-black' : `text-[#ffc900] ${brutalSelectOptionHoverClass} hover:text-black`}`}
                          >
                            {l.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-[#1a1a1a] border border-gray-700 p-3 font-mono text-[9px] text-[#ffc900] h-48 overflow-auto mb-3 custom-scrollbar">
                  <pre className="whitespace-pre-wrap break-words">{generatedCode}</pre>
                </div>
                <Button variant="secondary" fullWidth size="sm" onClick={handleCopy} className="border-white">
                  {copied ? 'COPIED!' : 'Copy Code'}
                </Button>
              </div>
            )}
          </div>

          {/* Storybook Connect — come Sync: CTA semplice, grigio se locked, targhetta PRO */}
          <div className={`${BRUTAL.card} bg-white border-black border-2 relative overflow-hidden animate-in slide-in-from-top-2`}>
            <div className="flex justify-between items-end mb-2">
              <div>
                <h3 className="font-black uppercase text-sm">Storybook Connect</h3>
                <p className="text-[10px] text-gray-500">Sync this single component.</p>
              </div>
              {lastSyncedComp && (
                <span className="text-[9px] font-mono text-gray-400 bg-gray-50 px-1 border border-gray-200">
                  Synced: {lastSyncedComp.toLocaleTimeString()}
                </span>
              )}
            </div>
            <Button
              variant={!isPro || !isSbConnected ? 'secondary' : 'primary'}
              fullWidth
              layout="row"
              onClick={() => (!isPro ? onUnlockRequest() : handleSyncComp('SB'))}
              disabled={isPro && (isSyncingComp || !!getRemainingTime('comp_sync') || !isSbConnected)}
              className={`relative ${(isPro && (isSyncingComp || getRemainingTime('comp_sync') || !isSbConnected)) ? '!bg-gray-300 !border-gray-400 !text-gray-600 hover:!bg-gray-300' : ''}`}
            >
              {!isPro ? (
                <span>Sync Component</span>
              ) : isSyncingComp ? (
                <span>Weaving connection...</span>
              ) : getRemainingTime('comp_sync') ? (
                <span>Wait {getRemainingTime('comp_sync')}</span>
              ) : !isSbConnected ? (
                <span>Connect Storybook in Sync tab first</span>
              ) : (
                <>
                  <span className="text-lg">⚡</span>
                  <span>{lastSyncedComp ? 'Update Component' : 'Sync Component'}</span>
                </>
              )}
              {isPro && isSbConnected && !getRemainingTime('comp_sync') ? (
                <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">-5 Credits</span>
              ) : (
                <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">PRO</span>
              )}
            </Button>
          </div>
        </>
      )}

      {showProAiInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowProAiInfo(false)}>
          <div className={`${BRUTAL.card} bg-white max-w-md w-full mx-4 p-4`} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black uppercase text-sm mb-2">PRO · Target export</h3>
            <ul className="list-disc list-inside space-y-2 text-[11px] text-gray-700">
              <li>Uses <strong>Kimi</strong> on Comtra servers to turn your <strong>full selection subtree</strong> into code.</li>
              <li>Consumes credits per run (see estimate above). Connect Storybook in <strong>Sync</strong> first for better naming when layer IDs match.</li>
              <li>Free tier instead uses a <strong>local deterministic</strong> exporter (no AI), still walking the whole tree.</li>
            </ul>
            <div className="flex justify-end mt-4">
              <Button variant="secondary" onClick={() => setShowProAiInfo(false)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Info Modal — stesso pattern di Generate (Read First / Generation Logic) */}
      {showWorkflowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowWorkflowModal(false)}>
          <div className={`${BRUTAL.card} bg-white max-w-lg w-full mx-4 p-4`} onClick={e => e.stopPropagation()}>
            <h3 className="font-black uppercase text-sm mb-2">Workflow Info</h3>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-gray-700 leading-tight">
              <li><strong>Selected a Component?</strong> Sync to Storybook.</li>
              <li><strong>Selected a Wireframe?</strong> Push to GitHub/Bitbucket.</li>
              <li><strong>Selected a Prototype?</strong> Push to GitHub/Bitbucket.</li>
              <li>In all cases, you can generate and copy code directly.</li>
            </ul>
            <div className="flex justify-end mt-4">
              <Button variant="secondary" onClick={() => setShowWorkflowModal(false)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
