import { cn } from '../ui/utils';
import type { HostelStatus } from './HostelStatusBadge';

export type HostelFilter = 'all' | 'running' | 'closed';

interface HostelFilterChipsProps {
  active: HostelFilter;
  onChange: (filter: HostelFilter) => void;
  counts: { all: number; running: number; closed: number };
}

const CHIPS: { key: HostelFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'closed', label: 'Closed' },
];

export function HostelFilterChips({ active, onChange, counts }: HostelFilterChipsProps) {
  return (
    <div className="flex items-center gap-2">
      {CHIPS.map((chip) => {
        const count = counts[chip.key];
        const isActive = active === chip.key;
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChange(chip.key)}
            className={cn(
              'h-9 px-3.5 rounded-full text-xs font-semibold transition-colors touch-manipulation inline-flex items-center gap-1.5',
              isActive
                ? 'bg-accent text-accent-foreground shadow-sm'
                : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-accent/40'
            )}
          >
            {chip.label}
            <span
              className={cn(
                'text-[10px] font-bold',
                isActive ? 'opacity-80' : 'opacity-60'
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Helper: compute filter counts from a list of hostels with status */
export function computeFilterCounts(
  hostels: Array<{ status?: string }>
): { all: number; running: number; closed: number } {
  let running = 0;
  let closed = 0;
  for (const h of hostels) {
    if (h.status === 'ARCHIVED') closed++;
    else running++;
  }
  return { all: hostels.length, running, closed };
}

/** Helper: apply filter to hostel list */
export function applyHostelFilter<T extends { status?: string }>(
  hostels: T[],
  filter: HostelFilter
): T[] {
  if (filter === 'all') return hostels;
  if (filter === 'running') return hostels.filter((h) => h.status !== 'ARCHIVED');
  if (filter === 'closed') return hostels.filter((h) => h.status === 'ARCHIVED');
  return hostels;
}
