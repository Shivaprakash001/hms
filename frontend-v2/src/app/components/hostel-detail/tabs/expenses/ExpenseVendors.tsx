import { fmtExact } from '../../shared/format';

// Backed by the server-side vendor_breakdown aggregation (expense-service.ts)
// — an exact figure regardless of date-range/page size, not the old
// client-side approximation over only the currently-loaded page.
export function ExpenseVendors({ vendors }: { vendors: Record<string, any>[] }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">Top vendors this month</h2>
        <p className="text-xs text-muted-foreground">Who received the most money</p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        {vendors.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Add vendor names while recording expenses to track repeat suppliers.
          </p>
        ) : (
          <div className="space-y-3">
            {vendors.slice(0, 5).map((vendor) => (
              <div key={String(vendor.vendor)} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{vendor.vendor}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {vendor.count} payment{vendor.count === 1 ? '' : 's'}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-foreground">{fmtExact(vendor.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
