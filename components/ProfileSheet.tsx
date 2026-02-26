
import React from 'react';
import { APP_VERSION, COLORS } from '../constants';
import { User } from '../types';

interface Props {
  user: User;
  creditsLabel: string;
  lowCreditsWarning?: boolean;
  isTestUser?: boolean;
  simulateFreeTier?: boolean;
  onSimulateFreeTierChange?: (value: boolean) => void;
  usingSimulatedCredits?: boolean;
  onResetSimulatedCredits?: () => void;
  onClose: () => void;
  onLogout: () => void;
  onManageSub: () => void;
  onOpenDocs: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onOpenAffiliate: () => void;
}

export const ProfileSheet: React.FC<Props> = ({ user, creditsLabel, lowCreditsWarning, isTestUser, simulateFreeTier, onSimulateFreeTierChange, usingSimulatedCredits, onResetSimulatedCredits, onClose, onLogout, onManageSub, onOpenDocs, onOpenPrivacy, onOpenTerms, onOpenAffiliate }) => (
  <div className="fixed inset-0 z-[60]">
    <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
    <div data-component="Profile: Sheet Container" className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] absolute top-16 right-4 w-72 overflow-hidden animate-in slide-in-from-top-2">
      <div className={`bg-[${COLORS.primary}] p-4 border-b-2 border-black`}>
        <h3 data-component="Profile: User Email" className="font-black text-sm break-words">{user.email || '—'}</h3>
        <div className="flex justify-between items-center mt-2 gap-1">
            <span data-component="Profile: Plan Badge" className="inline-block bg-black text-white text-[10px] px-2 py-0.5 font-bold uppercase shrink-0">{user.plan} PLAN</span>
            <span data-component="Profile: Credits Badge" className="text-[10px] font-bold uppercase border-2 border-black px-2 py-0.5 bg-white min-w-0">Credits: {creditsLabel}</span>
        </div>
        {lowCreditsWarning && (
          <p data-component="Profile: Low Credits Warning" className="text-[10px] font-bold uppercase mt-2 bg-[#ffc900] border border-black px-2 py-1">
            Credits in esaurimento — Passa a PRO
          </p>
        )}
        {simulateFreeTier && creditsLabel.includes('—') && (
          <p data-component="Profile: Simulate Free Tier Sync Hint" className="text-[10px] font-bold mt-2 bg-white/90 border border-black px-2 py-1">
            Con Simula Free Tier attivo servono i crediti dal server: effettua di nuovo il <strong>login</strong> (Logout poi Login with Figma) per vedere i 25 crediti free.
          </p>
        )}
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
        
        {isTestUser && onSimulateFreeTierChange && (
          <div className="p-2 border border-dashed border-gray-400 bg-gray-50 mb-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-gray-700">Simula Free Tier</span>
              <button
                data-component="Profile: Simulate Free Tier Toggle"
                onClick={() => onSimulateFreeTierChange(!simulateFreeTier)}
                className={`text-[10px] font-bold uppercase px-2 py-1 border-2 border-black shrink-0 ${simulateFreeTier ? 'bg-[#ffc900] text-black' : 'bg-white text-gray-600'}`}
              >
                {simulateFreeTier ? 'ON' : 'OFF'}
              </button>
            </div>
            <p className="text-[9px] text-gray-500 mt-1">ON = limiti reali (25 credits, paywall a 0)</p>
            {usingSimulatedCredits && onResetSimulatedCredits && (
              <button type="button" onClick={onResetSimulatedCredits} className="text-[9px] font-bold text-gray-600 underline mt-1 hover:text-black">
                Reset 25 crediti simulati
              </button>
            )}
          </div>
        )}
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
          onClick={() => { onClose(); onLogout(); }} 
          className="text-left text-sm font-bold hover:bg-red-100 text-red-600 p-2 border border-transparent hover:border-black transition-all w-full"
        >
          Logout
        </button>
      </div>
      <div data-component="Profile: Footer Version" className="bg-gray-100 p-2 text-[10px] font-mono text-center border-t-2 border-black">
        v{APP_VERSION}
      </div>
    </div>
  </div>
);
