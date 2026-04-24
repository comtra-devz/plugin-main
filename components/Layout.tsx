import React, { useEffect, useRef } from 'react';
import { NavBar } from './NavBar';
import { ViewState, User } from '../types';

interface Props {
  children: React.ReactNode;
  current: ViewState;
  setView: (v: ViewState) => void;
  user: User | null;
  onOpenProfile: () => void;
}

export const Layout: React.FC<Props> = ({ children, current, setView, user, onOpenProfile }) => {
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!mainRef.current) return;
    mainRef.current.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [current]);

  return (
    <div className="h-screen flex flex-col bg-[#fdfdfd] text-black font-sans overflow-x-hidden">
      <header data-component="Layout: Header Container" className="border-b-2 border-black bg-[#ff90e8] px-3 py-1.5 sticky top-0 z-[100] flex min-h-9 items-center justify-between shrink-0 shadow-[0_2px_0_0_#000]">
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
            className="relative size-8 rounded-full bg-black border-2 border-white text-white font-bold flex items-center justify-center text-xs uppercase hover:bg-[#ffc900] hover:text-black transition-colors shrink-0"
          >
            <span>{(user.avatar || user.name.charAt(0)).toUpperCase()}</span>
            {user.show_profile_badge && (
              <span
                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-600"
                aria-hidden
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