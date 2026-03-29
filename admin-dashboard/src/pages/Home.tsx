import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchStats, fetchCreditsTimeline, fetchWeeklyUpdates, fetchFunctionExecutions, fetchThrottleEvents, fetchDiscountsStats, type AdminStats, type CreditsTimeline, type WeeklyUpdateItem, type FunctionExecution, type ThrottleEventsResponse, type DiscountsStats } from '../api';
import DualLineChart from '../components/DualLineChart';
import HealthBadge from '../components/HealthBadge';
import NotificationsBell from '../components/NotificationsBell';
import { type UpdateCategory } from '../data/weeklyUpdates';

const WEEKLY_UPDATES_PREVIEW = 3;
const CATEGORY_BADGE_STYLE: Record<string, { bg: string }> = {
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
  const [weeklyUpdates, setWeeklyUpdates] = useState<WeeklyUpdateItem[]>([]);
  const [recentExecutions, setRecentExecutions] = useState<FunctionExecution[]>([]);
  const [throttleEvents, setThrottleEvents] = useState<ThrottleEventsResponse | null>(null);
  const [discountsStats, setDiscountsStats] = useState<DiscountsStats | null>(null);
  const [chartPeriod, setChartPeriod] = useState(30);
  /** Filtro piano per il grafico timeline (scan/crediti per giorno). Kimi resta globale solo con “Tutti”. */
  const [timelinePlan, setTimelinePlan] = useState<'' | 'PRO' | 'FREE'>('');
  const [loading, setLoading] = useState(true);
  const [errorStats, setErrorStats] = useState<string | null>(null);
  const [errorTimeline, setErrorTimeline] = useState<string | null>(null);
  const [errorWeeklyUpdates, setErrorWeeklyUpdates] = useState<string | null>(null);
  const [errorExecutions, setErrorExecutions] = useState<string | null>(null);
  const [errorThrottle, setErrorThrottle] = useState<string | null>(null);
  const [errorDiscounts, setErrorDiscounts] = useState<string | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [loadingWeeklyUpdates, setLoadingWeeklyUpdates] = useState(true);
  const [loadingExecutions, setLoadingExecutions] = useState(true);
  const [loadingThrottle, setLoadingThrottle] = useState(true);
  const [loadingDiscounts, setLoadingDiscounts] = useState(true);

  const loadStats = () => {
    setErrorStats(null);
    setLoading(true);
    fetchStats()
      .then((d) => { setData(d); setErrorStats(null); })
      .catch((e) => setErrorStats(e.message || 'Errore di caricamento'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStats();
  }, []);

  const loadTimeline = () => {
    setErrorTimeline(null);
    setLoadingTimeline(true);
    fetchCreditsTimeline(chartPeriod, timelinePlan || undefined)
      .then((t) => setTimeline(t))
      .catch((e) => setErrorTimeline(e.message || 'Errore timeline'))
      .finally(() => setLoadingTimeline(false));
  };

  // In parallelo con le stats: prima la timeline partiva solo dopo fetchStats (sequenziale → lentezza + grafico in attesa).
  useEffect(() => {
    let cancelled = false;
    setErrorTimeline(null);
    setLoadingTimeline(true);
    fetchCreditsTimeline(chartPeriod, timelinePlan || undefined)
      .then((t) => { if (!cancelled) setTimeline(t); })
      .catch((e) => { if (!cancelled) setErrorTimeline(e.message || 'Errore timeline'); })
      .finally(() => { if (!cancelled) setLoadingTimeline(false); });
    return () => { cancelled = true; };
  }, [chartPeriod, timelinePlan]);

  const loadWeeklyUpdates = () => {
    setErrorWeeklyUpdates(null);
    setLoadingWeeklyUpdates(true);
    fetchWeeklyUpdates(20)
      .then((r) => { setWeeklyUpdates(r.updates?.length ? r.updates : []); setErrorWeeklyUpdates(null); })
      .catch((e) => setErrorWeeklyUpdates(e.message || 'Errore caricamento aggiornamenti'))
      .finally(() => setLoadingWeeklyUpdates(false));
  };
  useEffect(() => {
    loadWeeklyUpdates();
  }, []);

  const loadExecutions = () => {
    setErrorExecutions(null);
    setLoadingExecutions(true);
    fetchFunctionExecutions(10, 0)
      .then((r) => { setRecentExecutions(r.executions?.length ? r.executions : []); setErrorExecutions(null); })
      .catch((e) => setErrorExecutions(e.message || 'Errore caricamento esecuzioni'))
      .finally(() => setLoadingExecutions(false));
  };
  useEffect(() => {
    loadExecutions();
  }, []);

  const loadThrottle = () => {
    setErrorThrottle(null);
    setLoadingThrottle(true);
    fetchThrottleEvents()
      .then((t) => { setThrottleEvents(t); setErrorThrottle(null); })
      .catch((e) => setErrorThrottle(e.message || 'Errore caricamento throttle'))
      .finally(() => setLoadingThrottle(false));
  };
  useEffect(() => {
    loadThrottle();
  }, []);

  const loadDiscounts = () => {
    setErrorDiscounts(null);
    setLoadingDiscounts(true);
    fetchDiscountsStats()
      .then((d) => { setDiscountsStats(d); setErrorDiscounts(null); })
      .catch((e) => setErrorDiscounts(e.message || 'Errore caricamento sconti'))
      .finally(() => setLoadingDiscounts(false));
  };
  useEffect(() => {
    loadDiscounts();
  }, []);

  if (loading && !data && !errorStats) return <p className="loading">Caricamento…</p>;
  if (errorStats && !data) {
    return (
      <div className="brutal-card" style={{ maxWidth: 400 }}>
        <p className="error" style={{ marginTop: 0 }}>{errorStats}</p>
        <button type="button" className="brutal-btn primary" onClick={loadStats}>
          Riprova
        </button>
      </div>
    );
  }
  if (!data) return null;

  const { users, credits, kimi, affiliates, funnel } = data;
  const recentUpdates = weeklyUpdates.slice(0, WEEKLY_UPDATES_PREVIEW);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <HealthBadge />
          <NotificationsBell />
        </div>
      </div>

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
                {users.pro_by_variant
                  .map((v) => {
                    const plan =
                      v.label === '1w' ? `${v.label} (${v.credits_total} cr)` : v.label;
                    return `${plan}: ${v.count}`;
                  })
                  .join(' · ')}
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

      {/* Crediti e consumo — KPI + grafico + consumo per tipo azione (tutte le funzioni), una sola CTA */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Crediti e consumo</h2>
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
        <div className="grid grid-2" style={{ marginTop: '0.75rem' }}>
          <div className="brutal-card accent-black">
            <h3 className="section-title" style={{ marginBottom: '0.25rem', color: 'var(--white)' }}>Consumi PRO (30d)</h3>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--white)' }}>
              {credits.credits_consumed_30d_pro ?? 0}
            </div>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', opacity: 0.9, color: 'var(--white)' }}>
              Crediti consumati da utenti con piano PRO (oggi in DB).
            </p>
          </div>
          <div className="brutal-card">
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Consumi FREE (30d)</h3>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{credits.credits_consumed_30d_free ?? 0}</div>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
              Crediti consumati da utenti FREE.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Grafico per piano:</span>
          {(['', 'PRO', 'FREE'] as const).map((p) => (
            <button
              key={p || 'all'}
              type="button"
              className={`brutal-btn ${timelinePlan === p ? 'primary' : ''}`}
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
              onClick={() => setTimelinePlan(p)}
            >
              {p === '' ? 'Tutti' : p}
            </button>
          ))}
        </div>

        {loadingTimeline ? (
          <p style={{ marginTop: '1rem', color: 'var(--muted)' }}>Caricamento grafico…</p>
        ) : errorTimeline ? (
          <div className="brutal-card" style={{ marginTop: '1rem' }}>
            <p className="error" style={{ marginTop: 0 }}>{errorTimeline}</p>
            <button type="button" className="brutal-btn" onClick={loadTimeline}>
              Riprova
            </button>
          </div>
        ) : timeline?.timeline?.length ? (
          <div style={{ marginTop: '1rem' }}>
            <DualLineChart
              timeline={timeline.timeline}
              period={chartPeriod}
              onPeriodChange={setChartPeriod}
              byActionPerDay={timeline.by_action_per_day}
              planNote={timeline.kimi_note ?? null}
            />
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
              Passa il mouse su un punto per il dettaglio.
            </p>
          </div>
        ) : timeline ? (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ color: 'var(--muted)', marginBottom: timeline.kimi_note ? '0.5rem' : 0 }}>
              Nessun punto nel grafico per il periodo selezionato (nessuna transazione in quel range o timeline degradata lato server).
            </p>
            {timeline.kimi_note ? (
              <p
                role="status"
                style={{
                  margin: 0,
                  padding: '0.65rem 0.75rem',
                  fontSize: '0.85rem',
                  border: '2px solid var(--black)',
                  background: 'var(--yellow)',
                }}
              >
                {timeline.kimi_note}
              </p>
            ) : null}
          </div>
        ) : null}

        {credits.by_action_type.length > 0 && (
          <div className="brutal-card" style={{ marginTop: '1rem' }}>
            <h3 className="section-title" style={{ marginBottom: '0.5rem' }}>Consumo per tipo azione (30d)</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Tutte le funzioni che consumano crediti (audit, a11y_audit, generate, sync, …).</p>
            <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {credits.by_action_type.map((a) => (
                <li key={a.action_type}>
                  <span className="mono">{a.action_type}</span>: {a.count} richieste, {a.credits} crediti
                </li>
              ))}
            </ul>
            <Link to="/credits" style={{ display: 'inline-block', marginTop: '0.75rem', fontWeight: 700 }}>Timeline e dettagli →</Link>
          </div>
        )}
      </section>

      {/* Costi Kimi — cumulativi (tutte le funzioni); dettaglio per funzione in Crediti e costi */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Costi Kimi</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>Costo cumulativo (tutte le chiamate Kimi). Dettaglio per funzione e per size nella pagina Crediti e costi.</p>
        <div className="grid grid-3">
          <div className={`brutal-card ${kimi.cost_alert ? 'alert' : ''}`}>
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Costo (30d)</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>${kimi.cost_30d_usd.toFixed(2)}</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              {kimi.token_usage_30d
                ? `${kimi.token_usage_30d.calls} chiamate (da token)`
                : `Stima da scan: ~${kimi.cost_per_scan_usd}/scan`}
            </p>
            <Link to="/credits">Crediti e costi (timeline, Kimi per funzione) →</Link>
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
        <section>
          <h2 className="section-title">Codici sconto</h2>
          {loadingDiscounts ? (
            <div className="brutal-card">
              <p style={{ color: 'var(--muted)' }}>Caricamento sconti…</p>
            </div>
          ) : (
            <>
              {errorDiscounts && (
                <div className="brutal-card" style={{ marginBottom: '0.5rem' }}>
                  <p className="error" style={{ marginTop: 0 }}>{errorDiscounts}</p>
                  <button type="button" className="brutal-btn" onClick={loadDiscounts}>Riprova</button>
                </div>
              )}
              <Link to="/discounts" className="brutal-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <p style={{ margin: '0.25rem 0' }}>
              <strong>Livello (gamification):</strong> {discountsStats?.level?.total ?? '—'} totali
              {discountsStats?.level?.by_level && (
                <span style={{ fontSize: '0.9rem', color: 'var(--muted)', marginLeft: '0.5rem' }}>
                  (5%: {discountsStats.level.by_level[5]} · 10%: {discountsStats.level.by_level[10]} · 15%: {discountsStats.level.by_level[15]} · 20%: {discountsStats.level.by_level[20]})
                </span>
              )}
            </p>
            <p style={{ margin: '0.25rem 0' }}>
              <strong>Throttle (5% una tantum):</strong> {discountsStats?.throttle?.total ?? '—'} totali
              {discountsStats?.throttle != null && (
                <span style={{ fontSize: '0.9rem', color: 'var(--muted)', marginLeft: '0.5rem' }}>
                  (validi: {discountsStats.throttle.valid} · scaduti: {discountsStats.throttle.expired})
                </span>
              )}
            </p>
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Dettaglio e liste →</span>
              </Link>
            </>
          )}
        </section>
      </div>

      {/* Throttle/503 — eventi segnalati dal plugin (monitoraggio anche con Vercel Pro) */}
      {(loadingThrottle || errorThrottle || (throttleEvents && throttleEvents.total > 0)) && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 className="section-title">Throttle / 503 (plugin)</h2>
          <div className="brutal-card">
            {loadingThrottle ? (
              <p style={{ color: 'var(--muted)' }}>Caricamento…</p>
            ) : (
              <>
                {errorThrottle && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <p className="error" style={{ marginTop: 0 }}>{errorThrottle}</p>
                    <button type="button" className="brutal-btn" onClick={loadThrottle}>Riprova</button>
                  </div>
                )}
                <p style={{ margin: '0.25rem 0' }}>Eventi totali: <strong>{throttleEvents?.total ?? 0}</strong></p>
            {throttleEvents?.by_day?.length > 0 && (
              <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: 'var(--muted)' }}>
                Ultimi 7 gg: {throttleEvents.by_day.slice(0, 7).reduce((s, d) => s + d.count, 0)}
              </p>
            )}
            {throttleEvents?.recent?.length > 0 && (
              <details style={{ marginTop: '0.75rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Ultimi eventi</summary>
                <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
                  {throttleEvents.recent.slice(0, 10).map((e) => (
                    <li key={e.id}>{e.user_masked} — {new Date(e.occurred_at).toLocaleString()}</li>
                  ))}
                </ul>
              </details>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* Storico utilizzo — anteprima + link approfondimento */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Storico utilizzo</h2>
        <div className="brutal-card">
          {loadingExecutions ? (
            <p style={{ color: 'var(--muted)' }}>Caricamento…</p>
          ) : (
            <>
              {errorExecutions && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <p className="error" style={{ marginTop: 0 }}>{errorExecutions}</p>
                  <button type="button" className="brutal-btn" onClick={loadExecutions}>Riprova</button>
                </div>
              )}
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
                Ultime attività (audit, scan, generate, sync…) con utente anonimizzato.
              </p>
              {recentExecutions.length > 0 ? (
            <div className="brutal-table-wrap">
              <table className="brutal-table" style={{ marginBottom: '0.75rem' }}>
                <thead>
                  <tr>
                    <th scope="col">Utente</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Crediti</th>
                    <th scope="col">Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {recentExecutions.map((e) => (
                    <tr key={e.id}>
                      <td className="mono" style={{ fontSize: '0.8rem' }}>{e.user_masked}</td>
                      <td className="mono" style={{ fontSize: '0.8rem' }}>{e.action_type}</td>
                      <td>{e.credits_consumed}</td>
                      <td style={{ fontSize: '0.8rem' }}>{new Date(e.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>Nessuna attività recente.</p>
          )}
          <Link to="/executions" className="brutal-btn primary" style={{ display: 'inline-block' }}>
                Vedi tutto e filtra per utente / tipo / periodo →
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Aggiornamenti — richiamo con CTA */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Aggiornamenti</h2>
        <div className="brutal-card">
          {loadingWeeklyUpdates ? (
            <p style={{ color: 'var(--muted)' }}>Caricamento aggiornamenti…</p>
          ) : (
            <>
              {errorWeeklyUpdates && (
                <div style={{ marginBottom: '1rem' }}>
                  <p className="error" style={{ marginTop: 0 }}>{errorWeeklyUpdates}</p>
                  <button type="button" className="brutal-btn" onClick={loadWeeklyUpdates}>Riprova</button>
                </div>
              )}
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
                Ultimi aggiornamenti in linguaggio semplice (derivati dai commit).
              </p>
              {recentUpdates.length > 0 ? (
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
                          background: (CATEGORY_BADGE_STYLE[u.category] || CATEGORY_BADGE_STYLE.CHORE).bg,
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
              ) : (
                <p style={{ fontSize: '0.9rem', color: 'var(--muted)', margin: 0 }}>
                  Nessun aggiornamento disponibile dal repository. Configura `GITHUB_REPO` su Vercel.
                </p>
              )}
          <Link to="/weekly-updates" className="brutal-btn primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
            Tutti gli aggiornamenti →
          </Link>
              <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
                <Link to="/support">Supporto</Link>
                {' · '}
                <Link to="/security">Sicurezza e log</Link>
              </p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
