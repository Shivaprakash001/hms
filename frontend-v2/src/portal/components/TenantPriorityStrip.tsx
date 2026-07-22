import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, CreditCard } from 'lucide-react';

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

type PaymentStatus = 'PAID' | 'PARTIAL' | 'PENDING' | 'NOT_GENERATED' | 'OVERDUE';

interface ReadModelItem {
  type?: string;
  outstanding?: number;
  late_fee?: number;
  due_date?: string;
  legacy_status?: string;
}

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
  items?: ReadModelItem[];
}

interface Props {
  readModel?: ReadModel | null;
  moveOut?: { status?: string; planned_exit_date?: string } | null;
}

export function TenantPriorityStrip({ readModel, moveOut }: Props) {
  const currentPayable = Number(readModel?.current_payable_amount ?? 0);
  const overdueAmount = Number(readModel?.overdue_amount ?? 0);
  const overdueDays = Number(readModel?.overdue_days ?? 0);
  const paymentStatus = readModel?.payment_status;
  const isPaid = paymentStatus === 'PAID' || paymentStatus === 'NOT_GENERATED' || currentPayable <= 0;
  const isOverdue = paymentStatus === 'OVERDUE';

  // `current_payable_amount` (and its category breakdown) includes obligations
  // already activated ahead of their due date — e.g. next month's rent made
  // payable early so a tenant *can* prepay — due-date-agnostic by design (see
  // financial-service.ts). For this "how urgent is this" card we only want
  // what's actually due today or earlier in the headline total; anything
  // activated-but-not-yet-due is called out separately, not silently folded
  // into the urgent number, so it can't be misread as "you're this overdue."
  const items = readModel?.items ?? [];
  const todayKey = new Date().toISOString().slice(0, 10);
  const isDueNow = (i: ReadModelItem) => i.legacy_status !== 'UPCOMING' && (!i.due_date || i.due_date.slice(0, 10) <= todayKey);
  const dueNowAmount = items.length
    ? items.filter(isDueNow).reduce((sum, i) => sum + Number(i.outstanding ?? 0), 0)
    : currentPayable;
  const payAheadAmount = Math.max(0, currentPayable - dueNowAmount);

  const sumByType = (type: string) =>
    items.filter((i) => isDueNow(i) && i.type === type).reduce((sum, i) => sum + Math.max(0, Number(i.outstanding ?? 0) - Number(i.late_fee ?? 0)), 0);
  const rentDue = items.length ? sumByType('RENT') : Number(readModel?.current_payable_breakdown?.rent ?? 0);
  const securityDepositDue = items.length
    ? sumByType('SECURITY_DEPOSIT') + sumByType('ADVANCE')
    : Number(readModel?.current_payable_breakdown?.security_deposit ?? 0);
  const maintenanceDue = items.length ? sumByType('MAINTENANCE') : Number(readModel?.current_payable_breakdown?.maintenance ?? 0);
  const lateFees = items.length
    ? items.filter(isDueNow).reduce((sum, i) => sum + Number(i.late_fee ?? 0), 0)
    : Number(readModel?.current_payable_breakdown?.late_fees ?? 0);

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
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between font-bold text-base">
                <span>Total to pay</span>
                <span>{fmt(dueNowAmount)}</span>
              </div>
              {isOverdue && overdueAmount > 0 && (
                <p className="text-xs font-medium opacity-90">
                  {overdueAmount < dueNowAmount
                    ? `${fmt(overdueAmount)} of this is overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'} — the remaining ${fmt(dueNowAmount - overdueAmount)} is due today.`
                    : `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}.`}
                </p>
              )}
              {payAheadAmount > 0 && (
                <p className="text-xs opacity-75">
                  Plus {fmt(payAheadAmount)} for next month, already available if you&apos;d like to pay ahead.
                </p>
              )}
              {(rentDue > 0 || securityDepositDue > 0 || lateFees > 0 || maintenanceDue > 0) && (
                <div className="pt-2 border-t border-current/20 space-y-1">
                  {rentDue > 0 && (
                    <div className="flex justify-between opacity-90">
                      <span>Rent</span>
                      <span className="font-medium">{fmt(rentDue)}</span>
                    </div>
                  )}
                  {securityDepositDue > 0 && (
                    <div className="flex justify-between opacity-90">
                      <span>Security deposit</span>
                      <span className="font-medium">{fmt(securityDepositDue)}</span>
                    </div>
                  )}
                  {lateFees > 0 && (
                    <div className="flex justify-between opacity-90">
                      <span>Late fee</span>
                      <span className="font-medium">{fmt(lateFees)}</span>
                    </div>
                  )}
                  {maintenanceDue > 0 && (
                    <div className="flex justify-between opacity-90">
                      <span>Maintenance</span>
                      <span className="font-medium">{fmt(maintenanceDue)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {isPaid && (
            <p className="text-sm mt-1 opacity-90">No pending dues — you&apos;re in good standing.</p>
          )}
        </div>
      </div>

      {!isPaid && dueNowAmount > 0 && (
        <Link
          to="/tenant/financials?pay=1"
          className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-accent text-accent-foreground font-bold text-sm touch-manipulation"
        >
          <CreditCard className="w-4 h-4" />
          Pay {fmt(dueNowAmount)}
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
