import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { BRUTAL } from '../../constants';

export type ButtonVariant = 'primary' | 'secondary' | 'black' | 'danger';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[#ff90e8] text-black hover:bg-white hover:border-black disabled:bg-gray-200 disabled:cursor-wait',
  secondary:
    'bg-white text-black border-black hover:bg-gray-100 disabled:bg-gray-200 disabled:cursor-not-allowed',
  black:
    'bg-black text-white hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed',
  danger:
    'bg-red-600 text-white border-red-800 hover:bg-red-700 disabled:bg-gray-200 disabled:cursor-not-allowed',
};

const sizeClasses = {
  default: '',
  sm: 'text-[10px] px-3 py-1.5',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** React 19: esplicito perché alcuni tipi HTMLButton non espongono più children */
  children?: ReactNode;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  /** 'column' = stacked (default); 'row' = icon + text */
  layout?: 'column' | 'row';
  size?: 'default' | 'sm';
}

/**
 * Shared brutal-style button. Use variant="primary" for main CTAs (pink → white on hover).
 */
export function Button({
  variant = 'primary',
  fullWidth = false,
  layout = 'column',
  size = 'default',
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const layoutClass =
    layout === 'row'
      ? 'flex flex-row items-center justify-center gap-2'
      : 'flex flex-col justify-center items-center gap-0';
  // Rosa CTA: stile inline fallback così il primary è sempre visibile (non dipende dalla purge)
  const style =
    variant === 'primary' && !disabled
      ? { backgroundColor: '#ff90e8' }
      : undefined;
  return (
    <button
      type="button"
      disabled={disabled}
      style={style}
      className={`${BRUTAL.btn} ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${layoutClass} relative overflow-visible ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
