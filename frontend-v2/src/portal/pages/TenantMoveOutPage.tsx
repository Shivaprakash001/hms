import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { moveOutService } from '@features/move-out/api';
import { useTenantDashboard } from '@features/tenant-portal/hooks/useTenantDashboard';
import { MoveOutStepper } from '@features/tenants/components/moveout/MoveOutStepper';

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

export function TenantMoveOutPage() {
  const [plannedDate, setPlannedDate] = useState('');
  const [reason, setReason] = useState('PERSONAL_REASONS');
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
      }),
    onSuccess: () => {
      toast.success('Move-out request submitted');
      refetch();
    },
    onError: (e: Error & { response?: { data?: { error?: { message?: string } } } }) =>
      toast.error(e?.response?.data?.error?.message ?? 'Failed to submit'),
  });

  const request = (timeline as Record<string, unknown>)?.request ?? timeline;
  const settlement = (timeline as Record<string, unknown>)?.settlement as
    | Record<string, unknown>
    | undefined;

  const cancelMutation = useMutation({
    mutationFn: () => moveOutService.cancelRequest(request.id),
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
      moveOutService.dispute(request.id, {
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

  if (request && typeof request === 'object') {
    const deposit = Number(advance?.balance ?? settlement?.deposit_amount ?? 0);
    const pendingRent = Number(dues?.total_due ?? settlement?.pending_rent ?? 0);
    const damages = Number(settlement?.damages_amount ?? settlement?.damage_charges ?? 0);
    const refund = Number(
      settlement?.refund_amount ?? Math.max(0, deposit - pendingRent - damages)
    );

    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-foreground">Move-out</h1>
        <MoveOutStepper request={request as Record<string, unknown>} hostelId="" />

        {(deposit > 0 || pendingRent > 0 || settlement) && (
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Settlement preview</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deposit</span>
                <span>{fmt(deposit)}</span>
              </div>
              {pendingRent > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pending rent</span>
                  <span className="text-destructive">−{fmt(pendingRent)}</span>
                </div>
              )}
              {damages > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Damages</span>
                  <span className="text-destructive">−{fmt(damages)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-border font-bold">
                <span>Refund amount</span>
                <span className="text-accent">{fmt(refund)}</span>
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
      <h1 className="text-xl font-bold text-foreground">Request move-out</h1>
      <p className="text-sm text-muted-foreground">
        Submit your planned exit date. Your owner will schedule inspection and settlement.
      </p>
      <label className="block text-sm">
        Planned exit date
        <input
          type="date"
          value={plannedDate}
          onChange={(e) => setPlannedDate(e.target.value)}
          className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-background"
        />
      </label>
      <label className="block text-sm">
        Reason
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-background"
        >
          <option value="PERSONAL_REASONS">Personal reasons</option>
          <option value="JOB_RELOCATION">Job relocation</option>
          <option value="COURSE_COMPLETED">Course completed</option>
          <option value="OTHER">Other</option>
        </select>
      </label>
      <button
        type="button"
        disabled={!plannedDate || submitMutation.isPending}
        onClick={() => submitMutation.mutate()}
        className="w-full py-3 rounded-xl bg-accent text-accent-foreground font-semibold disabled:opacity-50"
      >
        Submit request
      </button>
    </div>
  );
}
