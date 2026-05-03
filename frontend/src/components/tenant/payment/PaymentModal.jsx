import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertCircle,
    CheckCircle,
    Copy,
    Loader2,
    QrCode,
    ShieldCheck,
    Smartphone,
    X,
    Send
} from 'lucide-react';

import { paymentService } from '../../../api/services';
import QrCodeImage from '../../shared/QrCodeImage';
import { useAppPreferences } from '../../../context/AppPreferencesContext';
import { formatCurrency } from '../../../utils/format';

const POLL_INTERVAL_MS = 4000;
const TERMINAL_STATUSES = ['SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED', 'PENDING_VERIFICATION'];

const PaymentModal = ({ isOpen, onClose, amount, obligationId, obligationIds = [], onSuccess }) => {
    const { preferences } = useAppPreferences();
    const [loading, setLoading] = useState(false);
    const [attempt, setAttempt] = useState(null);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [upiReference, setUpiReference] = useState('');
    const [submittingRef, setSubmittingRef] = useState(false);
    const [step, setStep] = useState('init'); // 'init' | 'pay' | 'reference' | 'done'

    useEffect(() => {
        if (!isOpen) {
            setLoading(false);
            setAttempt(null);
            setStatus('idle');
            setError('');
            setCopied(false);
            setUpiReference('');
            setSubmittingRef(false);
            setStep('init');
        }
    }, [isOpen]);

    // Poll for status updates
    useEffect(() => {
        if (!isOpen || !attempt?.id || TERMINAL_STATUSES.includes(status)) {
            return undefined;
        }

        const timer = window.setInterval(async () => {
            try {
                const latest = await paymentService.getAttempt(attempt.id);
                setAttempt(current => ({ ...current, ...latest }));
                setStatus(latest.status);
                if (latest.status === 'SUCCESS') {
                    setStep('done');
                    onSuccess?.(latest);
                }
            } catch (pollError) {
                console.error('Failed to poll payment status', pollError);
            }
        }, POLL_INTERVAL_MS);

        return () => window.clearInterval(timer);
    }, [attempt?.id, isOpen, onSuccess, status]);

    const canRetry = useMemo(() => ['FAILED', 'EXPIRED', 'CANCELLED'].includes(status), [status]);

    const handleCreateIntent = async () => {
        // Normalise: merge both props into a single de-duplicated array.
        // Backend ONLY accepts obligation_ids (array) — never send obligation_id string.
        const idSet = new Set([
            ...((obligationIds || []).filter(Boolean)),
            ...(obligationId ? [obligationId] : []),
        ]);
        const ids = [...idSet];
        if (ids.length === 0) {
            setError('No pending rent is available for payment right now.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const intent = await paymentService.createIntent({
                obligation_ids: ids,
            });

            // ✅ If gateway (like PhonePe v2) returns a hosted checkout URL, redirect immediately!
            if (intent.checkout_url) {
                // Persist attempt info so /payment-return can find it after cross-domain redirect
                localStorage.setItem('lastPaymentAttemptId', intent.id);
                localStorage.setItem('lastPaymentMerchantTxnId', intent.merchant_txn_id);
                sessionStorage.setItem('lastPaymentAttemptId', intent.id);
                window.location.href = intent.checkout_url;
                return; // Do not unset loading or change state, page is unloading
            }

            // Fallback for manual Direct UPI implementations
            setAttempt(intent);
            setStatus(intent.status);
            setStep('pay');
        } catch (intentError) {
            const message = intentError?.response?.data?.error?.message
                || intentError?.response?.data?.detail?.message
                || intentError?.response?.data?.detail
                || 'Unable to start payment right now.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenUpi = () => {
        if (attempt?.upi_intent_url) {
            window.location.href = attempt.upi_intent_url;
        }
    };

    const handleSubmitReference = async () => {
        if (!upiReference.trim()) {
            setError('Please enter your UPI transaction ID.');
            return;
        }
        setSubmittingRef(true);
        setError('');
        try {
            const result = await paymentService.submitUpiReference({
                attempt_id: attempt?.id,
                upi_reference: upiReference.trim(),
            });
            const newStatus = result.status || result.attempt?.status || 'PENDING_VERIFICATION';
            setStatus(newStatus);
            setStep('done');
            if (newStatus === 'SUCCESS') {
                onSuccess?.(result.attempt || result);
            }
        } catch (refError) {
            const message = refError?.response?.data?.error?.message
                || refError?.response?.data?.detail
                || 'Failed to submit reference. Please try again.';
            setError(message);
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
        } catch (copyError) {
            console.error('Failed to copy', copyError);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50"
            >
                <div
                    className="absolute inset-0 bg-slate-900/65 backdrop-blur-sm"
                    onClick={loading || status === 'SUCCESS' ? undefined : onClose}
                />
                <div className="absolute inset-0 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, y: 24, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.96 }}
                        className="w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50 px-6 py-5">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">Pay Rent</h2>
                                <p className="text-sm font-medium text-slate-500">
                                    {step === 'init' && 'Pay directly via any UPI app'}
                                    {step === 'pay' && 'Complete payment in your UPI app'}
                                    {step === 'reference' && 'Submit your transaction ID'}
                                    {step === 'done' && 'Payment confirmed!'}
                                </p>
                            </div>
                            {status !== 'SUCCESS' && (
                                <button
                                    onClick={onClose}
                                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>

                        <div className="space-y-5 p-6">
                            {/* Amount Display */}
                            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Amount</p>
                                <p className="mt-2 text-3xl font-black text-slate-900">{formatCurrency(Number(amount || 0), preferences)}</p>
                            </div>

                            {/* Step 1: Initial — Create Intent */}
                            {step === 'init' && (
                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                                                <Smartphone size={20} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">UPI Direct Payment</p>
                                                <p className="text-sm text-slate-500">Pay directly to your hostel owner via PhonePe, GPay, Paytm, or any UPI app.</p>
                                            </div>
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                            <AlertCircle size={18} className="mt-0.5 shrink-0" />
                                            <span>{error}</span>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleCreateIntent}
                                        disabled={loading}
                                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-4 font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                                    >
                                        {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                                        {loading ? 'Generating payment link...' : 'Pay Now'}
                                    </button>
                                </div>
                            )}

                            {/* Step 2: Pay — UPI Link + QR */}
                            {step === 'pay' && attempt && (
                                <div className="space-y-4">
                                    {/* QR Code */}
                                    <div className="rounded-3xl bg-white p-4 shadow-inner ring-1 ring-slate-200">
                                        <QrCodeImage value={attempt.qr_payload || attempt.upi_intent_url} />
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        {/* Open UPI App */}
                                        <button
                                            onClick={handleOpenUpi}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-500"
                                        >
                                            <Smartphone size={16} />
                                            Open UPI App to Pay
                                        </button>

                                        {/* Copy UPI Link */}
                                        <button
                                            onClick={handleCopy}
                                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                                        >
                                            <Copy size={16} />
                                            {copied ? 'Copied!' : 'Copy UPI Link'}
                                        </button>
                                    </div>

                                    <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                        <p className="font-semibold">After completing payment:</p>
                                        <p className="mt-1">Note down the <span className="font-bold">UPI Transaction ID</span> shown in your UPI app.</p>
                                    </div>

                                    <button
                                        onClick={() => setStep('reference')}
                                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-4 font-bold text-white transition-colors hover:bg-slate-800"
                                    >
                                        <Send size={16} />
                                        I've Paid — Enter Transaction ID
                                    </button>

                                    {error && (
                                        <div className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                            <AlertCircle size={18} className="mt-0.5 shrink-0" />
                                            <span>{error}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 3: Submit UPI Reference */}
                            {step === 'reference' && (
                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                        <label className="block text-sm font-bold text-slate-700 mb-2">
                                            UPI Transaction ID
                                        </label>
                                        <input
                                            type="text"
                                            value={upiReference}
                                            onChange={(e) => setUpiReference(e.target.value)}
                                            placeholder="e.g. T2304260142301234"
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-mono text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                            autoFocus
                                        />
                                        <p className="mt-2 text-xs text-slate-400">
                                            You can find this in your UPI app's transaction history.
                                        </p>
                                    </div>

                                    {error && (
                                        <div className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                            <AlertCircle size={18} className="mt-0.5 shrink-0" />
                                            <span>{error}</span>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleSubmitReference}
                                        disabled={submittingRef || !upiReference.trim()}
                                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-4 font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                                    >
                                        {submittingRef ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                        {submittingRef ? 'Submitting...' : 'Submit Transaction ID'}
                                    </button>

                                    <button
                                        onClick={() => { setStep('pay'); setError(''); }}
                                        className="w-full text-center text-sm font-medium text-slate-400 hover:text-slate-600"
                                    >
                                        ← Go back to payment
                                    </button>
                                </div>
                            )}

                            {/* Step 4: Success */}
                            {step === 'done' && (
                                <div className="space-y-4 text-center">
                                    <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${
                                        status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                                    }`}>
                                        <CheckCircle size={38} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-slate-900">
                                            {status === 'SUCCESS' ? 'Payment Confirmed' : 'Reference Submitted'}
                                        </p>
                                        <p className="mt-1 text-sm text-slate-500">
                                            {status === 'SUCCESS'
                                                ? 'Your rent payment has been recorded successfully.'
                                                : 'Your UPI reference has been submitted. Your hostel owner will confirm the payment shortly.'
                                            }
                                        </p>
                                    </div>

                                    {(upiReference || attempt?.gateway_txn_id) && (
                                        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">UPI Reference</p>
                                            <p className="mt-2 break-all font-mono text-sm text-slate-700">{upiReference || attempt.gateway_txn_id}</p>
                                        </div>
                                    )}

                                    <button
                                        onClick={onClose}
                                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-4 font-bold text-white transition-colors hover:bg-slate-800"
                                    >
                                        Done
                                    </button>
                                </div>
                            )}

                            {/* Retry notice */}
                            {canRetry && step !== 'done' && (
                                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                    This attempt ended with status <span className="font-bold">{status}</span>. You can close this and try again.
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default PaymentModal;
