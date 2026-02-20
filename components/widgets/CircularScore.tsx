import React, { useEffect, useState } from 'react';

interface Props {
  score: number;
  label?: string;
  size?: 'sm' | 'lg';
}

export const CircularScore: React.FC<Props> = ({ score, label = "Health Score", size = 'lg' }) => {
  const radius = size === 'lg' ? 70 : 30;
  const stroke = size === 'lg' ? 12 : 6;
  const circumference = 2 * Math.PI * radius;
  
  // Animation state
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    // Trigger animation after mount
    const targetOffset = circumference - (score / 100) * circumference;
    setTimeout(() => setOffset(targetOffset), 100);
  }, [score, circumference]);

  const dim = size === 'lg' ? 160 : 70;
  const center = dim / 2;

  return (
    <div className={`relative flex flex-col items-center justify-center ${size === 'lg' ? 'p-6' : 'p-0'}`}>
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg className="w-full h-full -rotate-90">
          {/* Background Circle */}
          <circle
            cx={center} cy={center} r={radius}
            fill="transparent" stroke="#f3f4f6" strokeWidth={stroke}
          />
          {/* Progress Circle with Animation */}
          <circle
            cx={center} cy={center} r={radius}
            fill="transparent" stroke="black" strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="butt"
            style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${size === 'lg' ? 'text-4xl' : 'text-sm'} font-black tracking-tighter`}>{score}%</span>
        </div>
      </div>
      {label && <span className="text-xs font-bold uppercase tracking-widest mt-2 text-gray-500">{label}</span>}
    </div>
  );
};