import { TrendingUp, TrendingDown, Minus, IndianRupee, Users, Activity } from 'lucide-react';
import { cn } from '../../../components/ui/utils';

const fmt = (n: number) =>
  n >= 100000
    ? `₹${(n / 100000).toFixed(1)}L`
    : n >= 1000
      ? `₹${(n / 1000).toFixed(1)}K`
      : `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

function TrendPill({ value }: { value?: number }) {
  if (value === undefined || value === null) return null;
  if (value === 0) return (
    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
      <Minus className="h-3 w-3" /> 0%
    </span>
  );
  const up = value > 0;
  return (
    <span className={cn('flex items-center gap-0.5 text-xs font-medium', up ? 'text-emerald-500' : 'text-red-500')}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(value)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  trend,
  sub,
  highlight,
  loading,
}: {
  label: string;
  value: string;
  trend?: number;
  sub?: string;
  highlight?: boolean;
  loading?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-xl border p-4 flex flex-col gap-1',
      highlight ? 'bg-primary/5 border-primary/30' : 'bg-card border-border',
    )}>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      {loading ? (
        <div className="h-7 w-24 bg-muted animate-pulse rounded" />
      ) : (
        <span className={cn('text-xl font-bold tracking-tight', highlight ? 'text-primary' : 'text-foreground')}>
          {value}
        </span>
      )}
      <div className="flex items-center gap-2">
        <TrendPill value={trend} />
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

function ScorePill({ score, state }: { score: number; state: string }) {
  const color =
    state === 'Excellent' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
    state === 'Healthy' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' :
    state === 'At Risk' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
    'bg-red-500/15 text-red-600 dark:text-red-400';

  const barColor =
    state === 'Excellent' ? 'bg-emerald-500' :
    state === 'Healthy' ? 'bg-blue-500' :
    state === 'At Risk' ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold', color)}>
      <Activity className="h-3.5 w-3.5" />
      <span>{state}</span>
      <div className="w-16 h-1.5 bg-current/20 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs opacity-70">{score}</span>
    </div>
  );
}

interface Props {
  stats: any;
  loading?: boolean;
}

export function HealthBar({ stats, loading }: Props) {
  const d = stats?.data ?? stats ?? {};
  const intel = d?.intelligence ?? {};

  const revenueTrend = Number(intel?.kpis?.revenue?.trend ?? 0);
  const expectedRevenue = d?.expected_revenue ?? 0;
  const collected = d?.revenue ?? 0;
  const outstanding = d?.pending_dues ?? 0;
  const netProfit = d?.net_profit ?? 0;
  const collectionRate = d?.collection_rate ?? 0;
  const occupancyRate = d?.occupancy_rate ?? 0;
  const expenseRatio = d?.expense_revenue_ratio ?? 0;
  const operationalScore = d?.operational_score ?? 0;
  const operationalState = d?.operational_state ?? 'Unknown';

  const collectionColor = collectionRate >= 90 ? 'text-emerald-500' : collectionRate >= 75 ? 'text-amber-500' : 'text-red-500';
  const occupancyColor = occupancyRate >= 85 ? 'text-emerald-500' : occupancyRate >= 65 ? 'text-amber-500' : 'text-red-500';
  const expenseColor = expenseRatio <= 35 ? 'text-emerald-500' : expenseRatio <= 50 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <IndianRupee className="h-4 w-4 text-muted-foreground" />
          Financial Health
        </h2>
        {!loading && operationalScore > 0 && (
          <ScorePill score={operationalScore} state={operationalState} />
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Expected Revenue"
          value={fmt(expectedRevenue)}
          sub="this month"
          loading={loading}
        />
        <KpiCard
          label="Collected"
          value={fmt(collected)}
          trend={revenueTrend}
          sub={collectionRate > 0 ? `${collectionRate}% collection` : undefined}
          highlight
          loading={loading}
        />
        <KpiCard
          label="Outstanding Dues"
          value={fmt(outstanding)}
          sub={outstanding > 0 ? 'pending collection' : 'all clear'}
          loading={loading}
        />
        <KpiCard
          label="Net Profit"
          value={fmt(netProfit)}
          sub={netProfit < 0 ? 'loss this month' : undefined}
          loading={loading}
        />
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card">
          <span className="text-xs text-muted-foreground">Collection Rate</span>
          <span className={cn('text-sm font-bold', collectionColor)}>{collectionRate}%</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Occupancy</span>
          <span className={cn('text-sm font-bold', occupancyColor)}>{occupancyRate}%</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card">
          <span className="text-xs text-muted-foreground">Expense Ratio</span>
          <span className={cn('text-sm font-bold', expenseColor)}>{expenseRatio}%</span>
        </div>
        {d?.active_tenants !== undefined && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Active Tenants</span>
            <span className="text-sm font-bold text-foreground">{d.active_tenants}</span>
            {d?.total_capacity && (
              <span className="text-xs text-muted-foreground">/ {d.total_capacity}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
