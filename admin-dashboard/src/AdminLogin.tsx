import { useState, useEffect, FormEvent } from 'react';
import { requestMagicLink, setStoredToken } from './api';
import { isSafeAdminRedirectPath } from './utils/adminRedirect';

const AUTH_TOKEN_KEY = 'admin_token';
const LOGOUT_NOTICE_KEY = 'admin_logout_notice';

export function setAdminLoggedIn(token: string): void {
  setStoredToken(token);
}

export function isAdminLoggedIn(): boolean {
  return !!sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export type LogoutReason = 'idle' | 'manual';

export function logout(reason?: LogoutReason): void {
  if (reason === 'idle') {
    try {
      sessionStorage.setItem(LOGOUT_NOTICE_KEY, 'idle');
    } catch {
      // ignore
    }
  }
  setStoredToken(null);
  window.location.reload();
}

export function consumeLogoutNotice(): LogoutReason | null {
  try {
    const v = sessionStorage.getItem(LOGOUT_NOTICE_KEY);
    sessionStorage.removeItem(LOGOUT_NOTICE_KEY);
    if (v === 'idle') return 'idle';
  } catch {
    // ignore
  }
  return null;
}

interface AdminLoginProps {
  onSuccess: () => void;
}

export default function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [idleLogoutNotice, setIdleLogoutNotice] = useState(false);

  useEffect(() => {
    if (consumeLogoutNotice() === 'idle') setIdleLogoutNotice(true);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('redirect');
    if (r && isSafeAdminRedirectPath(r)) {
      sessionStorage.setItem('admin_redirect_after_login', r);
      const path = window.location.pathname || '/';
      window.history.replaceState({}, '', path);
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('Inserisci la tua email');
      return;
    }
    setLoading(true);
    try {
      const stored = sessionStorage.getItem('admin_redirect_after_login');
      const redirect =
        stored && isSafeAdminRedirectPath(stored) ? stored : undefined;
      await requestMagicLink(trimmed, redirect);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="admin-login-wrap">
        <div className="brutal-card" style={{ maxWidth: 360 }}>
          <h1 className="page-title" style={{ marginBottom: '0.5rem' }}>Controlla la tua email</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Se questa email è abilitata all’accesso, abbiamo inviato un link per accedere. Controlla anche la cartella spam.
          </p>
          <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
            Il link scade tra 15 minuti.
          </p>
          <button type="button" className="brutal-btn" style={{ width: '100%' }} onClick={() => { setSent(false); setEmail(''); }}>
            Invia un altro link
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-login-wrap">
      <div className="brutal-card" style={{ maxWidth: 360 }}>
        {idleLogoutNotice && (
          <p
            role="status"
            style={{
              margin: '0 0 1rem',
              padding: '0.5rem 0.65rem',
              border: '2px solid var(--black)',
              background: 'var(--yellow)',
              fontSize: '0.85rem',
            }}
          >
            Sessione chiusa per inattività. Accedi di nuovo per continuare.
          </p>
        )}
        <div style={{ marginBottom: '1rem' }}>
          <span className="badge" style={{ background: 'var(--yellow)', color: 'var(--black)' }}>
            Accesso riservato
          </span>
        </div>
        <h1 className="page-title" style={{ marginBottom: '0.5rem' }}>Admin</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Inserisci la tua email: ti invieremo un link per accedere (solo indirizzi abilitati).
        </p>
        <form onSubmit={handleSubmit}>
          <label className="brutal-label">Email</label>
          <input
            type="email"
            className="brutal-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            placeholder="tu@esempio.com"
            style={{ marginBottom: '1rem' }}
            aria-label="Email"
          />
          {error && <p className="error" style={{ marginBottom: '0.75rem' }}>{error}</p>}
          <button type="submit" className="brutal-btn primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Invio…' : 'Invia link'}
          </button>
        </form>
      </div>
    </div>
  );
}
