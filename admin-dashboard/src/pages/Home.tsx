import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchStats, fetchCreditsTimeline, type AdminStats, type CreditsTimeline } from '../api';
import DualLineChart from '../components/DualLineChart';
import { PLACEHOLDER_WEEKLY_UPDATES, type UpdateCategory } from '../data/weeklyUpdates';

const WEEKLY_UPDATES_PREVIEW = 3;
const CATEGORY_BADGE_STYLE: Record<UpdateCategory, { bg: string }> = {
  FEAT: { bg: 'var(--yellow)' },
  FIX: { bg: 'var(--pink)' },
  DOCS: { bg: 'var(--white)' },
  CHORE: { bg: 'var(--muted)' },
  REFACTOR: { bg: 'var(--yellow)' },
  SECURITY: { bg: 'var(--alert)' },
  STYLE: { bg: 'var(--white)' },
};

export default function Home() {
  const [data, setData] = useState<AdminStats | null>(null);
  const [timeline, setTimeline] = useState<CreditsTimeline | null>(null);
  const [chartPeriod, setChartPeriod] = useState(30);
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

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    fetchCreditsTimeline(chartPeriod)
      .then((t) => { if (!cancelled) setTimeline(t); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [chartPeriod, data]);

  if (loading && !data) return <p className="loading">Caricamento…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data) return null;

  const { users, credits, kimi, affiliates, funnel } = data;
  const recentUpdates = PLACEHOLDER_WEEKLY_UPDATES.slice(0, WEEKLY_UPDATES_PREVIEW);

  return (
    <>
      <h1 className="page-title">Dashboard</h1>

      {/* Utenti e piani — KPI con link */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Utenti e piani</h2>
        <div className="grid grid-4">
          <Link to="/users" className="brutal-card accent-pink" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Utenti totali</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{users.total}</div>
            <span style={{ fontSize: '0.85rem' }}>Vedi lista →</span>
          </Link>
          <div className="brutal-card">
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>FREE</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{users.by_plan.FREE ?? 0}</div>
          </div>
          <div className="brutal-card accent-black">
            <h3 className="section-title" style={{ marginBottom: '0.25rem', color: 'var(--white)' }}>PRO</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{users.by_plan.PRO ?? 0}</div>
            {users.pro_by_variant.length > 0 && (
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', opacity: 0.9 }}>
                {users.pro_by_variant.map((v) => `${v.label}: ${v.count}`).join(' · ')}
              </p>
            )}
          </div>
          <div className="brutal-card">
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Signup (30 gg)</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{users.signups_30d}</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              Oggi: {users.signups_today} · 7d: {users.signups_7d}
            </p>
          </div>
        </div>
        {users.pro_expiring_7d > 0 && (
          <p style={{ marginTop: '0.5rem', color: 'var(--pink)', fontWeight: 700 }}>
            ⏱ {users.pro_expiring_7d} PRO in scadenza nei prossimi 7 giorni
          </p>
        )}
      </section>

      {/* Crediti e scan — un solo blocco: KPI + grafico dual-line + consumo per tipo + link */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Crediti e scan (DS Audit)</h2>
        <div className="grid grid-4">
          <div className="brutal-card">
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Scan oggi</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{credits.scans_today}</div>
          </div>
          <div className="brutal-card">
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Scan (7d)</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{credits.scans_7d}</div>
          </div>
          <div className="brutal-card">
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Scan (30d)</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{credits.scans_30d}</div>
          </div>
          <div className="brutal-card">
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Crediti consumati (30d)</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{credits.credits_consumed_30d}</div>
          </div>
        </div>

        {timeline?.timeline?.length ? (
          <div style={{ marginTop: '1rem' }}>
            <DualLineChart
              timeline={timeline.timeline}
              period={chartPeriod}
              onPeriodChange={setChartPeriod}
            />
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
              Passa il mouse su un punto per il dettaglio; il link porta alla pagina Crediti e costi.
            </p>
            <Link to="/credits" style={{ display: 'inline-block', marginTop: '0.5rem' }}>Timeline e dettagli →</Link>
          </div>
        ) : null}

        {credits.by_action_type.length > 0 && (
          <div className="brutal-card" style={{ marginTop: '1rem' }}>
            <h3 className="section-title" style={{ marginBottom: '0.5rem' }}>Consumo per tipo azione (30d)</h3>
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

      {/* Costi Kimi */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Costi Kimi (stima DS Audit)</h2>
        <div className="grid grid-3">
          <div className={`brutal-card ${kimi.cost_alert ? 'alert' : ''}`}>
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Costo (30d)</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>${kimi.cost_30d_usd.toFixed(2)}</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              {kimi.token_usage_30d
                ? `Reale da token: ${kimi.token_usage_30d.calls} chiamate`
                : `~${kimi.cost_per_scan_usd}/scan (stima)`}
            </p>
            <Link to="/token-usage">Dettaglio token →</Link>
          </div>
          <div className="brutal-card">
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Cassa minima suggerita (30 gg)</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>${kimi.suggested_buffer_30d_usd.toFixed(2)}</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Soglia alert: ${kimi.alert_threshold_usd}</p>
          </div>
          <div className="brutal-card">
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Stato</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: kimi.cost_alert ? 'var(--alert)' : 'var(--ok)' }}>
              {kimi.cost_alert ? '⚠ Verifica saldo Kimi' : 'Ok'}
            </div>
          </div>
        </div>
      </section>

      {/* Funnel + Affiliati */}
      <div className="grid grid-2" style={{ marginBottom: '2rem' }}>
        <section>
          <h2 className="section-title">Funnel (30d)</h2>
          <div className="brutal-card">
            <p style={{ margin: '0.25rem 0' }}>Signup: <strong>{funnel.signups_30d}</strong></p>
            <p style={{ margin: '0.25rem 0' }}>FREE attivi: <strong>{funnel.free_active}</strong></p>
            <p style={{ margin: '0.25rem 0' }}>PRO: <strong>{funnel.pro}</strong></p>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: 'var(--muted)' }}>
              Conversione FREE→PRO: {funnel.conversion_free_to_pro_pct}%
            </p>
            <Link to="/users">Vedi utenti →</Link>
          </div>
        </section>
        <section>
          <h2 className="section-title">Affiliati</h2>
          <div className="brutal-card">
            <p style={{ margin: '0.25rem 0' }}>Affiliati totali: <strong>{affiliates.total}</strong></p>
            <p style={{ margin: '0.25rem 0' }}>Referral totali: <strong>{affiliates.referrals_total}</strong></p>
            <Link to="/affiliates">Vedi lista →</Link>
          </div>
        </section>
      </div>

      {/* Weekly Updates — richiamo come concept originale, con CTA */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Weekly Updates</h2>
        <div className="brutal-card">
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
            Ultimi aggiornamenti in linguaggio semplice (derivati dai commit).
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {recentUpdates.map((u) => (
              <li
                key={u.id}
                style={{
                  padding: '0.5rem 0',
                  borderBottom: '2px solid var(--black)',
                }}
              >
                <span
                  className="badge"
                  style={{
                    marginRight: '0.5rem',
                    background: CATEGORY_BADGE_STYLE[u.category].bg,
                    border: '2px solid var(--black)',
                    fontSize: '0.65rem',
                  }}
                >
                  {u.category}
                </span>
                <strong>{u.title}</strong>
                <span style={{ color: 'var(--muted)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                  {new Date(u.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                </span>
              </li>
            ))}
          </ul>
          <Link to="/weekly-updates" className="brutal-btn primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
            Tutti gli aggiornamenti →
          </Link>
          <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
            <Link to="/support">Support</Link>
            {' · '}
            <Link to="/security">Security & Logs</Link>
          </p>
        </div>
      </section>
    </>
  );
}
