
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BRUTAL, COLORS, TIER_LIMITS, PRIVACY_CONTENT, getScanCostAndSize, COUNT_CAP } from '../../constants';
import { UserPlan, AuditIssue } from '../../types';
import { CircularScore } from '../../components/widgets/CircularScore';
import { Confetti } from '../../components/Confetti';
import { SuccessModal } from '../../components/SuccessModal';
import { ScanReceiptModal } from '../../components/ScanReceiptModal';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { DesignSystemTab, ScanScope } from './tabs/DesignSystemTab';
import { DeepAnalysisTab } from './tabs/DeepAnalysisTab';
import { 
  LOADING_MSGS, 
  CATEGORIES, 
  DS_ISSUES, 
  A11Y_ISSUES, 
  UX_ISSUES, 
  PROTO_ISSUES 
} from './data';

interface Props { 
  plan: UserPlan; 
  userTier?: string;
  onUnlockRequest: () => void;
  usageCount: number;
  onUse: () => void;
  onNavigateToGenerate?: (prompt: string) => void;
}

type AuditTab = 'DS' | 'A11Y' | 'UX' | 'PROTOTYPE';

export const Audit: React.FC<Props> = ({ plan, userTier, onUnlockRequest, usageCount, onUse, onNavigateToGenerate }) => {
  const [activeTab, setActiveTab] = useState<AuditTab>('DS');
  const [hasAudited, setHasAudited] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0]);
  
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [score, setScore] = useState(78);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Selection State for Deep Audits
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [layerSelectionFeedback, setLayerSelectionFeedback] = useState<string | null>(null);
  const [hasDeepScanned, setHasDeepScanned] = useState(false);
  const [isDeepScanning, setIsDeepScanning] = useState(false);

  // Receipt Modal State
  const [showReceipt, setShowReceipt] = useState(false);
  const [scanStats, setScanStats] = useState({ nodes: 0, cost: 0, sizeLabel: '', target: 'All Pages' });
  const [pendingScanType, setPendingScanType] = useState<'MAIN' | 'DEEP' | null>(null);

  // Confirmation Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isWarning?: boolean;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  // Excluded Pages Logic (for issue filtering)
  const [excludedPages, setExcludedPages] = useState<string[]>([]);

  // Scope & Document Pages (for node scan)
  const [documentPages, setDocumentPages] = useState<{ id: string; name: string }[]>([]);
  const [scanScope, setScanScope] = useState<ScanScope>('all');
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [isScopeDropdownOpen, setIsScopeDropdownOpen] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [scanProgress, setScanProgress] = useState({ percent: 0, count: 0 });
  const [scanElapsedSeconds, setScanElapsedSeconds] = useState(0);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [fakeProgressPercent, setFakeProgressPercent] = useState(0);
  const fakeProgressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Component Deviation Navigator State
  const [deviationNavIndex, setDeviationNavIndex] = useState<{ [issueId: string]: number }>({});

  // Timestamps
  const [lastAuditDate, setLastAuditDate] = useState<Date | null>(null);
  const [lastDeepScanDate, setLastDeepScanDate] = useState<Date | null>(null);

  // New State for Fix/Undo/Discard
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());
  const [discardedIds, setDiscardedIds] = useState<Set<string>>(new Set());
  const [feedbackSentIds, setFeedbackSentIds] = useState<Set<string>>(new Set());
  
  // Feedback Modal State
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackTargetId, setFeedbackTargetId] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'DISCARD' | 'BAD_FIX'>('DISCARD');
  const [feedbackText, setFeedbackText] = useState('');

  // Privacy Modal State
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const isPro = plan === 'PRO';
  
  // Credit Limit Logic
  const limit = isPro 
    ? (userTier && TIER_LIMITS[userTier] ? TIER_LIMITS[userTier] : TIER_LIMITS['PRO']) 
    : TIER_LIMITS['FREE'];
    
  const effectiveUsage = isPro ? 450 + usageCount : usageCount;
  const remaining = Math.max(0, limit - effectiveUsage);
  
  const creditsDisplay = isPro ? `${limit - effectiveUsage}/${limit}` : `${remaining}/${limit}`;

  // Determine which issue set to use
  let currentIssues = DS_ISSUES;
  if (activeTab === 'A11Y') currentIssues = A11Y_ISSUES;
  if (activeTab === 'UX') currentIssues = UX_ISSUES;
  if (activeTab === 'PROTOTYPE') currentIssues = PROTO_ISSUES;

  // Filter out excluded pages
  const filteredIssues = currentIssues.filter(i => !i.pageName || !excludedPages.includes(i.pageName));
  const activeIssues = activeCat ? filteredIssues.filter(i => i.categoryId === activeCat) : filteredIssues;
  const displayIssues = isPro ? activeIssues : activeIssues.slice(0, 2);
  const totalHiddenCount = currentIssues.length - 2; 

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isScanning) {
      let i = 0;
      interval = setInterval(() => {
        i = (i + 1) % LOADING_MSGS.length;
        setLoadingMsg(LOADING_MSGS[i]);
      }, 1500);
      
      setTimeout(() => {
        setIsScanning(false);
        setHasAudited(true);
        setLastAuditDate(new Date());
      }, 4500);
    }
    return () => clearInterval(interval);
  }, [isScanning]);

  // Fetch document pages on mount
  useEffect(() => {
    window.parent.postMessage({ pluginMessage: { type: 'get-pages' } }, '*');
  }, []);

  // Timer: runs while scan is in progress, stops when count-nodes-result is received (isCalculating false)
  useEffect(() => {
    if (!isCalculating) {
      if (scanTimerRef.current) {
        clearInterval(scanTimerRef.current);
        scanTimerRef.current = null;
      }
      return;
    }
    setScanElapsedSeconds(0);
    scanTimerRef.current = setInterval(() => {
      setScanElapsedSeconds(s => s + 1);
    }, 1000);
    return () => {
      if (scanTimerRef.current) {
        clearInterval(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };
  }, [isCalculating]);

  // Fake progress: random steps and delays so the bar feels real in fast (non-problematic) cases
  useEffect(() => {
    if (!isCalculating) {
      setFakeProgressPercent(0);
      if (fakeProgressRef.current) {
        clearTimeout(fakeProgressRef.current);
        fakeProgressRef.current = null;
      }
      return;
    }
    setFakeProgressPercent(0);
    let cancelled = false;
    const FAKE_CAP = 95; // never show 100% from fake; only real result sets 100%
    const scheduleNext = (current: number) => {
      if (cancelled || current >= FAKE_CAP) return;
      const step = Math.floor(Math.random() * 10) + 4; // 4–13%
      const delay = 60 + Math.floor(Math.random() * 160); // 60–220ms
      fakeProgressRef.current = setTimeout(() => {
        if (cancelled) return;
        setFakeProgressPercent(prev => {
          const next = Math.min(FAKE_CAP, prev + step);
          scheduleNext(next);
          return next;
        });
      }, delay);
    };
    const firstDelay = 80 + Math.floor(Math.random() * 120);
    fakeProgressRef.current = setTimeout(() => {
      if (cancelled) return;
      setFakeProgressPercent(prev => {
        const step = Math.floor(Math.random() * 10) + 4;
        const next = Math.min(FAKE_CAP, prev + step);
        scheduleNext(next);
        return next;
      });
    }, firstDelay);
    return () => {
      cancelled = true;
      if (fakeProgressRef.current) {
        clearTimeout(fakeProgressRef.current);
        fakeProgressRef.current = null;
      }
    };
  }, [isCalculating]);

  // Listen for plugin messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data?.pluginMessage;
      if (!msg) return;
      if (msg.type === 'pages-result' && msg.pages) {
        setDocumentPages(msg.pages);
        setSelectedPageId((prev) => (prev ? prev : msg.pages[0]?.id ?? null));
      }
      if (msg.type === 'count-nodes-progress') {
        setScanProgress({ percent: msg.percent ?? 0, count: msg.count ?? 0 });
      }
      if (msg.type === 'count-nodes-result') {
        const count = msg.count ?? 0;
        const target = msg.target ?? 'All Pages';
        const { cost, sizeLabel } = getScanCostAndSize(count);
        setScanStats({ nodes: count, cost, sizeLabel, target });
        setPendingScanType('MAIN');
        setScanProgress(prev => ({ ...prev, count }));
        const minLoadingMs = 1200 + Math.floor(Math.random() * 1000);
        setTimeout(() => {
          setScanProgress({ percent: 100, count });
          setIsCalculating(false);
          setShowReceipt(true);
        }, minLoadingMs);
      }
      if (msg.type === 'count-nodes-error') {
        setIsCalculating(false);
        setScanProgress({ percent: 0, count: msg.count ?? 0 });
        console.error('[count-nodes-error]', msg.error, 'count so far:', msg.count);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleStartScan = useCallback(() => {
    if (!isPro && remaining === 0) {
      onUnlockRequest();
      return;
    }
    setIsCalculating(true);
    setScanProgress({ percent: 0, count: 0 });
    const scope = scanScope;
    const pageId = scope === 'page' ? selectedPageId : undefined;
    window.parent.postMessage({ pluginMessage: { type: 'count-nodes', scope, pageId, countCap: COUNT_CAP } }, '*');
  }, [isPro, remaining, onUnlockRequest, scanScope, selectedPageId]);

  const handleDeepScan = () => {
    if (!isPro && remaining === 0) {
        onUnlockRequest();
        return;
    }
    const mockNodes = Math.floor(Math.random() * 1000) + 50;
    const { cost, sizeLabel } = getScanCostAndSize(mockNodes);
    setScanStats({ nodes: mockNodes, cost, sizeLabel, target: 'Current Selection' });
    setPendingScanType('DEEP');
    setShowReceipt(true);
  };

  const handleConfirmScan = () => {
      if (!isPro) onUse();
      setShowReceipt(false);
      
      if (pendingScanType === 'MAIN') {
          setIsScanning(true);
      } else if (pendingScanType === 'DEEP') {
          setIsDeepScanning(true);
          setTimeout(() => {
              setIsDeepScanning(false);
              setHasDeepScanned(true);
              setLastDeepScanDate(new Date());
          }, 1500);
      }
      setPendingScanType(null);
  };

  const handleFix = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (id === 'p2' && onNavigateToGenerate) {
        onNavigateToGenerate("Create a confirmation wireframe for the checkout flow with success state");
        return;
    }

    setConfirmConfig({
        isOpen: true,
        title: "Confirm Auto-Fix",
        message: "This action will apply changes to your layer and consume credits. Are you sure?",
        confirmLabel: "Apply Fix",
        onConfirm: () => {
            const newFixed = new Set(fixedIds);
            newFixed.add(id);
            setFixedIds(newFixed);
            
            const newScore = Math.min(100, score + 5);
            setScore(newScore);
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 2000);

            if (newScore > 80 && score <= 80) setShowSuccess(true);
            if (newScore > 90 && score <= 90) setShowSuccess(true);
            if (newScore === 100 && score < 100) setShowSuccess(true);
            setConfirmConfig(null);
        }
    });
  };

  const handleFixAll = () => {
      const unfixed = activeIssues.filter(i => !fixedIds.has(i.id) && i.id !== 'p2' && !discardedIds.has(i.id)); 
      if (unfixed.length === 0) return;

      setConfirmConfig({
        isOpen: true,
        title: `Fix All (${unfixed.length})`,
        message: `You are about to apply ${unfixed.length} fixes. For safety, we recommend duplicating the file or page before proceeding. Confirm?`,
        confirmLabel: `Apply All (-${unfixed.length * 2} Credits)`,
        onConfirm: () => {
            const newFixed = new Set(fixedIds);
            unfixed.forEach(i => newFixed.add(i.id));
            setFixedIds(newFixed);
            
            const addedScore = unfixed.length * 5;
            setScore(Math.min(100, score + addedScore));
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 2000);
            setConfirmConfig(null);
        }
      });
  };

  const handleUndo = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmConfig({
        isOpen: true,
        title: "Undo Changes?",
        message: "Are you sure you want to undo? Warning: spent credits will NOT be refunded.",
        isWarning: true,
        confirmLabel: "Undo Anyway",
        onConfirm: () => {
            const newFixed = new Set(fixedIds);
            newFixed.delete(id);
            setFixedIds(newFixed);
            
            // Also remove from feedbackSentIds if present, to restore to initial state
            const newFeedbackSent = new Set(feedbackSentIds);
            newFeedbackSent.delete(id);
            setFeedbackSentIds(newFeedbackSent);

            setScore(s => Math.max(0, s - 5));
            setConfirmConfig(null);
        }
    });
  };

  const handleDiscard = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      handleOpenFeedback(e, id, 'DISCARD');
  };

  const handleUndoDiscard = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const newDiscarded = new Set(discardedIds);
      newDiscarded.delete(id);
      setDiscardedIds(newDiscarded);
  };

  const handleOpenFeedback = (e: React.MouseEvent, id: string, type: 'DISCARD' | 'BAD_FIX') => {
      e.stopPropagation();
      setFeedbackTargetId(id);
      setFeedbackType(type);
      setFeedbackOpen(true);
      setFeedbackText('');
  };

  const handleSubmitFeedback = () => {
      if (feedbackTargetId) {
          if (feedbackType === 'DISCARD') {
              const newDiscarded = new Set(discardedIds);
              newDiscarded.add(feedbackTargetId);
              setDiscardedIds(newDiscarded);
              // Mark feedback as sent for this discard
              const newSent = new Set(feedbackSentIds);
              newSent.add(feedbackTargetId);
              setFeedbackSentIds(newSent);
          } else if (feedbackType === 'BAD_FIX') {
              const newSent = new Set(feedbackSentIds);
              newSent.add(feedbackTargetId);
              setFeedbackSentIds(newSent);
          }
      }
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);
      setFeedbackOpen(false);
  };

  const handleSelectLayer = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setLayerSelectionFeedback(id);
    setTimeout(() => setLayerSelectionFeedback(null), 2000);
  };

  const handleShare = () => {
     window.open('https://www.linkedin.com/sharing/share-offsite/?url=https://comtra.ai', '_blank');
  };

  const handleNavDeviation = (e: React.MouseEvent, issueId: string, layerIds: string[], direction: 'prev' | 'next') => {
      e.stopPropagation();
      const currentIndex = deviationNavIndex[issueId] || 0;
      let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
      
      if (newIndex >= layerIds.length) newIndex = 0;
      if (newIndex < 0) newIndex = layerIds.length - 1;

      setDeviationNavIndex(prev => ({ ...prev, [issueId]: newIndex }));
      handleSelectLayer(e, layerIds[newIndex]); 
  };

  // Shared props for IssueList to avoid repetition
  const issueListProps = {
    expandedIssue,
    setExpandedIssue,
    fixedIds,
    discardedIds,
    feedbackSentIds,
    deviationNavIndex,
    layerSelectionFeedback,
    isPro,
    activeTab,
    onFix: handleFix,
    onUndo: handleUndo,
    onDiscard: handleDiscard,
    onUndoDiscard: handleUndoDiscard,
    onOpenFeedback: handleOpenFeedback,
    onSelectLayer: handleSelectLayer,
    onNavDeviation: handleNavDeviation,
    onFixAll: handleFixAll,
    onUnlockRequest: onUnlockRequest,
    totalHiddenCount: totalHiddenCount
  };

  const wordCount = feedbackText.trim().split(/\s+/).filter(w => w.length > 0).length;
  const canSubmitFeedback = wordCount >= 2;

  if (isScanning) return (
    <div className="p-8 h-[70vh] flex flex-col items-center justify-center text-center overflow-hidden">
      <style>{`
        @keyframes fill-bar {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
      <div className="text-4xl mb-6 animate-bounce">✨</div>
      <h3 className="text-xl font-black uppercase mb-4 leading-tight">{loadingMsg}</h3>
      <div className="w-full h-4 border-2 border-black p-0.5 rounded-full bg-white">
         <div 
           className="h-full bg-[#ff90e8]" 
           style={{ animation: 'fill-bar 4.5s ease-in-out forwards' }}
         ></div>
      </div>
    </div>
  );

  return (
    <div className="p-4 flex flex-col gap-4 pb-24 relative">
      {showConfetti && <Confetti />}
      {showSuccess && <SuccessModal score={score} onClose={() => setShowSuccess(false)} />}
      {showReceipt && (
          <ScanReceiptModal 
            nodeCount={scanStats.nodes}
            cost={scanStats.cost}
            sizeLabel={scanStats.sizeLabel}
            target={scanStats.target}
            onConfirm={handleConfirmScan} 
            onCancel={() => setShowReceipt(false)} 
          />
      )}
      {confirmConfig && confirmConfig.isOpen && (
          <ConfirmationModal
            title={confirmConfig.title}
            message={confirmConfig.message}
            onConfirm={confirmConfig.onConfirm}
            onCancel={() => setConfirmConfig(null)}
            confirmLabel={confirmConfig.confirmLabel}
            isWarning={confirmConfig.isWarning}
          />
      )}

      {/* FEEDBACK MODAL OVERLAY */}
      {feedbackOpen && (
          <div onClick={() => setFeedbackOpen(false)} className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
              <div onClick={(e) => e.stopPropagation()} className={`${BRUTAL.card} max-w-sm w-full bg-white relative`}>
                  <button onClick={() => setFeedbackOpen(false)} className="absolute top-2 right-2 text-xl font-bold">×</button>
                  <h3 className="font-black uppercase text-sm mb-2 bg-black text-white inline-block px-1">
                      {feedbackType === 'DISCARD' ? 'Why was this not an error?' : 'What went wrong?'}
                  </h3>
                  <textarea 
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Describe context (min 2 words)..."
                    className="w-full border-2 border-black p-2 text-xs font-mono mb-2 min-h-[80px] bg-white text-black"
                  />
                  <div className="mb-4">
                      <p className="text-[10px] text-gray-500 leading-tight">
                          You accept to send data to improve the plugin quality and the <button onClick={() => setShowPrivacyModal(true)} className="underline cursor-pointer hover:text-black">Privacy e Policy</button>.
                      </p>
                  </div>
                  <button 
                    onClick={handleSubmitFeedback} 
                    disabled={!canSubmitFeedback}
                    className={`${BRUTAL.btn} bg-[${COLORS.primary}] w-full disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                      Send Feedback
                  </button>
              </div>
          </div>
      )}

      {/* PRIVACY MODAL OVERLAY */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-6" onClick={() => setShowPrivacyModal(false)}>
           <div className={`${BRUTAL.card} bg-white max-w-lg w-full relative`} onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowPrivacyModal(false)} className="absolute top-2 right-2 text-2xl font-bold">×</button>
              <h2 className="text-2xl font-black uppercase mb-4 bg-black text-white inline-block px-2">Privacy Policy</h2>
              <div className="space-y-4 text-xs leading-relaxed font-medium text-gray-700 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {PRIVACY_CONTENT.map((item, index) => (
                    <p key={index}>
                    <strong className="block text-black uppercase mb-1">{item.title}</strong>
                    {item.text}
                    </p>
                ))}
              </div>
           </div>
        </div>
      )}

      <div className="flex justify-center mb-2">
        <div className={`transform -rotate-2 border-2 border-black px-3 py-1 text-[10px] font-black uppercase shadow-[3px_3px_0_0_#000] ${remaining === 0 && !isPro ? 'bg-red-100 text-red-600' : 'bg-[#ffc900] text-black'}`}>
          {isPro ? `Credits: ${creditsDisplay}` : `Free Credits Remaining: ${remaining}/${limit}`}
        </div>
      </div>

      <div className="grid grid-cols-2 border-2 border-black bg-white shadow-[4px_4px_0_0_#000]">
        <button 
          onClick={() => { setActiveTab('DS'); setSelectedLayer(null); setHasDeepScanned(false); }}
          className={`py-2 text-[10px] font-black uppercase transition-colors border-b-2 border-black ${activeTab === 'DS' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
        >
          Design System
        </button>
        <button 
          onClick={() => { setActiveTab('A11Y'); setHasDeepScanned(false); }}
          className={`py-2 text-[10px] font-black uppercase transition-colors border-l-2 border-b-2 border-black ${activeTab === 'A11Y' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
        >
          Accessibility
        </button>
        <button 
          onClick={() => { setActiveTab('UX'); setHasDeepScanned(false); }}
          className={`py-2 text-[10px] font-black uppercase transition-colors ${activeTab === 'UX' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
        >
          UX Audit
        </button>
        <button 
          onClick={() => { setActiveTab('PROTOTYPE'); setHasDeepScanned(false); }}
          className={`py-2 text-[10px] font-black uppercase transition-colors border-l-2 border-black ${activeTab === 'PROTOTYPE' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
        >
          Prototype
        </button>
      </div>

      {activeTab === 'DS' && (
        <DesignSystemTab 
            hasAudited={hasAudited}
            score={score}
            lastAuditDate={lastAuditDate}
            categories={CATEGORIES}
            activeCat={activeCat}
            setActiveCat={setActiveCat}
            documentPages={documentPages}
            scanScope={scanScope}
            setScanScope={setScanScope}
            selectedPageId={selectedPageId}
            setSelectedPageId={setSelectedPageId}
            isScopeDropdownOpen={isScopeDropdownOpen}
            setIsScopeDropdownOpen={setIsScopeDropdownOpen}
            isPro={isPro}
            displayIssues={displayIssues}
            activeIssues={activeIssues}
            onStartScan={handleStartScan}
            onShare={handleShare}
            isCalculating={isCalculating}
            scanProgress={{ ...scanProgress, percent: Math.max(scanProgress.percent, fakeProgressPercent) }}
            scanElapsedSeconds={scanElapsedSeconds}
            issueListProps={issueListProps}
        />
      )}

      {activeTab !== 'DS' && (
        <DeepAnalysisTab 
            activeTab={activeTab}
            selectedLayer={selectedLayer}
            setSelectedLayer={setSelectedLayer}
            hasDeepScanned={hasDeepScanned}
            setHasDeepScanned={setHasDeepScanned}
            lastDeepScanDate={lastDeepScanDate}
            isDeepScanning={isDeepScanning}
            activeIssues={activeIssues}
            onDeepScan={handleDeepScan}
            issueListProps={issueListProps}
        />
      )}
    </div>
  );
};
