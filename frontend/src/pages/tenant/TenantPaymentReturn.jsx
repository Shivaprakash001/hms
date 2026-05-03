import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from 'lucide-react';

import { paymentService } from '../../api/services';

const TERMINAL_STATUSES = ['SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED'];
const MAX_POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 4000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const TenantPaymentReturn = () => {
    const [searchParams] = useSearchParams();
    const [attempt, setAttempt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timedOut, setTimedOut] = useState(false);
    const [error, setError] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const cancelledRef = useRef(false);
    const focusVerifyingRef = useRef(false);

    const currentStatus = attempt?.status ?? 'PENDING';

    const merchantTxnId =
        searchParams.get('merchant_txn_id') ||
        searchParams.get('merchantOrderId') ||
        searchParams.get('transactionId');

    // Single verify call — updates attempt state, returns the data
    const doVerify = useCallback(async () => {
        const result = await paymentService.verifyPayment({ merchant_txn_id: merchantTxnId });
        const data = result?.attempt || result;
        if (data) {
            setAttempt(data);
            setError('');
        }
        return data;
    }, [merchantTxnId]);

    useEffect(() => {
        if (!merchantTxnId) {
            setError('Invalid payment return. Missing transaction reference. Please contact support.');
            setLoading(false);
            return;
        }

        cancelledRef.current = false;

        const runPolling = async () => {
            for (let i = 1; i <= MAX_POLL_ATTEMPTS; i++) {
                if (cancelledRef.current) return;

                try {
                    const data = await doVerify();

                    if (!data) {
                        setError('Payment record not found. Please contact support.');
                        setLoading(false);
                        return;
                    }

                    if (TERMINAL_STATUSES.includes(data.status)) {
                        setLoading(false);
                        return;
                    }
                } catch (err) {
                    if (err?.response?.status === 404) {
                        setError('Payment not found. It may still be processing.');
                        setLoading(false);
                        return;
                    }
                    // Non-404 errors: keep polling — but if we already have a terminal
                    // status from a previous successful call, trust it and stop.
                    if (TERMINAL_STATUSES.includes(attempt?.status)) {
                        setLoading(false);
                        return;
                    }
                }

                if (i < MAX_POLL_ATTEMPTS && !cancelledRef.current) {
                    await sleep(POLL_INTERVAL_MS);
                }
            }

            // All attempts exhausted — payment still pending, not a hard failure
            setTimedOut(true);
            setLoading(false);
        };

        runPolling();

        return () => {
            cancelledRef.current = true;
        };
    }, [merchantTxnId, doVerify]);

    // After timeout: slow background re-check every 15s.
    // Catches the common mobile case: webhook arrives after the polling window ends.
    // Stops automatically when a terminal status is reached.
    useEffect(() => {
        if (!timedOut || TERMINAL_STATUSES.includes(currentStatus)) return;

        const bgTimer = setInterval(async () => {
            try {
                const data = await doVerify();
                if (TERMINAL_STATUSES.includes(data?.status)) {
                    setTimedOut(false);
                    clearInterval(bgTimer);
                }
            } catch (_) {
                // silent — background attempt, don't surface transient errors
            }
        }, 15000);

        return () => clearInterval(bgTimer);
    }, [timedOut, currentStatus, doVerify]);

    // Window focus re-check: when the user switches back to this tab/app,
    // immediately verify if not in a terminal state.
    // Covers mobile: user pays in another app → switches back → instant recovery.
    useEffect(() => {
        const onFocus = async () => {
            if (!merchantTxnId || TERMINAL_STATUSES.includes(currentStatus) || isChecking || focusVerifyingRef.current) return;
            focusVerifyingRef.current = true;
            try {
                const data = await doVerify();
                if (TERMINAL_STATUSES.includes(data?.status)) {
                    setTimedOut(false);
                    setLoading(false);
                }
            } catch (_) {
                // silent — focus check, don't surface transient errors
            } finally {
                focusVerifyingRef.current = false;
            }
        };

        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [merchantTxnId, currentStatus, isChecking, doVerify]);

    // Manual one-shot check (from timeout screen or error screen)
    const handleManualCheck = async () => {
        if (!merchantTxnId || isChecking) return;
        setIsChecking(true);
        setError('');
        try {
            const data = await doVerify();
            if (TERMINAL_STATUSES.includes(data?.status)) {
                setTimedOut(false);
            }
        } catch (err) {
            setError('Failed to check status. Please try again.');
        } finally {
            setIsChecking(false);
        }
    };

    // ── Loading spinner ──────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 px-4 py-10">
                <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                    <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                        <h1 className="mt-4 text-xl font-bold text-slate-900">Verifying Payment</h1>
                        <p className="mt-2 text-sm text-slate-500">
                            Please wait while we confirm your payment…
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                            This may take up to 40 seconds. Do not close this page.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ── Hard error (no attempt found at all) ─────────────────────────────────
    if (error && !attempt) {
        return (
            <div className="min-h-screen bg-slate-50 px-4 py-10">
                <div className="mx-auto max-w-xl rounded-3xl border border-rose-200 bg-white p-8 shadow-sm">
                    <div className="flex flex-col items-center justify-center py-8">
                        <div className="rounded-full bg-rose-100 p-4">
                            <AlertCircle className="h-10 w-10 text-rose-600" />
                        </div>
                        <h1 className="mt-4 text-xl font-bold text-rose-900">Verification Failed</h1>
                        <p className="mt-2 text-sm text-rose-600 text-center max-w-sm">{error}</p>
                        <button
                            onClick={handleManualCheck}
                            disabled={isChecking}
                            className="mt-6 flex items-center gap-2 rounded-2xl bg-rose-600 px-6 py-3 font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
                            {isChecking ? 'Checking…' : 'Try Again'}
                        </button>
                        <Link to="/tenant/payments" className="mt-4 text-sm font-medium text-slate-500 hover:text-slate-700">
                            Back to Payments
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // ── Timed out — payment still pending, not a failure ────────────────────
    if (timedOut && currentStatus !== 'SUCCESS') {
        return (
            <div className="min-h-screen bg-slate-50 px-4 py-10">
                <div className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-white p-8 shadow-sm">
                    <div className="flex flex-col items-center justify-center py-8">
                        <div className="rounded-full bg-amber-100 p-4">
                            <Clock className="h-10 w-10 text-amber-600" />
                        </div>
                        <h1 className="mt-4 text-xl font-bold text-slate-900">Payment Still Processing</h1>
                        <p className="mt-2 text-sm text-slate-500 text-center max-w-sm">
                            Your payment reached the gateway but confirmation is taking longer than usual.
                            This is normal for UPI payments — it will be recorded automatically once confirmed.
                        </p>
                        {attempt && (
                            <div className="mt-5 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Reference</span>
                                    <span className="font-mono text-slate-800">{attempt.merchant_txn_id}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Amount</span>
                                    <span className="font-medium text-slate-800">₹{Number(attempt.amount || 0).toLocaleString('en-IN')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Status</span>
                                    <span className="font-semibold text-amber-600">{currentStatus}</span>
                                </div>
                            </div>
                        )}
                        {error && (
                            <p className="mt-3 text-xs text-rose-500 text-center">{error}</p>
                        )}
                        <button
                            onClick={handleManualCheck}
                            disabled={isChecking}
                            className="mt-5 w-full flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 font-bold text-white hover:bg-amber-600 disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
                            {isChecking ? 'Checking…' : 'Check Payment Status'}
                        </button>
                        <p className="mt-2 text-xs text-slate-400 text-center">
                            If the amount was deducted, it will appear in your payment history shortly.
                        </p>
                        <Link to="/tenant/payments" className="mt-3 text-sm font-medium text-slate-500 hover:text-slate-700">
                            Back to Payments
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // ── Terminal state (SUCCESS / FAILED / EXPIRED / CANCELLED) ─────────────
    const isSuccess = currentStatus === 'SUCCESS';
    const isFailed = ['FAILED', 'EXPIRED', 'CANCELLED'].includes(currentStatus);

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-10">
            <div className={`mx-auto max-w-xl rounded-3xl border bg-white p-8 shadow-sm ${
                isSuccess ? 'border-emerald-200' : isFailed ? 'border-rose-200' : 'border-slate-200'
            }`}>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Payment Return</p>
                <h1 className="mt-3 text-3xl font-black text-slate-900">
                    {isSuccess ? 'Payment Confirmed' : isFailed ? 'Payment Failed' : 'Payment Status'}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                    {isSuccess
                        ? 'Your payment has been successfully processed and recorded.'
                        : isFailed
                        ? 'Your payment could not be completed. No amount was charged.'
                        : `Current status: ${currentStatus}. Contact support if this does not change.`}
                </p>

                <div className={`mt-8 rounded-2xl border p-5 ${
                    isSuccess ? 'border-emerald-100 bg-emerald-50'
                    : isFailed ? 'border-rose-100 bg-rose-50'
                    : 'border-slate-200 bg-slate-50'
                }`}>
                    <div className={`flex items-center gap-3 ${
                        isSuccess ? 'text-emerald-700' : isFailed ? 'text-rose-700' : 'text-amber-700'
                    }`}>
                        {isSuccess && <CheckCircle2 size={20} />}
                        {isFailed && <XCircle size={20} />}
                        {!isSuccess && !isFailed && <Clock size={20} />}
                        <span className="font-medium">
                            {isSuccess ? 'Payment confirmed and recorded.'
                            : isFailed ? 'Payment was not completed.'
                            : `Status: ${currentStatus}`}
                        </span>
                    </div>

                    {attempt && (
                        <div className="mt-4 space-y-2 text-sm text-slate-600">
                            <div className="flex justify-between">
                                <span className="font-semibold text-slate-800">Reference</span>
                                <span className="font-mono">{attempt.merchant_txn_id || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-semibold text-slate-800">Amount</span>
                                <span className="font-medium">₹{Number(attempt.amount || 0).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-semibold text-slate-800">Provider</span>
                                <span>{attempt.provider || 'UPI'}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-8 flex gap-3">
                    <Link
                        to="/tenant/payments"
                        className="flex-1 rounded-2xl bg-slate-900 px-5 py-3 text-center text-sm font-bold text-white hover:bg-slate-800"
                    >
                        Back To Payments
                    </Link>
                    {!isSuccess && (
                        <button
                            onClick={handleManualCheck}
                            disabled={isChecking}
                            className="flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
                            {isChecking ? 'Checking…' : 'Refresh'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TenantPaymentReturn;