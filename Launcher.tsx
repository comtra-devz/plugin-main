
import React, { useState } from 'react';
import App from './App';
import { CommunicationHub } from './CommunicationHub';

const LAUNCHER_STYLES = {
  card: `bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] p-4`,
  btn: `border-2 border-black shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#000] transition-all font-bold uppercase tracking-wider px-4 py-2`
};

export const Launcher = () => {
  const [env, setEnv] = useState<'HOME' | 'APP' | 'COMM' | 'ADMIN'>('HOME');

  if (env === 'APP')   return <App />;
  if (env === 'COMM')  return <CommunicationHub onBack={() => setEnv('HOME')} />;
  if (env === 'ADMIN') return <CommunicationHub onBack={() => setEnv('HOME')} initialSection="ADMIN" />;

  return (
    <div className="min-h-screen bg-[#fdfdfd] text-black flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background Decor */}
      <div className="absolute inset-0 opacity-5 pointer-events-none"
           style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      </div>

      <div className={`${LAUNCHER_STYLES.card} w-full max-w-sm text-center py-12 bg-white relative z-10 shadow-[8px_8px_0_0_#000]`}>
        <div className="inline-block bg-black text-white px-3 py-1 text-xs font-bold uppercase mb-6 rotate-2 transform border border-white">
          System Launcher
        </div>

        <h1 className="text-4xl font-black uppercase mb-2 tracking-tighter leading-[0.9] text-black">Comtra</h1>
        <p className="text-xs font-mono text-gray-500 mb-10">Select Environment</p>

        <div className="space-y-4 px-6">
          <button
            onClick={() => setEnv('APP')}
            className={`${LAUNCHER_STYLES.btn} w-full py-4 text-sm bg-[#ff90e8] text-black hover:bg-white flex justify-between items-center group`}
          >
            <span>Open Plugin</span>
            <span className="bg-black text-white px-2 py-0.5 text-[10px] group-hover:bg-[#ff90e8] group-hover:text-black transition-colors">LIVE</span>
          </button>

          <div className="h-px bg-gray-300 my-2"></div>

          <button
            onClick={() => setEnv('COMM')}
            className={`${LAUNCHER_STYLES.btn} w-full py-3 text-[10px] bg-blue-600 text-white hover:bg-blue-500 flex justify-center items-center gap-1`}
          >
            <span>📢 Comms Hub</span>
          </button>

          <button
            onClick={() => setEnv('ADMIN')}
            className={`${LAUNCHER_STYLES.btn} w-full py-3 text-[10px] bg-[#ffc900] text-black hover:bg-yellow-400 flex justify-center items-center gap-2`}
          >
            <span>🛡️ Admin Dashboard</span>
          </button>
        </div>
      </div>

      <div className="fixed bottom-4 text-[10px] font-mono text-gray-400">
        v1.1.0 Launcher
      </div>
    </div>
  );
};
