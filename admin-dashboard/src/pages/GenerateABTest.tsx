import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchGenerateABStats, type GenerateABStatsResponse } from '../api';

export default function GenerateABTest() {
  const [data, setData] = useState<GenerateABStatsResponse | null>(null);
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchGenerateABStats(period)
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period]);

  if (loading && !data) return <p className="loading">Caricamento…</p>;
  if (error) return <p className="error">{error}</p>;

  const a = data?.by_variant?.find((v) => v.variant === 'A');
  const b = data?.by_variant?.find((v) => v.variant === 'B');
  const fbA = data?.feedback_by_variant?.['A'] ?? { up: 0, down: 0 };
  const fbB = data?.feedback_by_variant?.['B'] ?? { up: 0, down: 0 };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
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
        <Link to="/" className="page-back">← Dashboard</Link>
      </div>

      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Riepilogo totale</h2>
        <div className="grid grid-4">
          <div className="brutal-card">
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Richieste</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{data?.total?.count ?? 0}</div>
          </div>
          <div className="brutal-card">
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Token (input+output)</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>
              {((data?.total?.input_tokens ?? 0) + (data?.total?.output_tokens ?? 0)).toLocaleString()}
            </div>
          </div>
          <div className="brutal-card">
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Crediti consumati</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{data?.total?.credits_consumed ?? 0}</div>
          </div>
          <div className="brutal-card">
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Costo stimato (USD)</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>${(data?.total?.cost_usd ?? 0).toFixed(2)}</div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Performance per variante</h2>
        <div className="grid grid-2">
          <div className="brutal-card">
            <h3 className="section-title" style={{ marginBottom: '0.5rem' }}>Variante A (Direct)</h3>
            <dl style={{ margin: 0, fontSize: '0.9rem' }}>
              <dt style={{ fontWeight: 700, marginTop: '0.5rem' }}>Richieste</dt>
              <dd style={{ margin: 0 }}>{a?.count ?? 0}</dd>
              <dt style={{ fontWeight: 700, marginTop: '0.5rem' }}>Token input</dt>
              <dd style={{ margin: 0 }}>{(a?.input_tokens ?? 0).toLocaleString()}</dd>
              <dt style={{ fontWeight: 700, marginTop: '0.5rem' }}>Token output</dt>
              <dd style={{ margin: 0 }}>{(a?.output_tokens ?? 0).toLocaleString()}</dd>
              <dt style={{ fontWeight: 700, marginTop: '0.5rem' }}>Crediti</dt>
              <dd style={{ margin: 0 }}>{a?.credits_consumed ?? 0}</dd>
              <dt style={{ fontWeight: 700, marginTop: '0.5rem' }}>Latency media (ms)</dt>
              <dd style={{ margin: 0 }}>{a?.avg_latency_ms ?? '—'}</dd>
              <dt style={{ fontWeight: 700, marginTop: '0.5rem' }}>Feedback 👍</dt>
              <dd style={{ margin: 0 }}>{fbA.up}</dd>
              <dt style={{ fontWeight: 700, marginTop: '0.25rem' }}>Feedback 👎</dt>
              <dd style={{ margin: 0 }}>{fbA.down}</dd>
            </dl>
          </div>
          <div className="brutal-card">
            <h3 className="section-title" style={{ marginBottom: '0.5rem' }}>Variante B (ASCII wireframe)</h3>
            <dl style={{ margin: 0, fontSize: '0.9rem' }}>
              <dt style={{ fontWeight: 700, marginTop: '0.5rem' }}>Richieste</dt>
              <dd style={{ margin: 0 }}>{b?.count ?? 0}</dd>
              <dt style={{ fontWeight: 700, marginTop: '0.5rem' }}>Token input</dt>
              <dd style={{ margin: 0 }}>{(b?.input_tokens ?? 0).toLocaleString()}</dd>
              <dt style={{ fontWeight: 700, marginTop: '0.5rem' }}>Token output</dt>
              <dd style={{ margin: 0 }}>{(b?.output_tokens ?? 0).toLocaleString()}</dd>
              <dt style={{ fontWeight: 700, marginTop: '0.5rem' }}>Crediti</dt>
              <dd style={{ margin: 0 }}>{b?.credits_consumed ?? 0}</dd>
              <dt style={{ fontWeight: 700, marginTop: '0.5rem' }}>Latency media (ms)</dt>
              <dd style={{ margin: 0 }}>{b?.avg_latency_ms ?? '—'}</dd>
              <dt style={{ fontWeight: 700, marginTop: '0.5rem' }}>Feedback 👍</dt>
              <dd style={{ margin: 0 }}>{fbB.up}</dd>
              <dt style={{ fontWeight: 700, marginTop: '0.25rem' }}>Feedback 👎</dt>
              <dd style={{ margin: 0 }}>{fbB.down}</dd>
            </dl>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Timeline richieste per variante</h2>
        {data?.timeline?.length ? (
          <div className="brutal-card">
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {[...(data.timeline || [])].reverse().map((d) => (
                <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ minWidth: 100, fontWeight: 700 }}>{d.date}</span>
                  <span>A: {d.A?.count ?? 0} req, {d.A?.credits ?? 0} cr</span>
                  <span>B: {d.B?.count ?? 0} req, {d.B?.credits ?? 0} cr</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--muted)' }}>Nessun dato nel periodo selezionato.</p>
        )}
      </section>

      <section>
        <h2 className="section-title">Richieste (con feedback)</h2>
        {data?.requests_list?.length ? (
          <div className="brutal-card">
            <div className="brutal-table-wrap">
            <table className="brutal-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Utente</th>
                  <th>Variante</th>
                  <th>Token</th>
                  <th>Crediti</th>
                  <th>Latency</th>
                  <th>Feedback</th>
                  <th>Commento</th>
                </tr>
              </thead>
              <tbody>
                {data.requests_list.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.created_at).toLocaleString('it-IT')}</td>
                    <td>{r.user_masked}</td>
                    <td><strong>{r.variant}</strong></td>
                    <td>{(r.input_tokens + r.output_tokens).toLocaleString()}</td>
                    <td>{r.credits_consumed}</td>
                    <td>{r.latency_ms != null ? `${r.latency_ms} ms` : '—'}</td>
                    <td>{r.feedback_thumbs ? (r.feedback_thumbs === 'up' ? '👍' : '👎') : '—'}</td>
                    <td>{r.feedback_comment || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--muted)' }}>Nessuna richiesta nel periodo selezionato.</p>
        )}
      </section>
    </>
  );
}
