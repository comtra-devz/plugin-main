import { useCallback, useEffect, useState } from 'react';
import {
  fetchGenerateGovernance,
  postGenerateGovernance,
  type GeneratePlaybookRow,
} from '../api';
import PageHeader from '../components/PageHeader';

export default function GenerateGovernance() {
  const [playbooks, setPlaybooks] = useState<GeneratePlaybookRow[]>([]);
  const [tovJson, setTovJson] = useState('{}');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchGenerateGovernance();
      setPlaybooks(d.playbooks || []);
      setTovJson(JSON.stringify(d.tov?.prompt_overrides ?? {}, null, 2));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveTov = async () => {
    setSaveMsg(null);
    try {
      const parsed = JSON.parse(tovJson) as Record<string, unknown>;
      await postGenerateGovernance({ action: 'save_tov', prompt_overrides: parsed });
      setSaveMsg('Salvato.');
      void load();
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'JSON non valido o errore salvataggio');
    }
  };

  const createPlaybook = async () => {
    setSaveMsg(null);
    try {
      await postGenerateGovernance({
        action: 'create_playbook',
        title: newTitle.trim(),
        body: newBody,
      });
      setNewTitle('');
      setNewBody('');
      setSaveMsg('Playbook creato.');
      void load();
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Errore');
    }
  };

  const deletePlaybook = async (id: string) => {
    if (!window.confirm('Eliminare questo playbook?')) return;
    try {
      await postGenerateGovernance({ action: 'delete_playbook', id });
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    }
  };

  return (
    <>
      <PageHeader title="Generate — governance" />
      <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9rem', maxWidth: 760 }}>
        §8.2 — Playbook (archivio) e ToV in JSON. Il motore <code className="mono">POST /api/agents/generate</code>{' '}
        legge <code className="mono">generate_tov_config</code> sul DB <strong>dell&apos;auth</strong>{' '}
        (<code className="mono">POSTGRES_URL</code> progetto auth-deploy): dev&apos;essere lo stesso Postgres che usa
        questa dashboard, oppure va copiato/syncato il record. Preferisci chiavi brevi nel JSON:{' '}
        <code className="mono">assistant_style_notes</code>, <code className="mono">instructions</code>. Migrazione:{' '}
        <code className="mono">015_generate_playbooks_and_tov.sql</code>.
      </p>

      {loading && <p className="loading">Caricamento…</p>}
      {error && (
        <div className="brutal-card" style={{ borderColor: '#c62828', marginBottom: '1rem' }}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}
      {saveMsg && (
        <p role="status" style={{ fontWeight: 700, marginBottom: '0.75rem' }}>
          {saveMsg}
        </p>
      )}

      {!loading && (
        <>
          <div className="brutal-card" style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ marginTop: 0, fontSize: '1rem' }}>ToV / policy (JSON)</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: 0 }}>
              Struttura libera (es. <code className="mono">tone</code>, <code className="mono">assistant_style_notes</code>
              ). Il server generate va aggiornato per leggere questi campi — oggi è storage + audit.
            </p>
            <textarea
              className="brutal-input"
              rows={12}
              value={tovJson}
              onChange={(e) => setTovJson(e.target.value)}
              style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
            />
            <button type="button" className="brutal-btn" style={{ marginTop: '0.5rem' }} onClick={() => void saveTov()}>
              Salva ToV
            </button>
          </div>

          <div className="brutal-card" style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Nuovo playbook</h2>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Titolo</span>
              <input
                className="brutal-input"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{ width: '100%', marginTop: '0.25rem' }}
              />
            </label>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Testo (snippet prompt)</span>
              <textarea
                className="brutal-input"
                rows={5}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                style={{ width: '100%', marginTop: '0.25rem' }}
              />
            </label>
            <button type="button" className="brutal-btn" onClick={() => void createPlaybook()}>
              Aggiungi playbook
            </button>
          </div>

          <div className="brutal-card">
            <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Playbook salvati</h2>
            {playbooks.length === 0 ? (
              <p style={{ margin: 0, color: 'var(--muted)' }}>Nessuno ancora.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                {playbooks.map((p) => (
                  <li key={p.id} style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <strong>{p.title}</strong>
                      <button type="button" className="brutal-btn" onClick={() => void deletePlaybook(p.id)}>
                        Elimina
                      </button>
                    </div>
                    <pre
                      style={{
                        margin: '0.35rem 0 0',
                        whiteSpace: 'pre-wrap',
                        fontSize: '0.78rem',
                        fontFamily: 'inherit',
                        maxHeight: 160,
                        overflow: 'auto',
                      }}
                    >
                      {p.body || '—'}
                    </pre>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  );
}
