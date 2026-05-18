const STEPS = [
  'REQUESTED',
  'INSPECTION_PENDING',
  'INSPECTION_DONE',
  'SETTLEMENT_APPROVED',
  'PAYMENT_PENDING',
  'COMPLETED',
] as const;

interface Props {
  request: Record<string, unknown>;
  hostelId: string;
}

export function MoveOutStepper({ request }: Props) {
  const current = String(request.status ?? 'REQUESTED').toUpperCase();
  const currentIdx = STEPS.indexOf(current as (typeof STEPS)[number]);

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

      <ol className="space-y-2">
        {STEPS.map((step, i) => {
          const done = currentIdx >= 0 && i <= currentIdx;
          const active = step === current;
          return (
            <li
              key={step}
              className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
                active
                  ? 'border-accent bg-accent/5'
                  : done
                    ? 'border-border bg-card'
                    : 'border-border opacity-50'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  done ? 'bg-accent text-accent-foreground' : 'bg-secondary'
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

