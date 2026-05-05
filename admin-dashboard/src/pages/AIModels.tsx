import { useEffect, useMemo, useState } from 'react';
import { fetchGenerateABStats, type GenerateABStatsResponse } from '../api';
import PageHeader from '../components/PageHeader';
import { CORE_MODELS, estimateCostUsd, getModelPricing } from '../lib/aiPricing';

type Row = {
  model: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  source_label: string;
};

export default function AIModels() {
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abStats, setAbStats] = useState<GenerateABStatsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchGenerateABStats(period)
      .then((r) => {
        if (!cancelled) setAbStats(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Errore caricamento analytics modelli');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const modelRows = useMemo<Row[]>(() => {
    const rows = abStats?.by_kimi_model ?? [];
    return rows.map((r) => {
      const pricing = getModelPricing(r.kimi_model);
      const estimated =
        pricing != null ? estimateCostUsd(r.input_tokens, r.output_tokens, pricing) : 0;
      return {
        model: r.kimi_model,
        calls: r.count ?? 0,
        input_tokens: r.input_tokens ?? 0,
        output_tokens: r.output_tokens ?? 0,
        estimated_cost_usd: Math.round(estimated * 1000) / 1000,
        source_label: pricing?.sourceLabel ?? 'Tariffa non mappata',
      };
    });
  }, [abStats]);

  return (
    <>
      <PageHeader title="AI models & pricing" />
      <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Generate e le nuove pipeline sono monitorate in ottica Qwen-first. I prezzi vengono
        normalizzati con i riferimenti ufficiali Alibaba Model Studio e usati per stime costo
        per modello.
      </p>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 className="section-title">Modelli core in produzione</h2>
        <div className="grid grid-2">
          {CORE_MODELS.map((m) => (
            <div key={m.modelId} className="brutal-card">
              <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>
                <span className="mono">{m.modelId}</span>
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem' }}>
                Provider: <strong>{m.provider.toUpperCase()}</strong>
              </p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem' }}>
                Input: <strong>${m.inputPer1MUsd}/1M</strong> · Output:{' '}
                <strong>${m.outputPer1MUsd}/1M</strong>
              </p>
              {m.note ? (
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
                  {m.note}
                </p>
              ) : null}
              <a href={m.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem' }}>
                Fonte: {m.sourceLabel} ↗
              </a>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            Generate usage per modello
          </h2>
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

        {loading ? (
          <p className="loading">Caricamento…</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : modelRows.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>Nessuna chiamata Generate nel periodo selezionato.</p>
        ) : (
          <div className="brutal-table-wrap">
            <table className="brutal-table">
              <thead>
                <tr>
                  <th scope="col">Modello</th>
                  <th style={{ textAlign: 'right' }}>Call</th>
                  <th style={{ textAlign: 'right' }}>Token in</th>
                  <th style={{ textAlign: 'right' }}>Token out</th>
                  <th style={{ textAlign: 'right' }}>Stima costo USD</th>
                  <th scope="col">Pricing source</th>
                </tr>
              </thead>
              <tbody>
                {modelRows.map((r) => (
                  <tr key={r.model}>
                    <td className="mono">{r.model}</td>
                    <td style={{ textAlign: 'right' }}>{r.calls}</td>
                    <td style={{ textAlign: 'right' }}>{r.input_tokens.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>{r.output_tokens.toLocaleString()}</td>
                    <td style={{ textAlign: 'right' }}>${r.estimated_cost_usd.toFixed(3)}</td>
                    <td>{r.source_label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
