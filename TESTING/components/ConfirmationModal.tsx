
import React from 'react';
import { BRUTAL } from '../constants';

interface Props {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  isWarning?: boolean;
}

export const ConfirmationModal: React.FC<Props> = ({ title, message, onConfirm, onCancel, confirmLabel = 'Confirm', isWarning = false }) => {
  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6">
      <div className={`${BRUTAL.card} max-w-xs w-full bg-white relative animate-in zoom-in-95 duration-200`}>
        <div className={`text-center border-b-2 border-black pb-2 mb-4 ${isWarning ? 'bg-red-100 -mx-4 -mt-4 p-4 border-b-2 border-black' : ''}`}>
            <h3 className={`font-black uppercase text-lg ${isWarning ? 'text-red-600' : 'text-black'}`}>
                {title} <span className="text-[8px] bg-yellow-400 text-black px-1 ml-1 align-top border border-black">TEST</span>
            </h3>
        </div>
        
        <p className="text-xs font-medium text-gray-700 mb-6 leading-relaxed text-center">
            {message}
        </p>

        <div className="flex flex-col gap-2">
            <button 
                onClick={onConfirm}
                className={`${BRUTAL.btn} w-full ${isWarning ? 'bg-red-600 text-white border-red-800 hover:bg-red-700' : 'bg-black text-white hover:bg-gray-800'} active:translate-y-1 active:shadow-none`}
            >
                {confirmLabel}
            </button>
            <button 
                onClick={onCancel}
                className="text-[10px] font-bold uppercase underline text-gray-500 hover:text-black text-center py-2"
            >
                Cancel
            </button>
        </div>
      </div>
    </div>
  );
};
