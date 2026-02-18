import React, { useEffect, useState } from 'react';
import { BRUTAL } from '../constants';

const MarqueeItem = ({ text }: { text: string }) => (
  <span className="text-4xl font-black uppercase mx-8">{text} •</span>
);

export const Landing: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="w-full min-h-screen bg-white text-black overflow-x-hidden relative font-sans">
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: flex;
          width: 200%;
          animation: marquee 20s linear infinite;
        }
      `}</style>

      {/* Navbar - Black */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-black text-white border-b-2 border-white p-4 flex justify-between items-center h-16">
        <h1 className="text-2xl font-black uppercase tracking-tighter hover:text-[#ff90e8] transition-colors cursor-pointer">
          Comtra
        </h1>
        <button 
          onClick={onBack} 
          className="bg-[#ff90e8] text-black border-2 border-white px-4 py-2 text-xs font-black uppercase hover:bg-white hover:border-[#ff90e8] transition-all active:translate-y-1 shadow-[4px_4px_0_0_#fff]"
        >
          Use the Figma Plugin
        </button>
      </header>

      {/* Hero Section with Parallax Stacking */}
      <section className="relative pt-32 pb-0 px-6 min-h-[110vh] flex flex-col items-center justify-start text-center overflow-hidden bg-[#fdfdfd]">
        
        {/* Background Grid */}
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
        </div>

        {/* LAYER 1: Text Content */}
        <div 
          className="z-0 relative transition-transform duration-75 ease-linear will-change-transform w-full max-w-4xl mx-auto flex flex-col items-center"
          style={{ transform: `translateY(${scrollY * 0.4}px)` }}
        >
          <div className="inline-block bg-[#ffc900] text-black border-2 border-black px-4 py-1 text-sm font-black uppercase mb-6 transform -rotate-2 hover:rotate-2 transition-transform duration-300 shadow-[4px_4px_0_0_#000]">
            The Design System Guardian
          </div>
          
          <h2 className="text-7xl md:text-9xl font-black uppercase leading-[0.85] mb-8 tracking-tighter mix-blend-multiply relative z-10 font-['Tiny5']">
            Stop <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff90e8] to-[#ffc900]">Wrestling</span><br/>
            Figma
          </h2>
          
          <p className="text-lg font-medium text-gray-800 mb-10 max-w-xl mx-auto leading-relaxed bg-white/60 backdrop-blur-sm p-2 rounded border border-transparent">
            The first tool that truly helps you manage your design system. 
            Create wireframes that respect your tokens and sync to Storybook.
          </p>
        </div>

        {/* LAYER 2: Mac Mockup (Scrolls normally, covers text) */}
        <div className="z-20 relative w-full max-w-4xl mt-12 mb-20 perspective-1000">
           <div className="bg-white border-4 border-black shadow-[16px_16px_0_0_#000] rounded-t-lg overflow-hidden transform transition-transform hover:scale-[1.01] duration-500">
              
              {/* Mac Window Bar */}
              <div className="bg-gray-100 border-b-4 border-black p-3 flex items-center gap-4">
                 <div className="flex gap-2">
                    <div className="size-3 rounded-full bg-red-500 border border-black"></div>
                    <div className="size-3 rounded-full bg-yellow-400 border border-black"></div>
                    <div className="size-3 rounded-full bg-green-500 border border-black"></div>
                 </div>
                 {/* Fake Address Bar */}
                 <div className="flex-1 bg-white border-2 border-black h-8 flex items-center px-4 rounded-sm">
                    <span className="text-xs font-mono text-gray-400">https://comtra.ai/audit</span>
                 </div>
              </div>

              {/* Mockup Content */}
              <div className="p-16 md:p-24 bg-white flex flex-col items-center justify-center relative overflow-hidden min-h-[400px]">
                 
                 {/* Skeleton Loading UI - Black Blocks */}
                 <div className="absolute inset-0 p-8 flex gap-4 pointer-events-none opacity-20">
                    {/* Sidebar Skeleton */}
                    <div className="w-1/4 h-full bg-black/5 flex flex-col gap-4 p-2 animate-pulse">
                        <div className="h-8 bg-black w-full mb-4"></div>
                        <div className="h-4 bg-black w-3/4"></div>
                        <div className="h-4 bg-black w-1/2"></div>
                        <div className="h-4 bg-black w-2/3"></div>
                        <div className="h-4 bg-black w-full mt-auto"></div>
                    </div>
                    {/* Main Content Skeleton */}
                    <div className="w-3/4 h-full flex flex-col gap-6 animate-pulse delay-75">
                        <div className="flex justify-between">
                            <div className="h-12 bg-black w-1/3"></div>
                            <div className="h-12 bg-black w-12 rounded-full"></div>
                        </div>
                        <div className="h-48 bg-black w-full border-2 border-black/20"></div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="h-24 bg-black"></div>
                            <div className="h-24 bg-black"></div>
                            <div className="h-24 bg-black"></div>
                        </div>
                    </div>
                 </div>

                 <h3 className="text-3xl font-black uppercase mb-6 relative z-10 font-['Tiny5']">Ready to clean up?</h3>
                 
                 <button 
                    onClick={onBack}
                    className="relative z-10 bg-black text-white border-2 border-transparent text-xl md:text-2xl font-black uppercase px-12 py-6 hover:bg-[#ff90e8] hover:text-black hover:border-black hover:shadow-[8px_8px_0_0_#000] transition-all active:translate-x-1 active:translate-y-1 active:shadow-none"
                 >
                   Start Free Audit Now
                 </button>
              </div>
           </div>
        </div>

      </section>

      {/* Infinite Marquee */}
      <div className="bg-[#ff90e8] border-y-2 border-black py-4 overflow-hidden text-black rotate-1 scale-105 z-30 relative shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
        <div className="animate-marquee whitespace-nowrap">
          <MarqueeItem text="Design System Audit" />
          <MarqueeItem text="Generate Code" />
          <MarqueeItem text="Storybook Sync" />
          <MarqueeItem text="Accessibility Check" />
          <MarqueeItem text="Design System Audit" />
          <MarqueeItem text="Generate Code" />
          <MarqueeItem text="Storybook Sync" />
          <MarqueeItem text="Accessibility Check" />
        </div>
      </div>

      {/* Feature Section - Brutalist Cards */}
      <section className="py-24 px-6 bg-black text-white z-20 relative">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Card 1 - Geometric Eye */}
          <div className="bg-white text-black p-8 border-4 border-transparent hover:border-[#ff90e8] transition-all duration-300 group hover:-translate-y-2">
            <div className="size-16 bg-[#ff90e8] border-2 border-black mb-6 flex items-center justify-center shadow-[4px_4px_0_0_#000]">
               <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 5C7 5 2.73 8.11 1 12C2.73 15.89 7 19 12 19C17 19 21.27 15.89 23 12C21.27 8.11 17 5 12 5ZM12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17ZM12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9Z" fill="black"/>
                  <rect x="2" y="11" width="20" height="2" fill="black" className="opacity-0 group-hover:opacity-100 transition-opacity" />
               </svg>
            </div>
            <h3 className="font-black uppercase text-2xl mb-4 group-hover:text-[#ff90e8] transition-colors font-['Tiny5']">Refine, Don't Redraw</h3>
            <p className="font-medium text-gray-600">
              Generate fresh wireframes based on your existing tokens. No more starting from scratch.
            </p>
          </div>

          {/* Card 2 - Geometric Bolt */}
          <div className="bg-white text-black p-8 border-4 border-transparent hover:border-[#ff90e8] transition-all duration-300 group hover:-translate-y-2">
            <div className="size-16 bg-[#ffc900] border-2 border-black mb-6 flex items-center justify-center shadow-[4px_4px_0_0_#000]">
               <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                 <path d="M7 2V11H3L13 22V13H17L7 2Z" fill="black"/>
                 <rect x="10" y="2" width="4" height="20" fill="black" className="opacity-0 group-hover:opacity-20 transition-opacity mix-blend-overlay" />
               </svg>
            </div>
            <h3 className="font-black uppercase text-2xl mb-4 group-hover:text-[#ff90e8] transition-colors font-['Tiny5']">Code that works</h3>
            <p className="font-medium text-gray-600">
              Export clean React, Vue, or Liquid code. Sync directly to Storybook with one click.
            </p>
          </div>

          {/* Card 3 - Geometric Target */}
          <div className="bg-white text-black p-8 border-4 border-transparent hover:border-[#ff90e8] transition-all duration-300 group hover:-translate-y-2">
            <div className="size-16 bg-blue-300 border-2 border-black mb-6 flex items-center justify-center shadow-[4px_4px_0_0_#000]">
               <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                 <rect x="2" y="2" width="20" height="20" stroke="black" strokeWidth="2" fill="none"/>
                 <rect x="7" y="7" width="10" height="10" stroke="black" strokeWidth="2" fill="none"/>
                 <rect x="11" y="11" width="2" height="2" fill="black"/>
                 <line x1="12" y1="2" x2="12" y2="7" stroke="black" strokeWidth="2"/>
                 <line x1="12" y1="17" x2="12" y2="22" stroke="black" strokeWidth="2"/>
                 <line x1="2" y1="12" x2="7" y2="12" stroke="black" strokeWidth="2"/>
                 <line x1="17" y1="12" x2="22" y2="12" stroke="black" strokeWidth="2"/>
               </svg>
            </div>
            <h3 className="font-black uppercase text-2xl mb-4 group-hover:text-[#ff90e8] transition-colors font-['Tiny5']">Target: Perfection</h3>
            <p className="font-medium text-gray-600">
              Audit your system for accessibility, naming, and consistency errors in seconds.
            </p>
          </div>

        </div>
      </section>

      {/* Interactive Mockups & Video Tutorial */}
      <section className="py-24 bg-[#ffc900] border-b-2 border-black overflow-hidden relative z-20">
        <div className="text-center mb-12 relative z-10">
          <h2 className="text-4xl font-black uppercase font-['Tiny5']">See it in action</h2>
        </div>
        
        <div className="flex flex-col md:flex-row justify-center items-center gap-8 px-4" style={{ transform: `translateY(${(scrollY - 1500) * -0.1}px)` }}>
           
           {/* Left Decor Mockup */}
           <div className="hidden md:flex w-48 h-64 bg-white border-4 border-black shadow-[8px_8px_0_0_#000] rotate-3 hover:rotate-0 transition-transform duration-500 flex-col p-3 opacity-80">
              <div className="h-3 bg-gray-200 w-1/2 mb-3"></div>
              <div className="h-24 bg-gray-100 mb-3 border-2 border-dashed border-gray-300"></div>
              <div className="h-2 bg-gray-200 w-full mb-1"></div>
              <div className="h-2 bg-gray-200 w-3/4"></div>
           </div>
           
           {/* Center Video Frame */}
           <div className="w-full max-w-xl aspect-video bg-black border-4 border-white shadow-[12px_12px_0_0_#ff90e8] flex items-center justify-center relative group cursor-pointer z-10 hover:scale-[1.02] transition-transform">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center pl-1 group-hover:scale-110 transition-transform shadow-lg">
                 <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-black border-b-[10px] border-b-transparent"></div>
              </div>
              <span className="absolute bottom-4 text-white font-mono text-xs uppercase tracking-widest bg-black/50 px-2 py-1">Watch Tutorial</span>
           </div>

           {/* Right Decor Mockup */}
           <div className="hidden md:flex w-48 h-64 bg-white border-4 border-black shadow-[8px_8px_0_0_#000] -rotate-3 hover:rotate-0 transition-transform duration-500 flex-col p-3 mt-12 opacity-80">
              <div className="flex justify-between mb-3">
                 <div className="size-6 rounded-full bg-[#ff90e8]"></div>
                 <div className="w-12 h-6 bg-black"></div>
              </div>
              <div className="flex-1 bg-gray-100 border-2 border-black flex items-center justify-center font-mono text-[10px]">
                 &lt;Component /&gt;
              </div>
           </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white py-20 px-6 text-center border-t-4 border-white z-20 relative">
        <h4 className="font-black uppercase text-4xl md:text-6xl mb-8 tracking-tighter font-['Tiny5']">Ready to upgrade?</h4>
        
        <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-16">
          <button 
            onClick={onBack} 
            className="bg-[#ff90e8] text-black text-xl px-12 py-4 font-black uppercase border-2 border-transparent hover:bg-white hover:border-[#ff90e8] transition-all shadow-[8px_8px_0_0_#fff] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
          >
            Try for Free Now
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-6 mb-8 text-xs font-bold uppercase tracking-wider text-gray-400">
           <a href="#" className="hover:text-white hover:underline">Become a Partner</a>
           <span className="text-gray-700">•</span>
           <a href="#" className="hover:text-white hover:underline">Privacy e Policy</a>
           <span className="text-gray-700">•</span>
           <a href="#" className="hover:text-white hover:underline">Cookies</a>
        </div>

        <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
          Made by Cordiska
        </div>
      </footer>
    </div>
  );
};