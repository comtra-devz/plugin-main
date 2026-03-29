import { useEffect } from 'react';
import { logout } from './AdminLogin';
import { getIdleLogoutMs, readLastActivityAt } from './lib/adminIdle';

const CHECK_MS = 3000;

/** Dopo `getIdleLogoutMs()` senza attività, rimuove il token e ricarica (stesso clock del badge). */
export function useIdleAutoLogout(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const max = getIdleLogoutMs();
    const id = window.setInterval(() => {
      const last = readLastActivityAt();
      if (Date.now() - last >= max) {
        logout('idle');
      }
    }, CHECK_MS);
    return () => window.clearInterval(id);
  }, [enabled]);
}
