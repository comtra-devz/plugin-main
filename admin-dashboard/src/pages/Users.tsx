import { useEffect, useState } from 'react';
import { fetchUsers, type AdminUser, type AdminUsersResponse } from '../api';

const PAGE_SIZE = 50;

export default function Users() {
  const [res, setRes] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchUsers(PAGE_SIZE, offset)
      .then((d) => { if (!cancelled) { setRes(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [offset]);

  const total = res?.total ?? 0;
  const hasMore = offset + PAGE_SIZE < total;
  const hasPrev = offset > 0;

  return (
    <>
      <h1 className="page-title">Utenti</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
        Email offuscate. Totale: <strong>{total}</strong>
      </p>

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
                  <th>Iscrizione</th>
                </tr>
              </thead>
              <tbody>
                {res.users.map((u: AdminUser) => (
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
                    <td>
                      {new Date(u.created_at).toLocaleDateString('it-IT', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
