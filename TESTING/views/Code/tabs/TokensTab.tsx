
import React from 'react';
import { TokensTabProps, BRUTAL, COLORS } from '../types';

export const TokensTab: React.FC<TokensTabProps> = ({
  lastGeneratedCssDate,
  lastSyncedStorybookDate,
  generatedCss,
  isGeneratingCss,
  copiedCss,
  handleGenerateCss,
  handleCopyCss,
  handleTokenSync,
  isSyncingTokens,
  getRemainingTime,
  isTokensSynced,
  generatedJson,
  lastGeneratedJsonDate,
  isGeneratingJson,
  copiedJson,
  handleGenerateJson,
  handleCopyJson,
  isJsonSynced
}) => {
  return (
    <div className="flex flex-col gap-4 animate-in slide-in-from-left-2">
       <div className="bg-white border-2 border-black p-3 text-[10px] font-medium leading-tight shadow-[4px_4px_0_0_#000]">
          <span className="font-bold uppercase block mb-1">⚠️ Crucial Step</span>
          <span className="leading-tight block">You must copy/paste this code into your project's global stylesheet first. It defines the core variables required for individual components to work correctly.</span>
       </div>

       {/* SECTION 1: RAW CSS */}
       <div className="flex flex-col gap-1 border-2 border-black bg-black p-4 text-white shadow-[4px_4px_0_0_#000]">
        <div className="flex justify-between items-start mb-2 border-b border-gray-700 pb-2">
            <label className="text-[10px] font-bold uppercase pl-1 inline-block w-fit px-1 text-[#ff90e8] self-end">Raw CSS & Tokens</label>
            <div className="flex flex-col items-end">
                {lastGeneratedCssDate && (
                    <span className="text-[9px] font-mono text-gray-400">
                        CSS Generated: {lastGeneratedCssDate.toLocaleTimeString()}
                    </span>
                )}
                {lastSyncedStorybookDate && (
                    <span className="text-[9px] font-mono text-[#ffc900]">
                        SB Synced: {lastSyncedStorybookDate.toLocaleTimeString()}
                    </span>
                )}
            </div>
        </div>
        
        {!generatedCss ? (
          <button 
              onClick={handleGenerateCss} 
              disabled={!!getRemainingTime('css_update') || isGeneratingCss}
              className={`${BRUTAL.btn} bg-[${COLORS.primary}] text-black w-full flex justify-center items-center gap-2 relative mt-2 hover:bg-white hover:border-black disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {getRemainingTime('css_update') ? `Wait ${getRemainingTime('css_update')}` : (isGeneratingCss ? 'Updating...' : 'Generate CSS & Tokens')}
              {!getRemainingTime('css_update') && <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">FREE</span>}
            </button>
        ) : (
          <div className="animate-in fade-in">
            <div className="bg-[#1a1a1a] border border-gray-700 p-2 font-mono text-[9px] text-[#ffc900] h-32 overflow-y-auto mb-3 custom-scrollbar">
              <pre>{generatedCss}</pre>
            </div>
            
            {/* CSS Actions */}
            <div className="flex flex-col gap-2">
                <button className={`${BRUTAL.btn} w-full text-[10px] bg-white text-black border-white hover:bg-gray-200`} onClick={handleCopyCss}>
                  {copiedCss ? 'COPIED!' : 'Copy CSS'}
                </button>
                
                <button 
                    onClick={handleGenerateCss} 
                    disabled={!!getRemainingTime('css_update') || isGeneratingCss}
                    className={`${BRUTAL.btn} bg-[${COLORS.primary}] text-black w-full flex justify-center items-center gap-2 relative hover:bg-white hover:border-black disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {getRemainingTime('css_update') ? `Wait ${getRemainingTime('css_update')}` : (isGeneratingCss ? 'Updating...' : 'Update CSS')}
                  {!getRemainingTime('css_update') && <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">FREE</span>}
                </button>

                <button 
                    className={`${BRUTAL.btn} w-full h-12 text-[10px] border-white relative disabled:opacity-60 disabled:cursor-not-allowed flex justify-center items-center gap-2 ${
                        isTokensSynced 
                            ? 'bg-white text-gray-400 border-gray-300' 
                            : 'bg-transparent text-white hover:bg-white hover:text-black'
                    }`} 
                    onClick={() => handleTokenSync('SB')}
                    disabled={isSyncingTokens || !!getRemainingTime('token_sync') || isTokensSynced}
                >
                    {isSyncingTokens ? 'Syncing...' : getRemainingTime('token_sync') ? `Wait ${getRemainingTime('token_sync')}` : isTokensSynced ? 'Synced (No Changes)' : lastSyncedStorybookDate ? 'Update Storybook' : 'Sync Storybook'}
                    {!getRemainingTime('token_sync') && !isTokensSynced && <span className="absolute bottom-0.5 right-1 text-[8px] bg-[#ff90e8] text-black px-1 font-bold rounded-sm">-10 Credits</span>}
                    {isTokensSynced && <span className="absolute bottom-0.5 right-1 text-[8px] bg-green-500 text-white px-1 font-bold rounded-sm">✓</span>}
                </button>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: JSON */}
      <div className="flex flex-col gap-1 border-2 border-black bg-black p-4 text-white shadow-[4px_4px_0_0_#000]">
        <div className="flex justify-between items-start mb-2 border-b border-gray-700 pb-2">
            <label className="text-[10px] font-bold uppercase pl-1 inline-block w-fit px-1 text-[#ff90e8] self-end">JSON</label>
            <div className="flex flex-col items-end">
                {lastGeneratedJsonDate && (
                    <span className="text-[9px] font-mono text-gray-400">
                        JSON Generated: {lastGeneratedJsonDate.toLocaleTimeString()}
                    </span>
                )}
                {lastSyncedStorybookDate && (
                    <span className="text-[9px] font-mono text-[#ffc900]">
                        SB Synced: {lastSyncedStorybookDate.toLocaleTimeString()}
                    </span>
                )}
            </div>
        </div>
        
        {!generatedJson ? (
          <button 
              onClick={handleGenerateJson} 
              disabled={!!getRemainingTime('json_update') || isGeneratingJson}
              className={`${BRUTAL.btn} bg-[${COLORS.primary}] text-black w-full flex justify-center items-center gap-2 relative mt-2 hover:bg-white hover:border-black disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {getRemainingTime('json_update') ? `Wait ${getRemainingTime('json_update')}` : (isGeneratingJson ? 'Generating...' : 'Generate JSON')}
              {!getRemainingTime('json_update') && <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">FREE</span>}
            </button>
        ) : (
          <div className="animate-in fade-in">
            <div className="bg-[#1a1a1a] border border-gray-700 p-2 font-mono text-[9px] text-[#ffc900] h-32 overflow-y-auto mb-3 custom-scrollbar">
              <pre>{generatedJson}</pre>
            </div>
            
            {/* JSON Actions */}
            <div className="flex flex-col gap-2">
                <button className={`${BRUTAL.btn} w-full text-[10px] bg-white text-black border-white hover:bg-gray-200`} onClick={handleCopyJson}>
                  {copiedJson ? 'COPIED!' : 'Copy JSON'}
                </button>
                
                <button 
                    onClick={handleGenerateJson} 
                    disabled={!!getRemainingTime('json_update') || isGeneratingJson}
                    className={`${BRUTAL.btn} bg-[${COLORS.primary}] text-black w-full flex justify-center items-center gap-2 relative hover:bg-white hover:border-black disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {getRemainingTime('json_update') ? `Wait ${getRemainingTime('json_update')}` : (isGeneratingJson ? 'Updating...' : 'Update JSON')}
                  {!getRemainingTime('json_update') && <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">FREE</span>}
                </button>

                <button 
                    className={`${BRUTAL.btn} w-full h-12 text-[10px] border-white relative disabled:opacity-60 disabled:cursor-not-allowed flex justify-center items-center gap-2 ${
                        isJsonSynced 
                            ? 'bg-white text-gray-400 border-gray-300' 
                            : 'bg-transparent text-white hover:bg-white hover:text-black'
                    }`} 
                    onClick={() => handleTokenSync('SB')}
                    disabled={isSyncingTokens || !!getRemainingTime('token_sync') || isJsonSynced}
                >
                    {isSyncingTokens ? 'Syncing...' : getRemainingTime('token_sync') ? `Wait ${getRemainingTime('token_sync')}` : isJsonSynced ? 'Synced (No Changes)' : lastSyncedStorybookDate ? 'Update Storybook' : 'Sync Storybook'}
                    {!getRemainingTime('token_sync') && !isJsonSynced && <span className="absolute bottom-0.5 right-1 text-[8px] bg-[#ff90e8] text-black px-1 font-bold rounded-sm">-10 Credits</span>}
                    {isJsonSynced && <span className="absolute bottom-0.5 right-1 text-[8px] bg-green-500 text-white px-1 font-bold rounded-sm">✓</span>}
                </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
