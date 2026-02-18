import React from 'react';
import { BRUTAL, COLORS } from '../constants_test';

interface Props {
  onLogin: () => void;
  onOpenPrivacy: () => void;
  onGoToWebsite: () => void;
}

export const LoginModal: React.FC<Props> = ({ onLogin, onOpenPrivacy, onGoToWebsite }) => (
  <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4" style={{ backgroundColor: COLORS.primary }}>
    
    <button 
      onClick={onGoToWebsite}
      className="absolute top-4 right-4 bg-white border-2 border-black px-3 py-2 font-bold uppercase text-xs text-black hover:bg-black hover:text-white shadow-[4px_4px_0_0_#000] transition-all active:translate-y-1 active:shadow-none"
    >
      Go to Website ↗
    </button>

    <div className={`${BRUTAL.card} max-w-sm w-full text-center py-10 relative shadow-[8px_8px_0px_0px_#000] z-10`}>
      <div className="inline-block bg-black text-white px-3 py-1 text-xs font-bold uppercase mb-4 rotate-2 transform">
        Design System AI
      </div>
      
      <h1 className="text-5xl font-black uppercase mb-1 tracking-tighter leading-[0.9] text-black">Comtra <span className="text-sm bg-yellow-400 text-black px-1 align-top transform -rotate-12 inline-block">TEST</span></h1>
      
      <div className="px-6 space-y-3 mt-8">
        <button 
          onClick={onLogin}
          className={`${BRUTAL.btn} w-full bg-white text-black hover:bg-gray-50 flex items-center justify-center gap-3 py-3`}
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="G" />
          Try for Free with Google
        </button>
      </div>

      <div className="mt-8 pt-6 border-t-2 border-dashed border-black mx-6 text-left">
        <p className="text-[10px] text-gray-600 leading-tight mb-2">
          By continuing, you agree to our <button onClick={onOpenPrivacy} className="underline font-bold text-black bg-transparent border-none p-0 cursor-pointer">Terms of Service</button>. 
          Your data is encrypted and protected according to GDPR standards.
        </p>
        <div className="text-[10px] font-bold uppercase tracking-wider text-black/40 mt-4 text-center">
          Powered by Cordiska
        </div>
      </div>
    </div>
  </div>
);