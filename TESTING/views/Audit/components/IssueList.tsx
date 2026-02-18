
import React from 'react';
import { BRUTAL, COLORS } from '../../../constants';
import { Badge } from '../../../components/Badge';
import { AuditIssue } from '../../../types';

interface IssueListProps {
  displayIssues: AuditIssue[];
  activeIssues: AuditIssue[]; // Needed for calculating fixAllCost on remaining
  expandedIssue: string | null;
  setExpandedIssue: (id: string | null) => void;
  fixedIds: Set<string>;
  discardedIds: Set<string>;
  feedbackSentIds: Set<string>;
  deviationNavIndex: { [issueId: string]: number };
  layerSelectionFeedback: string | null;
  isPro: boolean;
  activeTab: string;
  onFix: (e: React.MouseEvent, id: string) => void;
  onUndo: (e: React.MouseEvent, id: string) => void;
  onDiscard: (e: React.MouseEvent, id: string) => void;
  onUndoDiscard: (e: React.MouseEvent, id: string) => void;
  onOpenFeedback: (e: React.MouseEvent, id: string, type: 'DISCARD' | 'BAD_FIX') => void;
  onSelectLayer: (e: React.MouseEvent, id: string) => void;
  onNavDeviation: (e: React.MouseEvent, issueId: string, layerIds: string[], direction: 'prev' | 'next') => void;
  onFixAll: () => void;
  onUnlockRequest: () => void;
  totalHiddenCount: number;
}

export const IssueList: React.FC<IssueListProps> = ({
  displayIssues,
  activeIssues,
  expandedIssue,
  setExpandedIssue,
  fixedIds,
  discardedIds,
  feedbackSentIds,
  deviationNavIndex,
  layerSelectionFeedback,
  isPro,
  activeTab,
  onFix,
  onUndo,
  onDiscard,
  onUndoDiscard,
  onOpenFeedback,
  onSelectLayer,
  onNavDeviation,
  onFixAll,
  onUnlockRequest,
  totalHiddenCount
}) => {
  const remainingIssues = activeIssues.filter(i => !fixedIds.has(i.id) && i.id !== 'p2' && !discardedIds.has(i.id));
  const fixAllCost = remainingIssues.length * 2;

  const groupedIssues: { [page: string]: AuditIssue[] } = {};
  displayIssues.forEach(issue => {
      const page = issue.pageName || 'Unknown Page';
      if (!groupedIssues[page]) groupedIssues[page] = [];
      groupedIssues[page].push(issue);
  });

  return (
    <div className="space-y-6">
      {Object.entries(groupedIssues).map(([pageName, issues]) => (
        <div key={pageName}>
            <div className="mb-2 border-b border-black/10 pb-1">
                <span className="text-[10px] font-black uppercase bg-gray-100 px-2 py-0.5 text-gray-600">Page: {pageName}</span>
            </div>
            
            <div className="space-y-2">
                {issues.map(i => {
                    const expanded = expandedIssue === i.id;
                    const isFixed = fixedIds.has(i.id);
                    const isDiscarded = discardedIds.has(i.id);
                    const isFeedbackSent = feedbackSentIds.has(i.id);
                    const isWireframeIssue = i.id === 'p2';
                    const isDeviationGroup = i.layerIds && i.layerIds.length > 1;
                    const currentIndex = deviationNavIndex[i.id] || 0;
                    
                    if (isDiscarded) {
                        return (
                            <div key={i.id} className="flex justify-between items-center p-2 bg-gray-100 border border-gray-300 opacity-60">
                                <span className="text-[10px] font-bold text-gray-500 line-through">{i.msg} (Discarded)</span>
                                <div className="flex gap-2">
                                    {!feedbackSentIds.has(i.id) && (
                                        <button onClick={(e) => onOpenFeedback(e, i.id, 'DISCARD')} className="text-[9px] underline font-bold">Feedback</button>
                                    )}
                                    <button onClick={(e) => onUndoDiscard(e, i.id)} className="text-[9px] font-black uppercase">Undo</button>
                                </div>
                            </div>
                        );
                    }

                    return (
                    <div 
                        key={i.id} 
                        onClick={() => !isFixed && !isFeedbackSent && setExpandedIssue(expanded ? null : i.id)}
                        className={`${BRUTAL.card} p-3 transition-all ${isFeedbackSent ? 'bg-gray-200 border-gray-400 opacity-60 cursor-not-allowed' : isFixed ? 'bg-green-100 border-green-500 opacity-80' : 'bg-white hover:shadow-[6px_6px_0_0_#000] cursor-pointer'} ${expanded ? 'shadow-[6px_6px_0_0_#000] border-black' : ''}`}
                    >
                        <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                            {isFixed && !isFeedbackSent && <span className="text-lg">✅</span>}
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge label={i.severity} type={i.severity === 'HIGH' ? 'high' : i.severity === 'MED' ? 'medium' : 'low'} />
                                    <span className={`font-bold text-xs ${isFixed || isFeedbackSent ? 'line-through text-gray-500' : ''}`}>
                                        {isDeviationGroup ? `Component Deviation x ${i.layerIds!.length} elements` : i.msg}
                                    </span>
                                </div>
                                <p className="text-[10px] text-gray-500 font-mono">ID: {i.layerId}</p>
                            </div>
                        </div>
                        
                        {isFeedbackSent ? (
                            <span className="text-[9px] font-black uppercase text-gray-500 border border-gray-500 px-1">Feedback Sent</span>
                        ) : isFixed ? (
                            <div className="flex gap-2">
                                <button 
                                    onClick={(e) => onOpenFeedback(e, i.id, 'BAD_FIX')}
                                    className="text-[9px] font-bold underline text-red-500 hover:text-red-700"
                                >
                                    Report Bad Fix
                                </button>
                                <button 
                                    onClick={(e) => onUndo(e, i.id)}
                                    className="text-[10px] font-black uppercase bg-black text-white px-2 py-1 hover:bg-red-500"
                                >
                                    UNDO
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                {expanded && (
                                    <button 
                                        onClick={(e) => onDiscard(e, i.id)}
                                        className="text-[10px] font-bold text-gray-400 hover:text-red-500"
                                    >
                                        Discard
                                    </button>
                                )}
                                <span className="text-[10px] font-bold underline hover:text-[#ff90e8]">{expanded ? 'CLOSE' : 'VIEW'}</span>
                            </div>
                        )}
                        </div>

                        {expanded && !isFixed && !isFeedbackSent && (
                        <div className="mt-4 pt-3 border-t-2 border-dashed border-black animate-in slide-in-from-top-1">
                            <p className="text-xs font-medium mb-4 leading-relaxed">
                            Problem: {i.msg}.<br/>Suggestion: {i.fix}.
                            </p>
                            <div className="flex gap-2">
                            {isDeviationGroup ? (
                                <div className="flex-1 flex border-2 border-black h-12 bg-gray-50">
                                    <button 
                                        onClick={(e) => onNavDeviation(e, i.id, i.layerIds!, 'prev')}
                                        className="px-3 hover:bg-black hover:text-white font-bold border-r border-black"
                                    >
                                        ←
                                    </button>
                                    <div className="flex-1 flex items-center justify-center text-[10px] font-bold uppercase">
                                        Layer {currentIndex + 1} of {i.layerIds!.length} selected
                                    </div>
                                    <button 
                                        onClick={(e) => onNavDeviation(e, i.id, i.layerIds!, 'next')}
                                        className="px-3 hover:bg-black hover:text-white font-bold border-l border-black"
                                    >
                                        →
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={(e) => onSelectLayer(e, i.id)}
                                    className={`flex-1 border-2 border-black text-[10px] font-bold uppercase py-2 transition-colors ${layerSelectionFeedback === i.id ? 'bg-white text-black' : 'bg-white hover:bg-gray-100'}`}
                                >
                                    {layerSelectionFeedback === i.id ? 'SELECTED!' : 'Select Layer'}
                                </button>
                            )}
                            
                            <button 
                                onClick={(e) => onFix(e, i.id)} 
                                className={`${BRUTAL.btn} flex-1 text-[10px] bg-[${COLORS.primary}] text-black hover:bg-white border-black relative h-12`}
                            >
                                {isWireframeIssue ? 'Create Wireframe' : 'Auto-Fix Layer'}
                                {!isWireframeIssue && (
                                    <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm border border-black shadow-[1px_1px_0_0_#000]">-2 Credits</span>
                                )}
                                {isWireframeIssue && (
                                    <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm border border-black shadow-[1px_1px_0_0_#000]">-3 Credits</span>
                                )}
                            </button>
                            </div>
                        </div>
                        )}
                    </div>
                    );
                })}
            </div>
        </div>
      ))}

      {isPro && fixAllCost > 0 && activeTab !== 'PROTOTYPE' && (
          <button 
            onClick={onFixAll}
            className={`${BRUTAL.btn} w-full bg-[${COLORS.primary}] text-black border-black mt-4 flex justify-center items-center relative animate-in slide-in-from-bottom-2 hover:bg-white`}
          >
            <span>AUTO-FIX ALL ISSUES</span>
            <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">
                -{fixAllCost} Credits
            </span>
          </button>
      )}

      {!isPro && totalHiddenCount > 0 && (
          <div className="mt-4 animate-in slide-in-from-bottom-2">
              <button 
                  onClick={onUnlockRequest}
                  className={`${BRUTAL.btn} w-full flex justify-center items-center gap-2 relative bg-[${COLORS.primary}] shadow-[6px_6px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[4px_4px_0_0_#000] transition-all`}
              >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C9.243 2 7 4.243 7 7V10H6C4.895 10 4 10.895 4 12V20C4 21.105 4.895 22 6 22H18C19.105 22 20 21.105 20 20V12C20 10.895 19.105 10 18 10H17V7C17 4.243 14.757 2 12 2ZM12 4C13.657 4 15 5.343 15 7V10H9V7C9 5.343 10.343 4 12 4Z" fill="black"/>
                  </svg>
                  <span>Unlock {totalHiddenCount} Hidden Issues</span>
                  <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">PRO</span>
              </button>
          </div>
      )}
    </div>
  );
};
