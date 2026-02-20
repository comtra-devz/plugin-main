
import React from 'react';
import { TargetTabProps, BRUTAL, COLORS } from '../types';

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
  setLastSyncedComp
}) => {
  return (
    <div className="flex flex-col gap-4 animate-in slide-in-from-right-2">
      
      {/* Info Alert */}
      <div className="bg-white border-2 border-black p-3 text-[10px] font-medium leading-tight shadow-[4px_4px_0_0_#000]">
          <span className="font-bold uppercase block mb-1">ℹ️ Workflow Info</span>
          <span className="leading-tight block">
            1. <strong>Selected a Component?</strong> Sync to Storybook.<br/>
            2. <strong>Selected a Wireframe?</strong> Push to GitHub/Bitbucket.<br/>
            3. <strong>Selected a Prototype?</strong> Push to GitHub/Bitbucket.<br/>
            <span className="block mt-1 pt-1 border-t border-black/10 text-gray-600">
                In all cases, you can generate and copy code directly.
            </span>
          </span>
      </div>

      {/* Layer Selection - PROD LOGIC */}
      <div className={`${BRUTAL.card} bg-white py-3 flex flex-col gap-2`}>
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold uppercase">Target Layer</span>
          {/* In Prod, user must select in Figma canvas. We only offer deselect (clear state). */}
          {selectedLayer && (
            <button onClick={() => { setSelectedLayer(null); setGeneratedCode(null); setLastSyncedComp(null); }} className="text-[10px] font-bold bg-black text-white px-2 py-1">
              Deselect
            </button>
          )}
        </div>
        {selectedLayer ? (
          <span className="font-mono text-lg font-black text-black">{selectedLayer}</span>
        ) : (
          <span className="w-fit bg-red-100 text-red-600 border-2 border-red-600 px-3 py-2 font-black uppercase text-sm inline-block transform -rotate-1">
            No Layer Selected
          </span>
        )}
      </div>

      {selectedLayer && (
        <>
          {/* Code Generation - Wrapped in Blue Card */}
          <div className={`${BRUTAL.card} bg-[#e0f2fe] border-black border-2 relative overflow-hidden flex flex-col gap-2 animate-in slide-in-from-top-2`}>
            <div className="flex justify-between items-start mb-1">
                <h3 className="font-black uppercase text-sm">Generate Code</h3>
            </div>
            
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
                className={`${BRUTAL.btn} bg-[${COLORS.primary}] text-black w-full flex justify-center items-center gap-2 relative`}
                disabled={isGenerating}
              >
                {isGenerating ? 'Generating...' : 'Generate Code'}
                <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">-40 Credits</span>
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

          {/* Component Sync Section (Storybook) */}
          <div className={`${BRUTAL.card} bg-[#e0f2fe] border-black border-2 relative overflow-hidden animate-in slide-in-from-top-2`}>
            <div className="flex justify-between items-start mb-3">
              <div className="flex flex-col">
                <h3 className="font-black uppercase text-sm">Storybook Connect</h3>
                <p className="text-[10px] text-gray-600">Sync this component.</p>
              </div>
              <div className="flex flex-col items-end">
                 {lastSyncedComp && (
                    <span className="text-[9px] font-mono text-gray-500 bg-white px-1 border border-black/10">
                        Synced: {lastSyncedComp.toLocaleTimeString()}
                    </span>
                 )}
              </div>
            </div>

            <button 
              onClick={() => handleSyncComp('SB')} 
              disabled={isSyncingComp || !!getRemainingTime('comp_sync')}
              className={`${BRUTAL.btn} w-full flex justify-center items-center gap-2 relative ${isSyncingComp || getRemainingTime('comp_sync') ? 'bg-gray-300 border-gray-400 text-gray-600' : `bg-[${COLORS.primary}]`}`}
            >
              {isSyncingComp ? (
                <span>Weaving connection...</span>
              ) : getRemainingTime('comp_sync') ? (
                <span>Wait {getRemainingTime('comp_sync')}</span>
              ) : (
                <>
                  <span className="text-lg">⚡</span>
                  <span>{lastSyncedComp ? 'Update Component' : 'Sync Component'}</span>
                </>
              )}
              {(!getRemainingTime('comp_sync')) && <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">-40 Credits</span>}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
