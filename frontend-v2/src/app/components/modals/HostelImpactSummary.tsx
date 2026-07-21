import { Users, IndianRupee } from 'lucide-react';

const fmt = (n: number) => {
  const v = Number(n ?? 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  return `₹${v.toLocaleString('en-IN')}`;
};

/**
 * Shown inside the Pause/Close confirmation modals so the owner sees the
 * actual blast radius — real tenant count and real dues, sourced from the
 * same portfolio stats already on the hostel's card — before confirming,
 * rather than a generic "this will affect your tenants" warning.
 */
export function HostelImpactSummary({
  activeTenants,
  occupiedBeds,
  pendingDues,
  tone = 'warning',
}: {
  activeTenants?: number;
  occupiedBeds?: number;
  pendingDues?: number;
  tone?: 'warning' | 'destructive';
}) {
  const tenants = Number(activeTenants ?? occupiedBeds ?? 0);
  const dues = Number(pendingDues ?? 0);

  if (tenants <= 0 && dues <= 0) return null;

  const toneClasses =
    tone === 'destructive'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/15 dark:text-amber-300';

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${toneClasses}`}>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {tenants > 0 && (
          <span className="flex items-center gap-1.5 font-semibold">
            <Users className="h-4 w-4 shrink-0" />
            {tenants} active tenant{tenants === 1 ? '' : 's'} affected
          </span>
        )}
        {dues > 0 && (
          <span className="flex items-center gap-1.5 font-semibold">
            <IndianRupee className="h-4 w-4 shrink-0" />
            {fmt(dues)} in dues won't be tracked while paused
          </span>
        )}
      </div>
    </div>
  );
}
