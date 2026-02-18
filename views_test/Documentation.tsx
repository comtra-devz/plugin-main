import React from 'react';
import { BRUTAL, COLORS } from '../constants_test';

const FAQS = [
  { q: "How is the Health Score calculated?", a: "We scan your selection for consistency in colors, typography usage, and layer naming." },
  { q: "How do I fix issues?", a: "Click on any issue in the Audit tab and use the 'Auto-Fix' button or follow the manual suggestion." },
  { q: "Can I export to Tailwind?", a: "Yes! Unlock Pro to access React + Tailwind exports in the Code tab." },
];

const VIDEOS = [
  { title: "Getting Started with Comtra", time: "2:30" },
  { title: "Mastering Design Tokens", time: "5:00" },
  { title: "Syncing with Storybook", time: "3:45" },
];

export const Documentation: React.FC = () => {
  return (
    <div className="p-4 pb-24 flex flex-col gap-6">
      <div className={`${BRUTAL.card} bg-[#ffc900]`}>
        <h2 className="text-2xl font-black uppercase mb-1">Knowledge Base</h2>
        <p className="text-xs font-bold">Learn how to make your design system sing.</p>
      </div>

      <div>
        <h3 className="font-black uppercase text-sm mb-2 px-1">Video Tutorials</h3>
        <div className="space-y-2">
          {VIDEOS.map((vid, i) => (
            <div key={i} className={`${BRUTAL.card} p-3 flex justify-between items-center cursor-pointer hover:bg-gray-50`}>
              <div className="flex items-center gap-3">
                <div className="size-8 bg-black text-white flex items-center justify-center font-black text-xs rounded-full">▶</div>
                <span className="text-xs font-bold uppercase">{vid.title}</span>
              </div>
              <span className="text-[10px] font-mono text-gray-500">{vid.time}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-black uppercase text-sm mb-2 px-1">Frequent Questions</h3>
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <div key={i} className={`${BRUTAL.card} p-3 bg-white`}>
              <h4 className="font-bold text-xs uppercase mb-1">Q: {faq.q}</h4>
              <p className="text-[10px] text-gray-600 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
      
      <div className="text-center mt-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase">Need more help?</p>
        <a href="mailto:support@comtra.ai" className="text-xs font-black underline hover:text-[#ff90e8]">Contact Support</a>
      </div>
    </div>
  );
};