import { ChevronRight } from 'lucide-react';

const fmt = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` :
  n >= 1000 ? `₹${(n / 1000).toFixed(0)}K` :
  `₹${Math.round(n || 0)}`;

interface Stage {
  label: string;
  count?: number;
  amount?: number;
  sub?: string;
  color: string;
  pctOfFirst?: number;
}

interface Props {
  stats: any;
  cashflow: any;
  funnel: any;
}

export function CollectionPipeline({ stats, cashflow, funnel }: Props) {
  const d = stats?.data ?? stats ?? {};
  const intel = d?.intelligence ?? {};

  const generatedCount = d?.active_tenants ?? 0;
  const generatedAmount = d?.expected_revenue ?? cashflow?.expected_rent ?? 0;
  const remindedCount = intel?.dues?.reminder_conversion?.sent ?? funnel?.reminders_sent ?? 0;
  const attemptsCount = (intel?.payment_attempts?.total ?? 0);
  const collectedAmount = d?.revenue ?? cashflow?.collected_amount ?? 0;
  const collectedCount = d?.paid_obligations ?? 0;

  const stages: Stage[] = [
    {
      label: 'Generated',
      count: generatedCount,
      amount: generatedAmount,
      sub: 'obligations',
      color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
    },
    {
      label: 'Reminded',
      count: remindedCount,
      sub: 'reminders sent',
      pctOfFirst: generatedCount > 0 ? Math.round((remindedCount / generatedCount) * 100) : undefined,
      color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    },
    {
      label: 'Attempted',
      count: attemptsCount,
      sub: 'payment attempts',
      pctOfFirst: generatedCount > 0 && attemptsCount > 0 ? Math.round((attemptsCount / generatedCount) * 100) : undefined,
      color: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
    },
    {
      label: 'Collected',
      amount: collectedAmount,
      count: collectedCount || undefined,
      sub: 'payments received',
      pctOfFirst: generatedAmount > 0 ? Math.round((collectedAmount / generatedAmount) * 100) : undefined,
      color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Collection Pipeline</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Generated obligations → successful collections</p>
      </div>
      <div className="p-4">
        <div className="flex items-stretch gap-1 overflow-x-auto">
          {stages.map((stage, i) => (
            <div key={stage.label} className="flex items-center gap-1 flex-1 min-w-0">
              <div className={`flex-1 rounded-lg border px-3 py-3 min-w-[80px] ${stage.color}`}>
                <div className="text-xs font-semibold mb-1 truncate">{stage.label}</div>
                {stage.amount !== undefined && stage.amount > 0 && (
                  <div className="text-base font-bold">{fmt(stage.amount)}</div>
                )}
                {stage.count !== undefined && (
                  <div className={stage.amount ? 'text-xs opacity-70' : 'text-base font-bold'}>
                    {stage.count}
                  </div>
                )}
                <div className="text-xs opacity-60 mt-0.5">{stage.sub}</div>
                {stage.pctOfFirst !== undefined && (
                  <div className="mt-1.5 h-1 bg-current/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-current rounded-full transition-all"
                      style={{ width: `${Math.min(stage.pctOfFirst, 100)}%` }}
                    />
                  </div>
                )}
                {stage.pctOfFirst !== undefined && (
                  <div className="text-xs opacity-60 mt-0.5">{stage.pctOfFirst}% of pipeline</div>
                )}
              </div>
              {i < stages.length - 1 && (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
