import React from 'react';
import { brutalMenuRowClass } from '../../../components/ui/BrutalSelect';

export type AuditScanScope = 'all' | 'current' | 'page' | 'unselected';

interface Props {
  scanScope: AuditScanScope;
  setScanScope: (s: AuditScanScope) => void;
  closeDropdown: () => void;
  canvasSelectionActive: boolean;
  /** When true, show the radio filled (UX tab treats legacy `all` like current selection for label). */
  currentOptionSelected?: boolean;
}

/** Audit scope dropdown row: Current Selection — disabled when nothing is selected on the Figma canvas. */
export function ScopeCurrentSelectionRow({
  scanScope,
  setScanScope,
  closeDropdown,
  canvasSelectionActive,
  currentOptionSelected,
}: Props) {
  const filled = currentOptionSelected ?? scanScope === 'current';
  if (!canvasSelectionActive) {
    return (
      <div
        className="flex flex-col gap-0 border-b border-gray-100 opacity-60 cursor-not-allowed"
        onClick={(e) => e.stopPropagation()}
        aria-disabled="true"
      >
        <div className={`${brutalMenuRowClass} pointer-events-none`}>
          <div className="w-3 h-3 shrink-0 border border-gray-400 flex items-center justify-center bg-gray-100" />
          <span className="text-xs font-bold text-gray-500">Current Selection</span>
        </div>
        <p className="text-[10px] text-gray-500 px-3 pb-2 italic">Select something on the canvas first.</p>
      </div>
    );
  }
  return (
    <div
      role="option"
      onClick={() => {
        setScanScope('current');
        closeDropdown();
      }}
      className={`${brutalMenuRowClass} border-b border-gray-100`}
    >
      <div
        className={`w-3 h-3 shrink-0 border border-black flex items-center justify-center ${filled ? 'bg-black' : 'bg-white'}`}
      />
      <span className="text-xs font-bold">Current Selection</span>
    </div>
  );
}
