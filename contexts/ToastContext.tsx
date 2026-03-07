import React, { createContext, useCallback, useState } from 'react';
import { Toast } from '../components/Toast';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  title: string;
  description?: string;
  actions?: ToastAction[];
  /** Se true, mostra un pulsante Chiudi per chiudere il toast. Default true. */
  dismissible?: boolean;
  /** error = red, warning = amber (temporary/retriable), info = blue/gray, default = white */
  variant?: 'default' | 'error' | 'warning' | 'info';
}

export interface ToastItem extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
}

const toastContext = createContext<ToastContextValue | null>(null);

let toastId = 0;
function nextId() {
  return `toast-${++toastId}-${Date.now()}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((options: ToastOptions) => {
    const id = nextId();
    const item: ToastItem = {
      ...options,
      id,
      dismissible: options.dismissible !== false,
      variant: options.variant ?? 'default',
    };
    setToasts((prev) => [...prev, item]);
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <toastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </toastContext.Provider>
  );
}

/** 32px sopra la tab bar; nav bar ~3.5rem → bottom = 32px + 56px */
const TOAST_BOTTOM = 'calc(2rem + 3.5rem)';

function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed left-4 right-4 z-[55] flex flex-col gap-2 pointer-events-none"
      style={{ bottom: TOAST_BOTTOM }}
      aria-live="polite"
    >
      <div className="flex flex-col gap-2 pointer-events-auto">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            id={t.id}
            title={t.title}
            description={t.description}
            actions={t.actions}
            dismissible={t.dismissible}
            variant={t.variant}
            onDismiss={() => onDismiss(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(toastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
