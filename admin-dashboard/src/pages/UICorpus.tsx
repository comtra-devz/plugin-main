import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import {
  fetchUICorpus,
  ingestUICorpusFromFigma,
  setUICorpusStatusBulk,
  setUICorpusStatus,
  type UICorpusItem,
} from '../api';

type CorpusStatus = 'draft' | 'approved' | 'rejected' | 'archived' | '';
type DsState = 'connected' | 'inferred' | 'unknown' | 'none';

function splitTags(input: string): string[] {
  return input
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 32);
}

function parseFigmaLinkPreview(raw: string): {
  valid: boolean;
  message: string;
  fileKey?: string;
  nodeId?: string | null;
  kind?: 'file' | 'node';
} {
  const s = raw.trim();
  if (!s) return { valid: false, message: 'Incolla un link Figma per iniziare.' };
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { valid: false, message: 'URL non valido.' };
  }
  if (!/figma\.com$/i.test(u.hostname) && !/\.figma\.com$/i.test(u.hostname)) {
    return { valid: false, message: 'Il link deve essere su figma.com.' };
  }
  const m = u.pathname.match(/\/(?:file|design)\/([a-zA-Z0-9]+)/);
  if (!m?.[1]) return { valid: false, message: 'Non trovo il file key nel link.' };
  const fileKey = m[1];
  const nodeId = (u.searchParams.get('node-id') || '').trim() || null;
  if (nodeId) {
    return {
      valid: true,
      fileKey,
      nodeId,
      kind: 'node',
      message:
        'Hai incollato un link a una schermata specifica (node-id presente). Se vuoi importare tutto il file, seleziona "Auto".',
    };
  }
  return {
    valid: true,
    fileKey,
    nodeId: null,
    kind: 'file',
    message: 'Link file completo rilevato. Con modalità "Auto" importeremo tutte le schermate trovate.',
  };
}

function stripNodeIdFromFigmaUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.searchParams.delete('node-id');
    return u.toString();
  } catch {
    return raw;
  }
}

export default function UICorpus() {
  const navigate = useNavigate();
  const [items, setItems] = useState<UICorpusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [migrationNeeded, setMigrationNeeded] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<CorpusStatus>('draft');
  const [archetype, setArchetype] = useState('');

  const [figmaUrl, setFigmaUrl] = useState('');
  const [figmaToken, setFigmaToken] = useState('');
  const [showTokenHelp, setShowTokenHelp] = useState(false);
  const [importMode, setImportMode] = useState<'auto' | 'single'>('auto');
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [siteDomain, setSiteDomain] = useState('');
  const [brandKey, setBrandKey] = useState('');
  const [designSystemId, setDesignSystemId] = useState('');
  const [dsState, setDsState] = useState<DsState>('unknown');
  const [quickTags, setQuickTags] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
  const figmaPreview = useMemo(() => parseFigmaLinkPreview(figmaUrl), [figmaUrl]);
  const draftItems = useMemo(() => items.filter((x) => x.status === 'draft'), [items]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => items.some((x) => x.id === id)));
  }, [items]);

  const onImportFigma = async () => {
    const figma = figmaUrl.trim();
    if (!figma) return setError('Il link Figma e obbligatorio.');
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const wantsWholeFile = importMode === 'auto';
      const effectiveUrl =
        figmaPreview.kind === 'node' && wantsWholeFile ? stripNodeIdFromFigmaUrl(figma) : figma;
      const effectiveMode = wantsWholeFile ? 'auto' : 'single';
      const out = await ingestUICorpusFromFigma({
        figma_url: effectiveUrl,
        figma_token: figmaToken.trim() || undefined,
        mode: effectiveMode,
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
      setOkMsg(
        effectiveMode === 'auto'
          ? `Import completo riuscito: ${out.inserted} schermate aggiunte in bozza.`
          : `Import singolo riuscito: ${out.inserted} schermata aggiunta in bozza.`,
      );
      await reload();
      setStep(2);
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

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllDrafts = () => {
    setSelectedIds(draftItems.map((x) => x.id));
  };

  const clearSelection = () => setSelectedIds([]);

  const bulkUpdate = async (next: Exclude<CorpusStatus, ''>) => {
    if (selectedIds.length === 0) return;
    setError(null);
    setOkMsg(null);
    try {
      const out = await setUICorpusStatusBulk(selectedIds, next);
      setOkMsg(`Aggiornati ${out.updated} elementi a "${next}".`);
      setSelectedIds([]);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore bulk update');
    }
  };

  return (
    <>
      <PageHeader
        title="Generate · UI Corpus · Import"
        actions={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="brutal-btn" onClick={() => navigate('/generate-corpus')}>
              Back to recap
            </button>
            <button type="button" className="brutal-btn" onClick={() => void reload()}>
              Refresh
            </button>
          </div>
        }
      />
      <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Importa interfacce da Figma, poi revisionale e approvale in coda.
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
          Incolla un link Figma. In modalità Auto importiamo tutte le schermate del file, in modalità Single ne importiamo una sola.
        </p>
        <div style={{ display: 'grid', gap: '0.65rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
            <button
              type="button"
              className="brutal-btn"
              onClick={() => setStep(1)}
              style={{ opacity: step === 1 ? 1 : 0.65 }}
            >
              1) Import
            </button>
            <button
              type="button"
              className="brutal-btn"
              onClick={() => setStep(2)}
              style={{ opacity: step === 2 ? 1 : 0.65 }}
            >
              2) Review
            </button>
          </div>

          {step === 1 ? (
            <>
          <label className="brutal-label">Figma link (required)</label>
          <input
            className="brutal-input"
            value={figmaUrl}
            onChange={(e) => setFigmaUrl(e.target.value)}
            placeholder="https://www.figma.com/file/... or ...?node-id=..."
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label className="brutal-label" style={{ marginBottom: 0 }}>
                Figma token (personal)
              </label>
              <button
                type="button"
                className="brutal-btn"
                onClick={() => setShowTokenHelp(true)}
                style={{ padding: '0.05rem 0.45rem', lineHeight: 1.2 }}
                aria-label="Come recuperare il token Figma"
                title="Come recuperare il token Figma"
              >
                i
              </button>
            </div>
            <input
              className="brutal-input"
              type="password"
              value={figmaToken}
              onChange={(e) => setFigmaToken(e.target.value)}
              placeholder="figd_... (il tuo personal access token)"
              autoComplete="off"
            />
          </div>
          <div
            style={{
              border: '2px solid #000',
              background: figmaPreview.valid ? '#ecfccb' : '#fef2f2',
              color: '#111',
              fontSize: '0.86rem',
              padding: '0.5rem 0.65rem',
              boxShadow: '3px 3px 0 0 #000',
            }}
          >
            {figmaPreview.message}
            {figmaPreview.fileKey ? (
              <div style={{ marginTop: 4, color: '#334155' }}>
                file_key: <code>{figmaPreview.fileKey}</code>
                {figmaPreview.nodeId ? (
                  <>
                    {' '}
                    · node_id: <code>{figmaPreview.nodeId}</code>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.65rem' }}>
            <div>
              <label className="brutal-label">Import mode</label>
              <select className="brutal-input" value={importMode} onChange={(e) => setImportMode(e.target.value as 'auto' | 'single')}>
                <option value="auto">Auto (importa tutto il file)</option>
                <option value="single">Single (una schermata)</option>
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
            <button type="button" className="brutal-btn primary" onClick={() => void onImportFigma()} disabled={saving}>
              {saving ? 'Importing…' : 'Import from Figma'}
            </button>
          </div>
            </>
          ) : (
            <div style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>
              Hai importato? Passa alla Review queue qui sotto per approvare/rifiutare in blocco.
            </div>
          )}
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
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
          <button type="button" className="brutal-btn" onClick={selectAllDrafts}>
            Select all drafts ({draftItems.length})
          </button>
          <button type="button" className="brutal-btn" onClick={clearSelection}>
            Clear selection
          </button>
          <button type="button" className="brutal-btn" onClick={() => void bulkUpdate('approved')} disabled={selectedIds.length === 0}>
            Approve selected ({selectedIds.length})
          </button>
          <button type="button" className="brutal-btn" onClick={() => void bulkUpdate('rejected')} disabled={selectedIds.length === 0}>
            Reject selected
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
                <th />
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
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(it.id)}
                      onChange={() => toggleSelection(it.id)}
                      aria-label={`Select ${it.title || it.id}`}
                    />
                  </td>
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
      {showTokenHelp ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="figma-token-help-title"
          onClick={() => setShowTokenHelp(false)}
        >
          <div
            className="brutal-card"
            style={{ maxWidth: 680, width: '100%', background: '#fff' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="figma-token-help-title" style={{ marginTop: 0, marginBottom: '0.75rem' }}>
              Come recuperare il token da Figma
            </h3>
            <ol style={{ marginTop: 0, paddingLeft: '1.1rem' }}>
              <li>Apri Figma dal browser con il tuo account.</li>
              <li>Vai su Settings → Security (o Account settings).</li>
              <li>Cerca la sezione Personal access tokens.</li>
              <li>Clicca Generate new token, dai un nome e conferma.</li>
              <li>Copia il token (di solito inizia con <code>figd_</code>).</li>
              <li>Incollalo nel campo "Figma token (personal)" e importa il link.</li>
            </ol>
            <p style={{ color: 'var(--muted)', marginTop: '0.75rem' }}>
              Nota: il token segue i tuoi permessi. Se non hai accesso a un file, quell'import fallira.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="brutal-btn" onClick={() => setShowTokenHelp(false)}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

