import React from 'react';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardCard } from './DashboardCard';

const SEVERITY_STYLES = {
  HIGH: 'border-ops-danger/25 bg-ops-danger/5',
  MEDIUM: 'border-ops-warning/25 bg-ops-warning/5',
  LOW: 'border-ops-accent/25 bg-ops-accent/5',
};

export function InsightStrip({ insights, severity }) {
  if (!insights?.length) return null;
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.LOW;

  return (
    <DashboardCard className={cn('p-4', style)}>
      <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
        <Zap className="w-3.5 h-3.5 text-ops-accent" />
        Operational insights
      </p>
      <ul className="space-y-2">
        {insights.slice(0, 3).map((ins, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-foreground leading-relaxed">
            <span className="w-1.5 h-1.5 rounded-full bg-ops-accent mt-1.5 shrink-0" />
            {ins}
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
