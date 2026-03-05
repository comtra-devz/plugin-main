import React from 'react';
import { BRUTAL } from '../constants';
import type { ToastAction } from '../contexts/ToastContext';

interface Props {
  id: string;
  title: string;
  description?: string;
  actions?: ToastAction[];
  dismissible?: boolean;
  variant?: 'default' | 'error';
  onDismiss: () => void;
}

export const Toast: React.FC<Props> = ({
  title,
  description,
  actions = [],
  dismissible = true,
  variant = 'default',
  onDismiss,
}) => {
  const isError = variant === 'error';
  return (
    <div
      role="alert"
      className={`border-2 shadow-[4px_4px_0_0_#000] p-3 max-w-full animate-in slide-in-from-bottom-2 duration-200 ${
        isError ? 'bg-red-100 border-red-500 text-red-800' : 'bg-white border-black'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-black uppercase ${isError ? 'text-red-800' : 'text-black'}`}>{title}</p>
          {description && (
            <p className={`text-[10px] mt-1 leading-relaxed ${isError ? 'text-red-700' : 'text-gray-700'}`}>{description}</p>
          )}
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-gray-400 hover:text-black font-bold text-sm leading-none p-0.5"
            aria-label="Chiudi"
          >
            ×
          </button>
        )}
      </div>
      {actions.length > 0 && (
        <div className={`flex flex-wrap items-center gap-2 mt-3 pt-2 border-t ${isError ? 'border-red-300' : 'border-black/10'}`}>
          {actions.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                a.onClick();
                onDismiss();
              }}
              className={`${BRUTAL.btn} text-[10px] py-1.5 px-2 bg-black text-white hover:bg-gray-800`}
            >
              {a.label}
            </button>
          ))}
          {dismissible && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-[10px] font-bold uppercase underline text-gray-500 hover:text-black"
            >
              Chiudi
            </button>
          )}
        </div>
      )}
    </div>
  );
};
