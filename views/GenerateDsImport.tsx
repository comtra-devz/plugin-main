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
import { safeLocalStorageGetItem, safeLocalStorageSetItem } from '../lib/safeWebStorage';

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
  return safeLocalStorageGetItem(INTRO_SEEN_KEY) === '1';
}

function writeIntroSeen(): void {
  safeLocalStorageSetItem(INTRO_SEEN_KEY, '1');
}

const WIZARD_TEXT = [
  {
    title: 'Rules',
    body: 'Comtra will use this file’s design-system rules and constraints when generating screens: color, spacing, typography, and component conventions stay aligned with what is defined in Figma.',
  },
  {
    title: 'Guidance',
    body: 'Operational guidance (visual hierarchy, content priority, recurring patterns) is derived from the file and the catalog we are about to import so Generate matches how you design.',
  },
  {
    title: 'Variables',
    body: 'We import variables and tokens tied to the file (colors, numbers, strings where applicable). Large files may take a few seconds.',
  },
  {
    title: 'Components',
    body: 'We import the component and variant sets needed to map generated layouts to the real building blocks in your system.',
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
  /** Clears “catalog ready” and session (e.g. Refresh catalog). */
  onInvalidateCatalog: () => void;
  dsImportBusy: boolean;
  onBusyChange: (busy: boolean) => void;
  /** If false, only one DS file on Free; another Figma file triggers Pro upsell. */
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
  /** Full snapshot + hash for backend PUT (same payload as from the plugin). */
  const [wizardCapture, setWizardCapture] = useState<{ fullIndex: object; hash: string } | null>(null);
  const [wizardError, setWizardError] = useState<string | null>(null);

  const keyMatch = Boolean(fileKey && hasImportForFileKey(fileKey));
  const freeTierFileBlocked =
    !isPro &&
    fileKey &&
    canFreeTierUseFileForDsImport(fileKey, isPro).ok === false;
  /** Free: at most one record; Pro: show select only when more than one import exists. */
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
      ? 'The catalog is always read from the Figma file you have open. The selected entry refers to a different file saved earlier.'
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
          : fileName || 'This file';
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
          /* offline / 403: local state still valid */
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

  // Step 2: start Figma read once per wizard open
  useEffect(() => {
    if (!wizardOpen || wizardStep !== 2 || indexResult || wizardError) return;
    let cancelled = false;
    onBusyChange(true);
    (async () => {
      const res = await requestDsContextIndex({ reuseCached: false, timeoutMs: 120000 });
      if (cancelled) return;
      if (res.error || !res.index || typeof res.index !== 'object') {
        setWizardError(res.error || 'Could not read the design system from Figma.');
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
        <p className="text-[10px] font-bold uppercase text-gray-600">Connecting to file…</p>
      </div>
    );
  }

  if (fileContextError || !fileKey) {
    return (
      <div className={`${BRUTAL.card} bg-amber-50 border-2 border-amber-700 p-3`}>
        <p className="text-[10px] font-bold text-amber-900">
          {fileContextError ||
            'We could not read the file. Open a saved file in Figma and try again.'}
        </p>
      </div>
    );
  }

  if (freeTierFileBlocked) {
    return (
      <div className={`${BRUTAL.card} bg-violet-50 border-2 border-black p-3 space-y-3`}>
        <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold leading-snug text-black">
              On <strong>Free</strong> you already linked a design system. To import and use Generate with{' '}
              <strong>another</strong> Figma file you need <strong>Pro</strong> (multiple files and DS).
            </p>
            <span className="shrink-0 text-[9px] font-black uppercase bg-black text-white px-2 py-1 border-2 border-black shadow-[2px_2px_0_0_#ff90e8]">
              Pro
            </span>
          </div>
        <Button variant="primary" fullWidth className="relative text-xs" onClick={onUnlockRequest}>
          Unlock Pro
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
          Design system catalog is ready for this file. You can use Generate.
        </p>
        <button
          type="button"
          className="mt-2 text-[9px] font-black uppercase underline text-green-900"
          onClick={onInvalidateCatalog}
        >
          Refresh catalog
        </button>
      </div>
    );
  }

  return (
    <>
      {!introSeen && (
        <div className={`${BRUTAL.card} bg-[#fff8e7] border-2 border-black p-3`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-bold leading-snug text-black">
              Import your design system for this file before generating.
            </p>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                className="text-[10px] font-black uppercase underline hover:text-[#ff90e8]"
                onClick={() => setShowWhyModal(true)}
              >
                Read first
              </button>
              <Button variant="secondary" className="text-[10px] px-2 py-1" onClick={dismissIntro}>
                OK, I understand
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className={`${BRUTAL.card} bg-white border-2 border-black p-3 space-y-3`}>
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-sm font-black uppercase leading-tight sm:text-base">Design system in file</h3>
          <span className="text-xs font-normal text-gray-500 truncate max-w-[160px] text-right" title={fileKey}>
            {fileName || 'Untitled file'}
          </span>
        </div>

        {keyMatch ? (
          <>
            {showImportSelect ? (
              <>
                <label className="block text-sm font-bold text-gray-700">Your imported design systems</label>
                <select
                  className="w-full border-2 border-black p-2 text-sm font-bold bg-white"
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
              <p className="text-sm font-normal text-gray-900 leading-normal">
                <span className="font-bold">Linked DS:</span>{' '}
                {selectedImport?.displayName || fileName || 'This file'}
              </p>
            )}
            {mismatchLabel && (
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-300 p-2 leading-snug">{mismatchLabel}</p>
            )}
            <Button
              variant="primary"
              fullWidth
              className="text-lg font-black leading-[1.15] py-3.5 px-4 text-center"
              onClick={openWizard}
              disabled={dsImportBusy}
            >
              {dsImportBusy ? 'Importing…' : 'Prepare design system for this file'}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm font-normal text-gray-900 leading-normal">
              This file is not yet among the design systems you imported. Start an import from this Figma file.
            </p>
            <Button
              variant="primary"
              fullWidth
              className="text-lg font-black leading-[1.15] py-3.5 px-4 text-center"
              onClick={openWizard}
              disabled={dsImportBusy}
            >
              {dsImportBusy ? 'Importing…' : 'Import design system from this file'}
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
            <h4 className="font-black uppercase text-sm mb-2">Why import?</h4>
            <p className="text-[11px] text-gray-700 leading-snug mb-3">
              Generate needs to know which components, variables, and conventions exist in <strong>your</strong>{' '}
              file so outputs match your real design system and do not invent patterns that are not in the project.
              We do not use this data to train generic AI — see the notice above the tab bar for more.
            </p>
            <Button variant="secondary" className="text-xs w-full" onClick={() => setShowWhyModal(false)}>
              Close
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
                Step {wizardStep + 1} of {WIZARD_TEXT.length}
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
              <p className="text-[10px] font-bold animate-pulse">Reading variables and styles from file…</p>
            )}

            {wizardStep === 2 && indexResult && (
              <ul className="text-[10px] space-y-1 border border-black/20 p-2 bg-gray-50">
                <li>
                  <strong>Variables (tokens):</strong> {indexResult.total_tokens}
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
                  <strong>Components in index:</strong> {indexResult.components.length}
                  {indexResult.components_truncated && indexResult.total_components_in_file != null
                    ? ` (file has ${indexResult.total_components_in_file}; index capped for performance)`
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
                  Back
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
                  Continue
                </Button>
              )}
              {wizardStep === 2 && indexResult && !wizardError && (
                <Button variant="primary" className="flex-1 text-xs" onClick={() => setWizardStep(3)}>
                  Continue
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
                  Retry
                </Button>
              )}
              {wizardStep === 3 && indexResult && (
                <Button variant="primary" className="flex-1 text-xs" onClick={finishWizard}>
                  Done — use this catalog
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
