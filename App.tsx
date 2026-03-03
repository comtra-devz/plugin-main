
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
import { LevelUpModal } from './components/LevelUpModal';
import { LoginModal } from './components/LoginModal';
import { ProfileSheet } from './components/ProfileSheet';
import { ViewState, User, Trophy } from './types';
import { AUTH_BACKEND_URL, TEST_USER_EMAILS, FREE_TIER_CREDITS, buildCheckoutUrl, getSimulateFreeTierFromStorage, setSimulateFreeTierInStorage, getSimulatedCreditsFromStorage, setSimulatedCreditsInStorage } from './constants';
import type { FetchFigmaFileBody } from './views/Audit/AuditView';

export interface CreditsState {
  remaining: number;
  total: number;
  used: number;
}

function normalizeOAuthUser(raw: {
  id?: string; name?: string; email?: string; img_url?: string | null; plan?: string;
  stats?: User['stats']; authToken?: string;
  total_xp?: number; current_level?: number; xp_for_next_level?: number; xp_for_current_level_start?: number;
}): User {
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
    total_xp: raw.total_xp,
    current_level: raw.current_level,
    xp_for_next_level: raw.xp_for_next_level,
    xp_for_current_level_start: raw.xp_for_current_level_start,
  };
}

/** Loader minimale in stile brutalist (dot/quadrati) mentre si ripristina la sessione al primo avvio. */
function SessionLoader() {
  return (
    <div className="min-h-screen w-full bg-[#ff90e8] flex items-center justify-center" aria-hidden="true">
      <div className="flex gap-1.5" role="presentation">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 bg-black"
            style={{
              animation: 'sessionLoaderPulse 0.6s ease-in-out infinite',
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes sessionLoaderPulse {
          0%, 100% { opacity: 0.35; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export default function AppTest() {
  const [view, setView] = useState<ViewState>(ViewState.AUDIT);
  const [user, setUser] = useState<User | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showLogin, setShowLogin] = useState(true);
  const [sessionRestoring, setSessionRestoring] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [oauthInProgress, setOauthInProgress] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [logoutToast, setLogoutToast] = useState<string | null>(null);
  const [oauthReadKey, setOauthReadKey] = useState<string | null>(null);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [levelUpData, setLevelUpData] = useState<{ oldLevel: number; newLevel: number; discount: number } | null>(null);
  const [trophies, setTrophies] = useState<Trophy[] | null>(null);
  const [newTrophiesToast, setNewTrophiesToast] = useState<Array<{ id: string; name: string }>>([]);

  const [genPrompt, setGenPrompt] = useState('');
  const [credits, setCredits] = useState<CreditsState | null>(null);
  const [simulateFreeTier, setSimulateFreeTier] = useState(getSimulateFreeTierFromStorage);
  /** Per utenti di test con "Simula Free Tier" ON quando l'API non restituisce crediti: simulazione locale (25 crediti, consumo in localStorage). */
  const [simulatedCredits, setSimulatedCredits] = useState<CreditsState | null>(null);

  const isTestUser = user ? TEST_USER_EMAILS.includes(user.email.toLowerCase().trim()) : false;
  const useInfiniteCreditsForTest = isTestUser && !simulateFreeTier;

  useEffect(() => {
    if (!user || !isTestUser || !simulateFreeTier || credits !== null) return;
    if (simulatedCredits !== null) return;
    const stored = getSimulatedCreditsFromStorage(user.email);
    const initial = stored ?? { remaining: FREE_TIER_CREDITS, total: FREE_TIER_CREDITS, used: 0 };
    setSimulatedCredits(initial);
    if (!stored) setSimulatedCreditsInStorage(user.email, initial);
  }, [user?.email, isTestUser, simulateFreeTier, credits, simulatedCredits]);

  const effectiveCredits: CreditsState | null = credits !== null
    ? credits
    : isTestUser && simulateFreeTier && user
      ? (simulatedCredits ?? { remaining: FREE_TIER_CREDITS, total: FREE_TIER_CREDITS, used: 0 })
      : null;
  const effectiveCreditsRemaining = effectiveCredits?.remaining ?? null;
  const usingSimulatedCredits = isTestUser && simulateFreeTier && credits === null && user !== null;

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
      setUser(prev => {
        if (!prev) return prev;
        const updates: Partial<User> = {};
        if (data.current_level != null || data.total_xp != null) {
          updates.current_level = data.current_level ?? prev.current_level;
          updates.total_xp = data.total_xp ?? prev.total_xp;
          updates.xp_for_next_level = data.xp_for_next_level ?? prev.xp_for_next_level;
          updates.xp_for_current_level_start = data.xp_for_current_level_start ?? prev.xp_for_current_level_start;
        }
        if (data.plan != null) updates.plan = data.plan as User['plan'];
        if (Object.keys(updates).length === 0) return prev;
        return { ...prev, ...updates };
      });
    } catch (_) {}
  }, [user?.authToken]);

  useEffect(() => {
    if (user?.authToken) fetchCredits();
    else setCredits(null);
  }, [user?.authToken, user?.id, fetchCredits]);

  const fetchTrophies = React.useCallback(async () => {
    if (!user?.authToken) return;
    try {
      const r = await fetch(`${AUTH_BACKEND_URL}/api/trophies`, {
        headers: { Authorization: `Bearer ${user.authToken}` },
      });
      if (!r.ok) return;
      const data = await r.json();
      setTrophies(data.trophies ?? []);
    } catch (_) {}
  }, [user?.authToken]);

  useEffect(() => {
    if (user?.authToken) fetchTrophies();
    else setTrophies(null);
  }, [user?.authToken, user?.id, fetchTrophies]);

  useEffect(() => {
    if (newTrophiesToast.length === 0) return;
    const t = setTimeout(() => setNewTrophiesToast([]), 4000);
    return () => clearTimeout(t);
  }, [newTrophiesToast]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const msg = e.data?.pluginMessage ?? e.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'restore-user') {
        setSessionRestoring(false);
        if (msg.user) {
          setUser(normalizeOAuthUser(msg.user));
          setShowLogin(false);
        }
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

  // Chiedi al controller la sessione salvata al mount; timeout per non bloccare se il messaggio non arriva
  useEffect(() => {
    window.parent.postMessage({ pluginMessage: { type: 'get-saved-user' } }, '*');
    const t = setTimeout(() => setSessionRestoring(false), 800);
    return () => clearTimeout(t);
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
    setSimulatedCredits(null);
    setShowProfile(false);
    setShowLogin(true);
    setLogoutToast('Sei stato disconnesso.');
    setView(ViewState.AUDIT);
    setGenPrompt('');
  };

  const handleUpgrade = (tier: string, affiliateCode?: string) => {
    const url = buildCheckoutUrl(tier, affiliateCode, user?.email ?? undefined);
    window.open(url, '_blank');
    setShowUpgrade(false);
    // Dopo il pagamento Lemon invia il webhook: aggiorniamo plan/credits. L'utente torna qui e fa refresh (o riapre il plugin) per vedere PRO.
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

  const consumeCredits = React.useCallback(async (payload: { action_type: string; credits_consumed: number; file_id?: string; max_health_score?: number; reset_consecutive_fixes?: boolean; token_fixes_delta?: number }) => {
    const cost = Math.max(0, payload.credits_consumed);
    const isSimulated = isTestUser && simulateFreeTier && credits === null && user;
    if (isSimulated) {
      const current = simulatedCredits ?? getSimulatedCreditsFromStorage(user.email) ?? { remaining: FREE_TIER_CREDITS, total: FREE_TIER_CREDITS, used: 0 };
      if (current.remaining < cost) return { error: 'Insufficient credits' as const, credits_remaining: current.remaining };
      const next: CreditsState = { remaining: current.remaining - cost, total: current.total, used: current.used + cost };
      setSimulatedCredits(next);
      setSimulatedCreditsInStorage(user.email, next);
      return { credits_remaining: next.remaining };
    }
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
    setUser(prev => prev && (data.current_level != null || data.total_xp != null)
      ? { ...prev, current_level: data.current_level ?? prev.current_level, total_xp: data.total_xp ?? prev.total_xp, xp_for_next_level: data.xp_for_next_level ?? prev.xp_for_next_level, xp_for_current_level_start: data.xp_for_current_level_start ?? prev.xp_for_current_level_start }
      : prev);
    if (data.level_up && data.current_level != null) {
      const oldLevel = Math.max(1, (user?.current_level ?? 1));
      const discount = Math.min(20, Math.floor((data.current_level ?? 1) / 5) * 5);
      setLevelUpData({ oldLevel, newLevel: data.current_level, discount });
      setShowLevelUpModal(true);
    }
    if (data.new_trophies?.length) {
      setNewTrophiesToast(data.new_trophies);
      fetchTrophies();
    }
    return { credits_remaining: data.credits_remaining, level_up: data.level_up };
  }, [user?.authToken, user?.email, user?.current_level, isTestUser, simulateFreeTier, credits, simulatedCredits, fetchTrophies]);

  const fetchFigmaFile = React.useCallback(async (body: FetchFigmaFileBody) => {
    if (!user?.authToken) return;
    const r = await fetch(`${AUTH_BACKEND_URL}/api/figma/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.authToken}` },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const text = await r.text();
      let msg = text;
      try {
        const j = JSON.parse(text);
        msg = j.hint ? `${j.error} — ${j.hint}` : (j.error || text);
      } catch {
        // keep text as-is
      }
      throw new Error(msg);
    }
    return r.json();
  }, [user?.authToken]);

  const fetchDsAudit = React.useCallback(async (body: { file_key: string; depth?: number }) => {
    if (!user?.authToken) return { issues: [] };
    const r = await fetch(`${AUTH_BACKEND_URL}/api/agents/ds-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.authToken}` },
      body: JSON.stringify({ file_key: body.file_key, depth: body.depth ?? 2 }),
    });
    if (!r.ok) {
      const text = await r.text();
      let msg = text;
      try {
        const j = JSON.parse(text);
        msg = j.error || text;
      } catch {
        // keep as-is
      }
      throw new Error(msg);
    }
    return r.json();
  }, [user?.authToken]);

  const creditsLabel = useInfiniteCreditsForTest
    ? '∞ (test)'
    : user?.plan === 'PRO'
      ? '∞'
      : effectiveCredits === null
        ? (user?.authToken ? '—' : '— (re-login to sync)')
        : `${effectiveCredits.remaining}/${effectiveCredits.total}${usingSimulatedCredits ? ' (simulati)' : ''}`;
  const hasZeroCredits = !useInfiniteCreditsForTest && user?.plan !== 'PRO' && effectiveCreditsRemaining !== null && effectiveCreditsRemaining <= 0;
  const lowCreditsWarning = !useInfiniteCreditsForTest && user?.plan !== 'PRO' && effectiveCreditsRemaining !== null && effectiveCreditsRemaining > 0 && effectiveCreditsRemaining <= 5;

  const handleSimulateFreeTierChange = (value: boolean) => {
    setSimulateFreeTier(value);
    setSimulateFreeTierInStorage(value);
    if (value && user?.authToken) fetchCredits();
    if (value && user && isTestUser && simulatedCredits === null) {
      const stored = getSimulatedCreditsFromStorage(user.email);
      setSimulatedCredits(stored ?? { remaining: FREE_TIER_CREDITS, total: FREE_TIER_CREDITS, used: 0 });
    }
  };

  if (sessionRestoring) return <SessionLoader />;

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
      {newTrophiesToast.length > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] bg-[#ffc900] border-2 border-black shadow-[4px_4px_0_0_#000] px-4 py-2 max-w-[90%] animate-in fade-in slide-in-from-top-2">
          <p className="text-[10px] font-bold uppercase text-black">
            🏆 Trofei sbloccati: {newTrophiesToast.map(t => t.name).join(', ')}
          </p>
        </div>
      )}
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
              creditsRemaining={effectiveCreditsRemaining}
              useInfiniteCreditsForTest={useInfiniteCreditsForTest}
              estimateCredits={estimateCredits}
              consumeCredits={consumeCredits}
              fetchFigmaFile={fetchFigmaFile}
              fetchDsAudit={fetchDsAudit}
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
            creditsRemaining={effectiveCreditsRemaining}
            useInfiniteCreditsForTest={useInfiniteCreditsForTest}
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
            creditsRemaining={effectiveCreditsRemaining}
            useInfiniteCreditsForTest={useInfiniteCreditsForTest}
            estimateCredits={estimateCredits}
            consumeCredits={consumeCredits}
          />
        )}
        
        {view === ViewState.ANALYTICS && user && (
          <Analytics
            user={user}
            stats={user.stats}
            trophies={trophies}
            onLinkedInShare={async () => {
              if (!user?.authToken) return;
              try {
                const r = await fetch(`${AUTH_BACKEND_URL}/api/trophies/linkedin-shared`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${user.authToken}` },
                });
                if (r.ok) {
                  const data = await r.json();
                  if (data.new_trophies?.length) {
                    setNewTrophiesToast(data.new_trophies);
                    fetchTrophies();
                  }
                }
              } catch (_) {}
            }}
          />
        )}

        {view === ViewState.SUBSCRIPTION && <Subscription user={user} credits={effectiveCredits} useInfiniteCreditsForTest={useInfiniteCreditsForTest} onUpgrade={() => setShowUpgrade(true)} />}
        {view === ViewState.DOCUMENTATION && <Documentation />}
        {view === ViewState.PRIVACY && <Privacy />}
        {view === ViewState.TERMS && <Terms />}
        {view === ViewState.AFFILIATE && <Affiliate user={user} />}

        {(showUpgrade || hasZeroCredits) && (
          <UpgradeModal
            onClose={() => !hasZeroCredits && setShowUpgrade(false)}
            onUpgrade={handleUpgrade}
            forceOpen={hasZeroCredits}
          />
        )}

        {showLevelUpModal && levelUpData && (
          <LevelUpModal
            oldLevel={levelUpData.oldLevel}
            newLevel={levelUpData.newLevel}
            discount={levelUpData.discount}
            onClose={() => { setShowLevelUpModal(false); setLevelUpData(null); }}
          />
        )}

        {showProfile && user && (
          <ProfileSheet 
            user={user} 
            creditsLabel={creditsLabel}
            lowCreditsWarning={lowCreditsWarning}
            isTestUser={isTestUser}
            simulateFreeTier={simulateFreeTier}
            onSimulateFreeTierChange={handleSimulateFreeTierChange}
            usingSimulatedCredits={usingSimulatedCredits}
            onResetSimulatedCredits={() => {
              if (!user) return;
              const reset = { remaining: FREE_TIER_CREDITS, total: FREE_TIER_CREDITS, used: 0 };
              setSimulatedCredits(reset);
              setSimulatedCreditsInStorage(user.email, reset);
            }}
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
