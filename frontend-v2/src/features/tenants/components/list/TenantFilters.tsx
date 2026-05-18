import { Search } from 'lucide-react';
import { useTenantStore, type LifecycleFilter } from '@features/tenants/store/tenantStore';

const FILTERS: { id: LifecycleFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'invited', label: 'Pending invite' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'move_out', label: 'Vacating' },
  { id: 'unverified', label: 'Unverified' },
  { id: 'no_room', label: 'No room' },
];

export function TenantFilters() {
  const searchQuery = useTenantStore((s) => s.searchQuery);
  const lifecycleFilter = useTenantStore((s) => s.lifecycleFilter);
  const showInactive = useTenantStore((s) => s.showInactive);
  const setSearchQuery = useTenantStore((s) => s.setSearchQuery);
  const setLifecycleFilter = useTenantStore((s) => s.setLifecycleFilter);
  const setShowInactive = useTenantStore((s) => s.setShowInactive);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search name, phone, email, room…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setLifecycleFilter(id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors touch-manipulation ${
              lifecycleFilter === id
                ? 'bg-accent text-accent-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
          className="rounded border-border"
        />
        Show former tenants
      </label>
    </div>
  );
}
