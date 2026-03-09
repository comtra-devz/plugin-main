import React, { useState, useEffect } from 'react';
import { BRUTAL, COLORS, AUTH_BACKEND_URL } from '../constants';
import { User } from '../types';
import type { CreditsState } from '../App';

interface Props {
  user: User | null;
  credits: CreditsState | null;
  useInfiniteCreditsForTest?: boolean;
  onUpgrade: () => void;
}

const FREE_TIER_CREDITS = 25;
const LEVELS_WITH_DISCOUNT = [5, 10, 15, 20];

export const Subscription: React.FC<Props> = ({ user, credits, useInfiniteCreditsForTest, onUpgrade }) => {
  const [showLimitWarning, setShowLimitWarning] = useState(false);
  const [levelDiscount, setLevelDiscount] = useState<{ code: string; level: number; percent: number } | null>(null);
  const [discountCopied, setDiscountCopied] = useState(false);

  useEffect(() => {
    if (!user?.authToken || !user?.current_level) return;
    if (!LEVELS_WITH_DISCOUNT.includes(user.current_level)) return;
    fetch(`${AUTH_BACKEND_URL}/api/discounts/me`, {
      headers: { Authorization: `Bearer ${user.authToken}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.code) setLevelDiscount({ code: d.code, level: d.level ?? 0, percent: d.percent ?? 0 });
      })
      .catch(() => {});
  }, [user?.authToken, user?.current_level]);

  const copyLevelCode = () => {
    if (!levelDiscount?.code) return;
    navigator.clipboard.writeText(levelDiscount.code).then(() => {
      setDiscountCopied(true);
      setTimeout(() => setDiscountCopied(false), 2000);
    });
  };

  if (!user) return null;

  const isPro = user.plan === 'PRO';
  const subType = isPro ? '6 MONTH PRO' : 'FREE TIER';
  const totalCreditsFromApi = credits?.total;
  const totalCredits = isPro ? 600 : (totalCreditsFromApi ?? FREE_TIER_CREDITS);
  const usedCredits = credits?.used ?? 0;
  const creditsLoaded = credits != null;
  const remainingCredits = useInfiniteCreditsForTest ? Infinity : (credits?.remaining ?? (creditsLoaded ? 0 : null));
  const usedForMeter = useInfiniteCreditsForTest ? 0 : (isPro ? usedCredits : Math.min(usedCredits, totalCredits));
  const remainingPercent = useInfiniteCreditsForTest ? 100 : (totalCredits > 0 ? Math.round(((totalCredits - usedForMeter) / totalCredits) * 100) : 0);
  const expiryDate = isPro ? '24 Oct 2024' : 'N/A';

  const handleSimulateLimit = () => {
    setShowLimitWarning(true);
  };

  return (
    <div data-component="Subscription: View Container" className="p-4 flex flex-col gap-6 pb-16 relative">
      
      {/* Credits limit warning (simulated for dev) */}
      {showLimitWarning && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6">
           <div data-component="Subscription: Warning Modal" className={`${BRUTAL.card} bg-white text-center`}>
              <div className="text-4xl mb-2">⚡</div>
              <h2 className="text-xl font-black uppercase mb-2 text-red-600">Credits esauriti</h2>
              <p className="text-xs text-gray-600 mb-4 font-medium">
                 You've used all {totalCredits} credits in your current cycle. Upgrade to PRO to continue.
              </p>
              <button data-component="Subscription: Warning Upgrade Button" onClick={onUpgrade} className={`${BRUTAL.btn} w-full bg-[#ffc900] mb-2`}>
                 Upgrade to PRO
              </button>
              <button data-component="Subscription: Warning Dismiss" onClick={() => setShowLimitWarning(false)} className="text-[10px] font-bold underline">
                 Close
              </button>
           </div>
        </div>
      )}

      <div data-component="Subscription: Current Plan Card" className={`${BRUTAL.card} bg-white`}>
        <div className="flex justify-between items-start mb-4">
           <div>
               <h2 data-component="Subscription: Plan Title" className="text-2xl font-black uppercase mb-1">Your Plan</h2>
               <div className="flex items-center gap-2">
                 <span data-component="Subscription: Plan Badge" className={`px-2 py-0.5 font-bold text-white uppercase text-[10px] tracking-wider ${isPro ? 'bg-[#ff90e8]' : 'bg-gray-800'}`}>
                   {subType}
                 </span>
                 <span data-component="Subscription: Plan Status" className="text-[10px] font-mono text-gray-500">
                    {isPro ? 'Active' : 'Limited'}
                 </span>
               </div>
           </div>
           {isPro && (
             <div className="text-right">
                <div data-component="Subscription: Expiry Label" className="text-[10px] font-bold uppercase text-gray-400">Expires</div>
                <div data-component="Subscription: Expiry Date" className="text-sm font-black">{expiryDate}</div>
             </div>
           )}
        </div>
        
        <div className="space-y-4 border-t-2 border-black pt-4">
          
          <div data-component="Subscription: Usage Meter">
             <div className="flex justify-between items-end mb-1">
                <span data-component="Subscription: Meter Label" className="font-bold text-xs uppercase">Credits</span>
                <span data-component="Subscription: Meter Stats" className="font-mono text-[10px] font-bold">
                   {useInfiniteCreditsForTest ? '∞ (test)' : !creditsLoaded ? '—' : `${remainingCredits} / ${totalCredits} (${remainingPercent}% left)`}
                </span>
             </div>
             <div className="w-full h-3 border-2 border-black p-0.5 bg-gray-100 rounded-sm">
                <div 
                   className={`h-full ${!creditsLoaded ? 'bg-gray-300' : remainingPercent < 10 ? 'bg-red-500' : 'bg-black'} transition-all duration-500`} 
                   style={{ width: creditsLoaded && totalCredits > 0 ? `${(usedForMeter / totalCredits) * 100}%` : '0%' }}
                ></div>
             </div>
          </div>

          {!isPro && (
             <div data-component="Subscription: Free Info Box" className="bg-gray-100 p-2 text-[10px] font-medium text-gray-600 border border-gray-300">
                Free tier: 25 credits one-time (bonus benvenuto). Upgrade to PRO per più credits e tutte le funzionalità.
             </div>
          )}

          <button data-component="Subscription: Dev Simulator" onClick={handleSimulateLimit} className="text-[9px] text-gray-400 underline decoration-dashed">
             [Dev: Simulate credits exhausted]
          </button>

        </div>
      </div>

      {levelDiscount && (
        <div data-component="Subscription: Level Discount Code" className={`${BRUTAL.card} bg-[#ffc900]/30 border-2 border-black`}>
          <h3 className="font-black uppercase text-xs mb-2">Your level discount (Annual plan)</h3>
          <p className="text-[10px] text-gray-600 mb-2">Level {levelDiscount.level} — {levelDiscount.percent}% off. One-time use at checkout.</p>
          <div className="flex items-center gap-2">
            <code className="font-mono text-sm font-bold bg-white px-2 py-1 border-2 border-black flex-1 truncate">
              {levelDiscount.code}
            </code>
            <button
              type="button"
              onClick={copyLevelCode}
              className={`${BRUTAL.btn} text-[10px] px-2 py-1 shrink-0 border-2 border-black bg-black text-white hover:bg-[#ff90e8] hover:text-black`}
            >
              {discountCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {!isPro && (
        <div data-component="Subscription: Upgrade Card" className={`${BRUTAL.card} bg-[#ffc900] border-dashed`}>
          <h3 data-component="Subscription: Upgrade Title" className="font-black uppercase text-lg mb-2">Upgrade to Pro</h3>
          <ul className="list-disc list-inside text-xs font-bold mb-4 space-y-1">
            <li data-component="Subscription: Benefit 1">600 credits / 6 mesi</li>
            <li data-component="Subscription: Benefit 2">Full Code Export (React/Storybook)</li>
            <li data-component="Subscription: Benefit 3">Deep Fix e funzionalità sbloccate</li>
          </ul>
          <button data-component="Subscription: Buy License Button" onClick={onUpgrade} className={`${BRUTAL.btn} bg-black text-white w-full`}>
            Acquista (da €7)
          </button>
        </div>
      )}

      <button data-component="Subscription: Cancel Button" className="text-xs font-bold underline text-gray-500 hover:text-black">
        Cancel Subscription
      </button>
    </div>
  );
};
