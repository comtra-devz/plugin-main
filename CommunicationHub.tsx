
import React, { useState } from 'react';
import { FolderType } from './CommunicationHub/types';
import { StaticFolderView } from './CommunicationHub/views/StaticViews';
import { EditorialView } from './CommunicationHub/views/EditorialView';
import { AdminView } from './CommunicationHub/views/AdminView';

const FolderButton = ({ label, icon, onClick, variant = 'yellow' }: { label: string; icon: string; onClick: () => void, variant?: 'yellow' | 'blue' | 'black' }) => {
  const bg = variant === 'blue' ? 'bg-blue-600 text-white' : variant === 'black' ? 'bg-black text-white' : 'bg-[#ffc900] text-black';
  const border = variant === 'blue' || variant === 'black' ? 'border-white' : 'border-black';
  const hover = variant === 'blue' ? 'group-hover:bg-blue-500' : variant === 'black' ? 'group-hover:bg-gray-800' : 'group-hover:bg-yellow-400';

  return (
    <button 
      onClick={onClick}
      className={`${bg} border-2 border-black p-6 flex flex-col items-center justify-center gap-2 shadow-[6px_6px_0_0_#000] hover:-translate-y-1 transition-all active:translate-y-1 active:shadow-[2px_2px_0_0_#000] group relative overflow-hidden`}
    >
      <span className="text-4xl filter grayscale group-hover:grayscale-0 transition-all z-10">{icon}</span>
      <span className={`font-black uppercase tracking-wider px-2 border border-black z-10 text-[10px] ${variant === 'yellow' ? 'bg-white text-black' : 'bg-black text-white'}`}>{label}</span>
    </button>
  );
};

export const CommunicationHub: React.FC<{ onBack: () => void; initialSection?: 'ADMIN' | null }> = ({ onBack, initialSection = null }) => {
  const [folder, setFolder] = useState<FolderType | 'ADMIN' | null>(initialSection);

  const isAdmin = folder === 'ADMIN';

  const handleExit = () => {
    if (initialSection === 'ADMIN') {
        onBack();
    } else if (folder) {
        setFolder(null);
    } else {
        onBack();
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfdfd] font-sans text-black relative flex flex-col">
      {/* Top Bar */}
      <div className="bg-black text-white p-4 flex justify-between items-center sticky top-0 z-50 border-b-4 border-[#ff90e8]">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black uppercase tracking-tighter">ADMIN <span className="text-[#ff90e8]">MODE</span></h1>
          {folder && folder !== 'ADMIN' && <span className="text-xs font-mono bg-white text-black px-2 py-0.5">/{folder}</span>}
        </div>
        <button onClick={handleExit} className="bg-white text-black px-4 py-1 text-xs font-bold uppercase border-2 border-transparent hover:border-[#ff90e8]">
          {initialSection === 'ADMIN' ? 'Back to Launcher' : folder ? 'Back to Root' : 'Exit Hub'}
        </button>
      </div>

      {/* Main Content Area */}
      <div className={`w-full mx-auto h-full flex-1 flex flex-col ${isAdmin ? 'max-w-[1440px] p-0' : 'max-w-6xl p-6 pb-20'}`}>
        
        {!folder ? (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-6xl font-black uppercase mb-8 text-center tracking-tighter mix-blend-multiply opacity-10 pointer-events-none absolute top-20 w-full left-0">
              Strategy OS
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12 relative z-10 max-w-5xl mx-auto">
              <FolderButton onClick={() => setFolder('BRAND')} label="Brand & ToV" icon="🦄" />
              <FolderButton onClick={() => setFolder('USP')} label="USP & Features" icon="💎" />
              <FolderButton onClick={() => setFolder('COMPETITORS')} label="Vs. Market" icon="⚔️" />
              <FolderButton onClick={() => setFolder('SUSTAINABILITY')} label="Sustainability" icon="💸" />
            </div>

            <div className="mt-12 bg-white border-2 border-black p-6 shadow-[8px_8px_0_0_#000] max-w-4xl mx-auto">
              <h3 className="font-black uppercase text-xl mb-2 text-black">Hub Status</h3>
              <p className="text-sm font-medium text-gray-600 mb-4">
                Strategy documents linked to <strong>v1.1.0</strong> release features.
              </p>
            </div>
          </div>
        ) : (
          <>
            {folder === 'EDITORIAL' ? <EditorialView /> : 
             folder === 'ADMIN' ? <AdminView /> :
             <StaticFolderView type={folder as Exclude<FolderType, 'EDITORIAL' | 'ADMIN'>} />
            }
          </>
        )}

      </div>
    </div>
  );
};
