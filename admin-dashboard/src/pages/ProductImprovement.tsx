import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { scanNotionProductSources, type NotionProductSourcesResponse } from '../api';
import ProductSourcesHistory from './ProductSourcesHistory';

type Tab = 'scan' | 'history';

export default function ProductImprovement() {
  const [tab, setTab] = useState<Tab>('scan');
  const [pageId, setPageId] = useState('');
  const [databaseId, setDatabaseId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NotionProductSourcesResponse | null>(null);
  const [gitStep, setGitStep] = useState<0 | 1 | 2>(0);
  const [gitConfirmText, setGitConfirmText] = useState('');

  useEffect(() => {
    if (tab !== 'scan') {
      setGitStep(0);
      setGitConfirmText('');
    }
  }, [tab]);

  const runScan = () => {
    const p = pageId.trim();
    const d = databaseId.trim();
    if (!p && !d) {
      setError('Inserisci un Page ID oppure un Database ID Notion (o configura le variabili env sul deploy).');
      return;
    }
    if (p && d) {
      setError('Usa solo uno tra Page ID e Database ID per questa scansione.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    scanNotionProductSources(p ? { pageId: p } : { databaseId: d })
      .then(setResult)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  const copyMarkdown = () => {
    if (!result?.markdown) return;
    void navigator.clipboard.writeText(result.markdown);
  };

  const closeGitModal = () => {
    setGitStep(0);
    setGitConfirmText('');
  };

  const finalizeGitStub = () => {
    if (gitConfirmText.trim().toUpperCase() !== 'CONFERMA') return;
    closeGitModal();
    alert(
      'Collegamento Git non ancora attivo: usa il report Markdown per aprire una PR manuale sul repo del plugin. ' +
        'In seguito potremo collegare GitHub App / workflow per branch + PR automatica.',
    );
  };

  return (
    <>
      <PageHeader
        title="Migliorie prodotto (Notion)"
        actions={
          tab === 'scan' ? (
            <button type="button" className="brutal-btn" onClick={runScan} disabled={loading}>
              {loading ? 'Scansione…' : 'Estrai link da Notion'}
            </button>
          ) : null
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          type="button"
          className={`brutal-btn ${tab === 'scan' ? 'primary' : ''}`}
          style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
          onClick={() => setTab('scan')}
        >
          Scansione manuale Notion
        </button>
        <button
          type="button"
          className={`brutal-btn ${tab === 'history' ? 'primary' : ''}`}
          style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
          onClick={() => setTab('history')}
        >
          Storico cron &amp; documenti (Git/Discord)
        </button>
      </div>

      {tab === 'history' && <ProductSourcesHistory />}

      {tab === 'scan' && (
        <>
      <section className="brutal-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <h2 className="section-title" style={{ marginTop: 0 }}>
          Sorgente Notion
        </h2>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1rem' }}>
          Crea un’<strong>integration</strong> su Notion, poi condividi la pagina o il database con quella
          integration. Imposta <code>NOTION_INTEGRATION_TOKEN</code> su Vercel. Opzionale:{' '}
          <code>NOTION_PRODUCT_SOURCES_PAGE_ID</code> o <code>NOTION_PRODUCT_SOURCES_DATABASE_ID</code> per non
          incollare l’ID ogni volta.
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted-fg, #555)', marginBottom: '1rem' }}>
          I blocchi che contengono <strong>Antigravity</strong> vengono ignorati (nessun link estratto da quel blocco).
          Consideriamo solo URL <code>http(s)</code>; niente suggerimenti codice non linkati.
        </p>
        <div style={{ display: 'grid', gap: '0.75rem', maxWidth: '32rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Page ID (pagina singola con link)</span>
            <input
              className="brutal-input"
              value={pageId}
              onChange={(e) => {
                setPageId(e.target.value);
                if (e.target.value) setDatabaseId('');
              }}
              placeholder="es. a1b2c3d4-...."
              disabled={loading}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Database ID (una riga = una fonte / pagina)</span>
            <input
              className="brutal-input"
              value={databaseId}
              onChange={(e) => {
                setDatabaseId(e.target.value);
                if (e.target.value) setPageId('');
              }}
              placeholder="es. e5f6...."
              disabled={loading}
            />
          </label>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          style={{
            padding: '0.75rem',
            border: '2px solid var(--alert, #c00)',
            background: '#fee',
            fontWeight: 700,
            fontSize: '0.85rem',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <>
          <section className="brutal-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>
              Riepilogo
            </h2>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
              <li>
                Modalità: <strong>{result.mode}</strong> — ID: <code>{result.sourceId}</code>
              </li>
              <li>
                Link unici: <strong>{result.linkCount}</strong>
              </li>
              <li>
                Blocchi ignorati (filtro): <strong>{result.stats.ignoredBlocks}</strong>
              </li>
            </ul>
            <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button type="button" className="brutal-btn" onClick={copyMarkdown}>
                Copia report Markdown
              </button>
              <button
                type="button"
                className="brutal-btn"
                style={{ opacity: 0.85 }}
                onClick={() => setGitStep(1)}
              >
                Applica modifiche sul repo plugin…
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', marginTop: '0.75rem', color: 'var(--muted-fg, #555)' }}>
              L’applicazione automatica su Git non è ancora collegata: la doppia conferma ti ricorda di usare PR
              piccole e review, per non peggiorare comportamenti esistenti.
            </p>
          </section>

          <section className="brutal-card" style={{ padding: '1rem' }}>
            <h2 className="section-title" style={{ marginTop: 0 }}>
              Documento generato (Markdown)
            </h2>
            <textarea
              className="brutal-input"
              readOnly
              value={result.markdown}
              rows={24}
              style={{ width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem' }}
            />
          </section>
        </>
      )}

      {gitStep > 0 && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="git-modal-title"
        >
          <div
            className="brutal-card"
            style={{ maxWidth: '420px', width: '100%', padding: '1.25rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            {gitStep === 1 && (
              <>
                <h3 id="git-modal-title" style={{ marginTop: 0 }}>
                  Conferma
                </h3>
                <p style={{ fontSize: '0.85rem' }}>
                  Le modifiche automatiche sul repository del plugin non sono ancora attive. Procedendo vedrai solo un
                  promemoria per usare una PR manuale. Vuoi continuare?
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="brutal-btn" onClick={closeGitModal}>
                    Annulla
                  </button>
                  <button type="button" className="brutal-btn" onClick={() => setGitStep(2)}>
                    Continua
                  </button>
                </div>
              </>
            )}
            {gitStep === 2 && (
              <>
                <h3 id="git-modal-title" style={{ marginTop: 0 }}>
                  Seconda conferma
                </h3>
                <p style={{ fontSize: '0.85rem' }}>
                  Digita <strong>CONFERMA</strong> per chiudere il flusso (nessuna modifica Git verrà eseguita da
                  questa dashboard nella versione attuale).
                </p>
                <input
                  className="brutal-input"
                  value={gitConfirmText}
                  onChange={(e) => setGitConfirmText(e.target.value)}
                  placeholder="CONFERMA"
                  style={{ width: '100%', marginTop: '0.5rem' }}
                  autoComplete="off"
                />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="brutal-btn" onClick={closeGitModal}>
                    Annulla
                  </button>
                  <button
                    type="button"
                    className="brutal-btn"
                    onClick={finalizeGitStub}
                    disabled={gitConfirmText.trim().toUpperCase() !== 'CONFERMA'}
                  >
                    OK
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
        </>
      )}
    </>
  );
}
