
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Audit } from './views/Audit';
import { Generate } from './views/Generate';
import { Code } from './views/Code';
import { Subscription } from './views/Subscription';
import { Documentation } from './views/Documentation';
import { Privacy } from './views/Privacy';
import { Terms } from './views/Terms';
import { Affiliate } from './views/Affiliate';
import { Analytics } from './views/Analytics';
import { UpgradeModal } from './components/UpgradeModal';
import { LoginModal } from './components/LoginModal';
import { ProfileSheet } from './components/ProfileSheet';
import { ViewState, User } from './types';
import { AUTH_BACKEND_URL } from './constants';

export interface CreditsState {
  remaining: number;
  total: number;
  used: number;
}

function normalizeOAuthUser(raw: { id?: string; name?: string; email?: string; img_url?: string | null; plan?: string; stats?: User['stats']; authToken?: string }): User {
  const name = raw.name || 'User';
  const firstInitial = name.trim().charAt(0).toUpperCase() || 'U';
  return {
    id: raw.id,
    name,
    email: raw.email || '',
    avatar: firstInitial,
    img_url: raw.img_url ?? undefined,
    plan: (raw.plan as User['plan']) || 'FREE',
    stats: raw.stats || {
      maxHealthScore: 0,
      wireframesGenerated: 0,
      wireframesModified: 0,
      analyzedA11y: 0,
      analyzedUX: 0,
      analyzedProto: 0,
      syncedStorybook: 0,
      syncedGithub: 0,
      syncedBitbucket: 0,
      affiliatesCount: 0,
    },
    authToken: raw.authToken,
  };
}

export default function AppTest() {
  const [view, setView] = useState<ViewState>(ViewState.AUDIT);
  const [user, setUser] = useState<User | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showLogin, setShowLogin] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [oauthInProgress, setOauthInProgress] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [logoutToast, setLogoutToast] = useState<string | null>(null);
  const [oauthReadKey, setOauthReadKey] = useState<string | null>(null);

  const [genPrompt, setGenPrompt] = useState('');
  const [credits, setCredits] = useState<CreditsState | null>(null);

  useEffect(() => {
    if (!logoutToast) return;
    const t = setTimeout(() => setLogoutToast(null), 5000);
    return () => clearTimeout(t);
  }, [logoutToast]);

  const fetchCredits = React.useCallback(async () => {
    if (!user?.authToken) return;
    try {
      const r = await fetch(`${AUTH_BACKEND_URL}/api/credits`, {
        headers: { Authorization: `Bearer ${user.authToken}` },
      });
      if (!r.ok) return;
      const data = await r.json();
      setCredits({
        remaining: data.credits_remaining ?? 0,
        total: data.credits_total ?? 0,
        used: data.credits_used ?? 0,
      });
    } catch (_) {}
  }, [user?.authToken]);

  useEffect(() => {
    if (user?.authToken) fetchCredits();
    else setCredits(null);
  }, [user?.authToken, user?.id, fetchCredits]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const msg = e.data?.pluginMessage;
      if (!msg) return;
      if (msg.type === 'restore-user' && msg.user) {
        setUser(normalizeOAuthUser(msg.user));
        setShowLogin(false);
      }
      if (msg.type === 'login-success' && msg.user) {
        setUser(normalizeOAuthUser(msg.user));
        setShowLogin(false);
        setOauthInProgress(false);
        setOauthReadKey(null);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  /** Apre OAuth nel browser esterno e fa polling dall'UI: l'utente resta sulla login e poi va in home senza "chiudi e riapri". */
  const handleLoginWithFigma = async () => {
    setLoginError(null);
    try {
      setOauthInProgress(true);
      const initUrl = `${AUTH_BACKEND_URL}/api/figma-oauth/init`;
      const res = await fetch(initUrl);
      if (!res.ok) throw new Error(`Init failed: ${res.status}`);
      const data = await res.json();
      const authUrl = data?.authUrl;
      const readKey = data?.readKey;
      if (!authUrl || !readKey) throw new Error('Risposta server non valida');
      setOauthReadKey(readKey);
      window.parent.postMessage({ pluginMessage: { type: 'open-oauth-url', authUrl } }, '*');
    } catch (e) {
      setOauthInProgress(false);
      const msg = e instanceof Error ? e.message : 'Errore di connessione';
      const isNetwork = msg === 'Failed to fetch' || /fetch|network|CORS/i.test(msg);
      setLoginError(isNetwork
        ? `Impossibile contattare il server (${msg}). Controlla che auth.comtra.dev sia online e che il plugin sia stato ricaricato dopo il build.`
        : msg);
    }
  };

  useEffect(() => {
    if (!oauthReadKey || !oauthInProgress) return;
    const pollUrl = `${AUTH_BACKEND_URL}/api/figma-oauth/poll?read_key=${encodeURIComponent(oauthReadKey)}`;
    const interval = setInterval(async () => {
      try {
        const r = await fetch(pollUrl);
        if (r.status === 202) return;
        if (!r.ok) return;
        const data = await r.json();
        if (data?.user) {
          setOauthReadKey(null);
          clearInterval(interval);
          window.parent.postMessage({ pluginMessage: { type: 'oauth-complete', user: data.user } }, '*');
        }
      } catch (_) {}
    }, 2000);
    return () => clearInterval(interval);
  }, [oauthInProgress, oauthReadKey]);

  const handleLogout = () => {
    window.parent.postMessage({ pluginMessage: { type: 'logout' } }, '*');
    setUser(null);
    setCredits(null);
    setShowProfile(false);
    setShowLogin(true);
    setLogoutToast('Sei stato disconnesso.');
    setView(ViewState.AUDIT);
    setGenPrompt('');
  };

  const handleUpgrade = (tier: string) => {
    if (user) setUser({ ...user, plan: 'PRO', tier });
    setShowUpgrade(false);
  };

  const handleUnlockRequest = () => {
    setShowUpgrade(true);
  };

  const handleOpenPrivacy = () => {
    setShowLogin(false);
    setView(ViewState.PRIVACY);
  };

  const estimateCredits = React.useCallback(async (payload: { action_type: string; node_count?: number }) => {
    const r = await fetch(`${AUTH_BACKEND_URL}/api/credits/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) return { estimated_credits: 5 };
    const data = await r.json();
    return { estimated_credits: data.estimated_credits ?? 5 };
  }, []);

  const consumeCredits = React.useCallback(async (payload: { action_type: string; credits_consumed: number; file_id?: string }) => {
    if (!user?.authToken) return { error: 'Unauthorized' as const };
    const r = await fetch(`${AUTH_BACKEND_URL}/api/credits/consume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.authToken}` },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    if (r.status === 402) return { error: 'Insufficient credits' as const, credits_remaining: data.credits_remaining };
    if (!r.ok) return { error: 'Server error' as const };
    setCredits({ remaining: data.credits_remaining, total: data.credits_total, used: data.credits_used });
    return { credits_remaining: data.credits_remaining };
  }, [user?.authToken]);

  const creditsLabel = user?.plan === 'PRO' ? '∞' : (credits === null ? '—' : `${credits.remaining}/${credits.total}`);
  const creditsRemaining = credits?.remaining ?? null;
  const hasZeroCredits = user?.plan !== 'PRO' && creditsRemaining !== null && creditsRemaining <= 0;
  const lowCreditsWarning = user?.plan !== 'PRO' && creditsRemaining !== null && creditsRemaining > 0 && creditsRemaining <= 5;

  if (showLogin && view !== ViewState.PRIVACY) {
      return (
        <LoginModal
          onLoginWithFigma={() => { setLogoutToast(null); handleLoginWithFigma(); }}
          onOpenPrivacy={handleOpenPrivacy}
          oauthInProgress={oauthInProgress}
          loginError={loginError}
          logoutToast={logoutToast}
          onDismissToast={() => setLogoutToast(null)}
        />
      );
  }

  return (
    <>
      <Layout 
        current={view} 
        setView={(v) => {
           // If user goes back from Privacy and was not logged in, show login again
           if (view === ViewState.PRIVACY && !user && v !== ViewState.PRIVACY) {
             setShowLogin(true);
           }
           setView(v);
        }} 
        user={user}
        onOpenProfile={() => setShowProfile(true)}
      >
        {view === ViewState.AUDIT && (
           <Audit 
              plan={user?.plan || 'FREE'} 
              userTier={user?.tier}
              onUnlockRequest={handleUnlockRequest}
              creditsRemaining={creditsRemaining}
              estimateCredits={estimateCredits}
              consumeCredits={consumeCredits}
              onNavigateToGenerate={(prompt) => {
                  setGenPrompt(prompt);
                  setView(ViewState.GENERATE);
              }}
           />
        )}
        
        {view === ViewState.GENERATE && (
          <Generate 
            plan={user?.plan || 'FREE'} 
            userTier={user?.tier}
            onUnlockRequest={handleUnlockRequest}
            creditsRemaining={creditsRemaining}
            estimateCredits={estimateCredits}
            consumeCredits={consumeCredits}
            initialPrompt={genPrompt}
          />
        )}
        
        {view === ViewState.CODE && (
          <Code 
            plan={user?.plan || 'FREE'} 
            userTier={user?.tier}
            onUnlockRequest={handleUnlockRequest}
            creditsRemaining={creditsRemaining}
            estimateCredits={estimateCredits}
            consumeCredits={consumeCredits}
          />
        )}
        
        {view === ViewState.ANALYTICS && user && <Analytics stats={user.stats} />}

        {view === ViewState.SUBSCRIPTION && <Subscription user={user} onUpgrade={() => setShowUpgrade(true)} />}
        {view === ViewState.DOCUMENTATION && <Documentation />}
        {view === ViewState.PRIVACY && <Privacy />}
        {view === ViewState.TERMS && <Terms />}
        {view === ViewState.AFFILIATE && <Affiliate />}

        {(showUpgrade || hasZeroCredits) && (
          <UpgradeModal
            onClose={() => !hasZeroCredits && setShowUpgrade(false)}
            onUpgrade={handleUpgrade}
            forceOpen={hasZeroCredits}
          />
        )}

        {showProfile && user && (
          <ProfileSheet 
            user={user} 
            creditsLabel={creditsLabel}
            lowCreditsWarning={lowCreditsWarning}
            onClose={() => setShowProfile(false)} 
            onLogout={handleLogout}
            onManageSub={() => {
              setView(ViewState.SUBSCRIPTION);
              setShowProfile(false);
            }}
            onOpenDocs={() => {
              setView(ViewState.DOCUMENTATION);
              setShowProfile(false);
            }}
            onOpenPrivacy={() => {
              setView(ViewState.PRIVACY);
              setShowProfile(false);
            }}
            onOpenTerms={() => {
              setView(ViewState.TERMS);
              setShowProfile(false);
            }}
            onOpenAffiliate={() => {
              setView(ViewState.AFFILIATE);
              setShowProfile(false);
            }}
          />
        )}
      </Layout>
    </>
  );
}
