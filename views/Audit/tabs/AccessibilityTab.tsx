import React from 'react';
import { BRUTAL } from '../../../constants';
import { Button } from '../../../components/ui/Button';
import { CircularScore } from '../../../components/widgets/CircularScore';
import { IssueList } from '../components/IssueList';
import { ExtendedAuditCategory, formatIssueCount } from '../data';
import { AuditIssue } from '../../../types';

export type ScanScope = 'all' | 'current' | 'page' | 'unselected';

interface DocumentPage {
  id: string;
  name: string;
}

function getScopeLabel(scope: ScanScope, selectedPage: DocumentPage | null): string {
  if (scope === 'unselected') return 'Select an option';
  if (scope === 'all') return 'All Pages';
  if (scope === 'current') return 'Current Selection';
  return selectedPage ? selectedPage.name : 'Select Page';
}

interface Props {
  hasA11yResult: boolean;
  score: number;
  lastAuditDate: Date | null;
  categories: ExtendedAuditCategory[];
  statusCopy: string;
  targetCopy: string;
  highSeverityCount: number;
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
  onRunA11yAudit: () => void;
  isCalculating: boolean;
  scanProgress: { percent: number; count: number };
  issueListProps: any;
  a11yAuditLoading?: boolean;
  a11yAuditError?: string | null;
  onRetryConnection?: () => void;
  onCheckTokenStatus?: () => void;
  /** When true, "All Pages" is visible but disabled with "Coming soon" message */
  disableAllPages?: boolean;
}

export const AccessibilityTab: React.FC<Props> = ({
  hasA11yResult,
  score,
  lastAuditDate,
  categories,
  statusCopy,
  targetCopy,
  highSeverityCount,
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
  onRunA11yAudit,
  isCalculating,
  scanProgress,
  issueListProps,
  a11yAuditLoading,
  a11yAuditError,
  onRetryConnection,
  onCheckTokenStatus,
  disableAllPages = false,
}) => {
  const selectedPage = documentPages.find(p => p.id === selectedPageId) ?? null;

  const handleScanClick = () => {
    onRunA11yAudit();
  };

  if (!hasA11yResult) {
    return (
      <div className="p-4 h-[60vh] flex flex-col items-center justify-center">
        <div className={`${BRUTAL.card} bg-white py-8 w-full text-center`}>
          <CircularScore score={0} label="Ready" size="sm" />
          <p className="text-xs font-medium text-gray-500 mt-4 px-4 mb-4">Check contrast, touch targets, focus and more.</p>

          <div className="relative z-20 text-left mb-2 px-4">
            <div
              onClick={() => setIsScopeDropdownOpen(!isScopeDropdownOpen)}
              className={`${BRUTAL.input} flex justify-between items-center gap-2 cursor-pointer h-10 bg-white`}
            >
              <span className="text-xs font-bold uppercase truncate min-w-0" title={getScopeLabel(scanScope, selectedPage)}>{getScopeLabel(scanScope, selectedPage)}</span>
              <span className="shrink-0">{isScopeDropdownOpen ? '▲' : '▼'}</span>
            </div>
            {isScopeDropdownOpen && (
              <div className="absolute top-full left-4 right-4 bg-white border-2 border-black border-t-0 shadow-[4px_4px_0_0_#000] text-left z-30 max-h-48 overflow-y-auto custom-scrollbar">
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
                  onClick={(e) => { e.stopPropagation(); setScanScope('all'); setIsScopeDropdownOpen(false); }}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2"
                >
                  <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${scanScope === 'all' ? 'bg-black' : 'bg-white'}`} />
                  <span className="text-xs font-bold">All Pages</span>
                </div>
                )}
                <div
                  onClick={(e) => { e.stopPropagation(); setScanScope('current'); setIsScopeDropdownOpen(false); }}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2"
                >
                  <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${scanScope === 'current' ? 'bg-black' : 'bg-white'}`} />
                  <span className="text-xs font-bold">Current Selection</span>
                </div>
                <div className="border-t border-gray-200 my-0" aria-hidden />
                {documentPages.map(page => (
                  <div
                    key={page.id}
                    onClick={(e) => { e.stopPropagation(); setScanScope('page'); setSelectedPageId(page.id); setIsScopeDropdownOpen(false); }}
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2"
                  >
                    <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${scanScope === 'page' && selectedPageId === page.id ? 'bg-black' : 'bg-white'}`} />
                    <span className="text-xs">{page.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-4">
            <Button
              variant="primary"
              fullWidth
              onClick={handleScanClick}
              disabled={isCalculating || scanScope === 'unselected' || (scanScope === 'page' && !selectedPageId)}
            >
              {isCalculating && (
                <div className="absolute inset-0 bg-[#ffc900] transition-all duration-150 ease-out" style={{ width: `${scanProgress.percent}%` }} />
              )}
              <span className="relative z-10">{isCalculating ? `CALCULATING... ${scanProgress.percent}%` : 'Run A11Y Audit'}</span>
            </Button>
            <p className="text-[10px] text-gray-500 mt-2 text-center px-2">Credits scale by file/page size. No deduction until you confirm.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-in slide-in-from-left-2 mt-4">
      {a11yAuditLoading && (
        <div className="flex items-center gap-2 py-2 px-3 bg-[#ffc900] border-2 border-black text-[10px] font-bold uppercase">
          <span className="w-2 h-2 bg-black animate-pulse" />
          Analysing accessibility…
        </div>
      )}
      <div className={`${BRUTAL.card} bg-white p-3 flex items-start gap-3 relative min-h-[140px]`}>
        <div className="shrink-0 mt-1"><CircularScore score={score} size="sm" /></div>
        <div className="flex flex-col flex-1 w-full">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-400 mb-1">Current Status</span>
              <h2 className="text-sm font-black leading-tight max-w-[95%] mb-1">{statusCopy}</h2>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 font-medium mb-8">{targetCopy}</p>
          {lastAuditDate && (
            <span className="absolute bottom-3 left-3 text-[9px] font-mono text-gray-400">
              Last scan: {lastAuditDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      <div className="relative z-20">
        <div
          onClick={() => setIsScopeDropdownOpen(!isScopeDropdownOpen)}
          className={`${BRUTAL.input} flex justify-between items-center gap-2 cursor-pointer h-10`}
        >
          <span className="text-xs font-bold uppercase truncate min-w-0" title={getScopeLabel(scanScope, selectedPage)}>{getScopeLabel(scanScope, selectedPage)}</span>
          <span className="shrink-0">{isScopeDropdownOpen ? '▲' : '▼'}</span>
        </div>
        {isScopeDropdownOpen && (
          <div className="absolute top-full left-0 w-full bg-white border-2 border-black border-t-0 shadow-[4px_4px_0_0_#000] max-h-48 overflow-y-auto custom-scrollbar">
            {disableAllPages ? (
              <div className="flex flex-col gap-0 p-2 opacity-60 cursor-not-allowed" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2 p-2">
                  <div className="w-3 h-3 shrink-0 border border-black flex items-center justify-center bg-white" />
                  <span className="text-xs font-bold">All Pages</span>
                </div>
                <p className="text-[10px] text-gray-500 px-2 pb-2 italic">We are working hard to make this option available.</p>
              </div>
            ) : (
            <div onClick={(e) => { e.stopPropagation(); setScanScope('all'); setIsScopeDropdownOpen(false); }} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2">
              <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${scanScope === 'all' ? 'bg-black' : 'bg-white'}`} />
              <span className="text-xs font-bold">All Pages</span>
            </div>
            )}
            <div onClick={(e) => { e.stopPropagation(); setScanScope('current'); setIsScopeDropdownOpen(false); }} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2">
              <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${scanScope === 'current' ? 'bg-black' : 'bg-white'}`} />
              <span className="text-xs font-bold">Current Selection</span>
            </div>
            <div className="border-t border-gray-200 my-0" aria-hidden />
            {documentPages.map(page => (
              <div
                key={page.id}
                onClick={(e) => { e.stopPropagation(); setScanScope('page'); setSelectedPageId(page.id); setIsScopeDropdownOpen(false); }}
                className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2"
              >
                <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${scanScope === 'page' && selectedPageId === page.id ? 'bg-black' : 'bg-white'}`} />
                <span className="text-xs">{page.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button
        variant="primary"
        fullWidth
        onClick={handleScanClick}
        disabled={isCalculating || scanScope === 'unselected' || (scanScope === 'page' && !selectedPageId)}
      >
        {isCalculating && <div className="absolute inset-0 bg-[#ffc900] transition-all duration-150 ease-out" style={{ width: `${scanProgress.percent}%` }} />}
        <span className="relative z-10">{isCalculating ? `CALCULATING... ${scanProgress.percent}%` : 'Scan Again'}</span>
      </Button>

      <div className={`${BRUTAL.card} p-0 overflow-hidden bg-white`}>
        <div className="p-3 border-b-2 border-black bg-gray-50 flex justify-between items-center">
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
                  className={`flex items-center justify-between p-3 border-b border-gray-100 cursor-pointer transition-colors ${isActive ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`size-8 ${cat.color} border-2 border-black flex items-center justify-center text-sm shadow-[2px_2px_0_0_#000] text-black`}>{cat.icon}</div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase">{cat.label}</span>
                      <span className="text-[9px] font-medium opacity-70">{cat.desc}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono ${isActive ? 'text-gray-300' : 'text-gray-500'}`}>{pctOfTotal}%</span>
                    {cat.issuesCount > 0 && (
                      <span className="size-7 min-w-7 bg-white text-black border border-black flex items-center justify-center text-[9px] font-bold rounded-full">{formatIssueCount(cat.issuesCount)}</span>
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex justify-between items-center mb-2 px-1 py-2 border-b-2 border-black/10">
          <h3 className="font-black uppercase text-xs">{activeCat ? `${activeCat} Issues` : 'All Issues'}</h3>
          {highSeverityCount > 0 && <span className="text-[10px] font-bold bg-[#ffc900] text-black px-1.5 py-0.5 rounded-sm border border-black">{highSeverityCount} High</span>}
        </div>
        <IssueList displayIssues={displayIssues} activeIssues={activeIssues} {...issueListProps} />
      </div>
    </div>
  );
};
