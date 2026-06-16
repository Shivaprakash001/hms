import { useEffect, useMemo, useState } from 'react';
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
}

interface Props {
  open: boolean;
  onClose: () => void;
  amount: number;
  obligationIds: string[];
  paymentType?: 'RENT' | 'ADVANCE';
  paymentContext?: PayableObligation[];
  onSuccess?: () => void;
}

export function TenantPaymentModal({
  open,
  onClose,
  amount,
  obligationIds,
  paymentType = 'RENT',
  paymentContext = [],
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState<PaymentAttempt | null>(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [upiReference, setUpiReference] = useState('');
  const [submittingRef, setSubmittingRef] = useState(false);
  const [step, setStep] = useState<'init' | 'pay' | 'reference' | 'done'>('init');

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
    }
  }, [open]);

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
      } else {
        const ids = [...new Set(obligationIds.filter(Boolean))];
        if (ids.length === 0) {
          setError('No pending dues are available for payment right now.');
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
          <DialogTitle>{paymentType === 'ADVANCE' ? 'Pay security deposit' : 'Pay rent'}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {step === 'init' && 'Review amount and continue to secure payment'}
            {step === 'pay' && 'Complete payment or enter UPI reference'}
            {step === 'reference' && 'Submit your transaction ID'}
            {step === 'done' && 'Payment update'}
          </p>
        </DialogHeader>

        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              {paymentType === 'ADVANCE' ? 'Total security deposit' : 'Total due'}
            </p>
            <p className="text-3xl font-bold text-foreground mt-1">{fmt(amount)}</p>
          </div>

          {paymentContext.length > 0 && (
            <div className="rounded-xl border border-border p-3 space-y-2">
              <p className="text-sm font-semibold text-foreground">
                {paymentType === 'ADVANCE' ? 'You are paying security deposit for' : 'You are paying for'}
              </p>
              {paymentContext.map((item) => (
                <div key={item.id} className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">
                      {paymentType === 'ADVANCE' ? item.label : `Monthly stay (${fmtMonth(item.cycle || item.rent_month || item.due_date)})`}
                    </span>
                    <span className="font-bold">{fmt(item.amount)}</span>
                  </div>
                  {paymentType !== 'ADVANCE' && Number(item.maintenance_amount ?? 0) > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Includes maintenance</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {step === 'init' && (
            <>
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
                disabled={loading || amount <= 0}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-accent text-accent-foreground font-bold disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                {loading ? 'Starting checkout…' : 'Continue to secure checkout'}
              </button>
            </>
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
