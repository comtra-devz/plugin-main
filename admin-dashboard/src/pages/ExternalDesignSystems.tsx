import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import {
  fetchExternalDesignSystems,
  upsertExternalDesignSystem,
  type ExternalDesignSystemItem,
  type ExternalDesignSystemStatus,
} from '../api';

function prettyJson(v: unknown): string {
  try {
    return JSON.stringify(v ?? {}, null, 2);
  } catch {
    return '{}';
  }
}

function defaultPackageStub(name: string) {
  return {
    ds_id: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    manifest: { name, version: '1.0.0' },
    tokens: {},
    rules: {},
    components: { components: {} },
  };
}

export default function ExternalDesignSystems() {
  const [items, setItems] = useState<ExternalDesignSystemItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [slug, setSlug] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dsSource, setDsSource] = useState('');
  const [status, setStatus] = useState<ExternalDesignSystemStatus>('draft');
  const [packageText, setPackageText] = useState(prettyJson(defaultPackageStub('New DS')));

  const selected = useMemo(
    () => items.find((i) => i.slug === slug.trim().toLowerCase()) ?? null,
    [items, slug],
  );

  const reload = async () => {
    setLoading(true);
    try {
      const data = await fetchExternalDesignSystems();
      setItems(data.items || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const resetForm = () => {
    setSlug('');
    setDisplayName('');
    setDsSource('');
    setStatus('draft');
    setPackageText(prettyJson(defaultPackageStub('New DS')));
  };

  const loadItem = (item: ExternalDesignSystemItem) => {
    setSlug(item.slug);
    setDisplayName(item.display_name);
    setDsSource(item.ds_source);
    setStatus(item.status);
    setPackageText(prettyJson(item.ds_package));
  };

  const save = async () => {
    const s = slug.trim().toLowerCase();
    const name = displayName.trim();
    const source = dsSource.trim();
    if (!s) return setError('Slug obbligatorio');
    if (!name) return setError('Display name obbligatorio');
    if (!source) return setError('DS source obbligatorio');
    let parsed: Record<string, unknown>;
    try {
      const raw = JSON.parse(packageText);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Formato non valido');
      parsed = raw as Record<string, unknown>;
    } catch (e) {
      return setError(`JSON non valido: ${e instanceof Error ? e.message : 'parse error'}`);
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const out = await upsertExternalDesignSystem({
        slug: s,
        display_name: name,
        ds_source: source,
        status,
        ds_package: parsed,
      });
      setMessage(`Salvato: ${out.slug} (${out.status})`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore salvataggio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="External Design Systems"
        actions={
          <button type="button" className="brutal-btn" onClick={() => void reload()}>
            Refresh
          </button>
        }
      />
      <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Gestisci DS esterni pubblicati nel plugin. Salva in <strong>draft</strong>, poi passa a{' '}
        <strong>published</strong> per farli apparire nel dropdown Generate.
      </p>

      {error && <p className="error">{error}</p>}
      {message && <p style={{ color: 'var(--ok)', fontWeight: 700 }}>{message}</p>}

      <div className="brutal-card" style={{ marginBottom: '1rem' }}>
        <h3 className="section-title">Catalogo</h3>
        {loading ? (
          <p className="loading">Caricamento…</p>
        ) : items.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>Nessun DS esterno presente.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Display name</th>
                <th>Slug</th>
                <th>Source</th>
                <th>Status</th>
                <th>Aggiornato</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.slug}>
                  <td>{it.display_name}</td>
                  <td><code>{it.slug}</code></td>
                  <td><code>{it.ds_source}</code></td>
                  <td>{it.status}</td>
                  <td>{new Date(it.updated_at).toLocaleString()}</td>
                  <td>
                    <button type="button" className="brutal-btn" onClick={() => loadItem(it)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="brutal-card">
        <h3 className="section-title">{selected ? `Modifica: ${selected.display_name}` : 'Nuovo DS esterno'}</h3>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <label className="brutal-label">Display name</label>
          <input className="brutal-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />

          <label className="brutal-label">Slug</label>
          <input className="brutal-input" value={slug} onChange={(e) => setSlug(e.target.value)} />

          <label className="brutal-label">DS source (runtime key)</label>
          <input className="brutal-input" value={dsSource} onChange={(e) => setDsSource(e.target.value)} />

          <label className="brutal-label">Status</label>
          <select
            className="brutal-input"
            value={status}
            onChange={(e) => setStatus(e.target.value as ExternalDesignSystemStatus)}
            style={{ width: 'fit-content' }}
          >
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>

          <label className="brutal-label">DS package (JSON)</label>
          <textarea
            className="brutal-input"
            value={packageText}
            onChange={(e) => setPackageText(e.target.value)}
            rows={18}
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
          />

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" className="brutal-btn" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="brutal-btn" onClick={resetForm} disabled={saving}>
              New
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
