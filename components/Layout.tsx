import React from 'react';
import { NavBar } from './NavBar';
import { ViewState, User } from '../types';

interface Props {
  children: React.ReactNode;
  current: ViewState;
  setView: (v: ViewState) => void;
  user: User | null;
  onOpenProfile: () => void;
}

export const Layout: React.FC<Props> = ({ children, current, setView, user, onOpenProfile }) => (
  <div className="min-h-screen bg-[#fdfdfd] text-black font-sans pb-24 relative">
    <header data-component="Layout: Header Container" className="border-b-2 border-black bg-[#ff90e8] p-4 sticky top-0 z-10 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h1 data-component="Layout: Brand Name" className="text-2xl font-black uppercase tracking-tighter leading-[0.9]">Comtra <span data-component="Layout: Test Badge" className="text-[8px] bg-black text-white px-1 ml-1 align-top">TEST</span></h1>
        <div data-component="Layout: Tagline Badge" className="inline-block bg-black text-white px-2 py-0.5 text-[10px] font-bold uppercase rotate-2 transform">
          Design System AI
        </div>
      </div>
      
      {user && (
        <button 
          onClick={onOpenProfile}
          data-component="Layout: Avatar Button"
          className="size-8 rounded-full bg-black border-2 border-white text-white font-bold flex items-center justify-center text-xs hover:bg-[#ffc900] hover:text-black transition-colors"
        >
          {user.name.charAt(0)}
        </button>
      )}
    </header>
    <main data-component="Layout: Main Content Area" className="max-w-md mx-auto">{children}</main>
    {(current !== ViewState.SUBSCRIPTION && current !== ViewState.DOCUMENTATION && current !== ViewState.PRIVACY && current !== ViewState.TERMS) && <NavBar current={current} onChange={setView} />}
    {(current === ViewState.SUBSCRIPTION || current === ViewState.DOCUMENTATION || current === ViewState.PRIVACY || current === ViewState.TERMS) && (
       <button 
         data-component="Layout: Back to Dashboard Button"
         onClick={() => setView(ViewState.AUDIT)} 
         className="fixed bottom-6 left-1/2 -translate-x-1/2 border-2 border-black bg-white px-4 py-2 font-bold uppercase shadow-[4px_4px_0_0_#000]"
       >
         Back to Dashboard
       </button>
    )}
  </div>
);