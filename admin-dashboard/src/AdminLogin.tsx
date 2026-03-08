import { useState, FormEvent } from 'react';
import { login, verify2fa, setup2fa, confirm2fa, setStoredToken } from './api';

const MAX_ATTEMPTS = 5;
const LOCK_KEY = 'admin_lock_until';
const AUTH_TOKEN_KEY = 'admin_token';

function isLocked(): boolean {
  const until = sessionStorage.getItem(LOCK_KEY);
  if (!until) return false;
  return Date.now() < parseInt(until, 10);
}

function setLocked(): void {
  sessionStorage.setItem(LOCK_KEY, String(Date.now() + 60_000));
}

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

type Step = 'email-pass' | '2fa-verify' | '2fa-setup';

interface AdminLoginProps {
  onSuccess: () => void;
}

export default function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [step, setStep] = useState<Step>('email-pass');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLockedState] = useState(isLocked());

  const handleEmailPassSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (locked) return;
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      if (res.need2FA === 'setup') {
        const data = await setup2fa(res.tempToken!);
        setQrUrl(data.qrUrl);
        setSetupToken(data.setupToken);
        setStep('2fa-setup');
      } else if (res.need2FA && res.tempToken) {
        setTempToken(res.tempToken);
        setStep('2fa-verify');
      } else {
        setError('Risposta server non valida');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di login');
      const next = attempts + 1;
      setAttempts(next);
      if (next >= MAX_ATTEMPTS) {
        setLocked();
        setLockedState(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2faSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token } = await verify2fa(tempToken, code);
      setStoredToken(token);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Codice non valido');
    } finally {
      setLoading(false);
    }
  };

  const handleSetup2faSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token } = await confirm2fa(setupToken, code);
      setStoredToken(token);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Codice non valido');
    } finally {
      setLoading(false);
    }
  };

  const backToEmailPass = () => {
    setStep('email-pass');
    setTempToken('');
    setSetupToken('');
    setQrUrl('');
    setCode('');
    setError(null);
  };

  if (locked) {
    return (
      <div className="admin-login-wrap">
        <div className="brutal-card" style={{ maxWidth: 360, textAlign: 'center' }}>
          <h1 className="page-title" style={{ marginBottom: '0.5rem' }}>Bloccato</h1>
          <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
            Troppi tentativi. Riprova tra 1 minuto.
          </p>
          <button
            type="button"
            className="brutal-btn"
            onClick={() => {
              sessionStorage.removeItem(LOCK_KEY);
              setLockedState(false);
              setAttempts(0);
            }}
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  if (step === '2fa-verify') {
    return (
      <div className="admin-login-wrap">
        <div className="brutal-card" style={{ maxWidth: 360 }}>
          <h1 className="page-title" style={{ marginBottom: '0.5rem' }}>Codice 2FA</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Inserisci il codice a 6 cifre dall’app Authenticator.
          </p>
          <form onSubmit={handleVerify2faSubmit}>
            <label className="brutal-label">Codice</label>
            <input
              type="text"
              className="brutal-input"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              autoComplete="one-time-code"
              style={{ marginBottom: '1rem', letterSpacing: '0.25em', textAlign: 'center' }}
              aria-label="Codice 2FA"
            />
            {error && <p className="error" style={{ marginBottom: '0.75rem' }}>{error}</p>}
            <button type="submit" className="brutal-btn primary" style={{ width: '100%', marginBottom: '0.5rem' }} disabled={loading || code.length !== 6}>
              {loading ? 'Verifica…' : 'Verifica'}
            </button>
            <button type="button" className="brutal-btn" style={{ width: '100%' }} onClick={backToEmailPass}>
              ← Indietro
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (step === '2fa-setup') {
    return (
      <div className="admin-login-wrap">
        <div className="brutal-card" style={{ maxWidth: 360 }}>
          <h1 className="page-title" style={{ marginBottom: '0.5rem' }}>Configura 2FA</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Scansiona il QR con Google Authenticator (o app compatibile), poi inserisci il codice a 6 cifre per confermare.
          </p>
          {qrUrl && (
            <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}`} alt="QR 2FA" width={180} height={180} style={{ border: '2px solid var(--black)' }} />
            </div>
          )}
          <form onSubmit={handleSetup2faSubmit}>
            <label className="brutal-label">Codice dall’app</label>
            <input
              type="text"
              className="brutal-input"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              autoComplete="one-time-code"
              style={{ marginBottom: '1rem', letterSpacing: '0.25em', textAlign: 'center' }}
              aria-label="Codice 2FA"
            />
            {error && <p className="error" style={{ marginBottom: '0.75rem' }}>{error}</p>}
            <button type="submit" className="brutal-btn primary" style={{ width: '100%', marginBottom: '0.5rem' }} disabled={loading || code.length !== 6}>
              {loading ? 'Conferma…' : 'Conferma e accedi'}
            </button>
            <button type="button" className="brutal-btn" style={{ width: '100%' }} onClick={backToEmailPass}>
              ← Indietro
            </button>
          </form>
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
          Comtra Admin Dashboard
        </p>
        <form onSubmit={handleEmailPassSubmit}>
          <label className="brutal-label">Email</label>
          <input
            type="email"
            className="brutal-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            autoFocus
            style={{ marginBottom: '1rem' }}
            aria-label="Email"
          />
          <label className="brutal-label">Password</label>
          <input
            type="password"
            className="brutal-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            style={{ marginBottom: '1rem' }}
            aria-label="Password"
          />
          {error && <p className="error" style={{ marginBottom: '0.75rem' }}>{error}</p>}
          <button type="submit" className="brutal-btn primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Accesso…' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  );
}
