import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function DashboardAlertBanner({
  title = 'Action required',
  message,
  severity = 'warning',
  onDismiss,
  onAction,
  actionLabel = 'View details',
}) {
  const isCritical = severity === 'critical';
  const theme = isCritical
    ? {
        wrap: 'bg-ops-danger/10 border-ops-danger/25',
        icon: 'text-ops-danger bg-ops-danger/15',
        title: 'text-foreground',
        sub: 'text-muted-foreground',
        btn: 'bg-ops-danger text-white',
      }
    : {
        wrap: 'bg-ops-warning/10 border-ops-warning/25',
        icon: 'text-ops-warning bg-ops-warning/15',
        title: 'text-foreground',
        sub: 'text-muted-foreground',
        btn: 'bg-ops-warning text-white',
      };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('mx-4 mt-4 rounded-xl border p-4', theme.wrap)}
    >
      <div className="flex items-start gap-3">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', theme.icon)}>
          <AlertTriangle size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold', theme.title)}>{title}</p>
          <p className={cn('text-xs mt-0.5', theme.sub)}>{message}</p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
            aria-label="Dismiss alert"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className={cn('mt-3 w-full py-2.5 text-xs font-medium rounded-lg active:scale-[0.98] transition-transform', theme.btn)}
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
}
