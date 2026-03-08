import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchFunctionExecutions,
  fetchExecutionsUsers,
  fetchUsersCountries,
  type FunctionExecution,
  type ExecutionsUser,
  type FunctionExecutionsFilters,
} from '../api';
import PageHeader from '../components/PageHeader';

const PAGE_SIZE = 50;

export default function Executions() {
  const [executions, setExecutions] = useState<FunctionExecution[]>([]);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<ExecutionsUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<FunctionExecutionsFilters>({});
  const [actionType, setActionType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userId, setUserId] = useState('');
  const [country, setCountry] = useState('');
  const [countries, setCountries] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchUsersCountries()
      .then((d) => { if (!cancelled) setCountries(d.countries || []); })
      .catch(() => { if (!cancelled) setCountries([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setOffset(0);
  }, [actionType, dateFrom, dateTo, userId, country]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchExecutionsUsers(dateFrom || undefined, dateTo || undefined, country.trim() || undefined)
      .then((r) => { if (!cancelled) setUsers(r.users); })
      .catch(() => { if (!cancelled) setUsers([]); });
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, country]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const f: FunctionExecutionsFilters = {};
    if (actionType.trim()) f.action_type = actionType.trim();
    if (dateFrom) f.date_from = dateFrom;
    if (dateTo) f.date_to = dateTo;
    if (userId) f.user_id = userId;
    if (country.trim()) f.country = country.trim();
    fetchFunctionExecutions(PAGE_SIZE, offset, Object.keys(f).length ? f : undefined)
      .then((r) => {
        if (!cancelled) {
          setExecutions(r.executions);
          setTotal(r.total);
          setError(null);
        }
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [offset, actionType, dateFrom, dateTo, userId, country]);

  const hasMore = offset + PAGE_SIZE < total;
  const hasPrev = offset > 0;
  const hasActiveFilters = !!(
    actionType.trim() || dateFrom || dateTo || userId || country.trim()
  );

  const clearFilters = () => {
    setActionType('');
    setDateFrom('');
    setDateTo('');
    setUserId('');
    setCountry('');
    setOffset(0);
  };

  return (
    <>
      <PageHeader title="Esecuzioni funzioni" />
      <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Singole esecuzioni (credit_transactions) con filtri per tipo, periodo e utente (anonimizzato).
        {hasActiveFilters ? (
          <> Totale risultati (con filtri): <strong>{total}</strong></>
        ) : (
          <> Totale in DB: <strong>{total}</strong></>
        )}
      </p>

      <div className="brutal-card" style={{ marginBottom: '1rem' }}>
        <h3 className="section-title" style={{ marginBottom: '0.5rem' }}>Filtri</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label className="brutal-label">Tipo azione</label>
            <input
              type="text"
              className="brutal-input"
              placeholder="es. audit, scan"
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
            />
          </div>
          <div>
            <label className="brutal-label">Utente</label>
            <select
              className="brutal-input"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">Tutti</option>
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>{u.user_masked}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="brutal-label">Provenienza</label>
            <select
              className="brutal-input"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">Tutti</option>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="brutal-label">Data da</label>
            <input type="date" className="brutal-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="brutal-label">Data a</label>
            <input type="date" className="brutal-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          {hasActiveFilters && (
            <div>
              <button type="button" className="brutal-btn" onClick={clearFilters}>
                Azzera filtri
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="loading">Caricamento…</p>}

      {!loading && (
        <>
          <div className="brutal-table-wrap">
            <table className="brutal-table">
              <thead>
                <tr>
                  <th scope="col">Utente (anonimizzato)</th>
                  <th scope="col">Provenienza</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Crediti</th>
                  <th scope="col">Data / Ora</th>
                </tr>
              </thead>
              <tbody>
                {executions.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>Nessuna esecuzione per i filtri selezionati.</td>
                  </tr>
                ) : (
                  executions.map((e) => (
                    <tr key={e.id}>
                      <td className="mono">{e.user_masked}</td>
                      <td className="mono">{e.country_code ?? '—'}</td>
                      <td className="mono">{e.action_type}</td>
                      <td>{e.credits_consumed}</td>
                      <td className="mono" style={{ fontSize: '0.85rem' }}>
                        {new Date(e.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="brutal-btn"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(0)}
              aria-label="Prima pagina"
            >
              Prima
            </button>
            <button
              type="button"
              className="brutal-btn"
              disabled={!hasPrev || loading}
              onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            >
              ← Precedenti
            </button>
            <span className="mono" style={{ color: 'var(--muted)' }}>
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} di {total}
            </span>
            <button
              type="button"
              className="brutal-btn"
              disabled={!hasMore || loading}
              onClick={() => setOffset((o) => o + PAGE_SIZE)}
            >
              Successive →
            </button>
            <button
              type="button"
              className="brutal-btn"
              disabled={!hasMore || loading}
              onClick={() => setOffset(Math.max(0, Math.ceil(total / PAGE_SIZE) * PAGE_SIZE - PAGE_SIZE))}
              aria-label="Ultima pagina"
            >
              Ultima
            </button>
          </div>
        </>
      )}
    </>
  );
}
