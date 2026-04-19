import { Fragment, useCallback, useEffect, useState } from 'react';
import {
  fetchAdminGenerateThreads,
  fetchAdminGenerateThreadMessages,
  fetchAdminGeneratePluginAnalytics,
  type AdminGenerateThreadRow,
  type AdminGenerateThreadMessageRow,
} from '../api';
import PageHeader from '../components/PageHeader';

function truncate(s: string, max: number): string {
  const t = (s || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function messagePreview(m: AdminGenerateThreadMessageRow): string {
  const j = m.content_json;
  if (j && typeof j === 'object' && j.text != null) return String(j.text).slice(0, 2000);
  try {
    return JSON.stringify(j).slice(0, 800);
  } catch {
    return '—';
  }
}

export default function GenerateConversations() {
  const [qInput, setQInput] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [threads, setThreads] = useState<AdminGenerateThreadRow[]>([]);
  const [analytics, setAnalytics] = useState<{
    period_days: number;
    threads_touched: number;
    messages_created: number;
    generation_plugin_events: Array<{ event_type: string; cnt: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [messagesByThread, setMessagesByThread] = useState<Record<string, AdminGenerateThreadMessageRow[]>>({});
  const [loadingMessages, setLoadingMessages] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(qInput.trim()), 320);
    return () => window.clearTimeout(t);
  }, [qInput]);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchAdminGenerateThreads({ q: qDebounced || undefined, limit: 100 });
      setThreads(r.threads || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento');
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, [qDebounced]);

  useEffect(() => {
    let cancelled = false;
    void loadThreads().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [loadThreads]);

  useEffect(() => {
    let cancelled = false;
    fetchAdminGeneratePluginAnalytics(30)
      .then((a) => {
        if (!cancelled) setAnalytics(a);
      })
      .catch(() => {
        if (!cancelled) setAnalytics(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (messagesByThread[id]) return;
    setLoadingMessages(id);
    try {
      const r = await fetchAdminGenerateThreadMessages(id);
      setMessagesByThread((prev) => ({ ...prev, [id]: r.messages || [] }));
    } catch {
      setMessagesByThread((prev) => ({ ...prev, [id]: [] }));
    } finally {
      setLoadingMessages(null);
    }
  };

  return (
    <>
      <PageHeader title="Generate — conversazioni" />
      <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9rem', maxWidth: 720 }}>
        Archivio thread sincronizzati dal plugin (<code className="mono">generate_threads</code>). Cerca per titolo,
        file key, user id, hash DS o <strong>testo nei messaggi</strong>. Dettaglio messaggi su riga espansa (§8 hub).
      </p>

      {analytics ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.6rem',
            marginBottom: '1rem',
          }}
        >
          <div className="brutal-card" style={{ padding: '0.65rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase' }}>
              Thread toccati ({analytics.period_days}g)
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{analytics.threads_touched}</div>
          </div>
          <div className="brutal-card" style={{ padding: '0.65rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase' }}>
              Messaggi ({analytics.period_days}g)
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{analytics.messages_created}</div>
          </div>
          <div className="brutal-card" style={{ padding: '0.65rem', gridColumn: '1 / -1' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              Eventi plugin (top)
            </div>
            <div style={{ fontSize: '0.78rem', lineHeight: 1.5 }}>
              {(analytics.generation_plugin_events || []).slice(0, 12).map((r) => (
                <span key={r.event_type} style={{ marginRight: '0.75rem' }}>
                  <strong>{r.event_type}</strong>: {r.cnt}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
        <label style={{ flex: '1 1 240px', minWidth: 200 }}>
          <input
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Cerca…"
            aria-label="Cerca thread"
            className="brutal-input"
            style={{ width: '100%', padding: '0.5rem 0.65rem', border: '2px solid var(--black)' }}
          />
        </label>
        <button type="button" className="brutal-btn" onClick={() => void loadThreads()} disabled={loading}>
          Aggiorna
        </button>
      </div>

      {loading && <p className="loading">Caricamento…</p>}
      {error && (
        <div className="brutal-card" style={{ borderColor: '#c62828', marginBottom: '1rem' }}>
          <p style={{ margin: 0, fontWeight: 700 }}>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="brutal-table-wrap">
          <table className="brutal-table">
            <thead>
              <tr>
                <th scope="col">Aggiornato</th>
                <th scope="col">Titolo</th>
                <th scope="col">Msg</th>
                <th scope="col">User</th>
                <th scope="col">File</th>
                <th scope="col">DS hash</th>
              </tr>
            </thead>
            <tbody>
              {threads.map((row) => (
                <Fragment key={row.id}>
                  <tr>
                    <td className="mono" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {row.updated_at_ms
                        ? new Date(row.updated_at_ms).toLocaleString('it-IT', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => void toggleExpand(row.id)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          padding: 0,
                          margin: 0,
                          fontWeight: 700,
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          color: 'var(--black)',
                          textAlign: 'left',
                        }}
                      >
                        {truncate(row.title || 'Senza titolo', 72)}
                      </button>
                    </td>
                    <td className="mono">{row.message_count ?? '—'}</td>
                    <td className="mono" style={{ fontSize: '0.75rem' }}>
                      {truncate(row.user_id, 14)}
                    </td>
                    <td className="mono" style={{ fontSize: '0.72rem', maxWidth: 140 }} title={row.file_key}>
                      {truncate(row.file_key, 18)}
                    </td>
                    <td className="mono" style={{ fontSize: '0.72rem', maxWidth: 120 }} title={row.ds_cache_hash}>
                      {truncate(row.ds_cache_hash, 14)}
                    </td>
                  </tr>
                  {expandedId === row.id ? (
                    <tr>
                      <td colSpan={6} style={{ background: 'var(--bg-soft, #f9f9f9)', verticalAlign: 'top' }}>
                        <div style={{ padding: '0.75rem', fontSize: '0.82rem' }}>
                          <p style={{ margin: '0 0 0.5rem', fontWeight: 800 }}>Messaggi thread {row.id}</p>
                          {loadingMessages === row.id ? (
                            <p className="loading">Caricamento messaggi…</p>
                          ) : (
                            <ul style={{ margin: 0, paddingLeft: '1.1rem', maxHeight: 360, overflow: 'auto' }}>
                              {(messagesByThread[row.id] || []).map((m) => (
                                <li key={m.id} style={{ marginBottom: '0.65rem' }}>
                                  <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                                    {m.role}
                                    {m.message_type ? ` · ${m.message_type}` : ''}
                                    {m.created_at_ms
                                      ? ` · ${new Date(m.created_at_ms).toLocaleTimeString('it-IT')}`
                                      : ''}
                                  </span>
                                  <pre
                                    style={{
                                      margin: '0.25rem 0 0',
                                      whiteSpace: 'pre-wrap',
                                      fontSize: '0.78rem',
                                      fontFamily: 'inherit',
                                    }}
                                  >
                                    {messagePreview(m)}
                                  </pre>
                                </li>
                              ))}
                            </ul>
                          )}
                          {(messagesByThread[row.id] || []).length === 0 && loadingMessages !== row.id ? (
                            <p style={{ margin: 0, color: 'var(--muted)' }}>Nessun messaggio.</p>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && threads.length === 0 && (
        <div className="brutal-card">
          <p style={{ margin: 0 }}>Nessun thread trovato.</p>
        </div>
      )}
    </>
  );
}
