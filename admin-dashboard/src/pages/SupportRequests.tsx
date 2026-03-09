import { useEffect, useState } from 'react';
import { fetchSupportFeedback, type SupportFeedbackItem } from '../api';
import PageHeader from '../components/PageHeader';

export default function SupportRequests() {
  const [items, setItems] = useState<SupportFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSupportFeedback(100)
      .then((r) => { if (!cancelled) { setItems(r.items || []); setError(null); } })
      .catch((e) => { if (!cancelled) { setItems([]); setError(e.message); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <PageHeader title="Supporto" />
      <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Feedback dagli utenti (A/B test Generate e altre fonti).
      </p>

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
                  <td>{r.thumbs === 'up' ? '👍' : '👎'}</td>
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
