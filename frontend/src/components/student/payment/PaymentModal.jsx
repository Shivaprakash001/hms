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
    X
} from 'lucide-react';

import { paymentService } from '../../../api/services';
import QrCodeImage from '../../shared/QrCodeImage';

const POLL_INTERVAL_MS = 4000;
const TERMINAL_STATUSES = ['SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED'];

const PaymentModal = ({ isOpen, onClose, amount, obligationId, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [attempt, setAttempt] = useState(null);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [redirecting, setRedirecting] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setLoading(false);
            setAttempt(null);
            setStatus('idle');
            setError('');
            setCopied(false);
            setRedirecting(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !attempt?.attempt_id || TERMINAL_STATUSES.includes(status)) {
            return undefined;
        }

        const timer = window.setInterval(async () => {
            try {
                const latest = await paymentService.getAttempt(attempt.attempt_id);
                setAttempt(current => ({ ...current, ...latest }));
                setStatus(latest.status);
                if (latest.status === 'SUCCESS') {
                    onSuccess?.(latest);
                }
            } catch (pollError) {
                console.error('Failed to poll payment status', pollError);
            }
        }, POLL_INTERVAL_MS);

        return () => window.clearInterval(timer);
    }, [attempt?.attempt_id, isOpen, onSuccess, status]);

    const canRetry = useMemo(() => ['FAILED', 'EXPIRED', 'CANCELLED'].includes(status), [status]);

    const handleCreateIntent = async () => {
        if (!obligationId) {
            setError('No payable obligation is available right now.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const intent = await paymentService.createIntent({
                obligation_id: obligationId,
                amount
            });
            sessionStorage.setItem('lastPaymentAttemptId', intent.attempt_id);
            setAttempt(intent);
            setStatus(intent.status);
            if (intent.checkout_url) {
                setRedirecting(true);
                window.location.href = intent.checkout_url;
            }
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

    const handleCopy = async () => {
        if (!attempt?.qr_payload) return;
        try {
            await navigator.clipboard.writeText(attempt.qr_payload);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
        } catch (copyError) {
            console.error('Failed to copy QR payload', copyError);
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
                        <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50 px-6 py-5">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">Pay Rent Online</h2>
                                <p className="text-sm font-medium text-slate-500">PhonePe is the default gateway when configured.</p>
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
                            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Amount</p>
                                <p className="mt-2 text-3xl font-black text-slate-900">₹{Number(amount || 0).toLocaleString()}</p>
                            </div>

                            {!attempt && (
                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                                                <Smartphone size={20} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">PhonePe Hosted Checkout</p>
                                                <p className="text-sm text-slate-500">We will redirect you to PhonePe to finish the payment securely.</p>
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
                                        {loading ? 'Creating payment...' : 'Continue To Payment'}
                                    </button>
                                </div>
                            )}

                            {attempt && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Provider</p>
                                            <p className="mt-1 font-bold text-slate-900">{attempt.provider}</p>
                                        </div>
                                        <div className={`rounded-full px-3 py-1 text-xs font-bold ${
                                            status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700'
                                                : canRetry ? 'bg-rose-100 text-rose-700'
                                                    : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {status}
                                        </div>
                                    </div>

                                    {status === 'SUCCESS' ? (
                                        <div className="space-y-4 text-center">
                                            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                                                <CheckCircle size={38} strokeWidth={2.5} />
                                            </div>
                                            <div>
                                                <p className="text-2xl font-black text-slate-900">Payment confirmed</p>
                                                <p className="mt-1 text-sm text-slate-500">HMS has confirmed your payment and updated your dues.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {attempt.checkout_url && (
                                                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
                                                    <p className="font-semibold">Hosted checkout ready</p>
                                                    <p className="mt-1">{redirecting ? 'Redirecting to PhonePe...' : 'If you are not redirected automatically, use the button below.'}</p>
                                                </div>
                                            )}
                                            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                                                <div className="rounded-3xl bg-white p-3 shadow-inner ring-1 ring-slate-200">
                                                    <QrCodeImage value={attempt.qr_payload || attempt.upi_intent_url || attempt.checkout_url} />
                                                </div>
                                                <div className="flex flex-col gap-3">
                                                    <a
                                                        href={attempt.checkout_url || '#'}
                                                        target="_self"
                                                        rel="noreferrer"
                                                        className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${
                                                            attempt.checkout_url
                                                                ? 'bg-slate-900 text-white hover:bg-slate-800'
                                                                : 'bg-slate-100 text-slate-400 pointer-events-none'
                                                        }`}
                                                    >
                                                        <ShieldCheck size={16} />
                                                        Open PhonePe Checkout
                                                    </a>
                                                    <a
                                                        href={attempt.upi_intent_url || '#'}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${
                                                            attempt.upi_intent_url
                                                                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                                                                : 'bg-slate-100 text-slate-400 pointer-events-none'
                                                        }`}
                                                    >
                                                        <Smartphone size={16} />
                                                        Open UPI App
                                                    </a>
                                                    <button
                                                        onClick={handleCopy}
                                                        disabled={!attempt.qr_payload}
                                                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:text-slate-300"
                                                    >
                                                        <Copy size={16} />
                                                        {copied ? 'Copied' : 'Copy QR Payload'}
                                                    </button>
                                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                                                        <div className="flex items-center gap-2 font-semibold text-slate-700">
                                                            <QrCode size={16} />
                                                            Waiting for confirmation
                                                        </div>
                                                        <p className="mt-1">Keep this window open while we confirm the payment.</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {canRetry && (
                                                <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                                    This attempt ended with status <span className="font-bold">{status}</span>. You can close this and try again.
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Merchant Transaction ID</p>
                                        <p className="mt-2 break-all font-mono text-sm text-slate-700">{attempt.merchant_txn_id || attempt.gateway_txn_id || attempt.attempt_id}</p>
                                    </div>
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
