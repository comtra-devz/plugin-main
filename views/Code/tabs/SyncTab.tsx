
import React, { useState } from 'react';
import { SyncTabProps, BRUTAL, COLORS, type StorybookConnectionInfo } from '../types';
import { Button } from '../../../components/ui/Button';
import { SyncStorybookGuideModal } from '../../../components/SyncStorybookGuideModal';
import {
  BrutalDropdown,
  brutalSelectOptionRowClass,
  brutalSelectOptionSelectedClass,
} from '../../../components/ui/BrutalSelect';

const PRESET_STORYBOOKS: { label: string; value: string }[] = [
  { label: 'Custom URL…', value: '' },
  { label: 'Carbon Design System (IBM)', value: 'https://react.carbondesignsystem.com' },
  { label: 'Chakra UI', value: 'https://chakra-ui.netlify.app' },
  { label: 'SAP Fundamental Styles', value: 'https://sap.github.io/fundamental-styles' },
  { label: 'Grafana UI', value: 'https://developers.grafana.com/ui/latest' },
  { label: 'Ring UI (JetBrains)', value: 'https://jetbrains.github.io/ring-ui/master' },
  { label: 'GitLab UI', value: 'https://gitlab-org.gitlab.io/gitlab/storybook' },
];

/**
 * Host per cui il plugin può fare fetch diretto (devono essere in manifest.json networkAccess.allowedDomains).
 * Per URL con altri host usiamo solo il backend, così non scattano errori CSP e il server fa la richiesta.
 */
const CLIENT_ALLOWED_STORYBOOK_ORIGINS = new Set([
  'https://jetbrains.github.io',
  'https://react.carbondesignsystem.com',
  'https://chakra-ui.netlify.app',
  'https://sap.github.io',
  'https://developers.grafana.com',
  'https://gitlab-org.gitlab.io',
  'https://chromatic.com',
]);

/** Normalizza URL Storybook: rimuove query e hash così il check usa la base corretta (es. .../master/?path=... → .../master). */
function normalizeStorybookUrl(input: string): string {
  const s = (input || '').trim();
  if (!s) return s;
  try {
    const u = new URL(s);
    const pathname = u.pathname.replace(/\/$/, '') || '';
    return u.origin + pathname;
  } catch {
    return s.replace(/\/$/, '');
  }
}

/** Path comuni per la lista stories (allineati al backend): più varianti = meno rigidità. */
const STORYBOOK_LIST_PATHS = [
  '/api/stories',
  '/api/components',
  '/index.json',
  '/stories.json',
  '/storybook/index.json',
  '/api/storybook/stories',
];

/** Verifica se il JSON di risposta contiene una lista stories/componenti in formato riconosciuto. */
function isStorybookListResponse(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.stories)) return true;
  if (Array.isArray(d.components)) return true;
  if (Array.isArray(data)) return true;
  if (d.entries && typeof d.entries === 'object' && !Array.isArray(d.entries)) return Object.keys(d.entries as object).length > 0;
  if (d.stories && typeof d.stories === 'object' && !Array.isArray(d.stories)) return true;
  const v2 = d.v2 && typeof d.v2 === 'object' ? (d.v2 as Record<string, unknown>) : null;
  if (v2?.entries && typeof v2.entries === 'object') return true;
  return false;
}

/** Check Storybook lato client (browser): prova tutti i path comuni e accetta più strutture JSON. Per URL pubblici evita il backend. */
async function checkStorybookFromClient(
  baseUrl: string,
  token?: string
): Promise<{ ok: boolean; error?: string } & StorybookConnectionInfo> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token?.trim()) headers['Authorization'] = /^bearer\s+/i.test(token.trim()) ? token.trim() : `Bearer ${token.trim()}`;

  for (const path of STORYBOOK_LIST_PATHS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(baseUrl + path, { headers, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) continue;
      const data = await res.json();
      if (isStorybookListResponse(data)) {
        const d = data as Record<string, unknown>;
        const storyCount = Array.isArray(d.stories)
          ? d.stories.length
          : d.stories && typeof d.stories === 'object' && !Array.isArray(d.stories)
            ? Object.keys(d.stories as object).length
            : d.entries && typeof d.entries === 'object' && !Array.isArray(d.entries)
              ? Object.keys(d.entries as object).length
              : Array.isArray(data)
                ? data.length
                : d.v2 && typeof d.v2 === 'object' && (d.v2 as Record<string, unknown>).entries && typeof (d.v2 as Record<string, unknown>).entries === 'object'
                  ? Object.keys((d.v2 as { entries: object }).entries).length
                  : 0;
        const componentCount = Array.isArray(d.components) ? d.components.length : 0;
        return {
          ok: true,
          endpointPath: path,
          endpointUrl: baseUrl + path,
          entryCount: storyCount + componentCount,
          storyCount,
          componentCount,
          checkedVia: 'client',
        };
      }
    } catch {
      // CORS, network, timeout: try next URL
    }
  }
  return { ok: false, error: 'Stories API not found at this URL. Add an endpoint (see guide below) or check the URL.' };
}

export const SyncTab: React.FC<SyncTabProps> = ({
  isPro,
  onUnlockRequest,
  activeSyncTab,
  setActiveSyncTab,
  isSbConnected,
  storybookUrl,
  storybookToken,
  storybookConnectionInfo,
  handleConnectSb,
  fetchCheckStorybook,
  onDisconnectSb,
  hasSyncScanned,
  handleSyncScan,
  isSyncScanning,
  getRemainingTime,
  syncItems,
  syncScanError,
  syncScanUpgradeUrl,
  expandedDriftId,
  setExpandedDriftId,
  handleSelectLayer,
  layerSelectionFeedback,
  handleSyncItem,
  handleSyncAll,
  onConnectSourceProvider,
  lastSyncAllDate
}) => {
  const [connectInput, setConnectInput] = useState(storybookUrl || '');
  const [tokenInput, setTokenInput] = useState(storybookToken || '');
  const [usePrivateToken, setUsePrivateToken] = useState(!!storybookToken);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isPresetOpen, setIsPresetOpen] = useState(false);

  const selectedPresetLabel = PRESET_STORYBOOKS.find((p) => p.value === connectInput)?.label ?? 'Custom URL…';

  const getDriftBadgeClass = (status: string) => {
    if (status === 'POTENTIAL_MATCH') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (status === 'NAME_MISMATCH') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (status === 'VARIANT_MISMATCH') return 'bg-purple-100 text-purple-700 border-purple-200';
    return 'bg-red-100 text-red-600 border-red-200';
  };

  const handleScanClick = () => {
    handleSyncScan();
  };

  const handleConnectClick = async () => {
    const raw = connectInput.trim();
    if (!raw || (!raw.startsWith('http://') && !raw.startsWith('https://'))) return;
    const url = normalizeStorybookUrl(raw);
    const token = usePrivateToken ? tokenInput.trim() || undefined : undefined;
    setConnectError(null);
    setIsConnecting(true);
    try {
      let result: ({ ok: boolean; error?: string } & StorybookConnectionInfo);
      let origin: string;
      try {
        origin = new URL(url).origin;
      } catch {
        origin = '';
      }
      const canFetchFromClient = !token && CLIENT_ALLOWED_STORYBOOK_ORIGINS.has(origin);
      if (canFetchFromClient) {
        result = await checkStorybookFromClient(url);
        if (!result.ok && fetchCheckStorybook) result = await fetchCheckStorybook(url, token);
      } else {
        // URL custom o token privato: solo backend. I token non passano mai dal browser/plugin fetch.
        result = fetchCheckStorybook ? await fetchCheckStorybook(url, token) : { ok: false, error: 'Backend not available.' };
      }
      if (result.ok) {
        handleConnectSb(url, token, result);
        if (url !== raw) setConnectInput(url);
      } else {
        setConnectError(result.error || 'Connection failed.');
      }
    } catch {
      setConnectError('Connection failed. If your Storybook URL is correct, check your internet connection and try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] relative overflow-hidden animate-in slide-in-from-right-2">
      <style>{`
        @keyframes fill-cta-bar {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
      <div className="p-3 border-b-2 border-black bg-black text-white flex justify-between items-center">
        <h3 className="font-bold uppercase text-xs">Deep Sync</h3>
      </div>

      {/* TEMPORARY: PRO gate disabled for Deep Sync until Lemon Squeezy store is live — see docs/TO-DO-BEFORE-GOING-LIVE.md "Restore PRO gate for Deep Sync". When restoring, show upgrade block when !isPro with copy: "Need to connect a private Storybook or one behind SSO? Book a call for an enterprise setup." (Calendly link: https://calendly.com/comtra-enterprise) */}
      <div>
          <div className="grid grid-cols-3 border-b-2 border-black">
            <button 
              onClick={() => setActiveSyncTab('SB')}
              className={`py-3 px-2 text-[10px] font-bold uppercase transition-colors ${activeSyncTab === 'SB' ? 'bg-[#ff90e8] text-black' : 'bg-white hover:bg-gray-100'}`}
            >
              Storybook
            </button>
            <button 
              onClick={() => setActiveSyncTab('GH')}
              className={`py-3 px-2 text-[10px] font-bold uppercase transition-colors border-l-2 border-black ${activeSyncTab === 'GH' ? 'bg-[#ff90e8] text-black' : 'bg-white hover:bg-gray-100'}`}
            >
              GitHub
            </button>
            <button 
              onClick={() => setActiveSyncTab('BB')}
              className={`py-3 px-2 text-[10px] font-bold uppercase transition-colors border-l-2 border-black ${activeSyncTab === 'BB' ? 'bg-[#ff90e8] text-black' : 'bg-white hover:bg-gray-100'}`}
            >
              Bitbucket
            </button>
          </div>

          {activeSyncTab === 'SB' && (
            <div className="px-2 py-2 animate-in slide-in-from-left-2">
              {!isSbConnected ? (
                <div className="space-y-3">
                  <p className="text-xs font-medium">Pick a public Storybook or enter your own URL. We’ll check that it exposes the stories API.</p>
                  <div className="flex flex-col gap-2 relative z-20">
                    <label className="text-[10px] font-bold uppercase text-gray-600">Quick pick</label>
                    <BrutalDropdown
                      open={isPresetOpen}
                      onOpenChange={setIsPresetOpen}
                      className="w-full"
                      maxHeightClassName="max-h-48"
                      trigger={
                        <button
                          type="button"
                          onClick={() => setIsPresetOpen(!isPresetOpen)}
                          className={`${BRUTAL.input} w-full flex justify-between items-center gap-2 cursor-pointer h-10 bg-white px-3 py-2 text-left`}
                        >
                          <span className="text-xs font-bold uppercase truncate min-w-0" title={selectedPresetLabel}>
                            {selectedPresetLabel}
                          </span>
                          <span className="shrink-0 text-[10px]" aria-hidden>
                            {isPresetOpen ? '▲' : '▼'}
                          </span>
                        </button>
                      }
                    >
                      {PRESET_STORYBOOKS.map((p) => (
                        <div
                          key={p.value || 'custom'}
                          role="option"
                          onClick={() => {
                            setConnectInput(p.value);
                            setIsPresetOpen(false);
                          }}
                          className={`${brutalSelectOptionRowClass} ${p.value === connectInput ? brutalSelectOptionSelectedClass : ''}`.trim()}
                        >
                          {p.label}
                        </div>
                      ))}
                    </BrutalDropdown>
                    <label className="text-[10px] font-bold uppercase text-gray-600">Or paste URL</label>
                    <input
                      type="text"
                      inputMode="url"
                      autoComplete="url"
                      placeholder="https://jetbrains.github.io/ring-ui/master"
                      value={connectInput}
                      onChange={(e) => {
                        setConnectInput(e.target.value);
                      }}
                      className="w-full border-2 border-black px-3 py-2 text-xs font-mono placeholder:text-gray-400 outline-none min-w-0"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 border border-dashed border-gray-400 bg-gray-50 p-2">
                    <span className="text-[10px] font-bold uppercase text-gray-700">Private Storybook (use access token)</span>
                    <button
                      type="button"
                      onClick={() => setUsePrivateToken(!usePrivateToken)}
                      className={`text-[10px] font-bold uppercase px-2 py-1 border-2 border-black shrink-0 ${usePrivateToken ? `bg-[${COLORS.primary}] text-black` : 'bg-white text-gray-600'}`}
                    >
                      {usePrivateToken ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  {usePrivateToken && (
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-1">Access token</label>
                      <input
                        type="password"
                        placeholder="Bearer token"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        className="w-full border-2 border-black px-3 py-2 text-xs font-mono placeholder:text-gray-400 outline-none"
                      />
                      <p className="text-[9px] text-gray-400 mt-0.5">Paste either the raw token or <code className="bg-gray-100 px-0.5">Bearer &lt;token&gt;</code>. Private checks run through the backend only.</p>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-500">If your build doesn’t expose GET /api/stories yet, add <strong>storybook-api</strong> to your project (same URL will then work). Use ngrok for local.</p>
                  {connectError && (
                    <div className="p-2 bg-red-50 border border-red-200 text-[10px] text-red-700">
                      {connectError}
                    </div>
                  )}
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={handleConnectClick}
                    disabled={!connectInput.trim() || isConnecting}
                    className="bg-pink-100 hover:bg-pink-200 relative"
                  >
                    {isConnecting ? 'Checking…' : 'Connect Storybook'}
                    <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">PRO</span>
                  </Button>
                  <div className="pt-2 mt-2 border-t border-gray-200">
                    <p className="text-[9px] text-gray-500 leading-relaxed">
                      <strong className="text-gray-700">Security:</strong> Your token is only sent over HTTPS to our backend for the scan and is not stored anywhere. We never log or persist it.
                    </p>
                  </div>
                  <div className="mt-3 p-2 border-2 border-dashed border-gray-300 bg-gray-50">
                    <p className="text-[10px] text-gray-600 mb-1.5">Your URL doesn’t work yet?</p>
                    <button
                      type="button"
                      onClick={() => setShowGuideModal(true)}
                      className="text-[10px] font-bold uppercase underline hover:text-pink-600"
                    >
                      How to expose the stories API →
                    </button>
                  </div>
                  {showGuideModal && <SyncStorybookGuideModal onClose={() => setShowGuideModal(false)} />}
                </div>
              ) : (
                <div>
                  {storybookUrl && (
                    <div className="mb-2">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] text-gray-500 font-mono truncate flex-1" title={storybookUrl}>
                          Connected: {storybookUrl}
                        </p>
                      {onDisconnectSb && (
                        <button onClick={onDisconnectSb} className="text-[10px] font-bold underline hover:text-[#ff90e8] ml-1">
                          Change
                        </button>
                      )}
                      </div>
                      {storybookConnectionInfo?.endpointPath ? (
                        <p className="mt-1 text-[9px] font-bold uppercase text-gray-500">
                          Found {storybookConnectionInfo.entryCount ?? 0} entries from <code className="bg-gray-100 px-1">{storybookConnectionInfo.endpointPath}</code>
                          {storybookConnectionInfo.checkedVia ? ` via ${storybookConnectionInfo.checkedVia}` : ''}
                        </p>
                      ) : null}
                    </div>
                  )}
                  {syncScanError && (
                    <div className="mb-3 p-2 bg-red-50 border border-red-200 text-[10px] text-red-700 space-y-1">
                      <p>{syncScanError}</p>
                      {syncScanUpgradeUrl ? (
                        <a
                          href={syncScanUpgradeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold underline text-red-900 block"
                        >
                          Upgrade your Figma plan for higher limits
                        </a>
                      ) : null}
                    </div>
                  )}
                  {!hasSyncScanned ? (
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500 mb-2">Ready to inspect.</p>
                      <Button
                        variant="black"
                        fullWidth
                        layout="row"
                        onClick={handleScanClick}
                        disabled={isSyncScanning || !!getRemainingTime('scan_sync')}
                        className={
                          `relative overflow-hidden${isSyncScanning ? ' disabled:!bg-[#ffc900] disabled:!text-black disabled:hover:!bg-[#ffb700] disabled:cursor-wait' : ''}`
                        }
                      >
                        {isSyncScanning ? (
                          <span className="absolute inset-0">
                            <span
                              className="absolute inset-y-0 left-0 bg-yellow-300"
                              style={{ animation: 'fill-cta-bar 1600ms linear infinite' }}
                              aria-hidden
                            />
                          </span>
                        ) : null}
                        <span className="relative z-10">
                          {isSyncScanning ? 'Scanning Drift...' : getRemainingTime('scan_sync') ? `Wait ${getRemainingTime('scan_sync')}` : `Scan Project`}
                        </span>
                        {!getRemainingTime('scan_sync') && (
                          <span className="absolute bottom-0.5 right-1 z-10 text-[8px] bg-[#ff90e8] text-black px-1 font-bold rounded-sm">
                            -15 Credits
                          </span>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-end mb-3">
                        <span className="text-xs font-bold uppercase">Drift Detected</span>
                        <span className="text-[10px] font-bold bg-[#ffc900] text-black px-1.5 py-0.5 rounded-sm border border-black">{syncItems.length} Violations</span>
                      </div>
                      
                      {syncItems.length === 0 ? (
                        <div className="text-center py-4 bg-green-50 border-2 border-green-200 border-dashed mb-4">
                          <span className="text-2xl block mb-1">🙌</span>
                          <span className="text-xs font-bold text-green-700 uppercase">Everything Synchronized</span>
                          {lastSyncAllDate && (
                            <span className="text-[9px] font-mono text-gray-400 block mt-1">
                                Last synced: {lastSyncAllDate.toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 mb-4 max-h-[220px] overflow-y-auto">
                          {syncItems.map(item => {
                            const isExpanded = expandedDriftId === item.id;
                            return (
                              <div 
                                key={item.id} 
                                onClick={() => setExpandedDriftId(isExpanded ? null : item.id)}
                                className={`${BRUTAL.card} p-3 transition-all ${isExpanded ? 'shadow-[6px_6px_0_0_#000] border-black' : 'bg-white hover:shadow-[6px_6px_0_0_#000] cursor-pointer'}`}
                              >
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[8px] px-1 font-bold border uppercase ${getDriftBadgeClass(item.status)}`}>
                                                  {item.status.replace(/_/g, ' ')}
                                                </span>
                                                <span className="font-bold text-xs">{item.name}</span>
                                            </div>
                                            <div className="text-[10px] text-gray-500 font-mono">Last Edit: {item.lastEdited}</div>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold underline hover:text-[#ff90e8]">{isExpanded ? 'CLOSE' : 'VIEW'}</span>
                                </div>

                                {isExpanded && (
                                    <div className="mt-4 pt-3 border-t-2 border-dashed border-black animate-in slide-in-from-top-1">
                                        <p className="text-xs font-medium mb-4 leading-relaxed">
                                            Issue: {item.desc}.<br/>Action: Sync to resolve drift.
                                        </p>
                                        <div className="mb-3 space-y-1 border border-dashed border-gray-300 bg-gray-50 p-2 text-[10px] text-gray-600">
                                          {item.reason ? <p><strong>Why:</strong> {item.reason}</p> : null}
                                          {item.confidence ? <p><strong>Confidence:</strong> {item.confidence}</p> : null}
                                          {item.figmaName ? <p><strong>Figma:</strong> {item.figmaName}</p> : null}
                                          {item.storybookName ? <p><strong>Storybook:</strong> {item.storybookName}</p> : null}
                                          {item.suggestedAction ? <p><strong>Suggested:</strong> {item.suggestedAction}</p> : null}
                                          {item.storybookUrl ? (
                                            <a
                                              href={item.storybookUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="block font-bold underline hover:text-[#ff90e8]"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              Open Storybook story
                                            </a>
                                          ) : null}
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={(e) => handleSelectLayer(item.id, item.layerId ?? null, e)}
                                                disabled={!item.layerId}
                                                className={`flex-1 border-2 border-black text-[10px] font-bold uppercase py-2 transition-colors ${layerSelectionFeedback === item.id ? 'bg-white text-black' : 'bg-white hover:bg-gray-100'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                            >
                                                {layerSelectionFeedback === item.id ? 'SELECTED!' : item.layerId ? 'Select Layer' : 'No layer'}
                                            </button>
                                            <Button
                                                variant="primary"
                                                layout="row"
                                                size="sm"
                                                onClick={(e) => handleSyncItem(item, e)}
                                                disabled={!item.syncAction}
                                                className="flex-1 h-12 relative"
                                            >
                                                {item.syncAction ? 'Apply in Figma' : 'Manual Review'}
                                                {item.syncAction ? (
                                                  <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">-5 Credits</span>
                                                ) : null}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {syncItems.length > 0 && (
                        <>
                          <div className="mb-2 space-y-1 border border-dashed border-gray-300 bg-gray-50 p-2 text-[10px] text-gray-600">
                            <p>
                              <strong>Sync All needs the source repo.</strong> Storybook tells us what is live, but code changes must be applied to the repository or source that builds it.
                            </p>
                            <p>
                              Connect GitHub, Bitbucket, GitLab or a custom source, then we can push fixes on the right side.
                            </p>
                          </div>
                          <Button
                            variant="primary"
                            fullWidth
                            layout="row"
                            onClick={onConnectSourceProvider ?? handleSyncAll}
                            className="relative h-12"
                          >
                            <span>Sync All</span>
                            <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm border border-black">
                              Connect Source
                            </span>
                          </Button>
                        </>
                      )}

                      {/* Rescan Button */}
                      {syncItems.length === 0 && (
                          <button 
                            onClick={handleScanClick}
                            disabled={!!getRemainingTime('scan_sync')}
                            className="w-full bg-black text-white border-2 border-black h-12 px-4 text-xs font-bold uppercase hover:bg-gray-800 flex justify-between items-center shadow-[4px_4px_0_0_rgba(0,0,0,0.2)] disabled:bg-gray-600 mt-2"
                          >
                            <span>{getRemainingTime('scan_sync') ? `Cooldown ${getRemainingTime('scan_sync')}` : 'Start New Scan'}</span>
                            {(!getRemainingTime('scan_sync')) && (
                                <span className="text-[10px] bg-white text-black px-2 py-0.5 rounded-sm font-black">
                                   -15 Credits
                                </span>
                            )}
                          </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeSyncTab === 'GH' && (
            <div className="p-6 text-center animate-in slide-in-from-right-2">
              <p className="text-xs font-bold uppercase text-gray-400 mb-2">Integration In Progress</p>
              <Button variant="secondary" fullWidth disabled className="bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed">
                Connect GitHub (Soon)
              </Button>
            </div>
          )}

          {activeSyncTab === 'BB' && (
            <div className="p-6 text-center animate-in slide-in-from-right-2">
              <p className="text-xs font-bold uppercase text-gray-400 mb-2">Integration In Progress</p>
              <Button variant="secondary" fullWidth disabled className="bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed">
                Connect Bitbucket (Soon)
              </Button>
            </div>
          )}

          <p className="text-[10px] text-gray-500 px-4 pb-3 pt-2 border-t border-gray-100 mt-2 leading-relaxed">
            Need to connect a private Storybook or one behind SSO?{' '}
            <a
              href="https://calendly.com/comtra-enterprise"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline hover:text-[#ff90e8]"
            >
              Book a call
            </a>{' '}
            for an enterprise setup.
          </p>
        </div>
    </div>
  );
};
