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

  // Tabs for Rent Payment
  const [activeTab, setActiveTab] = useState<'installments' | 'custom'>('custom');
  
  // Mode A: Multi-installment selection state
  const [selectedTimelineIds, setSelectedTimelineIds] = useState<string[]>([]);
  
  // Mode B: Custom amount state
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

  // Default tab and amount logic when modal opens
  useEffect(() => {
    if (open) {
      if (paymentType === 'RENT') {
        if (obligationIds && obligationIds.length > 0) {
          setActiveTab('installments');
        } else {
          setActiveTab('custom');
        }
        setCustomAmount(amount > 0 ? String(amount) : '');
      } else {
        setActiveTab('custom');
      }
    }
  }, [open, obligationIds, paymentType, amount]);

  // Group payable installments
  const payableInstallments = useMemo(() => {
    if (!allInstallments) return [];
    return allInstallments.filter((inst) => inst.remaining > 0);
  }, [allInstallments]);

  // Automatically select required (overdue/current) installments
  useEffect(() => {
    if (open && paymentType === 'RENT' && payableInstallments.length > 0) {
      const initialIds = payableInstallments
        .filter((inst) => {
          const hasMatch = inst.obligations?.some((o: any) => obligationIds.includes(o.obligation_id));
          const isRequired = inst.state === 'overdue' || inst.isCurrent;
          return hasMatch || isRequired;
        })
        .map((inst) => inst.timeline_id || inst.id);
      setSelectedTimelineIds(initialIds);
    }
  }, [open, obligationIds, payableInstallments, paymentType]);

  const isInstallmentRequired = (inst: any) => {
    return inst.state === 'overdue' || inst.isCurrent;
  };

  const handleToggleInstallment = (timelineId: string, required: boolean) => {
    if (required) return;
    setSelectedTimelineIds((prev) => {
      if (prev.includes(timelineId)) {
        return prev.filter((id) => id !== timelineId);
      } else {
        return [...prev, timelineId];
      }
    });
  };

  const selectedInstallmentsAmount = useMemo(() => {
    return payableInstallments
      .filter((inst) => selectedTimelineIds.includes(inst.timeline_id || inst.id))
      .reduce((sum, inst) => sum + inst.remaining, 0);
  }, [payableInstallments, selectedTimelineIds]);

  const selectedObligationIds = useMemo(() => {
    return payableInstallments
      .filter((inst) => selectedTimelineIds.includes(inst.timeline_id || inst.id))
      .flatMap((inst) => inst.obligations?.map((o: any) => o.obligation_id) || []);
  }, [payableInstallments, selectedTimelineIds]);

  // Mode B: Settlement Preview Query (React Query)
  const parsedCustomAmount = Number(customAmount) || 0;
  const previewEnabled = open && activeTab === 'custom' && paymentType === 'RENT' && Boolean(tenantId) && parsedCustomAmount > 0 && Boolean(hostelId);

  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ['tenant-settlement-preview', tenantId, parsedCustomAmount, hostelId],
    queryFn: () => tenantPortalApi.settlementPreview(tenantId!, parsedCustomAmount, hostelId!),
    enabled: previewEnabled,
    staleTime: 5000,
    retry: false,
  });

  const displayAmount = useMemo(() => {
    if (paymentType === 'ADVANCE') return amount;
    if (activeTab === 'custom') return parsedCustomAmount;
    return selectedInstallmentsAmount;
  }, [paymentType, activeTab, amount, parsedCustomAmount, selectedInstallmentsAmount]);

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
      } else if (activeTab === 'custom') {
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
          payment_type: 'RENT',
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
                {paymentType === 'ADVANCE' ? 'Total security deposit' : (activeTab === 'custom' ? 'Custom Payment Amount' : 'Total Selected Amount')}
              </p>
              <p className="text-3xl font-bold text-foreground mt-1">{fmt(displayAmount)}</p>
            </div>
          )}

          {step === 'init' && paymentType === 'RENT' && (
            <div className="flex bg-muted p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => { setActiveTab('custom'); setError(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'custom'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-card/50'
                }`}
              >
                Pay Custom Amount
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('installments'); setError(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'installments'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-card/50'
                }`}
              >
                Select Installments
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

              {paymentType === 'RENT' && activeTab === 'installments' && (
                <div className="space-y-2.5">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select Outstanding Bills</p>
                  {payableInstallments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No pending dues are available for payment right now.</p>
                  ) : (
                    <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                      {payableInstallments.map((inst) => {
                        const isRequired = isInstallmentRequired(inst);
                        const isSelected = selectedTimelineIds.includes(inst.timeline_id || inst.id);
                        return (
                          <div
                            key={inst.timeline_id || inst.id}
                            onClick={() => handleToggleInstallment(inst.timeline_id || inst.id, isRequired)}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-accent/5 border-accent/40 ring-1 ring-accent/20'
                                : 'border-border hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                                disabled={isRequired}
                                className="rounded border-gray-300 text-accent focus:ring-accent w-4.5 h-4.5 cursor-pointer"
                              />
                              <div>
                                <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                                  {inst.label}
                                  {isRequired && (
                                    <span className="text-[9px] bg-red-100 text-red-800 font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                      Required
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Due {new Date(inst.due_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-extrabold text-foreground">{fmt(inst.remaining)}</p>
                              {inst.paid > 0 && (
                                <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                                  Paid {fmt(inst.paid)}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {paymentType === 'RENT' && activeTab === 'custom' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Payment Amount (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">₹</span>
                      <input
                        type="number"
                        placeholder="Enter custom amount"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        className="w-full pl-8 pr-4 py-3 rounded-xl border border-border bg-background text-lg font-bold placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                      />
                    </div>
                  </div>

                  {previewLoading && (
                    <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin text-accent" />
                      Calculating settlement allocation...
                    </div>
                  )}

                  {previewData && (
                    <div className="rounded-xl border border-border p-4 bg-muted/20 space-y-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Settlement Allocation Preview</p>
                      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                        {previewData.allocations?.map((alloc: any, idx: number) => (
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
                        {previewData.future_credit > 0 && (
                          <div className="flex justify-between items-center text-sm py-2 px-3 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
                            <div>
                              <p className="font-bold text-emerald-950">Future Rent Credit</p>
                              <p className="text-xs text-emerald-700 opacity-95">Excess payment amount</p>
                            </div>
                            <p className="font-extrabold text-emerald-950">{fmt(previewData.future_credit)}</p>
                          </div>
                        )}
                      </div>
                      {previewData.summary && (
                        <p className="text-[11px] text-muted-foreground pt-1.5 border-t border-border/80 leading-relaxed italic">
                          {previewData.summary}
                        </p>
                      )}
                    </div>
                  )}

                  {!previewLoading && !previewData && parsedCustomAmount > 0 && (
                    <div className="text-center text-xs text-muted-foreground py-4">
                      Unable to compute settlement allocation. Ensure amount is valid.
                    </div>
                  )}

                  {parsedCustomAmount === 0 && (
                    <div className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground/80 leading-relaxed">
                      Enter a custom payment amount above to view how the HMS settlement engine will distribute your payment across outstanding obligations.
                    </div>
                  )}
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
                {loading ? 'Starting checkout…' : 'Continue to secure checkout'}
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
