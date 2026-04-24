import React, { useEffect, useMemo, useRef } from 'react';
import { NavBar } from './NavBar';
import { ViewState, User } from '../types';

interface Props {
  children: React.ReactNode;
  current: ViewState;
  setView: (v: ViewState) => void;
  user: User | null;
  onOpenProfile: () => void;
}

/** Dot finché non c’è profilo salvato (magic) o c’è conflitto Figma; non dipende solo dal flag server. */
function showProfileAvatarDot(u: User): boolean {
  if (u.name_conflict && typeof u.name_conflict === 'object') return true;
  if (u.show_profile_badge) return true;
  const hasFigma = u.figma_user_id != null && String(u.figma_user_id).trim() !== '';
  if (hasFigma) return false;
  if (u.profile_saved_at) return false;
  return true;
}

export const Layout: React.FC<Props> = ({ children, current, setView, user, onOpenProfile }) => {
  const mainRef = useRef<HTMLElement | null>(null);
  const showDot = useMemo(() => (user ? showProfileAvatarDot(user) : false), [user]);

  useEffect(() => {
    if (!mainRef.current) return;
    mainRef.current.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [current]);

  return (
    <div className="h-screen flex flex-col bg-[#fdfdfd] text-black font-sans overflow-x-hidden">
      <header data-component="Layout: Header Container" className="border-b-2 border-black bg-[#ff90e8] px-3 py-1.5 sticky top-0 z-[100] flex min-h-9 items-center justify-between shrink-0 overflow-visible shadow-[0_2px_0_0_#000]">
        <div className="flex items-center gap-2">
          <h1 data-component="Layout: Brand Name" className="text-lg font-black uppercase tracking-tighter leading-none sm:text-xl">Comtra</h1>
          <div data-component="Layout: Tagline Badge" className="inline-block bg-black text-white px-2 py-0.5 text-[10px] font-bold uppercase rotate-2 transform">
            Design System AI
          </div>
        </div>
        
        {user && (
          <button 
            onClick={onOpenProfile}
            data-component="Layout: Avatar Button"
            type="button"
            className="relative z-[110] size-8 shrink-0 overflow-visible rounded-full border-2 border-white bg-black text-white font-bold flex items-center justify-center text-xs uppercase shadow-[0_0_0_1px_#000] hover:bg-[#ffc900] hover:text-black transition-colors"
          >
            <span className="relative z-0">{(user.avatar || user.name.charAt(0)).toUpperCase()}</span>
            {showDot && (
              <span
                className="pointer-events-none absolute -right-1 -top-1 z-10 h-3 w-3 rounded-full border-2 border-white bg-red-600 shadow-[0_0_0_1px_#000]"
                aria-label="Profile action needed"
                title="Add your name in Profile → Personal details"
              />
            )}
          </button>
        )}
      </header>
      <main
        ref={mainRef}
        data-component="Layout: Main Content Area"
        className="mx-auto flex w-full max-w-md flex-1 min-h-0 flex-col overflow-y-auto pb-16"
      >
        {children}
      </main>
      {(current !== ViewState.SUBSCRIPTION && current !== ViewState.DOCUMENTATION && current !== ViewState.PRIVACY && current !== ViewState.TERMS && current !== ViewState.PERSONAL_DETAILS) && <NavBar current={current} onChange={setView} />}
      {(current === ViewState.SUBSCRIPTION || current === ViewState.DOCUMENTATION || current === ViewState.PRIVACY || current === ViewState.TERMS || current === ViewState.PERSONAL_DETAILS) && (
         <button 
           data-component="Layout: Back to Dashboard Button"
           onClick={() => setView(ViewState.AUDIT)} 
           className="fixed bottom-6 left-1/2 -translate-x-1/2 border-2 border-black bg-white px-4 py-2 font-bold uppercase shadow-[4px_4px_0_0_#000] whitespace-nowrap"
         >
           Back to Dashboard
         </button>
      )}
    </div>
  );
};