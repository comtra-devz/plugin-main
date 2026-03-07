import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchDiscountsStats,
  fetchDiscountsLevel,
  fetchDiscountsThrottle,
  type DiscountsStats,
  type DiscountLevelItem,
  type DiscountThrottleItem,
} from '../api';

const PAGE_SIZE = 50;

export default function Discounts() {
  const [stats, setStats] = useState<DiscountsStats | null>(null);
  const [levelItems, setLevelItems] = useState<DiscountLevelItem[]>([]);
  const [levelTotal, setLevelTotal] = useState(0);
  const [throttleItems, setThrottleItems] = useState<DiscountThrottleItem[]>([]);
  const [throttleTotal, setThrottleTotal] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingLevel, setLoadingLevel] = useState(true);
  const [loadingThrottle, setLoadingThrottle] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<number | ''>('');
  const [levelOffset, setLevelOffset] = useState(0);
  const [throttleFilter, setThrottleFilter] = useState<'valid' | 'expired' | ''>('');
  const [throttleOffset, setThrottleOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchDiscountsStats()
      .then((d) => { if (!cancelled) setStats(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoadingStats(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setLevelOffset(0);
  }, [levelFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoadingLevel(true);
    fetchDiscountsLevel(PAGE_SIZE, levelOffset, levelFilter === '' ? undefined : levelFilter)
      .then((r) => {
        if (!cancelled) {
          setLevelItems(r.items);
          setLevelTotal(r.total);
          setError(null);
        }
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoadingLevel(false); });
    return () => { cancelled = true; };
  }, [levelOffset, levelFilter]);

  useEffect(() => {
    setThrottleOffset(0);
  }, [throttleFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoadingThrottle(true);
    const status = throttleFilter === '' ? undefined : throttleFilter;
    fetchDiscountsThrottle(PAGE_SIZE, throttleOffset, status)
      .then((r) => {
        if (!cancelled) {
          setThrottleItems(r.items);
          setThrottleTotal(r.total);
          setError(null);
        }
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoadingThrottle(false); });
    return () => { cancelled = true; };
  }, [throttleOffset, throttleFilter]);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Codici sconto</h1>
        <Link to="/">← Dashboard</Link>
      </div>
      <p style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Codici livello (gamification, 5–20% sul piano Annual) e codici throttle (5% una tantum dopo 503). L’uso effettivo è tracciato su Lemon Squeezy.
      </p>

      {(loadingStats && !stats) && <p className="loading">Caricamento riepilogo…</p>}
      {stats && (
        <div className="brutal-card" style={{ marginBottom: '1.5rem' }}>
          <h3 className="section-title" style={{ marginBottom: '0.75rem' }}>Riepilogo</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>Livello (totali)</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 800 }}>{stats.level.total}</p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
                5%: {stats.level.by_level[5]} · 10%: {stats.level.by_level[10]} · 15%: {stats.level.by_level[15]} · 20%: {stats.level.by_level[20]}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>Throttle (totali)</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 800 }}>{stats.throttle.total}</p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
                Validi: {stats.throttle.valid} · Scaduti: {stats.throttle.expired}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {/* Tabella codici livello */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Codici livello (gamification)</h2>
        <div className="brutal-card" style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="brutal-label" style={{ margin: 0 }}>Filtra per sconto</label>
            <select
              className="brutal-input"
              value={levelFilter === '' ? '' : String(levelFilter)}
              onChange={(e) => setLevelFilter(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ width: 'auto' }}
            >
              <option value="">Tutti</option>
              <option value="5">5%</option>
              <option value="10">10%</option>
              <option value="15">15%</option>
              <option value="20">20%</option>
            </select>
          </div>
        </div>
        <div className="brutal-table-wrap">
          <table className="brutal-table">
            <thead>
              <tr>
                <th>Utente (anonimizzato)</th>
                <th>Livello / Sconto</th>
                <th>Codice</th>
                <th>Creato</th>
              </tr>
            </thead>
            <tbody>
              {levelItems.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)' }}>Nessun codice livello per i filtri selezionati.</td>
                </tr>
              ) : (
                levelItems.map((item) => (
                  <tr key={item.user_id}>
                    <td className="mono">{item.user_masked}</td>
                    <td>L{item.level} ({Math.min(20, Math.floor(item.level / 5) * 5)}%)</td>
                    <td className="mono" style={{ fontSize: '0.85rem' }}>{item.code}</td>
                    <td style={{ fontSize: '0.85rem' }}>{new Date(item.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="brutal-btn"
            disabled={levelOffset === 0 || loadingLevel}
            onClick={() => setLevelOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            ← Precedenti
          </button>
          <button
            type="button"
            className="brutal-btn"
            disabled={levelOffset + PAGE_SIZE >= levelTotal || loadingLevel}
            onClick={() => setLevelOffset((o) => o + PAGE_SIZE)}
          >
            Successive →
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
            {levelOffset + 1}–{Math.min(levelOffset + PAGE_SIZE, levelTotal)} di {levelTotal}
          </span>
        </div>
      </section>

      {/* Tabella codici throttle */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 className="section-title">Codici throttle (5% una tantum)</h2>
        <div className="brutal-card" style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="brutal-label" style={{ margin: 0 }}>Stato</label>
            <select
              className="brutal-input"
              value={throttleFilter}
              onChange={(e) => setThrottleFilter((e.target.value || '') as 'valid' | 'expired' | '')}
              style={{ width: 'auto' }}
            >
              <option value="">Tutti</option>
              <option value="valid">Validi</option>
              <option value="expired">Scaduti</option>
            </select>
          </div>
        </div>
        <div className="brutal-table-wrap">
          <table className="brutal-table">
            <thead>
              <tr>
                <th>Utente (anonimizzato)</th>
                <th>Codice</th>
                <th>Stato</th>
                <th>Rilasciato</th>
                <th>Scadenza</th>
              </tr>
            </thead>
            <tbody>
              {throttleItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>Nessun codice throttle per i filtri selezionati.</td>
                </tr>
              ) : (
                throttleItems.map((item) => (
                  <tr key={item.user_id}>
                    <td className="mono">{item.user_masked}</td>
                    <td className="mono" style={{ fontSize: '0.85rem' }}>{item.code}</td>
                    <td>
                      <span className={`badge ${item.status === 'valid' ? 'pro' : 'free'}`} style={{ fontSize: '0.75rem' }}>
                        {item.status === 'valid' ? 'Valido' : 'Scaduto'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{new Date(item.issued_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ fontSize: '0.85rem' }}>{new Date(item.expires_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="brutal-btn"
            disabled={throttleOffset === 0 || loadingThrottle}
            onClick={() => setThrottleOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            ← Precedenti
          </button>
          <button
            type="button"
            className="brutal-btn"
            disabled={throttleOffset + PAGE_SIZE >= throttleTotal || loadingThrottle}
            onClick={() => setThrottleOffset((o) => o + PAGE_SIZE)}
          >
            Successive →
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
            {throttleOffset + 1}–{Math.min(throttleOffset + PAGE_SIZE, throttleTotal)} di {throttleTotal}
          </span>
        </div>
      </section>
    </>
  );
}
