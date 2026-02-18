import React, { useState } from 'react';
import { BRUTAL, COLORS } from '../constants';
import { User } from '../types';

interface Props {
  user: User | null;
  onUpgrade: () => void;
}

export const Subscription: React.FC<Props> = ({ user, onUpgrade }) => {
  const [showLimitWarning, setShowLimitWarning] = useState(false);
  
  if (!user) return null;

  // Mock Data for Subscription
  const isPro = user.plan === 'PRO';
  const subType = isPro ? '6 MONTH PRO' : 'FREE TIER';
  const totalPrompts = isPro ? 800 : 20; // Example limits
  const usedPrompts = isPro ? 450 : 12; // Example usage
  const remainingPercent = Math.round(((totalPrompts - usedPrompts) / totalPrompts) * 100);
  const expiryDate = isPro ? '24 Oct 2024' : 'N/A';

  const handleSimulateLimit = () => {
    setShowLimitWarning(true);
  };

  return (
    <div className="p-4 flex flex-col gap-6 pb-24 relative">
      
      {/* Prompt Limit Warning Popup (Simulated) */}
      {showLimitWarning && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6">
           <div className={`${BRUTAL.card} bg-white text-center`}>
              <div className="text-4xl mb-2">⚡</div>
              <h2 className="text-xl font-black uppercase mb-2 text-red-600">Out of Energy!</h2>
              <p className="text-xs text-gray-600 mb-4 font-medium">
                 You have used all {totalPrompts} prompts in your current cycle. 
                 Time to recharge your creative batteries.
              </p>
              <button onClick={onUpgrade} className={`${BRUTAL.btn} w-full bg-[#ffc900] mb-2`}>
                 Upgrade Plan
              </button>
              <button onClick={() => setShowLimitWarning(false)} className="text-[10px] font-bold underline">
                 Dismiss
              </button>
           </div>
        </div>
      )}

      <div className={`${BRUTAL.card} bg-white`}>
        <div className="flex justify-between items-start mb-4">
           <div>
               <h2 className="text-2xl font-black uppercase mb-1">Your Plan</h2>
               <div className="flex items-center gap-2">
                 <span className={`px-2 py-0.5 font-bold text-white uppercase text-[10px] tracking-wider ${isPro ? 'bg-[#ff90e8]' : 'bg-gray-800'}`}>
                   {subType}
                 </span>
                 <span className="text-[10px] font-mono text-gray-500">
                    {isPro ? 'Active' : 'Limited'}
                 </span>
               </div>
           </div>
           {isPro && (
             <div className="text-right">
                <div className="text-[10px] font-bold uppercase text-gray-400">Expires</div>
                <div className="text-sm font-black">{expiryDate}</div>
             </div>
           )}
        </div>
        
        <div className="space-y-4 border-t-2 border-black pt-4">
          
          {/* Usage Meter */}
          <div>
             <div className="flex justify-between items-end mb-1">
                <span className="font-bold text-xs uppercase">Prompt Usage</span>
                <span className="font-mono text-[10px] font-bold">
                   {usedPrompts} / {totalPrompts} ({remainingPercent}% left)
                </span>
             </div>
             <div className="w-full h-3 border-2 border-black p-0.5 bg-gray-100 rounded-sm">
                <div 
                   className={`h-full ${remainingPercent < 10 ? 'bg-red-500' : 'bg-black'} transition-all duration-500`} 
                   style={{ width: `${(usedPrompts / totalPrompts) * 100}%` }}
                ></div>
             </div>
          </div>

          {!isPro && (
             <div className="bg-gray-100 p-2 text-[10px] font-medium text-gray-600 border border-gray-300">
                You are on the Free tier. Upgrade to get 800 prompts/cycle and unlock all features.
             </div>
          )}

          {/* Dev helper to test popup */}
          <button onClick={handleSimulateLimit} className="text-[9px] text-gray-400 underline decoration-dashed">
             [Dev: Simulate Limit Reached]
          </button>

        </div>
      </div>

      {!isPro && (
        <div className={`${BRUTAL.card} bg-[#ffc900] border-dashed`}>
          <h3 className="font-black uppercase text-lg mb-2">Upgrade to Pro</h3>
          <ul className="list-disc list-inside text-xs font-bold mb-4 space-y-1">
            <li>800 AI Prompts / 6 Months</li>
            <li>Full Code Export (React/Storybook)</li>
            <li>Deep Fix Links</li>
          </ul>
          <button onClick={onUpgrade} className={`${BRUTAL.btn} bg-black text-white w-full`}>
            Buy License (from €7)
          </button>
        </div>
      )}

      <button className="text-xs font-bold underline text-gray-500 hover:text-black">
        Cancel Subscription
      </button>
    </div>
  );
};