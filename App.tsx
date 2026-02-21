
import React, { useState, useEffect, useRef } from 'react';
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
  const initials = name.split(/\s+/).map(s => s[0]).join('').toUpperCase().slice(0, 2) || name.charAt(0).toUpperCase();
  return {
    name,
    email: raw.email || '',
    avatar: initials,
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

  const [genPrompt, setGenPrompt] = useState('');
  const [usage, setUsage] = useState({ gen: 0, code: 0, audit: 0 });

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
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  /** Reindirizza l'iframe alla pagina OAuth sul nostro server (stesso origin). Così postMessage(..., 'https://www.figma.com') funziona. */
  const handleLoginWithFigma = async () => {
    try {
      setOauthInProgress(true);
      const res = await fetch(`${AUTH_BACKEND_URL}/auth/figma/init`);
      if (!res.ok) throw new Error('Init failed');
      const { authUrl, readKey } = await res.json();
      const pluginHandlerUrl = `${AUTH_BACKEND_URL}/auth/figma/plugin?read_key=${encodeURIComponent(readKey)}&auth_url=${encodeURIComponent(authUrl)}&plugin_id=${encodeURIComponent(FIGMA_PLUGIN_ID)}`;
      window.location.href = pluginHandlerUrl;
    } catch (_) {
      setOauthInProgress(false);
    }
  };

  const handleLogout = () => {
    window.parent.postMessage({ pluginMessage: { type: 'logout' } }, '*');
    setUser(null);
    setShowProfile(false);
    setShowLogin(true);
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
          onLoginWithFigma={handleLoginWithFigma}
          onOpenPrivacy={handleOpenPrivacy}
          oauthInProgress={oauthInProgress}
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
