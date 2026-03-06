import React from 'react';

export interface CardProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ title, description, children }) => {
  return (
    <div className="border-2 border-black rounded-lg p-4 bg-white shadow-[4px_4px_0_0_#000] max-w-sm">
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      {description && <p className="text-sm text-gray-600 mb-3">{description}</p>}
      {children}
    </div>
  );
};
