
import React from 'react';
import { SyncTabProps, BRUTAL, COLORS } from '../types';

export const SyncTab: React.FC<SyncTabProps> = ({
  isPro,
  onUnlockRequest,
  activeSyncTab,
  setActiveSyncTab,
  isSbConnected,
  handleConnectSb,
  hasSyncScanned,
  handleSyncScan,
  isSyncScanning,
  getRemainingTime,
  syncItems,
  expandedDriftId,
  setExpandedDriftId,
  handleSelectLayer,
  layerSelectionFeedback,
  handleSyncItem,
  handleSyncAll,
  lastSyncAllDate,
  onScanComplete
}) => {
  
  const handleScanClick = () => {
      handleSyncScan();
      // Simulate level up trigger after scan logic initiates (mocking the delay in parent)
      if (onScanComplete) {
          setTimeout(() => {
              onScanComplete();
          }, 2200); // Slightly after the scan logic timeout in parent
      }
  };

  return (
    <div className={`${BRUTAL.card} relative overflow-hidden bg-white p-0 animate-in slide-in-from-right-2`}>
      <div className="p-3 border-b-2 border-black bg-black text-white flex justify-between items-center">
        <h3 className="font-bold uppercase text-xs">Deep Sync</h3>
      </div>

      {!isPro ? (
        <div className="p-6 text-center">
          <p className="text-xs font-medium text-gray-500 mb-4">
            Unlock Deep Sync to connect Storybook, GitHub & BitBucket and detect design drift automatically.
          </p>
          <button 
            onClick={onUnlockRequest} 
            className={`${BRUTAL.btn} w-full bg-[${COLORS.primary}] text-black relative flex justify-center items-center gap-2`}
          >
            Upgrade to Sync
            <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">PRO</span>
          </button>
        </div>
      ) : (
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
                <div className="text-center">
                  <p className="text-xs mb-3 font-medium">Connect your instance to audit code vs design.</p>
                  <button onClick={handleConnectSb} className={`${BRUTAL.btn} w-full bg-pink-100 hover:bg-pink-200`}>
                    Connect Storybook
                  </button>
                </div>
              ) : (
                <div>
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
                                                onClick={(e) => handleSelectLayer(item.id, e)}
                                                className={`flex-1 border-2 border-black text-[10px] font-bold uppercase py-2 transition-colors ${layerSelectionFeedback === item.id ? 'bg-white text-black' : 'bg-white hover:bg-gray-100'}`}
                                            >
                                                {layerSelectionFeedback === item.id ? 'SELECTED!' : 'Select Layer'}
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
                        <button 
                            onClick={handleSyncAll} 
                            className={`${BRUTAL.btn} w-full bg-[${COLORS.primary}] text-black flex justify-center items-center gap-2 relative h-12`}
                        >
                          <span>Sync All</span>
                          <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm border border-black">
                             -{syncItems.length * 5} Credits
                          </span>
                        </button>
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
                                   -5 Credits
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
        </div>
      )}
    </div>
  );
};
