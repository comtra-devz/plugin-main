import { useEffect, useState } from 'react';
import { fetchWeeklyUpdates, type WeeklyUpdateItem } from '../api';
import PageHeader from '../components/PageHeader';
import {
  PLACEHOLDER_WEEKLY_UPDATES,
  UPDATE_CATEGORY_LABELS,
  type UpdateCategory,
} from '../data/weeklyUpdates';

const CATEGORY_STYLE: Record<string, { bg: string; border: string }> = {
  FEAT: { bg: 'var(--yellow)', border: 'var(--black)' },
  FIX: { bg: 'var(--pink)', border: 'var(--black)' },
  DOCS: { bg: 'var(--white)', border: 'var(--black)' },
  CHORE: { bg: 'var(--muted)', border: 'var(--black)' },
  REFACTOR: { bg: 'var(--yellow)', border: 'var(--black)' },
  SECURITY: { bg: 'var(--alert)', border: 'var(--black)' },
  STYLE: { bg: 'var(--white)', border: 'var(--black)' },
};

export default function WeeklyUpdates() {
  const [updatesList, setUpdatesList] = useState<WeeklyUpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'github' | 'placeholder'>('placeholder');
  const [categoryFilter, setCategoryFilter] = useState<UpdateCategory | 'ALL'>('ALL');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWeeklyUpdates(50)
      .then((r) => {
        if (cancelled) return;
        if (r.updates?.length) {
          setUpdatesList(r.updates);
          setSource(r.source === 'github' ? 'github' : 'placeholder');
        } else {
          setUpdatesList(PLACEHOLDER_WEEKLY_UPDATES);
          setSource('placeholder');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUpdatesList(PLACEHOLDER_WEEKLY_UPDATES);
          setSource('placeholder');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const updates =
    categoryFilter === 'ALL'
      ? updatesList
      : updatesList.filter((u) => u.category === categoryFilter);

  const categories: (UpdateCategory | 'ALL')[] = ['ALL', ...(Object.keys(UPDATE_CATEGORY_LABELS) as UpdateCategory[])];

  return (
    <>
      <PageHeader title="Aggiornamenti" />
      <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
        {source === 'github'
          ? 'Aggiornamenti derivati automaticamente dai commit del repository (conventional commits).'
          : 'Aggiornamenti da repository: imposta GITHUB_REPO (e opzionale GITHUB_TOKEN) nel progetto dashboard per abilitare il sync automatico.'}
      </p>
      {loading && <p className="loading">Caricamento…</p>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <label className="brutal-label" style={{ width: '100%' }}>Categoria</label>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`brutal-btn ${categoryFilter === cat ? 'primary' : ''}`}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            onClick={() => setCategoryFilter(cat)}
          >
            {cat === 'ALL' ? 'Tutte' : (UPDATE_CATEGORY_LABELS[cat as UpdateCategory] || cat)}
          </button>
        ))}
      </div>

      {!loading && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {updates.map((u) => (
          <WeeklyUpdateCard key={u.id} update={u} />
        ))}
      </div>
      )}

      {!loading && updates.length === 0 && (
        <div className="brutal-card">
          <p className="loading">Nessun update per la categoria selezionata.</p>
        </div>
      )}
    </>
  );
}

function WeeklyUpdateCard({ update }: { update: WeeklyUpdateItem }) {
  const style = CATEGORY_STYLE[update.category] || CATEGORY_STYLE.CHORE;
  return (
    <div className="brutal-card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div
        style={{
          padding: '0.25rem 0.5rem',
          fontSize: '0.7rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          background: style.bg,
          border: `2px solid ${style.border}`,
          minWidth: 80,
          textAlign: 'center',
        }}
      >
        {update.category}
      </div>
      <div style={{ flex: '1 1 280px', minWidth: 0 }}>
        <div style={{ fontWeight: 800, marginBottom: 4 }}>{update.title}</div>
        <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>{update.description}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 6 }}>
          {new Date(update.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
          {update.commitHash && (
            <> · <code>{update.commitHash}</code></>
          )}
        </div>
      </div>
    </div>
  );
}
