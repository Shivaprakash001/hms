import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Copy, ExternalLink, Loader2, QrCode, Smartphone, X } from 'lucide-react';

import { paymentService } from '../../../api/services';
import QrCodeImage from '../../shared/QrCodeImage';
import { useAppPreferences } from '../../../context/AppPreferencesContext';
import { formatCurrency } from '../../../utils/format';

const POLL_INTERVAL_MS = 4000;
const TERMINAL_STATUSES = ['SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED'];

const OnlinePaymentModal = ({ isOpen, onClose, obligation, onSettled }) => {
    const { preferences } = useAppPreferences();
    const [loading, setLoading] = useState(false);
    const [attempt, setAttempt] = useState(null);
    const [status, setStatus] = useState('IDLE');
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    const amount = useMemo(() => Number(obligation?.balance || 0), [obligation?.balance]);

    useEffect(() => {
        if (!isOpen) {
            setLoading(false);
            setAttempt(null);
            setStatus('IDLE');
            setError('');
            setCopied(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !attempt?.id || TERMINAL_STATUSES.includes(status)) {
            return undefined;
        }

        const timer = window.setInterval(async () => {
            try {
                const latest = await paymentService.getAttempt(attempt.id);
                setAttempt(prev => ({ ...prev, ...latest }));
                setStatus(latest.status || 'PENDING');
                if (latest.status === 'SUCCESS') {
                    onSettled?.(latest);
                }
            } catch (pollError) {
                console.error('Owner payment attempt poll failed', pollError);
            }
        }, POLL_INTERVAL_MS);

        return () => window.clearInterval(timer);
    }, [attempt?.id, isOpen, onSettled, status]);

    const handleCreateIntent = async () => {
        if (!obligation?.obligationId) {
            setError('No rent entry selected.');
            return;
        }

        if (amount <= 0) {
            setError('This rent entry has no payable balance.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const intent = await paymentService.createIntent({
                obligation_ids: [obligation.obligationId],
            });

            // Redirect to hosted checkout when the provider returns a checkout URL.
            if (intent.checkout_url) {
                localStorage.setItem('lastPaymentAttemptId', intent.id);
                localStorage.setItem('lastPaymentMerchantTxnId', intent.merchant_txn_id);
                sessionStorage.setItem('lastPaymentAttemptId', intent.id);
                window.location.href = intent.checkout_url;
                return;
            }

            setAttempt(intent);
            setStatus(intent.status || 'PENDING');
        } catch (intentError) {
            const message = intentError?.response?.data?.detail?.message
                || intentError?.response?.data?.detail
                || 'Failed to create online payment attempt.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        const payload = attempt?.qr_payload || attempt?.upi_intent_url || '';
        if (!payload) return;
        try {
            await navigator.clipboard.writeText(payload);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
        } catch (copyError) {
            console.error('Failed to copy payment payload', copyError);
        }
    };

    if (!isOpen || !obligation) return null;

    return (
        <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70]">
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
                <div className="absolute inset-0 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, y: 24, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.96 }}
                        className="w-full max-w-xl rounded-3xl bg-white shadow-2xl"
                    >
                        <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50 px-6 py-5 rounded-t-3xl">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">Online Rent Payment</h2>
                                <p className="text-sm text-slate-500">Tenant: {obligation.tenantName} • Room {obligation.room}</p>
                            </div>
                            <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 p-6">
                            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                                <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Payable Amount</p>
                                <p className="mt-2 text-3xl font-black text-slate-900">{formatCurrency(amount, preferences)}</p>
                                <p className="mt-1 text-sm text-slate-500">Rent Entry: {obligation.obligationId}</p>
                            </div>

                            {!attempt ? (
                                <div className="space-y-4">
                                    {error && (
                                        <div className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                            <AlertCircle size={18} className="mt-0.5 shrink-0" />
                                            <span>{error}</span>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleCreateIntent}
                                        disabled={loading}
                                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-4 font-bold text-white hover:bg-slate-800 disabled:bg-slate-400"
                                    >
                                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Smartphone size={18} />}
                                        {loading ? 'Creating payment link...' : 'Create PhonePe Payment Link'}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Provider</p>
                                            <p className="mt-1 font-bold text-slate-900">{attempt.provider}</p>
                                        </div>
                                        <div className={`rounded-full px-3 py-1 text-xs font-bold ${
                                            status === 'SUCCESS'
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : TERMINAL_STATUSES.includes(status)
                                                    ? 'bg-rose-100 text-rose-700'
                                                    : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {status}
                                        </div>
                                    </div>

                                    {status === 'SUCCESS' ? (
                                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-700">
                                            <div className="flex items-center gap-2 font-bold">
                                                <CheckCircle2 size={18} />
                                                Payment settled successfully
                                            </div>
                                            <p className="mt-1 text-sm">Ledger will refresh automatically.</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                                            <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                                <QrCodeImage value={attempt.qr_payload || attempt.upi_intent_url || attempt.checkout_url} />
                                            </div>
                                            <div className="flex flex-col gap-3">
                                                <a
                                                    href={attempt.checkout_url || '#'}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${
                                                        attempt.checkout_url
                                                            ? 'bg-slate-900 text-white hover:bg-slate-800'
                                                            : 'bg-slate-100 text-slate-400 pointer-events-none'
                                                    }`}
                                                >
                                                    <ExternalLink size={16} />
                                                    Open Hosted Checkout
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
                                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                                                >
                                                    <Copy size={16} />
                                                    {copied ? 'Copied' : 'Copy Payload'}
                                                </button>
                                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                                                    <div className="flex items-center gap-2 font-semibold text-slate-700">
                                                        <QrCode size={14} />
                                                        Awaiting webhook/reconciliation confirmation
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Merchant Transaction ID</p>
                                        <p className="mt-2 break-all font-mono text-sm text-slate-700">{attempt.merchant_txn_id || attempt.id}</p>
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

export default OnlinePaymentModal;
