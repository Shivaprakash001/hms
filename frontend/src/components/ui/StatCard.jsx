import React from 'react';
import { cn } from '@/lib/utils';

const ICON_TONES = {
  indigo: 'bg-ops-accent/10 text-ops-accent',
  purple: 'bg-ops-accent/10 text-ops-accent',
  blue: 'bg-ops-info/10 text-ops-info',
  emerald: 'bg-ops-success/10 text-ops-success',
  amber: 'bg-ops-warning/10 text-ops-warning',
  rose: 'bg-ops-danger/10 text-ops-danger',
};

/**
 * Operational stat block — border-first, scan-friendly (NIVA / temp-ui style).
 */
export const StatCard = ({
  title,
  value,
  icon: Icon,
  color = 'indigo',
  iconPosition = 'left',
  isCurrency = false,
  subtitle = null,
  className,
}) => {
  const iconTone = ICON_TONES[color] || ICON_TONES.indigo;
  const displayValue = isCurrency && typeof value === 'number' ? `₹${value}` : (isCurrency ? `₹${value}` : value);

  if (iconPosition === 'right') {
    return (
      <div
        className={cn(
          'bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-3',
          className,
        )}
      >
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium">{title}</p>
          <p className="text-xl font-semibold text-foreground tracking-tight mt-1">{displayValue}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', iconTone)}>
            <Icon size={18} strokeWidth={2} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-xl p-4 space-y-2',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground font-medium">{title}</span>
        {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
      </div>
      <div className="space-y-1">
        <p className="text-xl font-semibold text-foreground tracking-tight">{displayValue}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
};
