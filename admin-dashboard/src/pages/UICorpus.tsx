import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import {
  fetchUICorpus,
  ingestUICorpusBatch,
  ingestUICorpusExample,
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

  const [title, setTitle] = useState('');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [notes, setNotes] = useState('');
  const [quality, setQuality] = useState('4');
  const [tags, setTags] = useState('');
  const [sections, setSections] = useState('');
  const [platform, setPlatform] = useState('');

  const [batchText, setBatchText] = useState('');

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

  const onIngestOne = async () => {
    if (!summary.trim() && !title.trim()) {
      setError('Inserisci almeno titolo o summary.');
      return;
    }
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const qNum = Number(quality);
      await ingestUICorpusExample({
        title: title.trim(),
        figma_url: figmaUrl.trim(),
        prompt_summary: summary.trim(),
        notes: notes.trim(),
        quality_score: Number.isFinite(qNum) ? qNum : undefined,
        tags: splitTags(tags),
        sections: splitTags(sections),
        platform: platform.trim().toLowerCase(),
      });
      setOkMsg('Esempio ingestito in draft con tagging automatico.');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore ingest');
    } finally {
      setSaving(false);
    }
  };

  const onIngestBatch = async () => {
    if (!batchText.trim()) return setError('Incolla un JSON array per il batch ingest.');
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const parsed = JSON.parse(batchText);
      if (!Array.isArray(parsed)) throw new Error('Il JSON deve essere un array di esempi.');
      const out = await ingestUICorpusBatch(parsed as Array<Record<string, unknown>>);
      setOkMsg(`Batch ingest completato: ${out.inserted} esempi.`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore ingest batch');
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
        <h3 className="section-title">Ingest singolo (auto-tag)</h3>
        <div style={{ display: 'grid', gap: '0.65rem' }}>
          <label className="brutal-label">Title</label>
          <input className="brutal-input" value={title} onChange={(e) => setTitle(e.target.value)} />

          <label className="brutal-label">Figma URL (optional)</label>
          <input className="brutal-input" value={figmaUrl} onChange={(e) => setFigmaUrl(e.target.value)} />

          <label className="brutal-label">Summary / Prompt</label>
          <textarea className="brutal-input" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} />

          <label className="brutal-label">Notes (optional)</label>
          <textarea className="brutal-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.65rem' }}>
            <div>
              <label className="brutal-label">Quality 0..5</label>
              <input className="brutal-input" value={quality} onChange={(e) => setQuality(e.target.value)} />
            </div>
            <div>
              <label className="brutal-label">Platform override</label>
              <input className="brutal-input" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="mobile/desktop" />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="brutal-label">Tags (comma separated)</label>
              <input className="brutal-input" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
          </div>

          <label className="brutal-label">Sections (comma separated)</label>
          <input className="brutal-input" value={sections} onChange={(e) => setSections(e.target.value)} />

          <div>
            <button type="button" className="brutal-btn" onClick={() => void onIngestOne()} disabled={saving}>
              {saving ? 'Saving…' : 'Ingest in draft'}
            </button>
          </div>
        </div>
      </div>

      <div className="brutal-card" style={{ marginBottom: '1rem' }}>
        <h3 className="section-title">Batch ingest (JSON array)</h3>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          Incolla un array JSON di esempi. Ogni item puo includere: title, figma_url/source_url, prompt_summary, notes, tags, sections.
        </p>
        <textarea
          className="brutal-input"
          rows={8}
          value={batchText}
          onChange={(e) => setBatchText(e.target.value)}
          placeholder='[{"title":"Checkout A","prompt_summary":"Mobile checkout with sticky CTA"}]'
          style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
        />
        <div style={{ marginTop: '0.75rem' }}>
          <button type="button" className="brutal-btn" onClick={() => void onIngestBatch()} disabled={saving}>
            {saving ? 'Processing…' : 'Run batch ingest'}
          </button>
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

