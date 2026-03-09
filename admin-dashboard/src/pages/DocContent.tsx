import { useEffect, useState } from 'react';
import { fetchDocContent, saveDocContent, type DocContentData } from '../api';
import PageHeader from '../components/PageHeader';

const TUTORIAL_KEYS = ['WORKFLOW', 'ASSETS', 'SYNC'] as const;

export default function DocContent() {
  const [data, setData] = useState<DocContentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('WORKFLOW');

  const load = () => {
    setLoading(true);
    setError(null);
    fetchDocContent()
      .then((r) => {
        setData(r.data);
        if (r.data?.tutorials && !activeTab) setActiveTab('WORKFLOW');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    setSaveOk(false);
    saveDocContent(data)
      .then(() => {
        setSaveOk(true);
        setTimeout(() => setSaveOk(false), 3000);
      })
      .catch((e) => setError(e.message))
      .finally(() => setSaving(false));
  };

  const updateHeader = (field: 'title' | 'subtitle', value: string) => {
    if (!data) return;
    setData({
      ...data,
      header: { ...data.header, [field]: value },
    });
  };

  const updateTutorial = (key: string, field: 'title' | 'content', value: string) => {
    if (!data) return;
    setData({
      ...data,
      tutorials: {
        ...data.tutorials,
        [key]: { ...(data.tutorials[key] || { title: '', content: '' }), [field]: value },
      },
    });
  };

  const updateVideo = (index: number, field: string, value: string) => {
    if (!data) return;
    const videos = [...(data.videos || [])];
    if (!videos[index]) videos[index] = { id: `v${index + 1}`, title: '', time: '', url: '' };
    (videos[index] as Record<string, string>)[field] = value;
    setData({ ...data, videos });
  };

  const addVideo = () => {
    if (!data) return;
    const id = `v${(data.videos?.length ?? 0) + 1}`;
    setData({
      ...data,
      videos: [...(data.videos || []), { id, title: '', time: '', url: '' }],
    });
  };

  const removeVideo = (index: number) => {
    if (!data) return;
    const videos = [...(data.videos || [])];
    videos.splice(index, 1);
    setData({ ...data, videos });
  };

  const updateFaq = (index: number, field: 'q' | 'a', value: string) => {
    if (!data) return;
    const faqs = [...(data.faqs || [])];
    if (!faqs[index]) faqs[index] = { q: '', a: '' };
    faqs[index] = { ...faqs[index], [field]: value };
    setData({ ...data, faqs });
  };

  const addFaq = () => {
    if (!data) return;
    setData({
      ...data,
      faqs: [...(data.faqs || []), { q: '', a: '' }],
    });
  };

  const removeFaq = (index: number) => {
    if (!data) return;
    const faqs = [...(data.faqs || [])];
    faqs.splice(index, 1);
    setData({ ...data, faqs });
  };

  if (loading) return <><PageHeader title="Documentation CMS" /><p className="loading">Caricamento…</p></>;
  if (error) return <><PageHeader title="Documentation CMS" /><p className="error">{error}</p></>;
  if (!data) return <><PageHeader title="Documentation CMS" /><p className="error">Nessun dato</p></>;

  return (
    <>
      <PageHeader
        title="Documentation CMS"
        actions={
          <button
            type="button"
            className="brutal-btn primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Salvataggio…' : saveOk ? 'Salvato ✓' : 'Salva'}
          </button>
        }
      />
      <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Contenuto della sezione Documentation & Help nel plugin. Supporta <strong>HTML</strong> per bold, code, liste. I moduli (tutorials, video, FAQ) sono esattamente come nel plugin.
      </p>

      {/* Header */}
      <section className="brutal-card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="section-title">Header</h2>
        <div className="form-group">
          <label className="brutal-label">Titolo</label>
          <input
            type="text"
            className="brutal-input"
            value={data.header?.title ?? ''}
            onChange={(e) => updateHeader('title', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="brutal-label">Sottotitolo</label>
          <input
            type="text"
            className="brutal-input"
            value={data.header?.subtitle ?? ''}
            onChange={(e) => updateHeader('subtitle', e.target.value)}
          />
        </div>
      </section>

      {/* Interactive Guides (Tutorials) */}
      <section className="brutal-card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="section-title">Interactive Guides</h2>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {TUTORIAL_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`brutal-btn ${activeTab === key ? 'primary' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {key}
            </button>
          ))}
        </div>
        {TUTORIAL_KEYS.map((key) => (
          <div key={key} style={{ display: activeTab === key ? 'block' : 'none' }}>
            <div className="form-group">
              <label className="brutal-label">Titolo tab {key}</label>
              <input
                type="text"
                className="brutal-input"
                value={data.tutorials?.[key]?.title ?? ''}
                onChange={(e) => updateTutorial(key, 'title', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="brutal-label">Contenuto HTML (usa &lt;strong&gt;, &lt;code&gt;, &lt;em&gt;, &lt;p&gt;, &lt;ol&gt;, &lt;li&gt;, &lt;div class="..."&gt;)</label>
              <textarea
                className="brutal-input"
                rows={12}
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                value={data.tutorials?.[key]?.content ?? ''}
                onChange={(e) => updateTutorial(key, 'content', e.target.value)}
              />
            </div>
          </div>
        ))}
      </section>

      {/* Video Tutorials */}
      <section className="brutal-card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="section-title">Video Tutorials</h2>
        {(data.videos || []).map((vid, i) => (
          <div key={vid.id || i} className="form-group" style={{ border: '1px solid var(--muted)', padding: '1rem', marginBottom: '0.5rem', borderRadius: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <strong>Video {i + 1}</strong>
              <button type="button" className="brutal-btn" style={{ fontSize: '0.75rem' }} onClick={() => removeVideo(i)}>Rimuovi</button>
            </div>
            <div className="form-group">
              <label className="brutal-label">Titolo</label>
              <input type="text" className="brutal-input" value={vid.title} onChange={(e) => updateVideo(i, 'title', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="brutal-label">Durata (es. 5:00)</label>
              <input type="text" className="brutal-input" value={vid.time} onChange={(e) => updateVideo(i, 'time', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="brutal-label">URL YouTube</label>
              <input type="url" className="brutal-input" value={vid.url} onChange={(e) => updateVideo(i, 'url', e.target.value)} />
            </div>
          </div>
        ))}
        <button type="button" className="brutal-btn" onClick={addVideo}>+ Aggiungi video</button>
      </section>

      {/* FAQ */}
      <section className="brutal-card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="section-title">Frequent Questions & Costs</h2>
        {(data.faqs || []).map((faq, i) => (
          <div key={i} className="form-group" style={{ border: '1px solid var(--muted)', padding: '1rem', marginBottom: '0.5rem', borderRadius: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <strong>FAQ {i + 1}</strong>
              <button type="button" className="brutal-btn" style={{ fontSize: '0.75rem' }} onClick={() => removeFaq(i)}>Rimuovi</button>
            </div>
            <div className="form-group">
              <label className="brutal-label">Domanda</label>
              <input type="text" className="brutal-input" value={faq.q} onChange={(e) => updateFaq(i, 'q', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="brutal-label">Risposta</label>
              <textarea className="brutal-input" rows={3} value={faq.a} onChange={(e) => updateFaq(i, 'a', e.target.value)} />
            </div>
          </div>
        ))}
        <button type="button" className="brutal-btn" onClick={addFaq}>+ Aggiungi FAQ</button>
      </section>

      <button
        type="button"
        className="brutal-btn primary"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Salvataggio…' : saveOk ? 'Salvato ✓' : 'Salva modifiche'}
      </button>
    </>
  );
}
