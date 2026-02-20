import React, { useState } from 'react';
import { BRUTAL, COLORS } from '../../../constants';
import { IssueList } from '../components/IssueList';
import { AuditIssue } from '../../../types';

interface DeepAnalysisTabProps {
  activeTab: string;
  selectedLayer: string | null;
  setSelectedLayer: (id: string | null) => void;
  hasDeepScanned: boolean;
  setHasDeepScanned: (scanned: boolean) => void;
  lastDeepScanDate: Date | null;
  isDeepScanning: boolean;
  activeIssues: AuditIssue[];
  onDeepScan: () => void;
  
  // IssueList Props
  issueListProps: any;
}

export const DeepAnalysisTab: React.FC<DeepAnalysisTabProps> = ({
  activeTab,
  selectedLayer,
  setSelectedLayer,
  hasDeepScanned,
  setHasDeepScanned,
  lastDeepScanDate,
  isDeepScanning,
  activeIssues,
  onDeepScan,
  issueListProps
}) => {
  const [isCalculating, setIsCalculating] = useState(false);

  const handleScanClick = () => {
    setIsCalculating(true);
    setTimeout(() => {
        onDeepScan();
        setIsCalculating(false);
    }, 800);
  };

  return (
    <div className="flex flex-col gap-4 animate-in slide-in-from-right-2 mt-4">
       <div className={`${BRUTAL.card} bg-white py-3 flex flex-col gap-2`}>
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold uppercase">Target Layer</span>
          <button 
            onClick={() => { setSelectedLayer(selectedLayer ? null : "Hero_Section_V2"); setHasDeepScanned(false); }} 
            className="text-[10px] font-bold bg-black text-white px-2 py-1"
          >
            {selectedLayer ? 'Deselect' : 'Select Frame'}
          </button>
        </div>
        {selectedLayer ? (
          <div className="flex justify-between items-center">
              <span className="font-mono text-lg font-black text-black">{selectedLayer}</span>
              {hasDeepScanned && lastDeepScanDate && (
                  <span className="text-[9px] font-mono text-gray-400 bg-gray-50 px-1 border border-gray-100 rounded-sm">
                      Scanned: {lastDeepScanDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
              )}
          </div>
        ) : (
          <span className="w-fit bg-red-100 text-red-600 border-2 border-red-600 px-3 py-2 font-black uppercase text-sm inline-block transform -rotate-1">
            No Layer Selected
          </span>
        )}
      </div>

      {selectedLayer ? (
         !hasDeepScanned ? (
            <div className="animate-in fade-in mt-4">
                <button 
                    onClick={handleScanClick}
                    className={`${BRUTAL.btn} w-full bg-[${COLORS.primary}] text-black flex justify-center items-center gap-2 relative h-12 disabled:bg-gray-200 disabled:cursor-wait`}
                    disabled={isDeepScanning || isCalculating}
                >
                    {isCalculating ? 'CALCULATING NODES...' : (isDeepScanning ? 'Scanning...' : 'Scan Wireframe')}
                    {!isCalculating && !isDeepScanning && (
                        <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm border border-black shadow-[1px_1px_0_0_#000]">CALCULATE COST</span>
                    )}
                </button>
            </div>
         ) : (
            <div className="flex flex-col animate-in fade-in">
                <div className="flex justify-between items-center mb-2 px-1 py-2 border-b-2 border-black/10">
                    <h3 className="font-black uppercase text-xs">
                        {activeTab === 'A11Y' ? 'Accessibility Report' : activeTab === 'UX' ? 'UX Logic Report' : 'Prototype Scan'}
                    </h3>
                    <span className="text-[10px] font-bold bg-[#ffc900] text-black px-1.5 py-0.5 rounded-sm border border-black">{activeIssues.length} Violations</span>
                </div>
                <IssueList 
                    displayIssues={activeIssues} // In deep scan we usually show all
                    activeIssues={activeIssues}
                    {...issueListProps} 
                />
            </div>
         )
      ) : (
         <div className="text-center p-8 opacity-50">
            <div className="text-2xl mb-2">👈</div>
            <p className="text-xs font-bold uppercase">Select a frame to scan for {activeTab}</p>
         </div>
      )}
    </div>
  );
};