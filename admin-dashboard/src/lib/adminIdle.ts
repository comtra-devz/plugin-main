/**
 * Ultima attività admin: condivisa tra badge inattività e logout automatico.
 * Override minuti: VITE_ADMIN_IDLE_LOGOUT_MINUTES (default 30).
 */
export const ADMIN_LAST_ACTIVITY_KEY = 'comtra:admin:last-activity-at';

export function getIdleLogoutMinutes(): number {
  const raw = (import.meta as { env?: { VITE_ADMIN_IDLE_LOGOUT_MINUTES?: string } }).env?.VITE_ADMIN_IDLE_LOGOUT_MINUTES;
  const n = raw != null && raw !== '' ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export function getIdleLogoutMs(): number {
  return getIdleLogoutMinutes() * 60 * 1000;
}

export function readLastActivityAt(): number {
  try {
    const raw = window.localStorage.getItem(ADMIN_LAST_ACTIVITY_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) {
      const now = Date.now();
      window.localStorage.setItem(ADMIN_LAST_ACTIVITY_KEY, String(now));
      return now;
    }
    return parsed;
  } catch {
    return Date.now();
  }
}

export function touchAdminActivity(): void {
  try {
    window.localStorage.setItem(ADMIN_LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}
