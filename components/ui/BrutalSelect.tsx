import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BRUTAL } from '../../constants';

/** Hover riga opzione: giallo brand (sostituisce rosa / grigio sparsi nel plugin). */
export const brutalSelectOptionHoverClass = 'hover:bg-[#ffc900]';

/** Trigger standard (allineato a BRUTAL.input + altezza scope Audit). */
export const brutalSelectTriggerClass = `${BRUTAL.input} flex justify-between items-center gap-2 cursor-pointer h-10 bg-white text-left w-full`;

/** Pannello lista sotto il trigger. */
export const brutalSelectPanelClass =
  'absolute top-full left-0 w-full bg-white border-2 border-black border-t-0 shadow-[4px_4px_0_0_#000] z-30 overflow-y-auto custom-scrollbar';

/** Riga singola (select semplice, lista linguaggi, preset Storybook, ecc.). */
export const brutalSelectOptionRowClass = `p-2 text-xs cursor-pointer border-b border-gray-100 last:border-0 transition-colors ${brutalSelectOptionHoverClass}`;

export const brutalSelectOptionSelectedClass = 'bg-black text-white';

/** Riga con checkbox / icona (scope Audit, flow Prototype): stesso hover giallo. */
export const brutalMenuRowClass = `flex items-center gap-2 cursor-pointer p-2 transition-colors ${brutalSelectOptionHoverClass}`;

export interface BrutalDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Contenuto del trigger (deve gestire il click per aprire/chiudere). */
  trigger: ReactNode;
  /** Contenuto del pannello aperto. */
  children: ReactNode;
  className?: string;
  panelClassName?: string;
  maxHeightClassName?: string;
  disabled?: boolean;
}

/**
 * Contenitore con chiusura al click fuori. Usare per menu custom (scope, flow, DS con search).
 */
export function BrutalDropdown({
  open,
  onOpenChange,
  trigger,
  children,
  className = '',
  panelClassName = '',
  maxHeightClassName = 'max-h-48',
  disabled = false,
}: BrutalDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || disabled) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open, onOpenChange, disabled]);

  return (
    <div ref={ref} className={`relative ${className}`.trim()}>
      {trigger}
      {open && !disabled && (
        <div className={`${brutalSelectPanelClass} ${maxHeightClassName} ${panelClassName}`.trim()} role="listbox">
          {children}
        </div>
      )}
    </div>
  );
}

export interface BrutalSelectOption<T extends string = string> {
  value: T;
  label: string;
}

export interface BrutalSelectProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: BrutalSelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  panelClassName?: string;
  maxHeightClassName?: string;
  /** Testo trigger: maiuscolo come scope Audit se true */
  labelUppercase?: boolean;
}

/**
 * Select singola brutal (linguaggio codice, tipo ticket, ecc.).
 */
export function BrutalSelect<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  className = '',
  panelClassName = '',
  maxHeightClassName = 'max-h-[200px]',
  labelUppercase = false,
}: BrutalSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!disabled) setOpen(next);
    },
    [disabled],
  );

  return (
    <BrutalDropdown
      open={open}
      onOpenChange={handleOpenChange}
      disabled={disabled}
      className={className}
      panelClassName={panelClassName}
      maxHeightClassName={maxHeightClassName}
      trigger={
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleOpenChange(!open)}
          className={brutalSelectTriggerClass}
        >
          <span
            className={`text-xs font-bold truncate min-w-0 ${labelUppercase ? 'uppercase' : ''}`.trim()}
            title={selected?.label ?? placeholder}
          >
            {selected?.label ?? placeholder}
          </span>
          <span className="shrink-0" aria-hidden>
            {open ? '▲' : '▼'}
          </span>
        </button>
      }
    >
      {options.map((o) => (
        <div
          key={o.value}
          role="option"
          aria-selected={value === o.value}
          onClick={() => {
            onChange(o.value);
            setOpen(false);
          }}
          className={`${brutalSelectOptionRowClass} ${value === o.value ? brutalSelectOptionSelectedClass : ''}`.trim()}
        >
          {o.label}
        </div>
      ))}
    </BrutalDropdown>
  );
}
