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
