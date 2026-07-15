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
  ArrowRight,
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
  onSuccess?: () => void;
  tenantId?: string;
  hostelId?: string;
  onRazorpayIntentCreated?: (intent: any) => void;
}

export function TenantPaymentModal({
  open,
  onClose,
  amount,
  onSuccess,
  tenantId,
  hostelId,
  onRazorpayIntentCreated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState<PaymentAttempt | null>(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [upiReference, setUpiReference] = useState('');
  const [submittingRef, setSubmittingRef] = useState(false);
  const [step, setStep] = useState<'init' | 'pay' | 'reference' | 'done'>('init');

  // Custom amount state (used for the unified payment amount)
  const [customAmount, setCustomAmount] = useState<string>('');

  const [customMode, setCustomMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Fetch tenant dues
  const { data: duesData, isLoading: duesLoading } = useQuery({
    queryKey: ['tenant-portal-dues', tenantId],
    queryFn: () => tenantPortalApi.getDuesBreakdown(),
    enabled: open && Boolean(tenantId),
  });

  // Auto-initialize selectedIds when duesData items load
  useEffect(() => {
    if (duesData?.items) {
      setSelectedIds(duesData.items.map((x: any) => x.obligation_id || x.id));
    }
  }, [duesData]);

  const handleToggleObligation = (id: string) => {
    const ob = duesData?.items?.find((x: any) => x.obligation_id === id || x.id === id);
    if (!ob) return;
    const sameTypeObs = (duesData?.items || []).filter((x: any) => (x.type || x.obligation_type) === (ob.type || ob.obligation_type));

    const isCurrentlyChecked = selectedIds.includes(id);
    if (!isCurrentlyChecked) {
      // Checking: select this one and all older ones of the same type
      const olderIds = sameTypeObs
        .filter((x: any) => new Date(x.due_date).getTime() < new Date(ob.due_date).getTime())
        .map((x: any) => x.obligation_id || x.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, id, ...olderIds])));
    } else {
      // Unchecking: deselect this one and all newer ones of the same type
      const newerIds = sameTypeObs
        .filter((x: any) => new Date(x.due_date).getTime() > new Date(ob.due_date).getTime())
        .map((x: any) => x.obligation_id || x.id);
      setSelectedIds((prev) => prev.filter((x) => x !== id && !newerIds.includes(x)));
    }
  };

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
      setCustomMode(false);
      setSelectedIds([]);
    }
  }, [open]);

  // Amount logic when modal opens
  useEffect(() => {
    if (open) {
      setCustomAmount(amount > 0 ? String(amount) : '');
    }
  }, [open, amount]);

  // Mode B: Settlement Preview Query (React Query)
  const parsedCustomAmount = Number(customAmount) || 0;
  const activeAllowedIds = customMode ? selectedIds : undefined;
  const previewEnabled = open && Boolean(tenantId) && parsedCustomAmount > 0 && Boolean(hostelId);

  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ['tenant-settlement-preview', tenantId, parsedCustomAmount, hostelId, activeAllowedIds],
    queryFn: () => tenantPortalApi.settlementPreview(tenantId!, parsedCustomAmount, hostelId!, activeAllowedIds),
    enabled: previewEnabled,
    staleTime: 5000,
    retry: false,
  });

  const displayAmount = parsedCustomAmount;

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
      if (!parsedCustomAmount || parsedCustomAmount <= 0) {
        setError('Please enter a valid positive payment amount.');
        setLoading(false);
        return;
      }
      if (previewData && previewData.payment_accepted === false) {
        setError(previewData.rejection_reason || 'Payment policy check failed.');
        setLoading(false);
        return;
      }
      intent = await tenantPortalApi.createPaymentIntent({
        payment_type: 'RENT',
        amount: parsedCustomAmount,
        tenant_id: tenantId,
        allowed_obligation_ids: customMode ? selectedIds : undefined,
      });

      if (intent.provider === 'RAZORPAY') {
        if (onRazorpayIntentCreated) {
          onRazorpayIntentCreated(intent);
          return;
        }
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
          <DialogTitle>Make Payment</DialogTitle>
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
                Payment Amount
              </p>
              <p className="text-3xl font-bold text-foreground mt-1">{fmt(displayAmount)}</p>
            </div>
          )}

          {step === 'init' && (
            <div className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Amount to Pay (₹)
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

                {/* Suggested vs Customize Toggle */}
                {duesData?.items && duesData.items.length > 0 && (
                  <div className="flex border border-border rounded-xl p-1 bg-secondary/30">
                    <button
                      type="button"
                      onClick={() => setCustomMode(false)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        !customMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Suggested Settlement
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomMode(true)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        customMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Customize
                    </button>
                  </div>
                )}

                {/* Custom Mode: List of obligations with checkboxes & warning */}
                {customMode && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select Obligations to Settle</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedIds.length === duesData?.items?.length) {
                            setSelectedIds([]);
                          } else {
                            setSelectedIds((duesData?.items || []).map((x: any) => x.obligation_id || x.id));
                          }
                        }}
                        className="text-xs text-accent font-semibold hover:underline"
                      >
                        {selectedIds.length === duesData?.items?.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    
                    {duesData?.items && duesData.items.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {duesData.items.map((ob: any) => {
                          const isSelected = selectedIds.includes(ob.obligation_id || ob.id);
                          return (
                            <div
                              key={ob.obligation_id || ob.id}
                              className={`p-3 rounded-xl border transition-colors flex items-start gap-3 cursor-pointer ${
                                isSelected
                                  ? 'bg-accent/5 border-accent/30'
                                  : 'bg-card border-border hover:bg-secondary/40'
                              }`}
                              onClick={() => handleToggleObligation(ob.obligation_id || ob.id)}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // handled by click on parent div
                                className="mt-0.5 rounded border-gray-300 text-accent focus:ring-accent cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-foreground capitalize">
                                    {ob.type?.replace('_', ' ') || 'Obligation'}
                                  </span>
                                  <span className="text-xs font-bold text-foreground">
                                    {fmt(ob.outstanding)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground">
                                  <span>
                                    {ob.rent_month
                                      ? new Date(ob.rent_month).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
                                      : ob.installment_label || 'Billing Period'}
                                  </span>
                                  <span>Due: {new Date(ob.due_date).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4 bg-secondary/20 rounded-xl">
                        No outstanding obligations.
                      </p>
                    )}

                    <div className="p-2.5 bg-amber-500/5 rounded-xl border border-amber-500/15 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-800 dark:text-amber-400 font-medium leading-relaxed">
                        Rent dues of the same type must be paid in chronological order. Selecting a newer rent due will automatically select older ones.
                      </p>
                    </div>
                  </div>
                )}

                {/* Settlement Preview Section */}
                {parsedCustomAmount > 0 && (
                  <div className="rounded-xl border border-border p-4 bg-muted/10 space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-accent" />
                      Settlement Preview
                    </p>

                    {previewLoading ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-4 bg-muted rounded w-1/3"></div>
                        <div className="h-10 bg-muted rounded"></div>
                      </div>
                    ) : previewData ? (
                      <div className="space-y-3">
                        {/* Rejection Alert */}
                        {previewData.payment_accepted === false && (
                          <div className="flex gap-2 text-xs text-destructive rounded-xl border border-destructive/30 bg-destructive/5 p-3 font-semibold">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <div>
                              <p className="font-bold">Payment Policy Alert</p>
                              <p className="mt-0.5">{previewData.rejection_reason}</p>
                            </div>
                          </div>
                        )}

                        {/* Allocation Items */}
                        {previewData.allocations?.some((a: any) => a.allocated > 0) ? (
                          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                            {previewData.allocations.map((alloc: any, idx: number) => {
                              if (alloc.allocated <= 0) return null;
                              return (
                                <div key={idx} className="flex justify-between items-center text-xs py-1.5 border-b border-border/40 last:border-0">
                                  <div>
                                    <p className="font-semibold text-foreground">{alloc.label}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{alloc.type.replaceAll('_', ' ')}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-bold text-foreground">{fmt(alloc.allocated)}</p>
                                    <p className={`text-[10px] font-bold uppercase mt-0.5 ${
                                      alloc.result === 'PAID' ? 'text-emerald-600' : 'text-amber-600'
                                    }`}>{alloc.result}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">No obligations will be settled by this payment amount.</p>
                        )}

                        {/* Future Credit Alert */}
                        {previewData.future_credit > 0 && (
                          <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/5 p-3 flex flex-col gap-1 text-xs">
                            <span className="font-bold text-emerald-800 flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                              Future Rent Credit: {fmt(previewData.future_credit)}
                            </span>
                            <p className="text-emerald-700/90 leading-relaxed text-[11px]">
                              This excess amount will be added to your ledger balance and automatically applied to future bills.
                            </p>
                          </div>
                        )}

                        {/* Summary Details */}
                        <div className="pt-2 border-t border-border/60 space-y-1 text-[11px] text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Total Outstanding Balance:</span>
                            <span className="font-medium text-foreground">{fmt(previewData.total_outstanding)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-foreground">
                            <span>Remaining Balance After Payment:</span>
                            <span>{fmt(previewData.remaining_outstanding)}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Unable to fetch settlement plan.</p>
                    )}
                  </div>
                )}
              </div>

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
                disabled={loading || displayAmount <= 0 || previewData?.payment_accepted === false}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-accent text-accent-foreground font-bold disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                {loading 
                  ? 'Starting checkout…' 
                  : `Pay ${fmt(displayAmount)}`
                }
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
