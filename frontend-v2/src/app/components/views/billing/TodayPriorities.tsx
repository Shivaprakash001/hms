import { AlertTriangle, AlertCircle, Info, ExternalLink, Smartphone, Clock } from 'lucide-react';
import { cn } from '../../../components/ui/utils';

interface Alert {
  type: string;
  title: string;
  message: string;
  severity: string;
  impact?: string;
}

interface Attempts {
  failed?: number;
  pending_verification?: number;
  abandoned?: number;
  upi_failure_rate?: number;
}

interface Props {
  alerts: Alert[];
  attempts?: Attempts;
}

function severityConfig(severity: string) {
  switch (severity) {
    case 'critical':
      return {
        bg: 'bg-red-500/10 border-red-500/30',
        icon: <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />,
        badge: 'bg-red-500/15 text-red-600 dark:text-red-400',
        label: 'Critical',
      };
    case 'warning':
      return {
        bg: 'bg-amber-500/10 border-amber-500/30',
        icon: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />,
        badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
        label: 'Warning',
      };
    default:
      return {
        bg: 'bg-blue-500/10 border-blue-500/30',
        icon: <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />,
        badge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
        label: 'Info',
      };
  }
}

function alertCTA(type: string) {
  switch (type) {
    case 'OVERDUE_DUES':
    case 'HIGH_OVERDUE':
      return { label: 'View Overdue', href: '#risk-zone' };
    case 'LOW_OCCUPANCY':
      return { label: 'View Rooms', href: '#room-performance' };
    case 'HIGH_EXPENSES':
    case 'EXPENSE_SPIKE':
      return { label: 'Review Expenses', href: '#expense-intelligence' };
    case 'LOW_COLLECTION':
      return { label: 'Send Reminders', href: '#ledger' };
    default:
      return null;
  }
}

export function TodayPriorities({ alerts, attempts }: Props) {
  const urgentAttempts = (attempts?.failed ?? 0) + (attempts?.pending_verification ?? 0) + (attempts?.abandoned ?? 0);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" />
          Today's Priorities
        </span>
        <span className="ml-auto text-xs text-muted-foreground">{alerts.length + (urgentAttempts > 0 ? 1 : 0)} items</span>
      </div>

      <div className="divide-y divide-border">
        {alerts.map((alert, i) => {
          const cfg = severityConfig(alert.severity);
          const cta = alertCTA(alert.type);
          return (
            <div key={i} className={cn('flex items-start gap-3 px-4 py-3', cfg.bg)}>
              {cfg.icon}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', cfg.badge)}>{cfg.label}</span>
                  <span className="text-sm font-semibold text-foreground">{alert.title}</span>
                </div>
                {alert.impact && (
                  <p className="text-xs text-muted-foreground mt-0.5">{alert.impact}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
              </div>
              {cta && (
                <a
                  href={cta.href}
                  className="shrink-0 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {cta.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          );
        })}

        {urgentAttempts > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 bg-violet-500/10 border-violet-500/30">
            <Smartphone className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-600 dark:text-violet-400">Payment Tech</span>
                <span className="text-sm font-semibold text-foreground">Online Payment Issues</span>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {(attempts?.failed ?? 0) > 0 && (
                  <span className="text-xs text-muted-foreground">{attempts!.failed} failed</span>
                )}
                {(attempts?.pending_verification ?? 0) > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {attempts!.pending_verification} pending verification
                  </span>
                )}
                {(attempts?.abandoned ?? 0) > 0 && (
                  <span className="text-xs text-muted-foreground">{attempts!.abandoned} abandoned</span>
                )}
              </div>
            </div>
            <a href="#payment-attempts" className="shrink-0 flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Review
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
