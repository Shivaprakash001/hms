import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, CreditCard } from 'lucide-react';

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

interface DuesData {
  total_due?: number;
  rent_due?: number;
  late_fees_due?: number;
  items?: { type?: string; outstanding?: number; due_date?: string; dueDate?: string }[];
}

interface Props {
  dues?: DuesData | null;
  payments?: { next_due_date?: string; outstanding_balance?: number } | null;
  moveOut?: { status?: string; planned_exit_date?: string } | null;
}

function daysUntil(dateStr?: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

export function TenantPriorityStrip({ dues, payments, moveOut }: Props) {
  const totalDue = Number(dues?.total_due ?? payments?.outstanding_balance ?? 0);
  const rentDue = Number(dues?.rent_due ?? 0);
  const lateFees = Number(dues?.late_fees_due ?? 0);
  const maintenanceDue = (dues?.items ?? [])
    .filter((i) => String(i.type).toUpperCase() === 'MAINTENANCE')
    .reduce((s, i) => s + Number(i.outstanding ?? 0), 0);

  const nextDue = payments?.next_due_date ?? dues?.items
    ?.map((item) => item.due_date ?? item.dueDate)
    .filter(Boolean)
    .sort((a, b) => new Date(String(a)).getTime() - new Date(String(b)).getTime())[0];
  const days = daysUntil(nextDue);
  const isOverdue = days != null && days < 0;
  const isPaid = totalDue <= 0;

  let rentStatus = 'All clear';
  let statusTone = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700';
  let StatusIcon = CheckCircle2;

  if (!isPaid) {
    StatusIcon = isOverdue ? AlertTriangle : Clock;
    if (isOverdue) {
      rentStatus = `Overdue by ${Math.abs(days!)} day${Math.abs(days!) === 1 ? '' : 's'}`;
      statusTone = 'bg-destructive/10 border-destructive/30 text-destructive';
    } else if (days != null && days <= 7) {
      rentStatus = days === 0 ? 'Due today' : `Due in ${days} day${days === 1 ? '' : 's'}`;
      statusTone = 'bg-amber-500/10 border-amber-500/30 text-amber-700';
    } else {
      rentStatus = 'Payment pending';
      statusTone = 'bg-amber-500/10 border-amber-500/30 text-amber-700';
    }
  }

  const moveOutActive =
    moveOut?.status && !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(String(moveOut.status).toUpperCase());

  return (
    <div className={`rounded-xl border p-4 ${statusTone}`} role="region" aria-label="Rent status">
      <div className="flex items-start gap-3">
        <StatusIcon className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Rent status</p>
          <p className="text-lg font-bold mt-0.5">{rentStatus}</p>
          {!isPaid && (
            <div className="mt-3 space-y-1 text-sm">
              {rentDue > 0 && (
                <div className="flex justify-between">
                  <span>Rent due</span>
                  <span className="font-medium">{fmt(rentDue)}</span>
                </div>
              )}
              {lateFees > 0 && (
                <div className="flex justify-between">
                  <span>Late fee</span>
                  <span className="font-medium">{fmt(lateFees)}</span>
                </div>
              )}
              {maintenanceDue > 0 && (
                <div className="flex justify-between">
                  <span>Maintenance</span>
                  <span className="font-medium">{fmt(maintenanceDue)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-current/20 font-bold">
                <span>Total due</span>
                <span>{fmt(totalDue)}</span>
              </div>
            </div>
          )}
          {isPaid && (
            <p className="text-sm mt-1 opacity-90">No pending dues — you&apos;re in good standing.</p>
          )}
        </div>
      </div>

      {!isPaid && totalDue > 0 && (
        <Link
          to="/tenant/financials?pay=1"
          className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-accent text-accent-foreground font-bold text-sm touch-manipulation"
        >
          <CreditCard className="w-4 h-4" />
          Pay {fmt(totalDue)}
        </Link>
      )}

      {moveOutActive && (
        <Link
          to="/tenant/move-out"
          className="mt-3 block text-center text-xs font-semibold underline opacity-90"
        >
          Move-out: {String(moveOut.status).replace(/_/g, ' ')}
          {moveOut.planned_exit_date
            ? ` · ${new Date(String(moveOut.planned_exit_date)).toLocaleDateString('en-IN')}`
            : ''}
        </Link>
      )}
    </div>
  );
}
