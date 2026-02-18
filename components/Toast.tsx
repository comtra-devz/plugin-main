import React from 'react';
import { BRUTAL, COLORS } from '../constants';

interface Props {
  message: string;
  onUndo: () => void;
  onClose: () => void;
}

export const Toast: React.FC<Props> = ({ message, onUndo, onClose }) => (
  <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[80] animate-in slide-in-from-bottom-2 w-full max-w-xs px-4">
    <div className={`${BRUTAL.card} bg-black text-white flex items-center justify-between py-3 shadow-[4px_4px_0px_0px_#fff]`}>
      <span className="text-xs font-bold mr-2">{message}</span>
      <div className="flex gap-2">
        <button onClick={onUndo} className="text-[#ff90e8] text-xs font-black uppercase underline decoration-2">UNDO</button>
        <button onClick={onClose} className="text-gray-500 hover:text-white">×</button>
      </div>
    </div>
  </div>
);