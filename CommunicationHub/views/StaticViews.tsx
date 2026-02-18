
import React, { useState } from 'react';
import { DATA } from '../data';
import { FolderType, StrategyCard } from '../types';

const BRUTAL = {
  card: `bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] p-6 transition-all cursor-pointer hover:shadow-[6px_6px_0px_0px_#000] hover:-translate-y-1`,
};

export const StaticFolderView: React.FC<{ type: Exclude<FolderType, 'EDITORIAL'> }> = ({ type }) => {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in-95 duration-300">
      {DATA[type].map(card => (
        <div 
          key={card.id}
          onClick={() => setSelectedCard(selectedCard === card.id ? null : card.id)}
          className={`${BRUTAL.card} ${selectedCard === card.id ? 'bg-[#ff90e8]' : 'bg-white'}`}
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase bg-black text-white px-2 py-0.5">{card.id}</span>
                <span className="text-[9px] font-mono border border-black px-1 bg-white text-black">Updated: {card.lastUpdated}</span>
              </div>
              <h3 className="text-2xl font-black uppercase mt-2 leading-none text-black">{card.title}</h3>
              <p className="text-xs font-bold uppercase mt-1 opacity-70 text-black">{card.subtitle}</p>
            </div>
            {selectedCard === card.id && <span className="text-2xl">👁️</span>}
          </div>
          
          {selectedCard === card.id && (
            <div 
              className="mt-4 pt-4 border-t-2 border-black bg-white/90 -mx-6 -mb-6 p-6 text-black cursor-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-sm font-medium leading-relaxed select-text">
                {/* Normally we would render full rich text here */}
                {typeof card.content === 'string' ? <p>{card.content}</p> : card.content}
              </div>
              <div className="mt-4 flex gap-2">
                {card.tags.map(tag => (
                  <span key={tag} className="text-[9px] font-bold uppercase border border-black px-1 bg-white">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
