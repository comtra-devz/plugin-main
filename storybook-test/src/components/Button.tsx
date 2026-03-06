import React from 'react';

export interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  variant = 'primary',
  disabled = false,
  onClick,
}) => {
  const base = 'px-4 py-2 font-semibold rounded-lg border-2 transition-colors';
  const variants = {
    primary: 'bg-[#ff90e8] border-black hover:bg-[#ffc900]',
    secondary: 'bg-white border-black hover:bg-gray-100',
    danger: 'bg-red-100 border-red-600 text-red-800 hover:bg-red-200',
  };
  return (
    <button
      type="button"
      className={`${base} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
};
