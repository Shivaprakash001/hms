import { AlertTriangle, ArrowRight, Crown, Receipt, TrendingUp } from 'lucide-react';
import { fmtExact } from '../../shared/format';
import { categoryIcon } from '@features/expenses/constants';

type Tone = 'default' | 'success' | 'warning' | 'danger';

// Single consolidated KPI surface — replaces the old top summary grid AND the
// separate "Compact monthly summary" (same four numbers, two data sources,
// shown twice on the same scroll). Cards that map to a filter are clickable,
// per "actionable, not just informational."
export function ExpenseDashboard({
  kpis,
  categoryBreakdown,
  vendorBreakdown,
  monthlyTrend,
  largestExpense,
  onFilterCategory,
  onOpenExpense,
}: {
  kpis: Record<string, any>;
  categoryBreakdown: Record<string, any>[];
  vendorBreakdown: Record<string, any>[];
  monthlyTrend: Record<string, any>[];
  largestExpense: Record<string, any> | null;
  onFilterCategory?: (category: string) => void;
  onOpenExpense?: (expense: Record<string, any>) => void;
}) {
  const health = String(kpis.health || '');
  const healthLabel = health === 'healthy' ? 'Healthy' : health === 'warning' ? 'Needs attention' : health === 'dangerous' ? 'At risk' : '';
  const healthTone: Tone = health === 'healthy' ? 'success' : health === 'dangerous' ? 'danger' : 'warning';
  const netProfit = Number(kpis.net_profit || 0);
  const topCategory = categoryBreakdown[0] || null;
  const unusualCategory = categoryBreakdown.find((c) => c.anomaly) || null;
  const topVendor = vendorBreakdown[0] || null;
  const maxTrend = Math.max(...monthlyTrend.map((m) => Number(m.expenses || 0)), 1);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Business health</h2>
          <p className="text-xs text-muted-foreground">Is the business healthy this month? What needs attention?</p>
        </div>
        {healthLabel && (
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${
              healthTone === 'success'
                ? 'bg-success/10 text-success'
                : healthTone === 'danger'
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-warning/10 text-warning'
            }`}
          >
            {healthLabel}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile label="Revenue" value={fmtExact(kpis.collected_revenue)} />
        <StatTile label="Expenses" value={fmtExact(kpis.this_month_expenses)} tone="warning" />
        <StatTile label="Net Profit" value={fmtExact(netProfit)} tone={netProfit < 0 ? 'danger' : 'success'} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ActionTile
          icon={<Crown className="h-4 w-4" />}
          label="Top Category"
          value={topCategory ? `${categoryIcon(topCategory.category)} ${topCategory.category}` : 'No spend yet'}
          detail={topCategory ? `${fmtExact(topCategory.amount)} · ${Number(topCategory.percentage || 0).toFixed(0)}% of expenses` : undefined}
          onClick={topCategory && onFilterCategory ? () => onFilterCategory(topCategory.category) : undefined}
        />
        <ActionTile
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Unusual Spending"
          value={unusualCategory ? unusualCategory.category : 'Nothing unusual'}
          detail={unusualCategory ? unusualCategory.anomaly : 'Spending looks steady vs last month'}
          tone={unusualCategory ? 'warning' : 'default'}
          onClick={unusualCategory && onFilterCategory ? () => onFilterCategory(unusualCategory.category) : undefined}
        />
        <ActionTile
          icon={<Receipt className="h-4 w-4" />}
          label="Top Vendor"
          value={topVendor ? topVendor.vendor : 'No vendors recorded'}
          detail={topVendor ? `${fmtExact(topVendor.amount)} · ${topVendor.count} payment${topVendor.count === 1 ? '' : 's'} this month` : 'Add vendor names to track suppliers'}
        />
        <ActionTile
          icon={<TrendingUp className="h-4 w-4" />}
          label="Largest Expense"
          value={largestExpense ? String(largestExpense.title || 'Expense') : 'No expenses in range'}
          detail={largestExpense ? fmtExact(largestExpense.amount) : undefined}
          onClick={largestExpense && onOpenExpense ? () => onOpenExpense(largestExpense) : undefined}
        />
      </div>

      {monthlyTrend.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monthly trend</p>
          <div className="mt-3 flex items-end gap-2">
            {monthlyTrend.map((m) => (
              <div key={String(m.month)} className="flex-1 text-center">
                <div className="mx-auto flex h-16 w-full max-w-[28px] items-end overflow-hidden rounded-md bg-muted">
                  <div
                    className="w-full rounded-md bg-accent/70"
                    style={{ height: `${Math.max(6, (Number(m.expenses || 0) / maxTrend) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[9px] font-medium text-muted-foreground">{String(m.month).slice(5)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function StatTile({ label, value, tone = 'default' }: { label: string; value: string; tone?: Tone }) {
  const color =
    tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : tone === 'danger' ? 'text-destructive' : 'text-foreground';
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ActionTile({
  icon,
  label,
  value,
  detail,
  tone = 'default',
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
  onClick?: () => void;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex items-start gap-3 rounded-xl border border-border bg-card p-3.5 text-left ${
        onClick ? 'hover:border-accent/40 active:scale-[0.99] transition-all' : ''
      }`}
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          tone === 'warning' ? 'bg-warning/10 text-warning' : 'bg-accent/10 text-accent'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
          {onClick && <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
        </span>
        <span className="mt-0.5 block truncate text-sm font-bold text-foreground">{value}</span>
        {detail && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{detail}</span>}
      </span>
    </Comp>
  );
}
