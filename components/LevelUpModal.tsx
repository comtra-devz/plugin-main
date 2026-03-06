import React, { useState } from 'react';
import { BRUTAL } from '../constants';
import { Confetti } from './Confetti.tsx';

interface Props {
  oldLevel: number;
  newLevel: number;
  discount: number;
  /** Unique discount code for this user (Annual plan). Shown when discount > 0. */
  discountCode?: string | null;
  onClose: () => void;
  /** Navigate to Stats tab (e.g. to see discount). */
  onViewStats: () => void;
}

export const LevelUpModal: React.FC<Props> = ({ oldLevel, newLevel, discount, discountCode, onClose, onViewStats }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (!discountCode) return;
    navigator.clipboard.writeText(discountCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-6 animate-in fade-in">
      <Confetti />
      <div className={`${BRUTAL.card} max-w-xs w-full bg-white text-center relative overflow-hidden transform transition-all scale-100`}>
        {/* Decorative Background */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#ff90e8] via-[#ffc900] to-[#ff90e8]"></div>

        <div className="mb-4 mt-2">
          <span className="text-4xl animate-bounce inline-block">🚀</span>
        </div>

        <h2 className="text-3xl font-black uppercase mb-1 tracking-tighter">Level Up!</h2>
        <div className="flex items-center justify-center gap-4 text-sm font-bold uppercase mb-6 text-gray-500">
          <span>Lvl {oldLevel}</span>
          <span className="text-xl text-black">→</span>
          <span className="bg-black text-white px-2 py-1">Lvl {newLevel}</span>
        </div>

        {discount > 0 && (
          <div className="bg-[#ffc900] p-4 border-2 border-black mb-4 transform -rotate-1 shadow-[4px_4px_0_0_#000]">
            <p className="text-[10px] font-bold uppercase mb-1">New Reward Unlocked</p>
            <p className="text-2xl font-black">{discount}% OFF</p>
            <p className="text-[10px] font-medium">On Annual Pro Plan</p>
            {discountCode && (
              <div className="mt-3 pt-3 border-t-2 border-black/20">
                <p className="text-[10px] font-bold uppercase mb-1">Your code (one-time use)</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="font-mono text-sm font-black bg-white px-2 py-1 border-2 border-black">
                    {discountCode}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className={`${BRUTAL.btn} text-[10px] px-2 py-1 border-2 border-black bg-black text-white hover:bg-[#ff90e8] hover:text-black transition-colors`}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-[9px] text-gray-600 mt-1">Use at checkout for Annual plan</p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={onViewStats}
            className={`${BRUTAL.btn} w-full bg-black text-white hover:bg-[#ff90e8] hover:text-black transition-colors`}
          >
            View in Stats
          </button>
          <button
            onClick={onClose}
            className={`${BRUTAL.btn} w-full border-2 border-black bg-white text-black hover:bg-gray-100 transition-colors`}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};
