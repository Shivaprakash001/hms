import { cn } from '@/app/components/ui/utils';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  INVITED: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  MOVE_OUT_REQUESTED: 'bg-violet-500/15 text-violet-600 border-violet-500/30',
  LEFT: 'bg-muted text-muted-foreground border-border',
  EXPIRED: 'bg-muted text-muted-foreground border-border',
  CANCELLED: 'bg-muted text-muted-foreground border-border',
};

const LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INVITED: 'Invited',
  MOVE_OUT_REQUESTED: 'Vacating',
  LEFT: 'Left',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

interface Props {
  status: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function TenantStatusBadge({ status, className, size = 'sm' }: Props) {
  const key = String(status).toUpperCase();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        STATUS_STYLES[key] ?? 'bg-secondary text-muted-foreground border-border',
        className
      )}
    >
      {LABELS[key] ?? status}
    </span>
  );
}
