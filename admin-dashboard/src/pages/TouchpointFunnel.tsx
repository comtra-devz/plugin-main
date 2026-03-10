import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTouchpointFunnel, type TouchpointFunnelResponse, type TouchpointSourceData } from '../api';
import PageHeader from '../components/PageHeader';

const PERIOD_OPTIONS = [7, 14, 30, 90] as const;

export default function TouchpointFunnel() {
  const [data, setData] = useState<TouchpointFunnelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTouchpointFunnel(period)
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period]);

  return (
    <>
      <PageHeader
        title="Funnel touchpoint"
        actions={
          <>
            <select
              className="brutal-input"
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
              style={{ width: 'auto', marginRight: '0.5rem' }}
              aria-label="Periodo in giorni"
            >
              {PERIOD_OPTIONS.map((d) => (
                <option key={d} value={d}>Ultimi {d} giorni</option>
              ))}
            </select>
            <Link to="/brand-awareness" className="brutal-btn">← Brand awareness</Link>
          </>
        }
      />
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Ingressi e funnel da tutti i touchpoint: Landing page, Plugin Figma, Pagina LinkedIn. Dall&apos;ingresso fino all&apos;utilizzo, upgrade PRO e retention. Estendibile a Instagram e TikTok.
      </p>

      {data?.data_note && (
        <div className="brutal-card" style={{ marginBottom: '1rem', borderStyle: 'dashed', opacity: 0.9 }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>{data.data_note}</p>
        </div>
      )}

      {loading && !data && <p className="loading">Caricamento…</p>}
      {error && <p className="error">{error}</p>}

      {data && !error && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {data.by_source.map((s: TouchpointSourceData) => (
              <TouchpointCard key={s.source} source={s} />
            ))}
          </div>

          <div className="brutal-card" style={{ marginBottom: '1rem' }}>
            <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>Come abilitare i dati</h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
              <li><strong>Landing page:</strong> tracking UTM (utm_source=landing) o beacon su comtra.dev. Inserire in <code>user_attribution</code> o <code>touchpoint_events</code> al signup.</li>
              <li><strong>Plugin:</strong> default per utenti da OAuth Figma (nessuna configurazione).</li>
              <li><strong>Pagina LinkedIn:</strong> quando il link ufficiale è attivo, tracciare click con UTM (utm_source=linkedin) e salvare in <code>touchpoint_events</code> o <code>user_attribution</code>.</li>
              <li><strong>Instagram / TikTok:</strong> stesso schema UTM quando le pagine saranno attive.</li>
            </ul>
          </div>
        </>
      )}
    </>
  );
}

function TouchpointCard({ source }: { source: TouchpointSourceData }) {
  const convRate = source.ingressi > 0 ? ((source.primo_utilizzo / source.ingressi) * 100).toFixed(1) : '—';
  const proRate = source.ingressi > 0 ? ((source.upgrade_pro / source.ingressi) * 100).toFixed(1) : '—';

  return (
    <div className="brutal-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <h3 className="section-title" style={{ marginBottom: 0 }}>{source.label}</h3>
      {source.note && <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>{source.note}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>Visite</p>
          <p style={{ margin: '0.15rem 0 0', fontSize: '1.1rem', fontWeight: 800 }}>{source.visite ?? 0}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>Click</p>
          <p style={{ margin: '0.15rem 0 0', fontSize: '1.1rem', fontWeight: 800 }}>{source.click ?? 0}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>Ingressi (tot)</p>
          <p style={{ margin: '0.15rem 0 0', fontSize: '1.25rem', fontWeight: 800 }}>{source.ingressi}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>Primo utilizzo</p>
          <p style={{ margin: '0.15rem 0 0', fontSize: '1.25rem', fontWeight: 800 }}>{source.primo_utilizzo}</p>
          <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--muted)' }}>{convRate}%</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>Upgrade PRO</p>
          <p style={{ margin: '0.15rem 0 0', fontSize: '1.25rem', fontWeight: 800 }}>{source.upgrade_pro}</p>
          <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--muted)' }}>{proRate}%</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>PRO attivi</p>
          <p style={{ margin: '0.15rem 0 0', fontSize: '1.25rem', fontWeight: 800 }}>{source.pro_attivi}</p>
        </div>
      </div>
    </div>
  );
}
