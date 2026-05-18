import React from 'react';
import { cn } from '@/lib/utils';

const TONE = {
  default: 'bg-card border-border text-foreground',
  success: 'bg-ops-success/10 border-ops-success/20 text-foreground',
  warning: 'bg-ops-warning/10 border-ops-warning/20 text-foreground',
  danger: 'bg-ops-danger/10 border-ops-danger/20 text-foreground',
  accent: 'bg-ops-accent/10 border-ops-accent/20 text-foreground',
};

export function OpsStatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  tone = 'default',
  onClick,
  highlight = false,
  className,
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'relative rounded-xl border p-4 text-left space-y-2 transition-transform',
        onClick && 'active:scale-[0.98] hover:border-ops-accent/40',
        TONE[tone] ?? TONE.default,
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
      </div>
      <div className="space-y-1">
        <p className="text-xl font-semibold text-foreground tracking-tight">{value}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {highlight && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-ops-danger animate-pulse" />
      )}
    </Comp>
  );
}
