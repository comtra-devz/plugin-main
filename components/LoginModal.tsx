import React, { useState, useEffect } from 'react';
import { BRUTAL, COLORS, SHOW_FIGMA_LOGIN, MAGIC_LINK_HINT_MINUTES } from '../constants';
import { Button } from './ui/Button';

interface Props {
  onLoginWithFigma: () => void;
  onRequestMagicLink: (email: string) => void;
  onOpenPrivacy: () => void;
  oauthInProgress?: boolean;
  signInMode?: 'figma' | 'email' | null;
  magicLinkSentTo?: string | null;
  /** Dopo scadenza o per ripristino, precompila il campo (stesso usato per “reinvia”). */
  defaultEmail?: string;
  loginError?: string | null;
  logoutToast?: string | null;
  onDismissToast?: () => void;
}

export const LoginModal: React.FC<Props> = ({
  onLoginWithFigma,
  onRequestMagicLink,
  onOpenPrivacy,
  oauthInProgress,
  signInMode,
  magicLinkSentTo,
  defaultEmail = '',
  loginError,
  logoutToast,
  onDismissToast,
}) => {
  const [email, setEmail] = useState(defaultEmail);
  useEffect(() => {
    if (defaultEmail) setEmail(defaultEmail);
  }, [defaultEmail]);

  return (
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
        {oauthInProgress && signInMode === 'figma' ? (
          <p className="text-sm font-bold text-black/80">
            Open the browser to sign in with Figma, then come back here.
          </p>
        ) : oauthInProgress && signInMode === 'email' ? (
          <div className="space-y-3 text-left">
            <p className="text-sm font-bold text-black/80">
              {magicLinkSentTo
                ? `We sent a sign-in link to ${magicLinkSentTo}. Open it in your browser — the Figma plugin will sign you in automatically.`
                : 'Preparing your link…'}
            </p>
            {magicLinkSentTo ? (
              <>
                <p className="text-xs font-bold text-black/60">
                  The link in the email is valid for about {MAGIC_LINK_HINT_MINUTES} minutes. If you didn’t get the email, check spam or request a new link.
                </p>
                <button
                  type="button"
                  onClick={() => { onRequestMagicLink(magicLinkSentTo); }}
                  className="w-full text-sm font-bold text-black border-2 border-black bg-white py-2.5 rounded shadow-[2px_2px_0px_0px_#000] hover:bg-black/5"
                  data-component="Login: Resend magic"
                >
                  Send a new sign-in link
                </button>
              </>
            ) : null}
          </div>
        ) : (
          <form
            className="w-full space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              onRequestMagicLink(email);
            }}
          >
            <p className="text-xs font-bold text-black/70 text-left mb-1">Your best e-mail address</p>
            <input
              type="email"
              name="comtra-magic-email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full border-2 border-black rounded px-3 py-2.5 text-sm font-bold bg-white"
              data-component="Login: Email"
            />
            <Button
              type="submit"
              variant="black"
              fullWidth
              layout="row"
              data-component="Login: Magic link"
              className="gap-3 py-3.5"
            >
              Send sign-in link
            </Button>
            {SHOW_FIGMA_LOGIN && (
              <button
                type="button"
                onClick={onLoginWithFigma}
                className="w-full text-xs font-bold text-black/60 underline py-1 bg-transparent border-none cursor-pointer"
                data-component="Login: Figma optional"
              >
                Sign in with Figma (OAuth) instead
              </button>
            )}
          </form>
        )}
      </div>

      <div className="mt-8 pt-6 border-t-2 border-dashed border-black mx-6 text-left">
        <p data-component="Login: Footer Text" className="text-[10px] text-gray-600 leading-tight mb-2">
          By continuing, you agree to our <button data-component="Login: Terms Link" onClick={onOpenPrivacy} className="underline font-bold text-black bg-transparent border-none p-0 cursor-pointer">Terms of Service</button>. 
          Your data is encrypted and protected according to GDPR standards.
        </p>
        <div data-component="Login: Powered By" className="text-[10px] font-bold uppercase tracking-wider text-black/40 mt-4 text-center">
          Powered by Cordiska & Ben
        </div>
      </div>
    </div>

    {logoutToast && (
      <div
        data-component="Login: Logout Toast"
        role="status"
        className="mt-4 max-w-sm w-full border-2 border-black bg-white px-4 py-2.5 text-sm font-bold shadow-[4px_4px_0px_0px_#000] z-10 flex items-center justify-center gap-2"
      >
        <span className="flex-1 text-center">{logoutToast}</span>
        {onDismissToast && (
          <button
            type="button"
            onClick={onDismissToast}
            className="shrink-0 w-6 h-6 flex items-center justify-center text-black/60 hover:text-black border border-transparent hover:border-black rounded"
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>
    )}
  </div>
  );
};
