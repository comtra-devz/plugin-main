
import React from 'react';
import { APP_VERSION, COLORS } from '../constants';
import { User } from '../types';

interface Props {
  user: User;
  creditsLabel: string;
  /** When credits show "—", optional reason (e.g. "401", "503", "network") for debugging. */
  creditsFetchError?: string | null;
  /** Callback to retry fetching credits (e.g. when sync failed). */
  onRetryCredits?: () => void;
  lowCreditsWarning?: boolean;
  isTestUser?: boolean;
  simulateFreeTier?: boolean;
  onSimulateFreeTierChange?: (value: boolean) => void;
  usingSimulatedCredits?: boolean;
  onResetSimulatedCredits?: () => void;
  onClose: () => void;
  onLogout: () => void;
  onManageSub: () => void;
  onPersonalDetails: () => void;
  onOpenDocs: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

/** Dot finché non c’è profilo salvato (magic) o c’è conflitto Figma. */
function showPersonalDetailsDot(u: User): boolean {
  if (u.name_conflict && typeof u.name_conflict === 'object') return true;
  if (u.show_profile_badge) return true;
  const hasFigma = u.figma_user_id != null && String(u.figma_user_id).trim() !== '';
  if (hasFigma) return false;
  if (u.profile_saved_at) return false;
  return true;
}

export const ProfileSheet: React.FC<Props> = ({ user, creditsLabel, creditsFetchError, onRetryCredits, lowCreditsWarning, isTestUser, simulateFreeTier, onSimulateFreeTierChange, usingSimulatedCredits, onResetSimulatedCredits, onClose, onLogout, onManageSub, onPersonalDetails, onOpenDocs, onOpenPrivacy, onOpenTerms }) => (
  <div className="fixed inset-0 z-[60]">
    <div className="absolute inset-0 bg-black/50" onClick={onClose}></div>
    <div data-component="Profile: Sheet Container" className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] absolute top-16 right-4 w-72 overflow-hidden animate-in slide-in-from-top-2">
      <div className={`bg-[${COLORS.primary}] p-4 border-b-2 border-black`}>
        <h3 data-component="Profile: User Email" className="font-black text-sm break-words">{user.email || '—'}</h3>
        <div className="flex justify-between items-center mt-2 gap-1 flex-wrap">
            <span data-component="Profile: Plan Badge" className="inline-block bg-black text-white text-[10px] px-2 py-0.5 font-bold uppercase shrink-0">{user.plan} PLAN</span>
            {user.tags?.includes('enterprise') && (
              <span data-component="Profile: Enterprise Tag" className="inline-block bg-indigo-600 text-white text-[10px] px-2 py-0.5 font-bold uppercase shrink-0">Enterprise</span>
            )}
            <span data-component="Profile: Credits Badge" className="text-[10px] font-bold uppercase border-2 border-black px-2 py-0.5 bg-white min-w-0">Credits: {creditsLabel}</span>
        </div>
        {lowCreditsWarning && (
          <p data-component="Profile: Low Credits Warning" className="text-[10px] font-bold uppercase mt-2 bg-[#ffc900] border border-black px-2 py-1">
            Credits running low — Upgrade to PRO
          </p>
        )}
        {creditsFetchError && creditsLabel.includes('—') && (
          <div data-component="Profile: Credits Sync Error" className="mt-2 space-y-1">
            <p className="text-[10px] font-bold bg-red-100 border border-red-600 px-2 py-1 text-red-800">
              Credits sync failed: {creditsFetchError === 'network' ? 'network error' : `HTTP ${creditsFetchError}`}. Check Stato servizi in the dashboard.
            </p>
            {onRetryCredits && (
              <button type="button" onClick={onRetryCredits} className="text-[10px] font-bold underline focus:outline-none focus:ring-2 focus:ring-black">
                Riprova
              </button>
            )}
          </div>
        )}
        {simulateFreeTier && creditsLabel.includes('—') && !creditsFetchError && (
          <p data-component="Profile: Simulate Free Tier Sync Hint" className="text-[10px] font-bold mt-2 bg-white/90 border border-black px-2 py-1">
            With Simulate Free Tier on, credits come from the server: <strong>log in</strong> again (Log out, then sign in with your email link or Figma OAuth) to see the 25 free credits.
          </p>
        )}
      </div>
      <div className="p-2 flex flex-col gap-1">
        <button 
          data-component="Profile: Partner Button"
          onClick={() => window.open('https://comtra.dev/partner', '_blank')}
          className="text-left text-sm font-bold bg-[#ffc900] hover:bg-yellow-400 p-2 border-2 border-black mb-2 flex justify-between items-center shadow-[2px_2px_0_0_#000]"
        >
          <span>Become Partner</span>
          <span>→</span>
        </button>
        
        {isTestUser && onSimulateFreeTierChange && (
          <div className="p-2 border border-dashed border-gray-400 bg-gray-50 mb-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-gray-700">Simulate Free Tier</span>
              <button
                data-component="Profile: Simulate Free Tier Toggle"
                onClick={() => onSimulateFreeTierChange(!simulateFreeTier)}
                className={`text-[10px] font-bold uppercase px-2 py-1 border-2 border-black shrink-0 ${simulateFreeTier ? 'bg-[#ffc900] text-black' : 'bg-white text-gray-600'}`}
              >
                {simulateFreeTier ? 'ON' : 'OFF'}
              </button>
            </div>
            <p className="text-[9px] text-gray-500 mt-1">ON = real limits (25 credits, paywall at 0)</p>
            {usingSimulatedCredits && onResetSimulatedCredits && (
              <button type="button" onClick={onResetSimulatedCredits} className="text-[9px] font-bold text-gray-600 underline mt-1 hover:text-black">
                Reset 25 simulated credits
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
          data-component="Profile: Personal Details"
          onClick={onPersonalDetails}
          className="text-left text-sm font-bold hover:bg-gray-100 p-2 border border-transparent hover:border-black transition-all w-full grid grid-cols-[1fr_24px] items-center gap-2"
        >
          <span className="truncate">Personal details</span>
          <span className="h-6 w-6 flex items-center justify-center justify-self-end" aria-hidden>
            {showPersonalDetailsDot(user) ? (
              <span
                className="h-3 w-3 rounded-full border-2 border-white bg-red-600 shadow-[0_0_0_1px_#000]"
                title="Complete Personal details"
              />
            ) : null}
          </span>
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
