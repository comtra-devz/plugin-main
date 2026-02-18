import React from 'react';
import { BRUTAL, PRIVACY_CONTENT } from '../constants';

export const Privacy: React.FC = () => {
  return (
    <div className="p-4 pb-24 flex flex-col gap-6">
      <div className={`${BRUTAL.card} bg-white`}>
        <h2 className="text-2xl font-black uppercase mb-4 bg-black text-white inline-block px-2">Privacy Policy</h2>
        
        <div className="space-y-4 text-xs leading-relaxed font-medium text-gray-700">
          {PRIVACY_CONTENT.map((item, index) => (
            <p key={index}>
              <strong className="block text-black uppercase mb-1">{item.title}</strong>
              {item.text}
            </p>
          ))}
        </div>
        
        <div className="mt-6 pt-4 border-t-2 border-dashed border-black text-[10px] text-gray-500">
          Last updated: October 2023 (TEST ENV)
        </div>
      </div>
    </div>
  );
};