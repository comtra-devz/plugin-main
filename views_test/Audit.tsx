import React, { useState, useEffect } from 'react';
import { BRUTAL, COLORS } from '../constants_test';
import { UserPlan, AuditIssue, AuditCategory } from '../types_test';
import { CircularScore } from '../components_test/widgets/CircularScore';
import { Confetti } from '../components_test/Confetti';
import { SuccessModal } from '../components_test/SuccessModal';
import { Badge } from '../components_test/Badge';

const LOADING_MSGS = [
  "Admiring the magnificent colors...",
  "Reading the beautiful story...",
  "Observing class naming...",
  "Gathering stardust...",
  "Whispering to the pixels..."
];

const CATEGORIES: AuditCategory[] = [
  { id: 'tokens', label: 'Tokens', score: 92, icon: '❖', color: 'bg-[#ff90e8]', issuesCount: 3 },
  { id: 'typography', label: 'Typography', score: 85, icon: 'Tt', color: 'bg-blue-300', issuesCount: 4 },
  { id: 'color', label: 'Color', score: 98, icon: '🎨', color: 'bg-pink-300', issuesCount: 1 },
  { id: 'grid', label: 'Layout Grids', score: 60, icon: '▦', color: 'bg-yellow-300', issuesCount: 5 },
  { id: 'a11y', label: 'Accessibility', score: 100, icon: '♿', color: 'bg-green-300', issuesCount: 0 },
];

const MOCK_ISSUES: AuditIssue[] = [
  { id: '1', categoryId: 'tokens', msg: 'Hardcoded Hex', severity: 'HIGH', layerId: 'n1', fix: 'Use var(--primary)', tokenPath: 'sys.color.primary.500' },
  { id: '2', categoryId: 'naming', msg: 'Layer "Frame 432"', severity: 'LOW', layerId: 'n2', fix: 'Rename to "Card_Header"' },
  { id: '3', categoryId: 'duplicates', msg: 'Detached Instance', severity: 'MED', layerId: 'n3', fix: 'Reattach to master' },
  { id: '4', categoryId: 'grid', msg: 'Misaligned 2px', severity: 'LOW', layerId: 'n4', fix: 'Snap to 8px grid' },
  { id: '5', categoryId: 'typography', msg: 'Unknown Font', severity: 'HIGH', layerId: 'n5', fix: 'Use Space Grotesk' },
];

const MAX_FREE_USES = 3;

const LinkedInIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);

interface Props { 
  plan: UserPlan; 
  onUnlockRequest: () => void;
  usageCount: number;
  onUse: () => void;
}

export const Audit: React.FC<Props> = ({ plan, onUnlockRequest, usageCount, onUse }) => {
  const [hasAudited, setHasAudited] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0]);
  
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [score, setScore] = useState(78);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Feedback state for "Select Layer" button
  const [layerSelectionFeedback, setLayerSelectionFeedback] = useState<string | null>(null);

  // New State for Fix/Undo
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());

  const isPro = plan === 'PRO';
  const remaining = Math.max(0, MAX_FREE_USES - usageCount);
  const activeIssues = activeCat ? MOCK_ISSUES.filter(i => i.categoryId === activeCat) : MOCK_ISSUES;
  const displayIssues = isPro ? activeIssues : activeIssues.slice(0, 2);
  const totalHiddenCount = MOCK_ISSUES.length - 2; // Fixed global hidden calculation for Free plan context

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
      }, 4500);
    }
    return () => clearInterval(interval);
  }, [isScanning]);

  const handleStartScan = () => {
    if (!isPro && remaining === 0) {
      onUnlockRequest();
      return;
    }
    if (!isPro) onUse();
    setIsScanning(true);
  };

  const handleFix = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newFixed = new Set(fixedIds);
    newFixed.add(id);
    setFixedIds(newFixed);
    
    // Increment score logic
    const newScore = Math.min(100, score + 5);
    setScore(newScore);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2000);

    // Show success modal if crossing threshold
    if (newScore > 80 && score <= 80) setShowSuccess(true);
    if (newScore > 90 && score <= 90) setShowSuccess(true);
    if (newScore === 100 && score < 100) setShowSuccess(true);
  };

  const handleUndo = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newFixed = new Set(fixedIds);
    newFixed.delete(id);
    setFixedIds(newFixed);
    setScore(s => Math.max(0, s - 5));
  };

  const handleSelectLayer = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setLayerSelectionFeedback(id);
    setTimeout(() => setLayerSelectionFeedback(null), 2000);
  };

  const handleShare = () => {
     window.open('https://www.linkedin.com/sharing/share-offsite/?url=https://comtra.ai', '_blank');
  };

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

  if (!hasAudited) return (
    <div className="p-4 h-[70vh] flex flex-col items-center justify-center">
      
       {/* Credit Banner for Empty State too */}
       <div className="flex justify-center mb-6">
          <div className={`transform rotate-1 border-2 border-black px-3 py-1 text-[10px] font-black uppercase shadow-[3px_3px_0_0_#000] ${remaining === 0 && !isPro ? 'bg-red-100 text-red-600' : 'bg-[#ffc900] text-black'}`}>
            {isPro ? 'Pro Status: Active (∞)' : `Free Credits Remaining: ${remaining}/${MAX_FREE_USES}`}
          </div>
       </div>

      <div className={`${BRUTAL.card} bg-white py-8 w-full text-center`}>
        <CircularScore score={0} label="Ready" size="sm" />
        <p className="text-xs font-medium text-gray-500 mt-4 px-4">Let's see how your system shines today.</p>
        <button onClick={handleStartScan} className={`${BRUTAL.btn} bg-[${COLORS.primary}] w-full mt-4`}>Scan Design</button>
      </div>
    </div>
  );

  return (
    <div className="p-4 flex flex-col gap-4 pb-24">
      {showConfetti && <Confetti />}
      {showSuccess && <SuccessModal score={score} onClose={() => setShowSuccess(false)} />}

      {/* Credit Banner */}
      <div className="flex justify-center mb-1">
        <div className={`transform -rotate-1 border-2 border-black px-3 py-1 text-[10px] font-black uppercase shadow-[3px_3px_0_0_#000] ${remaining === 0 && !isPro ? 'bg-red-100 text-red-600' : 'bg-[#ffc900] text-black'}`}>
          {isPro ? 'Credits: ∞' : `Free Credits: ${remaining}/${MAX_FREE_USES}`}
        </div>
      </div>

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

          <button 
             onClick={handleShare} 
             className="absolute bottom-3 right-3 bg-black text-white px-3 py-1.5 text-[10px] font-bold uppercase hover:bg-gray-800 transition-colors flex items-center gap-1 shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]"
          >
             <LinkedInIcon />
             Share
          </button>
        </div>
      </div>

      {/* Re-scan Button (Consumes Credit) - Taller and Black */}
      <button 
        onClick={handleStartScan}
        className="w-full bg-black text-white border-2 border-black h-14 px-4 text-xs font-bold uppercase hover:bg-gray-800 flex justify-between items-center shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]"
      >
        <span>Start New Audit</span>
        <span className="text-[10px] bg-white text-black px-2 py-0.5 rounded-sm font-black">
           {isPro ? '∞' : '-1 Credit'}
        </span>
      </button>

      {/* Categories Vertical Scroll Card */}
      <div className={`${BRUTAL.card} p-0 overflow-hidden bg-white`}>
         <div className="p-3 border-b-2 border-black bg-gray-50 flex justify-between items-center">
             <h3 className="font-bold uppercase text-xs">Problem Categories ⚠️</h3>
             <span className="text-[10px] font-bold bg-black text-white px-1.5 py-0.5 rounded-sm">
                {CATEGORIES.reduce((acc, c) => acc + c.issuesCount, 0)} Issues
             </span>
         </div>
         <div className="max-h-[160px] overflow-y-auto custom-scrollbar p-0">
             {CATEGORIES.map(cat => {
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
                          {/* Progress Bar: if active, track is dark gray, fill is white for contrast */}
                          <div className={`w-16 h-1.5 mt-1 rounded-full overflow-hidden border border-black/20 ${isActive ? 'bg-gray-800' : 'bg-gray-200'}`}>
                             <div className={`${isActive ? 'bg-white' : 'bg-black'} h-full`} style={{width: `${cat.score}%`}}></div>
                          </div>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       <span className={`text-[10px] font-mono ${isActive ? 'text-gray-300' : 'text-gray-500'}`}>{cat.score}%</span>
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

      {/* Issue List */}
      <div className="flex flex-col">
        <div className="flex justify-between items-center mb-2 px-5 sticky top-[58px] z-10 py-3 bg-[#fdfdfd] -mx-4 border-b-2 border-black/5">
            <h3 className="font-bold uppercase text-xs">{activeCat ? `${activeCat} Issues` : 'All Issues'}</h3>
            <span className="text-[10px] font-bold bg-black text-white px-2 rounded-full">{activeIssues.length}</span>
        </div>
        
        <div className="space-y-2">
            {displayIssues.map(i => {
              const expanded = expandedIssue === i.id;
              const isFixed = fixedIds.has(i.id);
              
              return (
                <div 
                  key={i.id} 
                  onClick={() => !isFixed && setExpandedIssue(expanded ? null : i.id)}
                  className={`${BRUTAL.card} p-3 transition-all ${isFixed ? 'bg-green-100 border-green-500 opacity-80' : 'bg-white hover:shadow-[6px_6px_0_0_#000] cursor-pointer'} ${expanded ? 'shadow-[6px_6px_0_0_#000] border-black' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        {isFixed && <span className="text-lg">✅</span>}
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Badge label={i.severity} type={i.severity === 'HIGH' ? 'high' : i.severity === 'MED' ? 'medium' : 'low'} />
                                <span className={`font-bold text-xs ${isFixed ? 'line-through text-gray-500' : ''}`}>{i.msg}</span>
                            </div>
                            <p className="text-[10px] text-gray-500 font-mono">ID: {i.layerId}</p>
                        </div>
                    </div>
                    
                    {isFixed ? (
                        <button 
                            onClick={(e) => handleUndo(e, i.id)}
                            className="text-[10px] font-black uppercase bg-black text-white px-2 py-1 hover:bg-red-500"
                        >
                            UNDO
                        </button>
                    ) : (
                        <span className="text-[10px] font-bold underline hover:text-[#ff90e8]">{expanded ? 'CLOSE' : 'VIEW'}</span>
                    )}
                  </div>

                  {expanded && !isFixed && (
                    <div className="mt-4 pt-3 border-t-2 border-dashed border-black animate-in slide-in-from-top-1">
                      <p className="text-xs font-medium mb-4 leading-relaxed">
                        Problem: {i.msg}.<br/>Suggestion: {i.fix}.
                      </p>
                      <div className="flex gap-2">
                        <button 
                           onClick={(e) => handleSelectLayer(e, i.id)}
                           className={`flex-1 border-2 border-black text-[10px] font-bold uppercase py-2 transition-colors ${layerSelectionFeedback === i.id ? 'bg-white text-black' : 'bg-white hover:bg-gray-100'}`}
                        >
                           {layerSelectionFeedback === i.id ? 'SELECTED!' : 'Select Layer'}
                        </button>
                        <button 
                           onClick={(e) => handleFix(e, i.id)} 
                           className={`${BRUTAL.btn} flex-1 text-[10px] bg-black text-white hover:bg-gray-800 border-white`}
                        >
                          Auto-Fix Layer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unlock Hidden Issues CTA for Free Users - Always visible at bottom of list */}
            {!isPro && (
                <div className="mt-4 animate-in slide-in-from-bottom-2">
                    <button 
                        onClick={onUnlockRequest}
                        className={`${BRUTAL.btn} w-full flex justify-center items-center gap-2 relative bg-[${COLORS.primary}] shadow-[6px_6px_0_0_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[4px_4px_0_0_#000] transition-all`}
                    >
                        <span className="text-lg">🔓</span>
                        <span>Unlock {totalHiddenCount > 0 ? totalHiddenCount : 'All'} Hidden Issues</span>
                        <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">PRO</span>
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};