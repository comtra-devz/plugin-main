import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import {
  fetchUICorpus,
  ingestUICorpusFromFigma,
  setUICorpusStatus,
  type UICorpusItem,
} from '../api';

type CorpusStatus = 'draft' | 'approved' | 'rejected' | 'archived' | '';

function splitTags(input: string): string[] {
  return input
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 32);
}

export default function UICorpus() {
  const [items, setItems] = useState<UICorpusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [migrationNeeded, setMigrationNeeded] = useState(false);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<CorpusStatus>('draft');
  const [archetype, setArchetype] = useState('');

  const [figmaUrl, setFigmaUrl] = useState('');
  const [importMode, setImportMode] = useState<'auto' | 'single'>('auto');
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [siteDomain, setSiteDomain] = useState('');
  const [brandKey, setBrandKey] = useState('');
  const [designSystemId, setDesignSystemId] = useState('');
  const [dsState, setDsState] = useState<'connected' | 'inferred' | 'unknown' | 'none'>('unknown');
  const [quickTags, setQuickTags] = useState('');

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUICorpus({
        q: q.trim(),
        status,
        archetype: archetype.trim(),
        limit: 120,
        offset: 0,
      });
      setItems(data.items || []);
      setMigrationNeeded(Boolean(data.migration_needed));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento corpus');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const archetypeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.archetype, (map.get(item.archetype) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [items]);

  const onImportFigma = async () => {
    const figma = figmaUrl.trim();
    if (!figma) return setError('Il link Figma e obbligatorio.');
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const out = await ingestUICorpusFromFigma({
        figma_url: figma,
        mode: importMode,
        project: {
          project_id: projectId.trim() || undefined,
          project_name: projectName.trim() || undefined,
          site_domain: siteDomain.trim() || undefined,
          brand_key: brandKey.trim() || undefined,
          design_system_id: designSystemId.trim() || undefined,
          ds_state: dsState,
          tags: splitTags(quickTags),
        },
      });
      setOkMsg(`Import completato: ${out.inserted} schermate in draft.`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore import da Figma');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, next: Exclude<CorpusStatus, ''>) => {
    setError(null);
    setOkMsg(null);
    try {
      await setUICorpusStatus(id, next);
      setOkMsg(`Stato aggiornato: ${next}.`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore update stato');
    }
  };

  return (
    <>
      <PageHeader
        title="UI Corpus"
        actions={
          <button type="button" className="brutal-btn" onClick={() => void reload()}>
            Refresh
          </button>
        }
      />
      <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Ingest automatico di interfacce con classificazione archetype/platform e review queue.
      </p>
      {migrationNeeded ? (
        <p className="error">
          Migrazione mancante: esegui <code>024_ui_corpus_examples.sql</code> sul DB admin/auth.
        </p>
      ) : null}
      {error && <p className="error">{error}</p>}
      {okMsg && <p style={{ color: 'var(--ok)', fontWeight: 700 }}>{okMsg}</p>}

      <div className="brutal-card" style={{ marginBottom: '1rem' }}>
        <h3 className="section-title">Import from Figma</h3>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Incolla un link file/frame Figma. Il sistema legge il file e crea automaticamente le schermate del corpus.
        </p>
        <div style={{ display: 'grid', gap: '0.65rem' }}>
          <label className="brutal-label">Figma link (required)</label>
          <input
            className="brutal-input"
            value={figmaUrl}
            onChange={(e) => setFigmaUrl(e.target.value)}
            placeholder="https://www.figma.com/file/... or ...?node-id=..."
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.65rem' }}>
            <div>
              <label className="brutal-label">Import mode</label>
              <select className="brutal-input" value={importMode} onChange={(e) => setImportMode(e.target.value as 'auto' | 'single')}>
                <option value="auto">Auto (many screens from file)</option>
                <option value="single">Single screen</option>
              </select>
            </div>
            <div>
              <label className="brutal-label">DS state</label>
              <select className="brutal-input" value={dsState} onChange={(e) => setDsState(e.target.value as any)}>
                <option value="unknown">unknown</option>
                <option value="connected">connected</option>
                <option value="inferred">inferred</option>
                <option value="none">none</option>
              </select>
            </div>
          </div>

          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Project metadata (optional)</summary>
            <div style={{ display: 'grid', gap: '0.65rem', marginTop: '0.6rem' }}>
              <input className="brutal-input" value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="project_id (es. acme_checkout_revamp)" />
              <input className="brutal-input" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="project_name" />
              <input className="brutal-input" value={siteDomain} onChange={(e) => setSiteDomain(e.target.value)} placeholder="site_domain (es. acme.com)" />
              <input className="brutal-input" value={brandKey} onChange={(e) => setBrandKey(e.target.value)} placeholder="brand_key (optional)" />
              <input className="brutal-input" value={designSystemId} onChange={(e) => setDesignSystemId(e.target.value)} placeholder="design_system_id (optional)" />
              <input className="brutal-input" value={quickTags} onChange={(e) => setQuickTags(e.target.value)} placeholder="quick tags (comma separated)" />
            </div>
          </details>

          <div>
            <button type="button" className="brutal-btn" onClick={() => void onImportFigma()} disabled={saving}>
              {saving ? 'Importing…' : 'Import from Figma'}
            </button>
          </div>
        </div>
      </div>

      <div className="brutal-card">
        <h3 className="section-title">Review queue</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.6rem', marginBottom: '0.8rem' }}>
          <input className="brutal-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title/url/archetype…" />
          <input className="brutal-input" value={archetype} onChange={(e) => setArchetype(e.target.value)} placeholder="archetype filter" />
          <select className="brutal-input" value={status} onChange={(e) => setStatus(e.target.value as CorpusStatus)}>
            <option value="">all status</option>
            <option value="draft">draft</option>
            <option value="approved">approved</option>
            <option value="rejected">rejected</option>
            <option value="archived">archived</option>
          </select>
          <button type="button" className="brutal-btn" onClick={() => void reload()}>
            Apply
          </button>
        </div>

        {loading ? (
          <p className="loading">Loading…</p>
        ) : items.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>Nessun esempio trovato.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Archetype</th>
                <th>Platform</th>
                <th>Quality</th>
                <th>Status</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>
                    <div style={{ maxWidth: 320 }}>
                      <div style={{ fontWeight: 700 }}>{it.title || '(untitled)'}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', overflowWrap: 'anywhere' }}>
                        {it.source_url || 'no source url'}
                      </div>
                    </div>
                  </td>
                  <td><code>{it.archetype}</code></td>
                  <td>{it.platform}</td>
                  <td>{it.quality_score ?? '—'}</td>
                  <td>{it.status}</td>
                  <td>{new Date(it.updated_at).toLocaleString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button type="button" className="brutal-btn" onClick={() => void updateStatus(it.id, 'approved')}>
                        Approve
                      </button>
                      <button type="button" className="brutal-btn" onClick={() => void updateStatus(it.id, 'rejected')}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {archetypeCounts.length > 0 ? (
          <div style={{ marginTop: '0.75rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
            Top archetypes in current list:{' '}
            {archetypeCounts.map(([k, n]) => `${k} (${n})`).join(' · ')}
          </div>
        ) : null}
      </div>
    </>
  );
}

