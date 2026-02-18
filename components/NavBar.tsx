import React from 'react';
import { ViewState, NavProps } from '../types';

export const NavBar: React.FC<NavProps> = ({ current, onChange }) => (
  <nav className="fixed bottom-0 left-0 w-full bg-white border-t-2 border-black p-2 grid grid-cols-3 gap-2 z-50 shadow-[0px_-4px_0px_0px_rgba(0,0,0,0.1)]">
    {Object.values(ViewState)
      .filter(view => view !== ViewState.SUBSCRIPTION && view !== ViewState.DOCUMENTATION && view !== ViewState.PRIVACY && view !== ViewState.WEBSITE)
      .map((view) => (
      <button
        key={view}
        onClick={() => onChange(view)}
        className={`text-[10px] font-bold uppercase py-3 border-2 border-black transition-all ${
          current === view ? `bg-black text-white translate-y-[-4px] shadow-[4px_4px_0_0_#ff90e8]` : 'bg-white hover:bg-gray-100'
        }`}
      >
        {view}
      </button>
    ))}
  </nav>
);