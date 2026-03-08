import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchStats, fetchCreditsTimeline, fetchTokenUsage, type AdminStats, type CreditsTimeline, type TokenUsageResponse } from '../api';

const COST_PER_SCAN = 0.013;

export default function Credits() {
  const location = useLocation();
  const highlightDate = (location.state as { highlightDate?: string } | null)?.highlightDate;
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [timeline, setTimeline] = useState<CreditsTimeline | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageResponse | null>(null);
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchStats(), fetchCreditsTimeline(period), fetchTokenUsage(period)])
      .then(([s, t, k]) => {
        if (!cancelled) {
          setStats(s);
          setTimeline(t);
          setTokenUsage(k);
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
      <h1 className="page-title">Crediti e costi</h1>
      {highlightDate && (
        <p style={{ marginBottom: '1rem', padding: '0.5rem', background: 'var(--yellow)', border: '2px solid var(--black)', fontSize: '0.9rem' }}>
          Collegamento da Grafici: dati del <strong>{new Date(highlightDate).toLocaleDateString('it-IT')}</strong>.
        </p>
      )}

      {stats && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 className="section-title">Riepilogo</h2>
          <div className="grid grid-4">
            <div className="brutal-card">
              <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Scan (30d)</h3>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.credits.scans_30d}</div>
            </div>
            <div className="brutal-card">
              <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Crediti consumati (30d)</h3>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.credits.credits_consumed_30d}</div>
            </div>
            <div className="brutal-card">
              <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Costo Kimi stimato (30d)</h3>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>${stats.kimi.cost_30d_usd.toFixed(2)}</div>
            </div>
            <div className="brutal-card">
              <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Cassa minima suggerita</h3>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>${stats.kimi.suggested_buffer_30d_usd.toFixed(2)}</div>
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
            className="brutal-input"
            style={{ width: 'auto', minWidth: 140 }}
          >
            <option value={7}>7 giorni</option>
            <option value={30}>30 giorni</option>
            <option value={90}>90 giorni</option>
          </select>
        </div>

        {timeline?.timeline?.length ? (
          <div className="brutal-card">
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {[...timeline.timeline].reverse().map((d) => (
                <div
                  key={d.date}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    ...(highlightDate && d.date === highlightDate ? { background: 'rgba(255, 201, 0, 0.25)', border: '2px solid var(--black)', margin: -2, padding: 4 } : {}),
                  }}
                >
                  <span className="mono" style={{ width: '100px', fontSize: '0.85rem' }}>
                    {new Date(d.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </span>
                  <div className="chart-bar" style={{ flex: 1, maxWidth: 300 }}>
                    <div
                      className="chart-bar-inner"
                      style={{ width: `${(d.scans / maxScans) * 100}%` }}
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

      {/* Token Kimi — unico approfondimento crediti e costi */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Token Kimi (chiamate e costo)</h2>
        <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Dati anonimi a ogni chiamata Kimi. Input $0.40/1M · Output $2/1M.
        </p>
        {tokenUsage ? (
          <>
            <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
              <div className="brutal-card">
                <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Chiamate</h3>
                <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{tokenUsage.totals.count}</div>
              </div>
              <div className="brutal-card">
                <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Token input</h3>
                <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{tokenUsage.totals.input_tokens.toLocaleString()}</div>
              </div>
              <div className="brutal-card">
                <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Token output</h3>
                <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{tokenUsage.totals.output_tokens.toLocaleString()}</div>
              </div>
              <div className="brutal-card">
                <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Costo stimato (USD)</h3>
                <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>${tokenUsage.totals.cost_usd.toFixed(3)}</div>
              </div>
            </div>

            {tokenUsage.by_action.length > 0 && (
              <div className="brutal-card" style={{ marginBottom: '1.5rem' }}>
                <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>Per tipo azione</h3>
                <div className="brutal-table-wrap">
                  <table className="brutal-table">
                    <thead>
                      <tr>
                        <th>Azione</th>
                        <th style={{ textAlign: 'right' }}>Chiamate</th>
                        <th style={{ textAlign: 'right' }}>Token in</th>
                        <th style={{ textAlign: 'right' }}>Token out</th>
                        <th style={{ textAlign: 'right' }}>Costo USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenUsage.by_action.map((a) => (
                        <tr key={a.action_type}>
                          <td className="mono">{a.action_type}</td>
                          <td style={{ textAlign: 'right' }}>{a.count}</td>
                          <td style={{ textAlign: 'right' }}>{a.input_tokens.toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>{a.output_tokens.toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>${a.cost_usd.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tokenUsage.by_size_band.length > 0 && (
              <div className="brutal-card" style={{ marginBottom: '1.5rem' }}>
                <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>DS Audit per size band</h3>
                <div className="brutal-table-wrap">
                  <table className="brutal-table">
                    <thead>
                      <tr>
                        <th>Band</th>
                        <th style={{ textAlign: 'right' }}>Chiamate</th>
                        <th style={{ textAlign: 'right' }}>Token in</th>
                        <th style={{ textAlign: 'right' }}>Token out</th>
                        <th style={{ textAlign: 'right' }}>Costo USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenUsage.by_size_band.map((b) => (
                        <tr key={b.size_band}>
                          <td className="mono">{b.size_band}</td>
                          <td style={{ textAlign: 'right' }}>{b.count}</td>
                          <td style={{ textAlign: 'right' }}>{b.input_tokens.toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>{b.output_tokens.toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>${b.cost_usd.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tokenUsage.by_day.length > 0 && (
              <div className="brutal-card">
                <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>Kimi per giorno</h3>
                <div className="brutal-table-wrap">
                  <table className="brutal-table" style={{ minWidth: 320 }}>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th style={{ textAlign: 'right' }}>Chiamate</th>
                        <th style={{ textAlign: 'right' }}>Token in</th>
                        <th style={{ textAlign: 'right' }}>Token out</th>
                        <th style={{ textAlign: 'right' }}>Costo USD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...tokenUsage.by_day].reverse().map((d) => (
                        <tr key={d.date}>
                          <td>{d.date}</td>
                          <td style={{ textAlign: 'right' }}>{d.count}</td>
                          <td style={{ textAlign: 'right' }}>{d.input_tokens.toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>{d.output_tokens.toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>${d.cost_usd.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tokenUsage.totals.count === 0 && (
              <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
                Nessun dato Kimi nel periodo. La tabella <code>kimi_usage_log</code> viene popolata a ogni chiamata Kimi dopo il deploy.
              </p>
            )}
          </>
        ) : (
          <p className="loading">Caricamento token…</p>
        )}
      </section>
    </>
  );
}
