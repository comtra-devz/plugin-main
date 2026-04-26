import React, { useState } from 'react';
import { TargetTabProps, BRUTAL } from '../types';
import { Button } from '../../../components/ui/Button';
import { BrutalSelect } from '../../../components/ui/BrutalSelect';
import { BrutalToggle } from '../../../components/ui/BrutalToggle';

const LANGUAGES = [
  { id: 'REACT', label: 'React + Tailwind' },
  { id: 'REACT_INLINE', label: 'React (inline styles)' },
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
  isSbConnected
}) => {
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [showAiInfo, setShowAiInfo] = useState(false);
  const [aiPowered, setAiPowered] = useState(false);

  return (
    <div className="flex flex-col gap-4 animate-in slide-in-from-right-2">
      
      <div className="flex justify-end -mt-1">
        <button
          type="button"
          onClick={() => setShowWorkflowModal(true)}
          className="text-[10px] font-black uppercase underline hover:text-[#ff90e8]"
        >
          Read First
        </button>
      </div>

      {/* Unico box: layer canvas + formato + CTA */}
      <div
        data-component="Code-Target: Target unified card"
        className={`${BRUTAL.card} bg-white px-3 py-4 flex flex-col gap-4 relative z-[5]`}
      >
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center border-b border-black/10 pb-2">
            <span className="text-xs font-bold uppercase">Target layer</span>
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
                Selection from the Figma canvas is active.
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
            <div className="border-t border-black/10 pt-3 flex flex-col gap-2">
              <span className="text-xs font-bold uppercase">Output format</span>
              <p className="text-[10px] text-gray-500 leading-snug">
                Choose the framework, then tap Generate. If you change format, generate again to refresh the output below.
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

            <div className="border-t border-black/10 pt-3 flex flex-col gap-2">
              {isPro ? (
                <div className="rounded border border-black/15 bg-gray-50 px-2 py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase text-gray-700">AI Powered</span>
                    <button
                      type="button"
                      onClick={() => setShowAiInfo(true)}
                      className="w-4 h-4 rounded-full border border-gray-500 text-[10px] leading-none font-bold text-gray-600 hover:bg-white"
                      aria-label="What AI Powered does"
                    >
                      i
                    </button>
                  </div>
                  <BrutalToggle
                    pressed={aiPowered}
                    onPressedChange={(next) => {
                      setAiPowered(next);
                      setGeneratedCode(null);
                    }}
                    aria-label="Toggle AI Powered"
                  />
                </div>
              ) : null}

              <Button
                variant="primary"
                fullWidth
                layout="row"
                onClick={() => handleGenerate({ aiPowered })}
                disabled={isGenerating}
                className="relative"
              >
                <span>{isGenerating ? 'Generating...' : 'Generate code'}</span>
                {aiPowered && !isGenerating ? (
                  <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">
                    -3 Credits
                  </span>
                ) : null}
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Output: compare solo dopo Generate; sotto il box bianco */}
      {selectedLayer && generatedCode ? (
        <div className="flex flex-col gap-2 border-2 border-black bg-black p-4 text-white shadow-[4px_4px_0_0_#000] animate-in fade-in">
          <div className="flex justify-between items-center gap-2 border-b border-gray-700 pb-2">
            <span className="text-[9px] font-bold uppercase text-gray-400">Output</span>
            <span className="text-[9px] font-bold uppercase text-[#ffc900] truncate text-right">
              {LANGUAGES.find((l) => l.id === lang)?.label ?? lang}
            </span>
          </div>
          <div className="bg-[#1a1a1a] border border-gray-700 p-3 font-mono text-[9px] text-[#ffc900] min-h-[12rem] max-h-[50vh] overflow-auto custom-scrollbar">
            <pre className="whitespace-pre-wrap break-words">{generatedCode}</pre>
          </div>
          <Button variant="secondary" fullWidth size="sm" onClick={handleCopy} className="border-white">
            {copied ? 'COPIED!' : 'Copy code'}
          </Button>
        </div>
      ) : null}

      {selectedLayer && (
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
      )}

      {showAiInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAiInfo(false)}>
          <div className={`${BRUTAL.card} bg-white max-w-md w-full mx-4 p-4`} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-black uppercase text-sm mb-2">AI Powered export</h3>
            <p className="text-[11px] text-gray-700 leading-relaxed">
              Get cleaner, more production-ready code in one click. AI Powered improves naming, organizes the output better, and helps shape a structure that is easier to read, edit, and ship faster.
            </p>
            <p className="mt-2 text-[11px] text-gray-700">
              Cost: <strong>3 credits</strong> per generation.
            </p>
            <div className="flex justify-end mt-4">
              <Button variant="secondary" onClick={() => setShowAiInfo(false)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

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
