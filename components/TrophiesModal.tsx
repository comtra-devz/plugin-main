import React from 'react';
import { BRUTAL } from '../constants';
import { Confetti } from './Confetti.tsx';

interface Props {
  trophies: Array<{ id: string; name: string }>;
  onClose: () => void;
  onViewStats: () => void;
}

export const TrophiesModal: React.FC<Props> = ({ trophies, onClose, onViewStats }) => {
  return (
    <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center p-6 animate-in fade-in">
      <Confetti />
      <div className={`${BRUTAL.card} max-w-xs w-full bg-white text-center relative overflow-hidden transform transition-all scale-100`}>
        {/* Decorative Background */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#ff90e8] via-[#ffc900] to-[#ff90e8]"></div>

        <div className="mb-4 mt-2">
          <span className="text-4xl animate-bounce inline-block">🏆</span>
        </div>

        <h2 className="text-3xl font-black uppercase mb-1 tracking-tighter">Badges Unlocked!</h2>
        <p className="text-[10px] font-bold uppercase text-gray-500 mb-4">
          {trophies.length} {trophies.length === 1 ? 'badge' : 'badges'} sbloccat{trophies.length === 1 ? 'o' : 'i'}
        </p>

        <div className="mb-6 max-h-32 overflow-y-auto">
          <ul className="text-left space-y-1">
            {trophies.map((t) => (
              <li key={t.id} className="text-sm font-bold flex items-center gap-2">
                <span className="text-[#ffc900]">★</span>
                {t.name}
              </li>
            ))}
          </ul>
        </div>

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
