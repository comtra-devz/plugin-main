import React from 'react';

export interface InputProps {
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  error?: boolean;
  onChange?: (value: string) => void;
}

export const Input: React.FC<InputProps> = ({
  placeholder = 'Enter text...',
  value = '',
  disabled = false,
  error = false,
  onChange,
}) => {
  return (
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      className={`w-full max-w-xs px-3 py-2 border-2 rounded-lg outline-none transition-colors ${
        error ? 'border-red-500' : 'border-black'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    />
  );
};
