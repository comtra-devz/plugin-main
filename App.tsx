
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { CreditGiftModal } from './components/CreditGiftModal';
import { TrophiesModal } from './components/TrophiesModal';
import { LoginModal } from './components/LoginModal';
import { ProfileSheet } from './components/ProfileSheet';
import { useToast } from './contexts/ToastContext';
import { ViewState, User, Trophy } from './types';
import { AUTH_BACKEND_URL, TEST_USER_EMAILS, FREE_TIER_CREDITS, buildCheckoutRedirectUrl, getSimulateFreeTierFromStorage, setSimulateFreeTierInStorage, getSimulatedCreditsFromStorage, setSimulatedCreditsInStorage } from './constants';
import { getSystemToastOptions } from './lib/errorCopy';
import type { FetchFigmaFileBody } from './views/Audit/AuditView';

export interface CreditsState {
  remaining: number;
  total: number;
  used: number;
}

interface SelectedNodeInfo {
  id: string;
  name: string;
  type: string;
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

/** Skeleton: solo rettangoli e forme con pulse, niente bordi né ombre scure. Durata minima 2s. */
function CreditsLoader() {
  return (
    <div className="min-h-screen w-full bg-[#fdfdfd] flex flex-col" aria-live="polite" aria-busy="true">
      <header className="bg-[#ff90e8] p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-7 w-24 bg-white/40 animate-pulse" />
          <div className="h-5 w-28 bg-white/40 animate-pulse" />
        </div>
        <div className="h-8 w-8 rounded-full bg-white/40 animate-pulse" />
      </header>
      <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
        <div className="h-32 w-full bg-gray-200/80 animate-pulse" />
        <div className="h-10 w-full bg-gray-200/80 animate-pulse" />
        <div className="space-y-2">
          <div className="h-16 w-full bg-gray-100 animate-pulse" />
          <div className="h-16 w-full bg-gray-100 animate-pulse" />
          <div className="h-12 w-[75%] bg-gray-100 animate-pulse" />
        </div>
      </main>
      <nav className="p-2 flex justify-around bg-gray-100 shrink-0">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 w-16 bg-gray-200/80 animate-pulse" />
        ))}
      </nav>
    </div>
  );
}

const THROTTLE_DISCOUNT_WINDOW_MS = 15 * 60 * 1000; // 15 min

export default function AppTest() {
  const { showToast } = useToast();
  const firstThrottleAtRef = useRef<number | null>(null);

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
  const [levelUpData, setLevelUpData] = useState<{ oldLevel: number; newLevel: number; discount: number; discountCode?: string | null } | null>(null);
  const [showCreditGiftModal, setShowCreditGiftModal] = useState(false);
  const [creditGiftAmount, setCreditGiftAmount] = useState<number | null>(null);
  const [trophies, setTrophies] = useState<Trophy[] | null>(null);
  const [newTrophiesToast, setNewTrophiesToast] = useState<Array<{ id: string; name: string }>>([]);
  const [recentTransactions, setRecentTransactions] = useState<Array<{ action_type: string; credits_consumed: number; created_at: string }>>([]);

  const [genPrompt, setGenPrompt] = useState('');
  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(null);
  const [credits, setCredits] = useState<CreditsState | null>(null);
  /** Diagnostic: why credits fetch failed (e.g. "401", "503", "network"). Cleared on success. */
  const [creditsFetchError, setCreditsFetchError] = useState<string | null>(null);
  /** When true, keep retrying credits without spamming UI/toast/error state. */
  const creditsFetchSilentRef = useRef(false);
  const creditsValueRef = useRef<CreditsState | null>(null);
  const creditsFetchAttemptSeqRef = useRef(0);
  const creditsFetchLastLogAtRef = useRef(0);

  const shouldLogCreditsDebug = () => {
    const now = Date.now();
    if (now - creditsFetchLastLogAtRef.current < 2500) return false;
    creditsFetchLastLogAtRef.current = now;
    return true;
  };
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

  useEffect(() => {
    creditsValueRef.current = credits;
  }, [credits]);

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

  const handle503 = useCallback(() => {
    const now = Date.now();
    if (firstThrottleAtRef.current === null) firstThrottleAtRef.current = now;
    if (user?.authToken) {
      fetch(`${AUTH_BACKEND_URL}/api/report-throttle`, { method: 'POST', headers: { Authorization: `Bearer ${user.authToken}` } }).catch(() => {});
    }
    const elapsed = now - (firstThrottleAtRef.current ?? now);
    const showDiscountCta = elapsed >= THROTTLE_DISCOUNT_WINDOW_MS;
    const opts = getSystemToastOptions('service_unavailable');
    showToast({
      ...opts,
      dismissible: true,
      ...(showDiscountCta && {
        title: 'Comtra is taking a breather',
        description: 'The outage has lasted a while. You can request a 5% discount code below.',
        actions: [
          {
            label: 'Request discount code',
            onClick: async () => {
              const first = firstThrottleAtRef.current ?? 0;
              if (Date.now() - first < THROTTLE_DISCOUNT_WINDOW_MS) {
                const notReady = getSystemToastOptions('throttle_code_not_ready');
                showToast({ ...notReady, dismissible: true });
                return;
              }
              if (!user?.authToken) return;
              try {
                const r = await fetch(`${AUTH_BACKEND_URL}/api/throttle-discount`, { method: 'POST', headers: { Authorization: `Bearer ${user.authToken}` } });
                const data = await r.json().catch(() => ({}));
                if (data.code) {
                  const ok = getSystemToastOptions('throttle_discount_ok', { code: data.code });
                  showToast({ ...ok, description: ok.description, dismissible: true });
                } else {
                  const fail = getSystemToastOptions('throttle_code_failed');
                  showToast({ ...fail, dismissible: true });
                }
              } catch {
                const fail = getSystemToastOptions('throttle_code_failed');
                showToast({ ...fail, dismissible: true });
              }
            },
          },
        ],
      }),
    });
  }, [showToast, user?.authToken]);

  /** Fetch credits.
   *  @returns { ok, retryable } where ok=credits were set, retryable=worth retrying.
   */
  const fetchCredits = React.useCallback(async (): Promise<{ ok: boolean; retryable: boolean }> => {
    if (!user?.authToken) return { ok: false, retryable: false };
    if (!creditsFetchSilentRef.current) setCreditsFetchError(null);
    try {
      const controller = new AbortController();
      // Timeout 12s: al primo carico il backend può essere lento; 4s causava AbortError e crediti mai caricati
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const attemptId = ++creditsFetchAttemptSeqRef.current;
      const r = await fetch(`${AUTH_BACKEND_URL}/api/credits`, {
        headers: { Authorization: `Bearer ${user.authToken}` },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));
      if (r.status === 503) {
        if (shouldLogCreditsDebug()) {
          console.warn(`[CreditsDebug] #${attemptId} GET /api/credits status=503 retryable=true`);
        }
        if (!creditsFetchSilentRef.current) {
          handle503();
          setCreditsFetchError('503');
          console.warn('[Comtra] GET /api/credits: 503 Service Unavailable');
        }
        return { ok: false, retryable: true };
      }
      if (!r.ok) {
        const err = `${r.status}`;
        const retryable = ![400, 401, 403].includes(r.status);
        let bodySnippet: string | null = null;
        try {
          const text = await r.text();
          bodySnippet = text ? text.slice(0, 240) : null;
        } catch {
          bodySnippet = null;
        }
        if (shouldLogCreditsDebug()) {
          console.warn(
            `[CreditsDebug] #${attemptId} GET /api/credits status=${r.status} retryable=${retryable} ${r.statusText ? `statusText=${r.statusText}` : ''}`,
            bodySnippet ? `body=${bodySnippet}` : 'body=<empty>'
          );
        }
        if (!creditsFetchSilentRef.current) {
          setCreditsFetchError(err);
          console.warn('[Comtra] GET /api/credits failed:', r.status, r.statusText);
        }
        // 4xx: molto spesso token/permessi/contract errato -> non serve riprovare a vuoto
        return { ok: false, retryable };
      }
      const data = await r.json();
      setCredits({
        remaining: data.credits_remaining ?? 0,
        total: data.credits_total ?? 0,
        used: data.credits_used ?? 0,
      });
      setCreditsFetchError(null);
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
        if (data.stats != null && typeof data.stats === 'object') {
          updates.stats = { ...prev.stats, ...data.stats };
        }
        if (Array.isArray(data.tags)) updates.tags = data.tags;
        if (Object.keys(updates).length === 0) return prev;
        return { ...prev, ...updates };
      });
      if (Array.isArray(data.recent_transactions)) setRecentTransactions(data.recent_transactions);
      if (data.gift && typeof data.gift.credits_added === 'number' && data.gift.credits_added > 0 && user?.authToken) {
        try {
          const r = await fetch(`${AUTH_BACKEND_URL}/api/credit-gift-seen`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.authToken}` },
          });
          if (r.ok) {
            setCreditGiftAmount(data.gift.credits_added);
            setShowCreditGiftModal(true);
          }
        } catch {
          // POST fallito: al prossimo accesso riproverà
        }
      }
      return { ok: true, retryable: false };
    } catch (e) {
      if (!creditsFetchSilentRef.current) {
        setCreditsFetchError('network');
        console.warn('[Comtra] GET /api/credits: network or parse error', e);
      }
      if (shouldLogCreditsDebug()) {
        const name = e instanceof Error ? e.name : 'unknown';
        const msg = e instanceof Error ? e.message : String(e);
        const hint = name === 'AbortError' ? ' (timeout after 12s)' : '';
        console.warn(`[CreditsDebug] GET /api/credits exception name=${name} message=${msg.slice(0, 200)}${hint}`);
      }
      return { ok: false, retryable: true };
    }
  }, [user?.authToken, handle503]);

  /** True after we gave up loading credits (all retries failed). Reset on logout. */
  const [creditsLoadGaveUp, setCreditsLoadGaveUp] = useState(false);
  /** Skeleton mostrato almeno 2s per dare l’idea di caricamento; poi si passa all’app. */
  const [creditsLoaderMinElapsed, setCreditsLoaderMinElapsed] = useState(false);
  /** Timestamp del primo rendering dello skeleton crediti: evita reset continui del timer. */
  const creditsSkeletonStartAtRef = useRef<number | null>(null);

  const CREDITS_MAX_ATTEMPTS = 5;
  const CREDITS_RETRY_DELAYS_MS = [2000, 3000, 4000, 5000]; // delays between attempt 0→1, 1→2, 2→3, 3→4

  useEffect(() => {
    if (!user?.authToken) {
      setCredits(null);
      setRecentTransactions([]);
      setCreditsFetchError(null);
      setCreditsLoadGaveUp(false);
      return;
    }
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < CREDITS_MAX_ATTEMPTS && !cancelled; attempt++) {
        const res = await fetchCredits();
        if (cancelled) return;
        if (res.ok) return;
        if (!res.retryable) break;
        if (attempt < CREDITS_MAX_ATTEMPTS - 1) {
          const delay = CREDITS_RETRY_DELAYS_MS[attempt] ?? 3000;
          await new Promise(r => setTimeout(r, delay));
        }
      }
      if (!cancelled) setCreditsLoadGaveUp(true);
    })();
    return () => { cancelled = true; };
  }, [user?.authToken, user?.id, fetchCredits]);

  // Aggressive (but silent) background recovery: se dopo i retry iniziali i crediti sono ancora null,
  // continuiamo a riprovare finché arrivano, senza bloccare UI e senza spam UI/toast.
  useEffect(() => {
    if (!user?.authToken) return;
    if (!creditsLoadGaveUp) return;
    if (creditsValueRef.current !== null) return;
    const skipRecovery = user?.plan === 'PRO' || (isTestUser && simulateFreeTier);
    if (skipRecovery) return;

    let cancelled = false;
    let attempt = 0;

    (async () => {
      while (!cancelled && creditsValueRef.current === null && !skipRecovery) {
        creditsFetchSilentRef.current = true;
        try {
          const res = await fetchCredits();
          if (res.ok) return;
        } finally {
          creditsFetchSilentRef.current = false;
        }

        attempt++;
        // Aggressivo ma con cap: parte subito, poi cresce fino a 30s.
        const delay = Math.min(30000, 2000 + attempt * 2000);
        await new Promise((r) => setTimeout(r, delay));
      }
    })();

    return () => {
      cancelled = true;
      creditsFetchSilentRef.current = false;
    };
  }, [user?.authToken, user?.id, user?.plan, creditsLoadGaveUp, isTestUser, simulateFreeTier, fetchCredits]);

  useEffect(() => {
    if (!user) {
      creditsSkeletonStartAtRef.current = null;
      setCreditsLoaderMinElapsed(false);
      return;
    }

    if (credits !== null || creditsLoadGaveUp) {
      creditsSkeletonStartAtRef.current = null;
      setCreditsLoaderMinElapsed(true);
      return;
    }

    // credits ancora null e non abbiamo dato up: aspettiamo almeno 2s dal primo ingresso
    if (!creditsLoaderMinElapsed) {
      const startAt = creditsSkeletonStartAtRef.current ?? Date.now();
      creditsSkeletonStartAtRef.current = startAt;
      const elapsed = Date.now() - startAt;
      const remaining = Math.max(0, 2000 - elapsed);
      const t = window.setTimeout(() => setCreditsLoaderMinElapsed(true), remaining);
      return () => clearTimeout(t);
    }
  }, [user, credits, creditsLoadGaveUp, creditsLoaderMinElapsed]);

  const fetchTrophies = React.useCallback(async () => {
    if (!user?.authToken) return;
    try {
      const r = await fetch(`${AUTH_BACKEND_URL}/api/trophies`, {
        headers: { Authorization: `Bearer ${user.authToken}` },
      });
      if (r.status === 503) { handle503(); return; }
      if (!r.ok) return;
      const data = await r.json();
      setTrophies(data.trophies ?? []);
    } catch (_) {}
  }, [user?.authToken, handle503]);

  useEffect(() => {
    if (user?.authToken) fetchTrophies();
    else setTrophies(null);
  }, [user?.authToken, user?.id, fetchTrophies]);

  const fileContextResolveRef = useRef<((data: { fileKey: string | null; error?: string | null }) => void) | null>(null);

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
      if (msg.type === 'file-context-result' && fileContextResolveRef.current) {
        const resolve = fileContextResolveRef.current;
        fileContextResolveRef.current = null;
        resolve({ fileKey: msg.fileKey ?? null, error: msg.error ?? null });
      }
      if (msg.type === 'selection-changed') {
        const nodes = Array.isArray(msg.nodes) ? msg.nodes : [];
        if (!nodes.length) {
          setSelectedNode(null);
          return;
        }
        const first = nodes[0];
        if (!first?.id) {
          setSelectedNode(null);
          return;
        }
        setSelectedNode({
          id: String(first.id),
          name: String(first.name || 'Selection'),
          type: String(first.type || 'SELECTION'),
        });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (view !== ViewState.GENERATE) return;
    window.parent.postMessage({ pluginMessage: { type: 'get-selection' } }, '*');
  }, [view]);

  // Chiedi al controller la sessione salvata al mount; timeout per non bloccare se il messaggio non arriva
  useEffect(() => {
    window.parent.postMessage({ pluginMessage: { type: 'get-saved-user' } }, '*');
    const t = setTimeout(() => setSessionRestoring(false), 800);
    return () => clearTimeout(t);
  }, []);

  /** Apre OAuth nel browser esterno e fa polling dall'UI: l'utente resta sulla login e poi va in home senza "chiudi e riapri". */
  const handleLoginWithFigma = React.useCallback(async () => {
    setLoginError(null);
    try {
      setOauthInProgress(true);
      const initUrl = `${AUTH_BACKEND_URL}/api/figma-oauth/init`;
      const res = await fetch(initUrl);
      if (!res.ok) throw new Error(`Init failed: ${res.status}`);
      const data = await res.json();
      const authUrl = data?.authUrl;
      const readKey = data?.readKey;
      if (!authUrl || !readKey) throw new Error('Invalid server response');
      setOauthReadKey(readKey);
      window.parent.postMessage({ pluginMessage: { type: 'open-oauth-url', authUrl } }, '*');
    } catch (e) {
      setOauthInProgress(false);
      const msg = e instanceof Error ? e.message : 'Connection error';
      const isNetwork = msg === 'Failed to fetch' || /fetch|network|CORS/i.test(msg);
      setLoginError(isNetwork
        ? `Could not reach the server (${msg}). Check that auth.comtra.dev is up and that you reloaded the plugin after building.`
        : msg);
    }
  }, []);

  useEffect(() => {
    if (!oauthReadKey || !oauthInProgress) return;
    const pollUrl = `${AUTH_BACKEND_URL}/api/figma-oauth/poll?read_key=${encodeURIComponent(oauthReadKey)}`;
    const interval = setInterval(async () => {
      try {
        const r = await fetch(pollUrl);
        if (r.status === 202) return;
        if (!r.ok) return;
        const data = await r.json();
        if (data?.error) {
          setOauthReadKey(null);
          clearInterval(interval);
          setOauthInProgress(false);
          setLoginError('Login didn\'t go through. Try again.');
          return;
        }
        if (data?.user) {
          setOauthReadKey(null);
          clearInterval(interval);
          setOauthInProgress(false);
          if (data.tokenSaved === false) {
            setLoginError('Login didn\'t go through. Try again.');
            return;
          }
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
    setRecentTransactions([]);
    setShowProfile(false);
    setShowLogin(true);
    setLogoutToast('You\'re logged out. See you next time!');
    setView(ViewState.AUDIT);
    setGenPrompt('');
  };

  const handleUpgrade = (tier: string, affiliateCode?: string) => {
    const url = buildCheckoutRedirectUrl(tier, affiliateCode, user?.email ?? undefined);
    window.open(url, '_blank');
    setShowUpgrade(false);
    // Backend reindirizza a Lemon Squeezy; dopo il pagamento webhook aggiorna plan/credits. L'utente torna qui e fa refresh per vedere PRO.
  };

  const handleUnlockRequest = () => {
    setShowUpgrade(true);
  };

  /** Used when audit fails for missing Figma token: open OAuth to obtain token. */
  const handleRetryConnection = () => {
    setShowUpgrade(false);
    setShowLogin(true);
    handleLoginWithFigma();
  };

  /** When set (timestamp), Audit clears token-related error banner. Set when "Verifica token" returns valid. */
  const [tokenVerifiedAt, setTokenVerifiedAt] = useState<number | null>(null);

  /** Debug: call token-status endpoint and show result (see docs/FIGMA-TOKEN-TROUBLESHOOTING.md). */
  const handleCheckTokenStatus = React.useCallback(async () => {
    if (!user?.authToken) {
      alert('You\'re not logged in. Use Log in with Figma.');
      return;
    }
    const url = `${AUTH_BACKEND_URL}/api/figma/token-status`;
    try {
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${user.authToken}` },
      });
      const data = await r.json().catch(() => ({}));
      const hasToken = !!data.hasToken;
      if (hasToken) setTokenVerifiedAt(Date.now());
      const reason = data.reason;
      let msg: string;
      if (hasToken) {
        msg = 'Figma token: present and valid.';
      } else if (reason === 'figma_rejected') {
        msg = 'The token in DB is no longer accepted by Figma (revoked or expired).\n\nLog out then Log in with Figma to get a new token.';
      } else if (reason) {
        msg = `Figma token: missing or invalid.\nreason: ${reason}\n\nLog out then Log in with Figma. See docs/FIGMA-TOKEN-TROUBLESHOOTING.md`;
      } else {
        msg = 'Figma token: missing or invalid.\n\nLog out then Log in with Figma. Check backend logs for "figma_tokens save failed".';
      }
      alert(msg);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      alert(
        'Network error: ' +
          errMsg +
          '\n\nURL: ' +
          url +
          '\n\nPossible causes: backend unreachable, CORS, or wrong URL. See docs/FIGMA-TOKEN-TROUBLESHOOTING.md ("Failed to fetch" section).'
      );
    }
  }, [user?.authToken]);

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
    if (r.status === 503) { handle503(); return { estimated_credits: 5 }; }
    if (!r.ok) return { estimated_credits: 5 };
    const data = await r.json();
    return { estimated_credits: data.estimated_credits ?? 5 };
  }, [handle503]);

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
    let r: Response;
    let data: any;
    try {
      r = await fetch(`${AUTH_BACKEND_URL}/api/credits/consume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.authToken}` },
        body: JSON.stringify(payload),
      });
      data = await r.json().catch(() => ({}));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      return { error: msg as 'Server error' };
    }
    if (r.status === 503) { handle503(); return { error: 'Server error' as 'Server error' }; }
    if (r.status === 402) return { error: 'Insufficient credits' as const, credits_remaining: data.credits_remaining };
    if (!r.ok) return { error: (data?.error || 'Server error') as 'Server error' };
    setCredits({ remaining: data.credits_remaining, total: data.credits_total, used: data.credits_used });
    setUser(prev => prev && (data.current_level != null || data.total_xp != null)
      ? { ...prev, current_level: data.current_level ?? prev.current_level, total_xp: data.total_xp ?? prev.total_xp, xp_for_next_level: data.xp_for_next_level ?? prev.xp_for_next_level, xp_for_current_level_start: data.xp_for_current_level_start ?? prev.xp_for_current_level_start }
      : prev);
    if (data.level_up && data.current_level != null) {
      const oldLevel = Math.max(1, (user?.current_level ?? 1));
      const discount = Math.min(20, Math.floor((data.current_level ?? 1) / 5) * 5);
      setLevelUpData({
        oldLevel,
        newLevel: data.current_level,
        discount,
        discountCode: data.level_discount_code ?? null,
      });
      setShowLevelUpModal(true);
    }
    if (data.new_trophies?.length) {
      setNewTrophiesToast(data.new_trophies);
      fetchTrophies();
    }
    return { credits_remaining: data.credits_remaining, level_up: data.level_up };
  }, [user?.authToken, user?.email, user?.current_level, isTestUser, simulateFreeTier, credits, simulatedCredits, fetchTrophies, handle503, setNewTrophiesToast]);

  // Log free (0-credit) actions into credit_transactions for activity tracking (Stats + dashboard), without modifying balance
  const logFreeAction = React.useCallback(
    async (actionType: string) => {
      if (!user?.authToken) return;
      try {
        await fetch(`${AUTH_BACKEND_URL}/api/credits/log-free`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.authToken}` },
          body: JSON.stringify({ action_type: actionType }),
        });
      } catch {
        // best-effort only
      }
    },
    [AUTH_BACKEND_URL, user?.authToken]
  );

  const fetchFigmaFile = React.useCallback(async (body: FetchFigmaFileBody) => {
    if (!user?.authToken) return;
    const r = await fetch(`${AUTH_BACKEND_URL}/api/figma/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.authToken}` },
      body: JSON.stringify(body),
    });
    if (r.status === 503) { handle503(); throw new Error('Service temporarily unavailable'); }
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
  }, [user?.authToken, handle503]);

  const fetchDsAudit = React.useCallback(async (body: { file_key?: string; file_json?: object; scope?: string; page_id?: string; node_ids?: string[]; page_ids?: string[] }) => {
    if (!user?.authToken) return { issues: [] };
    const payload = body.file_json
      ? { file_json: body.file_json }
      : { file_key: body.file_key, scope: body.scope, page_id: body.page_id, node_ids: body.node_ids, page_ids: body.page_ids };
    const r = await fetch(`${AUTH_BACKEND_URL}/api/agents/ds-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.authToken}` },
      body: JSON.stringify(payload),
    });
    if (r.status === 503) { handle503(); throw new Error('Service temporarily unavailable'); }
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
  }, [user?.authToken, handle503]);

  const fetchA11yAudit = React.useCallback(async (body: { file_key?: string; file_json?: object; scope?: string; page_id?: string; node_ids?: string[]; page_ids?: string[] }) => {
    if (!user?.authToken) return { issues: [] };
    const payload = body.file_json
      ? { file_json: body.file_json }
      : { file_key: body.file_key, scope: body.scope, page_id: body.page_id, node_ids: body.node_ids, page_ids: body.page_ids };
    const r = await fetch(`${AUTH_BACKEND_URL}/api/agents/a11y-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.authToken}` },
      body: JSON.stringify(payload),
    });
    if (r.status === 503) { handle503(); throw new Error('Service temporarily unavailable'); }
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
  }, [user?.authToken, handle503]);

  const fetchUxAudit = React.useCallback(async (body: { file_key?: string; file_json?: object; scope?: string; page_id?: string; node_ids?: string[]; page_ids?: string[] }) => {
    if (!user?.authToken) return { issues: [] };
    const payload = body.file_json
      ? { file_json: body.file_json }
      : { file_key: body.file_key, scope: body.scope, page_id: body.page_id, node_ids: body.node_ids, page_ids: body.page_ids };
    const r = await fetch(`${AUTH_BACKEND_URL}/api/agents/ux-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.authToken}` },
      body: JSON.stringify(payload),
    });
    if (r.status === 503) { handle503(); throw new Error('Service temporarily unavailable'); }
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
  }, [user?.authToken, handle503]);

  const fetchSyncScan = React.useCallback(async (body: { file_key?: string; file_json?: object; storybook_url: string; storybook_token?: string; scope?: string; page_id?: string; page_ids?: string[] }) => {
    if (!user?.authToken) return { items: [], connectionStatus: 'ok' };
    const base = { storybook_url: body.storybook_url, storybook_token: body.storybook_token };
    const payload = body.file_json
      ? { ...base, file_json: body.file_json }
      : { ...base, file_key: body.file_key, scope: body.scope, page_id: body.page_id, page_ids: body.page_ids };
    const r = await fetch(`${AUTH_BACKEND_URL}/api/agents/sync-scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.authToken}` },
      body: JSON.stringify(payload),
    });
    if (r.status === 503) { handle503(); throw new Error('Service temporarily unavailable'); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = data.error || `Sync scan failed (${r.status})`;
      throw new Error(msg);
    }
    return data;
  }, [user?.authToken, handle503]);

  const fetchCheckStorybook = React.useCallback(async (storybookUrl: string, storybookToken?: string) => {
    if (!user?.authToken) return { ok: false as const, error: 'Unauthorized' };
    const r = await fetch(`${AUTH_BACKEND_URL}/api/agents/sync-check-storybook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.authToken}` },
      body: JSON.stringify({ storybook_url: storybookUrl, storybook_token: storybookToken || undefined }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false as const, error: (data.error as string) || 'Check failed' };
    return { ok: data.ok === true, error: data.error as string | undefined };
  }, [user?.authToken]);

  const fetchGenerateFeedback = useCallback(async (body: { request_id: string; thumbs: 'up' | 'down'; comment?: string }) => {
    if (!user?.authToken) return;
    const r = await fetch(`${AUTH_BACKEND_URL}/api/feedback/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.authToken}` },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.error || `Feedback failed (${r.status})`);
    }
  }, [user?.authToken]);

  const fetchGenerate = useCallback(async (body: { file_key: string; prompt: string; mode?: string; ds_source?: string }) => {
    if (!user?.authToken) throw new Error('Unauthorized');
    const r = await fetch(`${AUTH_BACKEND_URL}/api/agents/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.authToken}` },
      body: JSON.stringify({
        file_key: body.file_key,
        prompt: body.prompt,
        mode: body.mode || 'create',
        ds_source: body.ds_source || 'custom',
      }),
    });
    if (r.status === 503) { handle503(); throw new Error('Service temporarily unavailable'); }
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
  }, [user?.authToken, handle503]);

  const requestFileContext = useCallback(() => {
    return new Promise<{ fileKey: string | null; error?: string | null }>((resolve) => {
      fileContextResolveRef.current = resolve;
      window.parent.postMessage({ pluginMessage: { type: 'get-file-context', scope: 'all' } }, '*');
      setTimeout(() => {
        if (fileContextResolveRef.current) {
          const r = fileContextResolveRef.current;
          fileContextResolveRef.current = null;
          r({ fileKey: null, error: 'Timeout' });
        }
      }, 15000);
    });
  }, []);

  const creditsLabel = useInfiniteCreditsForTest
    ? '∞ (test)'
    : user?.plan === 'PRO'
      ? '∞'
      : effectiveCredits === null
        ? (user?.authToken ? '...' : '— (re-login to sync)')
        : `${effectiveCredits.remaining}/${effectiveCredits.total}${usingSimulatedCredits ? ' (simulated)' : ''}`;
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

  // Skeleton: max 2s per evitare flash sotto e non bloccare mai il plugin.
  const showCreditsSkeleton = user && !creditsLoaderMinElapsed;
  if (showCreditsSkeleton) {
    return <CreditsLoader />;
  }

  return (
    <>
      {newTrophiesToast.length > 0 && (
        <TrophiesModal
          trophies={newTrophiesToast}
          onClose={() => setNewTrophiesToast([])}
          onViewStats={() => {
            setNewTrophiesToast([]);
            setView(ViewState.ANALYTICS);
          }}
        />
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
        onOpenProfile={() => setShowProfile(prev => !prev)}
      >
        <div className={view === ViewState.AUDIT ? '' : 'hidden'} aria-hidden={view !== ViewState.AUDIT}>
          <Audit
            plan={user?.plan || 'FREE'}
            userTier={user?.tier}
            onUnlockRequest={handleUnlockRequest}
            onRetryConnection={handleRetryConnection}
            onCheckTokenStatus={handleCheckTokenStatus}
            tokenVerifiedAt={tokenVerifiedAt}
            creditsRemaining={effectiveCreditsRemaining}
            useInfiniteCreditsForTest={useInfiniteCreditsForTest}
            estimateCredits={estimateCredits}
            consumeCredits={consumeCredits}
            fetchFigmaFile={fetchFigmaFile}
            fetchDsAudit={fetchDsAudit}
            fetchA11yAudit={fetchA11yAudit}
            fetchUxAudit={fetchUxAudit}
            authToken={user?.authToken}
            onNavigateToGenerate={(prompt) => {
              setGenPrompt(prompt);
              setView(ViewState.GENERATE);
            }}
          />
        </div>

        <div className={view === ViewState.GENERATE ? '' : 'hidden'} aria-hidden={view !== ViewState.GENERATE}>
          <Generate
            plan={user?.plan || 'FREE'}
            userTier={user?.tier}
            onUnlockRequest={handleUnlockRequest}
            creditsRemaining={effectiveCreditsRemaining}
            useInfiniteCreditsForTest={useInfiniteCreditsForTest}
            estimateCredits={estimateCredits}
            consumeCredits={consumeCredits}
            initialPrompt={genPrompt}
            fetchGenerate={fetchGenerate}
            requestFileContext={requestFileContext}
            fetchGenerateFeedback={fetchGenerateFeedback}
            selectedNode={selectedNode}
          />
        </div>

        <div className={view === ViewState.CODE ? '' : 'hidden'} aria-hidden={view !== ViewState.CODE}>
          <Code
            plan={user?.plan || 'FREE'}
            userTier={user?.tier}
            onUnlockRequest={handleUnlockRequest}
            creditsRemaining={effectiveCreditsRemaining}
            useInfiniteCreditsForTest={useInfiniteCreditsForTest}
            estimateCredits={estimateCredits}
            consumeCredits={consumeCredits}
            logFreeAction={logFreeAction}
            fetchSyncScan={fetchSyncScan}
            fetchCheckStorybook={fetchCheckStorybook}
            onNavigateToStats={() => setView(ViewState.ANALYTICS)}
          />
        </div>

        <div className={view === ViewState.ANALYTICS ? '' : 'hidden'} aria-hidden={view !== ViewState.ANALYTICS}>
          {user && (
            <Analytics
              user={user}
              stats={user.stats}
              trophies={trophies}
              recentTransactions={recentTransactions}
              onLinkedInShare={              async () => {
                if (!user?.authToken) return;
                try {
                  const r = await fetch(`${AUTH_BACKEND_URL}/api/trophies/linkedin-shared`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${user.authToken}` },
                  });
                  if (r.status === 503) { handle503(); return; }
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
        </div>

        {view === ViewState.SUBSCRIPTION && <Subscription user={user} credits={effectiveCredits} useInfiniteCreditsForTest={useInfiniteCreditsForTest} onUpgrade={() => setShowUpgrade(true)} />}
        {view === ViewState.DOCUMENTATION && <Documentation user={user} />}
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
            discountCode={levelUpData.discountCode}
            onClose={() => { setShowLevelUpModal(false); setLevelUpData(null); }}
            onViewStats={() => {
              setShowLevelUpModal(false);
              setLevelUpData(null);
              setView(ViewState.ANALYTICS);
            }}
          />
        )}

        {showCreditGiftModal && creditGiftAmount != null && (
          <CreditGiftModal
            creditsAdded={creditGiftAmount}
            onClose={() => {
              setShowCreditGiftModal(false);
              setCreditGiftAmount(null);
            }}
          />
        )}

        {showProfile && user && (
          <ProfileSheet 
            user={user} 
            creditsLabel={creditsLabel}
            creditsFetchError={creditsFetchError}
            onRetryCredits={fetchCredits}
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
