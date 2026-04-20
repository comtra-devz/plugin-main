
import React from 'react';
import { ViewState, NavProps } from '../types';

export const NavBar: React.FC<NavProps> = ({ current, onChange }) => (
  <nav className="fixed bottom-0 left-0 z-50 grid w-full grid-cols-4 gap-1 border-t-[3px] border-black bg-white p-2 shadow-[0_-6px_0_0_#000,0_12px_24px_-8px_rgba(0,0,0,0.18)]">
    {Object.values(ViewState)
      .filter(view => 
        view !== ViewState.SUBSCRIPTION && 
        view !== ViewState.DOCUMENTATION && 
        view !== ViewState.PRIVACY && 
        view !== ViewState.TERMS && 
        view !== ViewState.AFFILIATE
      )
      .map((view) => (
      <button
        key={view}
        data-component={`NavBar: ${view} Tab`}
        onClick={() => onChange(view)}
        className={`text-[9px] font-bold uppercase py-3 border-2 border-black transition-all ${
          current === view ? `bg-black text-white translate-y-[-4px] shadow-[4px_4px_0_0_#ff90e8]` : 'bg-white hover:bg-gray-100'
        }`}
      >
        {view === 'ANALYTICS' ? 'STATS' : view}
      </button>
    ))}
  </nav>
);
