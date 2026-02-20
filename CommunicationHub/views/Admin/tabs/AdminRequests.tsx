
import React, { useState, useRef, useEffect } from 'react';
import { BRUTAL, RequestItem, RequestCategory } from '../types';
import { Confetti } from '../../../../components/Confetti'; // Reusing existing component for now

const INITIAL_REQUESTS: RequestItem[] = [
    { 
        id: 'r1', user: 'alice@design.co', email: 'alice@design.co', type: 'FEATURE', categoryTag: 'FEATURE', status: 'TODO', desc: 'Support for Tailwind v4', fullMessage: 'Hi team, loving the plugin. When will you support the new Tailwind v4 color opacity modifiers natively?', date: '2023-10-24' 
    },
    { 
        id: 'r2', user: 'bob@freelance.net', email: 'bob@freelance.net', type: 'BUG', categoryTag: 'BUG', status: 'DONE', desc: 'Crash when syncing', fullMessage: 'Syncing a frame with 5000 layers crashes the controller.', date: '2023-10-22' 
    },
    { 
        id: 'r3', user: 'charlie@ux.io', email: 'charlie@ux.io', type: 'BUG', categoryTag: 'FALSE_POSITIVE', status: 'IN_PROGRESS', desc: 'False positive on Contrast', fullMessage: 'The audit says 3:1 but my manual check says 4.5:1. See comparison.', date: '2023-10-24',
        images: { before: 'https://placehold.co/600x400/e2e8f0/1e293b?text=Audit+Result+(Fail)', after: 'https://placehold.co/600x400/1e293b/ffffff?text=Manual+Check+(Pass)' }
    },
    { 
        id: 'r4', user: 'dave@corp.com', email: 'dave@corp.com', type: 'FEATURE', categoryTag: 'GENERAL', status: 'TODO', desc: 'Enterprise SSO Question', fullMessage: 'Need info about Okta pricing.', date: '2023-10-20' 
    },
    {
        id: 'r5', user: 'eve@agency.it', email: 'eve@agency.it', type: 'BUG', categoryTag: 'AUDIT_ERROR', status: 'TODO', desc: 'Wrong Alignment Report', fullMessage: 'Auto-layout is active but it says misalignment.', date: '2023-10-25',
        images: { before: 'https://placehold.co/600x400/ffedd5/9a3412?text=Error+Report', after: 'https://placehold.co/600x400/dcfce7/166534?text=Actual+Figma' }
    }
];

const CHIP_FILTERS: { id: RequestCategory; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'AUDIT_ERROR', label: 'Audit Error' },
    { id: 'BUG', label: 'Bug' },
    { id: 'FALSE_POSITIVE', label: 'False Positives' },
    { id: 'FEATURE', label: 'Features' },
    { id: 'GENERAL', label: 'General' },
];

interface Props {
    dateFrom: string;
    dateTo: string;
    countryFilter: string;
}

// --- COMPONENT: Zoomable Image with Drag ---
const ZoomableImage = ({ src, label }: { src: string, label: string }) => {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const imgRef = useRef<HTMLDivElement>(null);

    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.max(1, Math.min(4, scale + delta));
        setScale(newScale);
        if (newScale === 1) setPosition({ x: 0, y: 0 }); // Reset pos if zoomed out
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale > 1) {
            e.preventDefault();
            setIsDragging(true);
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && scale > 1) {
            e.preventDefault();
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    return (
        <div 
            className="relative w-1/2 h-full overflow-hidden border-2 border-white/20 bg-black/50 select-none group"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <span className="absolute top-2 left-2 bg-black text-white px-2 py-1 font-black text-xs uppercase z-10 shadow-md border border-white/20 pointer-events-none">
                {label} {scale > 1 && `(${(scale * 100).toFixed(0)}%)`}
            </span>
            <div 
                ref={imgRef}
                className="w-full h-full flex items-center justify-center cursor-move"
                style={{ 
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                }}
            >
                <img src={src} className="max-w-full max-h-full object-contain pointer-events-none" alt={label} />
            </div>
        </div>
    );
};

export const AdminRequests: React.FC<Props> = ({ countryFilter }) => {
  const [requests, setRequests] = useState<RequestItem[]>(INITIAL_REQUESTS);
  const [requestFilter, setRequestFilter] = useState<'TODO' | 'IN_PROGRESS' | 'DONE'>('TODO');
  const [chipFilter, setChipFilter] = useState<RequestCategory>('ALL');
  
  const [search, setSearch] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  
  // Local State for Sidebar (to detect changes)
  const [tempStatus, setTempStatus] = useState<'TODO' | 'IN_PROGRESS' | 'DONE' | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Full Screen Image State
  const [isFullScreen, setIsFullScreen] = useState(false);

  const selectedRequest = requests.find(r => r.id === selectedRequestId);

  // When opening a request, sync temp status
  useEffect(() => {
      if (selectedRequest) {
          setTempStatus(selectedRequest.status);
      }
  }, [selectedRequest]);

  const handleSaveStatus = () => {
      if (!selectedRequestId || !tempStatus || !selectedRequest) return;

      if (tempStatus !== selectedRequest.status) {
          const adminEmail = 'admin@antigravity.ai';
          const dateStr = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: '2-digit' });
          
          let historyStr = '';
          if (tempStatus === 'TODO') {
              historyStr = `Moved back to TODO by ${adminEmail} on ${dateStr}`;
          } else {
              historyStr = `Moved to ${tempStatus.replace('_', ' ')} by ${adminEmail} on ${dateStr}`;
          }

          setRequests(prev => prev.map(req => {
              if (req.id === selectedRequestId) {
                  return { ...req, status: tempStatus, lastAction: historyStr };
              }
              return req;
          }));
          
          // Show confetti and close
          setShowConfetti(true);
          setTimeout(() => {
              setShowConfetti(false);
              setSelectedRequestId(null); 
          }, 2000);
      }
  };

  const handleImageClick = () => {
      setIsFullScreen(true);
  };

  const hasUnsavedChanges = selectedRequest && tempStatus !== selectedRequest.status;

  // Advanced Filtering Logic
  const filteredRequests = requests.filter(r => {
      const matchesStatus = r.status === requestFilter;
      const matchesChip = chipFilter === 'ALL' || r.categoryTag === chipFilter;
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        search === '' || 
        r.desc.toLowerCase().includes(searchLower) || 
        r.email.toLowerCase().includes(searchLower) || 
        r.id.toLowerCase().includes(searchLower);
      
      const matchesCountry = countryFilter === 'All World' ? true : true; 

      return matchesStatus && matchesChip && matchesSearch && matchesCountry;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative max-w-[100vw] overflow-x-hidden">
        {showConfetti && <Confetti />}
        
        {/* Sub-Navigation Tabs (Status) */}
        <div className="flex border-b-2 border-black bg-white shrink-0 w-full overflow-x-auto no-scrollbar">
            {['TODO', 'IN_PROGRESS', 'DONE'].map(status => (
                <button
                    key={status}
                    onClick={() => setRequestFilter(status as any)}
                    className={`flex-1 min-w-[100px] py-4 text-sm font-black uppercase border-r-2 border-black last:border-0 transition-colors ${requestFilter === status ? 'bg-[#ff90e8] text-black' : 'hover:bg-gray-100'}`}
                >
                    {status.replace('_', ' ')}
                </button>
            ))}
        </div>

        {/* Horizontal Chips & Search */}
        <div className="bg-gray-50 border-b-2 border-black shrink-0 w-full">
            <div className="p-4 flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-2 w-full">
                {CHIP_FILTERS.map(chip => (
                    <button
                        key={chip.id}
                        onClick={() => setChipFilter(chip.id)}
                        className={`px-3 py-1 text-[10px] font-bold uppercase border-2 border-black rounded-full whitespace-nowrap transition-all flex-shrink-0 ${chipFilter === chip.id ? 'bg-black text-white shadow-[2px_2px_0_0_#999]' : 'bg-white text-black hover:bg-gray-100'}`}
                    >
                        {chip.label}
                    </button>
                ))}
            </div>
            <div className="px-4 pb-4 w-full">
                <input 
                    type="text" 
                    placeholder="Search by ID, Desc or User Email..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={BRUTAL.input}
                />
            </div>
        </div>

        {/* Request List */}
        <div className="p-6 w-full overflow-y-auto flex-1 pb-32">
            <div className="grid gap-4 w-full">
                {filteredRequests.length === 0 && (
                    <div className="text-center py-10 opacity-50 font-bold uppercase">No requests found matching filters.</div>
                )}
                
                {filteredRequests.map(req => (
                    <div 
                        key={req.id} 
                        onClick={() => setSelectedRequestId(req.id)}
                        className={`${BRUTAL.card} flex flex-col cursor-pointer hover:bg-yellow-50`}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <div>
                                <div className="flex gap-2 mb-1 flex-wrap">
                                    <span className={`text-[10px] font-black px-2 py-0.5 text-white ${req.type === 'BUG' ? 'bg-red-600' : 'bg-blue-600'}`}>{req.categoryTag}</span>
                                    <span className="text-[10px] font-bold text-gray-500">{req.email} • <span className="font-mono">{req.date}</span></span>
                                    <span className="text-[10px] font-mono bg-black text-white px-1 ml-2">{req.id}</span>
                                </div>
                                <p className="font-bold text-sm">{req.desc}</p>
                            </div>
                            <span className="text-xl font-bold">→</span>
                        </div>
                        {req.lastAction && (
                            <div className="border-t border-black/10 pt-2 mt-1">
                                <p className="text-[9px] font-mono text-gray-500 italic">
                                    {req.lastAction}
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>

        {/* SIDEBAR DETAIL VIEW - Z-INDEX 100000 */}
        {selectedRequest && (
            <>
            <div className="fixed inset-0 bg-black/60 z-[99999] backdrop-blur-sm" onClick={() => setSelectedRequestId(null)}></div>
            <div className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-white border-l-4 border-black z-[100000] shadow-[-20px_0_50px_rgba(0,0,0,0.5)] flex flex-col animate-in slide-in-from-right duration-300">
                
                {/* Header */}
                <div className="p-6 border-b-4 border-black bg-[#fdfdfd] flex justify-between items-start shrink-0">
                    <div className="flex-1">
                        <div className="flex gap-2 mb-2">
                            <span className={`text-xs font-black px-2 py-1 text-white ${selectedRequest.type === 'BUG' ? 'bg-red-600' : 'bg-blue-600'}`}>{selectedRequest.categoryTag}</span>
                            <span className="text-xs font-mono bg-black text-white px-2 py-1">{selectedRequest.id}</span>
                        </div>
                        <h3 className="text-xl font-black uppercase leading-tight tracking-tighter">{selectedRequest.desc}</h3>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={handleSaveStatus}
                            disabled={!hasUnsavedChanges}
                            className={`px-4 py-2 text-xs font-black uppercase border-2 border-black transition-all ${
                                hasUnsavedChanges 
                                    ? 'bg-[#ffc900] text-black shadow-[2px_2px_0_0_#000] hover:-translate-y-0.5' 
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed border-gray-300'
                            }`}
                        >
                            Save
                        </button>
                        <button onClick={() => setSelectedRequestId(null)} className="text-xl font-bold hover:bg-black hover:text-white w-8 h-8 flex items-center justify-center border-2 border-transparent hover:border-black transition-all">✕</button>
                    </div>
                </div>

                {/* Content - Scrollable Area */}
                <div className="flex-1 overflow-y-auto p-6 pb-24 space-y-6 custom-scrollbar bg-white">
                    
                    {/* Visual Comparison for False Positives / Audit Errors */}
                    {(selectedRequest.categoryTag === 'FALSE_POSITIVE' || selectedRequest.categoryTag === 'AUDIT_ERROR') && selectedRequest.images && (
                        <div className="border-2 border-black p-2 bg-gray-100">
                            <div className="flex justify-between items-center mb-2 px-1">
                                <span className="text-[10px] font-black uppercase">Visual Evidence</span>
                                <span className="text-[9px] font-bold text-gray-500 uppercase">Click for Fullscreen Comparison</span>
                            </div>
                            <div className="flex gap-2 h-32 cursor-zoom-in" onClick={handleImageClick}>
                                <div className="flex-1 relative group">
                                    <span className="absolute top-1 left-1 bg-red-600 text-white text-[9px] font-bold px-1 z-10">BEFORE / ERROR</span>
                                    <img src={selectedRequest.images.before} className="w-full h-full object-cover border border-black group-hover:opacity-90" alt="Before" />
                                </div>
                                <div className="flex-1 relative group">
                                    <span className="absolute top-1 left-1 bg-green-600 text-white text-[9px] font-bold px-1 z-10">AFTER / ACTUAL</span>
                                    <img src={selectedRequest.images.after} className="w-full h-full object-cover border border-black group-hover:opacity-90" alt="After" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-gray-50 p-4 border-2 border-black shadow-[2px_2px_0_0_#ccc]">
                        <label className={BRUTAL.label}>User Message</label>
                        <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{selectedRequest.fullMessage}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div><label className={BRUTAL.label}>Reporter</label><p className="font-mono text-xs border-b border-gray-300 pb-1">{selectedRequest.email}</p></div>
                        <div><label className={BRUTAL.label}>Date</label><p className="font-mono text-xs border-b border-gray-300 pb-1">{selectedRequest.date}</p></div>
                    </div>

                    {selectedRequest.lastAction && (
                        <div className="bg-yellow-50 border border-yellow-200 p-2 text-[10px] font-mono text-gray-600">
                            HISTORY: {selectedRequest.lastAction}
                        </div>
                    )}

                    {/* Status Changer */}
                    <div className="border-t-2 border-black pt-4">
                        <label className={BRUTAL.label}>Change Status</label>
                        <div className="flex gap-2">
                            {['TODO', 'IN_PROGRESS', 'DONE'].map(status => (
                                <button 
                                    key={status}
                                    onClick={() => setTempStatus(status as any)}
                                    className={`flex-1 py-3 text-xs font-black uppercase border-2 border-black transition-all ${
                                        tempStatus === status 
                                            ? 'bg-black text-white shadow-[2px_2px_0_0_#ff90e8]' 
                                            : 'bg-white hover:bg-gray-100 text-gray-400'
                                    }`}
                                >
                                    {status.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            </>
        )}

        {/* FULL SCREEN IMAGE OVERLAY (COMPARISON MODE) */}
        {isFullScreen && selectedRequest?.images && (
            <div className="fixed inset-0 z-[100001] bg-black/90 flex flex-col p-4 animate-in fade-in duration-200">
                <div className="flex justify-between items-center text-white mb-4 shrink-0">
                    <h3 className="font-black uppercase text-lg">Visual Inspection: Drag to Pan, Scroll to Zoom</h3>
                    <button onClick={() => setIsFullScreen(false)} className="bg-white text-black px-4 py-2 font-bold uppercase hover:bg-[#ffc900] border-2 border-transparent hover:border-black">Close</button>
                </div>
                
                <div className="flex-1 flex gap-4 overflow-hidden justify-center items-center">
                    <ZoomableImage src={selectedRequest.images.before} label="BEFORE / REPORTED" />
                    <ZoomableImage src={selectedRequest.images.after} label="AFTER / ACTUAL" />
                </div>
            </div>
        )}
    </div>
  );
};
