import { TrendingUp, TrendingDown, Minus, Receipt, AlertTriangle } from 'lucide-react';
import { cn } from '../../../components/ui/utils';

const fmt = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` :
  n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` :
  `₹${Math.round(n || 0)}`;

interface Props {
  intel: any;
  stats: any;
}

function TrendIcon({ value }: { value: number }) {
  if (!value || value === 0) return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (value > 0) return <TrendingUp className="h-3 w-3 text-red-500" />;
  return <TrendingDown className="h-3 w-3 text-emerald-500" />;
}

export function ExpenseIntelligence({ intel, stats }: Props) {
  const categories: any[] = Array.isArray(intel?.expenses?.categories) ? intel.expenses.categories : [];
  const anomalies: any[] = Array.isArray(intel?.expenses?.anomalies) ? intel.expenses.anomalies : [];
  const d = stats?.data ?? stats ?? {};
  const expenseRatio = d?.expense_revenue_ratio ?? 0;
  const expensePerTenant = intel?.expenses?.expense_per_tenant ?? 0;
  const totalExpenses = d?.monthly_expenses ?? d?.expenses ?? 0;

  const maxAmount = categories.length > 0
    ? Math.max(...categories.map((c: any) => Number(c.amount ?? 0)))
    : 1;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden" id="expense-intelligence">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Receipt className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Expense Intelligence</h3>
        {expenseRatio > 0 && (
          <span className={cn(
            'ml-auto text-xs font-medium px-2 py-0.5 rounded-full',
            expenseRatio <= 35 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
            expenseRatio <= 50 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
            'bg-red-500/15 text-red-600 dark:text-red-400',
          )}>
            {expenseRatio}% of revenue
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <div className="text-xs text-muted-foreground">Total MTD</div>
            <div className="text-sm font-bold text-foreground">{fmt(totalExpenses)}</div>
          </div>
          {expensePerTenant > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="text-xs text-muted-foreground">Per tenant</div>
              <div className="text-sm font-bold text-foreground">{fmt(expensePerTenant)}</div>
            </div>
          )}
        </div>

        {anomalies.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">Anomalies Detected</div>
              {anomalies.slice(0, 2).map((a: any, i: number) => (
                <div key={i} className="text-xs text-muted-foreground">
                  {a.category}: <span className="font-medium text-amber-600 dark:text-amber-400">+{a.trend ?? a.growth}% MoM</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {categories.length > 0 ? (
          <div className="space-y-2">
            {categories.slice(0, 6).map((cat: any, i: number) => {
              const amount = Number(cat.amount ?? 0);
              const trend = Number(cat.trend ?? cat.mom_change ?? 0);
              const pct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
              return (
                <div key={cat.category ?? i}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-medium text-foreground truncate max-w-[140px]">
                        {cat.category ?? `Category ${i + 1}`}
                      </span>
                      <TrendIcon value={trend} />
                      {trend !== 0 && (
                        <span className={cn('text-xs', trend > 0 ? 'text-red-500' : 'text-emerald-500')}>
                          {trend > 0 ? '+' : ''}{Math.round(trend)}%
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-foreground">{fmt(amount)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        i === 0 ? 'bg-primary' : i === 1 ? 'bg-blue-500' : i === 2 ? 'bg-violet-500' : 'bg-muted-foreground',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground text-center py-4">No expense data this month</div>
        )}
      </div>
    </div>
  );
}
