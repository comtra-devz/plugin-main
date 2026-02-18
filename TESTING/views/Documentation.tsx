
import React, { useState } from 'react';
import { BRUTAL, COLORS } from '../constants';
import { Confetti } from '../components/Confetti';

const TUTORIALS = {
  'WORKFLOW': {
    title: "The Perfect Workflow",
    content: (
      <div className="space-y-2 text-xs leading-relaxed text-gray-700">
        <p><strong className="text-black">1. Scan First:</strong> Always start with the Audit tab. It's cheaper to fix naming errors automatically before generating code. If you see 'Insufficient Data' in some categories, don't worry! It simply means you need to add more material to your project before we can generate specific advice.</p>
        <p><strong className="text-black">2. Group Fixes:</strong> Use the "Auto-Fix All" button for repetitive errors like Hex Codes. It saves credits compared to fixing one by one.</p>
        <p><strong className="text-black">3. Generate Contextually:</strong> Select a reference or create a wireframe from scratch. The AI will read the framework style you chose to generate wireframes with your design system's tokens and components. You can also paste frame or component links directly into the prompt to reference them.</p>
      </div>
    )
  },
  'ASSETS': {
    title: "Images & SVGs (Asset Registry)",
    content: (
      <div className="space-y-2 text-xs leading-relaxed text-gray-700">
        <p className="bg-yellow-100 p-2 border border-yellow-300 text-yellow-900 font-bold mb-2">
          Why is my image missing in the code?
        </p>
        <p>
          We use the <strong className="text-black">Asset Registry Protocol</strong> to keep your code clean and scalable.
          Comtra does <em>not</em> export heavy Base64 strings or complex inline SVGs.
        </p>
        <ol className="list-decimal list-inside space-y-1 mt-2">
          <li><strong>Naming:</strong> Name your image layer in Figma (e.g., <code>hero_illustration</code>).</li>
          <li><strong>Generation:</strong> Comtra generates a placeholder: <code>&lt;Asset name="hero_illustration" /&gt;</code>.</li>
          <li><strong>Developer Action:</strong> The dev drops the real optimized file (SVG/PNG) into the project's <code>/assets</code> folder.</li>
          <li><strong>Sync Safe:</strong> When you re-sync the layout from Figma, the code updates the structure but <strong className="text-black">never overwrites</strong> the developer's asset file.</li>
        </ol>
      </div>
    )
  },
  'SYNC': {
    title: "Deep Sync & Drift",
    content: (
      <div className="space-y-2 text-xs leading-relaxed text-gray-700">
        <p><strong className="text-black">What is Drift?</strong> Drift occurs when your Figma designs have evolved, but the production code (Storybook/GitHub) is outdated.</p>
        <p><strong className="text-black">The Flow (Figma → Code):</strong> Figma is the Source of Truth. When you update a component here, it must be pushed to developers to maintain parity.</p>
        <p><strong className="text-black">How to fix:</strong> Go to the Code tab > Sync. Comtra detects the difference and lets you "Push to Storybook/GitHub" to update the live component properties instantly.</p>
        <div className="bg-gray-100 p-2 mt-2 border-l-2 border-black">
            <p className="font-bold text-black mb-1">Advanced Prototypes:</p>
            <p>When syncing prototypes to GitHub or Bitbucket, you can enable <strong className="text-black">AI Motion</strong> (auto-generation of React Three Fiber/GSAP animations) and <strong className="text-black">Smart Linking</strong> to let AI automatically wire page routes.</p>
        </div>
      </div>
    )
  }
};

const VIDEOS = [
  { id: 'v1', title: "Figma in 5 Minutes", time: "5:00", url: "https://www.youtube.com/watch?v=5V50GPV3Zts" },
  { id: 'v2', title: "Mastering Design Tokens", time: "5:00", url: "https://www.youtube.com/results?search_query=figma+design+tokens" },
  { id: 'v3', title: "Syncing with Storybook", time: "3:45", url: "https://www.youtube.com/results?search_query=figma+storybook+sync" },
];

const FAQS = [
  { q: "How much does a Scan cost?", a: "A standard Audit Scan costs 5 Credits. If you scan a huge prototype (>250 nodes), it costs +1 Credit for every 50 extra nodes. You always see a receipt before paying." },
  { q: "What happens to my data?", a: "We process your Figma structure ephemerally. We calculate a hash, send it to the AI for analysis, and then discard the raw data. We do NOT train models on your designs." },
  { q: "Can I export to Tailwind?", a: "Yes! React + Tailwind is our default and most optimized export format. It respects your Figma Variables mapping." },
  { q: "Do unused credits roll over?", a: "Free tier credits reset monthly (10/mo). Pro subscription credits (e.g. 600) are valid for the duration of your 6-month cycle." },
];

export const Documentation: React.FC = () => {
  const [activeTab, setActiveTab] = useState<keyof typeof TUTORIALS>('WORKFLOW');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportType, setSupportType] = useState('BUG');
  const [supportMsg, setSupportMsg] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

  const handleSubmitSupport = () => {
      setShowSupportModal(false);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      setSupportMsg('');
  };

  const handleOpenVideo = (url: string) => {
    window.open(url, '_blank');
  };

  const wordCount = supportMsg.trim().split(/\s+/).filter(w => w.length > 0).length;

  return (
    <div className="p-4 pb-40 flex flex-col gap-6 relative">
      {showConfetti && <Confetti />}

      {/* Header */}
      <div className={`${BRUTAL.card} bg-[#ffc900]`}>
        <h2 className="text-2xl font-black uppercase mb-1">Knowledge Base <span className="text-[10px] bg-black text-white px-1 align-top ml-1">TEST</span></h2>
        <p className="text-xs font-bold">Master the system. Scale your workflow.</p>
      </div>

      {/* Interactive Guides Section */}
      <div>
        <h3 className="font-black uppercase text-sm mb-2 px-1">Interactive Guides</h3>
        <div className={`${BRUTAL.card} p-0 bg-white overflow-hidden`}>
            {/* Tabs */}
            <div className="flex border-b-2 border-black bg-gray-50">
                {Object.keys(TUTORIALS).map((key) => (
                    <button 
                        key={key}
                        onClick={() => setActiveTab(key as any)}
                        className={`flex-1 py-3 text-[10px] font-black uppercase border-r-2 border-black last:border-r-0 transition-colors ${activeTab === key ? 'bg-black text-white' : 'hover:bg-gray-200 text-gray-500'}`}
                    >
                        {key}
                    </button>
                ))}
            </div>
            
            {/* Content */}
            <div className="p-4 bg-white min-h-[180px]">
                <h4 className="font-black uppercase text-lg mb-3 border-b-2 border-dashed border-black/10 pb-2">
                    {TUTORIALS[activeTab].title}
                </h4>
                {TUTORIALS[activeTab].content}
            </div>
        </div>
      </div>

      {/* Video Tutorials Section */}
      <div>
        <h3 className="font-black uppercase text-sm mb-2 px-1">Video Tutorials</h3>
        <div className="space-y-2">
          {VIDEOS.map((vid) => {
            return (
              <div 
                key={vid.id} 
                className={`${BRUTAL.card} p-3 cursor-pointer hover:bg-gray-50 transition-all hover:shadow-[6px_6px_0_0_#000] hover:-translate-y-1 bg-white`}
                onClick={() => handleOpenVideo(vid.url)}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className={`size-8 flex items-center justify-center font-black text-xs rounded-full bg-red-600 text-white border-2 border-black`}>
                      ▶
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-bold uppercase">{vid.title}</span>
                        <span className="text-[10px] font-bold text-blue-600 underline">Watch on YouTube ↗</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-gray-500">{vid.time}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FAQ Section */}
      <div>
        <h3 className="font-black uppercase text-sm mb-2 px-1">Frequent Questions & Costs</h3>
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div key={i} className={`${BRUTAL.card} p-3 bg-white hover:shadow-[4px_4px_0_0_#000] transition-all`}>
              <h4 className="font-bold text-xs uppercase mb-1 text-[#ff90e8] bg-black inline-block px-1">Q: {faq.q}</h4>
              <p className="text-[10px] text-gray-600 leading-relaxed mt-1 font-medium">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
      
      {/* Footer Support */}
      <div className="text-center mt-4 p-4 border-t-2 border-dashed border-black/20">
        <p className="text-[10px] font-bold text-gray-400 uppercase">Need human help?</p>
        <button onClick={() => setShowSupportModal(true)} className="text-xs font-black underline hover:text-[#ff90e8]">Open Support Ticket</button>
      </div>

      {/* SUPPORT MODAL */}
      {showSupportModal && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-6" onClick={() => setShowSupportModal(false)}>
              <div className={`${BRUTAL.card} max-w-sm w-full bg-white relative`} onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setShowSupportModal(false)} className="absolute top-2 right-2 font-bold text-xl">×</button>
                  <h3 className="font-black uppercase text-lg mb-4 bg-black text-white inline-block px-2">Support Ticket <span className="text-[8px] bg-yellow-400 text-black px-1 ml-1 align-top border border-black">TEST</span></h3>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="text-[10px] font-bold uppercase block mb-1">Ticket Type</label>
                          <select 
                            value={supportType} 
                            onChange={(e) => setSupportType(e.target.value)}
                            className="w-full border-2 border-black p-2 text-xs font-bold uppercase outline-none bg-white"
                          >
                              <option value="BUG">🐛 Report Bug</option>
                              <option value="FEATURE">🚀 Feature Request</option>
                              <option value="LOVE">❤️ Show some love</option>
                          </select>
                      </div>
                      <div>
                          <label className="text-[10px] font-bold uppercase block mb-1">Message</label>
                          <textarea 
                            value={supportMsg}
                            onChange={(e) => setSupportMsg(e.target.value)}
                            placeholder="Tell us what's happening (min 2 words)..."
                            className="w-full border-2 border-black p-2 text-xs font-mono min-h-[100px] outline-none bg-white"
                          />
                      </div>
                      <button 
                        onClick={handleSubmitSupport}
                        disabled={wordCount < 2}
                        className={`${BRUTAL.btn} w-full ${wordCount >= 2 ? `bg-[${COLORS.primary}] text-black` : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                      >
                          Send Ticket
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
