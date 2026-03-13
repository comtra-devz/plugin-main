import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchBrandAwareness, type BrandAwarenessResponse, type BrandAwarenessShareClick } from '../api';
import PageHeader from '../components/PageHeader';

const PERIOD_OPTIONS = [7, 14, 30, 90] as const;

export default function BrandAwareness() {
  const [data, setData] = useState<BrandAwarenessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchBrandAwareness(period, 100, 0)
      .then((d) => { if (!cancelled) setData(d); setError(null); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period]);

  return (
    <>
      <PageHeader
        title="Brand awareness"
        actions={
          <select
            className="brutal-input"
            value={period}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPeriod(Number(e.target.value))}
            style={{ width: 'auto' }}
            aria-label="Periodo in giorni"
          >
            {PERIOD_OPTIONS.map((d) => (
              <option key={d} value={d}>Ultimi {d} giorni</option>
            ))}
          </select>
        }
      />
      <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Click su &quot;Share on LinkedIn&quot; per trofeo (utente con email celata). In futuro: post effettivamente pubblicati (tag LinkedIn) e attività da post (click pagina trofeo, click link footer).
      </p>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/brand-awareness/funnel" className="brutal-btn primary" style={{ fontSize: '0.85rem' }}>
          Funnel touchpoint (Landing · Plugin · LinkedIn) →
        </Link>
      </div>

      {loading && !data && <p className="loading">Caricamento…</p>}
      {error && <p className="error">{error}</p>}

      {data && (
        <>
          <div className="brutal-card" style={{ marginBottom: '1.5rem' }}>
            <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>Riepilogo (ultimi {data.period_days} giorni)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>Click Share LinkedIn</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 800 }}>{data.share_clicks.total}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>Utenti unici</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 800 }}>{data.unique_users}</p>
              </div>
            </div>
          </div>

          {Object.keys(data.by_trophy).length > 0 && (
            <div className="brutal-card" style={{ marginBottom: '1.5rem' }}>
              <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>Click per trofeo</h3>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem' }}>
                {Object.entries(data.by_trophy)
                  .sort(([, a]: [string, number], [, b]: [string, number]) => b - a)
                  .map(([trophyId, count]) => (
                    <li key={trophyId} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="mono" style={{ fontSize: '0.9rem' }}>{trophyId}</span>
                      <span style={{ fontWeight: 700 }}>{count}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <section style={{ marginBottom: '2rem' }}>
            <h2 className="section-title">Ultimi click Share on LinkedIn</h2>
            <div className="brutal-table-wrap">
              <table className="brutal-table">
                <thead>
                  <tr>
                    <th scope="col">Utente (celato)</th>
                    <th scope="col">Trofeo</th>
                    <th scope="col">Data e ora</th>
                  </tr>
                </thead>
                <tbody>
                  {data.share_clicks.items.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                        Nessun click nel periodo selezionato.
                      </td>
                    </tr>
                  ) : (
                    data.share_clicks.items.map((row: BrandAwarenessShareClick) => (
                      <tr key={row.id}>
                        <td className="mono">{row.user_masked}</td>
                        <td className="mono" style={{ fontSize: '0.9rem' }}>{row.trophy_id}</td>
                        <td style={{ fontSize: '0.9rem' }}>
                          {new Date(row.created_at).toLocaleString('it-IT', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="brutal-card" style={{ marginBottom: '1rem', borderStyle: 'dashed', opacity: 0.9 }}>
            <h3 className="section-title" style={{ marginBottom: '0.5rem' }}>Post pubblicati (futuro)</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)' }}>
              {data.posts_published_note ?? 'Da integrare quando avremo i tag/metriche da LinkedIn (post effettivamente pubblicati).'}
            </p>
          </div>
          <div className="brutal-card" style={{ borderStyle: 'dashed', opacity: 0.9 }}>
            <h3 className="section-title" style={{ marginBottom: '0.5rem' }}>Attività da post (futuro)</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)' }}>
              {data.activity_note ?? 'Click su pagina trofeo (comtra.dev/trophy/…) e click su link footer: da abilitare quando le pagine e il footer sono live (tracking UTM o beacon).'}
            </p>
          </div>
        </>
      )}
    </>
  );
}
