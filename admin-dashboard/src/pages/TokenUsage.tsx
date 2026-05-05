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
      <h1 className="page-title">Uso token AI</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Dati anonimi raccolti dal backend a ogni chiamata AI tracciata (Qwen/Kimi a seconda della route). Nessun dato utente/file. Vedi <code>docs/TOKEN-USAGE-TELEMETRY.md</code>.
      </p>

      <div style={{ marginBottom: '1.5rem' }}>
        <label className="brutal-label">Periodo</label>
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

      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Totali (periodo)</h2>
        <div className="grid grid-4">
          <div className="brutal-card">
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Chiamate</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{totals.count}</div>
          </div>
          <div className="brutal-card">
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Token input</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{totals.input_tokens.toLocaleString()}</div>
          </div>
          <div className="brutal-card">
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Token output</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{totals.output_tokens.toLocaleString()}</div>
          </div>
          <div className="brutal-card">
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Costo stimato (USD)</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>${totals.cost_usd.toFixed(3)}</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Tariffe dipendenti dal modello (vedi AI models & pricing).</p>
          </div>
        </div>
      </section>

      {by_action.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 className="section-title">Per tipo azione</h2>
          <div className="brutal-table-wrap">
            <table className="brutal-table">
              <thead>
                <tr>
                  <th scope="col">Azione</th>
                  <th style={{ textAlign: 'right' }}>Chiamate</th>
                  <th style={{ textAlign: 'right' }}>Token in</th>
                  <th style={{ textAlign: 'right' }}>Token out</th>
                  <th style={{ textAlign: 'right' }}>Costo USD</th>
                </tr>
              </thead>
              <tbody>
                {by_action.map((a) => (
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
        </section>
      )}

      {by_size_band.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 className="section-title">DS Audit per size band</h2>
          <div className="brutal-table-wrap">
            <table className="brutal-table">
              <thead>
                <tr>
                  <th scope="col">Band</th>
                  <th style={{ textAlign: 'right' }}>Chiamate</th>
                  <th style={{ textAlign: 'right' }}>Token in</th>
                  <th style={{ textAlign: 'right' }}>Token out</th>
                  <th style={{ textAlign: 'right' }}>Costo USD</th>
                </tr>
              </thead>
              <tbody>
                {by_size_band.map((b) => (
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
        </section>
      )}

      {by_day.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 className="section-title">Per giorno</h2>
          <div className="brutal-table-wrap">
            <table className="brutal-table" style={{ minWidth: 320 }}>
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th style={{ textAlign: 'right' }}>Chiamate</th>
                  <th style={{ textAlign: 'right' }}>Token in</th>
                  <th style={{ textAlign: 'right' }}>Token out</th>
                  <th style={{ textAlign: 'right' }}>Costo USD</th>
                </tr>
              </thead>
              <tbody>
                {[...by_day].reverse().map((d) => (
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
        </section>
      )}

      {totals.count === 0 && (
        <p style={{ color: 'var(--muted)' }}>
          Nessun dato nel periodo. La tabella <code>kimi_usage_log</code> viene popolata a ogni azione AI tracciata dal backend dopo il deploy con lo schema aggiornato.
        </p>
      )}
    </>
  );
}
