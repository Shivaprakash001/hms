import { CheckCircle, AlertCircle, ArrowRight, Wallet, CreditCard } from 'lucide-react';

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

interface Allocation {
  obligation_id: string;
  type: string;
  tier: string;
  label: string;
  rent_month: string | null;
  amount_due: number;
  outstanding: number;
  allocated: number;
  result: 'PAID' | 'PARTIAL' | 'UNCHANGED';
}

interface SettlementPlanData {
  allocations: Allocation[];
  future_credit: number;
  total_outstanding: number;
  total_to_settle: number;
  remaining_outstanding: number;
  minimum_allowed: number;
  payment_accepted: boolean;
  rejection_reason: string | null;
  warnings: string[];
  summary: string;
}

interface SettlementPreviewProps {
  plan: SettlementPlanData;
  amount: number;
  onConfirm: () => void;
  onBack: () => void;
  isRecording: boolean;
}

const RESULT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  PAID: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'Fully Paid' },
  PARTIAL: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Partial' },
  UNCHANGED: { bg: 'bg-neutral-500/10', text: 'text-neutral-500', label: 'Unchanged' },
};

export function SettlementPreview({
  plan,
  amount,
  onConfirm,
  onBack,
  isRecording,
}: SettlementPreviewProps) {
  const activeAllocations = plan.allocations.filter(a => a.allocated > 0);

  return (
    <div className="space-y-4">
      {/* Amount Summary */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-accent/5 border border-accent/20">
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-accent" />
          <span className="text-sm font-bold text-foreground">Payment Amount</span>
        </div>
        <span className="text-lg font-bold text-accent">{fmt(amount)}</span>
      </div>

      {/* Allocation Breakdown */}
      {activeAllocations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
            Allocation Breakdown
          </h4>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {activeAllocations.map((alloc, idx) => {
              const style = RESULT_STYLES[alloc.result] || RESULT_STYLES.UNCHANGED;
              return (
                <div
                  key={alloc.obligation_id}
                  className={`flex items-center justify-between px-4 py-3 ${
                    idx > 0 ? 'border-t border-border/50' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{alloc.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Outstanding: {fmt(alloc.outstanding)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-foreground">{fmt(alloc.allocated)}</span>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Future Credit */}
      {plan.future_credit > 0 && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Future Rent Credit</span>
          </div>
          <span className="text-sm font-bold text-blue-600">{fmt(plan.future_credit)}</span>
        </div>
      )}

      {/* Remaining Outstanding */}
      {plan.remaining_outstanding > 0 && (
        <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
          <span>Remaining outstanding after payment:</span>
          <span className="font-semibold text-rose-600">{fmt(plan.remaining_outstanding)}</span>
        </div>
      )}

      {/* Warnings */}
      {plan.warnings.length > 0 && (
        <div className="space-y-1">
          {plan.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
              <span className="text-xs text-amber-700 dark:text-amber-400">{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Rejection */}
      {!plan.payment_accepted && plan.rejection_reason && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
          <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
          <span className="text-sm text-rose-700 dark:text-rose-400">{plan.rejection_reason}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isRecording}
          className="flex-1 h-10 rounded-xl border border-input bg-background text-sm font-semibold hover:bg-accent hover:text-accent-foreground active:scale-98 transition-transform disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!plan.payment_accepted || isRecording}
          className="flex-1 h-10 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 active:scale-98 transition-transform flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {isRecording ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          <span>Record Payment</span>
        </button>
      </div>
    </div>
  );
}
