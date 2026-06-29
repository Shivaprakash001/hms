import { useState, useMemo } from 'react';
import { Download, Share2, Info, History, CircleDollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;
const fmtMonth = (value?: string) => {
  if (!value) return 'Unknown';
  if (!Number.isNaN(new Date(value).getTime())) {
    return new Date(value).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  }
  return value;
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-rose-500/10 text-rose-600 border-rose-500/25',
  PARTIAL: 'bg-amber-500/10 text-amber-600 border-amber-500/25',
  PAID: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/25',
  WAIVED: 'bg-secondary text-muted-foreground border-border',
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
  payments?: { id: string; amount_paid: number; payment_date: string; method: string; transaction_id: string }[];
}

interface Props {
  obligations: Obligation[];
  onRecordPayment?: (obligationId: string) => void;
  onSetupBilling?: () => void;
  onDownloadReceipt?: (paymentId: string) => void;
  onSelectObligation?: (obligation: Obligation) => void;
  hasActivePlan?: boolean;
}

export function RentObligationList({
  obligations,
  onRecordPayment,
  onSetupBilling,
  onDownloadReceipt,
  onSelectObligation,
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

  const handleSharePaymentLink = (o: Obligation) => {
    const amount = Number(o.outstanding ?? o.amount ?? 0);
    const monthLabel = fmtMonth(o.billing_period_start ?? o.rent_month);
    const message = `Hi, your rent of ${fmt(amount)} for ${monthLabel} is due. Please make payment via this link: https://hms.sriadithyahostels.in/pay/${o.id || o.obligation_id}`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    toast.success('Payment link composed in WhatsApp');
  };

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
              const status = String(o.status ?? 'PENDING').toUpperCase();
              const id = o.id ?? o.obligation_id ?? `${group.label}-${idx}`;
              const isExpanded = expandedId === id;
              
              const billedAmount = Number(o.total_payable ?? o.amount ?? 0);
              const rawPaidAmount = Number(o.paid_amount ?? o.paid ?? 0);
              const paidAmount = status === 'PAID' && rawPaidAmount <= 0 ? billedAmount : rawPaidAmount;
              const displayAmount = Number(o.outstanding ?? o.amount ?? 0);

              return (
                <div
                  key={id}
                  className={`rounded-2xl border transition-all duration-200 ${
                    isExpanded 
                      ? 'border-accent bg-accent/5 dark:bg-accent/10 shadow-sm'
                      : 'border-border bg-card hover:bg-muted/10'
                  }`}
                >
                  {/* Primary Row */}
                  <div
                    onClick={() => {
                      toggleExpand(id);
                      if (onSelectObligation) onSelectObligation(o);
                    }}
                    className="flex items-center justify-between gap-3 p-3.5 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <span>{fmt(displayAmount)}</span>
                        {Number(o.late_fee ?? 0) > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-500 font-semibold">
                            +{fmt(Number(o.late_fee))} late fee
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Due: {o.due_date ? new Date(o.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'} · Type: {o.type ? String(o.type).replaceAll('_', ' ') : 'Rent'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${STATUS_COLORS[status] ?? ''}`}>
                        {status}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Actions & History */}
                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 pt-1.5 border-t border-border/60 space-y-3.5 animate-in slide-in-from-top-1 duration-150">
                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {onRecordPayment && ['PENDING', 'PARTIAL'].includes(status) && (
                          <button
                            type="button"
                            onClick={() => onRecordPayment(id)}
                            className="flex-1 py-1.5 rounded-xl bg-accent text-accent-foreground text-xs font-semibold hover:bg-accent/90 active:scale-95 transition-transform flex items-center justify-center gap-1"
                          >
                            <CircleDollarSign className="w-3.5 h-3.5" />
                            <span>Collect Payment</span>
                          </button>
                        )}
                        {['PENDING', 'PARTIAL'].includes(status) && (
                          <button
                            type="button"
                            onClick={() => handleSharePaymentLink(o)}
                            className="flex-1 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-950/30 active:scale-95 transition-transform flex items-center justify-center gap-1"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Share Payment Link</span>
                          </button>
                        )}
                        {status === 'PAID' && o.payments && o.payments.length > 0 && onDownloadReceipt && (
                          <button
                            type="button"
                            onClick={() => {
                              const pId = o.payments?.[0]?.id;
                              if (pId) onDownloadReceipt(pId);
                            }}
                            className="flex-1 py-1.5 rounded-xl bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 active:scale-95 transition-transform flex items-center justify-center gap-1 border border-border"
                          >
                            <Download className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>Download Receipt</span>
                          </button>
                        )}
                      </div>

                      {/* Detailed Breakdown */}
                      <div className="bg-secondary/50 rounded-xl p-3 border border-border/40 space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider pb-1 border-b border-border/40">
                          <Info className="w-3.5 h-3.5" />
                          <span>Detailed Breakdown</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Original Rent Amount:</span>
                          <span className="font-semibold text-foreground">{fmt(billedAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Late Fees Charged:</span>
                          <span className="font-semibold text-foreground">{fmt(Number(o.late_fee ?? 0))}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Amount Already Paid:</span>
                          <span className="font-semibold text-emerald-600">{fmt(paidAmount)}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-border/40 font-bold">
                          <span className="text-foreground">Remaining Outstanding:</span>
                          <span className="text-rose-600">{fmt(displayAmount)}</span>
                        </div>
                      </div>

                      {/* Payment attempts / reminders logs */}
                      {o.payments && o.payments.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            <History className="w-3.5 h-3.5" />
                            <span>Transaction History</span>
                          </div>
                          <div className="space-y-1 max-h-[100px] overflow-y-auto">
                            {o.payments.map((p, pIdx) => (
                              <div
                                key={p.id || pIdx}
                                className="flex justify-between items-center text-[11px] text-muted-foreground py-1 border-b border-border/20 last:border-0"
                              >
                                <div className="flex flex-col">
                                  <span className="font-semibold text-foreground">
                                    {fmt(p.amount_paid)} paid via {p.method}
                                  </span>
                                  {p.transaction_id && (
                                    <span className="text-[10px] text-muted-foreground">
                                      Ref: {p.transaction_id}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px]">
                                  {new Date(p.payment_date).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
