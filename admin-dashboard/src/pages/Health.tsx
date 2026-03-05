import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchHealth, type HealthResponse, type HealthStatus } from '../api';

const STATUS_LABEL: Record<HealthStatus, string> = {
  up: 'Operativo',
  degraded: 'Degradato',
  down: 'Non disponibile',
  unknown: 'Sconosciuto',
};

const STATUS_STYLE: Record<HealthStatus, { bg: string; color: string }> = {
  up: { bg: 'var(--ok)', color: 'var(--black)' },
  degraded: { bg: 'var(--yellow)', color: 'var(--black)' },
  down: { bg: 'var(--alert)', color: 'var(--white)' },
  unknown: { bg: 'var(--muted)', color: 'var(--white)' },
};

export default function Health() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchHealth()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading && !data) return <p className="loading">Caricamento…</p>;
  if (error && !data) return <p className="error">{error}</p>;

  const global = data?.global ?? 'unknown';
  const style = STATUS_STYLE[global];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <h1 className="page-title">Stato dipendenze</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Link to="/">← Dashboard</Link>
          <button type="button" className="brutal-btn" onClick={load} disabled={loading}>
            Aggiorna
          </button>
        </div>
      </div>

      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Stato di salute di server, API e servizi. I dati sono in cache per 1 minuto.
      </p>

      {data && (
        <>
          <div className="brutal-card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span
              className="badge"
              style={{
                background: style.bg,
                color: style.color,
                border: '2px solid var(--black)',
                fontSize: '1rem',
                padding: '0.5rem 0.75rem',
              }}
            >
              Stato globale: {STATUS_LABEL[global]}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              Ultimo check: {new Date(data.cachedAt).toLocaleString('it-IT')}
            </span>
          </div>

          <h2 className="section-title">Servizi</h2>
          <div className="brutal-table-wrap">
            <table className="brutal-table">
              <thead>
                <tr>
                  <th>Servizio</th>
                  <th>Stato</th>
                  <th>Latenza</th>
                  <th>Dettaglio</th>
                </tr>
              </thead>
              <tbody>
                {data.checks.map((c) => {
                  const s = STATUS_STYLE[c.status];
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 700 }}>{c.name}</td>
                      <td>
                        <span className="badge" style={{ background: s.bg, color: s.color, border: '2px solid var(--black)' }}>
                          {STATUS_LABEL[c.status]}
                        </span>
                      </td>
                      <td className="mono">{c.latencyMs != null ? `${c.latencyMs} ms` : '—'}</td>
                      <td style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>{c.message ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
