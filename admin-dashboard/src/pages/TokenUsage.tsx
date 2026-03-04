import { useEffect, useState } from 'react';
import { fetchTokenUsage, type TokenUsageResponse } from '../api';

export default function TokenUsage() {
  const [data, setData] = useState<TokenUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTokenUsage(period)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period]);

  if (loading) return <p className="loading">Caricamento…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data) return null;

  const { totals, by_action, by_size_band, by_day } = data;

  return (
    <>
      <h1 style={{ marginTop: 0, marginBottom: '1rem' }}>Uso token Kimi (telemetria)</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Dati anonimi raccolti dal backend a ogni chiamata Kimi. Nessun dato utente/file. Vedi <code>docs/TOKEN-USAGE-TELEMETRY.md</code>.
      </p>

      <div style={{ marginBottom: '1.5rem' }}>
        <label>
          Periodo:{' '}
          <select value={period} onChange={(e) => setPeriod(Number(e.target.value))}>
            <option value={7}>7 giorni</option>
            <option value={30}>30 giorni</option>
            <option value={90}>90 giorni</option>
          </select>
        </label>
      </div>

      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Totali (periodo)</h2>
        <div className="grid grid-4">
          <div className="card">
            <h3>Chiamate</h3>
            <div className="value">{totals.count}</div>
          </div>
          <div className="card">
            <h3>Token input</h3>
            <div className="value">{totals.input_tokens.toLocaleString()}</div>
          </div>
          <div className="card">
            <h3>Token output</h3>
            <div className="value">{totals.output_tokens.toLocaleString()}</div>
          </div>
          <div className="card">
            <h3>Costo stimato (USD)</h3>
            <div className="value">${totals.cost_usd.toFixed(3)}</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              Input $0.40/1M · Output $2/1M
            </p>
          </div>
        </div>
      </section>

      {by_action.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 className="section-title">Per tipo azione</h2>
          <div className="card">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Azione</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Chiamate</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Token in</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Token out</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Costo USD</th>
                </tr>
              </thead>
              <tbody>
                {by_action.map((a) => (
                  <tr key={a.action_type} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem' }} className="mono">{a.action_type}</td>
                    <td style={{ textAlign: 'right', padding: '0.5rem' }}>{a.count}</td>
                    <td style={{ textAlign: 'right', padding: '0.5rem' }}>{a.input_tokens.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', padding: '0.5rem' }}>{a.output_tokens.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', padding: '0.5rem' }}>${a.cost_usd.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {by_size_band.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 className="section-title">DS Audit per size band</h2>
          <div className="card">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Band</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Chiamate</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Token in</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Token out</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Costo USD</th>
                </tr>
              </thead>
              <tbody>
                {by_size_band.map((b) => (
                  <tr key={b.size_band} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem' }} className="mono">{b.size_band}</td>
                    <td style={{ textAlign: 'right', padding: '0.5rem' }}>{b.count}</td>
                    <td style={{ textAlign: 'right', padding: '0.5rem' }}>{b.input_tokens.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', padding: '0.5rem' }}>{b.output_tokens.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', padding: '0.5rem' }}>${b.cost_usd.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {by_day.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 className="section-title">Per giorno</h2>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 320 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Data</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Chiamate</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Token in</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Token out</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Costo USD</th>
                </tr>
              </thead>
              <tbody>
                {[...by_day].reverse().map((d) => (
                  <tr key={d.date} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem' }}>{d.date}</td>
                    <td style={{ textAlign: 'right', padding: '0.5rem' }}>{d.count}</td>
                    <td style={{ textAlign: 'right', padding: '0.5rem' }}>{d.input_tokens.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', padding: '0.5rem' }}>{d.output_tokens.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', padding: '0.5rem' }}>${d.cost_usd.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {totals.count === 0 && (
        <p style={{ color: 'var(--muted)' }}>
          Nessun dato nel periodo. La tabella <code>kimi_usage_log</code> viene popolata a ogni DS Audit (e future azioni Kimi) dopo il deploy con lo schema aggiornato.
        </p>
      )}
    </>
  );
}
