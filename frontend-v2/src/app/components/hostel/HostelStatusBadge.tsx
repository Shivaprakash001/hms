import { cn } from '../ui/utils';

export type HostelStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

const STATUS_CONFIG: Record<HostelStatus, {
  label: string;
  dot: string;
  text: string;
  bg: string;
}> = {
  ACTIVE: {
    label: 'Running',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-900/30',
  },
  INACTIVE: {
    label: 'Temporarily Closed',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-900/30',
  },
  ARCHIVED: {
    label: 'Closed',
    dot: 'bg-slate-400 dark:bg-slate-500',
    text: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800/40',
  },
};

interface HostelStatusBadgeProps {
  status: HostelStatus;
  className?: string;
}

export function HostelStatusBadge({ status, className }: HostelStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.ACTIVE;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none',
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', config.dot)} />
      {config.label}
    </span>
  );
}

/** Utility: map backend status to user-facing label */
export function hostelStatusLabel(status: HostelStatus): string {
  return STATUS_CONFIG[status]?.label ?? 'Unknown';
}
