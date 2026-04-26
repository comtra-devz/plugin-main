import React from 'react';

export type BrutalToggleProps = {
  /** Controlled on/off */
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  /** Accessible name (required) */
  'aria-label': string;
  /** Optional id for label association */
  id?: string;
  /** Slightly smaller for dense toolbars */
  size?: 'md' | 'sm';
};

/**
 * Brutal DS switch: pill track + knob, black border, pink active fill.
 * Use this instead of ON/OFF text buttons for boolean settings (e.g. private Storybook, AI toggle).
 * If you publish a Storybook for the Comtra UI kit, register this as **BrutalToggle** there.
 */
export const BrutalToggle: React.FC<BrutalToggleProps> = ({
  pressed,
  onPressedChange,
  'aria-label': ariaLabel,
  id,
  size = 'md',
}) => {
  const h = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const knob = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';
  const onTranslate = size === 'sm' ? 'translate-x-4' : 'translate-x-5';
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={pressed}
      aria-label={ariaLabel}
      onClick={() => onPressedChange(!pressed)}
      className={`relative inline-flex ${h} shrink-0 items-center rounded-full border-2 border-black transition-colors ${
        pressed ? 'bg-[#ff90e8]' : 'bg-white'
      }`}
    >
      <span
        className={`inline-block ${knob} transform rounded-full bg-black transition-transform ${
          pressed ? onTranslate : 'translate-x-1'
        }`}
      />
    </button>
  );
};
