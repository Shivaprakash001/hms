import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-amber-600',
  PARTIAL: 'text-amber-600',
  PAID: 'text-emerald-600',
  WAIVED: 'text-muted-foreground',
};

interface Obligation {
  id?: string;
  obligation_id?: string;
  rent_month?: string;
  billing_period_start?: string;
  billing_period_end?: string;
  installment_label?: string;
  type?: string;
  amount?: number;
  late_fee?: number;
  total_payable?: number;
  paid_amount?: number;
  paid?: number;
  outstanding?: number;
  status?: string;
  due_date?: string;
}

interface Props {
  obligations: Obligation[];
  onRecordPayment?: (obligationId: string) => void;
  onSetupBilling?: () => void;
}

export function RentObligationList({ obligations, onRecordPayment, onSetupBilling }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { months, rows } = useMemo(() => {
    const byMonth = obligations.reduce<Record<string, Obligation[]>>((acc, o) => {
      const month = o.installment_label ?? o.billing_period_start ?? o.rent_month ?? 'Unknown';
      if (!acc[month]) acc[month] = [];
      acc[month].push(o);
      return acc;
    }, {});
    const sortedMonths = Object.keys(byMonth).sort().reverse();
    const flatRows = sortedMonths.flatMap((month) => [
      { kind: 'month' as const, month },
      ...byMonth[month].map((obligation, index) => ({
        kind: 'obligation' as const,
        month,
        obligation,
        index,
      })),
    ]);
    return { months: sortedMonths, rows: flatRows };
  }, [obligations]);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => rows[index]?.kind === 'month' ? 28 : 84,
    overscan: 8,
  });

  if (months.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-5 text-center">
        <p className="text-sm font-semibold text-foreground">This tenant has no active rent plan.</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Assign a monthly rent cycle to start tracking dues automatically.
        </p>
        {onSetupBilling && (
          <button
            type="button"
            onClick={onSetupBilling}
            className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
          >
            Set up billing →
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="max-h-[560px] overflow-auto">
      <div className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const item = rows[virtualRow.index];
          if (item.kind === 'month') {
            return (
              <h4
                key={item.month}
                className="absolute left-0 right-0 text-xs font-semibold text-muted-foreground uppercase"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                {item.month}
              </h4>
            );
          }

          const o = item.obligation;
          const i = item.index;
          const status = String(o.status ?? 'PENDING').toUpperCase();
          const id = o.id ?? o.obligation_id ?? `${item.month}-${i}`;
          const paidAmount = Number(o.paid_amount ?? o.paid ?? 0);
          const displayAmount = Number(o.outstanding ?? o.amount ?? 0);
          return (
            <div
              key={id}
              className="absolute left-0 right-0 flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {fmt(displayAmount)}
                      {Number(o.late_fee ?? 0) > 0 && (
                        <span className="text-muted-foreground"> + {fmt(Number(o.late_fee))} late</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Due {o.due_date ? new Date(o.due_date).toLocaleDateString('en-IN') : '—'} · Paid{' '}
                      {fmt(paidAmount)}
                      {o.type ? ` · ${String(o.type).replaceAll('_', ' ')}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-semibold ${STATUS_COLORS[status] ?? ''}`}>
                      {status}
                    </span>
                    {onRecordPayment && ['PENDING', 'PARTIAL'].includes(status) && id && (
                      <button
                        type="button"
                        onClick={() => onRecordPayment(id)}
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
  );
}
