import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle,
  Copy,
  Loader2,
  Send,
  ShieldCheck,
  Smartphone,
  Lock,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { tenantPortalApi } from '@features/tenant-portal/api';
import { QrCodeImage } from '@/portal/components/QrCodeImage';
import { getApiErrorMessage, type PayableObligation } from '@/portal/utils/payableObligations';

const POLL_INTERVAL_MS = 4000;
const TERMINAL_STATUSES = ['SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED', 'PENDING_VERIFICATION'];

const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

const fmtMonth = (cycle?: string) => {
  if (!cycle) return 'Current cycle';
  const d = new Date(cycle);
  if (Number.isNaN(d.getTime())) return cycle;
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

interface PaymentAttempt {
  id?: string;
  status?: string;
  checkout_url?: string;
  upi_intent_url?: string;
  qr_payload?: string;
  gateway_txn_id?: string;
  merchant_txn_id?: string;
  provider?: string;
  raw_response?: any;
  settlement_breakdown?: any;
}

interface Props {
  open: boolean;
  onClose: () => void;
  amount: number;
  obligationIds: string[];
  paymentType?: 'RENT' | 'ADVANCE';
  paymentContext?: PayableObligation[];
  onSuccess?: () => void;
  allInstallments?: any[];
  tenantId?: string;
  hostelId?: string;
}

export function TenantPaymentModal({
  open,
  onClose,
  amount,
  obligationIds,
  paymentType = 'RENT',
  paymentContext = [],
  onSuccess,
  allInstallments = [],
  tenantId,
  hostelId,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState<PaymentAttempt | null>(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [upiReference, setUpiReference] = useState('');
  const [submittingRef, setSubmittingRef] = useState(false);
  const [step, setStep] = useState<'init' | 'pay' | 'reference' | 'done'>('init');

  // Tabs for Rent Payment: 'due' (FIFO Outstanding Today) or 'advance' (Add Advance Credit)
  const [activeTab, setActiveTab] = useState<'due' | 'advance'>('due');
  
  // Selected single installment timeline ID
  const [selectedTimelineIds, setSelectedTimelineIds] = useState<string[]>([]);
  
  // Custom amount state (used for advance credit top-ups)
  const [customAmount, setCustomAmount] = useState<string>('');

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setAttempt(null);
      setStatus('idle');
      setError('');
      setCopied(false);
      setUpiReference('');
      setSubmittingRef(false);
      setStep('init');
      setCustomAmount('');
      setSelectedTimelineIds([]);
    }
  }, [open]);

  // Group payable installments
  const payableInstallments = useMemo(() => {
    if (!allInstallments) return [];
    return allInstallments.filter((inst) => inst.remaining > 0);
  }, [allInstallments]);

  // Identify the oldest outstanding installment
  const oldestOutstandingInstallment = useMemo(() => {
    return payableInstallments[0] || null;
  }, [payableInstallments]);

  // Default tab and amount logic when modal opens
  useEffect(() => {
    if (open) {
      if (paymentType === 'RENT') {
        if (payableInstallments.length > 0) {
          setActiveTab('due');
        } else {
          setActiveTab('advance');
        }
        setCustomAmount(amount > 0 ? String(amount) : '');
      } else {
        setActiveTab('advance');
      }
    }
  }, [open, paymentType, amount, payableInstallments.length]);

  // Auto-select the oldest unpaid installment when activeTab is 'due'
  useEffect(() => {
    if (open && paymentType === 'RENT') {
      if (activeTab === 'due' && oldestOutstandingInstallment) {
        setSelectedTimelineIds([oldestOutstandingInstallment.timeline_id || oldestOutstandingInstallment.id]);
      } else {
        setSelectedTimelineIds([]);
      }
    }
  }, [open, activeTab, oldestOutstandingInstallment, paymentType]);

  const selectedObligationIds = useMemo(() => {
    return payableInstallments
      .filter((inst) => selectedTimelineIds.includes(inst.timeline_id || inst.id))
      .flatMap((inst) => inst.obligations?.map((o: any) => o.obligation_id) || []);
  }, [payableInstallments, selectedTimelineIds]);

  // Mode B: Settlement Preview Query (React Query)
  const parsedCustomAmount = Number(customAmount) || 0;
  const previewEnabled = open && activeTab === 'advance' && paymentType === 'RENT' && Boolean(tenantId) && parsedCustomAmount > 0 && Boolean(hostelId);

  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ['tenant-settlement-preview', tenantId, parsedCustomAmount, hostelId],
    queryFn: () => tenantPortalApi.settlementPreview(tenantId!, parsedCustomAmount, hostelId!),
    enabled: previewEnabled,
    staleTime: 5000,
    retry: false,
  });

  const displayAmount = useMemo(() => {
    if (paymentType === 'ADVANCE') return amount;
    if (activeTab === 'advance') return parsedCustomAmount;
    return oldestOutstandingInstallment?.remaining || 0;
  }, [paymentType, activeTab, amount, parsedCustomAmount, oldestOutstandingInstallment]);

  useEffect(() => {
    if (!open || !attempt?.id || TERMINAL_STATUSES.includes(status)) return undefined;

    const timer = window.setInterval(async () => {
      try {
        const latest = await tenantPortalApi.getAttempt(attempt.id!);
        setAttempt((current) => ({ ...current, ...latest }));
        setStatus(String(latest.status ?? ''));
        if (latest.status === 'SUCCESS') {
          setStep('done');
          onSuccess?.();
        }
      } catch {
        /* keep polling */
      }
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [attempt?.id, open, onSuccess, status]);

  const canRetry = useMemo(() => ['FAILED', 'EXPIRED', 'CANCELLED'].includes(status), [status]);

  const handleCreateIntent = async () => {
    setLoading(true);
    setError('');
    try {
      let intent;
      if (paymentType === 'ADVANCE') {
        intent = await tenantPortalApi.createPaymentIntent({
          payment_type: 'ADVANCE',
          amount,
        });
      } else if (activeTab === 'advance') {
        if (!parsedCustomAmount || parsedCustomAmount <= 0) {
          setError('Please enter a valid positive payment amount.');
          setLoading(false);
          return;
        }
        if (parsedCustomAmount < 100) {
          setError('Minimum payment amount is ₹100.');
          setLoading(false);
          return;
        }
        intent = await tenantPortalApi.createPaymentIntent({
          payment_type: 'ADVANCE',
          amount: parsedCustomAmount,
        });
      } else {
        const ids = [...new Set(selectedObligationIds.filter(Boolean))];
        if (ids.length === 0) {
          setError('Please select at least one installment to pay.');
          setLoading(false);
          return;
        }
        intent = await tenantPortalApi.createPaymentIntent({ obligation_ids: ids });
      }

      if (intent.provider === 'RAZORPAY') {
        const loaded = await loadRazorpayScript();
        if (!loaded) {
          setError('Failed to load payment checkout SDK. Please try again.');
          setLoading(false);
          return;
        }

        const options = {
          key: intent.raw_response?.key_id,
          amount: intent.raw_response?.amount,
          currency: intent.raw_response?.currency || 'INR',
          name: 'Sri Adithya Boys Hostel',
          description: 'Secure Checkout',
          order_id: intent.gateway_txn_id,
          handler: async (response: any) => {
            setLoading(true);
            try {
              const verifyResult = await tenantPortalApi.verifyPayment({
                attempt_id: intent.id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });

              setAttempt(verifyResult.attempt || verifyResult);
              const newStatus = verifyResult.status || verifyResult.attempt?.status || 'SUCCESS';
              setStatus(newStatus);
              setStep('done');
              if (newStatus === 'SUCCESS') {
                onSuccess?.();
              }
            } catch (err) {
              setError(getApiErrorMessage(err));
              setStep('init');
            } finally {
              setLoading(false);
            }
          },
          prefill: {
            name: intent.raw_response?.notes?.tenant_name || '',
            email: intent.raw_response?.notes?.tenant_email || '',
            contact: intent.raw_response?.notes?.tenant_phone || '',
          },
          theme: {
            color: '#F07B1D',
          },
          modal: {
            ondismiss: () => {
              setLoading(false);
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
        return;
      }

      if (intent.checkout_url) {
        window.location.href = intent.checkout_url;
        return;
      }

      setAttempt(intent);
      setStatus(String(intent.status ?? 'PENDING'));
      setStep('pay');
    } catch (intentError) {
      setError(getApiErrorMessage(intentError));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenUpi = () => {
    if (attempt?.upi_intent_url) window.location.href = attempt.upi_intent_url;
  };

  const handleSubmitReference = async () => {
    if (!upiReference.trim()) {
      setError('Please enter your UPI transaction ID.');
      return;
    }
    setSubmittingRef(true);
    setError('');
    try {
      const result = await tenantPortalApi.submitUpiReference({
        attempt_id: attempt?.id,
        upi_reference: upiReference.trim(),
      });
      const newStatus = result.status || result.attempt?.status || 'PENDING_VERIFICATION';
      setStatus(newStatus);
      setStep('done');
      if (newStatus === 'SUCCESS') onSuccess?.();
    } catch (refError) {
      setError(getApiErrorMessage(refError));
    } finally {
      setSubmittingRef(false);
    }
  };

  const handleCopy = async () => {
    const payload = attempt?.qr_payload || attempt?.upi_intent_url;
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && status !== 'SUCCESS' && !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-5 border-b border-border bg-muted/30">
          <DialogTitle>{paymentType === 'ADVANCE' ? 'Pay security deposit' : 'Make Payment'}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {step === 'init' && 'Review amount and continue to secure payment'}
            {step === 'pay' && 'Complete payment or enter UPI reference'}
            {step === 'reference' && 'Submit your transaction ID'}
            {step === 'done' && 'Payment update'}
          </p>
        </DialogHeader>

        <div className="space-y-4 p-5">
          {step === 'init' && (
            <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                {paymentType === 'ADVANCE' ? 'Total security deposit' : (activeTab === 'advance' ? 'Advance Credit Top-up' : 'Outstanding Today')}
              </p>
              <p className="text-3xl font-bold text-foreground mt-1">{fmt(displayAmount)}</p>
            </div>
          )}

          {step === 'init' && paymentType === 'RENT' && (
            <div className="flex bg-muted p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => { setActiveTab('due'); setError(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'due'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-card/50'
                }`}
              >
                Pay Due Amount
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('advance'); setError(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'advance'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-card/50'
                }`}
              >
                Add Advance Credit
              </button>
            </div>
          )}

          {step === 'init' && (
            <div className="space-y-4">
              {paymentType === 'ADVANCE' && paymentContext.length > 0 && (
                <div className="rounded-xl border border-border p-3 space-y-2">
                  <p className="text-sm font-semibold text-foreground">
                    You are paying security deposit for
                  </p>
                  {paymentContext.map((item) => (
                    <div key={item.id} className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">{item.label}</span>
                        <span className="font-bold">{fmt(item.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {paymentType === 'RENT' && activeTab === 'due' && (
                <div className="space-y-4">
                  {oldestOutstandingInstallment ? (
                    <div className="space-y-4">
                      {/* Oldest Outstanding Installment Card */}
                      <div className="rounded-xl border-2 border-accent bg-accent/5 p-4 space-y-3 relative overflow-hidden">
                        <div className="absolute right-0 top-0 bg-accent text-accent-foreground text-[10px] font-extrabold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                          Payable Now
                        </div>
                        <div>
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Current Outstanding Dues</p>
                          <h4 className="text-lg font-extrabold text-foreground mt-1">
                            {oldestOutstandingInstallment.label}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Info className="w-3.5 h-3.5 text-muted-foreground/75" />
                            Due: {new Date(oldestOutstandingInstallment.due_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="pt-2 border-t border-accent/20 flex justify-between items-baseline">
                          <span className="text-sm font-semibold text-muted-foreground">Due Amount</span>
                          <span className="text-2xl font-black text-foreground">{fmt(oldestOutstandingInstallment.remaining)}</span>
                        </div>
                      </div>

                      {/* Future Locked Obligations */}
                      {payableInstallments.length > 1 && (
                        <div className="space-y-2.5">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5" />
                            Future Installments (Locked)
                          </p>
                          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                            {payableInstallments.slice(1).map((inst) => (
                              <div
                                key={inst.timeline_id || inst.id}
                                className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20 opacity-60 select-none"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                                    <Lock className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-foreground">{inst.label}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      Clear previous installment first
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold text-foreground/80">{fmt(inst.remaining)}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    Due {new Date(inst.due_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">You are all caught up!</p>
                        <p className="text-xs text-muted-foreground mt-1">No outstanding dues are currently pending.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('advance')}
                        className="text-xs font-bold text-accent hover:underline mt-2 flex items-center gap-1 mx-auto"
                      >
                        Want to pay in advance? Add Advance Credit →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {paymentType === 'RENT' && activeTab === 'advance' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Add Advance Credit Amount (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">₹</span>
                      <input
                        type="number"
                        placeholder="Enter amount (e.g. 8500)"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        className="w-full pl-8 pr-4 py-3 rounded-xl border border-border bg-background text-lg font-bold placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                      />
                    </div>
                  </div>

                  {/* Quick-add buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    {[5000, 10000, 25000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCustomAmount(String(amt))}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                          customAmount === String(amt)
                            ? 'bg-accent border-accent text-accent-foreground'
                            : 'border-border bg-background hover:bg-muted/50 text-foreground'
                        }`}
                      >
                        + {fmt(amt)}
                      </button>
                    ))}
                  </div>

                  <div className="rounded-xl border border-dashed border-border p-4 bg-muted/10 space-y-2 text-xs leading-relaxed text-muted-foreground">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-accent" />
                      About Advance Payments
                    </p>
                    <p>
                      This payment will be recorded as **Future Rent Credit** on your ledger balance. It does not settle specific historical months directly.
                    </p>
                    <p>
                      When the hostel generates new monthly rent bills, the system will automatically consume your credit balance to pay them off.
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 flex gap-3">
                <Smartphone className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-sm text-foreground">
                  Secure checkout. Your payment is recorded in Sri Adithya Boys Hostel once confirmed.
                </p>
              </div>
              {error && (
                <div className="flex gap-2 text-sm text-destructive rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              <button
                type="button"
                onClick={handleCreateIntent}
                disabled={loading || displayAmount <= 0}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-accent text-accent-foreground font-bold disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                {loading 
                  ? 'Starting checkout…' 
                  : (paymentType === 'ADVANCE'
                      ? `Pay ${fmt(displayAmount)}`
                      : (activeTab === 'advance' 
                          ? `Add Advance Credit ${fmt(displayAmount)}` 
                          : `Pay ${fmt(displayAmount)}`
                        )
                    )}
              </button>
            </div>
          )}

          {step === 'pay' && attempt && (
            <>
              <QrCodeImage value={attempt.qr_payload || attempt.upi_intent_url} />
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={handleOpenUpi}
                  className="w-full py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm"
                >
                  Open payment app
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="w-full py-3 rounded-xl border border-border font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  {copied ? 'Copied!' : 'Copy payment link'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setStep('reference')}
                className="w-full py-3 rounded-xl bg-foreground text-background font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                I&apos;ve paid — enter transaction ID
              </button>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </>
          )}

          {step === 'reference' && (
            <>
              <label className="block text-sm font-medium">
                UPI transaction ID
                <input
                  type="text"
                  value={upiReference}
                  onChange={(e) => setUpiReference(e.target.value)}
                  placeholder="e.g. T2304260142301234"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-background font-mono text-sm"
                  autoFocus
                />
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button
                type="button"
                onClick={handleSubmitReference}
                disabled={submittingRef || !upiReference.trim()}
                className="w-full py-3 rounded-xl bg-foreground text-background font-semibold disabled:opacity-50"
              >
                {submittingRef ? 'Submitting…' : 'Submit transaction ID'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('pay'); setError(''); }}
                className="w-full text-sm text-muted-foreground"
              >
                ← Back
              </button>
            </>
          )}

          {step === 'done' && (
            <div className="text-center space-y-4">
              <CheckCircle
                className={`w-14 h-14 mx-auto ${status === 'SUCCESS' ? 'text-emerald-500' : 'text-amber-500'}`}
              />
              <p className="text-lg font-bold">
                {status === 'SUCCESS' ? 'Payment confirmed' : 'Reference submitted'}
              </p>
              <p className="text-sm text-muted-foreground">
                {status === 'SUCCESS'
                  ? 'Your rent payment has been recorded.'
                  : 'Your hostel will confirm the payment shortly.'}
              </p>

              {attempt?.settlement_breakdown && (
                <div className="rounded-xl border border-border p-4 bg-muted/20 text-left space-y-3 mt-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Final Settlement Breakdown</p>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {(attempt.settlement_breakdown as any).allocations?.map((alloc: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-sm py-1 border-b border-border/40 last:border-0">
                        <div>
                          <p className="font-semibold text-foreground">{alloc.label}</p>
                          <p className="text-xs text-muted-foreground">{alloc.type}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-accent">{fmt(alloc.allocated)}</p>
                          <p className="text-[10px] text-emerald-600 font-bold uppercase mt-0.5">{alloc.result}</p>
                        </div>
                      </div>
                    ))}
                    {(attempt.settlement_breakdown as any).future_credit > 0 && (
                      <div className="flex justify-between items-center text-sm py-2 px-3 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
                        <div>
                          <p className="font-bold text-emerald-950">Future Rent Credit</p>
                          <p className="text-xs text-emerald-700 opacity-95">Excess payment amount</p>
                        </div>
                        <p className="font-extrabold text-emerald-950">{fmt((attempt.settlement_breakdown as any).future_credit)}</p>
                      </div>
                    )}
                  </div>
                  {(attempt.settlement_breakdown as any).summary && (
                    <p className="text-[11px] text-muted-foreground pt-1.5 border-t border-border/80 leading-relaxed italic">
                      {(attempt.settlement_breakdown as any).summary}
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-accent text-accent-foreground font-semibold"
              >
                Done
              </button>
            </div>
          )}

          {canRetry && step !== 'done' && (
            <p className="text-sm text-destructive text-center">
              Attempt ended with status {status}. Close and try again.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
