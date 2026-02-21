import React from 'react';
import { BRUTAL, COLORS } from '../constants';

interface Props {
  onLoginWithFigma: () => void;
  onOpenPrivacy: () => void;
  oauthInProgress?: boolean;
  loginError?: string | null;
}

export const LoginModal: React.FC<Props> = ({ onLoginWithFigma, onOpenPrivacy, oauthInProgress, loginError }) => (
  <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4" style={{ backgroundColor: COLORS.primary }}>

    <div data-component="Login: Card" className={`${BRUTAL.card} max-w-sm w-full text-center py-10 relative shadow-[8px_8px_0px_0px_#000] z-10`}>
      <div data-component="Login: Badge" className="inline-block bg-black text-white px-3 py-1 text-xs font-bold uppercase mb-4 rotate-2 transform">
        Design System AI
      </div>
      
      <h1 data-component="Login: Title" className="text-5xl font-black uppercase mb-1 tracking-tighter leading-[0.9] text-black">Comtra</h1>
      
      <div className="px-6 space-y-3 mt-8">
        {loginError && (
          <p className="text-sm font-bold text-red-600 bg-red-100 border border-red-300 px-3 py-2 rounded">
            {loginError}
          </p>
        )}
        {oauthInProgress ? (
          <p className="text-sm font-bold text-black/80">
            Apri il browser per accedere con Figma, poi torna qui.
          </p>
        ) : (
          <button 
            onClick={onLoginWithFigma}
            data-component="Login: Figma Button"
            className={`${BRUTAL.btn} w-full bg-black text-white hover:bg-gray-800 flex items-center justify-center gap-3 py-3 border-white`}
          >
            <svg width="18" height="27" viewBox="0 0 18 27" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4.5 27C6.98528 27 9 24.9853 9 22.5V18H4.5C2.01472 18 0 20.0147 0 22.5C0 24.9853 2.01472 27 4.5 27Z" fill="#0ACF83"/>
              <path d="M0 13.5C0 11.0147 2.01472 9 4.5 9H9V18H4.5C2.01472 18 0 15.9853 0 13.5Z" fill="#A259FF"/>
              <path d="M0 4.5C0 2.01472 2.01472 0 4.5 0H9V9H4.5C2.01472 9 0 6.98528 0 4.5Z" fill="#F24E1E"/>
              <path d="M9 0H13.5C15.9853 0 18 2.01472 18 4.5C18 6.98528 15.9853 9 13.5 9H9V0Z" fill="#FF7262"/>
              <path d="M18 13.5C18 15.9853 15.9853 18 13.5 18H9V9H13.5C15.9853 9 18 11.0147 18 13.5Z" fill="#1ABCFE"/>
            </svg>
            Login with Figma
          </button>
        )}
      </div>

      <div className="mt-8 pt-6 border-t-2 border-dashed border-black mx-6 text-left">
        <p data-component="Login: Footer Text" className="text-[10px] text-gray-600 leading-tight mb-2">
          By continuing, you agree to our <button data-component="Login: Terms Link" onClick={onOpenPrivacy} className="underline font-bold text-black bg-transparent border-none p-0 cursor-pointer">Terms of Service</button>. 
          Your data is encrypted and protected according to GDPR standards.
        </p>
        <div data-component="Login: Powered By" className="text-[10px] font-bold uppercase tracking-wider text-black/40 mt-4 text-center">
          Powered by Cordiska
        </div>
      </div>
    </div>
  </div>
);