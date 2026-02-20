
import React from 'react';
import { BRUTAL } from '../constants';

interface Props {
  nodeCount: number;
  cost: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ScanReceiptModal: React.FC<Props> = ({ nodeCount, cost, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6">
      <div className="bg-white border-2 border-black shadow-[8px_8px_0_0_#fff] max-w-xs w-full font-mono relative overflow-hidden">
        
        {/* Receipt Header */}
        <div className="bg-yellow-400 text-black p-3 text-center border-b-2 border-dashed border-black">
          <h3 className="font-bold uppercase text-lg tracking-widest">Scan Receipt</h3>
          <p className="text-[10px]">Simulated charge</p>
        </div>

        {/* Receipt Body */}
        <div className="p-6 text-xs space-y-4">
          <div className="flex justify-between border-b border-black/10 pb-2">
            <span className="text-gray-500 uppercase">Target</span>
            <span className="font-bold">Current Selection</span>
          </div>
          
          <div className="flex justify-between border-b border-black/10 pb-2">
            <span className="text-gray-500 uppercase">Est. Nodes</span>
            <span className="font-bold">{nodeCount}</span>
          </div>

          <div className="flex justify-between border-b border-black/10 pb-2">
            <span className="text-gray-500 uppercase">Complexity</span>
            <span className="font-bold">{nodeCount > 250 ? 'HIGH (Enterprise)' : 'STD (Regular)'}</span>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="font-black uppercase text-sm">TOTAL COST</span>
            <span className="bg-black text-white font-black px-2 py-1 border border-black shadow-[2px_2px_0_0_#999]">
              {cost} CREDITS
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
