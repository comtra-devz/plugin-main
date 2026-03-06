
import React from 'react';
import { BRUTAL, COLORS } from '../../../constants';
import { CircularScore } from '../../../components/widgets/CircularScore';
import { IssueList } from '../components/IssueList';
import { ExtendedAuditCategory } from '../data';
import { AuditIssue } from '../../../types';

export type ScanScope = 'all' | 'current' | 'page';

interface DocumentPage {
  id: string;
  name: string;
}

interface Props {
  hasAudited: boolean;
  score: number;
  lastAuditDate: Date | null;
  categories: ExtendedAuditCategory[];
  /** Dynamic status/target copy from score matrix (same ToV) */
  statusCopy?: string;
  targetCopy?: string;
  /** Count of HIGH severity issues; badge shown only if > 0 */
  highSeverityCount?: number;
  activeCat: string | null;
  setActiveCat: (id: string | null) => void;
  documentPages: DocumentPage[];
  scanScope: ScanScope;
  setScanScope: (s: ScanScope) => void;
  selectedPageId: string | null;
  setSelectedPageId: (id: string | null) => void;
  isScopeDropdownOpen: boolean;
  setIsScopeDropdownOpen: (open: boolean) => void;
  isPro: boolean;
  displayIssues: AuditIssue[];
  activeIssues: AuditIssue[];
  onStartScan: () => void;
  onShare: () => void;
  isCalculating: boolean;
  scanProgress: { percent: number; count: number };
  issueListProps: any;
  dsAuditLoading?: boolean;
  dsAuditError?: string | null;
  onRetryConnection?: () => void;
  onCheckTokenStatus?: () => void;
}

function getScopeLabel(scope: ScanScope, selectedPage: DocumentPage | null): string {
  if (scope === 'all') return 'All Pages';
  if (scope === 'current') return 'Current Selection';
  return selectedPage ? selectedPage.name : 'Select Page';
}

export const DesignSystemTab: React.FC<Props> = ({
  hasAudited,
  score,
  lastAuditDate,
  categories,
  statusCopy,
  targetCopy,
  highSeverityCount = 0,
  activeCat,
  setActiveCat,
  documentPages,
  scanScope,
  setScanScope,
  selectedPageId,
  setSelectedPageId,
  isScopeDropdownOpen,
  setIsScopeDropdownOpen,
  isPro,
  displayIssues,
  activeIssues,
  onStartScan,
  onShare,
  isCalculating,
  scanProgress,
  issueListProps,
  dsAuditLoading,
  dsAuditError,
  onRetryConnection,
  onCheckTokenStatus,
}) => {
  const selectedPage = documentPages.find(p => p.id === selectedPageId) ?? null;

  const handleScanClick = () => {
    onStartScan();
  };

  if (!hasAudited) {
    return (
      <div className="p-4 h-[60vh] flex flex-col items-center justify-center">
        <div className={`${BRUTAL.card} bg-white py-8 w-full text-center`}>
          <CircularScore score={0} label="Ready" size="sm" />
          <p className="text-xs font-medium text-gray-500 mt-4 px-4 mb-4">Let's see how your system shines today.</p>
          
          {/* Scope Selection */}
          <div className="relative z-20 text-left mb-2 px-4">
              <div 
                  onClick={() => setIsScopeDropdownOpen(!isScopeDropdownOpen)}
                  className={`${BRUTAL.input} flex justify-between items-center gap-2 cursor-pointer h-10 bg-white`}
              >
                  <span className="text-xs font-bold uppercase truncate min-w-0" title={getScopeLabel(scanScope, selectedPage)}>
                      {getScopeLabel(scanScope, selectedPage)}
                  </span>
                  <span className="shrink-0">{isScopeDropdownOpen ? '▲' : '▼'}</span>
              </div>
              {isScopeDropdownOpen && (
                  <div className="absolute top-full left-4 right-4 bg-white border-2 border-black border-t-0 shadow-[4px_4px_0_0_#000] text-left z-30 max-h-48 overflow-y-auto custom-scrollbar">
                      <div 
                          onClick={(e) => { e.stopPropagation(); setScanScope('all'); setIsScopeDropdownOpen(false); }}
                          className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2"
                      >
                          <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${scanScope === 'all' ? 'bg-black' : 'bg-white'}`}></div>
                          <span className="text-xs font-bold">All Pages</span>
                      </div>
                      <div 
                          onClick={(e) => { e.stopPropagation(); setScanScope('current'); setIsScopeDropdownOpen(false); }}
                          className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2"
                      >
                          <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${scanScope === 'current' ? 'bg-black' : 'bg-white'}`}></div>
                          <span className="text-xs font-bold">Current Selection</span>
                      </div>
                      <div className="border-t border-gray-200 my-0" aria-hidden />
                      {documentPages.map(page => (
                          <div 
                              key={page.id} 
                              onClick={(e) => { e.stopPropagation(); setScanScope('page'); setSelectedPageId(page.id); setIsScopeDropdownOpen(false); }}
                              className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2"
                          >
                              <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${scanScope === 'page' && selectedPageId === page.id ? 'bg-black' : 'bg-white'}`}></div>
                              <span className="text-xs">{page.name}</span>
                          </div>
                      ))}
                  </div>
              )}
          </div>

          <div className="px-4">
            <button 
                onClick={handleScanClick} 
                disabled={isCalculating}
                className={`${BRUTAL.btn} bg-[${COLORS.primary}] text-black w-full flex flex-col justify-center items-center gap-0 hover:bg-white hover:border-black disabled:bg-gray-200 disabled:cursor-wait relative overflow-hidden`}
            >
                {isCalculating && (
                  <div
                    className="absolute inset-0 bg-[#ffc900] transition-all duration-150 ease-out"
                    style={{ width: `${scanProgress.percent}%` }}
                  />
                )}
                <span className="relative z-10">
                  {isCalculating ? `CALCULATING... ${scanProgress.percent}%` : 'Scan Design'}
                </span>
            </button>
            <p className="text-[10px] text-gray-500 mt-2 text-center px-2">
              No credits will be deducted at this point yet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-in slide-in-from-left-2 mt-4">
      {dsAuditLoading && (
        <div className="flex items-center gap-2 py-2 px-3 bg-[#ffc900] border-2 border-black text-[10px] font-bold uppercase">
          <span className="w-2 h-2 bg-black animate-pulse" />
          Analysing design system…
        </div>
      )}
      {/* Header Stat Card */}
      <div className={`${BRUTAL.card} bg-white p-3 flex items-start gap-3 relative min-h-[140px]`}>
        <div className="shrink-0 mt-1"><CircularScore score={score} size="sm" /></div>
        <div className="flex flex-col flex-1 w-full">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-400 mb-1">Current Status</span>
              <h2 className="text-sm font-black leading-tight max-w-[95%] mb-1">
                {statusCopy ?? (score < 100 ? "Your system is blooming, but a few petals are out of place." : "Absolute Perfection! The stars align with your grid.")}
              </h2>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 font-medium mb-8">
             {targetCopy ?? (score < 100 ? `Reach ${Math.ceil((score + 10) / 10) * 10}% to harmonize.` : 'You are a design legend.')}
          </p>
          {lastAuditDate && (
              <span className="absolute bottom-3 left-3 text-[9px] font-mono text-gray-400">
                  Last scan: {lastAuditDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
          )}

          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <button 
               onClick={onShare} 
               className="bg-black text-white px-3 py-1.5 text-[10px] font-bold uppercase hover:bg-gray-800 transition-colors flex items-center gap-1 shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]"
            >
               <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                 <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
               </svg>
               Share
            </button>
          </div>
        </div>
      </div>

      {/* Scope Selection */}
      <div className="relative z-20">
          <div 
              onClick={() => setIsScopeDropdownOpen(!isScopeDropdownOpen)}
              className={`${BRUTAL.input} flex justify-between items-center gap-2 cursor-pointer h-10`}
          >
              <span className="text-xs font-bold uppercase truncate min-w-0" title={getScopeLabel(scanScope, selectedPage)}>
                  {getScopeLabel(scanScope, selectedPage)}
              </span>
              <span className="shrink-0">{isScopeDropdownOpen ? '▲' : '▼'}</span>
          </div>
          {isScopeDropdownOpen && (
              <div className="absolute top-full left-0 w-full bg-white border-2 border-black border-t-0 shadow-[4px_4px_0_0_#000] max-h-48 overflow-y-auto custom-scrollbar">
                  <div 
                      onClick={(e) => { e.stopPropagation(); setScanScope('all'); setIsScopeDropdownOpen(false); }}
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2"
                  >
                      <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${scanScope === 'all' ? 'bg-black' : 'bg-white'}`}></div>
                      <span className="text-xs font-bold">All Pages</span>
                  </div>
                  <div 
                      onClick={(e) => { e.stopPropagation(); setScanScope('current'); setIsScopeDropdownOpen(false); }}
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2"
                  >
                      <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${scanScope === 'current' ? 'bg-black' : 'bg-white'}`}></div>
                      <span className="text-xs font-bold">Current Selection</span>
                  </div>
                  <div className="border-t border-gray-200 my-0" aria-hidden />
                  {documentPages.map(page => (
                      <div 
                          key={page.id} 
                          onClick={(e) => { e.stopPropagation(); setScanScope('page'); setSelectedPageId(page.id); setIsScopeDropdownOpen(false); }}
                          className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2"
                      >
                          <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${scanScope === 'page' && selectedPageId === page.id ? 'bg-black' : 'bg-white'}`}></div>
                          <span className="text-xs">{page.name}</span>
                      </div>
                  ))}
              </div>
          )}
      </div>

      {/* Scan Again Button (Moved Here) */}
      <button 
          onClick={handleScanClick}
          disabled={isCalculating}
          className={`${BRUTAL.btn} w-full bg-white text-black border-black flex flex-col justify-center items-center gap-0 relative overflow-hidden shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] disabled:bg-gray-200 disabled:cursor-wait`}
      >
          {isCalculating && (
            <div
              className="absolute inset-0 bg-[#ffc900] transition-all duration-150 ease-out"
              style={{ width: `${scanProgress.percent}%` }}
            />
          )}
          <span className="relative z-10">
            {isCalculating ? `CALCULATING... ${scanProgress.percent}%` : 'Scan Again'}
          </span>
      </button>

      {/* Categories */}
      <div className={`${BRUTAL.card} p-0 overflow-hidden bg-white`}>
         <div className="border-b-2 border-black bg-gray-50 flex justify-between items-center px-2 py-1.5">
             <h3 className="font-bold uppercase text-xs">Categories</h3>
             <span className="text-[10px] font-bold bg-black text-white px-1.5 py-0.5 rounded-sm">
                {categories.reduce((acc, c) => acc + c.issuesCount, 0)} Issues
             </span>
         </div>
         <div>
             {categories.map(cat => {
               const isActive = activeCat === cat.id;
               return (
                 <div 
                   key={cat.id}
                   onClick={() => setActiveCat(isActive ? null : cat.id)}
                   className={`flex items-center justify-between px-2 py-2 border-b border-gray-100 cursor-pointer transition-colors ${isActive ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'}`}
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
            {highSeverityCount > 0 && (
              <span className="text-[10px] font-bold bg-[#ffc900] text-black px-1.5 py-0.5 rounded-sm border border-black">{highSeverityCount} High</span>
            )}
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
