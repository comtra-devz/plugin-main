import React from 'react';
import { BRUTAL } from '../../constants';

interface Props {
  label: string;
  score: number;
  icon: string;
  color: string;
  issues: number;
  onClick?: () => void;
}

export const CategoryRow: React.FC<Props> = ({ label, score, icon, color, issues, onClick }) => (
  <div onClick={onClick} className={`${BRUTAL.card} flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors`}>
    <div className={`size-10 ${color} border-2 border-black flex items-center justify-center font-bold text-xl`}>
      {icon}
    </div>
    <div className="flex-1">
      <div className="flex justify-between items-center mb-1">
        <span className="font-bold uppercase text-sm">{label}</span>
        <span className="text-sm font-black">{score}%</span>
      </div>
      <div className="w-full bg-gray-200 border border-black h-2">
        <div className="bg-black h-full" style={{ width: `${score}%` }}></div>
      </div>
      <p className="text-[10px] font-bold text-gray-500 mt-1">{issues} Issues Found</p>
    </div>
  </div>
);