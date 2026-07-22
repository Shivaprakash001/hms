import { useState } from 'react';
import { CheckCircle, AlertCircle, ArrowRight, ArrowDown, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useIsMobile } from '@/app/components/ui/use-mobile';

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

interface SkippedObligation {
  obligation_id: string;
  type: string;
  label: string;
  outstanding: number;
  reason: string;
}

interface SettlementExplanation {
  text: string;
  obligation_id: string | null;
  reason: string;
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
  skipped_obligations?: SkippedObligation[];
  explanation?: SettlementExplanation[];
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

export function SettlementPreview({ plan, amount, onConfirm, onBack, isRecording }: SettlementPreviewProps) {
  const isMobile = useIsMobile();
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const activeAllocations = plan.allocations.filter((a) => a.allocated > 0);
  const skipped = plan.skipped_obligations ?? [];
  const allocatedTotal = plan.total_to_settle;
  const hiddenCount = activeAllocations.length + skipped.length;

  const nodes = [
    { label: 'Received', value: amount, tone: 'text-foreground' },
    { label: 'Allocated', value: allocatedTotal, tone: 'text-emerald-600', subtext: activeAllocations.length > 0 ? `${activeAllocations.length} charge${activeAllocations.length === 1 ? '' : 's'}` : undefined },
    { label: 'Future Credit', value: plan.future_credit, tone: 'text-blue-600' },
    { label: 'Remaining Due', value: plan.remaining_outstanding, tone: plan.remaining_outstanding > 0 ? 'text-rose-600' : 'text-foreground' },
  ];

  const Connector = isMobile ? ArrowDown : ArrowRight;

  return (
    <div className="space-y-4">
      {/* Money-flow visualization: Received -> Allocated -> Future Credit -> Remaining Due */}
      <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} items-stretch gap-2`}>
        {nodes.map((node, i) => (
          <div key={node.label} className={`flex ${isMobile ? 'flex-col' : 'flex-row'} items-center gap-2 flex-1`}>
            <div className="flex-1 w-full rounded-xl border border-border bg-card p-3 text-center">
              <p className={`text-base font-extrabold ${node.tone}`}>{fmt(node.value)}</p>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-0.5">{node.label}</p>
              {node.subtext && <p className="text-[10px] text-muted-foreground mt-0.5">{node.subtext}</p>}
            </div>
            {i < nodes.length - 1 && <Connector className="w-4 h-4 text-muted-foreground shrink-0" />}
          </div>
        ))}
      </div>

      {/* Allocation breakdown — everything visible, nothing hidden */}
      {hiddenCount > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setBreakdownOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:bg-secondary/40 transition-colors"
          >
            <span>View allocation breakdown</span>
            {breakdownOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {breakdownOpen && (
            <div className="divide-y divide-border/50 border-t border-border">
              {activeAllocations.map((alloc) => {
                const style = RESULT_STYLES[alloc.result] || RESULT_STYLES.UNCHANGED;
                return (
                  <div key={alloc.obligation_id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{alloc.label}</p>
                      <p className="text-[11px] text-muted-foreground">Outstanding: {fmt(alloc.outstanding)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-foreground">{fmt(alloc.allocated)}</span>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>{style.label}</span>
                    </div>
                  </div>
                );
              })}
              {skipped.map((s) => (
                <div key={s.obligation_id} className="flex items-center justify-between px-4 py-3 opacity-70">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{s.label}</p>
                    <p className="text-[11px] text-muted-foreground">Skipped: {s.reason.replace(/_/g, ' ').toLowerCase()}</p>
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground shrink-0">{fmt(s.outstanding)}</span>
                </div>
              ))}
            </div>
          )}
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
          {isRecording ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          <span>Confirm</span>
        </button>
      </div>
    </div>
  );
}
