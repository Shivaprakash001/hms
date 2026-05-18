import React from 'react';
import { cn } from '@/lib/utils';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export function OpsPage({
  title,
  subtitle,
  eyebrow,
  actions,
  children,
  className,
  contentClassName,
  maxWidth = 'max-w-7xl',
}) {
  return (
    <div className={cn('space-y-6', className)}>
      {(title || actions) && (
        <DashboardPageHeader
          eyebrow={eyebrow || subtitle}
          title={title}
          actions={actions}
        />
      )}
      <div className={cn(maxWidth, 'mx-auto w-full', contentClassName)}>{children}</div>
    </div>
  );
}
