import React from 'react';
import { BRUTAL, COLORS } from '../constants_test';
import { User } from '../types_test';

interface Props {
  user: User;
  onClose: () => void;
  onLogout: () => void;
  onManageSub: () => void;
  onOpenDocs: () => void;
  onOpenPrivacy: () => void;
}

export const ProfileSheet: React.FC<Props> = ({ user, onClose, onLogout, onManageSub, onOpenDocs, onOpenPrivacy }) => (
  <div className="fixed inset-0 z-[60]">
    <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
    <div className={`${BRUTAL.card} absolute top-16 right-4 w-64 p-0 overflow-hidden animate-in slide-in-from-top-2`}>
      <div className={`bg-[${COLORS.primary}] p-4 border-b-2 border-black`}>
        <h3 className="font-black uppercase text-sm">{user.email}</h3>
        <span className="inline-block bg-black text-white text-[10px] px-2 py-0.5 mt-2 font-bold uppercase">{user.plan} PLAN</span>
      </div>
      <div className="p-2 flex flex-col gap-1">
        <button 
          onClick={() => window.open('https://comtra.ai/partner', '_blank')}
          className="text-left text-sm font-bold bg-[#ffc900] hover:bg-yellow-400 p-2 border-2 border-black mb-2 flex justify-between items-center shadow-[2px_2px_0_0_#000]"
        >
          <span>Become Partner</span>
          <span>→</span>
        </button>
        
        <button 
          onClick={onManageSub}
          className="text-left text-sm font-bold hover:bg-gray-100 p-2 border border-transparent hover:border-black transition-all"
        >
          Manage Subscription
        </button>
        <button 
          onClick={onOpenDocs}
          className="text-left text-sm font-bold hover:bg-gray-100 p-2 border border-transparent hover:border-black transition-all"
        >
          Documentation & Help
        </button>
        <button 
          onClick={onOpenPrivacy}
          className="text-left text-sm font-bold hover:bg-gray-100 p-2 border border-transparent hover:border-black transition-all"
        >
          Privacy & Policy
        </button>
        <div className="h-px bg-black my-1"></div>
        <button onClick={onLogout} className="text-left text-sm font-bold hover:bg-red-100 text-red-600 p-2 border border-transparent hover:border-black transition-all">
          Logout
        </button>
      </div>
      <div className="bg-gray-100 p-2 text-[10px] font-mono text-center border-t-2 border-black">
        v1.0.6-TEST
      </div>
    </div>
  </div>
);