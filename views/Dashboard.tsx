import React from 'react';
import { BRUTAL, COLORS } from '../constants';
import { ViewState } from '../types';
import { StatCard } from '../components/StatCard';

export const Dashboard: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => (
  <div className="p-4 flex flex-col gap-6">
    <div className={`${BRUTAL.card} bg-[#ff90e8]`}>
      <h2 className="text-xl font-black uppercase mb-2">System Health</h2>
      <p className="text-sm font-medium mb-4">Your design system is robust but needs optimization.</p>
      <div className="w-full bg-white border-2 border-black h-4">
        <div className="bg-black h-full w-[84%]"></div>
      </div>
      <div className="text-right font-mono font-bold mt-1">84%</div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <StatCard label="Issues" value="12" color="bg-[#ffc900]" />
      <StatCard label="Tokens" value="145" />
    </div>

    <button onClick={() => setView(ViewState.AUDIT)} className={`${BRUTAL.btn} w-full bg-white`}>
      Start Audit →
    </button>
  </div>
);