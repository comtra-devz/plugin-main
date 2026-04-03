import React from 'react';
import { Button } from './ui/Button';
import type { ToastAction } from '../contexts/ToastContext';

interface Props {
  id: string;
  title: string;
  description?: string;
  actions?: ToastAction[];
  dismissible?: boolean;
  variant?: 'default' | 'error' | 'warning' | 'info';
  onDismiss: () => void;
}

const variantStyles = {
  default: 'bg-white border-black text-black',
  error: 'bg-red-100 border-red-500 text-red-800',
  warning: 'bg-amber-100 border-amber-600 text-amber-900',
  info: 'bg-sky-50 border-sky-600 text-sky-800',
};

const variantTextStyles = {
  default: 'text-black',
  error: 'text-red-800',
  warning: 'text-amber-900',
  info: 'text-sky-800',
};

const variantDescStyles = {
  default: 'text-gray-700',
  error: 'text-red-700',
  warning: 'text-amber-800',
  info: 'text-sky-700',
};

const variantBorderStyles = {
  default: 'border-black/10',
  error: 'border-red-300',
  warning: 'border-amber-300',
  info: 'border-sky-200',
};

export const Toast: React.FC<Props> = ({
  title,
  description,
  actions = [],
  dismissible = true,
  variant = 'default',
  onDismiss,
}) => {
  const v = variantStyles[variant];
  const titleCls = variantTextStyles[variant];
  const descCls = variantDescStyles[variant];
  const actionBorder = variantBorderStyles[variant];
  return (
    <div
      role="alert"
      className={`border-2 shadow-[4px_4px_0_0_#000] pt-4 px-3 pb-3 max-w-full animate-in slide-in-from-bottom-2 duration-200 ${v}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-base font-black uppercase leading-snug ${titleCls}`}>{title}</p>
          {description && (
            <p className={`text-sm mt-2 leading-relaxed ${descCls}`}>{description}</p>
          )}
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-gray-400 hover:text-black font-bold text-sm leading-none p-0.5"
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
      {actions.length > 0 && (
        <div className={`flex flex-wrap items-center gap-2 mt-3 pt-2 border-t ${actionBorder}`}>
          {actions.map((a, i) => (
            <Button
              key={i}
              variant="black"
              size="sm"
              onClick={() => {
                a.onClick();
                onDismiss();
              }}
            >
              {a.label}
            </Button>
          ))}
          {dismissible && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-[10px] font-bold uppercase underline text-gray-500 hover:text-black"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
};
