import React from 'react';

interface Props {
  nodeCount: number;
  cost: number;
  sizeLabel?: string;
  target: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Four bands aligned with cost tiers; user-friendly names (trophy-style). */
function getComplexityLabel(nodes: number): string {
  if (nodes <= 500) return 'Chill';
  if (nodes <= 5_000) return 'Hustle';
  if (nodes <= 50_000) return 'Beast';
  return 'Legend';
}

function roundTo3SigFigs(n: number): number {
  if (n < 1000) return n;
  const exp = Math.floor(Math.log10(n));
  const scale = Math.pow(10, exp - 2);
  return Math.round(n / scale) * scale;
}

export const ScanReceiptModal: React.FC<Props> = ({ nodeCount, cost, sizeLabel, target, onConfirm, onCancel }) => {
  const targetOnly = target.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const sizeDisplay = sizeLabel === '200k+' ? '200k+' : roundTo3SigFigs(nodeCount).toLocaleString();

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6">
      <div className="bg-white border-2 border-black shadow-[8px_8px_0_0_#fff] max-w-xs w-full font-mono relative overflow-hidden">
        
        {/* Receipt Header */}
        <div className="bg-yellow-400 text-black p-3 text-center border-b-2 border-dashed border-black">
          <h3 className="font-bold uppercase text-lg tracking-widest">Calculation Results</h3>
          <p className="text-[10px]">Everything in detail</p>
        </div>

        {/* Receipt Body: gap tra label e valore, padding uniforme per evitare che il testo a destra sbatta con la label */}
        <div className="p-6 text-xs space-y-0">
          <div className="flex gap-3 items-start border-b border-black/10 py-3 first:pt-0">
            <span className="text-gray-500 uppercase shrink-0 pt-0.5">Target</span>
            <span className="font-bold min-w-0 text-right leading-relaxed break-words">{targetOnly}</span>
          </div>

          <div className="flex gap-3 items-center border-b border-black/10 py-3">
            <span className="text-gray-500 uppercase shrink-0">Size</span>
            <span className="font-bold min-w-0 text-right">{sizeDisplay}</span>
          </div>

          <div className="flex gap-3 items-center border-b border-black/10 py-3">
            <span className="text-gray-500 uppercase shrink-0">Complexity</span>
            <span className="font-bold min-w-0 text-right">{getComplexityLabel(nodeCount)}</span>
          </div>

          <div className="flex gap-3 items-center pt-3">
            <span className="font-black uppercase text-sm shrink-0">TOTAL COST</span>
            <span className="min-w-0 flex justify-end">
              <span className="bg-black text-white font-black px-2 py-1 border border-black shadow-[2px_2px_0_0_#999]">
                {cost} CREDITS
              </span>
            </span>
          </div>
        </div>

        {/* Receipt Footer Actions */}
        <div className="p-4 bg-gray-50 border-t-2 border-dashed border-black flex flex-col gap-2">
          <button 
            onClick={onConfirm}
            className="w-full bg-black text-white border-2 border-black py-3 font-bold uppercase hover:bg-yellow-400 hover:text-black hover:border-black transition-colors shadow-[4px_4px_0_0_#000] active:translate-y-1 active:shadow-none"
          >
            Authorize Charge
          </button>
          <button 
            onClick={onCancel}
            className="w-full text-[10px] font-bold uppercase text-gray-500 hover:text-black py-2 underline"
          >
            Cancel Operation
          </button>
        </div>

        {/* Decorative Sawtooth Bottom */}
        <div className="h-2 bg-black w-full" style={{ clipPath: 'polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 0%, 85% 100%, 90% 0%, 95% 100%, 100% 0%)' }}></div>
      </div>
    </div>
  );
};
