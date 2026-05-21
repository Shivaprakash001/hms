import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, DoorOpen, Loader2 } from 'lucide-react';
import { moveOutService } from '@features/move-out/api';
import { useTenantDashboard } from '@features/tenant-portal/hooks/useTenantDashboard';
import { MoveOutStepper } from '@features/tenants/components/moveout/MoveOutStepper';

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

export function TenantMoveOutPage() {
  const [plannedDate, setPlannedDate] = useState('');
  const [reason, setReason] = useState('PERSONAL_REASONS');
  const [reasonText, setReasonText] = useState('');
  const { advance, dues } = useTenantDashboard();

  const { data: timeline, isLoading, refetch } = useQuery({
    queryKey: ['tenant', 'move-out', 'timeline'],
    queryFn: () => moveOutService.getTimeline(),
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      moveOutService.submitRequest({
        plannedExitDate: plannedDate,
        reason,
        reasonText,
      }),
    onSuccess: () => {
      toast.success('Move-out request submitted');
      refetch();
    },
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Failed to submit'),
  });

  const timelineData = (timeline ?? {}) as Record<string, unknown>;
  const active = Boolean(timelineData.active);
  const requestFromTimeline = timelineData.request as Record<string, unknown> | undefined;
  const request = requestFromTimeline ?? (active
    ? {
        id: timelineData.request_id,
        status: timelineData.status,
        planned_exit_date: timelineData.planned_exit_date,
      }
    : null);
  const settlement = timelineData.settlement as
    | Record<string, unknown>
    | undefined;

  const cancelMutation = useMutation({
    mutationFn: () => moveOutService.cancelRequest(String(request?.id ?? '')),
    onSuccess: () => {
      toast.success('Move-out request cancelled');
      refetch();
    },
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Failed to cancel'),
  });

  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeType, setDisputeType] = useState('DEDUCTIONS');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [disputedAmount, setDisputedAmount] = useState('');

  const disputeMutation = useMutation({
    mutationFn: () =>
      moveOutService.dispute(String(request?.id ?? ''), {
        disputeType,
        description: disputeDescription,
        disputedAmount: Number(disputedAmount) || 0,
      }),
    onSuccess: () => {
      toast.success('Dispute submitted');
      setShowDisputeForm(false);
      refetch();
    },
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Failed to submit dispute'),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (active && request && typeof request === 'object') {
    const paidDeposit = Number(settlement?.security_deposit_amount ?? advance?.balance ?? 0);
    const extraAdvance = Number(settlement?.advance_balance ?? 0);
    const pendingRent = Number(settlement?.pending_rent_dues ?? dues?.rent_due ?? dues?.total_due ?? 0);
    const lateFees = Number(settlement?.pending_late_fees ?? 0);
    const otherDues = Number(
      settlement?.pending_utility_dues ??
        Math.max(0, Number(dues?.total_due ?? 0) - pendingRent - lateFees)
    );
    const deductions = Number(settlement?.total_deductions ?? settlement?.damages_amount ?? settlement?.damage_charges ?? 0);
    const netAmount = Number(
      settlement?.net_amount ??
        settlement?.net_settlement_amount ??
        paidDeposit + extraAdvance - pendingRent - lateFees - otherDues - deductions
    );
    const direction = String(settlement?.direction ?? settlement?.settlement_direction ?? '');

    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-foreground">Move-out</h1>
        <MoveOutStepper request={request as Record<string, unknown>} hostelId="" />

        {(paidDeposit > 0 || extraAdvance > 0 || pendingRent > 0 || lateFees > 0 || otherDues > 0 || settlement) && (
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Settlement preview</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid security deposit</span>
                <span>{fmt(paidDeposit)}</span>
              </div>
              {extraAdvance > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Extra advance balance</span>
                  <span>{fmt(extraAdvance)}</span>
                </div>
              )}
              {pendingRent > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pending rent</span>
                  <span className="text-destructive">−{fmt(pendingRent)}</span>
                </div>
              )}
              {lateFees > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Late fees</span>
                  <span className="text-destructive">−{fmt(lateFees)}</span>
                </div>
              )}
              {otherDues > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Maintenance / other dues</span>
                  <span className="text-destructive">−{fmt(otherDues)}</span>
                </div>
              )}
              {deductions > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Inspection deductions</span>
                  <span className="text-destructive">−{fmt(deductions)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-border font-bold">
                <span>{direction === 'TENANT_OWES_OWNER' || netAmount < 0 ? 'Amount to pay' : 'Refund amount'}</span>
                <span className={netAmount < 0 ? 'text-destructive' : 'text-accent'}>{fmt(Math.abs(netAmount))}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Final amounts are confirmed after inspection. This preview helps avoid disputes.
            </p>
          </section>
        )}

        {/* Actions section */}
        <div className="space-y-3">
          {['REQUESTED', 'INSPECTION_PENDING', 'INSPECTION_DONE'].includes(String(request.status).toUpperCase()) && (
            <button
              type="button"
              disabled={cancelMutation.isPending}
              onClick={() => {
                if (window.confirm('Are you sure you want to cancel this move-out request?')) {
                  cancelMutation.mutate();
                }
              }}
              className="w-full py-2.5 rounded-xl border border-destructive/30 text-destructive bg-destructive/5 font-semibold text-sm hover:bg-destructive/10 transition-colors"
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Request'}
            </button>
          )}

          {['SETTLEMENT_APPROVED', 'PAYMENT_PENDING'].includes(String(request.status).toUpperCase()) && (
            !showDisputeForm ? (
              <button
                type="button"
                onClick={() => setShowDisputeForm(true)}
                className="w-full py-2.5 rounded-xl border border-border bg-card font-semibold text-sm hover:bg-secondary/20 transition-colors text-foreground"
              >
                Raise a Dispute
              </button>
            ) : (
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <h3 className="text-sm font-semibold">Raise a Dispute</h3>
                
                <label className="block text-xs">
                  Dispute Type
                  <select
                    value={disputeType}
                    onChange={(e) => setDisputeType(e.target.value)}
                    className="mt-1 w-full px-2.5 py-2 rounded-lg border border-border bg-background"
                  >
                    <option value="DEDUCTIONS">Unfair Deductions / Damages</option>
                    <option value="RENT_DUES">Incorrect Rent Calculation</option>
                    <option value="DEPOSIT">Incorrect Deposit Amount</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>

                <label className="block text-xs">
                  Disputed Amount (₹) - optional
                  <input
                    type="number"
                    min="0"
                    placeholder="Amount you are contesting"
                    value={disputedAmount}
                    onChange={(e) => setDisputedAmount(e.target.value)}
                    className="mt-1 w-full px-2.5 py-2 rounded-lg border border-border bg-background"
                  />
                </label>

                <label className="block text-xs">
                  Description of Dispute
                  <textarea
                    rows={3}
                    placeholder="Provide details of why you disagree with the calculations..."
                    value={disputeDescription}
                    onChange={(e) => setDisputeDescription(e.target.value)}
                    className="mt-1 w-full px-2.5 py-2 rounded-lg border border-border bg-background"
                  />
                </label>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowDisputeForm(false)}
                    className="flex-1 py-2 rounded-lg border border-border font-medium text-xs text-muted-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={disputeMutation.isPending || !disputeDescription}
                    onClick={() => disputeMutation.mutate()}
                    className="flex-1 py-2 rounded-lg bg-destructive text-destructive-foreground font-semibold text-xs disabled:opacity-50"
                  >
                    {disputeMutation.isPending ? 'Submitting...' : 'Submit Dispute'}
                  </button>
                </div>
              </div>
            )
          )}

          {String(request.status).toUpperCase() === 'DISPUTED' && (
            <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive space-y-1">
              <p className="text-sm font-semibold">⚠️ Dispute Under Review</p>
              <p className="text-xs opacity-90">
                You have raised a dispute regarding the settlement calculations. The owner has been notified and is reviewing the details.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-accent/20 bg-card shadow-sm">
        <div className="bg-accent px-5 py-5 text-accent-foreground">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <DoorOpen className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">Exit workflow</p>
              <h1 className="text-2xl font-bold leading-tight">Request move-out</h1>
            </div>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-muted-foreground">
            Submit your planned exit date. Your owner will be notified immediately and can schedule inspection and settlement.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <label className="block text-sm font-medium text-foreground">
          Planned exit date
          <div className="relative mt-1">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="date"
              value={plannedDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setPlannedDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-3 text-sm"
            />
          </div>
        </label>
        <label className="block text-sm font-medium text-foreground">
          Reason
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full px-3 py-3 rounded-xl border border-border bg-background text-sm"
          >
            <option value="PERSONAL_REASONS">Personal reasons</option>
            <option value="JOB_RELOCATION">Job relocation</option>
            <option value="COURSE_COMPLETED">Course completed</option>
            <option value="TOO_EXPENSIVE">Too expensive</option>
            <option value="POOR_MAINTENANCE">Maintenance concerns</option>
            <option value="FOOD_QUALITY">Food quality</option>
            <option value="ROOMMATE_ISSUES">Roommate issues</option>
            <option value="BETTER_HOSTEL">Moving to another hostel</option>
            <option value="SAFETY_CONCERNS">Safety concerns</option>
            <option value="MOVING_CLOSER">Moving closer to college/work</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-foreground">
          Notes for owner <span className="font-normal text-muted-foreground">(optional)</span>
          <textarea
            rows={3}
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Share timing, inspection availability, or any special context..."
            className="mt-1 w-full resize-none rounded-xl border border-border bg-background px-3 py-3 text-sm"
          />
        </label>
      </section>

      <button
        type="button"
        disabled={!plannedDate || submitMutation.isPending}
        onClick={() => submitMutation.mutate()}
        className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] w-full py-3.5 rounded-xl bg-accent text-accent-foreground font-semibold shadow-lg shadow-accent/20 disabled:opacity-50"
      >
        {submitMutation.isPending ? 'Submitting request...' : 'Send move-out request'}
      </button>
    </div>
  );
}
