import { useState } from 'react';
import PageHeader from '../components/PageHeader';
import {
  PLACEHOLDER_SUPPORT_REQUESTS,
  SUPPORT_STATUS_LABELS,
  type SupportRequest,
  type SupportRequestStatus,
} from '../data/supportRequests';

const STATUS_ORDER: SupportRequestStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'];

export default function SupportRequests() {
  const [statusFilter, setStatusFilter] = useState<SupportRequestStatus | 'ALL'>('ALL');
  const requests =
    statusFilter === 'ALL'
      ? [...PLACEHOLDER_SUPPORT_REQUESTS].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
      : PLACEHOLDER_SUPPORT_REQUESTS.filter((r) => r.status === statusFilter);

  return (
    <>
      <PageHeader title="Supporto" />
      <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Placeholder: nessun collegamento a backend. In futuro: integrazione con sistema di ticketing.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          type="button"
          className={`brutal-btn ${statusFilter === 'ALL' ? 'primary' : ''}`}
          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
          onClick={() => setStatusFilter('ALL')}
        >
          Tutti
        </button>
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            className={`brutal-btn ${statusFilter === s ? 'primary' : ''}`}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            onClick={() => setStatusFilter(s)}
          >
            {SUPPORT_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="brutal-table-wrap">
        <table className="brutal-table">
          <thead>
            <tr>
              <th scope="col">Stato</th>
              <th scope="col">Oggetto</th>
              <th scope="col">Descrizione</th>
              <th scope="col">Utente</th>
              <th scope="col">Creato</th>
              <th scope="col">Aggiornato</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td style={{ fontWeight: 700 }}>{r.subject}</td>
                <td style={{ maxWidth: 280 }}>{r.description}</td>
                <td className="mono" style={{ fontSize: '0.85rem' }}>{r.userRef ?? '—'}</td>
                <td>{new Date(r.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                <td>{r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {requests.length === 0 && (
        <div className="brutal-card" style={{ marginTop: '1rem' }}>
          <p className="loading">Nessuna richiesta per lo stato selezionato.</p>
        </div>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: SupportRequestStatus }) {
  const style =
    status === 'DONE'
      ? { background: 'var(--ok)', color: 'var(--black)' }
      : status === 'IN_PROGRESS'
        ? { background: 'var(--yellow)', color: 'var(--black)' }
        : { background: 'var(--black)', color: 'var(--white)' };
  return (
    <span className="badge" style={style}>
      {SUPPORT_STATUS_LABELS[status]}
    </span>
  );
}
