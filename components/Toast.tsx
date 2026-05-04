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

/** All toasts share the same black frame; only fill + text tone vary (no soft colored borders). */
const variantStyles = {
  default: 'bg-white text-black',
  error: 'bg-red-100 text-red-950',
  warning: 'bg-amber-100 text-black',
  info: 'bg-sky-100 text-sky-950',
};

const variantTextStyles = {
  default: 'text-black',
  error: 'text-red-950',
  warning: 'text-black',
  info: 'text-sky-950',
};

const variantDescStyles = {
  default: 'text-gray-800',
  error: 'text-red-900',
  warning: 'text-neutral-900',
  info: 'text-sky-900',
};

const variantBorderStyles = {
  default: 'border-black',
  error: 'border-black',
  warning: 'border-black',
  info: 'border-black',
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
      className={`border-2 border-black shadow-[3px_3px_0_0_#000] pt-4 px-3 pb-3 w-full max-w-full animate-in slide-in-from-bottom-2 duration-200 ${v}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-black uppercase leading-snug tracking-wide ${titleCls}`}>{title}</p>
          {description && (
            <p className={`text-sm mt-2 leading-relaxed ${descCls}`}>{description}</p>
          )}
        </div>
        {dismissible && (
          <button
            type="button"
            onClick={onDismiss}
            className={`shrink-0 flex items-center justify-center w-6 h-6 -mt-1 -mr-1 rounded-sm text-sm font-bold ${
              variant === 'error'
                ? 'text-red-700 hover:text-red-900'
                : variant === 'warning'
                  ? 'text-amber-700 hover:text-amber-900'
                  : variant === 'info'
                    ? 'text-sky-700 hover:text-sky-900'
                    : 'text-gray-500 hover:text-black'
            }`}
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
      {actions.length > 0 && (
        <div className={`flex flex-wrap items-center gap-2 mt-3 border-t-2 pt-2 ${actionBorder}`}>
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
