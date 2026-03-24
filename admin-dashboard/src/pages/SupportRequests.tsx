import { useCallback, useEffect, useState } from 'react';
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

export default function SupportRequests() {
  const [items, setItems] = useState<SupportFeedbackItem[]>([]);
  const [metaById, setMetaById] = useState<RowMetaMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyItem, setReplyItem] = useState<SupportFeedbackItem | null>(null);

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

  const getMeta = useCallback(
    (itemId: string): RowMeta => metaById[itemId] || defaultMeta(),
    [metaById]
  );

  const updateMeta = useCallback((itemId: string, patch: Partial<RowMeta>) => {
    setMetaById((prev) => {
      const next = {
        ...prev,
        [itemId]: { ...(prev[itemId] || defaultMeta()), ...patch },
      };
      saveMeta(next);
      return next;
    });
  }, []);

  const stats = {
    total: items.length,
    supportTickets: items.filter((i) => i.source === 'Support Ticket').length,
    abFeedback: items.filter((i) => i.source !== 'Support Ticket').length,
    highPriority: items.filter((i) => getMeta(i.id).priority === 'high').length,
    solvedYes: items.filter((i) => getMeta(i.id).solved === 'yes').length,
    onHold: items.filter((i) => getMeta(i.id).solved === 'on_hold').length,
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
        <div className="brutal-table-wrap">
          <table className="brutal-table">
            <thead>
              <tr>
                <th scope="col">Data</th>
                <th scope="col">Origine</th>
                <th scope="col">Tipo / Segnale</th>
                <th scope="col">Priorita</th>
                <th scope="col">Reply</th>
                <th scope="col">Solved</th>
                <th scope="col">Commento</th>
                <th scope="col">Utente</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={`${r.source}-${r.id}-${r.created_at}`}>
                  <td className="mono" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    {new Date(r.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>{r.source}</td>
                  <td>{renderSignal(r)}</td>
                  <td>
                    <PrioritySelector
                      value={getMeta(r.id).priority}
                      onChange={(priority) => updateMeta(r.id, { priority })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="brutal-btn"
                      style={{ opacity: 0.6 }}
                      onClick={() => setReplyItem(r)}
                    >
                      Reply (preview)
                    </button>
                  </td>
                  <td>
                    <SolvedSelector
                      value={getMeta(r.id).solved}
                      onChange={(solved) => updateMeta(r.id, { solved })}
                    />
                  </td>
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
  return (
    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
      {(['low', 'medium', 'high'] as PriorityLevel[]).map((level) => {
        const style = PRIORITY_STYLE[level];
        const active = value === level;
        return (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            style={{
              border: '2px solid var(--black)',
              background: style.bg,
              color: style.color,
              fontWeight: 700,
              fontSize: '0.72rem',
              padding: '0.2rem 0.45rem',
              opacity: active ? 1 : 0.45,
              cursor: 'pointer',
            }}
            title={`Priorita ${style.label}`}
          >
            {style.label}
          </button>
        );
      })}
    </div>
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
