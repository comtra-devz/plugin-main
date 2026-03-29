import { useEffect, useMemo, useRef, useState } from 'react';
import { ADMIN_LAST_ACTIVITY_KEY, getIdleLogoutMinutes, readLastActivityAt } from '../lib/adminIdle';

/** Non aggiornare React a ogni mousemove: blocca il main thread e rallenta tutta la SPA. */
const ACTIVITY_SAMPLE_MS = 3000;

function formatIdle(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Timer di inattività fisso in basso a destra (solo dashboard admin). */
export function InactivityTimerBadge() {
  const lastAtRef = useRef<number>(readLastActivityAt());
  const lastSampleAtRef = useRef<number>(0);
  /** Solo per forzare 1 re-render al secondo (display), mai su mousemove. */
  const [tick, setTick] = useState(0);
  const idleMins = getIdleLogoutMinutes();

  useEffect(() => {
    const markActivity = (ts: number) => {
      lastAtRef.current = ts;
      const prev = lastSampleAtRef.current;
      if (ts - prev < ACTIVITY_SAMPLE_MS) return;
      lastSampleAtRef.current = ts;
      try {
        window.localStorage.setItem(ADMIN_LAST_ACTIVITY_KEY, String(ts));
      } catch {
        // ignore
      }
    };

    const onActivity = () => markActivity(Date.now());
    const onFocus = () => markActivity(Date.now());
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') markActivity(Date.now());
    };

    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('mousedown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });
    window.addEventListener('scroll', onActivity, { passive: true });
    window.addEventListener('touchstart', onActivity, { passive: true });
    window.addEventListener('focus', onFocus, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    const intervalId = window.setInterval(() => {
      setTick((n) => n + 1);
      try {
        window.localStorage.setItem(ADMIN_LAST_ACTIVITY_KEY, String(lastAtRef.current));
      } catch {
        // ignore
      }
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('mousedown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('scroll', onActivity);
      window.removeEventListener('touchstart', onActivity);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(intervalId);
      try {
        window.localStorage.setItem(ADMIN_LAST_ACTIVITY_KEY, String(lastAtRef.current));
      } catch {
        // ignore
      }
    };
  }, []);

  const idleLabel = useMemo(() => formatIdle(Date.now() - lastAtRef.current), [tick]);

  return (
    <div
      aria-live="polite"
      title={`Tempo dall’ultima interazione (mouse, tastiera, scroll, focus). Persiste al refresh. Logout automatico dopo ${idleMins} min di inattività.`}
      style={{
        position: 'fixed',
        right: '12px',
        bottom: '12px',
        zIndex: 9999,
        border: '2px solid var(--black, #000)',
        background: 'var(--white, #fff)',
        color: 'var(--black, #000)',
        fontFamily: 'monospace',
        fontSize: '11px',
        padding: '6px 8px',
        lineHeight: 1.1,
        pointerEvents: 'none',
      }}
    >
      <span style={{ opacity: 0.75 }}>Inattività</span> {idleLabel}
    </div>
  );
}
