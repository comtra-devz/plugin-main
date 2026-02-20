import React from 'react';

interface Props {
  label: string;
  type?: 'high' | 'medium' | 'low';
}

export const Badge: React.FC<Props> = ({ label, type = 'medium' }) => {
  const colors = {
    high: 'bg-red-400',
    medium: 'bg-yellow-300',
    low: 'bg-green-300'
  };

  return (
    <span className={`${colors[type]} border-2 border-black px-2 py-0.5 text-xs font-bold uppercase`}>
      {label}
    </span>
  );
};