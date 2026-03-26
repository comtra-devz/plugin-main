import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchSupportFeedback, type SupportFeedbackItem } from '../api';
import PageHeader from '../components/PageHeader';

type PriorityLevel = 'low' | 'medium' | 'high';
type SolvedState = 'no' | 'on_hold' | 'yes';

interface RowMeta {
  priority: PriorityLevel;
  solved: SolvedState;
}

type RowMetaMap = Record<string, RowMeta>;

const META_STORAGE_KEY = 'admin_support_row_meta_v1';

const PRIORITY_STYLE: Record<PriorityLevel, { label: string; bg: string; color: string }> = {
  low: { label: 'Basso', bg: '#e8f5e9', color: '#1b5e20' },
  medium: { label: 'Medio', bg: '#fff8e1', color: '#7a5b00' },
  high: { label: 'Alto', bg: '#ffebee', color: '#b71c1c' },
};

const SOLVED_LABELS: Record<SolvedState, string> = {
  no: 'No',
  on_hold: 'On hold',
  yes: 'Yes',
};

function defaultMeta(): RowMeta {
  return { priority: 'medium', solved: 'no' };
}

function loadMeta(): RowMetaMap {
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RowMetaMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveMeta(map: RowMetaMap): void {
  try {
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota / private mode issues
  }
}

function renderSignal(item: SupportFeedbackItem): string {
  if (item.source !== 'Support Ticket') {
    if (item.thumbs === 'up') return '👍 Positivo';
    if (item.thumbs === 'down') return '👎 Negativo';
    return '—';
  }

  const ticketType = (item.variant || '').toUpperCase().trim();
  if (ticketType === 'BUG') return '🐛 Bug';
  if (ticketType === 'FEATURE') return '🚀 Feature';
  if (ticketType === 'AUDIT') return '🛠 Audit';
  if (ticketType === 'DISCARD') return '🗂 Discard';
  if (ticketType === 'DOCS') return '📚 Docs';
  return `📝 ${item.variant || 'Ticket'}`;
}

interface ParsedSupportRow {
  requestId: string;
  sourceDetail: string;
  issueType: string;
  issueCategory: string;
  commentText: string;
}

interface SupportTableRow {
  rowKey: string;
  item: SupportFeedbackItem;
  parsed: ParsedSupportRow;
}

function parseSupportRow(item: SupportFeedbackItem): ParsedSupportRow {
  if (item.source !== 'Support Ticket') {
    return {
      requestId: item.id || '—',
      sourceDetail: item.source,
      issueType: item.variant || 'A/B',
      issueCategory: 'Feedback',
      commentText: item.comment || '—',
    };
  }

  const raw = item.comment || '';
  const issueCategory = (raw.match(/\[([^\]]+)\]/)?.[1] || 'Support').trim();
  const tab = (raw.match(/Tab:\s*([^.\n]+)/i)?.[1] || '').trim();
  const scope = (raw.match(/Scope:\s*([^.\n]+)/i)?.[1] || '').trim();
  const issueId = (raw.match(/IssueId:\s*([A-Za-z0-9_-]+)/i)?.[1] || item.id || '—').trim();
  const commentMatch = raw.match(/Comment:\s*([\s\S]*)$/i);
  const commentText = (commentMatch?.[1] || raw || '—').trim();
  const sourceDetail = [tab ? `Tab ${tab}` : '', scope ? `Scope ${scope}` : ''].filter(Boolean).join(' · ') || '—';

  return {
    requestId: issueId,
    sourceDetail,
    issueType: (item.variant || 'Ticket').toUpperCase(),
    issueCategory,
    commentText,
  };
}

export default function SupportRequests() {
  const [items, setItems] = useState<SupportFeedbackItem[]>([]);
  const [metaById, setMetaById] = useState<RowMetaMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyItem, setReplyItem] = useState<SupportFeedbackItem | null>(null);
  const tableWrapRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    setMetaById(loadMeta());
  }, []);

  const tableRows = useMemo<SupportTableRow[]>(
    () =>
      items.map((item) => {
        const rowKey = `${item.source}-${item.id}-${item.created_at}`;
        return { rowKey, item, parsed: parseSupportRow(item) };
      }),
    [items]
  );

  const getMeta = useCallback(
    (rowKey: string): RowMeta => metaById[rowKey] || defaultMeta(),
    [metaById]
  );

  const updateMeta = useCallback((rowKey: string, patch: Partial<RowMeta>) => {
    setMetaById((prev) => {
      const next = {
        ...prev,
        [rowKey]: { ...(prev[rowKey] || defaultMeta()), ...patch },
      };
      saveMeta(next);
      return next;
    });
  }, []);

  const stats = {
    total: tableRows.length,
    supportTickets: tableRows.filter((r) => r.item.source === 'Support Ticket').length,
    abFeedback: tableRows.filter((r) => r.item.source !== 'Support Ticket').length,
    highPriority: tableRows.filter((r) => getMeta(r.rowKey).priority === 'high').length,
    solvedYes: tableRows.filter((r) => getMeta(r.rowKey).solved === 'yes').length,
    onHold: tableRows.filter((r) => getMeta(r.rowKey).solved === 'on_hold').length,
  };

  const scrollTable = (dir: 'left' | 'right') => {
    const wrap = tableWrapRef.current;
    if (!wrap) return;
    wrap.scrollBy({ left: dir === 'left' ? -360 : 360, behavior: 'smooth' });
  };

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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          <MetricCard label="Totale righe" value={stats.total} />
          <MetricCard label="Support ticket" value={stats.supportTickets} />
          <MetricCard label="Feedback A/B" value={stats.abFeedback} />
          <MetricCard label="Priorita alta" value={stats.highPriority} />
          <MetricCard label="Solved: Yes" value={stats.solvedYes} />
          <MetricCard label="On hold" value={stats.onHold} />
        </div>
      )}

      {!loading && !error && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
              Tabella estesa: usa le frecce per vedere tutte le colonne.
            </p>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button type="button" className="brutal-btn" onClick={() => scrollTable('left')}>←</button>
              <button type="button" className="brutal-btn" onClick={() => scrollTable('right')}>→</button>
            </div>
          </div>
        <div className="brutal-table-wrap" ref={tableWrapRef}>
          <table className="brutal-table">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Origine</th>
                <th scope="col">Tipo / Segnale</th>
                <th scope="col">ID richiesta</th>
                <th scope="col">Dettaglio provenienza</th>
                <th scope="col">Tipologia issue</th>
                <th scope="col">Categoria</th>
                <th scope="col">Priorita</th>
                <th scope="col">Reply</th>
                <th scope="col">Solved</th>
                <th scope="col">Commento</th>
                <th scope="col">Utente</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(({ rowKey, item: r, parsed }) => (
                <tr key={rowKey}>
                  <td className="mono" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    {new Date(r.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>{r.source}</td>
                  <td>{renderSignal(r)}</td>
                  <td className="mono" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{parsed.requestId}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{parsed.sourceDetail}</td>
                  <td><strong>{parsed.issueType}</strong></td>
                  <td>{parsed.issueCategory}</td>
                  <td>
                    <PrioritySelector
                      value={getMeta(rowKey).priority}
                      onChange={(priority) => updateMeta(rowKey, { priority })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        margin: 0,
                        textDecoration: 'underline',
                        fontWeight: 700,
                        cursor: 'pointer',
                        color: 'var(--black)',
                        opacity: 0.75,
                      }}
                      onClick={() => setReplyItem(r)}
                    >
                      Reply (preview)
                    </button>
                  </td>
                  <td>
                    <SolvedSelector
                      value={getMeta(rowKey).solved}
                      onChange={(solved) => updateMeta(rowKey, { solved })}
                    />
                  </td>
                  <td style={{ minWidth: 320, maxWidth: 420 }}>{parsed.commentText}</td>
                  <td className="mono" style={{ fontSize: '0.85rem' }}>{r.user_masked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="brutal-card" style={{ marginTop: '1rem' }}>
          <p className="loading">Nessun feedback nel periodo.</p>
        </div>
      )}

      {replyItem && (
        <ReplyDialog
          item={replyItem}
          onClose={() => setReplyItem(null)}
        />
      )}
    </>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="brutal-card" style={{ padding: '0.8rem' }}>
      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function PrioritySelector({
  value,
  onChange,
}: {
  value: PriorityLevel;
  onChange: (next: PriorityLevel) => void;
}) {
  const style = PRIORITY_STYLE[value];
  return (
    <select
      className="brutal-select"
      value={value}
      onChange={(e) => onChange(e.target.value as PriorityLevel)}
      style={{
        minWidth: 112,
        background: style.bg,
        color: style.color,
        fontWeight: 700,
      }}
      title="Priorita"
    >
      <option value="low">{PRIORITY_STYLE.low.label}</option>
      <option value="medium">{PRIORITY_STYLE.medium.label}</option>
      <option value="high">{PRIORITY_STYLE.high.label}</option>
    </select>
  );
}

function SolvedSelector({
  value,
  onChange,
}: {
  value: SolvedState;
  onChange: (next: SolvedState) => void;
}) {
  return (
    <select
      className="brutal-select"
      value={value}
      onChange={(e) => onChange(e.target.value as SolvedState)}
      style={{ minWidth: 96 }}
    >
      <option value="no">{SOLVED_LABELS.no}</option>
      <option value="on_hold">{SOLVED_LABELS.on_hold}</option>
      <option value="yes">{SOLVED_LABELS.yes}</option>
    </select>
  );
}

function ReplyDialog({
  item,
  onClose,
}: {
  item: SupportFeedbackItem;
  onClose: () => void;
}) {
  const fromSupport = item.source === 'Support Ticket';
  const defaultSubject = fromSupport
    ? `[Support] Riscontro su ticket ${item.variant || 'generico'}`
    : '[Feedback] Risposta al tuo commento';

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        className="brutal-card"
        style={{ width: 'min(760px, 100%)', maxHeight: '90vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>Reply (preview)</h3>
        <p style={{ marginTop: 0, color: 'var(--muted)' }}>
          Editor pronto ma invio disattivato: in futuro collegheremo provider mail (es. LemonSqueezy API).
        </p>

        <div style={{ display: 'grid', gap: '0.8rem' }}>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span className="brutal-label">Destinatario (mascherato)</span>
            <input className="brutal-input" value={item.user_masked} disabled />
          </label>

          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span className="brutal-label">Oggetto</span>
            <input className="brutal-input" defaultValue={defaultSubject} disabled />
          </label>

          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span className="brutal-label">Messaggio</span>
            <textarea
              className="brutal-input"
              rows={8}
              defaultValue={`Ciao,\n\nabbiamo ricevuto il tuo messaggio (${item.variant || 'supporto'}).\n\nRisposta operativa:\n- \n- \n\nGrazie,\nTeam Comtra`}
              disabled
              style={{ resize: 'vertical' }}
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
              Nota: per invio reale serve endpoint backend con email non mascherata.
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="brutal-btn" onClick={onClose}>Chiudi</button>
              <button type="button" className="brutal-btn primary" disabled style={{ opacity: 0.55, cursor: 'not-allowed' }}>
                Invia (soon)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
