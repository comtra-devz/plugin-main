import React from 'react';
import { BRUTAL, COLORS } from '../constants_test';

interface Props { onClose: () => void; score: number }

export const SuccessModal: React.FC<Props> = ({ onClose, score }) => {
  const handleShare = () => {
    const text = `I just reached a ${score}% Design System health score on Comtra! 🚀`;
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://comtra.ai')}&summary=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-6">
      <div className={`${BRUTAL.card} bg-white text-center animate-in zoom-in-90 slide-in-from-bottom-6 duration-300`}>
        <div className="text-4xl mb-2 animate-[bounce_1s_1]">🎉</div>
        <h2 className="text-2xl font-black uppercase mb-2">Harmony Achieved</h2>
        <p className="text-xs font-medium text-gray-500 mb-6">
          The pixels are singing in perfect unison.<br/>Your score has risen to the stars.
        </p>
        <div className="text-5xl font-black mb-6 bg-[#ffc900] inline-block px-2 border-2 border-black transform -rotate-2">
          {score}%
        </div>
        <button onClick={handleShare} className={`${BRUTAL.btn} bg-[${COLORS.primary}] w-full mb-3`}>
          Share the Magic (LinkedIn)
        </button>
        <button onClick={onClose} className="text-[10px] font-bold underline text-gray-400 uppercase">
          Continue fixing
        </button>
      </div>
    </div>
  );
};