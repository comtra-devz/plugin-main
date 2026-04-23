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
  const hasLegacyS =
    (data?.by_variant?.some((v) => v.variant === 'S') ?? false) ||
    (data?.timeline || []).some((d) => (d.S?.count ?? 0) > 0);

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
        <h2 className="section-title">Performance per braccio A/B (50/50)</h2>
        <p style={{ color: 'var(--muted)', marginTop: '-0.5rem', marginBottom: '1rem', maxWidth: 720 }}>
          Arm A e B sono assegnati a caso per richiesta (variante nel DB). Il modello Moonshot effettivo è definito da{' '}
          <code>KIMI_GENERATE_MODEL_A</code> / <code>KIMI_GENERATE_MODEL_B</code> (o <code>KIMI_MODEL</code> come fallback).
        </p>
        <div className="grid grid-2">
          <div className="brutal-card">
            <h3 className="section-title" style={{ marginBottom: '0.5rem' }}>Arm A — modello primario</h3>
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
            <h3 className="section-title" style={{ marginBottom: '0.5rem' }}>Arm B — modello alternativo</h3>
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

      {data?.by_kimi_model?.length ? (
        <section style={{ marginBottom: '2rem' }}>
          <h2 className="section-title">Aggregato per slug modello Kimi</h2>
          <div className="brutal-card">
            <div className="brutal-table-wrap">
              <table className="brutal-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Modello (kimi_model)</th>
                    <th>Richieste</th>
                    <th>Token in</th>
                    <th>Token out</th>
                    <th>Crediti</th>
                    <th>Latency media</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_kimi_model.map((row) => (
                    <tr key={row.kimi_model}>
                      <td><code style={{ fontSize: '0.85rem' }}>{row.kimi_model}</code></td>
                      <td>{row.count}</td>
                      <td>{row.input_tokens.toLocaleString()}</td>
                      <td>{row.output_tokens.toLocaleString()}</td>
                      <td>{row.credits_consumed}</td>
                      <td>{row.avg_latency_ms ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}

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
                  {hasLegacyS ? (
                    <span style={{ color: 'var(--muted)' }}>
                      S (legacy): {d.S?.count ?? 0} req, {d.S?.credits ?? 0} cr
                    </span>
                  ) : null}
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
                  <th>Arm</th>
                  <th>Modello</th>
                  <th>Percorso</th>
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
                    <td>{r.kimi_model ? <code style={{ fontSize: '0.8rem' }}>{r.kimi_model}</code> : '—'}</td>
                    <td>{r.generation_route ? <code style={{ fontSize: '0.75rem' }}>{r.generation_route}</code> : '—'}</td>
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
