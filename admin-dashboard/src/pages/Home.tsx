import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchStats, fetchCreditsTimeline, type AdminStats, type CreditsTimeline } from '../api';

function LineChart({
  timeline,
  valueKey,
  color,
  label,
}: {
  timeline: { date: string; scans: number; credits: number }[];
  valueKey: 'scans' | 'credits';
  color: string;
  label: string;
}) {
  const data = [...timeline].reverse();
  const values = data.map((d) => d[valueKey]);
  const max = Math.max(...values, 1);
  const w = 600;
  const h = 160;
  const pad = { top: 20, right: 20, bottom: 28, left: 40 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;

  const points = values.map((v, i) => {
    const x = pad.left + (i / (data.length - 1 || 1)) * innerW;
    const y = pad.top + innerH - (v / max) * innerH;
    return `${x},${y}`;
  });
  const pathD = points.length ? `M ${points.join(' L ')}` : '';

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const hover = hoverIdx != null ? data[hoverIdx] : null;

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: '100%', height: 'auto' }}>
        <rect x={pad.left} y={pad.top} width={innerW} height={innerH} fill="transparent" />
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ vectorEffect: 'non-scaling-stroke' }}
        />
        {data.map((d, i) => {
          const x = pad.left + (i / (data.length - 1 || 1)) * innerW;
          const y = pad.top + innerH - (d[valueKey] / max) * innerH;
          return (
            <rect
              key={d.date}
              x={x - 8}
              y={pad.top}
              width={16}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          );
        })}
        {data.map((d, i) => {
          const x = pad.left + (i / (data.length - 1 || 1)) * innerW;
          const y = pad.top + innerH - (d[valueKey] / max) * innerH;
          return (
            <circle
              key={d.date}
              cx={x}
              cy={y}
              r={4}
              fill={color}
              stroke="var(--black)"
              strokeWidth={2}
            />
          );
        })}
        {data.map((d, i) => (
          <text
            key={d.date}
            x={pad.left + (i / (data.length - 1 || 1)) * innerW}
            y={h - 6}
            textAnchor="middle"
            fontSize="9"
            fill="var(--black)"
            fontFamily="var(--font-mono)"
          >
            {new Date(d.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
          </text>
        ))}
      </svg>
      {hover && (
        <div
          className="brutal-card"
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '100%',
            transform: 'translateX(-50%) translateY(-8px)',
            marginBottom: 4,
            padding: '0.5rem 0.75rem',
            fontSize: '0.8rem',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 700 }}>{new Date(hover.date).toLocaleDateString('it-IT')}</div>
          <div>Scan: {hover.scans} · Crediti: {hover.credits}</div>
        </div>
      )}
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<AdminStats | null>(null);
  const [timeline, setTimeline] = useState<CreditsTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchStats(), fetchCreditsTimeline(30)])
      .then(([d, t]) => {
        if (!cancelled) {
          setData(d);
          setTimeline(t);
        }
      })
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
      <h1 className="page-title">Dashboard</h1>

      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Utenti e piani</h2>
        <div className="grid grid-4">
          <div className="brutal-card accent-pink">
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>Utenti totali</h3>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{users.total}</div>
            <Link to="/users">Vedi lista →</Link>
          </div>
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
          <div className="brutal-card" style={{ marginTop: '1rem' }}>
            <h3 className="section-title" style={{ marginBottom: '0.5rem' }}>Timeline scan (30 gg)</h3>
            <LineChart timeline={timeline.timeline} valueKey="scans" color="var(--black)" label="Scan per giorno" />
            <Link to="/credits" style={{ display: 'inline-block', marginTop: '0.75rem' }}>Timeline e dettagli →</Link>
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
    </>
  );
}
