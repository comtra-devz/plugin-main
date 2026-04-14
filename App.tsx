
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
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
import { replaceDsImportsFromServer } from './lib/dsImportsStorage';
import {
  safeLocalStorageGetItem,
  safeLocalStorageSetItem,
  safeSessionStorageGetItem,
  safeSessionStorageSetItem,
} from './lib/safeWebStorage';
import type { FetchFigmaFileBody } from './views/Audit/AuditView';

export interface CreditsState {
  remaining: number;
  total: number;
  used: number;
}

type CreditsFetchOutcome = { ok: boolean; retryable: boolean };

const CREDITS_CACHE_KEY = 'comtra.credits.v1';
const CREDITS_CACHE_TTL_MS = 15 * 60 * 1000;
const CREDITS_GIFT_SEEN_KEY = 'comtra.creditGiftSeen.v1';
const CREDITS_FETCH_TIMEOUT_LITE_MS = 18_000;
const CREDITS_FETCH_TIMEOUT_FULL_MS = 28_000;

/** Coalesce parallel GET /api/credits (stesso iframe): più effect/handler non duplicano la richiesta. */
let creditsInflightLite: Promise<CreditsFetchOutcome> | null = null;
let creditsInflightFull: Promise<CreditsFetchOutcome> | null = null;
let trophiesInflight: Promise<void> | null = null;

function readCreditsCache(userId: string): CreditsState | null {
  try {
    const raw = safeLocalStorageGetItem(CREDITS_CACHE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as {
      userId?: string;
      remaining?: number;
      total?: number;
      used?: number;
      cachedAt?: number;
    };
    if (o.userId !== userId) return null;
    if (typeof o.remaining !== 'number' || typeof o.total !== 'number' || typeof o.used !== 'number') return null;
    const cachedAt = typeof o.cachedAt === 'number' ? o.cachedAt : 0;
    if (!cachedAt || Date.now() - cachedAt > CREDITS_CACHE_TTL_MS) return null;
    return { remaining: o.remaining, total: o.total, used: o.used };
  } catch {
    return null;
  }
}

function writeCreditsCache(userId: string, c: CreditsState) {
  safeLocalStorageSetItem(
    CREDITS_CACHE_KEY,
    JSON.stringify({ userId, cachedAt: Date.now(), ...c }),
  );
}

function readCreditGiftSeenMarker(userId: string): string | null {
  try {
    const raw = safeSessionStorageGetItem(CREDITS_GIFT_SEEN_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as { userId?: string; marker?: string };
    if (o.userId !== userId) return null;
    return typeof o.marker === 'string' && o.marker.length > 0 ? o.marker : null;
  } catch {
    return null;
  }
}

function writeCreditGiftSeenMarker(userId: string, marker: string) {
  safeSessionStorageSetItem(CREDITS_GIFT_SEEN_KEY, JSON.stringify({ userId, marker }));
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
  const [designSystems, setDesignSystems] = useState<string[]>([
    'Custom (Current)',
    'Material Design 3',
    'iOS Human Interface',
    'Ant Design',
    'Carbon Design',
    'Bootstrap 5',
    'Salesforce Lightning',
    'Uber Base Web',
  ]);
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
  /** Prevent repeated failing fetches in Generate view (CORS / network). */
  const dsImportsSyncAttemptedRef = useRef<string | null>(null);
  const designSystemsFetchAttemptedRef = useRef(false);
  /** If DS-import APIs return 401 once, avoid repeated slow calls in this session. */
  const dsImportsUnauthorizedRef = useRef(false);

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

  /** Stale-while-revalidate: show last known balance immediately on open (same user), then refresh from API. */
  useLayoutEffect(() => {
    if (!user?.authToken || !user.id) return;
    if (isTestUser && simulateFreeTier) return;
    const cached = readCreditsCache(user.id);
    if (cached) {
      setCredits(cached);
      setCreditsFetchError(null);
    }
  }, [user?.authToken, user?.id, isTestUser, simulateFreeTier]);

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

  /** Fetch credits. `lite`: solo saldo/plan/XP/regalo (GET ?lite=1, meno query DB). */
  const fetchCreditsInternal = React.useCallback(
    async (lite: boolean): Promise<CreditsFetchOutcome> => {
      if (!user?.authToken) return { ok: false, retryable: false };
      if (lite && creditsInflightLite) return creditsInflightLite;
      if (!lite && creditsInflightFull) return creditsInflightFull;

      const run = async (): Promise<CreditsFetchOutcome> => {
        if (!creditsFetchSilentRef.current) setCreditsFetchError(null);
        try {
          const controller = new AbortController();
          const timeoutMs = lite ? CREDITS_FETCH_TIMEOUT_LITE_MS : CREDITS_FETCH_TIMEOUT_FULL_MS;
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          const attemptId = ++creditsFetchAttemptSeqRef.current;
          const url = `${AUTH_BACKEND_URL}/api/credits${lite ? '?lite=1' : ''}`;
          const r = await fetch(url, {
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
            return { ok: false, retryable };
          }
          const data = await r.json();
          const next: CreditsState = {
            remaining: data.credits_remaining ?? 0,
            total: data.credits_total ?? 0,
            used: data.credits_used ?? 0,
          };
          setCredits(next);
          if (user?.id) writeCreditsCache(user.id, next);
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
          if (
            data.gift &&
            typeof data.gift.credits_added === 'number' &&
            data.gift.credits_added > 0 &&
            user?.authToken &&
            user?.id
          ) {
            const giftMarker = `${String(data.gift.created_at || 'unknown')}::${data.gift.credits_added}`;
            const alreadyShownInThisSession = readCreditGiftSeenMarker(user.id) === giftMarker;
            try {
              const rGift = await fetch(`${AUTH_BACKEND_URL}/api/credit-gift-seen`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.authToken}` },
              });
              if (rGift.ok) {
                writeCreditGiftSeenMarker(user.id, giftMarker);
                if (!alreadyShownInThisSession) {
                  setCreditGiftAmount(data.gift.credits_added);
                  setShowCreditGiftModal(true);
                }
              } else if (shouldLogCreditsDebug()) {
                console.warn(`[CreditsDebug] POST /api/credit-gift-seen status=${rGift.status}`);
              }
            } catch (e) {
              if (shouldLogCreditsDebug()) {
                const msg = e instanceof Error ? e.message : String(e);
                console.warn(`[CreditsDebug] POST /api/credit-gift-seen exception=${msg.slice(0, 200)}`);
              }
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
            const hint =
              name === 'AbortError'
                ? ` (timeout after ${lite ? CREDITS_FETCH_TIMEOUT_LITE_MS : CREDITS_FETCH_TIMEOUT_FULL_MS}ms)`
                : '';
            console.warn(`[CreditsDebug] GET /api/credits exception name=${name} message=${msg.slice(0, 200)}${hint}`);
          }
          return { ok: false, retryable: true };
        }
      };

      const p = run().finally(() => {
        if (lite) creditsInflightLite = null;
        else creditsInflightFull = null;
      });
      if (lite) creditsInflightLite = p;
      else creditsInflightFull = p;
      return p;
    },
    [user?.authToken, user?.id, handle503],
  );

  const fetchCredits = React.useCallback(() => fetchCreditsInternal(true), [fetchCreditsInternal]);

  /** True after we gave up loading credits (all retries failed). Reset on logout. */
  const [creditsLoadGaveUp, setCreditsLoadGaveUp] = useState(false);
  /** Skeleton mostrato almeno 2s per dare l’idea di caricamento; poi si passa all’app. */
  const [creditsLoaderMinElapsed, setCreditsLoaderMinElapsed] = useState(false);
  /** Timestamp del primo rendering dello skeleton crediti: evita reset continui del timer. */
  const creditsSkeletonStartAtRef = useRef<number | null>(null);

  const CREDITS_MAX_ATTEMPTS = 3;
  const CREDITS_RETRY_DELAYS_MS = [800, 1600]; // tra tentativo 0→1 e 1→2

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

  // Dopo i retry iniziali: poche riprovate distanziate (niente loop infinito che martella auth).
  const CREDITS_RECOVERY_DELAYS_MS = [10_000, 30_000, 60_000];
  useEffect(() => {
    if (!user?.authToken) return;
    if (!creditsLoadGaveUp) return;
    if (creditsValueRef.current !== null) return;
    const skipRecovery = user?.plan === 'PRO' || (isTestUser && simulateFreeTier);
    if (skipRecovery) return;

    let cancelled = false;
    const timers: number[] = [];

    CREDITS_RECOVERY_DELAYS_MS.forEach((delay) => {
      const tid = window.setTimeout(async () => {
        if (cancelled || creditsValueRef.current !== null) return;
        creditsFetchSilentRef.current = true;
        try {
          await fetchCreditsInternal(true);
        } finally {
          creditsFetchSilentRef.current = false;
        }
      }, delay);
      timers.push(tid);
    });

    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
      creditsFetchSilentRef.current = false;
    };
  }, [user?.authToken, user?.id, user?.plan, creditsLoadGaveUp, isTestUser, simulateFreeTier, fetchCreditsInternal]);

  // Tab Stats: carica stats + recent_transactions (GET senza lite).
  useEffect(() => {
    if (view !== ViewState.ANALYTICS || !user?.authToken) return;
    const tid = window.setTimeout(() => {
      creditsFetchSilentRef.current = true;
      fetchCreditsInternal(false).finally(() => {
        creditsFetchSilentRef.current = false;
      });
    }, 400);
    return () => clearTimeout(tid);
  }, [view, user?.authToken, user?.id, fetchCreditsInternal]);

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
    if (trophiesInflight) return trophiesInflight;
    const run = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 12000);
        const r = await fetch(`${AUTH_BACKEND_URL}/api/trophies`, {
          headers: { Authorization: `Bearer ${user.authToken}` },
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));
        if (r.status === 503) {
          handle503();
          return;
        }
        if (!r.ok) return;
        const data = await r.json();
        setTrophies(data.trophies ?? []);
      } catch {
        // best-effort: non bloccare UX se trophies è lento/non raggiungibile
      }
    };
    trophiesInflight = run().finally(() => {
      trophiesInflight = null;
    });
    return trophiesInflight;
  }, [user?.authToken, handle503]);

  useEffect(() => {
    if (!user?.authToken) setTrophies(null);
  }, [user?.authToken, user?.id]);

  useEffect(() => {
    if (!user?.authToken) return;
    if (view !== ViewState.ANALYTICS && !showProfile) return;
    fetchTrophies();
  }, [view, showProfile, user?.authToken, user?.id, fetchTrophies]);

  const fileContextResolveRef = useRef<
    ((data: { fileKey: string | null; fileName?: string | null; error?: string | null }) => void) | null
  >(null);
  const actionPlanExecWaitersRef = useRef<
    Map<string, (r: { ok: boolean; error?: string; rootId?: string }) => void>
  >(new Map());
  const dsContextIndexWaitersRef = useRef<
    Map<string, (r: { index: object | null; hash: string | null; error?: string }) => void>
  >(new Map());
  const dsContextIndexProgressRef = useRef<
    Map<string, (p: { phase: 'components'; pageName: string; pageIndex: number; pageTotal: number; scanned: number }) => void>
  >(new Map());
  const dsImportMetaWaitersRef = useRef<
    Map<
      string,
      (r: {
        fileKey: string;
        meta: {
          fileKey: string;
          importedAt: string;
          dsCacheHash: string;
          componentCount: number;
          tokenCount: number;
          name: string;
        } | null;
      }) => void
    >
  >(new Map());
  const dsImportMetaSetWaitersRef = useRef<Map<string, (r: { ok: boolean; error?: string }) => void>>(new Map());

  const requestActionPlanExecution = React.useCallback(
    (plan: object, opts?: { modifyMode?: boolean }) => {
      return new Promise<{ ok: boolean; error?: string; rootId?: string }>((resolve) => {
        const requestId = `apx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        actionPlanExecWaitersRef.current.set(requestId, resolve);
        window.parent.postMessage(
          {
            pluginMessage: {
              type: 'execute-action-plan',
              actionPlan: plan,
              requestId,
              modifyMode: opts?.modifyMode === true,
            },
          },
          '*'
        );
        window.setTimeout(() => {
          if (!actionPlanExecWaitersRef.current.has(requestId)) return;
          actionPlanExecWaitersRef.current.delete(requestId);
          resolve({ ok: false, error: 'Timeout: nessuna risposta da Figma.' });
        }, 25000);
      });
    },
    [],
  );

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
        resolve({
          fileKey: msg.fileKey ?? null,
          fileName: typeof msg.fileName === 'string' ? msg.fileName : null,
          error: msg.error ?? null,
        });
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
      if (msg.type === 'action-plan-executed') {
        const rid = String(msg.requestId || '');
        const fn = rid ? actionPlanExecWaitersRef.current.get(rid) : undefined;
        if (fn) {
          actionPlanExecWaitersRef.current.delete(rid);
          fn({ ok: true, rootId: msg.rootId ? String(msg.rootId) : undefined });
        }
      }
      if (msg.type === 'action-plan-execute-error') {
        const rid = String(msg.requestId || '');
        const fn = rid ? actionPlanExecWaitersRef.current.get(rid) : undefined;
        if (fn) {
          actionPlanExecWaitersRef.current.delete(rid);
          fn({ ok: false, error: String(msg.error || 'Errore creazione su Figma') });
        }
      }
      if (msg.type === 'ds-context-index-result') {
        const rid = String(msg.requestId || '');
        const fn = rid ? dsContextIndexWaitersRef.current.get(rid) : undefined;
        if (fn) {
          dsContextIndexWaitersRef.current.delete(rid);
          dsContextIndexProgressRef.current.delete(rid);
          const idx = msg.index;
          fn({
            index: idx && typeof idx === 'object' ? (idx as object) : null,
            hash: msg.hash != null ? String(msg.hash) : null,
            error: msg.error ? String(msg.error) : undefined,
          });
        }
      }
      if (msg.type === 'ds-import-progress') {
        const rid = String(msg.requestId || '');
        const fn = rid ? dsContextIndexProgressRef.current.get(rid) : undefined;
        if (fn) {
          fn({
            phase: 'components',
            pageName: String(msg.pageName || ''),
            pageIndex: Number(msg.pageIndex || 0),
            pageTotal: Number(msg.pageTotal || 0),
            scanned: Number(msg.scanned || 0),
          });
        }
      }
      if (msg.type === 'ds-import-meta-result') {
        const rid = String(msg.requestId || '');
        const fn = rid ? dsImportMetaWaitersRef.current.get(rid) : undefined;
        if (fn) {
          dsImportMetaWaitersRef.current.delete(rid);
          fn({
            fileKey: String(msg.fileKey || ''),
            meta: msg.meta && typeof msg.meta === 'object'
              ? ({
                  fileKey: String((msg.meta as { fileKey?: unknown }).fileKey || ''),
                  importedAt: String((msg.meta as { importedAt?: unknown }).importedAt || ''),
                  dsCacheHash: String((msg.meta as { dsCacheHash?: unknown }).dsCacheHash || ''),
                  componentCount: Number((msg.meta as { componentCount?: unknown }).componentCount || 0),
                  tokenCount: Number((msg.meta as { tokenCount?: unknown }).tokenCount || 0),
                  name: String((msg.meta as { name?: unknown }).name || ''),
                })
              : null,
          });
        }
      }
      if (msg.type === 'ds-import-meta-set-result') {
        const rid = String(msg.requestId || '');
        const fn = rid ? dsImportMetaSetWaitersRef.current.get(rid) : undefined;
        if (fn) {
          dsImportMetaSetWaitersRef.current.delete(rid);
          fn({ ok: msg.ok === true, error: msg.error ? String(msg.error) : undefined });
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (view === ViewState.GENERATE || view === ViewState.CODE) {
      window.parent.postMessage({ pluginMessage: { type: 'get-selection' } }, '*');
    }
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

  const estimateCredits = React.useCallback(async (payload: { action_type: string; node_count?: number; has_screenshot?: boolean }) => {
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
    const consumed: CreditsState = {
      remaining: data.credits_remaining,
      total: data.credits_total,
      used: data.credits_used,
    };
    setCredits(consumed);
    if (user?.id) writeCreditsCache(user.id, consumed);
    setUser(prev => prev && (data.current_level != null || data.total_xp != null)
      ? { ...prev, current_level: data.current_level ?? prev.current_level, total_xp: data.total_xp ?? prev.total_xp, xp_for_next_level: data.xp_for_next_level ?? prev.xp_for_next_level, xp_for_current_level_start: data.xp_for_current_level_start ?? prev.xp_for_current_level_start }
      : prev);
    if (data.level_up && data.current_level != null) {
      const oldLevel = Math.max(
        1,
        typeof data.level_up_previous_level === 'number' && Number.isFinite(data.level_up_previous_level)
          ? data.level_up_previous_level
          : (user?.current_level ?? 1)
      );
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
  }, [user?.authToken, user?.id, user?.email, user?.current_level, isTestUser, simulateFreeTier, credits, simulatedCredits, fetchTrophies, handle503, setNewTrophiesToast]);

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
        const details = typeof j.details === 'string' && j.details.trim() ? ` (${j.details.trim()})` : '';
        msg = (j.error || text) + details;
      } catch {
        // keep as-is
      }
      console.warn('[Comtra] POST /api/agents/ds-audit failed', r.status, msg.slice(0, 400));
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

  const fetchCodeGen = React.useCallback(
    async (body: {
      format: string;
      node_json: object;
      file_key?: string | null;
      storybook_context?: {
        storybook_base_url?: string;
        matched_layers?: Array<{ figma_layer_id?: string | null; name: string; note?: string }>;
      };
    }) => {
      if (!user?.authToken) throw new Error('Unauthorized');
      const r = await fetch(`${AUTH_BACKEND_URL}/api/agents/code-gen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.authToken}` },
        body: JSON.stringify({
          format: body.format,
          node_json: body.node_json,
          ...(body.file_key ? { file_key: body.file_key } : {}),
          ...(body.storybook_context ? { storybook_context: body.storybook_context } : {}),
        }),
      });
      if (r.status === 503) {
        handle503();
        throw new Error('Service temporarily unavailable');
      }
      if (!r.ok) {
        const text = await r.text();
        let msg = text;
        try {
          const j = JSON.parse(text) as { error?: string; hint?: string };
          msg = j.hint ? `${j.error} — ${j.hint}` : j.error || text;
        } catch {
          // keep text
        }
        throw new Error(msg);
      }
      return r.json() as Promise<{ code?: string; error?: string; component_name?: string }>;
    },
    [user?.authToken, AUTH_BACKEND_URL, handle503],
  );

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

  const fetchDesignSystems = useCallback(async () => {
    try {
      const r = await fetch(`${AUTH_BACKEND_URL}/api/design-systems`, { cache: 'no-store' });
      if (!r.ok) return;
      const data = (await r.json().catch(() => ({}))) as { systems?: unknown };
      if (!Array.isArray(data.systems)) return;
      const deduped = Array.from(
        new Set(data.systems.map((s) => String(s || '').trim()).filter(Boolean)),
      );
      if (!deduped.length) return;
      const custom = deduped.find((s) => s.toLowerCase() === 'custom (current)');
      const ordered = custom
        ? ['Custom (Current)', ...deduped.filter((s) => s.toLowerCase() !== 'custom (current)')]
        : ['Custom (Current)', ...deduped];
      setDesignSystems(ordered);
    } catch {
      // keep local fallback list
    }
  }, []);

  const requestDsContextIndex = useCallback(
    (opts?: {
      reuseCached?: boolean;
      timeoutMs?: number;
      phase?: 'rules' | 'tokens' | 'components';
      onProgress?: (p: { phase: 'components'; pageName: string; pageIndex: number; pageTotal: number; scanned: number }) => void;
    }) => {
      const reuseCached = opts?.reuseCached !== false;
      const timeoutMs =
        typeof opts?.timeoutMs === 'number' && opts.timeoutMs > 0 ? opts.timeoutMs : 30000;
      const phase = opts?.phase;
      return new Promise<{ index: object | null; hash: string | null; error?: string }>((resolve) => {
        const requestId = `dsc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        dsContextIndexWaitersRef.current.set(requestId, resolve);
        if (opts?.onProgress) dsContextIndexProgressRef.current.set(requestId, opts.onProgress);
        if (phase === 'rules' || phase === 'tokens' || phase === 'components') {
          window.parent.postMessage(
            { pluginMessage: { type: 'get-ds-context-index-phase', requestId, phase } },
            '*',
          );
        } else {
          window.parent.postMessage(
            { pluginMessage: { type: 'get-ds-context-index', requestId, reuseCached } },
            '*',
          );
        }
        window.setTimeout(() => {
          const fn = dsContextIndexWaitersRef.current.get(requestId);
          if (!fn) return;
          dsContextIndexWaitersRef.current.delete(requestId);
          dsContextIndexProgressRef.current.delete(requestId);
          fn({ index: null, hash: null, error: 'Timeout waiting for DS context index from Figma.' });
        }, timeoutMs);
      });
    },
    [],
  );

  const fetchDsImportContextSnapshot = useCallback(
    async (
      fileKey: string,
    ): Promise<{ ds_context_index: object; ds_cache_hash: string | null } | null> => {
      if (!user?.authToken || !fileKey || dsImportsUnauthorizedRef.current) return null;
      const r = await fetch(
        `${AUTH_BACKEND_URL}/api/user/ds-imports/context?file_key=${encodeURIComponent(fileKey)}&_ts=${Date.now()}`,
        { cache: 'no-store', headers: { Authorization: `Bearer ${user.authToken}` } },
      );
      if (r.status === 401) {
        dsImportsUnauthorizedRef.current = true;
        return null;
      }
      if (r.status === 404) return null;
      if (r.status === 503) {
        handle503();
        return null;
      }
      if (!r.ok) return null;
      const j = (await r.json().catch(() => ({}))) as {
        ds_context_index?: unknown;
        ds_cache_hash?: string | null;
      };
      const raw = j.ds_context_index;
      if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
      const idx = raw as Record<string, unknown>;
      if (Object.keys(idx).length === 0) return null;
      return {
        ds_context_index: idx,
        ds_cache_hash: j.ds_cache_hash != null && String(j.ds_cache_hash).trim() !== '' ? String(j.ds_cache_hash) : null,
      };
    },
    [user?.authToken, AUTH_BACKEND_URL, handle503],
  );

  const checkServerHasDsContext = useCallback(
    async (fileKey: string) => {
      const snap = await fetchDsImportContextSnapshot(fileKey);
      return !!snap?.ds_context_index;
    },
    [fetchDsImportContextSnapshot],
  );

  const syncDsImportsFromServer = useCallback(async () => {
    if (!user?.authToken || dsImportsUnauthorizedRef.current) return;
    const r = await fetch(`${AUTH_BACKEND_URL}/api/user/ds-imports`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${user.authToken}` },
    });
    if (r.status === 304) return;
    if (r.status === 401) {
      dsImportsUnauthorizedRef.current = true;
      return;
    }
    if (r.status === 503) {
      handle503();
      return;
    }
    if (!r.ok) return;
    const data = (await r.json().catch(() => ({}))) as { imports?: unknown };
    if (!Array.isArray(data.imports)) return;
    replaceDsImportsFromServer(
      data.imports as Parameters<typeof replaceDsImportsFromServer>[0],
    );
  }, [user?.authToken, AUTH_BACKEND_URL, handle503]);

  const persistDsImportToServer = useCallback(
    async (body: {
      figma_file_key: string;
      display_name: string;
      figma_file_name: string;
      ds_cache_hash: string;
      ds_context_index: object;
    }) => {
      if (!user?.authToken || dsImportsUnauthorizedRef.current) return;
      const r = await fetch(`${AUTH_BACKEND_URL}/api/user/ds-imports`, {
        method: 'PUT',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.authToken}` },
        body: JSON.stringify(body),
      });
      if (r.status === 401) {
        dsImportsUnauthorizedRef.current = true;
        throw new Error('Unauthorized');
      }
      if (r.status === 503) {
        handle503();
        throw new Error('Service temporarily unavailable');
      }
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error || `ds-imports save failed (${r.status})`);
      }
      await syncDsImportsFromServer();
    },
    [user?.authToken, AUTH_BACKEND_URL, handle503, syncDsImportsFromServer],
  );

  useEffect(() => {
    dsImportsUnauthorizedRef.current = false;
  }, [user?.authToken]);

  useEffect(() => {
    if (view !== ViewState.GENERATE || !user?.authToken) return;
    const marker = `${user.id || ''}:${user.authToken.slice(0, 12)}`;
    if (dsImportsSyncAttemptedRef.current === marker) return;
    dsImportsSyncAttemptedRef.current = marker;
    let cancelled = false;
    void syncDsImportsFromServer().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [view, user?.authToken, syncDsImportsFromServer]);

  useEffect(() => {
    if (view !== ViewState.GENERATE) return;
    if (designSystemsFetchAttemptedRef.current) return;
    designSystemsFetchAttemptedRef.current = true;
    void fetchDesignSystems();
  }, [view, fetchDesignSystems]);

  const fetchGenerate = useCallback(
    async (body: {
      file_key: string;
      prompt: string;
      mode?: string;
      ds_source?: string;
      screenshot_base64?: string | null;
      /** Se omesso, l’indice viene richiesto al plugin prima del POST. Passa `null` per saltare. */
      ds_context_index?: object | null;
      ds_cache_hash?: string | null;
    }) => {
      if (!user?.authToken) throw new Error('Unauthorized');

      let dsContextIndex: object | undefined | null = body.ds_context_index;
      let dsCacheHash: string | null | undefined = body.ds_cache_hash;
      if (dsContextIndex === undefined) {
        const fromPluginCached = await requestDsContextIndex({ reuseCached: true });
        if (fromPluginCached.index && typeof fromPluginCached.index === 'object') {
          dsContextIndex = fromPluginCached.index;
          const h =
            fromPluginCached.hash ||
            (fromPluginCached.index as { hash?: string }).hash ||
            null;
          dsCacheHash = dsCacheHash ?? h;
        } else {
          const fromServer = await fetchDsImportContextSnapshot(body.file_key);
          if (fromServer?.ds_context_index) {
            dsContextIndex = fromServer.ds_context_index;
            dsCacheHash = dsCacheHash ?? fromServer.ds_cache_hash;
          } else {
            const fromPluginFull = await requestDsContextIndex({
              reuseCached: false,
              timeoutMs: 120000,
            });
            if (fromPluginFull.index && typeof fromPluginFull.index === 'object') {
              dsContextIndex = fromPluginFull.index;
              const h =
                fromPluginFull.hash ||
                (fromPluginFull.index as { hash?: string }).hash ||
                null;
              dsCacheHash = dsCacheHash ?? h;
            } else {
              dsContextIndex = null;
            }
          }
        }
      }

      const payload: Record<string, unknown> = {
        file_key: body.file_key,
        prompt: body.prompt,
        mode: body.mode || 'create',
        ds_source: body.ds_source || 'custom',
      };
      if (dsContextIndex != null) payload.ds_context_index = dsContextIndex;
      if (dsCacheHash != null && String(dsCacheHash).trim() !== '') payload.ds_cache_hash = String(dsCacheHash).trim();
      const sb = body.screenshot_base64;
      if (sb != null && String(sb).trim() !== '') payload.screenshot_base64 = String(sb).trim();

      const r = await fetch(`${AUTH_BACKEND_URL}/api/agents/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.authToken}` },
        body: JSON.stringify(payload),
      });
      if (r.status === 503) {
        handle503();
        throw new Error('Service temporarily unavailable');
      }
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
    },
    [user?.authToken, handle503, requestDsContextIndex, fetchDsImportContextSnapshot, AUTH_BACKEND_URL],
  );

  const requestFileContext = useCallback(() => {
    return new Promise<{ fileKey: string | null; fileName?: string | null; error?: string | null }>((resolve) => {
      fileContextResolveRef.current = resolve;
      window.parent.postMessage({ pluginMessage: { type: 'get-file-context', scope: 'all' } }, '*');
      setTimeout(() => {
        if (fileContextResolveRef.current) {
          const r = fileContextResolveRef.current;
          fileContextResolveRef.current = null;
          r({ fileKey: null, fileName: null, error: 'Timeout' });
        }
      }, 15000);
    });
  }, []);

  const readDsImportMeta = useCallback(async (fileKey: string) => {
    const key = String(fileKey || '').trim();
    if (!key) return null;
    return new Promise<{
      fileKey: string;
      importedAt: string;
      dsCacheHash: string;
      componentCount: number;
      tokenCount: number;
      name: string;
    } | null>((resolve) => {
      const requestId = `dsm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      dsImportMetaWaitersRef.current.set(requestId, (r) => resolve(r.meta));
      window.parent.postMessage({ pluginMessage: { type: 'get-ds-import-meta', requestId, fileKey: key } }, '*');
      window.setTimeout(() => {
        const fn = dsImportMetaWaitersRef.current.get(requestId);
        if (!fn) return;
        dsImportMetaWaitersRef.current.delete(requestId);
        resolve(null);
      }, 7000);
    });
  }, []);

  const writeDsImportMeta = useCallback(
    async (payload: {
      fileKey: string;
      importedAt: string;
      dsCacheHash: string;
      componentCount: number;
      tokenCount: number;
      name: string;
    }) => {
      return new Promise<{ ok: boolean; error?: string }>((resolve) => {
        const requestId = `dsmw-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        dsImportMetaSetWaitersRef.current.set(requestId, resolve);
        window.parent.postMessage({ pluginMessage: { type: 'set-ds-import-meta', requestId, payload } }, '*');
        window.setTimeout(() => {
          const fn = dsImportMetaSetWaitersRef.current.get(requestId);
          if (!fn) return;
          dsImportMetaSetWaitersRef.current.delete(requestId);
          resolve({ ok: false, error: 'Timeout writing DS metadata' });
        }, 7000);
      });
    },
    [],
  );

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
            readDsImportMeta={readDsImportMeta}
            writeDsImportMeta={writeDsImportMeta}
            requestDsContextIndex={requestDsContextIndex}
            checkServerHasDsContext={checkServerHasDsContext}
            persistDsImportToServer={persistDsImportToServer}
            fetchGenerateFeedback={fetchGenerateFeedback}
            selectedNode={selectedNode}
            applyActionPlanToCanvas={requestActionPlanExecution}
            designSystems={designSystems}
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
            fetchCodeGen={fetchCodeGen}
            onNavigateToStats={() => setView(ViewState.ANALYTICS)}
            selectedNode={selectedNode}
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
