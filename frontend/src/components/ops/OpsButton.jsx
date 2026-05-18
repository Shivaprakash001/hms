import React from 'react';
import { cn } from '@/lib/utils';

const VARIANTS = {
  primary: 'bg-ops-accent text-white hover:bg-ops-accent/90 border-transparent',
  secondary: 'bg-card text-foreground border-border hover:bg-secondary',
  danger: 'bg-ops-danger text-white hover:bg-ops-danger/90 border-transparent',
  ghost: 'bg-transparent text-foreground border-transparent hover:bg-secondary',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-lg',
  lg: 'px-4 py-3.5 text-sm rounded-xl',
};

export function OpsButton({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...props
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium border transition-all',
        'active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
