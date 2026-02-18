
import React, { useState } from 'react';
import { BRUTAL, COLORS } from './constants';
import { MASTER_PLAN } from './data';

export const MasterPlanView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  const toggleCheck = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const newSet = new Set(checkedItems);
    if (newSet.has(index)) newSet.delete(index);
    else newSet.add(index);
    setCheckedItems(newSet);
  };

  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedPrompt(text);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#fdfdfd] font-sans p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto pb-20">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 border-b-4 border-black pb-4">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-black">Antigravity<span className="text-[#ff90e8]">.ai</span></h1>
            <p className="text-sm font-mono font-bold uppercase mt-1 bg-black text-white inline-block px-2">Master Execution Plan</p>
          </div>
          <button onClick={onBack} className={`${BRUTAL.btn} bg-white text-black hover:bg-gray-100`}>
            Exit
          </button>
        </div>

        {/* Unified List */}
        <div className="space-y-4">
          {MASTER_PLAN.map((phase, index) => {
            const isChecked = checkedItems.has(phase.id);
            const isExpanded = expandedId === phase.id;
            
            // Check if section header is needed
            const showSection = index === 0 || phase.section !== MASTER_PLAN[index - 1].section;

            return (
              <React.Fragment key={phase.id}>
                {showSection && (
                    <div className="mt-8 mb-4 border-b-2 border-dashed border-black pb-1">
                        <h2 className="font-black text-xl uppercase tracking-tighter text-black bg-[#ffc900] inline-block px-2 transform -rotate-1 shadow-[2px_2px_0_0_#000]">
                            {phase.section}
                        </h2>
                    </div>
                )}

                <div 
                    onClick={() => setExpandedId(isExpanded ? null : phase.id)}
                    className={`${BRUTAL.card} ${isExpanded ? 'shadow-[8px_8px_0_0_#000] -translate-y-1' : 'hover:shadow-[6px_6px_0_0_#000]'} cursor-pointer bg-white group`}
                >
                    {/* Header Row */}
                    <div className="flex items-center gap-4">
                    <div 
                        onClick={(e) => toggleCheck(e, phase.id)}
                        className={`w-8 h-8 border-2 border-black flex shrink-0 items-center justify-center transition-colors ${isChecked ? 'bg-[#ffc900] text-black' : 'bg-white hover:bg-gray-100'}`}
                    >
                        {isChecked && <span className="font-black text-lg">✓</span>}
                    </div>
                    
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-black uppercase bg-black text-white px-1.5 py-0.5 ${isChecked ? 'opacity-50' : ''}`}>Phase {phase.id}</span>
                            <h3 className={`text-xl font-black uppercase ${isChecked ? 'line-through text-gray-400' : 'text-black'}`}>{phase.title}</h3>
                        </div>
                        {!isExpanded && <p className="text-xs font-medium text-gray-500 truncate max-w-[80%]">{phase.desc}</p>}
                    </div>

                    <div className={`transform transition-transform duration-300 font-black text-xl text-black ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                        ▼
                    </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                    <div className="mt-6 pt-6 border-t-2 border-dashed border-black animate-in fade-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                            <div className="col-span-2">
                                <h4 className="font-bold uppercase text-xs mb-2 text-black">Detailed Instructions</h4>
                                <p className="text-sm font-medium leading-relaxed text-black whitespace-pre-wrap">{phase.details}</p>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-bold uppercase text-xs mb-2 text-black">Tools Stack</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {phase.tools.map(t => (
                                            <span key={t} className="bg-gray-100 border border-black px-2 py-1 text-[10px] font-bold uppercase text-black">{t}</span>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-bold uppercase text-xs mb-2 text-black">Estimated Cost</h4>
                                    <span className="bg-[#ff90e8] text-black border-2 border-black px-2 py-1 text-xs font-bold uppercase shadow-[2px_2px_0_0_#000]">{phase.cost}</span>
                                </div>
                            </div>
                        </div>

                        {phase.prompts.length > 0 && (
                            <div className="bg-black p-4 text-white border-2 border-black shadow-[4px_4px_0_0_#ccc]">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold uppercase text-xs text-[#ffc900]">System Prompts & Commands</h4>
                                    <span className="text-[10px] text-gray-400 font-mono">One-Click Copy</span>
                                </div>
                                
                                <div className="relative group/prompt">
                                    <pre className="font-mono text-[10px] bg-[#222] p-3 border border-gray-700 whitespace-pre-wrap text-gray-300 max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {phase.prompts.join('\n\n')}
                                    </pre>
                                    <button 
                                        onClick={(e) => handleCopy(e, phase.prompts.join('\n\n'))}
                                        className="absolute top-2 right-2 bg-white text-black text-[10px] font-bold uppercase px-3 py-1.5 hover:bg-[#ffc900] shadow-[2px_2px_0_0_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                                    >
                                        {copiedPrompt === phase.prompts.join('\n\n') ? 'COPIED!' : 'COPY FULL PROMPT'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
