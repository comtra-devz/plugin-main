import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { fetchUICorpus, type UICorpusListResponse } from '../api';

export default function UICorpusOverview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<UICorpusListResponse | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const out = await fetchUICorpus({ limit: 1, offset: 0 });
        setData(out);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Errore caricamento UI Corpus');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const byStatus = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of data?.stats?.by_status || []) m.set(row.status, row.c);
    return {
      draft: m.get('draft') || 0,
      approved: m.get('approved') || 0,
      rejected: m.get('rejected') || 0,
      archived: m.get('archived') || 0,
    };
  }, [data]);

  return (
    <>
      <PageHeader
        title="Generate · UI Corpus"
        actions={
          <button type="button" className="brutal-btn primary" onClick={() => navigate('/generate-corpus/import')}>
            Import files
          </button>
        }
      />
      <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.92rem' }}>
        Panoramica di cosa il sistema sta mappando dalle interfacce caricate.
      </p>

      {error ? <p className="error">{error}</p> : null}

      <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
        <div className="brutal-card">
          <div className="section-title">Total</div>
          <div style={{ fontWeight: 800, fontSize: '1.35rem' }}>{data?.total ?? 0}</div>
        </div>
        <div className="brutal-card">
          <div className="section-title">Draft</div>
          <div style={{ fontWeight: 800, fontSize: '1.35rem' }}>{byStatus.draft}</div>
        </div>
        <div className="brutal-card">
          <div className="section-title">Approved</div>
          <div style={{ fontWeight: 800, fontSize: '1.35rem' }}>{byStatus.approved}</div>
        </div>
        <div className="brutal-card">
          <div className="section-title">Rejected/Archived</div>
          <div style={{ fontWeight: 800, fontSize: '1.35rem' }}>{byStatus.rejected + byStatus.archived}</div>
        </div>
      </div>

      <div className="brutal-card">
        <h3 className="section-title">Recap mapping</h3>
        {loading ? (
          <p className="loading">Loading…</p>
        ) : (data?.total || 0) === 0 ? (
          <div>
            <p style={{ marginTop: 0, marginBottom: '0.8rem' }}>
              Nessuna interfaccia caricata al momento. Inizia importando un file Figma.
            </p>
            <button
              type="button"
              className="brutal-btn primary"
              onClick={() => navigate('/generate-corpus/import')}
            >
              Import from Figma
            </button>
          </div>
        ) : (
          <>
            <p style={{ marginTop: 0 }}>
              Il corpus sta gia raccogliendo pattern utili per il generate pipeline (archetype, platform, segnali progetto/DS).
            </p>
            <div style={{ marginTop: '0.75rem', color: 'var(--muted)', fontSize: '0.88rem' }}>
              Top archetypes:{' '}
              {(data?.stats?.top_archetypes || []).length > 0
                ? (data?.stats?.top_archetypes || [])
                    .slice(0, 8)
                    .map((x) => `${x.archetype} (${x.c})`)
                    .join(' · ')
                : 'n/d'}
            </div>
          </>
        )}
      </div>
    </>
  );
}

