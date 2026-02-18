
import React from 'react';
import { BRUTAL, COLORS } from '../constants';
import { Confetti } from './Confetti.tsx';

interface Props {
  oldLevel: number;
  newLevel: number;
  discount: number;
  onClose: () => void;
}

export const LevelUpModal: React.FC<Props> = ({ oldLevel, newLevel, discount, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-6 animate-in fade-in">
      <Confetti />
      <div className={`${BRUTAL.card} max-w-xs w-full bg-white text-center relative overflow-hidden transform transition-all scale-100`}>
        {/* Decorative Background */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#ff90e8] via-[#ffc900] to-[#ff90e8]"></div>
        <span className="absolute top-2 right-2 text-[8px] bg-yellow-400 border border-black px-1 font-bold">TEST</span>
        
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
            <div className="bg-[#ffc900] p-4 border-2 border-black mb-6 transform -rotate-1 shadow-[4px_4px_0_0_#000]">
                <p className="text-[10px] font-bold uppercase mb-1">New Reward Unlocked</p>
                <p className="text-2xl font-black">{discount}% OFF</p>
                <p className="text-[10px] font-medium">On Annual Pro Plan</p>
            </div>
        )}

        <button 
            onClick={onClose}
            className={`${BRUTAL.btn} w-full bg-black text-white hover:bg-[#ff90e8] hover:text-black transition-colors`}
        >
            Claim Rewards
        </button>
      </div>
    </div>
  );
};
