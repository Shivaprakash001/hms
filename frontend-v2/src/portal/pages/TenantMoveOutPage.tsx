import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { moveOutService } from '@features/move-out/api';
import { MoveOutStepper } from '@features/tenants/components/moveout/MoveOutStepper';

export function TenantMoveOutPage() {
  const [plannedDate, setPlannedDate] = useState('');
  const [reason, setReason] = useState('PERSONAL_REASONS');

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

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (request && typeof request === 'object') {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-foreground">Move-out status</h1>
        <MoveOutStepper request={request as Record<string, unknown>} hostelId="" />
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
