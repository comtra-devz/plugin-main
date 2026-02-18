
import React, { useState } from 'react';
import { BRUTAL } from '../types';

export const BrutalDatePicker: React.FC<{ value: string; onChange: (date: string) => void; placeholder?: string, className?: string }> = ({ value, onChange, placeholder = "Select Date", className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'DAY' | 'MONTH' | 'YEAR'>('DAY');
  
  // Internal state for navigation
  const [currentYear, setCurrentYear] = useState(2023);
  const [currentMonth, setCurrentMonth] = useState(9); // 0-indexed (Oct)

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const years = Array.from({length: 10}, (_, i) => currentYear - 5 + i);
  const days = Array.from({length: 31}, (_, i) => i + 1);

  const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange('');
  };

  return (
    <div className={`relative ${className}`}>
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        className={`${BRUTAL.input} cursor-pointer flex items-center justify-between h-10`}
      >
        <span className={value ? "font-bold" : "text-gray-400 font-bold uppercase text-xs"}>{value || placeholder}</span>
        {value ? (
            <button onClick={handleClear} className="font-bold hover:text-red-600">✕</button>
        ) : (
            // Vector Icon
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
        )}
      </div>
      
      {isOpen && (
        <>
        <div className="fixed inset-0 z-[9998] bg-black/50 md:bg-transparent" onClick={() => setIsOpen(false)}></div>
        
        {/* Mobile: Fixed Modal Center. Desktop: Absolute Bottom Right (Aligned to Input) */}
        <div 
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:absolute md:inset-auto md:top-full md:right-0 md:translate-y-0 z-[9999] mt-1 bg-white border-2 border-black shadow-[6px_6px_0_0_#000] p-3 md:w-64 animate-in fade-in zoom-in-95 origin-top-right"
        >
            
            {/* Header Navigation */}
            <div className="flex justify-between mb-2 bg-black text-white p-1">
                <button onClick={() => setView('MONTH')} className="font-bold text-xs hover:bg-[#ffc900] hover:text-black px-2 uppercase">
                    {months[currentMonth]}
                </button>
                <button onClick={() => setView('YEAR')} className="font-bold text-xs hover:bg-[#ffc900] hover:text-black px-2">
                    {currentYear}
                </button>
            </div>

            {/* DAY VIEW */}
            {view === 'DAY' && (
                <>
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold mb-1">
                        {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-gray-400">{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {days.map((d) => (
                            <button 
                                key={d} 
                                onClick={() => { onChange(`${currentYear}-${currentMonth + 1}-${d < 10 ? '0'+d : d}`); setIsOpen(false); }}
                                className="hover:bg-[#ffc900] p-1 border border-transparent hover:border-black text-center text-xs font-bold"
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                </>
            )}

            {/* MONTH VIEW */}
            {view === 'MONTH' && (
                <div className="grid grid-cols-3 gap-2">
                    {months.map((m, i) => (
                        <button 
                            key={m}
                            onClick={() => { setCurrentMonth(i); setView('DAY'); }}
                            className={`p-2 text-xs font-bold uppercase border hover:bg-[#ffc900] hover:border-black ${i === currentMonth ? 'bg-black text-white' : 'border-gray-200'}`}
                        >
                            {m}
                        </button>
                    ))}
                </div>
            )}

            {/* YEAR VIEW */}
            {view === 'YEAR' && (
                <div className="grid grid-cols-3 gap-2">
                    {years.map((y) => (
                        <button 
                            key={y}
                            onClick={() => { setCurrentYear(y); setView('DAY'); }}
                            className={`p-2 text-xs font-bold border hover:bg-[#ffc900] hover:border-black ${y === currentYear ? 'bg-black text-white' : 'border-gray-200'}`}
                        >
                            {y}
                        </button>
                    ))}
                </div>
            )}
        </div>
        </>
      )}
    </div>
  );
};

export const StatWidget = ({ label, value, icon, color = 'bg-white' }: { label: string, value: number | string, icon?: string, color?: string }) => (
    <div className="flex flex-col group">
        <span className="text-[9px] font-bold uppercase text-gray-500 mb-1 truncate flex items-center gap-1">
            {icon} {label}
        </span>
        <div className={`border-2 border-black px-2 py-2 font-mono font-black text-lg ${color} shadow-[2px_2px_0_0_#000] group-hover:translate-x-[1px] group-hover:translate-y-[1px] group-hover:shadow-none transition-all`}>
            {value}
        </div>
    </div>
);

export const StrictConfirmationModal = ({ title, actionWord, onConfirm, onCancel }: { title: string, actionWord: string, onConfirm: () => void, onCancel: () => void }) => {
    const [input, setInput] = useState('');
    const isValid = input.toLowerCase() === actionWord.toLowerCase();

    // Changed z-index from 10001 to 200001 to be higher than sidebars (100000)
    return (
        <div className="fixed inset-0 bg-black/80 z-[200001] flex items-center justify-center p-6" onClick={onCancel}>
            <div onClick={e => e.stopPropagation()} className={`${BRUTAL.card} max-w-sm w-full bg-white text-center`}>
                <div className="text-4xl mb-2">⚠️</div>
                <h3 className="text-xl font-black uppercase mb-4 text-red-600">{title}</h3>
                <p className="text-xs font-medium mb-4">
                    This action is irreversible. To confirm, please type <strong className="bg-black text-white px-1 uppercase">{actionWord}</strong> below.
                </p>
                <input 
                    type="text" 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={`Type "${actionWord}"`}
                    className={`${BRUTAL.input} mb-4 text-center uppercase font-bold`}
                    autoFocus
                />
                <div className="flex gap-2">
                    <button onClick={onCancel} className="flex-1 border-2 border-black py-2 font-bold hover:bg-gray-100">CANCEL</button>
                    <button 
                        onClick={onConfirm} 
                        disabled={!isValid}
                        className={`flex-1 border-2 border-black py-2 font-bold text-white shadow-[4px_4px_0_0_#000] transition-all ${isValid ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-300 cursor-not-allowed border-gray-400 shadow-none'}`}
                    >
                        CONFIRM
                    </button>
                </div>
            </div>
        </div>
    );
};
