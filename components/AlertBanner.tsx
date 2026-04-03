import React from 'react';

type AlertVariant = 'default' | 'error' | 'warning' | 'info';

const variantClasses: Record<AlertVariant, string> = {
  default: 'text-gray-800 bg-gray-50 border-gray-300',
  error: 'text-red-800 bg-red-50 border-red-300',
  warning: 'text-amber-700 bg-amber-50 border-amber-300',
  info: 'text-sky-800 bg-sky-50 border-sky-200',
};

interface AlertBannerProps {
  children: React.ReactNode;
  variant?: AlertVariant;
  className?: string;
}

export function AlertBanner({ children, variant = 'warning', className = '' }: AlertBannerProps) {
  const base =
    'text-sm font-semibold border-2 p-4 mx-4 text-center leading-snug';
  const variantCls = variantClasses[variant];
  return <p className={`${base} ${variantCls} ${className}`.trim()}>{children}</p>;
}

