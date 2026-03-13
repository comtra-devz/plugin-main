import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { fetchNotifications, type AdminNotification, type NotificationSeverity } from '../api';

const SEVERITY_LABEL: Record<NotificationSeverity, string> = {
  info: 'Info',
  warning: 'Avviso',
  critical: 'Critico',
};

const SEVERITY_COLOR: Record<NotificationSeverity, string> = {
  info: 'var(--muted)',
  warning: 'var(--yellow)',
  critical: 'var(--alert)',
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function Notifications() {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchNotifications()
      .then((r) => {
        if (cancelled) return;
        const sorted = [...(r.items || [])].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setItems(sorted);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Errore caricamento notifiche');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader title="Notifiche" />
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Riepilogo eventi importanti su salute servizi, costi, utilizzo e sicurezza. Ogni notifica porta alla pagina di dettaglio
        corrispondente nella dashboard.
      </p>

      {loading && !error && (
        <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>Caricamento notifiche…</p>
      )}
      {error && (
        <p className="error" style={{ fontSize: '0.9rem' }}>
          {error}
        </p>
      )}

      {!loading && !error && items.length === 0 ? (
        <p style={{ fontSize: '0.95rem', color: 'var(--muted)' }}>Nessuna notifica al momento.</p>
      ) : !loading && items.length > 0 ? (
        <div className="brutal-card" style={{ padding: 0 }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map((n, idx) => (
              <li
                key={n.id}
                style={{
                  borderBottom: idx === items.length - 1 ? 'none' : '2px solid var(--black)',
                }}
              >
                <Link
                  to={n.targetPath}
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    alignItems: 'flex-start',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <span
                    className="badge"
                    style={{
                      background: SEVERITY_COLOR[n.severity],
                      color: n.severity === 'critical' ? 'var(--white)' : 'var(--black)',
                      border: '2px solid var(--black)',
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    {SEVERITY_LABEL[n.severity]}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <h2 className="section-title" style={{ margin: 0, fontSize: '0.95rem' }}>
                        {n.title}
                      </h2>
                    <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {formatDate(n.created_at)}
                      </span>
                    </div>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: 'var(--muted)' }}>{n.description}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

