import { useCallback, useEffect, useState } from 'react';
import { fetchSupportFeedback, type SupportFeedbackItem } from '../api';
import PageHeader from '../components/PageHeader';

export default function SupportRequests() {
  const [items, setItems] = useState<SupportFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchSupportFeedback(100)
      .then((r) => {
        setItems(r.items || []);
        setError(null);
      })
      .catch((e) => {
        setItems([]);
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader title="Supporto" />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.9rem', flex: '1 1 200px' }}>
          Ticket da plugin (Discard / Documentation) e feedback A/B Generate. Se il plugin risponde <code>200</code> ma qui non vedi nulla, verifica che <strong>POSTGRES_URL</strong> della dashboard punti allo stesso DB dell’auth (vedi <code>docs/SUPPORT-TICKETS-VERIFICATION.md</code>).
        </p>
        <button type="button" className="brutal-btn" onClick={load} disabled={loading}>
          {loading ? 'Caricamento…' : 'Aggiorna'}
        </button>
      </div>

      {loading && <p className="loading">Caricamento…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <div className="brutal-table-wrap">
          <table className="brutal-table">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Origine</th>
                <th scope="col">Variante</th>
                <th scope="col">Valutazione</th>
                <th scope="col">Commento</th>
                <th scope="col">Utente</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    {new Date(r.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>{r.source}</td>
                  <td><strong>{r.variant}</strong></td>
                  <td>{r.source === 'Support Ticket' ? (r.variant === 'BUG' ? '🐛' : r.variant === 'FEATURE' ? '🚀' : '❤️') : (r.thumbs === 'up' ? '👍' : '👎')}</td>
                  <td style={{ maxWidth: 280 }}>{r.comment || '—'}</td>
                  <td className="mono" style={{ fontSize: '0.85rem' }}>{r.user_masked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="brutal-card" style={{ marginTop: '1rem' }}>
          <p className="loading">Nessun feedback nel periodo.</p>
        </div>
      )}
    </>
  );
}
