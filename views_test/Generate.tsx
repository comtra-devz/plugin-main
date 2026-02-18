import React, { useState } from 'react';
import { BRUTAL, COLORS } from '../constants_test';
import { generateDesignSuggestions } from '../services_test/geminiService';
import { UserPlan } from '../types_test';

interface Props { 
  plan: UserPlan; 
  onUnlockRequest: () => void;
  usageCount: number;
  onUse: () => void;
}

const INSPIRATION = [
  "Create 2 wireframes for cart checkout A/B testing",
  "Suggest a color palette inspired by a rainy Tokyo night",
  "Improve accessibility for my primary buttons",
];

const MAX_FREE_USES = 3;

export const Generate: React.FC<Props> = ({ plan, onUnlockRequest, usageCount, onUse }) => {
  const [p, setP] = useState('');
  const [res, setRes] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);

  const isPro = plan === 'PRO';
  const remaining = Math.max(0, MAX_FREE_USES - usageCount);
  const canGenerate = isPro || remaining > 0;

  const handleGen = async () => {
    if (!canGenerate) {
      onUnlockRequest();
      return;
    }
    setLoading(true);
    if (!isPro) onUse();
    
    // In real app, we'd pass selectedLayer context to AI
    const result = await generateDesignSuggestions(p);
    setRes(result);
    setLoading(false);
  };

  return (
    <div className="p-4 flex flex-col gap-4 pb-24">
      {/* Credit Banner */}
      <div className="flex justify-center mb-2">
          <div className={`transform -rotate-2 border-2 border-black px-3 py-1 text-[10px] font-black uppercase shadow-[3px_3px_0_0_#000] ${remaining === 0 && !isPro ? 'bg-red-100 text-red-600' : 'bg-[#ffc900] text-black'}`}>
            {isPro ? 'Credits: ∞' : `Free Exports Remaining: ${remaining}/${MAX_FREE_USES}`}
          </div>
      </div>

       {/* Layer Selection */}
      <div className={`${BRUTAL.card} bg-white py-2 flex flex-col gap-2`}>
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold uppercase">Context Layer</span>
          <button onClick={() => setSelectedLayer(selectedLayer ? null : "Hero_Section_V2")} className="text-[10px] font-bold bg-black text-white px-2 py-1">
            {selectedLayer ? 'Clear Selection' : 'Select Layer'}
          </button>
        </div>
        {selectedLayer ? (
          <span className="font-mono text-xs text-blue-600 bg-blue-50 p-1 border border-blue-200 block truncate">Target: {selectedLayer}</span>
        ) : (
          <span className="text-[10px] text-gray-400 italic">No layer selected. Creating new wireframes.</span>
        )}
      </div>

      <div className="bg-black text-white p-2 text-xs font-bold uppercase flex justify-between items-center">
        <span>AI Terminal</span>
        <span className="opacity-70 font-mono">v1.0-TEST</span>
      </div>
      
      <textarea 
        className={`${BRUTAL.input} min-h-[120px] text-sm bg-white focus:!bg-white`} 
        placeholder={selectedLayer ? `> Modify ${selectedLayer}: e.g. "Make it pop with more contrast"` : "> Describe your dream UI..."}
        value={p} 
        onChange={(e) => setP(e.target.value)}
        disabled={!canGenerate && !isPro} 
      />
      
      <button 
        onClick={handleGen} 
        className={`${BRUTAL.btn} ${canGenerate ? `bg-[${COLORS.primary}]` : 'bg-gray-300 text-gray-500'}`}
      >
        {loading ? 'Weaving Magic...' : !isPro && remaining === 0 ? 'Unlock Unlimited AI' : (
            selectedLayer ? `Modify Component ${!isPro ? `(${remaining} left)` : ''}` : `Create Wireframes ${!isPro ? `(${remaining} left)` : ''}`
        )}
      </button>

      <div className="mt-2">
        <p className="text-[10px] font-bold uppercase text-gray-500 mb-2">Try asking the stars:</p>
        <div className="flex flex-wrap gap-2">
          {INSPIRATION.map(txt => (
            <button 
              key={txt} 
              onClick={() => setP(txt)} 
              disabled={!canGenerate}
              className={`text-[10px] border border-black px-2 py-1 bg-white transition-colors text-left ${canGenerate ? 'hover:bg-[#ffc900]' : 'opacity-50'}`}
            >
              {txt}
            </button>
          ))}
        </div>
      </div>

      {res && <div className={`${BRUTAL.card} font-mono text-xs bg-[#f0f0f0] whitespace-pre-wrap animate-in slide-in-from-bottom-2`}>{res}</div>}
    </div>
  );
};