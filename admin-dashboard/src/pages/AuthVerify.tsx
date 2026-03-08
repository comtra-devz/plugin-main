import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { verifyMagicLink, setStoredToken } from '../api';

interface AuthVerifyProps {
  onSuccess: () => void;
}

export default function AuthVerify({ onSuccess }: AuthVerifyProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (!token || !token.trim()) {
      setStatus('error');
      setMessage('Link non valido: manca il token.');
      return;
    }
    let cancelled = false;
    verifyMagicLink(token.trim())
      .then(({ token: sessionToken }) => {
        if (cancelled) return;
        setStoredToken(sessionToken);
        setStatus('ok');
        onSuccess();
        navigate('/', { replace: true });
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Link non valido o scaduto.');
      });
    return () => { cancelled = true; };
  }, [token, onSuccess, navigate]);

  return (
    <div className="admin-login-wrap">
      <div className="brutal-card" style={{ maxWidth: 360, textAlign: 'center' }}>
        {status === 'loading' && (
          <>
            <h1 className="page-title" style={{ marginBottom: '0.5rem' }}>Accesso in corso</h1>
            <p style={{ color: 'var(--muted)' }}>Verifica del link…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="page-title" style={{ marginBottom: '0.5rem' }}>Link non valido</h1>
            <p className="error" style={{ marginBottom: '1rem' }}>{message}</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '1rem' }}>
              Il link potrebbe essere scaduto (15 minuti). Torna alla login e richiedi un nuovo link.
            </p>
            <a href="/" className="brutal-btn primary" style={{ display: 'inline-block' }}>
              ← Torna alla login
            </a>
          </>
        )}
      </div>
    </div>
  );
}
