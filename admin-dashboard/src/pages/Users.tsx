import { useEffect, useState, useMemo, useCallback } from 'react';
import { fetchUsers, fetchUsersCountries, rechargeRequest, rechargeConfirm, type AdminUser, type AdminUsersResponse } from '../api';
import PageHeader from '../components/PageHeader';

const PAGE_SIZE = 50;
const RECHARGE_COOLDOWN_MS = 12 * 60 * 60 * 1000;

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function canRecharge(u: AdminUser): boolean {
  const last = u.last_admin_recharge_at ? new Date(u.last_admin_recharge_at).getTime() : 0;
  return last === 0 || Date.now() - last >= RECHARGE_COOLDOWN_MS;
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
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const [rechargeUser, setRechargeUser] = useState<AdminUser | null>(null);
  const [rechargeStep, setRechargeStep] = useState<1 | 2>(1);
  const [rechargeAmount, setRechargeAmount] = useState<string>('');
  const [rechargePin, setRechargePin] = useState<string>('');
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const [rechargeError, setRechargeError] = useState<string | null>(null);

  const refetchUsers = useCallback(() => {
    setLoading(true);
    fetchUsers(PAGE_SIZE, offset, countryFilter.trim() || undefined)
      .then((d) => { setRes(d); setError(null); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [offset, countryFilter]);

  const openRechargeModal = (u: AdminUser) => {
    setRechargeUser(u);
    setRechargeStep(1);
    setRechargeAmount('');
    setRechargePin('');
    setRechargeError(null);
  };

  const closeRechargeModal = () => {
    setRechargeUser(null);
    setRechargeStep(1);
    setRechargeAmount('');
    setRechargePin('');
    setRechargeError(null);
  };

  const handleRechargeStep1 = async () => {
    if (!rechargeUser) return;
    const amount = Math.floor(Number(rechargeAmount) || 0);
    if (amount <= 0) { setRechargeError('Inserisci una quantità positiva'); return; }
    setRechargeError(null);
    setRechargeLoading(true);
    try {
      await rechargeRequest(rechargeUser.id, amount);
      setRechargeStep(2);
    } catch (e) {
      setRechargeError(e instanceof Error ? e.message : 'Errore richiesta PIN');
    } finally {
      setRechargeLoading(false);
    }
  };

  const handleRechargeStep2 = async () => {
    if (!rechargeUser) return;
    const amount = Math.floor(Number(rechargeAmount) || 0);
    const pin = rechargePin.trim();
    if (!pin) { setRechargeError('Inserisci il PIN ricevuto via email'); return; }
    setRechargeError(null);
    setRechargeLoading(true);
    try {
      await rechargeConfirm(rechargeUser.id, amount, pin);
      refetchUsers();
      closeRechargeModal();
    } catch (e) {
      setRechargeError(e instanceof Error ? e.message : 'Errore conferma');
    } finally {
      setRechargeLoading(false);
    }
  };

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
      <PageHeader title="Utenti" />
      <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
        Email offuscate. Totale in DB: <strong>{total}</strong>
        {hasActiveFilters && <> · Risultati filtrati (visibili): <strong>{filteredUsers.length}</strong></>}
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
              onClick={() => {
                exportUsersToCsv(filteredUsers);
                setExportMessage('Export CSV completato.');
                window.setTimeout(() => setExportMessage(null), 3000);
              }}
              disabled={filteredUsers.length === 0}
            >
              Esporta CSV (visibili)
            </button>
          </div>
          {hasActiveFilters && (
            <div>
              <button
                type="button"
                className="brutal-btn"
                onClick={() => {
                  setSearch('');
                  setPlanFilter('ALL');
                  setDateFrom('');
                  setDateTo('');
                  setCountryFilter('');
                  setOffset(0);
                }}
              >
                Azzera filtri
              </button>
            </div>
          )}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
          I filtri si applicano ai {res?.users?.length ?? 0} utenti caricati in questa pagina. Esporta: solo gli utenti visibili (filtrati).
        </p>
        {exportMessage && (
          <p role="status" className="export-feedback" style={{ marginTop: '0.5rem', color: 'var(--ok)', fontWeight: 700 }}>
            {exportMessage}
          </p>
        )}
      </div>

      {loading && <p className="loading">Caricamento…</p>}
      {error && <p className="error">{error}</p>}

      {res && !loading && (
        <>
          <div className="brutal-table-wrap">
            <table className="brutal-table">
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Nome</th>
                  <th scope="col">Piano</th>
                  <th scope="col">Scadenza</th>
                  <th scope="col">Crediti</th>
                  <th scope="col">Provenienza</th>
                  <th scope="col">Iscrizione</th>
                  <th scope="col">Ricarica</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)' }}>
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
                      <td>
                        <button
                          type="button"
                          className="brutal-btn primary"
                          disabled={!canRecharge(u)}
                          onClick={() => openRechargeModal(u)}
                          title={!canRecharge(u) ? 'Ricarica consentita dopo 12 ore dall\'ultima' : 'Ricarica crediti (additiva, richiede PIN via email)'}
                        >
                          Ricarica
                        </button>
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

      {rechargeUser && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="recharge-title">
          <div className="brutal-card" style={{ maxWidth: '22rem', margin: '2rem auto' }}>
            <h2 id="recharge-title" style={{ marginBottom: '1rem' }}>
              {rechargeStep === 1 ? 'Ricarica crediti' : 'Conferma con PIN'}
            </h2>
            {rechargeStep === 1 ? (
              <>
                <p style={{ color: 'var(--muted)', marginBottom: '0.5rem' }}>
                  Utente: <strong>{rechargeUser.email_masked}</strong>
                </p>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Quantità crediti</label>
                <input
                  type="number"
                  min={1}
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(e.target.value)}
                  className="brutal-input"
                  style={{ width: '100%', marginBottom: '1rem' }}
                  placeholder="es. 50"
                />
              </>
            ) : (
              <>
                <p style={{ color: 'var(--muted)', marginBottom: '0.5rem' }}>
                  Aggiungi <strong>{rechargeAmount}</strong> crediti a {rechargeUser.email_masked}. Il PIN è stato inviato a admin@comtra.dev (scade in 5 min).
                </p>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>PIN</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={rechargePin}
                  onChange={(e) => setRechargePin(e.target.value.replace(/\D/g, ''))}
                  className="brutal-input"
                  style={{ width: '100%', marginBottom: '1rem' }}
                  placeholder="6 cifre"
                />
              </>
            )}
            {rechargeError && (
              <p className="error" style={{ marginBottom: '1rem' }}>{rechargeError}</p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" className="brutal-btn" onClick={closeRechargeModal} disabled={rechargeLoading}>
                Annulla
              </button>
              <button
                type="button"
                className="brutal-btn primary"
                disabled={rechargeLoading}
                onClick={rechargeStep === 1 ? handleRechargeStep1 : handleRechargeStep2}
              >
                {rechargeLoading ? 'Attendere…' : rechargeStep === 1 ? 'Invia PIN' : 'Conferma'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
