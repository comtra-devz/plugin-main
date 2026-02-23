
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
import { DebugInspector } from './components/DebugInspector';
import { ViewState, User } from './types';
import { AUTH_BACKEND_URL, FIGMA_PLUGIN_ID } from './constants';

const MAX_FREE_USES_PER_TOOL = 10;

function normalizeOAuthUser(raw: { name?: string; email?: string; img_url?: string | null; plan?: string; stats?: User['stats'] }): User {
  const name = raw.name || 'User';
  const firstInitial = name.trim().charAt(0).toUpperCase() || 'U';
  return {
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
  const [usage, setUsage] = useState({ gen: 0, code: 0, audit: 0 });

  useEffect(() => {
    if (!logoutToast) return;
    const t = setTimeout(() => setLogoutToast(null), 5000);
    return () => clearTimeout(t);
  }, [logoutToast]);

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
    setShowProfile(false);
    setShowLogin(true);
    setLogoutToast('Sei stato disconnesso.');
    setView(ViewState.AUDIT);
    setUsage({ gen: 0, code: 0, audit: 0 });
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

  // Calculate global credits for Profile Menu
  const totalCredits = (MAX_FREE_USES_PER_TOOL - usage.audit) + (MAX_FREE_USES_PER_TOOL - usage.gen) + (MAX_FREE_USES_PER_TOOL - usage.code);
  const creditsLabel = user?.plan === 'PRO' ? '∞' : `${Math.max(0, totalCredits)}/30`;

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
      <DebugInspector />

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
              usageCount={usage.audit}
              onUse={() => setUsage(p => ({ ...p, audit: p.audit + 1 }))}
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
            usageCount={usage.gen}
            onUse={() => setUsage(p => ({ ...p, gen: p.gen + 1 }))}
            initialPrompt={genPrompt}
          />
        )}
        
        {view === ViewState.CODE && (
          <Code 
            plan={user?.plan || 'FREE'} 
            userTier={user?.tier}
            onUnlockRequest={handleUnlockRequest}
            usageCount={usage.code}
            onUse={() => setUsage(p => ({ ...p, code: p.code + 1 }))}
          />
        )}
        
        {view === ViewState.ANALYTICS && user && <Analytics stats={user.stats} />}

        {view === ViewState.SUBSCRIPTION && <Subscription user={user} onUpgrade={() => setShowUpgrade(true)} />}
        {view === ViewState.DOCUMENTATION && <Documentation />}
        {view === ViewState.PRIVACY && <Privacy />}
        {view === ViewState.TERMS && <Terms />}
        {view === ViewState.AFFILIATE && <Affiliate />}

        {showUpgrade && (
          <UpgradeModal onClose={() => setShowUpgrade(false)} onUpgrade={handleUpgrade} />
        )}

        {showProfile && user && (
          <ProfileSheet 
            user={user} 
            creditsLabel={creditsLabel}
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
