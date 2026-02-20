
import React, { useState, useRef, useEffect } from 'react';
import { BRUTAL, COLORS, TIER_LIMITS } from '../constants';
import { generateDesignSuggestions } from '../services/geminiService';
import { UserPlan } from '../types';

interface Props { 
  plan: UserPlan; 
  userTier?: string;
  onUnlockRequest: () => void;
  usageCount: number;
  onUse: () => void;
  initialPrompt?: string;
}

const INSPIRATION = [
  "Create a desktop login page",
  "Create a different version of this component",
  "Create a mobile cart",
];

const DESIGN_SYSTEMS = [
  "Custom (Current)",
  "Material Design 3",
  "iOS Human Interface",
  "Ant Design",
  "Carbon Design",
  "Bootstrap 5",
  "Salesforce Lightning",
  "Uber Base Web"
];

const MAX_FREE_USES = 10;

export const Generate: React.FC<Props> = ({ plan, userTier, onUnlockRequest, usageCount, onUse, initialPrompt }) => {
  const [res, setRes] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [hasContent, setHasContent] = useState(!!initialPrompt);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  
  // Design System State
  const [selectedSystem, setSelectedSystem] = useState(DESIGN_SYSTEMS[0]);
  const [isSystemOpen, setIsSystemOpen] = useState(false);
  const [systemSearch, setSystemSearch] = useState('');
  const dsDropdownRef = useRef<HTMLDivElement>(null);

  // ContentEditable Ref
  const inputRef = useRef<HTMLDivElement>(null);
  
  // New State for Report Flow
  const [showReport, setShowReport] = useState(false);
  const [conversionSelected, setConversionSelected] = useState(false);

  // Set initial prompt if provided
  useEffect(() => {
      if (initialPrompt && inputRef.current) {
          inputRef.current.innerText = initialPrompt;
          setHasContent(true);
      }
  }, [initialPrompt]);

  // Click Outside for Dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (dsDropdownRef.current && !dsDropdownRef.current.contains(event.target as Node)) {
            setIsSystemOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const isPro = plan === 'PRO';
  const remaining = Math.max(0, MAX_FREE_USES - usageCount);
  const canGenerate = isPro || remaining > 0;

  // Credit Limit Logic
  const totalCredits = userTier && TIER_LIMITS[userTier] ? TIER_LIMITS[userTier] : (plan === 'PRO' ? 3000 : 10);
  const usedCredits = plan === 'PRO' ? 450 : usageCount; // Mock usage for Pro
  const creditsDisplay = plan === 'PRO' ? `${totalCredits - usedCredits}/${totalCredits}` : `${remaining}/${MAX_FREE_USES}`;

  // Helper to update content state - Ignores Chips, requires text
  const checkContent = () => {
      if (inputRef.current) {
          const clone = inputRef.current.cloneNode(true) as HTMLElement;
          const chips = clone.querySelectorAll('span[data-url]');
          chips.forEach(chip => chip.remove());
          const text = clone.innerText.trim();
          setHasContent(text.length > 0);
      }
  };

  // Helper to insert chip and move cursor
  const insertChip = (text: string, url: string) => {
        if (!inputRef.current) return;
        inputRef.current.focus();
        
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        range.deleteContents(); 

        const chip = document.createElement('span');
        chip.contentEditable = "false";
        chip.setAttribute('data-url', url);
        chip.style.cssText = "display: inline-block; vertical-align: middle; cursor: pointer; border: 2px solid black; background-color: white; padding: 2px 6px; font-family: monospace; font-size: 10px; font-weight: bold; margin: 0 4px; border-radius: 4px; user-select: none;";
        chip.innerText = `🔗 Ref: ${text}`;

        const space = document.createTextNode("\u00A0"); 

        range.insertNode(space);
        range.insertNode(chip);
        
        range.setStartAfter(space);
        range.setEndAfter(space);
        
        selection.removeAllRanges();
        selection.addRange(range);
        
        checkContent(); 
  };

  // Handles pasting Figma links and converting them to "Chips"
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    
    const figmaRegex = /(https?:\/\/(www\.)?figma\.com\/file\/[a-zA-Z0-9]+\/?([a-zA-Z0-9_-]+)?)/g;
    
    if (figmaRegex.test(text)) {
        const cleanName = text.split('/').pop()?.split('?')[0] || "Ref_Link";
        insertChip(cleanName, text);
    } else {
        document.execCommand('insertText', false, text);
    }
    checkContent();
  };

  const handleSimulatePaste = () => {
      insertChip("Checkout_Flow_Mobile", "https://figma.com/simulated");
  };

  const handleContentClick = (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'SPAN' && target.innerText.includes('Ref:')) {
          const url = target.getAttribute('data-url');
          if (url) {
              console.log("[Future Integration] Calling figma.viewport.scrollAndZoomIntoView for:", url);
          }
      }
  };

  const handleGen = async () => {
    if (!canGenerate) {
      onUnlockRequest();
      return;
    }
    setLoading(true);
    setShowReport(false);
    setConversionSelected(false);
    
    if (!isPro) onUse();
    
    const rawText = inputRef.current?.innerText || "";
    const dsContext = `[Context: ${selectedSystem}] ${rawText}`;

    const result = await generateDesignSuggestions(dsContext);
    
    setTimeout(() => {
        setRes(result);
        setLoading(false);
        if (selectedLayer) {
            setShowReport(true);
        }
    }, 2000);
  };

  const handleViewFigma = () => {
      console.log("Focusing Figma...");
  }

  const handleInsertInspiration = (txt: string) => {
      if(inputRef.current) {
          inputRef.current.innerText = txt;
          setHasContent(true);
      }
  };

  const handleUpload = () => {
      // Simulate file picker interaction
      setTimeout(() => {
          setUploadedImage("screenshot_v1.png");
      }, 500);
  }

  const handleDeleteUpload = () => {
      setUploadedImage(null);
  }

  // Filter Design Systems
  const filteredSystems = DESIGN_SYSTEMS.filter(s => s.toLowerCase().includes(systemSearch.toLowerCase()));

  return (
    <div data-component="Generate: View Container" className="p-4 flex flex-col gap-4 pb-24 min-h-full relative overflow-y-auto">
      
      {/* Credit Banner */}
      <div className="flex justify-center mb-2">
          <div data-component="Generate: Credit Banner" className={`transform -rotate-2 border-2 border-black px-3 py-1 text-[10px] font-black uppercase shadow-[3px_3px_0_0_#000] ${remaining === 0 && !isPro ? 'bg-red-100 text-red-600' : 'bg-[#ffc900] text-black'}`}>
            {isPro ? `Credits: ${creditsDisplay}` : `Free Credits Remaining: ${remaining}/${MAX_FREE_USES}`}
          </div>
      </div>

      {/* Info Alert */}
      {!showReport && (
        <div data-component="Generate: Info Alert" className="bg-white border-2 border-black p-3 text-[10px] font-medium leading-tight shadow-[4px_4px_0_0_#000]">
            <span data-component="Generate: Info Title" className="font-bold uppercase block mb-1">ℹ️ Generation Logic</span>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
                <li data-component="Generate: Info List Item 1"><strong>No Selection:</strong> Creates wireframes from scratch.</li>
                <li data-component="Generate: Info List Item 2"><strong>Selection Active:</strong> Modifies a <u>copy</u> (originals are safe).</li>
                <li data-component="Generate: Info List Item 3"><strong>Upload Screenshot:</strong> AI converts pixels to your Design System components.</li>
                <li data-component="Generate: Info List Item 4"><strong>Paste Link:</strong> You can paste Figma wireframe links in the prompt to reference them.</li>
            </ul>
        </div>
      )}

       {/* Selection Area: Layer & Design System */}
      <div data-component="Generate: Selection Card" className={`${BRUTAL.card} bg-white py-2 flex flex-col gap-2 relative z-[5]`}>
        {/* Layer Context */}
        <div className="flex justify-between items-center border-b border-black/10 pb-2">
          <span data-component="Generate: Selection Label" className="text-xs font-bold uppercase">Context Layer</span>
          <button 
            data-component="Generate: Selection Toggle" 
            onClick={() => { setSelectedLayer(selectedLayer ? null : "Hero_Section_V2"); setShowReport(false); }} 
            className="text-[10px] font-bold bg-black text-white px-2 py-1"
          >
            {selectedLayer ? 'Clear Selection' : 'Select Layer'}
          </button>
        </div>
        
        {selectedLayer ? (
          <span data-component="Generate: Selection Value" className="font-mono text-xs text-blue-600 bg-blue-50 p-1 border border-blue-200 block truncate mb-1">Target: {selectedLayer}</span>
        ) : (
            uploadedImage ? (
                <div data-component="Generate: Uploaded File" className="flex justify-between items-center bg-gray-100 p-2 border border-black mb-1">
                    <span className="text-[10px] font-bold truncate">📄 {uploadedImage}</span>
                    <button onClick={handleDeleteUpload} className="text-red-500 font-bold hover:text-red-700 px-1">✕</button>
                </div>
            ) : (
                <>
                    <span data-component="Generate: Selection Empty" className="text-[10px] text-gray-400 italic mb-1">No layer selected. Creating new wireframes or upload a screenshot.</span>
                    <button 
                        data-component="Generate: Upload Button"
                        onClick={handleUpload}
                        className="w-full border-2 border-black border-dashed py-2 text-[10px] font-bold uppercase hover:bg-gray-50 text-gray-500"
                    >
                        Upload Image
                    </button>
                </>
            )
        )}

        {/* Design System Dropdown */}
        <div className="relative" ref={dsDropdownRef}>
            <label className="text-[10px] font-bold uppercase block mb-1">Design System</label>
            <div 
                data-component="Generate: DS Selector"
                onClick={() => setIsSystemOpen(!isSystemOpen)}
                className="w-full border-2 border-black p-2 flex justify-between items-center cursor-pointer hover:bg-gray-50 text-xs font-bold"
            >
                <span>{selectedSystem}</span>
                <div className="flex items-center gap-2">
                    {selectedSystem !== DESIGN_SYSTEMS[0] && (
                        <span 
                            onClick={(e) => { e.stopPropagation(); setSelectedSystem(DESIGN_SYSTEMS[0]); }}
                            className="hover:bg-red-100 text-red-600 px-1.5 rounded-full font-black text-xs"
                        >
                            ✕
                        </span>
                    )}
                    <span>{isSystemOpen ? '▲' : '▼'}</span>
                </div>
            </div>

            {/* Dropdown Content */}
            {isSystemOpen && (
                <div className="absolute top-full left-0 w-full bg-white border-2 border-black border-t-0 shadow-[4px_4px_0_0_#000] z-30 max-h-[200px] flex flex-col">
                    <input 
                        type="text" 
                        placeholder="Search System..." 
                        autoFocus
                        value={systemSearch}
                        onChange={(e) => setSystemSearch(e.target.value)}
                        className="w-full p-2 text-xs border-b border-black outline-none font-mono bg-yellow-50"
                        onClick={(e) => e.stopPropagation()}
                    />
                    <div className="overflow-y-auto flex-1 custom-scrollbar">
                        {filteredSystems.map(sys => (
                            <div 
                                key={sys} 
                                onClick={() => { setSelectedSystem(sys); setIsSystemOpen(false); setSystemSearch(''); }}
                                className={`p-2 text-xs hover:bg-[#ff90e8] cursor-pointer border-b border-gray-100 last:border-0 ${selectedSystem === sys ? 'bg-black text-white' : ''}`}
                            >
                                {sys}
                            </div>
                        ))}
                        {filteredSystems.length === 0 && (
                            <div className="p-2 text-[10px] text-gray-500 italic">No system found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
      </div>

      {!showReport ? (
        <>
            <div className="flex flex-col gap-0 relative z-[1]">
                <div data-component="Generate: Terminal Header" className="bg-black text-white p-2 text-xs font-bold uppercase flex justify-between items-center border-2 border-black border-b-0">
                  <span>AI Terminal</span>
                  <span className="opacity-70 font-mono">v1.0-TEST</span>
                </div>
                
                {/* TEST ONLY: Helper Controls */}
                <div className="bg-gray-100 p-2 border-2 border-black border-b-0 flex gap-2">
                    <button 
                        onClick={handleSimulatePaste}
                        className="text-[9px] bg-white border border-black px-2 py-1 font-bold uppercase hover:bg-black hover:text-white transition-colors"
                    >
                        🧪 Inject Fake Link
                    </button>
                </div>

                {/* ContentEditable Div replacing Textarea */}
                <div 
                  ref={inputRef}
                  contentEditable
                  onPaste={handlePaste}
                  onInput={checkContent}
                  onClick={handleContentClick}
                  data-component="Generate: Rich Input"
                  className={`${BRUTAL.input} h-[120px] text-sm bg-white focus:bg-white border-t-2 mt-[-2px] overflow-y-auto cursor-text`}
                  style={{ whiteSpace: 'pre-wrap' }}
                  data-placeholder={selectedLayer ? `> Modify ${selectedLayer}: e.g. "Make it pop"` : "> Describe your UI (or paste a Figma link)..."}
                />
            </div>
            
            <button 
                data-component="Generate: Generate Button"
                onClick={handleGen} 
                disabled={!hasContent || loading || (!canGenerate && !isPro)}
                className={`${BRUTAL.btn} ${canGenerate && hasContent ? `bg-[${COLORS.primary}] text-black hover:bg-white hover:border-black` : 'bg-gray-300 text-gray-500 cursor-not-allowed'} w-full flex justify-center items-center gap-2 relative`}
            >
                {loading ? 'Weaving Magic...' : !isPro && remaining === 0 ? 'Unlock Unlimited AI' : (
                    selectedLayer ? 'Modify Component' : 'Create Wireframes'
                )}
                {!loading && canGenerate && (
                    <span className="absolute bottom-0.5 right-1 text-[8px] bg-black text-white px-1 font-bold rounded-sm">-3 Credits</span>
                )}
            </button>

            <div className="mt-2">
                <p data-component="Generate: Inspiration Title" className="text-[10px] font-bold uppercase text-gray-500 mb-2">Try asking the stars:</p>
                <div className="flex flex-wrap gap-2">
                {INSPIRATION.map((txt, i) => (
                    <button 
                    key={txt} 
                    data-component={`Generate: Inspiration Chip ${i+1}`}
                    onClick={() => handleInsertInspiration(txt)} 
                    disabled={!canGenerate}
                    className={`text-[10px] border border-black px-2 py-1 bg-white transition-colors text-left ${canGenerate ? 'hover:bg-[#ffc900]' : 'opacity-50'}`}
                    >
                    {txt}
                    </button>
                ))}
                </div>
            </div>
        </>
      ) : (
        <div data-component="Generate: Report Container" className="animate-in slide-in-from-bottom-2 fade-in duration-300">
            {/* AI Report Card */}
            <div className={`${BRUTAL.card} bg-white mb-4`}>
                <div className="flex justify-between items-center mb-3 border-b-2 border-black/10 pb-2">
                    <h3 className="font-black uppercase text-sm">AI Implementation Report</h3>
                    <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 font-bold rounded-sm border border-yellow-200">Attention Needed</span>
                </div>
                
                <div className="space-y-3">
                    <div className="flex items-start gap-2">
                        <span className="text-green-500 font-bold">✓</span>
                        <p className="text-[10px] text-gray-600">Generated using <strong>{selectedSystem}</strong> conventions.</p>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-green-500 font-bold">✓</span>
                        <p className="text-[10px] text-gray-600">Successfully used <strong>3 existing tokens</strong> from your Design System.</p>
                    </div>
                    
                    {/* Interactive Selection */}
                    <div className="bg-gray-50 border border-black p-2 mt-2">
                        <div className="flex items-center gap-2 mb-2">
                            <input 
                                type="checkbox" 
                                id="convert-check"
                                className="w-4 h-4 accent-black"
                                checked={conversionSelected}
                                onChange={(e) => setConversionSelected(e.target.checked)}
                            />
                            <label htmlFor="convert-check" className="text-[10px] font-bold uppercase cursor-pointer select-none">
                                Convert new "Card_Wrapper" div to Component?
                            </label>
                        </div>
                        <p className="text-[9px] text-gray-500 ml-6 leading-tight">
                            Found a repeated Frame structure. Checking this will register it as "Card_V3" in your local library.
                        </p>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
                <button 
                    onClick={() => setShowReport(false)}
                    className={`${BRUTAL.btn} flex-1 bg-white text-black text-xs`}
                >
                    Back
                </button>
                <button 
                    onClick={handleViewFigma}
                    className={`${BRUTAL.btn} flex-[2] text-xs ${conversionSelected ? 'bg-black text-white' : `bg-[${COLORS.primary}] text-black`}`}
                >
                    {conversionSelected ? 'View Component in Figma' : 'Apply Changes'}
                </button>
            </div>
        </div>
      )}
    </div>
  );
};
