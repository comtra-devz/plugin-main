import React from 'react';
import { BRUTAL } from '../constants';

export const StatCard: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = 'bg-white' }) => (
  <div className={`${BRUTAL.card} ${color} flex flex-col items-center justify-center text-center`}>
    <span className="text-4xl font-black">{value}</span>
    <span className="text-xs font-bold uppercase tracking-widest mt-1">{label}</span>
  </div>
);