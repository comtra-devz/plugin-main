import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  fetchProductSourcesQueue,
  fetchProductSourcesRunById,
  fetchProductSourcesRuns,
  productSourcesRunAction,
  type ProductSourcesQueueBatchRow,
  type ProductSourcesRunRow,
} from '../api';

const GIT_LABEL: Record<string, string> = {
  not_sent: 'Non su Git',
  pending: 'In lavorazione (PR manuale)',
  pr_opened: 'PR registrata (manuale)',
  failed: 'Errore Git',
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('it-IT', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

/** Allineato a Fase 7: `docs/PRODUCT-SOURCES-GIT-WORKFLOW.md` — `YYYY-MM-DD-cron-{id}.md` */
function productSourcesArchiveFilename(id: number, ranAt?: string | null) {
  if (ranAt) {
    try {
      const d = new Date(ranAt);
      if (!Number.isNaN(d.getTime())) {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}-cron-${id}.md`;
      }
    } catch {
      /* fallback */
    }
  }
  return `product-sources-run-${id}.md`;
}

function downloadMd(id: number, markdown: string, ranAt?: string | null) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = productSourcesArchiveFilename(id, ranAt);
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function ProductSourcesHistory() {
  const [runs, setRuns] = useState<ProductSourcesRunRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loadLimit, setLoadLimit] = useState(80);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusF, setStatusF] = useState<'all' | 'ok' | 'error'>('all');
  const [skippedF, setSkippedF] = useState<'all' | 'yes' | 'no'>('all');
  const [search, setSearch] = useState('');

  const [readModal, setReadModal] = useState<{ id: number; markdown: string; ran_at?: string | null } | null>(null);
  const [readLoading, setReadLoading] = useState(false);

  const [queueBatches, setQueueBatches] = useState<ProductSourcesQueueBatchRow[]>([]);
  const [queueMigrationNeeded, setQueueMigrationNeeded] = useState(false);

  const loadQueue = useCallback(async () => {
    try {
      const r = await fetchProductSourcesQueue({ limit: 40 });
      setQueueBatches(r.batches || []);
      setQueueMigrationNeeded(!!r.migrationNeeded);
    } catch {
      setQueueBatches([]);
      setQueueMigrationNeeded(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchProductSourcesRuns({ limit: loadLimit, offset: 0 });
      setRuns(r.runs);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [loadLimit]);

  useEffect(() => {
    void load();
    void loadQueue();
  }, [load, loadQueue]);

  const filtered = useMemo(() => {
    return runs.filter((row) => {
      if (statusF !== 'all' && row.status !== statusF) return false;
      if (skippedF === 'yes' && !row.skipped) return false;
      if (skippedF === 'no' && row.skipped) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const blob = [
          String(row.id),
          row.notion_source_id || '',
          row.markdown_preview || '',
          row.error_message || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [runs, statusF, skippedF, search]);

  const openRead = async (id: number) => {
    setReadLoading(true);
    try {
      const r = await fetchProductSourcesRunById(id);
      const md = r.run.report_markdown || '';
      setReadModal({
        id,
        markdown: md || '_(Nessun Markdown per questa run.)_',
        ran_at: r.run.ran_at,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setReadLoading(false);
    }
  };

  const handleDownload = async (id: number) => {
    try {
      const r = await fetchProductSourcesRunById(id);
      const md = r.run.report_markdown || '';
      if (!md.trim()) {
        alert('Nessun Markdown da scaricare per questa run.');
        return;
      }
      downloadMd(id, md, r.run.ran_at);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const handlePrStub = async (id: number) => {
    try {
      const r = await productSourcesRunAction(id, 'request_pr_stub');
      alert(r.message || 'OK');
      void load();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSetPr = async (id: number) => {
    const url = window.prompt('URL della PR su GitHub (https://github.com/...):');
    if (!url?.trim()) return;
    try {
      await productSourcesRunAction(id, 'set_pr_url', url.trim());
      void load();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const handleResetGit = async (id: number) => {
    if (!window.confirm('Azzerare lo stato Git per questa run?')) return;
    try {
      await productSourcesRunAction(id, 'reset_git');
      void load();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const activeQueueBatch = queueBatches.find(
    (b) => b.status === 'pending_work' && (b.pending_jobs > 0 || b.running_jobs > 0),
  );

  return (
    <>
      <section className="brutal-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <h2 className="section-title" style={{ marginTop: 0 }}>
          Storico documenti (cron)
        </h2>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1rem' }}>
          Ogni riga è una run salvata in <code>product_sources_cron_runs</code>: Markdown completo in DB, riepilogo qui.
          <strong>Git / PR:</strong> sempre <strong>manuali</strong> (sicurezza): apri tu la PR sul repo, poi usa{' '}
          <strong>Segna PR</strong> per incollare l’URL e tenere traccia in dashboard. Il pulsante «In lavorazione» serve
          solo a segnare che stai lavorando alla PR (nessun accesso automatico al repo).{' '}
          <strong>Fase 7:</strong> naming file e checklist in <code>docs/PRODUCT-SOURCES-GIT-WORKFLOW.md</code> nel monorepo.
        </p>

        {queueMigrationNeeded && (
          <div
            role="status"
            style={{
              marginBottom: '1rem',
              padding: '0.65rem 0.85rem',
              border: '2px dashed var(--muted-fg, #888)',
              fontSize: '0.8rem',
              background: 'var(--card-bg, #f9f9f9)',
            }}
          >
            <strong>Coda Fase 3:</strong> esegui la migration{' '}
            <code style={{ fontSize: '0.75rem' }}>006_product_sources_queue.sql</code> sul DB per abilitare il monitoraggio
            batch.
          </div>
        )}

        {activeQueueBatch && (
          <div
            role="status"
            style={{
              marginBottom: '1rem',
              padding: '0.65rem 0.85rem',
              border: '2px solid var(--accent, #f5a623)',
              fontSize: '0.8rem',
              background: '#fff8e8',
            }}
          >
            <strong>Coda Fase 3 attiva</strong> — batch <code>#{activeQueueBatch.id}</code>:{' '}
            <strong>{activeQueueBatch.pending_jobs}</strong> job in attesa
            {activeQueueBatch.running_jobs > 0 ? (
              <>
                {' '}
                · <strong>{activeQueueBatch.running_jobs}</strong> in esecuzione (ripresi al prossimo hit se bloccati)
              </>
            ) : null}
            . Completati <strong>{activeQueueBatch.completed_jobs}</strong> /{' '}
            <strong>{activeQueueBatch.total_jobs}</strong>. Il cron consumerà fino a{' '}
            <code>PRODUCT_SOURCES_QUEUE_MAX_JOBS</code> per invocazione; per svuotare più in fretta aggiungi un secondo
            schedule Vercel sullo stesso endpoint o chiama manualmente con <code>?key=CRON_SECRET</code>.
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'flex-end',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span className="brutal-label" style={{ fontSize: '0.7rem' }}>
              Stato run
            </span>
            <select
              className="brutal-input"
              style={{ minWidth: '8rem', fontSize: '0.8rem' }}
              value={statusF}
              onChange={(e) => setStatusF(e.target.value as 'all' | 'ok' | 'error')}
            >
              <option value="all">Tutti</option>
              <option value="ok">ok</option>
              <option value="error">error</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span className="brutal-label" style={{ fontSize: '0.7rem' }}>
              Saltata (gate 3gg)
            </span>
            <select
              className="brutal-input"
              style={{ minWidth: '8rem', fontSize: '0.8rem' }}
              value={skippedF}
              onChange={(e) => setSkippedF(e.target.value as 'all' | 'yes' | 'no')}
            >
              <option value="all">Tutte</option>
              <option value="yes">Sì</option>
              <option value="no">No</option>
            </select>
          </div>
          <div style={{ flex: '1 1 12rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span className="brutal-label" style={{ fontSize: '0.7rem' }}>
              Cerca (id, sorgente, anteprima…)
            </span>
            <input
              className="brutal-input"
              type="search"
              placeholder="Filtra in pagina…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ fontSize: '0.8rem' }}
            />
          </div>
          <button type="button" className="brutal-btn" onClick={() => void load()} disabled={loading}>
            Aggiorna
          </button>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--muted-fg, #555)', marginBottom: '0.75rem' }}>
          Mostrate {filtered.length} righe su {runs.length} caricate (totale DB: {total}). Filtri sulla pagina
          corrente; aumenta il limite per vedere run più vecchie.
        </p>

        {error && (
          <div
            role="alert"
            style={{
              padding: '0.75rem',
              border: '2px solid var(--alert, #c00)',
              background: '#fee',
              fontWeight: 700,
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        {loading && <p className="loading">Caricamento…</p>}

        {!loading && filtered.length === 0 && (
          <p style={{ fontSize: '0.9rem' }}>Nessuna run in elenco. Esegui il cron o la migration sul database.</p>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.75rem',
                border: '2px solid var(--black, #000)',
              }}
            >
              <thead>
                <tr style={{ background: 'var(--muted, #eee)' }}>
                  <th style={th}>ID</th>
                  <th style={th}>Data</th>
                  <th style={th}>Stato</th>
                  <th style={th}>Skip</th>
                  <th style={th}>Link</th>
                  <th style={th}>LI</th>
                  <th style={th}>Discord</th>
                  <th style={th}>Git / PR</th>
                  <th style={th}>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} style={{ borderTop: '2px solid var(--black, #000)' }}>
                    <td style={td}>{row.id}</td>
                    <td style={td}>{formatWhen(row.ran_at)}</td>
                    <td style={td}>{row.status}</td>
                    <td style={td}>{row.skipped ? 'sì' : 'no'}</td>
                    <td style={td}>{row.link_count ?? '—'}</td>
                    <td style={td}>{row.linkedin_urls_attempted ?? '—'}</td>
                    <td style={td}>
                      {row.discord_notified === true ? 'Sì' : row.discord_notified === false ? 'No' : '—'}
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span>{GIT_LABEL[row.github_sync_status || 'not_sent'] || row.github_sync_status}</span>
                        {row.github_pr_url && (
                          <a href={row.github_pr_url} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>
                            Apri PR
                          </a>
                        )}
                      </div>
                    </td>
                    <td style={{ ...td, whiteSpace: 'normal' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        <button
                          type="button"
                          className="brutal-btn"
                          style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem' }}
                          onClick={() => void openRead(row.id)}
                          disabled={readLoading}
                        >
                          Leggi
                        </button>
                        <button
                          type="button"
                          className="brutal-btn"
                          style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem' }}
                          onClick={() => void handleDownload(row.id)}
                        >
                          Scarica .md
                        </button>
                        <button
                          type="button"
                          className="brutal-btn"
                          style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem' }}
                          onClick={() => void handlePrStub(row.id)}
                        >
                          In lavorazione
                        </button>
                        <button
                          type="button"
                          className="brutal-btn"
                          style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem' }}
                          onClick={() => void handleSetPr(row.id)}
                        >
                          Segna PR
                        </button>
                        <button
                          type="button"
                          className="brutal-btn"
                          style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', opacity: 0.85 }}
                          onClick={() => void handleResetGit(row.id)}
                        >
                          Reset Git
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && runs.length < total && (
          <div style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="brutal-btn"
              onClick={() => setLoadLimit((n) => Math.min(n + 80, total > 0 ? total : n + 80))}
            >
              Carica altre run ({total - runs.length} ancora nel DB…)
            </button>
          </div>
        )}
      </section>

      {readModal && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="read-md-title"
          onClick={() => setReadModal(null)}
        >
          <div
            className="brutal-card"
            style={{ maxWidth: 'min(960px, 100%)', width: '100%', padding: '1rem', maxHeight: '90vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="read-md-title" style={{ marginTop: 0 }}>
              Run #{readModal.id} — Markdown
            </h3>
            <textarea
              className="brutal-input"
              readOnly
              value={readModal.markdown}
              rows={22}
              style={{ width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem' }}
            />
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="brutal-btn"
                onClick={() => downloadMd(readModal.id, readModal.markdown, readModal.ran_at)}
              >
                Scarica
              </button>
              <button type="button" className="brutal-btn" onClick={() => setReadModal(null)}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const th: CSSProperties = {
  textAlign: 'left',
  padding: '0.35rem 0.5rem',
  borderRight: '2px solid var(--black, #000)',
  fontSize: '0.68rem',
  textTransform: 'uppercase',
};

const td: CSSProperties = {
  padding: '0.35rem 0.5rem',
  borderRight: '2px solid var(--black, #000)',
  verticalAlign: 'top',
};
