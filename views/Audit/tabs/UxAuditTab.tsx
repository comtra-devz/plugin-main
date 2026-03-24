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

/** UX: no "All Pages" option; when scope is 'all' we show "Current Selection" as label. */
function getUxScopeLabel(scope: ScanScope, selectedPage: DocumentPage | null): string {
  if (scope === 'unselected') return 'Select an option';
  if (scope === 'all') return 'Current Selection'; // UX tab never shows "All Pages"
  if (scope === 'current') return 'Current Selection';
  return selectedPage ? selectedPage.name : 'Select Page';
}

interface Props {
  hasUxResult: boolean;
  score: number;
  lastAuditDate: Date | null;
  categories: ExtendedAuditCategory[];
  statusCopy: string;
  targetCopy?: string;
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
  onRunUxAudit: () => void;
  isCalculating: boolean;
  scanProgress: { percent: number; count: number };
  issueListProps: any;
  uxAuditLoading?: boolean;
  uxAuditError?: string | null;
  onRetryConnection?: () => void;
  onCheckTokenStatus?: () => void;
}

/**
 * UX Audit tab: same layout as DS and A11Y (score, scope, categories, issues).
 * Scope dropdown has Current Selection + page list only — no "All Pages" option.
 */
export const UxAuditTab: React.FC<Props> = ({
  hasUxResult,
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
  onRunUxAudit,
  isCalculating,
  scanProgress,
  issueListProps,
  uxAuditLoading,
  uxAuditError,
  onRetryConnection,
  onCheckTokenStatus,
}) => {
  const selectedPage = documentPages.find(p => p.id === selectedPageId) ?? null;
  const handleScanClick = () => onRunUxAudit();
  const scopeLabel = getUxScopeLabel(scanScope, selectedPage);
  const canRun = scanScope !== 'unselected' && !(scanScope === 'page' && !selectedPageId);
  const hasIssues = (displayIssues?.length ?? 0) > 0;

  if (!hasUxResult) {
    return (
      <div className="p-4 h-[60vh] flex flex-col items-center justify-center">
        {uxAuditError && (
          <div className="w-full mb-4 p-3 bg-red-50 border-2 border-red-600 text-[10px] font-bold text-red-700">
            {uxAuditError}
          </div>
        )}
        <div className={`${BRUTAL.card} bg-white py-8 w-full text-center`}>
          <CircularScore score={0} label="Ready" size="sm" />
          <p className="text-xs font-medium text-gray-500 mt-4 px-4 mb-4">
            Run the UX Logic audit on your file. States, labels, feedback, copy and more.
          </p>
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
                  <span className="text-xs font-bold uppercase truncate min-w-0" title={scopeLabel}>{scopeLabel}</span>
                  <span className="shrink-0" aria-hidden>{isScopeDropdownOpen ? '▲' : '▼'}</span>
                </button>
              }
            >
              <div
                role="option"
                onClick={() => { setScanScope('current'); setIsScopeDropdownOpen(false); }}
                className={`${brutalMenuRowClass} border-b border-gray-100`}
              >
                <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${scanScope === 'current' || scanScope === 'all' ? 'bg-black' : 'bg-white'}`} />
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
              disabled={isCalculating || !canRun}
            >
              {isCalculating && (
                <div className="absolute inset-0 bg-[#ffc900] transition-all duration-150 ease-out" style={{ width: `${scanProgress.percent}%` }} />
              )}
              <span className="relative z-10">
                {isCalculating ? `CALCULATING... ${scanProgress.percent}%` : 'Run UX Audit'}
              </span>
            </Button>
            <p className="text-[10px] text-gray-500 mt-2 text-center px-2">
              No credits will be deducted until you confirm.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-in slide-in-from-left-2 mt-4">
      {uxAuditError && (
        <div className="p-3 bg-red-50 border-2 border-red-600 text-[10px] font-bold text-red-700">
          {uxAuditError}
        </div>
      )}
      {uxAuditLoading && (
        <div className="flex items-center gap-2 py-2 px-3 bg-[#ffc900] border-2 border-black text-[10px] font-bold uppercase">
          <span className="w-2 h-2 bg-black animate-pulse" />
          Analysing UX…
        </div>
      )}
      {/* Header Stat Card — same as DS / A11Y */}
      <div className={`${BRUTAL.card} bg-white p-3 flex items-start gap-3 relative min-h-[140px]`}>
        <div className="shrink-0 mt-1"><CircularScore score={score} size="sm" /></div>
        <div className="flex flex-col flex-1 w-full">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-400 mb-1">Current Status</span>
              <h2 className="text-sm font-black leading-tight max-w-[95%] mb-1">{statusCopy}</h2>
            </div>
          </div>
          {targetCopy && (
            <p className="text-[10px] text-gray-500 font-medium mb-8">{targetCopy}</p>
          )}
          {lastAuditDate && (
            <span className="absolute bottom-3 left-3 text-[9px] font-mono text-gray-400">
              Last scan: {lastAuditDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Scope: Current Selection + page list only (no "All Pages" option) */}
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
              <span className="text-xs font-bold uppercase truncate min-w-0" title={scopeLabel}>{scopeLabel}</span>
              <span className="shrink-0" aria-hidden>{isScopeDropdownOpen ? '▲' : '▼'}</span>
            </button>
          }
        >
          <div
            role="option"
            onClick={() => { setScanScope('current'); setIsScopeDropdownOpen(false); }}
            className={`${brutalMenuRowClass} border-b border-gray-100`}
          >
            <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${scanScope === 'current' || scanScope === 'all' ? 'bg-black' : 'bg-white'}`} />
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

      <Button
        variant="primary"
        fullWidth
        onClick={handleScanClick}
        disabled={isCalculating || !canRun}
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

      {score === 100 && !uxAuditLoading && !hasIssues ? (
        <div className={`${BRUTAL.card} bg-white p-6 flex flex-col items-center justify-center text-center gap-4`}>
          <div className="w-24 h-24 border-4 border-black bg-gray-100 flex items-center justify-center shadow-[6px_6px_0_0_#000]">
            <span className="text-3xl">💬</span>
          </div>
          <div className="max-w-xs">
            <h3 className="font-black uppercase text-xs mb-1">Flows feel just right</h3>
            <p className="text-[10px] text-gray-600 font-medium">
              States, labels and feedback are lining up with UX best practices. Keep iterating — we&apos;ll flag anything that starts to feel off.
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
