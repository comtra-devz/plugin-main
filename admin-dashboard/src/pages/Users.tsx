import { useEffect, useState, useMemo } from 'react';
import { fetchUsers, fetchUsersCountries, type AdminUser, type AdminUsersResponse } from '../api';

const PAGE_SIZE = 50;

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function exportUsersToCsv(users: AdminUser[]) {
  const headers = ['Email', 'Nome', 'Piano', 'Scadenza', 'Crediti rimanenti', 'Crediti totali', 'Provenienza', 'Iscrizione'];
  const rows = users.map((u) => [
    u.email_masked,
    u.name,
    u.plan,
    u.plan_expires_at ? toDateOnly(u.plan_expires_at) : '',
    String(u.credits_remaining),
    String(u.credits_total),
    u.country_code ?? '',
    toDateOnly(u.created_at),
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `utenti-${toDateOnly(new Date().toISOString())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Users() {
  const [res, setRes] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [countryFilter, setCountryFilter] = useState<string>('');
  const [countries, setCountries] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchUsersCountries()
      .then((d) => { if (!cancelled) setCountries(d.countries || []); })
      .catch(() => { if (!cancelled) setCountries([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (countryFilter) setOffset(0);
  }, [countryFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchUsers(PAGE_SIZE, offset, countryFilter.trim() || undefined)
      .then((d) => { if (!cancelled) { setRes(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [offset, countryFilter]);

  const filteredUsers = useMemo(() => {
    if (!res?.users) return [];
    let list = res.users;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          u.email_masked.toLowerCase().includes(q) ||
          (u.name && u.name.toLowerCase().includes(q))
      );
    }
    if (planFilter !== 'ALL') {
      list = list.filter((u) => u.plan === planFilter);
    }
    if (dateFrom) {
      list = list.filter((u) => toDateOnly(u.created_at) >= dateFrom);
    }
    if (dateTo) {
      list = list.filter((u) => toDateOnly(u.created_at) <= dateTo);
    }
    return list;
  }, [res?.users, search, planFilter, dateFrom, dateTo]);

  const total = res?.total ?? 0;
  const hasMore = offset + PAGE_SIZE < total;
  const hasPrev = offset > 0;
  const hasActiveFilters = search.trim() || planFilter !== 'ALL' || dateFrom || dateTo || countryFilter !== '';

  return (
    <>
      <h1 className="page-title">Utenti</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
        Email offuscate. Totale in DB: <strong>{total}</strong>
        {hasActiveFilters && <> · Visibili (filtri su questa pagina): <strong>{filteredUsers.length}</strong></>}
      </p>

      {/* Filtri e search */}
      <div className="brutal-card" style={{ marginBottom: '1rem' }}>
        <h3 className="section-title" style={{ marginBottom: '0.5rem' }}>Filtri e ricerca</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label className="brutal-label">Cerca (email / nome)</label>
            <input
              type="text"
              className="brutal-input"
              placeholder="Testo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="brutal-label">Piano</label>
            <select
              className="brutal-input"
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="ALL">Tutti</option>
              <option value="FREE">FREE</option>
              <option value="PRO">PRO</option>
            </select>
          </div>
          <div>
            <label className="brutal-label">Provenienza</label>
            <select
              className="brutal-input"
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">Tutti</option>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="brutal-label">Iscrizione da (data)</label>
            <input
              type="date"
              className="brutal-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="brutal-label">Iscrizione a (data)</label>
            <input
              type="date"
              className="brutal-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div>
            <button
              type="button"
              className="brutal-btn primary"
              onClick={() => exportUsersToCsv(filteredUsers)}
              disabled={filteredUsers.length === 0}
            >
              Esporta CSV (visibili)
            </button>
          </div>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
          I filtri si applicano ai {res?.users?.length ?? 0} utenti caricati in questa pagina. Esporta: solo gli utenti visibili (filtrati).
        </p>
      </div>

      {loading && <p className="loading">Caricamento…</p>}
      {error && <p className="error">{error}</p>}

      {res && !loading && (
        <>
          <div className="brutal-table-wrap">
            <table className="brutal-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Nome</th>
                  <th>Piano</th>
                  <th>Scadenza</th>
                  <th>Crediti</th>
                  <th>Provenienza</th>
                  <th>Iscrizione</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      Nessun utente corrisponde ai filtri.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u: AdminUser) => (
                    <tr key={u.id}>
                      <td className="mono">{u.email_masked}</td>
                      <td>{u.name}</td>
                      <td>
                        <span className={`badge ${u.plan === 'PRO' ? 'pro' : 'free'}`}>{u.plan}</span>
                      </td>
                      <td>
                        {u.plan_expires_at
                          ? new Date(u.plan_expires_at).toLocaleDateString('it-IT', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td>{u.credits_remaining} / {u.credits_total}</td>
                      <td className="mono">{u.country_code ?? '—'}</td>
                      <td>
                        {new Date(u.created_at).toLocaleDateString('it-IT', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
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
          </div>
        </>
      )}
    </>
  );
}
