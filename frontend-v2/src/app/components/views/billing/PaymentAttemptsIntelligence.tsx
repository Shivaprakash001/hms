import { Smartphone, XCircle, CheckCircle2, Clock, Ban } from 'lucide-react';
import { cn } from '../../../components/ui/utils';

interface Attempts {
  total: number;
  success: number;
  failed: number;
  pending_verification: number;
  abandoned: number;
  upi_failure_rate: number;
}

interface Props {
  attempts: Attempts;
}

interface MetricTileProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}

function MetricTile({ icon, label, value, color }: MetricTileProps) {
  return (
    <div className={cn('rounded-xl border p-3 flex flex-col gap-1.5', color)}>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <span className="text-xl font-bold">{value}</span>
    </div>
  );
}

export function PaymentAttemptsIntelligence({ attempts }: Props) {
  const {
    total = 0,
    success = 0,
    failed = 0,
    pending_verification = 0,
    abandoned = 0,
    upi_failure_rate = 0,
  } = attempts;

  const successRate = total > 0 ? Math.round((success / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden" id="payment-attempts">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Payment Reliability</h3>
        {total > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{total} attempts this month</span>
            {upi_failure_rate > 0 && (
              <span className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full',
                upi_failure_rate > 20 ? 'bg-red-500/15 text-red-600 dark:text-red-400' :
                upi_failure_rate > 10 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
              )}>
                {upi_failure_rate}% failure rate
              </span>
            )}
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {total === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No online payment attempts this month</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <MetricTile
                icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                label="Successful"
                value={success}
                color="bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              />
              <MetricTile
                icon={<XCircle className="h-3.5 w-3.5 text-red-500" />}
                label="Failed"
                value={failed}
                color={failed > 0 ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300' : 'bg-muted border-border text-muted-foreground'}
              />
              <MetricTile
                icon={<Clock className="h-3.5 w-3.5 text-violet-500" />}
                label="Pending Verify"
                value={pending_verification}
                color={pending_verification > 0 ? 'bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-300' : 'bg-muted border-border text-muted-foreground'}
              />
              <MetricTile
                icon={<Ban className="h-3.5 w-3.5 text-amber-500" />}
                label="Abandoned"
                value={abandoned}
                color={abandoned > 0 ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300' : 'bg-muted border-border text-muted-foreground'}
              />
            </div>

            {total > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <span className="text-muted-foreground">Success Rate</span>
                  <span className={cn(
                    'font-semibold',
                    successRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' :
                    successRate >= 60 ? 'text-amber-600 dark:text-amber-400' :
                    'text-red-600 dark:text-red-400',
                  )}>
                    {successRate}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 rounded-l-full"
                    style={{ width: `${Math.round((success / total) * 100)}%` }}
                  />
                  <div
                    className="h-full bg-red-400"
                    style={{ width: `${Math.round((failed / total) * 100)}%` }}
                  />
                  <div
                    className="h-full bg-violet-400"
                    style={{ width: `${Math.round((pending_verification / total) * 100)}%` }}
                  />
                </div>
                <div className="flex gap-3 mt-1.5">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                    Success
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-red-400 inline-block" />
                    Failed
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-violet-400 inline-block" />
                    Pending
                  </span>
                </div>
              </div>
            )}

            {(failed > 0 || pending_verification > 0) && (
              <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                {failed > 0 && `${failed} payment${failed > 1 ? 's' : ''} failed — consider contacting tenants to retry. `}
                {pending_verification > 0 && `${pending_verification} payment${pending_verification > 1 ? 's' : ''} awaiting manual confirmation.`}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
