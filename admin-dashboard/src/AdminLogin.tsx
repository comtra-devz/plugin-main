import { useState, FormEvent } from 'react';

const DEMO_USER = 'admin';
const DEMO_PASS = 'admin';
const MAX_ATTEMPTS = 3;
const LOCK_KEY = 'admin_lock_until';
const AUTH_KEY = 'admin_logged_in';

function isLocked(): boolean {
  const until = sessionStorage.getItem(LOCK_KEY);
  if (!until) return false;
  return Date.now() < parseInt(until, 10);
}

function setLocked(): void {
  sessionStorage.setItem(LOCK_KEY, String(Date.now() + 60_000)); // 1 min
}

export function setAdminLoggedIn(): void {
  sessionStorage.setItem(AUTH_KEY, '1');
}

export function isAdminLoggedIn(): boolean {
  return sessionStorage.getItem(AUTH_KEY) === '1';
}

export function logout(): void {
  sessionStorage.removeItem(AUTH_KEY);
  window.location.reload();
}

interface AdminLoginProps {
  onSuccess: () => void;
}

export default function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [locked, setLockedState] = useState(isLocked());

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (locked) return;
    if (user === DEMO_USER && pass === DEMO_PASS) {
      setAdminLoggedIn();
      onSuccess();
      return;
    }
    const next = attempts + 1;
    setAttempts(next);
    if (next >= MAX_ATTEMPTS) {
      setLocked();
      setLockedState(true);
    }
  };

  if (locked) {
    return (
      <div className="admin-login-wrap">
        <div className="brutal-card" style={{ maxWidth: 360, textAlign: 'center' }}>
          <h1 className="page-title" style={{ marginBottom: '0.5rem' }}>System Locked</h1>
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

  return (
    <div className="admin-login-wrap">
      <div className="brutal-card" style={{ maxWidth: 360 }}>
        <div style={{ marginBottom: '1rem' }}>
          <span className="badge" style={{ background: 'var(--yellow)', color: 'var(--black)' }}>
            Restricted Access
          </span>
        </div>
        <h1 className="page-title" style={{ marginBottom: '0.5rem' }}>Admin OS</h1>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Comtra Admin Dashboard
        </p>
        <form onSubmit={handleSubmit}>
          <label className="brutal-label">Admin ID</label>
          <input
            type="text"
            className="brutal-input"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete="username"
            autoFocus
            style={{ marginBottom: '1rem' }}
            aria-label="Admin ID"
          />
          <label className="brutal-label">Password</label>
          <input
            type="password"
            className="brutal-input"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="current-password"
            style={{ marginBottom: '1rem' }}
            aria-label="Password"
          />
          <button type="submit" className="brutal-btn primary" style={{ width: '100%' }}>
            Authenticate
          </button>
        </form>
        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '1rem' }}>
          Demo: {DEMO_USER} / {DEMO_PASS}
        </p>
      </div>
    </div>
  );
}
