import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchHealth, type HealthResponse, type HealthStatus } from '../api';

const STATUS_LABEL: Record<HealthStatus, string> = {
  up: 'Tutto ok',
  degraded: 'Degradato',
  down: 'Problemi',
  unknown: 'Sconosciuto',
};

const STATUS_STYLE: Record<HealthStatus, { bg: string; color: string; border: string }> = {
  up: { bg: 'var(--ok)', color: 'var(--black)', border: 'var(--black)' },
  degraded: { bg: 'var(--yellow)', color: 'var(--black)', border: 'var(--black)' },
  down: { bg: 'var(--alert)', color: 'var(--white)', border: 'var(--black)' },
  unknown: { bg: 'var(--muted)', color: 'var(--white)', border: 'var(--black)' },
};

export default function HealthBadge() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then((h) => { if (!cancelled) setHealth(h); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const status = health?.global ?? (error ? 'down' : 'unknown');
  const style = STATUS_STYLE[status];
  const label = loading ? '…' : (error && !health ? 'Errore' : STATUS_LABEL[status]);

  return (
    <Link
      to="/health"
      className="health-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.35rem 0.6rem',
        fontSize: '0.75rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        background: style.bg,
        color: style.color,
        border: `2px solid ${style.border}`,
        boxShadow: '2px 2px 0 0 var(--black)',
        textDecoration: 'none',
      }}
      title="Stato dipendenze"
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: loading ? 'var(--muted)' : status === 'up' ? 'var(--ok)' : status === 'down' ? 'var(--white)' : 'var(--black)',
          flexShrink: 0,
        }}
      />
      {label}
    </Link>
  );
}
