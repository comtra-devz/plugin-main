import { useEffect, useState } from 'react';
import { fetchPluginLogs, type PluginLogItem } from '../api';
import PageHeader from '../components/PageHeader';

export default function SecurityLogs() {
  const [items, setItems] = useState<PluginLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPluginLogs(100)
      .then((r) => { if (!cancelled) { setItems(r.items || []); setError(null); } })
      .catch((e) => { if (!cancelled) { setItems([]); setError(e.message); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <PageHeader title="Sicurezza e log" />
      <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Problematiche rilevate dal plugin (limite richieste, errori, ecc.). La colonna Fix indica l’azione consigliata. Risolto: sì se non si è ripetuto nei 7 giorni successivi.
      </p>

      {loading && <p className="loading">Caricamento…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <div className="brutal-table-wrap">
          <table className="brutal-table">
            <thead>
              <tr>
                <th scope="col">Data / Ora</th>
                <th scope="col">Tipo</th>
                <th scope="col">Descrizione</th>
                <th scope="col">Utente</th>
                <th scope="col">Fix consigliato</th>
                <th scope="col">Risolto</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td className="mono" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    {new Date(e.date).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>{e.category_label}</td>
                  <td style={{ maxWidth: 280 }}>{e.description}</td>
                  <td className="mono" style={{ fontSize: '0.85rem' }}>{e.user_masked}</td>
                  <td style={{ maxWidth: 320 }}>{e.fix}</td>
                  <td>
                    <span
                      className="badge"
                      style={
                        e.risolto
                          ? { background: 'var(--ok)', color: 'var(--black)' }
                          : { background: 'var(--yellow)', color: 'var(--black)' }
                      }
                    >
                      {e.risolto ? 'Sì' : 'No'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="brutal-card" style={{ marginTop: '1rem' }}>
          <p className="loading">Nessuna voce nei log.</p>
        </div>
      )}
    </>
  );
}
