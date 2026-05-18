import React from 'react';
import { cn } from '@/lib/utils';

export function DashboardSection({ title, description, action, children, className }) {
  return (
    <section className={cn('space-y-3', className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-base font-medium text-foreground">{title}</h2>
            )}
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
