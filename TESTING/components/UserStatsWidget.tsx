
import React from 'react';
import { BRUTAL, COLORS } from '../constants';
import { UserStats } from '../types_test';

interface Props {
  stats: UserStats;
  compact?: boolean;
}

const StatBox = ({ label, value, color = 'bg-white' }: { label: string; value: number | string; color?: string }) => (
  <div className="flex flex-col">
    <span className="text-[9px] font-bold uppercase text-gray-500 mb-1 truncate">{label}</span>
    <div className={`border-2 border-black px-2 py-1 font-mono font-black text-sm ${color} shadow-[2px_2px_0_0_#000]`}>
      {value}
    </div>
  </div>
);

export const UserStatsWidget: React.FC<Props> = ({ stats, compact = false }) => {
  return (
    <div className={`${BRUTAL.card} ${compact ? 'p-3' : 'p-4'} bg-gray-50`}>
      {!compact && <h3 className="font-black uppercase text-sm mb-4 border-b-2 border-black pb-2">Production Metrics <span className="text-[8px] bg-yellow-400 border border-black px-1">TEST</span></h3>}
      
      <div className="grid grid-cols-2 gap-4 mb-4">
         <div className="col-span-2 bg-black text-white p-2 border-2 border-black shadow-[4px_4px_0_0_#ff90e8] flex justify-between items-center">
            <span className="text-xs font-bold uppercase text-[#ff90e8]">Max Health Score</span>
            <span className="text-xl font-black">{stats.maxHealthScore}%</span>
         </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-3">
        <StatBox label="Wireframes Gen" value={stats.wireframesGenerated} />
        <StatBox label="Wireframes Mod" value={stats.wireframesModified} />
        <StatBox label="Proto Scans" value={stats.analyzedProto} />
        
        <StatBox label="A11y Checks" value={stats.analyzedA11y} />
        <StatBox label="UX Audits" value={stats.analyzedUX} />
        <StatBox label="Affiliates" value={stats.affiliatesCount} color="bg-[#ffc900]" />
        
        <div className="col-span-2 md:col-span-3 border-t-2 border-dashed border-black/20 my-1"></div>
        
        <StatBox label="Sync Storybook" value={stats.syncedStorybook} color="bg-pink-100" />
        <StatBox label="Sync GitHub" value={stats.syncedGithub} />
        <StatBox label="Sync Bitbucket" value={stats.syncedBitbucket} />
      </div>
    </div>
  );
};
