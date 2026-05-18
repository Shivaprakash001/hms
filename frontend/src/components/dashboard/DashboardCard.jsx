import React from 'react';
import { cn } from '@/lib/utils';

export function DashboardCard({ className, children, ...props }) {
  return (
    <div
      className={cn('bg-card border border-border rounded-xl', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function DashboardCardHeader({ className, children }) {
  return (
    <div className={cn('px-4 py-3 border-b border-border flex items-center justify-between gap-3', className)}>
      {children}
    </div>
  );
}

export function DashboardCardBody({ className, children }) {
  return <div className={cn('p-4', className)}>{children}</div>;
}
