import React from 'react';
import { BRUTAL, getPrototypeAuditCost } from '../../../constants';
import { Button } from '../../../components/ui/Button';
import { AlertBanner } from '../../../components/AlertBanner';
import { BrutalDropdown, brutalMenuRowClass } from '../../../components/ui/BrutalSelect';
import { CircularScore } from '../../../components/widgets/CircularScore';
import { IssueList } from '../components/IssueList';
import { ExtendedAuditCategory, formatIssueCount } from '../data';
import { AuditIssue } from '../../../types';

export interface FlowStartingPoint {
  nodeId: string;
  name: string;
}

interface Props {
  flowStartingPoints: FlowStartingPoint[];
  selectedFlowIds: string[];
  setSelectedFlowIds: (ids: string[]) => void;
  isFlowDropdownOpen: boolean;
  setIsFlowDropdownOpen: (open: boolean) => void;
  hasProtoResult: boolean;
  score: number;
  lastAuditDate: Date | null;
  categories: ExtendedAuditCategory[];
  statusCopy: string;
  highSeverityCount?: number;
  activeCat: string | null;
  setActiveCat: (id: string | null) => void;
  isPro: boolean;
  displayIssues: AuditIssue[];
  activeIssues: AuditIssue[];
  onRunProtoAudit: () => void;
  isCalculating: boolean;
  scanProgress: { percent: number; count: number };
  issueListProps: any;
  protoAuditLoading?: boolean;
  protoAuditError?: string | null;
}

/** Label for flow selector: single selection = flow name (like other audits); multiple = count; all = "All flows". */
function getFlowSelectorLabel(selectedIds: string[], flows: FlowStartingPoint[]): string {
  if (flows.length === 0) return 'No flows on this page';
  if (selectedIds.length === 0) return 'Select flows';
  if (selectedIds.length === flows.length) return 'All flows';
  if (selectedIds.length === 1) {
    const f = flows.find((fl) => fl.nodeId === selectedIds[0]);
    const name = f?.name?.trim();
    return name || '1 flow';
  }
  return `${selectedIds.length} flows`;
}

/**
 * Prototype Audit tab: same layout as DS / A11Y / UX (score, categories, issues).
 * Scope = multi-select flows (flow starting points); no "All Pages". Cost = getPrototypeAuditCost(selectedFlowCount).
 */
export const PrototypeAuditTab: React.FC<Props> = ({
  flowStartingPoints,
  selectedFlowIds,
  setSelectedFlowIds,
  isFlowDropdownOpen,
  setIsFlowDropdownOpen,
  hasProtoResult,
  score,
  lastAuditDate,
  categories,
  statusCopy,
  highSeverityCount = 0,
  activeCat,
  setActiveCat,
  isPro,
  displayIssues,
  activeIssues,
  onRunProtoAudit,
  isCalculating,
  scanProgress,
  issueListProps,
  protoAuditLoading,
  protoAuditError,
}) => {
  const selectedCount = selectedFlowIds.length;
  const { cost, sizeLabel } = getPrototypeAuditCost(selectedCount);
  const flowLabel = getFlowSelectorLabel(selectedFlowIds, flowStartingPoints);
  const canRun = flowStartingPoints.length > 0 && selectedCount > 0 && !isCalculating;
  const hasIssues = (displayIssues?.length ?? 0) > 0;

  const toggleFlow = (nodeId: string) => {
    if (selectedFlowIds.includes(nodeId)) {
      setSelectedFlowIds(selectedFlowIds.filter(id => id !== nodeId));
    } else {
      setSelectedFlowIds([...selectedFlowIds, nodeId]);
    }
  };

  const selectAllFlows = () => {
    setSelectedFlowIds(flowStartingPoints.map(f => f.nodeId));
    setIsFlowDropdownOpen(false);
  };

  const clearFlows = () => {
    setSelectedFlowIds([]);
    setIsFlowDropdownOpen(false);
  };

  if (!hasProtoResult) {
    return (
      <div className="p-4 h-[60vh] flex flex-col gap-4 items-center justify-center">
        {protoAuditError && (
          <div className="flex items-center gap-2 py-2 px-3 bg-red-100 border-2 border-red-600 text-[10px] font-bold w-full max-w-md">
            {protoAuditError}
          </div>
        )}
        <div className={`${BRUTAL.card} bg-white py-8 w-full text-center`}>
          <CircularScore score={0} label="Ready" size="sm" />
          <p className="text-xs font-medium text-gray-500 mt-4 px-4 mb-2">
            Run the Prototype audit on selected flows. Dead-ends, back nav, variables and more.
          </p>
          {flowStartingPoints.length === 0 ? (
            <AlertBanner variant="warning">
              No flow starting points on this page. Set at least one in the Prototype panel.
            </AlertBanner>
          ) : (
            <>
              <div className="relative z-20 text-left mb-2 px-4">
                <BrutalDropdown
                  open={isFlowDropdownOpen}
                  onOpenChange={setIsFlowDropdownOpen}
                  disabled={flowStartingPoints.length === 0}
                  className="w-full"
                  maxHeightClassName="max-h-48"
                  trigger={
                    <button
                      type="button"
                      disabled={flowStartingPoints.length === 0}
                      onClick={() => flowStartingPoints.length > 0 && setIsFlowDropdownOpen(!isFlowDropdownOpen)}
                      className={`${BRUTAL.input} flex justify-between items-center gap-2 cursor-pointer h-10 bg-white w-full text-left ${flowStartingPoints.length === 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <span className="text-xs font-bold uppercase truncate min-w-0" title={flowLabel}>{flowLabel}</span>
                      <span className="shrink-0" aria-hidden>{isFlowDropdownOpen ? '▲' : '▼'}</span>
                    </button>
                  }
                >
                  <div
                    role="option"
                    onClick={() => selectAllFlows()}
                    className={`${brutalMenuRowClass} border-b border-gray-100`}
                  >
                    <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${selectedCount === flowStartingPoints.length ? 'bg-black' : 'bg-white'}`} />
                    <span className="text-xs font-bold">All flows</span>
                  </div>
                  <div
                    role="option"
                    onClick={() => clearFlows()}
                    className={`${brutalMenuRowClass} border-b border-gray-100`}
                  >
                    <div className="w-3 h-3 shrink-0 border border-black bg-white" />
                    <span className="text-xs">Clear</span>
                  </div>
                  <div className="border-t border-gray-200 my-0" aria-hidden />
                  {flowStartingPoints.map((flow) => (
                    <div
                      key={flow.nodeId}
                      role="option"
                      onClick={() => toggleFlow(flow.nodeId)}
                      className={`${brutalMenuRowClass} border-b border-gray-100 last:border-b-0`}
                    >
                      <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${selectedFlowIds.includes(flow.nodeId) ? 'bg-black' : 'bg-white'}`} />
                      <span className="text-xs truncate" title={flow.name}>{flow.name || flow.nodeId}</span>
                    </div>
                  ))}
                </BrutalDropdown>
              </div>
              <div className="px-4">
                {selectedCount > 0 && (
                  <p className="text-[10px] text-gray-600 mb-2 text-center">
                    {cost} credit{cost !== 1 ? 's' : ''} ({sizeLabel})
                  </p>
                )}
                <Button
                  variant="primary"
                  fullWidth
                  onClick={onRunProtoAudit}
                  disabled={!canRun}
                >
                  {isCalculating && (
                    <div className="absolute inset-0 bg-[#ffc900] transition-all duration-150 ease-out" style={{ width: `${scanProgress.percent}%` }} />
                  )}
                  <span className="relative z-10">
                    {isCalculating ? `AUDITING... ${scanProgress.percent}%` : 'Run Prototype Audit'}
                  </span>
                </Button>
                <p className="text-[10px] text-gray-500 mt-2 text-center px-2">
                  No credits will be deducted until you confirm.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-in slide-in-from-left-2 mt-4">
      {protoAuditLoading && (
        <div className="flex items-center gap-2 py-2 px-3 bg-[#ffc900] border-2 border-black text-[10px] font-bold uppercase">
          <span className="w-2 h-2 bg-black animate-pulse" />
          Auditing prototype…
        </div>
      )}
      {protoAuditError && (
        <div className="flex items-center gap-2 py-2 px-3 bg-red-100 border-2 border-red-600 text-[10px] font-bold">
          {protoAuditError}
        </div>
      )}
      {/* Header Stat Card — same as DS / A11Y / UX */}
      <div className={`${BRUTAL.card} bg-white p-3 flex items-start gap-3 relative min-h-[140px]`}>
        <div className="shrink-0 mt-1"><CircularScore score={score} size="sm" /></div>
        <div className="flex flex-col flex-1 w-full">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-400 mb-1">Current Status</span>
              <h2 className="text-sm font-black leading-tight max-w-[95%] mb-1">{statusCopy}</h2>
            </div>
          </div>
          {lastAuditDate && (
            <span className="absolute bottom-3 left-3 text-[9px] font-mono text-gray-400">
              Last scan: {lastAuditDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Flow multi-select */}
      <div className="relative z-20">
        <BrutalDropdown
          open={isFlowDropdownOpen}
          onOpenChange={setIsFlowDropdownOpen}
          disabled={flowStartingPoints.length === 0}
          className="w-full"
          maxHeightClassName="max-h-48"
          trigger={
            <button
              type="button"
              disabled={flowStartingPoints.length === 0}
              onClick={() => flowStartingPoints.length > 0 && setIsFlowDropdownOpen(!isFlowDropdownOpen)}
              className={`${BRUTAL.input} flex justify-between items-center gap-2 cursor-pointer h-10 w-full text-left bg-white ${flowStartingPoints.length === 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <span className="text-xs font-bold uppercase truncate min-w-0" title={flowLabel}>{flowLabel}</span>
              <span className="shrink-0" aria-hidden>{isFlowDropdownOpen ? '▲' : '▼'}</span>
            </button>
          }
        >
          <div role="option" onClick={() => selectAllFlows()} className={`${brutalMenuRowClass} border-b border-gray-100`}>
            <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${selectedCount === flowStartingPoints.length ? 'bg-black' : 'bg-white'}`} />
            <span className="text-xs font-bold">All flows</span>
          </div>
          <div role="option" onClick={() => clearFlows()} className={`${brutalMenuRowClass} border-b border-gray-100`}>
            <div className="w-3 h-3 shrink-0 border border-black bg-white" />
            <span className="text-xs">Clear</span>
          </div>
          <div className="border-t border-gray-200 my-0" aria-hidden />
          {flowStartingPoints.map((flow) => (
            <div
              key={flow.nodeId}
              role="option"
              onClick={() => toggleFlow(flow.nodeId)}
              className={`${brutalMenuRowClass} border-b border-gray-100 last:border-b-0`}
            >
              <div className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${selectedFlowIds.includes(flow.nodeId) ? 'bg-black' : 'bg-white'}`} />
              <span className="text-xs truncate" title={flow.name}>{flow.name || flow.nodeId}</span>
            </div>
          ))}
        </BrutalDropdown>
      </div>

      <Button
        variant="primary"
        fullWidth
        onClick={onRunProtoAudit}
        disabled={!canRun || isCalculating}
      >
        {isCalculating && (
          <div className="absolute inset-0 bg-[#ffc900] transition-all duration-150 ease-out" style={{ width: `${scanProgress.percent}%` }} />
        )}
        <span className="relative z-10">
          {isCalculating ? `AUDITING... ${scanProgress.percent}%` : 'Scan Again'}
        </span>
      </Button>

      {score === 100 && !protoAuditLoading && !hasIssues ? (
        <div className={`${BRUTAL.card} bg-white p-6 flex flex-col items-center justify-center text-center gap-4`}>
          <div className="w-24 h-24 border-4 border-black bg-gray-100 flex items-center justify-center shadow-[6px_6px_0_0_#000]">
            <span className="text-3xl">▶️</span>
          </div>
          <div className="max-w-xs">
            <h3 className="font-black uppercase text-xs mb-1">Flows run smoothly</h3>
            <p className="text-[10px] text-gray-600 font-medium">
              No dead-ends, missing back paths or weird jumps detected in these flows. Keep prototyping — we&apos;ll catch any bumps as they appear.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Categories */}
          <div className={`${BRUTAL.cardFlush} overflow-hidden bg-white`}>
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
              <h3 className="font-black uppercase text-xs">
                {activeCat ? `${categories.find(c => c.id === activeCat)?.label ?? activeCat} Issues` : 'All Issues'}
              </h3>
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
