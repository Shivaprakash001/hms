import React from 'react';
import { cn } from '@/lib/utils';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { OpsButton } from './OpsButton';

export function OpsEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) {
  return (
    <DashboardCard className={cn('p-8 sm:p-12 text-center', className)}>
      {Icon && <Icon className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">{description}</p>
      )}
      {actionLabel && onAction && (
        <OpsButton variant="primary" size="md" className="mt-4" onClick={onAction}>
          {actionLabel}
        </OpsButton>
      )}
    </DashboardCard>
  );
}
