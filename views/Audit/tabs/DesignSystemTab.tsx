
import React, { useState } from 'react';
import { BRUTAL, COLORS } from '../../../constants';
import { CircularScore } from '../../../components/widgets/CircularScore';
import { IssueList } from '../components/IssueList';
import { ExtendedAuditCategory } from '../data';
import { AuditIssue } from '../../../types';

interface Props {
  hasAudited: boolean;
  score: number;
  lastAuditDate: Date | null;
  categories: ExtendedAuditCategory[];
  activeCat: string | null;
  setActiveCat: (id: string | null) => void;
  excludedPages: string[];
  setExcludedPages: React.Dispatch<React.SetStateAction<string[]>>;
  isPagesDropdownOpen: boolean;
  setIsPagesDropdownOpen: (open: boolean) => void;
  pageSearch: string;
  setPageSearch: (val: string) => void;
  filteredPages: string[];
  isPro: boolean;
  displayIssues: AuditIssue[];
  activeIssues: AuditIssue[];
  onStartScan: () => void;
  onShare: () => void;
  toggleExcludedPage: (page: string) => void;
  issueListProps: any;
}

export const DesignSystemTab: React.FC<Props> = ({
  hasAudited,
  score,
  lastAuditDate,
  categories,
  activeCat,
  setActiveCat,
  excludedPages,
  setExcludedPages,
  isPagesDropdownOpen,
  setIsPagesDropdownOpen,
  pageSearch,
  setPageSearch,
  filteredPages,
  isPro,
  displayIssues,
  activeIssues,
  onStartScan,
  onShare,
  toggleExcludedPage,
  issueListProps
}) => {
  const [isCalculating, setIsCalculating] = useState(false);

  const handleScanClick = () => {
    setIsCalculating(true);
    setTimeout(() => {
        onStartScan();
        setIsCalculating(false);
    }, 800);
  };

  if (!hasAudited) {
    return (
      <div className="p-4 h-[60vh] flex flex-col items-center justify-center">
        <div className={`${BRUTAL.card} bg-white py-8 w-full text-center`}>
          <CircularScore score={0} label="Ready" size="sm" />
          <p className="text-xs font-medium text-gray-500 mt-4 px-4 mb-4">Let's see how your system shines today.</p>
          
          {/* Pages Filter (Empty State) */}
          <div className="relative z-20 text-left mb-2 px-4">
              <div 
                  onClick={() => setIsPagesDropdownOpen(!isPagesDropdownOpen)}
                  className={`${BRUTAL.input} flex justify-between items-center cursor-pointer h-10 bg-white`}
              >
                  <span className="text-xs font-bold uppercase">
                      {excludedPages.length > 0 ? `${excludedPages.length} Pages Excluded` : 'All Pages Included'}
                  </span>
                  <span>{isPagesDropdownOpen ? '▲' : '▼'}</span>
              </div>
              {isPagesDropdownOpen && (
                  <div className="absolute top-full left-4 right-4 bg-white border-2 border-black border-t-0 shadow-[4px_4px_0_0_#000] p-2 text-left z-30">
                      <input 
                          type="text" 
                          placeholder="Search Page..." 
                          className="w-full border-b border-black p-1 text-xs font-mono outline-none mb-2"
                          value={pageSearch}
                          onChange={(e) => setPageSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                      />
                      <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1">
                          {filteredPages.map(page => (
                              <div 
                                  key={page} 
                                  onClick={(e) => { e.stopPropagation(); toggleExcludedPage(page); }}
                                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1"
                              >
                                  <div className={`w-3 h-3 border border-black flex items-center justify-center ${excludedPages.includes(page) ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                  <span className={`text-xs ${excludedPages.includes(page) ? 'line-through text-gray-400' : 'text-black'}`}>{page}</span>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>

          <div className="px-4">
            <button 
                onClick={handleScanClick} 
                disabled={isCalculating}
                className={`${BRUTAL.btn} bg-[${COLORS.primary}] text-black w-full flex justify-center items-center gap-2 relative hover:bg-white hover:border-black disabled:bg-gray-200 disabled:cursor-wait`}
            >
                {isCalculating ? 'CALCULATING NODES...' : 'Scan Design'}
                {!isCalculating && <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">CALCULATE COST</span>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-in slide-in-from-left-2 mt-4">
      {/* Header Stat Card */}
      <div className={`${BRUTAL.card} bg-white p-3 flex items-start gap-3 relative min-h-[140px]`}>
        <div className="shrink-0 mt-1"><CircularScore score={score} size="sm" /></div>
        <div className="flex flex-col flex-1 w-full">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-400 mb-1">Current Status</span>
              <h2 className="text-sm font-black leading-tight max-w-[95%] mb-1">
                {score < 100 ? "Your system is blooming, but a few petals are out of place." : "Absolute Perfection! The stars align with your grid."}
              </h2>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 font-medium mb-8">
             {score < 100 ? `Reach ${Math.ceil((score + 10)/10)*10}% to harmonize.` : 'You are a design legend.'}
          </p>
          {lastAuditDate && (
              <span className="absolute bottom-3 left-3 text-[9px] font-mono text-gray-400">
                  Last scan: {lastAuditDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
          )}

          <button 
             onClick={onShare} 
             className="absolute bottom-3 right-3 bg-black text-white px-3 py-1.5 text-[10px] font-bold uppercase hover:bg-gray-800 transition-colors flex items-center gap-1 shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]"
          >
             <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
               <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
             </svg>
             Share
          </button>
        </div>
      </div>

      {/* Pages Filter */}
      <div className="relative z-20">
          <div 
              onClick={() => setIsPagesDropdownOpen(!isPagesDropdownOpen)}
              className={`${BRUTAL.input} flex justify-between items-center cursor-pointer h-10`}
          >
              <span className="text-xs font-bold uppercase">
                  {excludedPages.length > 0 ? `${excludedPages.length} Pages Excluded` : 'All Pages Included'}
              </span>
              <span>{isPagesDropdownOpen ? '▲' : '▼'}</span>
          </div>
          {isPagesDropdownOpen && (
              <div className="absolute top-full left-0 w-full bg-white border-2 border-black border-t-0 shadow-[4px_4px_0_0_#000] p-2">
                  <input 
                      type="text" 
                      placeholder="Search Page..." 
                      className="w-full border-b border-black p-1 text-xs font-mono outline-none mb-2"
                      value={pageSearch}
                      onChange={(e) => setPageSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                  />
                  <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-1">
                      {filteredPages.map(page => (
                          <div 
                              key={page} 
                              onClick={(e) => { e.stopPropagation(); toggleExcludedPage(page); }}
                              className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1"
                          >
                              <div className={`w-3 h-3 border border-black flex items-center justify-center ${excludedPages.includes(page) ? 'bg-red-500' : 'bg-green-500'}`}></div>
                              <span className={`text-xs ${excludedPages.includes(page) ? 'line-through text-gray-400' : 'text-black'}`}>{page}</span>
                          </div>
                      ))}
                  </div>
              </div>
          )}
      </div>

      {/* Scan Again Button (Moved Here) */}
      <button 
          onClick={handleScanClick}
          disabled={isCalculating}
          className={`${BRUTAL.btn} w-full bg-white text-black border-black flex justify-center items-center gap-2 relative shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] disabled:bg-gray-200 disabled:cursor-wait`}
      >
          <span>{isCalculating ? 'CALCULATING...' : 'Scan Again'}</span>
          {!isCalculating && <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">CALCULATE COST</span>}
      </button>

      {/* Categories */}
      <div className={`${BRUTAL.card} p-0 overflow-hidden bg-white`}>
         <div className="p-3 border-b-2 border-black bg-gray-50 flex justify-between items-center">
             <h3 className="font-bold uppercase text-xs">Categories ⚠️</h3>
             <span className="text-[10px] font-bold bg-black text-white px-1.5 py-0.5 rounded-sm">
                {categories.reduce((acc, c) => acc + c.issuesCount, 0)} Issues
             </span>
         </div>
         <div className="max-h-[160px] overflow-y-auto custom-scrollbar p-0">
             {categories.map(cat => {
               const isActive = activeCat === cat.id;
               return (
                 <div 
                   key={cat.id}
                   onClick={() => setActiveCat(isActive ? null : cat.id)}
                   className={`flex items-center justify-between p-3 border-b border-gray-100 cursor-pointer transition-colors ${isActive ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'}`}
                 >
                    <div className="flex items-center gap-3">
                       <div className={`size-8 ${cat.color} border-2 border-black flex items-center justify-center text-sm shadow-[2px_2px_0_0_#000] text-black`}>
                          {cat.icon}
                       </div>
                       <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase">{cat.label}</span>
                          <span className="text-[9px] font-medium opacity-70">{cat.desc}</span>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       {cat.score === -1 ? (
                           <span className="text-[9px] font-mono text-gray-400">N/A</span>
                       ) : (
                           <span className={`text-[10px] font-mono ${isActive ? 'text-gray-300' : 'text-gray-500'}`}>{cat.score}%</span>
                       )}
                       {cat.issuesCount > 0 && (
                          <span className="size-5 bg-white text-black border border-black flex items-center justify-center text-[9px] font-bold rounded-full">
                             {cat.issuesCount}
                          </span>
                       )}
                    </div>
                 </div>
               );
             })}
         </div>
      </div>

      {/* Issues List */}
      <div className="flex flex-col">
        <div className="flex justify-between items-center mb-2 px-1 py-2 border-b-2 border-black/10">
            <h3 className="font-black uppercase text-xs">{activeCat ? `${activeCat} Issues` : 'All Issues'}</h3>
            <span className="text-[10px] font-bold bg-[#ffc900] text-black px-1.5 py-0.5 rounded-sm border border-black">{activeIssues.length} Violations</span>
        </div>
        
        <IssueList 
            displayIssues={displayIssues} 
            activeIssues={activeIssues}
            {...issueListProps} 
        />
      </div>
    </div>
  );
};
