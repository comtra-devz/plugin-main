
import React from 'react';
import { BRUTAL, COLORS } from '../constants';
import { User } from '../types';

interface Props {
  user: User;
  creditsLabel: string;
  onClose: () => void;
  onLogout: () => void;
  onManageSub: () => void;
  onOpenDocs: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onOpenAffiliate: () => void;
}

export const ProfileSheet: React.FC<Props> = ({ user, creditsLabel, onClose, onLogout, onManageSub, onOpenDocs, onOpenPrivacy, onOpenTerms, onOpenAffiliate }) => (
  <div className="fixed inset-0 z-[60]">
    <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
    <div data-component="Profile: Sheet Container" className={`${BRUTAL.card} absolute top-16 right-4 w-64 p-0 overflow-hidden animate-in slide-in-from-top-2`}>
      <div className={`bg-[${COLORS.primary}] p-4 border-b-2 border-black`}>
        <h3 data-component="Profile: User Email" className="font-black uppercase text-sm">{user.email}</h3>
        <div className="flex justify-between items-center mt-2">
            <span data-component="Profile: Plan Badge" className="inline-block bg-black text-white text-[10px] px-2 py-0.5 font-bold uppercase">{user.plan} PLAN</span>
            <span data-component="Profile: Credits Badge" className="text-[10px] font-bold uppercase border-2 border-black px-2 py-0.5 bg-white">Credits: {creditsLabel}</span>
        </div>
      </div>
      <div className="p-2 flex flex-col gap-1">
        <button 
          data-component="Profile: Partner Button"
          onClick={() => window.open('https://comtra.ai/partner', '_blank')}
          className="text-left text-sm font-bold bg-[#ffc900] hover:bg-yellow-400 p-2 border-2 border-black mb-2 flex justify-between items-center shadow-[2px_2px_0_0_#000]"
        >
          <span>Become Partner</span>
          <span>→</span>
        </button>
        
        <button 
          data-component="Profile: Manage Sub Button"
          onClick={onManageSub}
          className="text-left text-sm font-bold hover:bg-gray-100 p-2 border border-transparent hover:border-black transition-all"
        >
          Manage Subscription
        </button>
        <button 
          onClick={onOpenAffiliate}
          className="text-left text-sm font-bold hover:bg-gray-100 p-2 border border-transparent hover:border-black transition-all"
        >
          Affiliate Program
        </button>
        <button 
          data-component="Profile: Docs Button"
          onClick={onOpenDocs}
          className="text-left text-sm font-bold hover:bg-gray-100 p-2 border border-transparent hover:border-black transition-all"
        >
          Documentation & Help
        </button>
        <button 
          data-component="Profile: Terms Button"
          onClick={onOpenTerms}
          className="text-left text-sm font-bold hover:bg-gray-100 p-2 border border-transparent hover:border-black transition-all"
        >
          Terms & Conditions
        </button>
        <button 
          data-component="Profile: Privacy Button"
          onClick={onOpenPrivacy}
          className="text-left text-sm font-bold hover:bg-gray-100 p-2 border border-transparent hover:border-black transition-all"
        >
          Privacy & Policy
        </button>
        <div className="h-px bg-black my-1"></div>
        <button 
          data-component="Profile: Logout Button"
          onClick={onLogout} 
          className="text-left text-sm font-bold hover:bg-red-100 text-red-600 p-2 border border-transparent hover:border-black transition-all"
        >
          Logout
        </button>
      </div>
      <div data-component="Profile: Footer Version" className="bg-gray-100 p-2 text-[10px] font-mono text-center border-t-2 border-black">
        v1.0.7
      </div>
    </div>
  </div>
);
