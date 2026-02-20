
import React, { useState } from 'react';
import { BRUTAL, COLORS } from '../constants';
import { AffiliateTransaction } from '../types';

// Mock Data
const MOCK_TRANSACTIONS: AffiliateTransaction[] = [
    { id: 'txn_1', date: '20 Oct 2023', amount: '€99.00', commission: '€4.95', status: 'CLEARED' },
    { id: 'txn_2', date: '22 Oct 2023', amount: '€25.00', commission: '€1.25', status: 'PENDING' },
    { id: 'txn_3', date: '23 Oct 2023', amount: '€250.00', commission: '€12.50', status: 'PENDING' },
];

export const Affiliate: React.FC = () => {
  const [copied, setCopied] = useState(false);
  
  const referralCode = "COMTRA-DESIGN-TEST";
  const balance = 18.70; // Mock balance
  const payoutThreshold = 10.00;
  const progress = Math.min(100, (balance / payoutThreshold) * 100);

  const handleCopy = () => {
    const ta = document.createElement('textarea');
    ta.value = referralCode;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWithdraw = () => {
      alert("Withdrawal request sent!");
  };

  return (
    <div className="p-4 pb-24 flex flex-col gap-6">
      <div className={`${BRUTAL.card} bg-white`}>
        <h2 className="text-2xl font-black uppercase mb-1 bg-black text-white inline-block px-2">Partner Program</h2>
        <p className="text-xs text-gray-600 mb-6 font-medium mt-2">
            Share Comtra with your friends. You earn <strong className="text-black">5%</strong> on every payment they make, forever.
        </p>

        {/* Code Section */}
        <div className="bg-[#f0f0f0] border-2 border-black p-4 mb-6 relative">
            <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Your Unique Code</label>
            <div className="flex gap-2">
                <code className="flex-1 bg-white border border-gray-400 p-2 font-mono text-xs font-bold truncate">
                    {referralCode}
                </code>
                <button 
                    onClick={handleCopy}
                    className="bg-black text-white px-3 py-1 text-[10px] font-bold uppercase hover:bg-[#ff90e8] hover:text-black transition-colors"
                >
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
        </div>

        {/* Balance Section */}
        <div className="border-t-2 border-dashed border-black pt-4 mb-6">
            <div className="flex justify-between items-end mb-2">
                <span className="text-xs font-bold uppercase">Current Balance</span>
                <span className="text-2xl font-black">€{balance.toFixed(2)}</span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full h-4 border-2 border-black p-0.5 bg-gray-100 rounded-sm mb-1">
                <div 
                   className="h-full bg-[#ffc900] transition-all duration-500" 
                   style={{ width: `${progress}%` }}
                ></div>
            </div>
            <div className="flex justify-between text-[9px] font-mono text-gray-500 mb-4">
                <span>€0.00</span>
                <span>Threshold: €{payoutThreshold.toFixed(2)}</span>
            </div>

            <button 
                onClick={handleWithdraw}
                disabled={balance < payoutThreshold}
                className={`w-full py-3 text-xs font-black uppercase border-2 border-black flex justify-center items-center gap-2 ${balance >= payoutThreshold ? `bg-[${COLORS.primary}] text-black hover:bg-white` : 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-300'}`}
            >
                {balance >= payoutThreshold ? 'Withdraw Money' : `Reach €${payoutThreshold} to Withdraw`}
            </button>
        </div>

        {/* History */}
        <div>
            <h3 className="font-bold uppercase text-sm mb-3">Affiliate History</h3>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                {MOCK_TRANSACTIONS.map(txn => (
                    <div key={txn.id} className="flex justify-between items-center p-2 border border-gray-200 text-xs">
                        <div>
                            <div className="font-mono font-bold text-[10px] text-gray-400">ID: {txn.id}</div>
                            <div className="font-medium text-[10px]">{txn.date}</div>
                        </div>
                        <div className="text-right">
                            <div className="font-black text-green-600">+ {txn.commission}</div>
                            <div className={`text-[8px] font-bold uppercase ${txn.status === 'CLEARED' ? 'text-black' : 'text-gray-400'}`}>{txn.status}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};
