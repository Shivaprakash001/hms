import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, CreditCard } from 'lucide-react';

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

type PaymentStatus = 'PAID' | 'PARTIAL' | 'PENDING' | 'NOT_GENERATED' | 'OVERDUE';

interface ReadModel {
  total_due?: number;
  current_payable_amount?: number;
  overdue_amount?: number;
  overdue_days?: number;
  current_payable_breakdown?: {
    rent?: number;
    security_deposit?: number;
    maintenance?: number;
    late_fees?: number;
  };
  payment_status?: PaymentStatus;
}

interface Props {
  readModel?: ReadModel | null;
  moveOut?: { status?: string; planned_exit_date?: string } | null;
}

export function TenantPriorityStrip({ readModel, moveOut }: Props) {
  const currentPayable = Number(readModel?.current_payable_amount ?? 0);
  const overdueAmount = Number(readModel?.overdue_amount ?? 0);
  const overdueDays = Number(readModel?.overdue_days ?? 0);
  const rentDue = Number(readModel?.current_payable_breakdown?.rent ?? 0);
  const lateFees = Number(readModel?.current_payable_breakdown?.late_fees ?? 0);
  const securityDepositDue = Number(readModel?.current_payable_breakdown?.security_deposit ?? 0);
  const maintenanceDue = Number(readModel?.current_payable_breakdown?.maintenance ?? 0);
  const paymentStatus = readModel?.payment_status;
  const isPaid = paymentStatus === 'PAID' || paymentStatus === 'NOT_GENERATED' || currentPayable <= 0;
  const isOverdue = paymentStatus === 'OVERDUE';

  let rentStatus = 'All clear';
  let statusTone = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700';
  let StatusIcon = CheckCircle2;

  if (!isPaid) {
    StatusIcon = isOverdue ? AlertTriangle : Clock;
    if (isOverdue) {
      rentStatus = `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`;
      statusTone = 'bg-destructive/10 border-destructive/30 text-destructive';
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
              {securityDepositDue > 0 && (
                <div className="flex justify-between">
                  <span>Security deposit</span>
                  <span className="font-medium">{fmt(securityDepositDue)}</span>
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
              {isOverdue && overdueAmount > 0 && overdueAmount !== currentPayable && (
                <div className="flex justify-between">
                  <span>Overdue</span>
                  <span className="font-medium">{fmt(overdueAmount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-current/20 font-bold">
                <span>Total due</span>
                <span>{fmt(currentPayable)}</span>
              </div>
            </div>
          )}
          {isPaid && (
            <p className="text-sm mt-1 opacity-90">No pending dues — you&apos;re in good standing.</p>
          )}
        </div>
      </div>

      {!isPaid && currentPayable > 0 && (
        <Link
          to="/tenant/financials?pay=1"
          className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-accent text-accent-foreground font-bold text-sm touch-manipulation"
        >
          <CreditCard className="w-4 h-4" />
          Pay {fmt(currentPayable)}
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
