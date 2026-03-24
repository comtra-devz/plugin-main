
import React from 'react';
import { BRUTAL } from '../../../constants';
import { Button } from '../../../components/ui/Button';
import { BrutalDropdown, brutalMenuRowClass } from '../../../components/ui/BrutalSelect';
import { CircularScore } from '../../../components/widgets/CircularScore';
import { IssueList } from '../components/IssueList';
import { ExtendedAuditCategory, formatIssueCount } from '../data';
import { AuditIssue } from '../../../types';

export type ScanScope = 'all' | 'current' | 'page' | 'unselected';

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
  /** Advisory when file has no design system (e.g. Preline CTA) */
  dsAdvisory?: { type: string; message: string; ctaLabel: string; ctaUrl: string } | null;
  onRetryConnection?: () => void;
  onCheckTokenStatus?: () => void;
  /** When true, "All Pages" is visible but disabled with "Coming soon" message */
  disableAllPages?: boolean;
}

function getScopeLabel(scope: ScanScope, selectedPage: DocumentPage | null): string {
  if (scope === 'unselected') return 'Select an option';
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
  dsAdvisory,
  onRetryConnection,
  onCheckTokenStatus,
  disableAllPages = false,
}) => {
  const selectedPage = documentPages.find(p => p.id === selectedPageId) ?? null;
  const hasIssues = (displayIssues?.length ?? 0) > 0;

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
              <BrutalDropdown
                open={isScopeDropdownOpen}
                onOpenChange={setIsScopeDropdownOpen}
                className="w-full"
                maxHeightClassName="max-h-48"
                trigger={
                  <button
                    type="button"
                    onClick={() => setIsScopeDropdownOpen(!isScopeDropdownOpen)}
                    className={`${BRUTAL.input} flex justify-between items-center gap-2 cursor-pointer h-10 bg-white w-full text-left`}
                  >
                    <span className="text-xs font-bold uppercase truncate min-w-0" title={getScopeLabel(scanScope, selectedPage)}>
                      {getScopeLabel(scanScope, selectedPage)}
                    </span>
                    <span className="shrink-0" aria-hidden>{isScopeDropdownOpen ? '▲' : '▼'}</span>
                  </button>
                }
              >
                {disableAllPages ? (
                  <div className="flex flex-col gap-0 p-2 opacity-60 cursor-not-allowed" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 p-2">
                      <div className="w-3 h-3 shrink-0 border border-black flex items-center justify-center bg-white" />
                      <span className="text-xs font-bold">All Pages</span>
                    </div>
                    <p className="text-[10px] text-gray-500 px-2 pb-2 italic">We are working hard to make this option available.</p>
                  </div>
                ) : (
                  <div
                    role="option"
                    onClick={() => { setScanScope('all'); setIsScopeDropdownOpen(false); }}
                    className={`${brutalMenuRowClass} border-b border-gray-100`}
                  >
                    <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${scanScope === 'all' ? 'bg-black' : 'bg-white'}`} />
                    <span className="text-xs font-bold">All Pages</span>
                  </div>
                )}
                <div
                  role="option"
                  onClick={() => { setScanScope('current'); setIsScopeDropdownOpen(false); }}
                  className={`${brutalMenuRowClass} border-b border-gray-100`}
                >
                  <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${scanScope === 'current' ? 'bg-black' : 'bg-white'}`} />
                  <span className="text-xs font-bold">Current Selection</span>
                </div>
                <div className="border-t border-gray-200 my-0" aria-hidden />
                {documentPages.map((page) => (
                  <div
                    key={page.id}
                    role="option"
                    onClick={() => { setScanScope('page'); setSelectedPageId(page.id); setIsScopeDropdownOpen(false); }}
                    className={`${brutalMenuRowClass} border-b border-gray-100 last:border-b-0`}
                  >
                    <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${scanScope === 'page' && selectedPageId === page.id ? 'bg-black' : 'bg-white'}`} />
                    <span className="text-xs">{page.name}</span>
                  </div>
                ))}
              </BrutalDropdown>
          </div>

          <div className="px-4">
            <Button
              variant="primary"
              fullWidth
              onClick={handleScanClick}
              disabled={isCalculating || scanScope === 'unselected' || (scanScope === 'page' && !selectedPageId)}
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
            </Button>
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
      {dsAdvisory && !dsAuditLoading && (
        <div className={`${BRUTAL.card} bg-indigo-50 border-2 border-indigo-300 p-4 flex flex-col gap-3`}>
          <p className="text-xs font-medium text-indigo-900">{dsAdvisory.message}</p>
          <button
            type="button"
            onClick={() => window.open(dsAdvisory.ctaUrl, '_blank', 'noopener')}
            className="inline-flex items-center gap-1.5 w-fit bg-indigo-600 text-white px-3 py-2 text-[10px] font-bold uppercase hover:bg-indigo-700 transition-colors shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]"
          >
            {dsAdvisory.ctaLabel}
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
            </svg>
          </button>
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
          <BrutalDropdown
            open={isScopeDropdownOpen}
            onOpenChange={setIsScopeDropdownOpen}
            className="w-full"
            maxHeightClassName="max-h-48"
            trigger={
              <button
                type="button"
                onClick={() => setIsScopeDropdownOpen(!isScopeDropdownOpen)}
                className={`${BRUTAL.input} flex justify-between items-center gap-2 cursor-pointer h-10 w-full text-left bg-white`}
              >
                <span className="text-xs font-bold uppercase truncate min-w-0" title={getScopeLabel(scanScope, selectedPage)}>
                  {getScopeLabel(scanScope, selectedPage)}
                </span>
                <span className="shrink-0" aria-hidden>{isScopeDropdownOpen ? '▲' : '▼'}</span>
              </button>
            }
          >
            {disableAllPages ? (
              <div className="flex flex-col gap-0 p-2 opacity-60 cursor-not-allowed" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2 p-2">
                  <div className="w-3 h-3 shrink-0 border border-black flex items-center justify-center bg-white" />
                  <span className="text-xs font-bold">All Pages</span>
                </div>
                <p className="text-[10px] text-gray-500 px-2 pb-2 italic">We are working hard to make this option available.</p>
              </div>
            ) : (
              <div
                role="option"
                onClick={() => { setScanScope('all'); setIsScopeDropdownOpen(false); }}
                className={`${brutalMenuRowClass} border-b border-gray-100`}
              >
                <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${scanScope === 'all' ? 'bg-black' : 'bg-white'}`} />
                <span className="text-xs font-bold">All Pages</span>
              </div>
            )}
            <div
              role="option"
              onClick={() => { setScanScope('current'); setIsScopeDropdownOpen(false); }}
              className={`${brutalMenuRowClass} border-b border-gray-100`}
            >
              <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${scanScope === 'current' ? 'bg-black' : 'bg-white'}`} />
              <span className="text-xs font-bold">Current Selection</span>
            </div>
            <div className="border-t border-gray-200 my-0" aria-hidden />
            {documentPages.map((page) => (
              <div
                key={page.id}
                role="option"
                onClick={() => { setScanScope('page'); setSelectedPageId(page.id); setIsScopeDropdownOpen(false); }}
                className={`${brutalMenuRowClass} border-b border-gray-100 last:border-b-0`}
              >
                <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${scanScope === 'page' && selectedPageId === page.id ? 'bg-black' : 'bg-white'}`} />
                <span className="text-xs">{page.name}</span>
              </div>
            ))}
          </BrutalDropdown>
      </div>

      {/* Scan Again Button (Moved Here) */}
      <Button
        variant="primary"
        fullWidth
        onClick={handleScanClick}
        disabled={isCalculating || scanScope === 'unselected' || (scanScope === 'page' && !selectedPageId)}
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
      </Button>

      {score === 100 && !dsAuditLoading && !hasIssues ? (
        <div className={`${BRUTAL.card} bg-white p-6 flex flex-col items-center justify-center text-center gap-4`}>
          <div className="w-24 h-24 border-4 border-black bg-gray-100 flex items-center justify-center shadow-[6px_6px_0_0_#000]">
            <span className="text-3xl">🧱</span>
          </div>
          <div className="max-w-xs">
            <h3 className="font-black uppercase text-xs mb-1">System is rock solid</h3>
            <p className="text-[10px] text-gray-600 font-medium">
              Components, tokens and layouts are lining up beautifully. Keep shipping from this source of truth and we&apos;ll shout if anything drifts.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Categories */}
          <div className={`${BRUTAL.card} p-0 overflow-hidden bg-white`}>
            <div className="border-b-2 border-black bg-gray-50 flex justify-between items-center px-2 py-1.5">
              <h3 className="font-bold uppercase text-xs">Categories</h3>
              <span className="text-[10px] font-bold bg-black text-white px-1.5 py-0.5 rounded-sm">
                {categories.reduce((acc, c) => acc + c.issuesCount, 0)} Issues
              </span>
            </div>
            <div>
              {(() => {
                const totalIssues = categories.reduce((acc, c) => acc + c.issuesCount, 0);
                return categories.map(cat => {
                  const isActive = activeCat === cat.id;
                  const pctOfTotal = totalIssues > 0 ? Math.round((cat.issuesCount / totalIssues) * 100) : 0;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => setActiveCat(isActive ? null : cat.id)}
                      className={`flex items-center justify-between px-2 py-2 border-b border-gray-100 cursor-pointer transition-colors ${isActive ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-3 mr-6 min-w-0">
                        <div className={`size-8 shrink-0 ${cat.color} border-2 border-black flex items-center justify-center text-sm leading-none shadow-[2px_2px_0_0_#000] text-black`}>
                          {cat.icon}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] font-bold uppercase">{cat.label}</span>
                          <span className="text-[9px] font-medium opacity-70">{cat.desc}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-mono ${isActive ? 'text-gray-300' : 'text-gray-500'}`}>{pctOfTotal}%</span>
                        {cat.issuesCount > 0 && (
                          <span className="size-7 min-w-7 bg-white text-black border border-black flex items-center justify-center text-[9px] font-bold rounded-full">
                            {formatIssueCount(cat.issuesCount)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
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
        </>
      )}
    </div>
  );
};
