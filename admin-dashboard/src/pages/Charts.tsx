import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchStats, fetchCreditsTimeline, type AdminStats, type CreditsTimeline } from '../api';
import DualLineChart from '../components/DualLineChart';

export default function Charts() {
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

  return (
    <>
      <h1 className="page-title">Visione a grafico</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        KPI e timeline con collegamenti alle pagine di dettaglio.
      </p>

      {stats && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 className="section-title">KPI — Clicca per il dettaglio</h2>
          <div className="grid grid-4">
            <Link to="/users" className="brutal-card accent-pink" style={{ textDecoration: 'none', color: 'inherit' }}>
              <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Utenti totali</h3>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.users.total}</div>
              <span style={{ fontSize: '0.85rem' }}>Vedi utenti →</span>
            </Link>
            <Link to="/credits" className="brutal-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Scan (30d)</h3>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.credits.scans_30d}</div>
              <span style={{ fontSize: '0.85rem' }}>Crediti e costi →</span>
            </Link>
            <Link to="/token-usage" className="brutal-card accent-black" style={{ textDecoration: 'none', color: 'inherit' }}>
              <h3 className="section-title" style={{ marginBottom: '0.25rem', color: 'var(--white)' }}>Costo Kimi (30d)</h3>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>${stats.kimi.cost_30d_usd.toFixed(2)}</div>
              <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>Token Kimi →</span>
            </Link>
            <Link to="/affiliates" className="brutal-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Affiliati</h3>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.affiliates.total}</div>
              <span style={{ fontSize: '0.85rem' }}>Referral: {stats.affiliates.referrals_total} →</span>
            </Link>
          </div>
        </section>
      )}

      {timeline?.timeline?.length ? (
        <section style={{ marginBottom: '2rem' }}>
          <DualLineChart
            timeline={timeline.timeline}
            period={period}
            onPeriodChange={setPeriod}
          />
          <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
            Passa il mouse su un punto per il dettaglio; il link porta alla pagina Crediti e costi.
          </p>
        </section>
      ) : (
        <div className="brutal-card">
          <p className="loading">Nessun dato timeline per il periodo. Vai a <Link to="/credits">Crediti e costi</Link> per i dettagli.</p>
        </div>
      )}

      {stats && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 className="section-title">Funnel (30d)</h2>
          <div className="grid grid-2">
            <div className="brutal-card">
              <p style={{ margin: '0.25rem 0' }}>Signup: <strong>{stats.funnel.signups_30d}</strong></p>
              <p style={{ margin: '0.25rem 0' }}>FREE attivi: <strong>{stats.funnel.free_active}</strong></p>
              <p style={{ margin: '0.25rem 0' }}>PRO: <strong>{stats.funnel.pro}</strong></p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: 'var(--muted)' }}>
                Conversione FREE→PRO: {stats.funnel.conversion_free_to_pro_pct}%
              </p>
              <Link to="/users">Vedi utenti →</Link>
            </div>
            <div className="brutal-card">
              <p style={{ margin: '0.25rem 0' }}>Crediti consumati (30d): <strong>{stats.credits.credits_consumed_30d}</strong></p>
              <p style={{ margin: '0.25rem 0' }}>PRO in scadenza (7d): <strong>{stats.users.pro_expiring_7d}</strong></p>
              <Link to="/credits">Crediti e costi →</Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
