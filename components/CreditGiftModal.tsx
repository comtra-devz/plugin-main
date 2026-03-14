import React from 'react';
import { BRUTAL } from '../constants';
import { Confetti } from './Confetti.tsx';

interface Props {
  creditsAdded: number;
  onClose: () => void;
}

export const CreditGiftModal: React.FC<Props> = ({ creditsAdded, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-6 animate-in fade-in">
      <Confetti />
      <div className={`${BRUTAL.card} max-w-xs w-full bg-white text-center relative overflow-hidden transform transition-all scale-100`}>
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#ff90e8] via-[#ffc900] to-[#ff90e8]"></div>

        <div className="mb-4 mt-2">
          <span className="text-4xl animate-bounce inline-block">🎁</span>
        </div>

        <h2 className="text-3xl font-black uppercase mb-1 tracking-tighter">Hai ricevuto un regalo!</h2>
        <p className="text-gray-600 text-sm mb-4">Crediti aggiunti al tuo account</p>

        <div className="bg-[#ffc900] p-4 border-2 border-black mb-6 transform -rotate-1 shadow-[4px_4px_0_0_#000]">
          <p className="text-[10px] font-bold uppercase mb-1">Crediti bonus</p>
          <p className="text-3xl font-black">+{creditsAdded}</p>
        </div>

        <button
          onClick={onClose}
          className={`${BRUTAL.btn} w-full bg-black text-white hover:bg-[#ff90e8] hover:text-black transition-colors`}
        >
          Continua
        </button>
      </div>
    </div>
  );
};
