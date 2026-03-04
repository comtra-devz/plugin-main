import { useMemo, useState } from 'react';
import {
  PLACEHOLDER_SECURITY_LOGS,
  EVENT_CATEGORY_LABELS,
  SEVERITY_LABELS,
  FIX_CATEGORY_LABELS,
  type SecurityLogEntry,
  type SecurityEventCategory,
  type SecuritySeverity,
} from '../data/securityLogs';

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export default function SecurityLogs() {
  const [categoryFilter, setCategoryFilter] = useState<SecurityEventCategory | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<SecuritySeverity | 'ALL'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filtered = useMemo(() => {
    let list = [...PLACEHOLDER_SECURITY_LOGS].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    if (categoryFilter !== 'ALL') list = list.filter((e) => e.category === categoryFilter);
    if (severityFilter !== 'ALL') list = list.filter((e) => e.severity === severityFilter);
    if (dateFrom) list = list.filter((e) => toDateOnly(e.date) >= dateFrom);
    if (dateTo) list = list.filter((e) => toDateOnly(e.date) <= dateTo);
    return list;
  }, [categoryFilter, severityFilter, dateFrom, dateTo]);

  const categories: (SecurityEventCategory | 'ALL')[] = ['ALL', ...(Object.keys(EVENT_CATEGORY_LABELS) as SecurityEventCategory[])];
  const severities: (SecuritySeverity | 'ALL')[] = ['ALL', ...(Object.keys(SEVERITY_LABELS) as SecuritySeverity[])];

  return (
    <>
      <h1 className="page-title">Security & Logs</h1>
      <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Categorie evento: Login, Login fallito, Cambio ruolo, Uso API key, Export dati, Config, Patch sicurezza, Accesso revocato.
        Severità: Info, Warning, Critical. Fix: Patch, Config, Revoca accesso, Reset password. Placeholder: nessun collegamento a log reali.
      </p>

      <div className="brutal-card" style={{ marginBottom: '1rem' }}>
        <h3 className="section-title" style={{ marginBottom: '0.5rem' }}>Filtri</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label className="brutal-label">Categoria</label>
            <select
              className="brutal-input"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as SecurityEventCategory | 'ALL')}
              style={{ width: '100%' }}
            >
              <option value="ALL">Tutte</option>
              {(categories.filter((c) => c !== 'ALL') as SecurityEventCategory[]).map((c) => (
                <option key={c} value={c}>{EVENT_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="brutal-label">Severità</label>
            <select
              className="brutal-input"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as SecuritySeverity | 'ALL')}
              style={{ width: '100%' }}
            >
              <option value="ALL">Tutte</option>
              {(severities.filter((s) => s !== 'ALL') as SecuritySeverity[]).map((s) => (
                <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="brutal-label">Data da</label>
            <input type="date" className="brutal-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="brutal-label">Data a</label>
            <input type="date" className="brutal-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="brutal-table-wrap">
        <table className="brutal-table">
          <thead>
            <tr>
              <th>Data / Ora</th>
              <th>Categoria</th>
              <th>Severità</th>
              <th>Descrizione</th>
              <th>IP</th>
              <th>Fix</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id}>
                <td className="mono" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                  {new Date(e.date).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td>{EVENT_CATEGORY_LABELS[e.category]}</td>
                <td><SeverityBadge severity={e.severity} /></td>
                <td style={{ maxWidth: 320 }}>{e.description}</td>
                <td className="mono" style={{ fontSize: '0.85rem' }}>{e.ip ?? '—'}</td>
                <td>{e.fixCategory ? FIX_CATEGORY_LABELS[e.fixCategory] : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="brutal-card" style={{ marginTop: '1rem' }}>
          <p className="loading">Nessuna voce per i filtri selezionati.</p>
        </div>
      )}
    </>
  );
}

function SeverityBadge({ severity }: { severity: SecuritySeverity }) {
  const style =
    severity === 'Critical'
      ? { background: 'var(--alert)', color: 'var(--white)' }
      : severity === 'Warning'
        ? { background: 'var(--yellow)', color: 'var(--black)' }
        : { background: 'var(--muted)', color: 'var(--white)' };
  return (
    <span className="badge" style={style}>
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
