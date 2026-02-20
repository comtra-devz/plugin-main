import React, { useState, useEffect } from 'react';

export const DebugInspector: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [hoverRect, setHoverRect] = useState<{ top: number, left: number, width: number, height: number } | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!isActive) {
      setHoverRect(null);
      setLabel(null);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const componentEl = target.closest('[data-component]');

      if (componentEl) {
        const rect = componentEl.getBoundingClientRect();
        setHoverRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        });
        setLabel(componentEl.getAttribute('data-component'));
      } else {
        setHoverRect(null);
        setLabel(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!isActive) return;
      const target = e.target as HTMLElement;
      const componentEl = target.closest('[data-component]');

      if (componentEl) {
        e.preventDefault();
        e.stopPropagation();
        const compName = componentEl.getAttribute('data-component');
        const textToCopy = `[EDIT REQUEST] File: ${compName}`;
        
        navigator.clipboard.writeText(textToCopy).then(() => {
          setToast(`Copied: ${compName}`);
          setTimeout(() => setToast(null), 2000);
        });
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleClick, true); // Capture phase to prevent UI interactions

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('click', handleClick, true);
    };
  }, [isActive]);

  return (
    <>
      {/* Toggle Button */}
      <button 
        onClick={() => setIsActive(!isActive)}
        className={`fixed top-28 right-0 z-[9999] px-2 py-1 text-[10px] font-bold uppercase border-2 border-black border-r-0 shadow-md transition-all ${isActive ? 'bg-blue-600 text-white translate-x-0' : 'bg-gray-200 text-gray-500 translate-x-2 hover:translate-x-0'}`}
      >
        {isActive ? '🐞 Debug ON' : '🐞 Inspect'}
      </button>

      {/* Overlay Elements */}
      {isActive && hoverRect && (
        <div 
          className="fixed pointer-events-none z-[9990] border-2 border-blue-500 border-dashed bg-blue-500/10 flex items-start justify-end"
          style={{
            top: hoverRect.top,
            left: hoverRect.left,
            width: hoverRect.width,
            height: hoverRect.height
          }}
        >
          <span className="bg-blue-600 text-white text-[9px] font-mono px-1 py-0.5 absolute -top-5 right-0 shadow-sm">
            {label}
          </span>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black text-white px-4 py-2 text-xs font-bold uppercase z-[10000] shadow-[4px_4px_0_0_#fff] border-2 border-white animate-in zoom-in-95">
          📋 {toast}
        </div>
      )}
    </>
  );
};