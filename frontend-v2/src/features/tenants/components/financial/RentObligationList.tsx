import { useState, useMemo } from 'react';
import { ObligationCard, type Obligation } from './ObligationCard';

const fmtMonth = (value?: string) => {
  if (!value) return 'Unknown';
  if (!Number.isNaN(new Date(value).getTime())) {
    return new Date(value).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  }
  return value;
};

interface Props {
  obligations: Obligation[];
  onRecordPayment?: (obligationId: string) => void;
  onSetupBilling?: () => void;
  onDownloadReceipt?: (paymentId: string) => void;
  onSelectObligation?: (obligation: Obligation) => void;
  onWaiveObligation?: (obligation: Obligation) => void;
  onCancelObligation?: (obligation: Obligation) => void;
  onEditObligation?: (obligation: Obligation) => void;
  onDuplicateObligation?: (obligation: Obligation) => void;
  onViewHistory?: (obligation: Obligation) => void;
  hasActivePlan?: boolean;
}

export function RentObligationList({
  obligations,
  onRecordPayment,
  onSetupBilling,
  onDownloadReceipt,
  onSelectObligation,
  onWaiveObligation,
  onCancelObligation,
  onEditObligation,
  onDuplicateObligation,
  onViewHistory,
  hasActivePlan,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const byMonth = useMemo(() => {
    const grouped = obligations.reduce<Record<string, { label: string; sort: number; obligations: Obligation[] }>>((acc, o) => {
      const periodValue = o.billing_period_start ?? o.rent_month;
      const label = o.installment_label ?? fmtMonth(periodValue);
      const sort = periodValue && !Number.isNaN(new Date(periodValue).getTime())
        ? new Date(periodValue).getTime()
        : 0;
      if (!acc[label]) acc[label] = { label, sort, obligations: [] };
      acc[label].obligations.push(o);
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => b.sort - a.sort || b.label.localeCompare(a.label));
  }, [obligations]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (byMonth.length === 0) {
    if (hasActivePlan) {
      return (
        <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-center shadow-sm">
          <p className="text-sm font-semibold text-foreground">No dues generated yet.</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Dues will appear here once the billing cycle begins or a charge is recorded.
          </p>
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-center shadow-sm">
        <p className="text-sm font-semibold text-foreground">This tenant has no active rent plan.</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Assign a monthly rent cycle to start tracking dues automatically.
        </p>
        {onSetupBilling && (
          <button
            type="button"
            onClick={onSetupBilling}
            className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground active:scale-98 transition-transform"
          >
            Set up billing →
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1 scrollbar-hide">
      {byMonth.map((group) => (
        <div key={group.label} className="space-y-2">
          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1.5">
            {group.label}
          </h4>

          <div className="space-y-2">
            {group.obligations.map((o, idx) => {
              const id = o.id ?? o.obligation_id ?? `${group.label}-${idx}`;
              return (
                <ObligationCard
                  key={id}
                  obligation={o}
                  isExpanded={expandedId === id}
                  onToggle={() => {
                    toggleExpand(id);
                    if (onSelectObligation) onSelectObligation(o);
                  }}
                  onRecordPayment={onRecordPayment}
                  onWaiveObligation={onWaiveObligation}
                  onCancelObligation={onCancelObligation}
                  onEditObligation={onEditObligation}
                  onDuplicateObligation={onDuplicateObligation}
                  onViewHistory={onViewHistory}
                  onDownloadReceipt={onDownloadReceipt}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
