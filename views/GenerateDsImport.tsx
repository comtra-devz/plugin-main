import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BRUTAL } from '../constants';
import { Button } from '../components/ui/Button';
import {
  loadDsImports,
  upsertDsImport,
  hasImportForFileKey,
  setSessionCatalogPrepared,
  enforceSingleImportForFreeTier,
  canFreeTierUseFileForDsImport,
  type StoredDsImport,
} from '../lib/dsImportsStorage';

const INTRO_SEEN_KEY = 'comtra-generate-ds-intro-seen';

export type RequestDsContextIndexFn = (opts: {
  reuseCached: boolean;
  timeoutMs?: number;
}) => Promise<{ index: object | null; hash: string | null; error?: string }>;

type DsIndexSummary = {
  total_tokens: number;
  token_categories: Record<string, number>;
  components: unknown[];
  components_truncated?: boolean;
  total_components_in_file?: number;
};

function readIntroSeen(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(INTRO_SEEN_KEY) === '1';
}

function writeIntroSeen(): void {
  try {
    localStorage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

const WIZARD_TEXT = [
  {
    title: 'Regole',
    body: 'Comtra userà le regole e i vincoli del design system di questo file quando genera schermate: colori, spaziature, tipografia e convenzioni dei componenti devono restare allineati a ciò che è definito in Figma.',
  },
  {
    title: 'Indicazioni',
    body: 'Le indicazioni operative (gerarchia visiva, priorità di contenuto, pattern ricorrenti) verranno ricavate dal file e dal catalogo che stiamo per importare, così le proposte Generate rispettano il tuo modo di progettare.',
  },
  {
    title: 'Variabili',
    body: 'Stiamo importando le variabili e i token collegati al file (colori, numeri, stringhe dove applicabile). Questo passaggio può richiedere qualche secondo su file molto grandi.',
  },
  {
    title: 'Componenti',
    body: 'Stiamo importando l’elenco dei componenti e dei set di varianti necessari a mappare il layout generato sugli elementi reali del tuo sistema.',
  },
] as const;

export type GenerateDsImportProps = {
  fileKey: string | null;
  fileName: string | null;
  fileContextLoading: boolean;
  fileContextError: string | null;
  requestDsContextIndex: RequestDsContextIndexFn;
  catalogReady: boolean;
  onCatalogReady: () => void;
  /** Azzera “catalogo pronto” e la sessione (es. pulsante Aggiorna catalogo). */
  onInvalidateCatalog: () => void;
  dsImportBusy: boolean;
  onBusyChange: (busy: boolean) => void;
  /** Se false, massimo un DS importato; altro file Figma → upsell Pro. */
  isPro: boolean;
  onUnlockRequest: () => void;
  persistDsImportToServer: (body: {
    figma_file_key: string;
    display_name: string;
    figma_file_name: string;
    ds_cache_hash: string;
    ds_context_index: object;
  }) => Promise<void>;
};

export const GenerateDsImport: React.FC<GenerateDsImportProps> = ({
  fileKey,
  fileName,
  fileContextLoading,
  fileContextError,
  requestDsContextIndex,
  catalogReady,
  onCatalogReady,
  onInvalidateCatalog,
  dsImportBusy,
  onBusyChange,
  isPro,
  onUnlockRequest,
  persistDsImportToServer,
}) => {
  const [introSeen, setIntroSeen] = useState(readIntroSeen);
  const [imports, setImports] = useState<StoredDsImport[]>(() => loadDsImports());
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [showWhyModal, setShowWhyModal] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [indexResult, setIndexResult] = useState<DsIndexSummary | null>(null);
  /** Snapshot completo + hash per PUT backend (stesso payload del plugin). */
  const [wizardCapture, setWizardCapture] = useState<{ fullIndex: object; hash: string } | null>(null);
  const [wizardError, setWizardError] = useState<string | null>(null);

  const keyMatch = Boolean(fileKey && hasImportForFileKey(fileKey));
  const freeTierFileBlocked =
    !isPro &&
    fileKey &&
    canFreeTierUseFileForDsImport(fileKey, isPro).ok === false;
  /** Free: al più un record; Pro: select solo se c’è più di un import salvato. */
  const showImportSelect = isPro && imports.length > 1;

  useEffect(() => {
    if (!isPro) enforceSingleImportForFreeTier();
    setImports(loadDsImports());
  }, [fileKey, wizardOpen, isPro]);

  useEffect(() => {
    if (!fileKey || !imports.length) {
      setSelectedImportId(null);
      return;
    }
    const match = imports.find((i) => i.fileKey === fileKey);
    setSelectedImportId(match?.id ?? imports[0]?.id ?? null);
  }, [fileKey, imports]);

  const selectedImport = useMemo(
    () => imports.find((i) => i.id === selectedImportId) ?? null,
    [imports, selectedImportId],
  );

  const mismatchLabel =
    selectedImport && fileKey && selectedImport.fileKey !== fileKey
      ? 'Il catalogo viene sempre letto dal file Figma attualmente aperto. La voce selezionata si riferisce a un altro file salvato in precedenza.'
      : null;

  const openWizard = useCallback(() => {
    if (fileKey && !canFreeTierUseFileForDsImport(fileKey, isPro).ok) {
      onUnlockRequest();
      return;
    }
    setWizardError(null);
    setIndexResult(null);
    setWizardCapture(null);
    setWizardStep(0);
    setWizardOpen(true);
  }, [fileKey, isPro, onUnlockRequest]);

  const closeWizard = useCallback(() => {
    if (dsImportBusy) return;
    setWizardOpen(false);
  }, [dsImportBusy]);

  const finishWizard = useCallback(() => {
    if (fileKey) {
      const gate = canFreeTierUseFileForDsImport(fileKey, isPro);
      if (!gate.ok) {
        onBusyChange(false);
        setWizardOpen(false);
        onUnlockRequest();
        return;
      }
      const label =
        selectedImport?.fileKey === fileKey
          ? selectedImport.displayName
          : fileName || 'Questo file';
      upsertDsImport({
        fileKey,
        displayName: label,
        figmaFileName: fileName || '',
      });
      if (!isPro) enforceSingleImportForFreeTier();
      setImports(loadDsImports());
      if (wizardCapture?.fullIndex) {
        const h =
          wizardCapture.hash.trim() ||
          String((wizardCapture.fullIndex as { hash?: string }).hash || '').trim() ||
          '';
        void persistDsImportToServer({
          figma_file_key: fileKey,
          display_name: label,
          figma_file_name: fileName || '',
          ds_cache_hash: h,
          ds_context_index: wizardCapture.fullIndex,
        }).catch(() => {
          /* offline / 403: locale resta valido */
        });
      }
    }
    if (fileKey) setSessionCatalogPrepared(fileKey);
    onCatalogReady();
    setWizardOpen(false);
    onBusyChange(false);
  }, [
    fileKey,
    fileName,
    selectedImport,
    wizardCapture,
    persistDsImportToServer,
    onCatalogReady,
    onBusyChange,
    isPro,
    onUnlockRequest,
  ]);

  // Step 2 (variabili): avvia lettura Figma una sola volta per apertura wizard
  useEffect(() => {
    if (!wizardOpen || wizardStep !== 2 || indexResult || wizardError) return;
    let cancelled = false;
    onBusyChange(true);
    (async () => {
      const res = await requestDsContextIndex({ reuseCached: false, timeoutMs: 120000 });
      if (cancelled) return;
      if (res.error || !res.index || typeof res.index !== 'object') {
        setWizardError(res.error || 'Impossibile leggere il design system da Figma.');
        onBusyChange(false);
        return;
      }
      const idx = res.index as DsIndexSummary;
      setIndexResult({
        total_tokens: typeof idx.total_tokens === 'number' ? idx.total_tokens : 0,
        token_categories:
          idx.token_categories && typeof idx.token_categories === 'object'
            ? idx.token_categories
            : {},
        components: Array.isArray(idx.components) ? idx.components : [],
        components_truncated: idx.components_truncated,
        total_components_in_file: idx.total_components_in_file,
      });
      const hash =
        (res.hash && String(res.hash).trim()) ||
        String((res.index as { hash?: string }).hash || '').trim() ||
        '';
      setWizardCapture({ fullIndex: res.index as object, hash });
      onBusyChange(false);
    })();
    return () => {
      cancelled = true;
      onBusyChange(false);
    };
  }, [wizardOpen, wizardStep, indexResult, wizardError, requestDsContextIndex, onBusyChange]);

  const dismissIntro = () => {
    writeIntroSeen();
    setIntroSeen(true);
  };

  if (fileContextLoading) {
    return (
      <div className={`${BRUTAL.card} bg-white border-2 border-black p-3`}>
        <p className="text-[10px] font-bold uppercase text-gray-600">Connessione al file…</p>
      </div>
    );
  }

  if (fileContextError || !fileKey) {
    return (
      <div className={`${BRUTAL.card} bg-amber-50 border-2 border-amber-700 p-3`}>
        <p className="text-[10px] font-bold text-amber-900">
          {fileContextError ||
            'Non riusciamo a leggere il file. Apri un file salvato in Figma e riprova.'}
        </p>
      </div>
    );
  }

  if (freeTierFileBlocked) {
    return (
      <div className={`${BRUTAL.card} bg-violet-50 border-2 border-black p-3 space-y-3`}>
        <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold leading-snug text-black">
              Hai già collegato un design system su <strong>Free</strong>. Per importare e usare Generate con{' '}
              <strong>un altro file</strong> Figma serve <strong>Pro</strong> (più file e più DS).
            </p>
            <span className="shrink-0 text-[9px] font-black uppercase bg-black text-white px-2 py-1 border-2 border-black shadow-[2px_2px_0_0_#ff90e8]">
              Pro
            </span>
          </div>
        <Button variant="primary" fullWidth className="relative text-xs" onClick={onUnlockRequest}>
          Sblocca Pro
          <span className="absolute bottom-0.5 right-1 text-[8px] bg-[#ff90e8] text-black px-1 font-bold rounded-sm border border-black">
            PRO
          </span>
        </Button>
      </div>
    );
  }

  if (catalogReady) {
    return (
      <div className={`${BRUTAL.card} bg-green-50 border-2 border-green-800 p-3`}>
        <p className="text-[10px] font-bold text-green-900">
          Catalogo design system pronto per questo file. Puoi usare Generate.
        </p>
        <button
          type="button"
          className="mt-2 text-[9px] font-black uppercase underline text-green-900"
          onClick={onInvalidateCatalog}
        >
          Aggiorna catalogo
        </button>
      </div>
    );
  }

  return (
    <>
      {!introSeen && (
        <div className={`${BRUTAL.card} bg-[#fff8e7] border-2 border-black p-3 space-y-2`}>
          <p className="text-[11px] font-bold leading-snug">
            Prima di generare con il <strong>file corrente</strong>, Comtra deve importare nel plugin le
            informazioni sul tuo design system (regole, variabili, componenti). Succede in pochi passaggi e
            non addestriamo modelli con questi dati — vedi l’informativa in basso.
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              className="text-[10px] font-black uppercase underline"
              onClick={() => setShowWhyModal(true)}
            >
              Perché serve?
            </button>
            <Button variant="secondary" className="text-[10px] px-2 py-1" onClick={dismissIntro}>
              Ok, ho capito
            </Button>
          </div>
        </div>
      )}

      <div className={`${BRUTAL.card} bg-white border-2 border-black p-3 space-y-3`}>
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-[11px] font-black uppercase">Design system nel file</h3>
          <span className="text-[9px] font-mono text-gray-500 truncate max-w-[120px]" title={fileKey}>
            {fileName || 'File senza nome'}
          </span>
        </div>

        {keyMatch ? (
          <>
            {showImportSelect ? (
              <>
                <label className="block text-[10px] font-bold text-gray-700">I tuoi DS importati</label>
                <select
                  className="w-full border-2 border-black p-2 text-[11px] font-bold bg-white"
                  value={selectedImportId ?? ''}
                  onChange={(e) => setSelectedImportId(e.target.value || null)}
                  disabled={dsImportBusy}
                >
                  {imports.map((imp) => (
                    <option key={imp.id} value={imp.id}>
                      {imp.displayName}
                      {imp.figmaFileName && imp.figmaFileName !== imp.displayName
                        ? ` · ${imp.figmaFileName}`
                        : ''}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <p className="text-[10px] text-gray-700">
                <span className="font-bold">DS collegato:</span>{' '}
                {selectedImport?.displayName || fileName || 'Questo file'}
              </p>
            )}
            {mismatchLabel && (
              <p className="text-[9px] text-amber-900 bg-amber-50 border border-amber-300 p-2">{mismatchLabel}</p>
            )}
            <Button variant="primary" fullWidth onClick={openWizard} disabled={dsImportBusy}>
              {dsImportBusy ? 'Importazione…' : 'Prepara il design system per questo file'}
            </Button>
          </>
        ) : (
          <>
            <p className="text-[10px] text-gray-700">
              Questo file non è ancora tra i design system che hai importato. Avvia un import da questo file
              Figma.
            </p>
            <Button variant="primary" fullWidth onClick={openWizard} disabled={dsImportBusy}>
              {dsImportBusy ? 'Importazione…' : 'Importa il design system da questo file'}
            </Button>
          </>
        )}
      </div>

      {showWhyModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowWhyModal(false)}
        >
          <div
            className={`${BRUTAL.card} bg-white max-w-md w-full p-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="font-black uppercase text-sm mb-2">Perché serve l’import</h4>
            <p className="text-[11px] text-gray-700 leading-snug mb-3">
              Generate deve sapere quali componenti, variabili e convenzioni esistono nel <strong>tuo</strong>{' '}
              file, così le schermate create sono coerenti con il design system reale e non inventano pattern
              assenti dal progetto.
            </p>
            <Button variant="secondary" className="text-xs w-full" onClick={() => setShowWhyModal(false)}>
              Chiudi
            </Button>
          </div>
        </div>
      )}

      {wizardOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-2"
          onClick={closeWizard}
        >
          <div
            className={`${BRUTAL.card} bg-white max-w-md w-full max-h-[90vh] overflow-y-auto p-4 flex flex-col gap-3`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase text-gray-500">
                Passo {wizardStep + 1} di {WIZARD_TEXT.length}
              </span>
              <button
                type="button"
                className="text-[10px] font-bold"
                disabled={dsImportBusy}
                onClick={closeWizard}
              >
                ✕
              </button>
            </div>
            <h4 className="font-black uppercase text-sm">{WIZARD_TEXT[wizardStep]?.title}</h4>
            <p className="text-[11px] text-gray-700 leading-snug">{WIZARD_TEXT[wizardStep]?.body}</p>

            {wizardError && (
              <div className="bg-red-50 border border-red-400 p-2 text-[10px] text-red-900">{wizardError}</div>
            )}

            {wizardStep === 2 && dsImportBusy && !indexResult && !wizardError && (
              <p className="text-[10px] font-bold animate-pulse">Lettura variabili e stili dal file…</p>
            )}

            {wizardStep === 2 && indexResult && (
              <ul className="text-[10px] space-y-1 border border-black/20 p-2 bg-gray-50">
                <li>
                  <strong>Variabili (token):</strong> {indexResult.total_tokens}
                </li>
                {Object.keys(indexResult.token_categories).length > 0 && (
                  <li className="text-gray-600">
                    {Object.entries(indexResult.token_categories)
                      .map(([k, n]) => `${k}: ${n}`)
                      .join(' · ')}
                  </li>
                )}
              </ul>
            )}

            {wizardStep === 3 && indexResult && (
              <ul className="text-[10px] space-y-1 border border-black/20 p-2 bg-gray-50">
                <li>
                  <strong>Componenti nell’indice:</strong> {indexResult.components.length}
                  {indexResult.components_truncated && indexResult.total_components_in_file != null
                    ? ` (file ne contiene ${indexResult.total_components_in_file}; indice limitato per prestazioni)`
                    : ''}
                </li>
              </ul>
            )}

            <div className="flex gap-2 mt-2">
              {wizardStep > 0 && !(wizardStep === 2 && dsImportBusy && !indexResult && !wizardError) && (
                <Button
                  variant="secondary"
                  className="flex-1 text-xs"
                  disabled={dsImportBusy}
                  onClick={() => {
                    setWizardError(null);
                    setWizardStep((s) => Math.max(0, s - 1));
                  }}
                >
                  Indietro
                </Button>
              )}
              {wizardStep < 2 && (
                <Button
                  variant="primary"
                  className="flex-1 text-xs"
                  onClick={() => {
                    setWizardError(null);
                    setWizardStep((s) => s + 1);
                  }}
                >
                  Continua
                </Button>
              )}
              {wizardStep === 2 && indexResult && !wizardError && (
                <Button variant="primary" className="flex-1 text-xs" onClick={() => setWizardStep(3)}>
                  Continua
                </Button>
              )}
              {wizardStep === 2 && wizardError && (
                <Button
                  variant="primary"
                  className="flex-1 text-xs"
                  onClick={() => {
                    setWizardError(null);
                    setIndexResult(null);
                    setWizardCapture(null);
                  }}
                >
                  Riprova
                </Button>
              )}
              {wizardStep === 3 && indexResult && (
                <Button variant="primary" className="flex-1 text-xs" onClick={finishWizard}>
                  Fine — usa questo catalogo
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
