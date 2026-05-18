import React from 'react';
import { cn } from '@/lib/utils';

export function ProgressTrack({ value = 0, className, barClassName }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={cn('w-full bg-secondary rounded-full h-2 overflow-hidden', className)}>
      <div
        className={cn('h-2 rounded-full transition-all bg-ops-accent', barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
