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
  const [enrichLinkedIn, setEnrichLinkedIn] = useState(false);
  const [fetchWeb, setFetchWeb] = useState(false);
  const [includeDocSnapshot, setIncludeDocSnapshot] = useState(false);
  const [includeLlmSynthesis, setIncludeLlmSynthesis] = useState(false);

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
    scanNotionProductSources(
      p
        ? { pageId: p, enrichLinkedIn, fetchWeb, includeDocSnapshot, includeLlmSynthesis }
        : { databaseId: d, enrichLinkedIn, fetchWeb, includeDocSnapshot, includeLlmSynthesis },
    )
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
      'Fase 7 (manuale): salva il Markdown in docs/product-sources/archive/ (vedi docs/PRODUCT-SOURCES-GIT-WORKFLOW.md nel repo), apri la PR su GitHub, ' +
        'poi in «Storico cron & documenti» imposta l’URL della PR. Nessuna azione automatica su Git.',
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
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            marginTop: '0.75rem',
            fontSize: '0.8rem',
            cursor: 'pointer',
            maxWidth: '36rem',
          }}
        >
          <input
            type="checkbox"
            checked={enrichLinkedIn}
            onChange={(e) => setEnrichLinkedIn(e.target.checked)}
            disabled={loading}
            style={{ marginTop: '0.15rem' }}
          />
          <span>
            <strong>Arricchisci post LinkedIn (Apify)</strong> — estrae <strong>testo del post</strong> e{' '}
            <strong>link nel post</strong> (no commenti). Richiede <code>APIFY_TOKEN</code> e{' '}
            <code>APIFY_LINKEDIN_ACTOR_ID</code> su Vercel; la richiesta può durare <strong>molti secondi</strong> e
            rispetta <code>PRODUCT_SOURCES_MAX_LINKEDIN_PER_RUN</code> su Vercel (default 20 — tetto tecnico configurabile, non un tetto di business).
          </span>
        </label>
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            marginTop: '0.75rem',
            fontSize: '0.8rem',
            cursor: 'pointer',
            maxWidth: '40rem',
          }}
        >
          <input
            type="checkbox"
            checked={fetchWeb}
            onChange={(e) => setFetchWeb(e.target.checked)}
            disabled={loading}
            style={{ marginTop: '0.15rem' }}
          />
          <span>
            <strong>Fetch web + strategia tipo URL (Fase 1 bis–2)</strong> — per ogni link <em>non LinkedIn</em> fino a{' '}
            <code>PRODUCT_SOURCES_MAX_WEB_FETCH_PER_RUN</code>: HTML grezzo, <strong>GitHub</strong>→raw, note guida per{' '}
            <strong>YouTube / X</strong>, PDF rilevato, allow/block list (
            <code>PRODUCT_SOURCES_DOMAIN_ALLOWLIST</code> / <code>BLOCKLIST</code>). Può richiedere{' '}
            <strong>molti secondi</strong>.
          </span>
        </label>
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            marginTop: '0.75rem',
            fontSize: '0.8rem',
            cursor: 'pointer',
            maxWidth: '40rem',
          }}
        >
          <input
            type="checkbox"
            checked={includeDocSnapshot}
            onChange={(e) => setIncludeDocSnapshot(e.target.checked)}
            disabled={loading}
            style={{ marginTop: '0.15rem' }}
          />
          <span>
            <strong>Snapshot documentazione plugin (Fase 4)</strong> — allega al report le <strong>rules/docs</strong> del
            repo (stessi env del cron: <code>PRODUCT_SOURCES_DOC_FETCH_URLS</code> e/o{' '}
            <code>PRODUCT_SOURCES_DOC_REPO_ROOT</code>). Su Vercel usa di solito URL raw GitHub; in locale puoi puntare
            alla root del monorepo.
          </span>
        </label>
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            marginTop: '0.75rem',
            fontSize: '0.8rem',
            cursor: 'pointer',
            maxWidth: '40rem',
          }}
        >
          <input
            type="checkbox"
            checked={includeLlmSynthesis}
            onChange={(e) => setIncludeLlmSynthesis(e.target.checked)}
            disabled={loading}
            style={{ marginTop: '0.15rem' }}
          />
          <span>
            <strong>Sintesi LLM (Fase 5)</strong> — aggiunge al Markdown la sezione generata dal modello (costi API).
            Serve <code>PRODUCT_SOURCES_LLM_SYNTHESIS=1</code> su Vercel e una key (
            <code>KIMI_API_KEY</code> / <code>PRODUCT_SOURCES_LLM_API_KEY</code> / <code>OPENAI_API_KEY</code> a seconda
            di <code>PRODUCT_SOURCES_LLM_PROVIDER</code>).
          </span>
        </label>
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
              {result.enrichLinkedInRequested && (
                <li>
                  LinkedIn processati da Apify (tentativi): <strong>{result.linkedinEnriched ?? 0}</strong>
                </li>
              )}
              {result.fetchWebRequested && (
                <li>
                  Web — URL in batch (strategia Fase 2): <strong>{result.webEnriched ?? 0}</strong>
                </li>
              )}
              {result.includeDocSnapshotRequested && result.docSnapshot && (
                <li>
                  Snapshot doc (Fase 4):{' '}
                  <strong>
                    {result.docSnapshot.okCount ?? 0}/{result.docSnapshot.sourceCount ?? 0}
                  </strong>{' '}
                  file ok
                  {result.docSnapshot.truncated ? ' · troncato' : ''}
                  {result.docSnapshot.skipped ? ` · (${result.docSnapshot.skipReason || 'skip'})` : ''}
                </li>
              )}
              {result.includeLlmSynthesisRequested && (
                <li>
                  Sintesi LLM (Fase 5):{' '}
                  <strong>{(result.llmSynthesisChars ?? 0) > 0 ? `${result.llmSynthesisChars} caratteri` : 'vuota / disattiva'}</strong>
                </li>
              )}
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
              Nessuna modifica automatica su Git (scelta di sicurezza). PR manuali, piccole e con review — vedi anche lo
              storico cron per tracciare l’URL PR.
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
                  La dashboard non aprirà mai PR in automatico. Procedendo vedrai un promemoria per la PR manuale e lo
                  storico. Vuoi continuare?
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
                  Fase 7 — Checklist (repo plugin)
                </h3>
                <ol style={{ fontSize: '0.8rem', lineHeight: 1.55, margin: '0.5rem 0 0', paddingLeft: '1.1rem' }}>
                  <li>
                    Usa <strong>Copia report Markdown</strong> (qui) o, per il cron, <strong>Storico → Scarica .md</strong>.
                  </li>
                  <li>
                    Nel repo: branch dedicato → file sotto{' '}
                    <code style={{ fontSize: '0.72rem' }}>docs/product-sources/archive/</code> es.{' '}
                    <code style={{ fontSize: '0.72rem' }}>YYYY-MM-DD-manual.md</code>.
                  </li>
                  <li>
                    Apri la <strong>PR</strong> su GitHub; poi registra l’URL in <strong>Storico cron & documenti</strong>.
                  </li>
                </ol>
                <p style={{ fontSize: '0.72rem', color: 'var(--muted-fg, #555)', marginTop: '0.65rem' }}>
                  Dettaglio: <code>docs/PRODUCT-SOURCES-GIT-WORKFLOW.md</code> nel monorepo.
                </p>
                <p style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>
                  Digita <strong>CONFERMA</strong> per chiudere (nessuna azione automatica su Git).
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
