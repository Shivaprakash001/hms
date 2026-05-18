const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-amber-600',
  PARTIAL: 'text-amber-600',
  PAID: 'text-emerald-600',
  WAIVED: 'text-muted-foreground',
};

interface Obligation {
  id?: string;
  rent_month?: string;
  amount?: number;
  late_fee?: number;
  total_payable?: number;
  paid_amount?: number;
  status?: string;
  due_date?: string;
}

interface Props {
  obligations: Obligation[];
  onRecordPayment?: (obligationId: string) => void;
}

export function RentObligationList({ obligations, onRecordPayment }: Props) {
  const grouped = obligations.reduce<Record<string, Obligation[]>>((acc, o) => {
    const month = o.rent_month ?? 'Unknown';
    if (!acc[month]) acc[month] = [];
    acc[month].push(o);
    return acc;
  }, {});

  const months = Object.keys(grouped).sort().reverse();

  if (months.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No rent obligations</p>;
  }

  return (
    <div className="space-y-4">
      {months.map((month) => (
        <div key={month}>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">{month}</h4>
          <div className="space-y-2">
            {grouped[month].map((o, i) => {
              const status = String(o.status ?? 'PENDING').toUpperCase();
              const id = o.id ?? `${month}-${i}`;
              return (
                <div
                  key={id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {fmt(Number(o.amount ?? 0))}
                      {Number(o.late_fee ?? 0) > 0 && (
                        <span className="text-muted-foreground"> + {fmt(Number(o.late_fee))} late</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Due {o.due_date ? new Date(o.due_date).toLocaleDateString('en-IN') : '—'} · Paid{' '}
                      {fmt(Number(o.paid_amount ?? 0))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-semibold ${STATUS_COLORS[status] ?? ''}`}>
                      {status}
                    </span>
                    {onRecordPayment && ['PENDING', 'PARTIAL'].includes(status) && o.id && (
                      <button
                        type="button"
                        onClick={() => onRecordPayment(o.id!)}
                        className="text-xs font-medium text-accent px-2 py-1 rounded-lg bg-accent/10"
                      >
                        Pay
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
