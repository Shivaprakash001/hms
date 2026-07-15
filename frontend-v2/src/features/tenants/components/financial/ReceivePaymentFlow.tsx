import { useState, useCallback } from 'react';
import { X, Banknote, ArrowRight, Loader2, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { hmsToast } from '@lib/toast';
import api from '@lib/api-client';
import { SettlementPreview } from './SettlementPreview';

interface ReceivePaymentFlowProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  hostelId: string;
  tenantName?: string;
  onSuccess: () => void;
}

type Step = 'amount' | 'suggested' | 'preview';

interface SettlementPlanData {
  allocations: any[];
  future_credit: number;
  total_outstanding: number;
  total_to_settle: number;
  remaining_outstanding: number;
  minimum_allowed: number;
  payment_accepted: boolean;
  rejection_reason: string | null;
  warnings: string[];
  summary: string;
  mode?: string;
}

/**
 * ReceivePaymentFlow — 3-step payment recording workflow
 *
 * Step 1: Amount Entry
 * Step 2: Suggested Settlement (auto-calculated) → "Customize" link (future)
 * Step 3: Final Preview → Record Payment
 */
export function ReceivePaymentFlow({
  isOpen,
  onClose,
  tenantId,
  hostelId,
  tenantName,
  onSuccess,
}: ReceivePaymentFlowProps) {
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [plan, setPlan] = useState<SettlementPlanData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [transactionRef, setTransactionRef] = useState('');

  const reset = useCallback(() => {
    setStep('amount');
    setAmount('');
    setPlan(null);
    setIsLoading(false);
    setIsRecording(false);
    setPaymentMethod('CASH');
    setTransactionRef('');
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!isOpen) return null;

  // ── Step 1 → Step 2: Fetch suggested settlement ────────────────────────────
  const handleAmountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid positive amount');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.get(`/payments/settlement-preview?tenant_id=${tenantId}&amount=${numAmount}&hostelId=${hostelId}`);
      const planData = res.data || res;
      setPlan(planData);
      setStep('suggested');
    } catch (err: any) {
      hmsToast.error(err, 'Settlement Preview');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2 → Step 3: Confirm allocation ────────────────────────────────────
  const handleProceedToPreview = () => {
    setStep('preview');
  };

  // ── Step 3: Record the payment ─────────────────────────────────────────────
  const handleRecordPayment = async () => {
    const numAmount = parseFloat(amount);
    if (!plan || isNaN(numAmount)) return;

    setIsRecording(true);
    try {
      await api.post('/payments/record-offline', {
        tenant_id: tenantId,
        hostel_id: hostelId,
        amount: numAmount,
        method: paymentMethod,
        transaction_ref: transactionRef.trim() || undefined,
      });

      toast.success(`Payment of ₹${numAmount.toLocaleString('en-IN')} recorded successfully`);
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      hmsToast.error(err, 'Record Payment');
    } finally {
      setIsRecording(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
        <button
          type="button"
          onClick={handleClose}
          disabled={isRecording}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border pb-4 mb-4">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Receive Payment</h3>
            <p className="text-xs text-muted-foreground">
              {tenantName ? `Recording for ${tenantName}` : 'Record an incoming payment'}
            </p>
          </div>
        </div>

        {/* Step Progress */}
        <div className="flex items-center gap-1 mb-5">
          {(['amount', 'suggested', 'preview'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= ['amount', 'suggested', 'preview'].indexOf(step)
                    ? 'bg-accent'
                    : 'bg-border'
                }`}
                style={{ minWidth: 60 }}
              />
            </div>
          ))}
        </div>

        {/* ── Step 1: Amount Entry ─────────────────────────────────────────── */}
        {step === 'amount' && (
          <form onSubmit={handleAmountSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Amount Received (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                required
                type="number"
                min="1"
                step="any"
                autoFocus
                placeholder="e.g. 5000"
                disabled={isLoading}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-input bg-background h-12 px-4 text-lg font-bold placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  disabled={isLoading}
                  className="w-full rounded-xl border border-input bg-background h-10 px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Reference ID
                </label>
                <input
                  type="text"
                  placeholder="Optional"
                  disabled={isLoading}
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background h-10 px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !amount}
              className="w-full h-10 rounded-xl bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 active:scale-98 transition-transform flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              <span>See Suggested Settlement</span>
            </button>
          </form>
        )}

        {/* ── Step 2: Suggested Settlement ─────────────────────────────────── */}
        {step === 'suggested' && plan && (
          <div className="space-y-4">
            <SettlementPreview
              plan={plan}
              amount={parseFloat(amount)}
              onConfirm={handleRecordPayment}
              onBack={() => setStep('amount')}
              isRecording={isRecording}
            />
          </div>
        )}

        {/* ── Step 3: Final Preview (reused from suggested for now) ────────── */}
        {step === 'preview' && plan && (
          <SettlementPreview
            plan={plan}
            amount={parseFloat(amount)}
            onConfirm={handleRecordPayment}
            onBack={() => setStep('suggested')}
            isRecording={isRecording}
          />
        )}
      </div>
    </div>
  );
}
