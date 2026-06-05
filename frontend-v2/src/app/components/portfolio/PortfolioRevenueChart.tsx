import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Trophy, AlertTriangle, TrendingDown, BarChart3 } from 'lucide-react';
import { useIsMobile } from '@/app/components/ui/use-mobile';

/* ── Formatting ─────────────────────────────────────────────────────── */

const fmt = (n: number) => {
  const v = Math.abs(Number(n || 0));
  const sign = n < 0 ? '-' : '';
  if (v >= 100000) return `${sign}₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `${sign}₹${(v / 1000).toFixed(0)}K`;
  return `${sign}₹${v.toLocaleString('en-IN')}`;
};

const pctFmt = (n: number) => `${Math.round(n)}%`;

/* ── Colors ──────────────────────────────────────────────────────────── */

const COLORS = {
  revenue: '#10B981',    // emerald-500
  expenses: '#EF4444',   // red-500
  profit: '#3B82F6',     // blue-500
  revenueFill: '#10B98120',
  expensesFill: '#EF444415',
  profitFill: '#3B82F618',
};

/* ── Types ───────────────────────────────────────────────────────────── */

interface MonthTrend {
  month: string;
  month_key: string;
  total_revenue: number;
  total_expenses: number;
  total_profit: number;
  hostels: {
    hostel_id: string;
    hostel_name: string;
    revenue: number;
    expenses: number;
    profit: number;
  }[];
}

interface BusinessHealthInsights {
  highest_profit_hostel: { hostel_name: string; profit: number } | null;
  lowest_occupancy_hostel: { hostel_name: string; occupancy_rate: number } | null;
  highest_outstanding_hostel: { hostel_name: string; pending_dues: number } | null;
}

interface Props {
  monthlyTrends: MonthTrend[];
  insights?: BusinessHealthInsights | null;
  topPerformerId?: string | null;
  topPerformerName?: string;
}

/* ── Custom tooltip ──────────────────────────────────────────────────── */

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const revenue = payload.find((p: any) => p.dataKey === 'revenue')?.value ?? 0;
  const expenses = payload.find((p: any) => p.dataKey === 'expenses')?.value ?? 0;
  const profit = payload.find((p: any) => p.dataKey === 'profit')?.value ?? 0;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-lg text-xs space-y-1.5">
      <p className="font-semibold text-foreground text-[11px]">{label}</p>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS.revenue }} />
        <span className="text-muted-foreground">Revenue</span>
        <span className="ml-auto font-semibold text-foreground">{fmt(revenue)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS.expenses }} />
        <span className="text-muted-foreground">Expenses</span>
        <span className="ml-auto font-semibold text-foreground">{fmt(expenses)}</span>
      </div>
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS.profit }} />
        <span className="text-muted-foreground">Net Profit</span>
        <span className={`ml-auto font-bold ${profit >= 0 ? 'text-blue-600' : 'text-destructive'}`}>
          {fmt(profit)}
        </span>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────── */

export function PortfolioRevenueChart({
  monthlyTrends,
  insights,
  topPerformerName,
}: Props) {
  const isMobile = useIsMobile();

  const chartData = useMemo(() => {
    return monthlyTrends.map((m) => ({
      month: m.month,
      revenue: m.total_revenue,
      expenses: m.total_expenses,
      profit: m.total_profit,
    }));
  }, [monthlyTrends]);

  // Check if we have meaningful data
  const hasData = useMemo(() => {
    return chartData.some((d) => d.revenue > 0 || d.expenses > 0);
  }, [chartData]);

  /* ── Empty state ───────────────────────────────────────────────────── */
  if (chartData.length === 0 || !hasData) {
    return (
      <div className="space-y-3">
        {/* Header */}
        <div>
          <h2 className="text-sm font-bold text-foreground">Business Health Trend</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Revenue, expenses and profit over the last 6 months
          </p>
        </div>

        <div className="h-52 flex flex-col items-center justify-center gap-3 text-center rounded-xl border border-dashed border-border bg-card/50 px-6">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px]">
            Start recording rent collections and expenses to see business performance trends.
          </p>
        </div>
      </div>
    );
  }

  /* ── Current month summary chips ───────────────────────────────────── */
  const latest = chartData[chartData.length - 1];
  const previous = chartData.length >= 2 ? chartData[chartData.length - 2] : null;
  const profitTrend = previous && previous.profit !== 0
    ? Math.round(((latest.profit - previous.profit) / Math.abs(previous.profit)) * 100)
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-foreground">Business Health Trend</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Revenue, expenses and profit · last {chartData.length} months
          </p>
        </div>
        {topPerformerName && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 text-[10px] font-semibold shrink-0 max-w-[40%] truncate">
            <Trophy className="w-3 h-3 shrink-0" />
            <span className="truncate">{topPerformerName}</span>
          </span>
        )}
      </div>

      {/* Legend pills */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.revenue }} />
          <span className="text-[10px] font-medium text-muted-foreground">Revenue</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.expenses }} />
          <span className="text-[10px] font-medium text-muted-foreground">Expenses</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.profit }} />
          <span className="text-[10px] font-medium text-muted-foreground">Net Profit</span>
        </div>
        {profitTrend !== null && (
          <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
            profitTrend >= 0
              ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30'
              : 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/30'
          }`}>
            {profitTrend >= 0 ? '↑' : '↓'} {Math.abs(profitTrend)}% profit
          </span>
        )}
      </div>

      {/* Chart */}
      <div className={isMobile ? 'h-52' : 'h-64'}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.revenue} stopOpacity={0.2} />
                <stop offset="100%" stopColor={COLORS.revenue} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.expenses} stopOpacity={0.15} />
                <stop offset="100%" stopColor={COLORS.expenses} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.profit} stopOpacity={0.15} />
                <stop offset="100%" stopColor={COLORS.profit} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickFormatter={(v) => fmt(Number(v))}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke={COLORS.revenue}
              strokeWidth={2}
              fill="url(#gradRevenue)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, fill: 'var(--card)' }}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke={COLORS.expenses}
              strokeWidth={2}
              fill="url(#gradExpenses)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, fill: 'var(--card)' }}
            />
            <Area
              type="monotone"
              dataKey="profit"
              stroke={COLORS.profit}
              strokeWidth={2.5}
              strokeDasharray="6 3"
              fill="url(#gradProfit)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, fill: 'var(--card)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* KPI Insights */}
      {insights && (
        <div className="grid grid-cols-3 gap-2">
          {/* Highest profit hostel */}
          {insights.highest_profit_hostel ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 dark:border-emerald-800/30 dark:bg-emerald-900/15 p-2.5 min-w-0">
              <div className="flex items-center gap-1 mb-1.5">
                <Trophy className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 truncate">Top profit</span>
              </div>
              <p className="text-xs font-bold text-foreground truncate leading-tight">
                {insights.highest_profit_hostel.hostel_name}
              </p>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
                {fmt(insights.highest_profit_hostel.profit)} profit
              </p>
            </div>
          ) : (
            <InsightPlaceholder label="Top profit" />
          )}

          {/* Lowest occupancy hostel */}
          {insights.lowest_occupancy_hostel ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-800/30 dark:bg-amber-900/15 p-2.5 min-w-0">
              <div className="flex items-center gap-1 mb-1.5">
                <TrendingDown className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 truncate">Low occupancy</span>
              </div>
              <p className="text-xs font-bold text-foreground truncate leading-tight">
                {insights.lowest_occupancy_hostel.hostel_name}
              </p>
              <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold mt-0.5">
                {pctFmt(insights.lowest_occupancy_hostel.occupancy_rate)} occupied
              </p>
            </div>
          ) : (
            <InsightPlaceholder label="Low occupancy" />
          )}

          {/* Highest outstanding hostel */}
          {insights.highest_outstanding_hostel ? (
            <div className="rounded-xl border border-red-200 bg-red-50/60 dark:border-red-800/30 dark:bg-red-900/15 p-2.5 min-w-0">
              <div className="flex items-center gap-1 mb-1.5">
                <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" />
                <span className="text-[9px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-400 truncate">Top dues</span>
              </div>
              <p className="text-xs font-bold text-foreground truncate leading-tight">
                {insights.highest_outstanding_hostel.hostel_name}
              </p>
              <p className="text-[10px] text-red-700 dark:text-red-400 font-semibold mt-0.5">
                {fmt(insights.highest_outstanding_hostel.pending_dues)} due
              </p>
            </div>
          ) : (
            <InsightPlaceholder label="Top dues" />
          )}
        </div>
      )}
    </div>
  );
}

function InsightPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-2.5 min-w-0">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <p className="text-[10px] text-muted-foreground">No data yet</p>
    </div>
  );
}
