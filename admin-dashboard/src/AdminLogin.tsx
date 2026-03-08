import { useState, FormEvent } from 'react';
import { requestMagicLink, setStoredToken } from './api';

const AUTH_TOKEN_KEY = 'admin_token';

export function setAdminLoggedIn(token: string): void {
  setStoredToken(token);
}

export function isAdminLoggedIn(): boolean {
  return !!sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function logout(): void {
  setStoredToken(null);
  window.location.reload();
}

interface AdminLoginProps {
  onSuccess: () => void;
}

export default function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

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
      await requestMagicLink(trimmed);
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
