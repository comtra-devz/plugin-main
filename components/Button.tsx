import React from 'react';
import { BRUTAL, COLORS } from '../constants';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<Props> = ({ children, variant = 'primary', className = '', ...props }) => {
  const bg = variant === 'primary' ? `bg-[${COLORS.primary}]` : 'bg-white';
  
  return (
    <button 
      className={`${BRUTAL.btn} ${bg} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};