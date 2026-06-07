import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { Calendar, Clock, AlertCircle } from 'lucide-react';
import { cn } from '../../../components/ui/utils';

const fmt = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` :
  n >= 1000 ? `₹${(n / 1000).toFixed(0)}K` :
  `₹${Math.round(n || 0)}`;

const fmtDay = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  } catch {
    return dateStr;
  }
};

interface Props {
  cashflow: any;
  stats: any;
}

export function CashflowForecast({ cashflow, stats }: Props) {
  const d = stats?.data ?? stats ?? {};
  const intel = d?.intelligence ?? {};
  const duesSummary = intel?.dues?.summary ?? {};

  const dueToday = duesSummary?.due_today ?? cashflow?.due_today ?? 0;
  const dueWeek = duesSummary?.due_this_week ?? cashflow?.due_this_week ?? 0;
  const overdueTotal = d?.overdue_amount ?? cashflow?.overdue_amount ?? 0;
  const estMonthEnd = cashflow?.predicted_collection ?? cashflow?.expected_rent ?? d?.expected_revenue ?? 0;

  const dailyData: any[] = Array.isArray(cashflow?.daily_collection)
    ? cashflow.daily_collection.slice(-30).map((entry: any) => ({
        day: fmtDay(entry.date ?? entry.day ?? ''),
        collected: Number(entry.amount ?? entry.collected ?? 0),
        expected: Number(entry.expected ?? 0),
      }))
    : [];

  const chips = [
    { label: 'Due Today', value: dueToday, color: dueToday > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground', icon: <Clock className="h-3.5 w-3.5" />, pulse: false },
    { label: 'Due This Week', value: dueWeek, color: dueWeek > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground', icon: <Calendar className="h-3.5 w-3.5" />, pulse: false },
    { label: 'Overdue', value: overdueTotal, color: overdueTotal > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground', icon: <AlertCircle className="h-3.5 w-3.5" />, pulse: overdueTotal > 0 },
    { label: 'Predicted Collection', value: estMonthEnd, color: 'text-emerald-600 dark:text-emerald-400', icon: <Calendar className="h-3.5 w-3.5" />, pulse: false },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Cashflow Forecast</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Daily collection activity (last 30 days)</p>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {chips.map((chip) => (
            <div key={chip.label} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30">
              <span className={cn('shrink-0 relative', chip.color)}>
                {chip.icon}
                {chip.pulse && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
              </span>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground truncate">{chip.label}</div>
                <div className={cn('text-sm font-bold', chip.color)}>{fmt(chip.value)}</div>
              </div>
            </div>
          ))}
        </div>

        {dailyData.length > 0 ? (
          <>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [fmt(value), name === 'collected' ? 'Collected' : 'Expected']}
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                />
                {dailyData.some((d) => d.expected > 0) && (
                  <Bar dataKey="expected" fill="hsl(var(--muted-foreground) / 0.15)" radius={[2, 2, 0, 0]} maxBarSize={16} />
                )}
                <Bar dataKey="collected" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {dailyData.some((d) => d.expected > 0) && (
            <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground mt-1">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" /> Collected</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/15 inline-block border border-border" /> Expected</span>
            </div>
          )}
          </>
        ) : (
          <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">
            No daily cashflow data available
          </div>
        )}
      </div>
    </div>
  );
}
