import React, { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'comtra:last-activity-at';

function readLastActivityAt(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) {
      const now = Date.now();
      window.localStorage.setItem(STORAGE_KEY, String(now));
      return now;
    }
    return parsed;
  } catch {
    return Date.now();
  }
}

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

export function InactivityTimerBadge() {
  const [lastActivityAt, setLastActivityAt] = useState<number>(() => readLastActivityAt());
  const [now, setNow] = useState<number>(() => Date.now());
  const lastWriteAtRef = useRef<number>(0);

  useEffect(() => {
    const persistActivity = (timestamp: number) => {
      setLastActivityAt(timestamp);
      const elapsedSinceWrite = timestamp - lastWriteAtRef.current;
      if (elapsedSinceWrite < 1000) return;
      lastWriteAtRef.current = timestamp;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(timestamp));
      } catch {
        // Ignore storage failures in restricted environments
      }
    };

    const onActivity = () => persistActivity(Date.now());
    const onFocus = () => persistActivity(Date.now());
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') persistActivity(Date.now());
    };

    window.addEventListener('mousemove', onActivity, { passive: true });
    window.addEventListener('mousedown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });
    window.addEventListener('scroll', onActivity, { passive: true });
    window.addEventListener('touchstart', onActivity, { passive: true });
    window.addEventListener('focus', onFocus, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.removeEventListener('mousemove', onActivity);
      window.removeEventListener('mousedown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('scroll', onActivity);
      window.removeEventListener('touchstart', onActivity);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, []);

  const idleLabel = useMemo(() => formatIdle(now - lastActivityAt), [now, lastActivityAt]);

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        right: '12px',
        bottom: '12px',
        zIndex: 9999,
        border: '2px solid #000',
        background: '#fff',
        color: '#000',
        fontFamily: 'monospace',
        fontSize: '11px',
        padding: '6px 8px',
        lineHeight: 1.1,
        pointerEvents: 'none',
      }}
    >
      <span style={{ opacity: 0.7 }}>Idle</span> {idleLabel}
    </div>
  );
}
