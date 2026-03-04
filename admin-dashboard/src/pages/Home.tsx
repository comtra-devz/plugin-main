import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchStats, type AdminStats } from '../api';

export default function Home() {
  const [data, setData] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchStats()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="loading">Caricamento…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data) return null;

  const { users, credits, kimi, affiliates, funnel } = data;

  return (
    <>
      <h1 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Dashboard Admin</h1>

      {/* Utenti e piani */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Utenti e piani</h2>
        <div className="grid grid-4">
          <div className="card">
            <h3>Utenti totali</h3>
            <div className="value">{users.total}</div>
            <Link to="/users">Vedi lista →</Link>
          </div>
          <div className="card">
            <h3>FREE</h3>
            <div className="value">{users.by_plan.FREE ?? 0}</div>
          </div>
          <div className="card">
            <h3>PRO</h3>
            <div className="value">{users.by_plan.PRO ?? 0}</div>
            {users.pro_by_variant.length > 0 && (
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
                {users.pro_by_variant.map((v) => `${v.label}: ${v.count}`).join(' · ')}
              </p>
            )}
          </div>
          <div className="card">
            <h3>Signup (30 gg)</h3>
            <div className="value">{users.signups_30d}</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              Oggi: {users.signups_today} · 7d: {users.signups_7d}
            </p>
          </div>
        </div>
        {users.pro_expiring_7d > 0 && (
          <p style={{ marginTop: '0.5rem', color: 'var(--accent)' }}>
            ⏱ {users.pro_expiring_7d} PRO in scadenza nei prossimi 7 giorni
          </p>
        )}
      </section>

      {/* Crediti e scan */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Crediti e scan (DS Audit)</h2>
        <div className="grid grid-4">
          <div className="card">
            <h3>Scan oggi</h3>
            <div className="value">{credits.scans_today}</div>
          </div>
          <div className="card">
            <h3>Scan (7d)</h3>
            <div className="value">{credits.scans_7d}</div>
          </div>
          <div className="card">
            <h3>Scan (30d)</h3>
            <div className="value">{credits.scans_30d}</div>
          </div>
          <div className="card">
            <h3>Crediti consumati (30d)</h3>
            <div className="value">{credits.credits_consumed_30d}</div>
          </div>
        </div>
        {credits.by_action_type.length > 0 && (
          <div className="card" style={{ marginTop: '1rem' }}>
            <h3>Consumo per tipo azione (30d)</h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {credits.by_action_type.map((a) => (
                <li key={a.action_type}>
                  <span className="mono">{a.action_type}</span>: {a.count} richieste, {a.credits} crediti
                </li>
              ))}
            </ul>
            <Link to="/credits">Timeline e dettagli →</Link>
          </div>
        )}
      </section>

      {/* Kimi costi e cassa */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Costi Kimi (stima DS Audit)</h2>
        <div className="grid grid-3">
          <div className={`card ${kimi.cost_alert ? 'alert' : ''}`}>
            <h3>Costo (30d)</h3>
            <div className="value">${kimi.cost_30d_usd.toFixed(2)}</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              {kimi.token_usage_30d
                ? `Reale da token: ${kimi.token_usage_30d.calls} chiamate`
                : `~${kimi.cost_per_scan_usd}/scan (stima)`}
            </p>
            <Link to="/token-usage">Dettaglio token →</Link>
          </div>
          <div className="card">
            <h3>Cassa minima suggerita (30 gg)</h3>
            <div className="value">${kimi.suggested_buffer_30d_usd.toFixed(2)}</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              Soglia alert: ${kimi.alert_threshold_usd}
            </p>
          </div>
          <div className="card">
            <h3>Stato</h3>
            <div className="value" style={{ color: kimi.cost_alert ? 'var(--alert)' : 'var(--ok)' }}>
              {kimi.cost_alert ? '⚠ Verifica saldo Kimi' : 'Ok'}
            </div>
          </div>
        </div>
      </section>

      {/* Funnel e affiliati */}
      <div className="grid grid-2" style={{ marginBottom: '2rem' }}>
        <section>
          <h2 className="section-title">Funnel (30d)</h2>
          <div className="card">
            <p style={{ margin: '0.25rem 0' }}>Signup: <strong>{funnel.signups_30d}</strong></p>
            <p style={{ margin: '0.25rem 0' }}>FREE attivi: <strong>{funnel.free_active}</strong></p>
            <p style={{ margin: '0.25rem 0' }}>PRO: <strong>{funnel.pro}</strong></p>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: 'var(--muted)' }}>
              Conversione FREE→PRO: {funnel.conversion_free_to_pro_pct}%
            </p>
          </div>
        </section>
        <section>
          <h2 className="section-title">Affiliati</h2>
          <div className="card">
            <p style={{ margin: '0.25rem 0' }}>Affiliati totali: <strong>{affiliates.total}</strong></p>
            <p style={{ margin: '0.25rem 0' }}>Referral totali: <strong>{affiliates.referrals_total}</strong></p>
            <Link to="/affiliates">Vedi lista →</Link>
          </div>
        </section>
      </div>
    </>
  );
}
