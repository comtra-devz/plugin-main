import React from 'react';
import { BRUTAL } from '../constants';

interface Props {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const Card: React.FC<Props> = ({ children, className = '', title }) => {
  return (
    <div className={`${BRUTAL.card} mb-4 ${className}`}>
      {title && <h3 className="font-bold text-lg border-b-2 border-black pb-2 mb-3">{title}</h3>}
      {children}
    </div>
  );
};