const STEPS = [
  'REQUESTED',
  'SETTLEMENT_PENDING',
  'APPROVED',
  'VACATED',
  'COMPLETED',
] as const;

interface Props {
  request: Record<string, unknown>;
  hostelId: string;
}

export function MoveOutStepper({ request }: Props) {
  const current = String(request.status ?? 'REQUESTED').toUpperCase();
  const isRejected = current === 'REJECTED';
  const currentIdx = isRejected ? -1 : STEPS.indexOf(current as (typeof STEPS)[number]);

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-border bg-card">
        <p className="text-sm text-muted-foreground">Planned exit</p>
        <p className="font-semibold">
          {request.planned_exit_date
            ? new Date(String(request.planned_exit_date)).toLocaleDateString('en-IN')
            : '—'}
        </p>
        {request.refund_amount != null && (
          <p className="text-sm mt-2">
            Refund: ₹{Number(request.refund_amount).toLocaleString('en-IN')}
          </p>
        )}
      </div>

      {isRejected && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold">
          This move-out request has been rejected.
        </div>
      )}

      <ol className="space-y-2">
        {STEPS.map((step, i) => {
          const done = currentIdx >= 0 && i <= currentIdx;
          const active = step === current;
          return (
            <li
              key={step}
              className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
                active
                  ? 'border-[#243A72] bg-[#243A72]/5'
                  : done
                    ? 'border-border bg-card'
                    : 'border-border opacity-50'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  done ? 'bg-[#243A72] text-white' : 'bg-secondary'
                }`}
              >
                {i + 1}
              </span>
              <span className="font-medium">{step.replace(/_/g, ' ')}</span>
            </li>
          );
        })}
      </ol>

      {request.deduction_notes && (
        <p className="text-xs text-muted-foreground p-3 rounded-lg bg-secondary">
          {String(request.deduction_notes)}
        </p>
      )}
    </div>
  );
}

