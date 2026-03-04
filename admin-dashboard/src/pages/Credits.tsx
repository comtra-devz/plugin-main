import { useEffect, useState } from 'react';
import { fetchStats, fetchCreditsTimeline, type AdminStats, type CreditsTimeline } from '../api';

const COST_PER_SCAN = 0.013;

export default function Credits() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [timeline, setTimeline] = useState<CreditsTimeline | null>(null);
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchStats(), fetchCreditsTimeline(period)])
      .then(([s, t]) => {
        if (!cancelled) {
          setStats(s);
          setTimeline(t);
          setError(null);
        }
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period]);

  if (loading && !stats) return <p className="loading">Caricamento…</p>;
  if (error) return <p className="error">{error}</p>;

  const maxScans = timeline?.timeline?.length
    ? Math.max(...timeline.timeline.map((d) => d.scans), 1)
    : 1;

  return (
    <>
      <h1 style={{ marginTop: 0, marginBottom: '1rem' }}>Crediti e costi</h1>

      {stats && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 className="section-title">Riepilogo</h2>
          <div className="grid grid-4">
            <div className="card">
              <h3>Scan (30d)</h3>
              <div className="value">{stats.credits.scans_30d}</div>
            </div>
            <div className="card">
              <h3>Crediti consumati (30d)</h3>
              <div className="value">{stats.credits.credits_consumed_30d}</div>
            </div>
            <div className="card">
              <h3>Costo Kimi stimato (30d)</h3>
              <div className="value">${stats.kimi.cost_30d_usd.toFixed(2)}</div>
            </div>
            <div className="card">
              <h3>Cassa minima suggerita</h3>
              <div className="value">${stats.kimi.suggested_buffer_30d_usd.toFixed(2)}</div>
            </div>
          </div>
        </section>
      )}

      <section style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>Timeline consumo</h2>
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="btn"
            style={{ padding: '0.4rem 0.75rem' }}
          >
            <option value={7}>7 giorni</option>
            <option value={30}>30 giorni</option>
            <option value={90}>90 giorni</option>
          </select>
        </div>

        {timeline?.timeline?.length ? (
          <div className="card">
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {[...timeline.timeline].reverse().map((d) => (
                <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span className="mono" style={{ width: '100px', fontSize: '0.85rem' }}>
                    {new Date(d.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </span>
                  <div className="chart-bar" style={{ flex: 1, maxWidth: 300 }}>
                    <div
                      style={{
                        width: `${(d.scans / maxScans) * 100}%`,
                        height: '100%',
                        background: 'var(--accent)',
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <span className="mono" style={{ fontSize: '0.85rem' }}>
                    {d.scans} scan · {d.credits} cr
                  </span>
                  <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    ~${(d.scans * COST_PER_SCAN).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="loading">Nessun dato per il periodo selezionato.</p>
        )}
      </section>
    </>
  );
}
