
import React, { useState } from 'react';
import { BRUTAL, COLORS } from '../constants';

const TIERS = [
  { id: '1w', label: '1 Week', price: '€7', sub: 'Just trying', limit: '20 prompts' },
  { id: '1m', label: '1 Month', price: '€25', sub: 'Standard', limit: '100 prompts/mo' },
  { id: '6m', label: '6 Months', price: '€99', sub: 'Save 30%', rec: true, limit: '800 prompts' },
  { id: '1y', label: '1 Year', price: '€250', sub: 'Best Value', limit: 'Unlimited prompts' },
];

export const UpgradeModal: React.FC<{ onClose: () => void; onUpgrade: (tier: string) => void }> = ({ onClose, onUpgrade }) => {
  const [sel, setSel] = useState('6m');
  const [promoCode, setPromoCode] = useState('');

  const openDiscord = () => {
      window.open('https://discord.gg/comtra', '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
      <div className={`${BRUTAL.card} max-w-sm w-full relative max-h-[90vh] overflow-y-auto`}>
        <button onClick={onClose} className="absolute top-2 right-2 font-bold text-xl">×</button>
        <h2 className="text-2xl font-black uppercase mb-4 bg-[#ffc900] inline-block px-1">Unlock Pro</h2>
        
        <div className="space-y-3 mb-4">
          {TIERS.map(t => (
            <div 
              key={t.id} 
              onClick={() => setSel(t.id)}
              className={`border-2 cursor-pointer p-3 flex justify-between items-center transition-all ${
                sel === t.id ? 'border-black bg-black text-white shadow-[4px_4px_0_0_#ff90e8]' : 'border-gray-300 hover:border-black'
              }`}
            >
              <div className="flex flex-col">
                <span className="font-bold uppercase text-sm flex items-center gap-2">
                  {t.label} 
                  {t.rec && <span className="bg-[#ff90e8] text-black text-[9px] px-1 py-0.5">RECOMMENDED</span>}
                </span>
                <span className={`text-[10px] font-mono ${sel === t.id ? 'text-gray-300' : 'text-gray-500'}`}>{t.sub}</span>
                <span className={`text-[10px] font-bold uppercase mt-1 ${sel === t.id ? 'text-[#ffc900]' : 'text-blue-600'}`}>Limit: {t.limit}</span>
              </div>
              <span className="font-black text-lg">{t.price}</span>
            </div>
          ))}
        </div>

        <div className="mb-4">
            <label className="text-[10px] font-bold uppercase mb-1 block leading-tight">
              Have a discount code? If not, check our <span onClick={openDiscord} className="underline cursor-pointer hover:text-[#ff90e8]">Discord community</span>.
            </label>
            <input 
                type="text" 
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="ENTER CODE"
                className="w-full border-2 border-black p-2 font-mono text-sm uppercase placeholder:text-gray-400 bg-white outline-none"
            />
        </div>

        <button onClick={() => onUpgrade(sel)} className={`${BRUTAL.btn} w-full bg-[${COLORS.primary}] flex justify-center items-center gap-2`}>
          <span>Pay now</span>
          <span className="text-xs">→</span>
        </button>
        <p className="text-[10px] text-center mt-3 text-gray-500">Secure checkout via Lemon Squeezy. Cancel anytime.</p>
      </div>
    </div>
  );
};
