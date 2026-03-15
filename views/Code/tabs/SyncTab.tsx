
import React, { useState, useRef, useEffect } from 'react';
import { SyncTabProps, BRUTAL, COLORS } from '../types';
import { SyncStorybookGuideModal } from '../../../components/SyncStorybookGuideModal';

const PRESET_STORYBOOKS: { label: string; value: string }[] = [
  { label: 'Custom URL…', value: '' },
  { label: 'Carbon Design System (IBM)', value: 'https://react.carbondesignsystem.com' },
  { label: 'Chakra UI', value: 'https://chakra-ui.netlify.app' },
  { label: 'SAP Fundamental Styles', value: 'https://sap.github.io/fundamental-styles' },
  { label: 'Grafana UI', value: 'https://developers.grafana.com/ui/latest' },
  { label: 'Ring UI (JetBrains)', value: 'https://jetbrains.github.io/ring-ui/master' },
  { label: 'GitLab UI', value: 'https://gitlab-org.gitlab.io/gitlab/storybook' },
];

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

/** Check Storybook lato client (browser): prova /api/stories, /api/components, /index.json. Per URL pubblici evita il backend. */
async function checkStorybookFromClient(
  baseUrl: string,
  token?: string
): Promise<{ ok: boolean; error?: string }> {
  const urlsToTry = [
    `${baseUrl}/api/stories`,
    `${baseUrl}/api/components`,
    `${baseUrl}/index.json`,
  ];
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token?.trim()) headers['Authorization'] = `Bearer ${token.trim()}`;

  for (const url of urlsToTry) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data.stories)) return { ok: true };
      if (Array.isArray(data.components)) return { ok: true };
      if (data.entries && typeof data.entries === 'object') return { ok: true };
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
  handleConnectSb,
  fetchCheckStorybook,
  onDisconnectSb,
  hasSyncScanned,
  handleSyncScan,
  isSyncScanning,
  getRemainingTime,
  syncItems,
  syncScanError,
  expandedDriftId,
  setExpandedDriftId,
  handleSelectLayer,
  layerSelectionFeedback,
  handleSyncItem,
  handleSyncAll,
  lastSyncAllDate
}) => {
  const [connectInput, setConnectInput] = useState(storybookUrl || '');
  const [tokenInput, setTokenInput] = useState(storybookToken || '');
  const [usePrivateToken, setUsePrivateToken] = useState(!!storybookToken);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isPresetOpen, setIsPresetOpen] = useState(false);
  const presetDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(e.target as Node)) {
        setIsPresetOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedPresetLabel = PRESET_STORYBOOKS.find((p) => p.value === connectInput)?.label ?? 'Custom URL…';

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
      // Prima prova dal browser (nessun backend): per URL pubblici basta leggere da qui
      let result = await checkStorybookFromClient(url, token);
      // Se il client fallisce (es. CORS), fallback al backend (può funzionare con token o reti diverse)
      if (!result.ok && fetchCheckStorybook) {
        result = await fetchCheckStorybook(url, token);
      }
      if (result.ok) {
        handleConnectSb(url, token);
        if (url !== raw) setConnectInput(url);
      } else {
        setConnectError(result.error || 'Connection failed.');
      }
    } catch {
      setConnectError('Could not reach the URL. Check it is deployed and reachable.');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className={`${BRUTAL.card} relative overflow-hidden bg-white p-0 animate-in slide-in-from-right-2`}>
      <div className="p-3 border-b-2 border-black bg-black text-white flex justify-between items-center">
        <h3 className="font-bold uppercase text-xs">Deep Sync</h3>
      </div>

      {/* TEMPORARY: PRO gate disabled for Deep Sync until Lemon Squeezy store is live — see docs/TO-DO-BEFORE-GOING-LIVE.md "Restore PRO gate for Deep Sync". When restoring, show upgrade block when !isPro with copy: "Need to connect a private Storybook or one behind SSO? Book a call for an enterprise setup." (Calendly link: https://calendly.com/comtra-enterprise) */}
      <div>
          <div className="grid grid-cols-3 border-b-2 border-black">
            <button 
              onClick={() => setActiveSyncTab('SB')}
              className={`py-2 text-[10px] font-bold uppercase transition-colors ${activeSyncTab === 'SB' ? 'bg-[#ff90e8] text-black' : 'bg-white hover:bg-gray-100'}`}
            >
              Storybook
            </button>
            <button 
              onClick={() => setActiveSyncTab('GH')}
              className={`py-2 text-[10px] font-bold uppercase transition-colors border-l-2 border-black ${activeSyncTab === 'GH' ? 'bg-[#ff90e8] text-black' : 'bg-white hover:bg-gray-100'}`}
            >
              GitHub
            </button>
            <button 
              onClick={() => setActiveSyncTab('BB')}
              className={`py-2 text-[10px] font-bold uppercase transition-colors border-l-2 border-black ${activeSyncTab === 'BB' ? 'bg-[#ff90e8] text-black' : 'bg-white hover:bg-gray-100'}`}
            >
              Bitbucket
            </button>
          </div>

          {activeSyncTab === 'SB' && (
            <div className="p-4 animate-in slide-in-from-left-2">
              {!isSbConnected ? (
                <div className="space-y-3">
                  <p className="text-xs font-medium">Pick a public Storybook or enter your own URL. We’ll check that it exposes the stories API.</p>
                  <div className="flex flex-col gap-2 relative z-20" ref={presetDropdownRef}>
                    <label className="text-[10px] font-bold uppercase text-gray-600">Quick pick</label>
                    <div
                      onClick={() => setIsPresetOpen(!isPresetOpen)}
                      className={`${BRUTAL.input} w-full flex justify-between items-center gap-2 cursor-pointer h-10 bg-white px-3 py-2`}
                    >
                      <span className="text-xs font-bold uppercase truncate min-w-0" title={selectedPresetLabel}>
                        {selectedPresetLabel}
                      </span>
                      <span className="shrink-0 text-[10px]">{isPresetOpen ? '▲' : '▼'}</span>
                    </div>
                    {isPresetOpen && (
                      <div className="absolute top-full left-0 right-0 bg-white border-2 border-black border-t-0 shadow-[4px_4px_0_0_#000] text-left z-30 max-h-48 overflow-y-auto custom-scrollbar">
                        {PRESET_STORYBOOKS.map((p) => (
                          <div
                            key={p.value || 'custom'}
                            onClick={(e) => {
                              e.stopPropagation();
                              setConnectInput(p.value);
                              setIsPresetOpen(false);
                            }}
                            className={`p-2 text-xs cursor-pointer border-b border-gray-100 last:border-0 ${p.value === connectInput ? 'bg-black text-white' : 'hover:bg-[#ff90e8]'}`}
                          >
                            {p.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <label className="text-[10px] font-bold uppercase text-gray-600 block mt-1">Or paste URL</label>
                  <input
                    type="url"
                    placeholder="https://react.carbondesignsystem.com"
                    value={connectInput}
                    onChange={(e) => {
                      setConnectInput(e.target.value);
                    }}
                    className="w-full border-2 border-black px-3 py-2 text-xs font-mono placeholder:text-gray-400 outline-none"
                  />
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
                      <p className="text-[9px] text-gray-400 mt-0.5">Sent as <code className="bg-gray-100 px-0.5">Authorization: Bearer &lt;token&gt;</code> when fetching stories.</p>
                    </div>
                  )}
                  <p className="text-[10px] text-gray-500">If your build doesn’t expose GET /api/stories yet, add <strong>storybook-api</strong> to your project (same URL will then work). Use ngrok for local.</p>
                  {connectError && (
                    <div className="p-2 bg-red-50 border border-red-200 text-[10px] text-red-700">
                      {connectError}
                    </div>
                  )}
                  <button
                    onClick={handleConnectClick}
                    disabled={!connectInput.trim() || isConnecting}
                    className={`${BRUTAL.btn} w-full bg-pink-100 hover:bg-pink-200 disabled:bg-gray-200 disabled:cursor-not-allowed`}
                  >
                    {isConnecting ? 'Checking…' : 'Connect Storybook'}
                  </button>
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
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[10px] text-gray-500 font-mono truncate flex-1" title={storybookUrl}>
                        Connected: {storybookUrl}
                      </p>
                      {onDisconnectSb && (
                        <button onClick={onDisconnectSb} className="text-[10px] font-bold underline hover:text-[#ff90e8] ml-1">
                          Change
                        </button>
                      )}
                    </div>
                  )}
                  {syncScanError && (
                    <div className="mb-3 p-2 bg-red-50 border border-red-200 text-[10px] text-red-700">
                      {syncScanError}
                    </div>
                  )}
                  {!hasSyncScanned ? (
                    <div className="text-center">
                      <p className="text-[10px] text-gray-500 mb-2">Ready to inspect.</p>
                      <button 
                        onClick={handleScanClick} 
                        disabled={isSyncScanning || !!getRemainingTime('scan_sync')}
                        className={`${BRUTAL.btn} w-full bg-black text-white hover:bg-gray-800 disabled:bg-gray-400 relative`}
                      >
                        {isSyncScanning ? 'Scanning Drift...' : getRemainingTime('scan_sync') ? `Wait ${getRemainingTime('scan_sync')}` : `Scan Project`}
                        {(!getRemainingTime('scan_sync')) && <span className="absolute bottom-0.5 right-1 text-[8px] bg-[#ff90e8] text-black px-1 font-bold rounded-sm">-15 Credits</span>}
                      </button>
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
                                                <span className="text-[8px] bg-red-100 text-red-600 px-1 font-bold border border-red-200 uppercase">DRIFT</span>
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
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={(e) => handleSelectLayer(item.id, item.layerId ?? null, e)}
                                                disabled={!item.layerId}
                                                className={`flex-1 border-2 border-black text-[10px] font-bold uppercase py-2 transition-colors ${layerSelectionFeedback === item.id ? 'bg-white text-black' : 'bg-white hover:bg-gray-100'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                            >
                                                {layerSelectionFeedback === item.id ? 'SELECTED!' : item.layerId ? 'Select Layer' : 'No layer'}
                                            </button>
                                            <button 
                                                onClick={(e) => handleSyncItem(item.id, e)}
                                                className={`${BRUTAL.btn} flex-1 text-[10px] bg-[${COLORS.primary}] text-black hover:bg-white border-black relative h-12`}
                                            >
                                                Sync Fix
                                                <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">-5 Credits</span>
                                            </button>
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
                          <p className="text-[10px] text-gray-600 mb-2 px-1">
                            To push changes to your code, connect a Git repository (GitHub or Bitbucket). Don&apos;t have a repo? Create one and link your Storybook to it.
                          </p>
                          <button 
                            onClick={handleSyncAll} 
                            className={`${BRUTAL.btn} w-full bg-[${COLORS.primary}] text-black flex justify-center items-center gap-2 relative h-12`}
                          >
                            <span>Sync All</span>
                            <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm border border-black">
                               -{syncItems.length * 5} Credits
                            </span>
                          </button>
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
              <button disabled className={`${BRUTAL.btn} w-full bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed`}>
                Connect GitHub (Soon)
              </button>
            </div>
          )}

          {activeSyncTab === 'BB' && (
            <div className="p-6 text-center animate-in slide-in-from-right-2">
              <p className="text-xs font-bold uppercase text-gray-400 mb-2">Integration In Progress</p>
              <button disabled className={`${BRUTAL.btn} w-full bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed`}>
                Connect Bitbucket (Soon)
              </button>
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
