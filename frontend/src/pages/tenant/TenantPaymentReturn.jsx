import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

import { paymentService } from '../../api/services';

const TERMINAL_STATUSES = ['SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED'];
const MAX_POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 4000;

const TenantPaymentReturn = () => {
    const [searchParams] = useSearchParams();
    const [attempt, setAttempt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const pollAttemptsRef = useRef(0);
    const [isPolling, setIsPolling] = useState(false);

    const merchantTxnId = searchParams.get('merchant_txn_id')
        || searchParams.get('merchantOrderId')
        || searchParams.get('transactionId');

    useEffect(() => {
        if (!merchantTxnId) {
            setLoading(false);
            setError('Invalid payment return. Missing transaction reference. Please contact support.');
            return;
        }

        const loadAttempt = async () => {
            if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
                setError('Verification timed out. Please refresh the page or contact support.');
                setIsPolling(false);
                return true;
            }

            pollAttemptsRef.current += 1;

            try {
                const result = await paymentService.verifyPayment({ 
                    merchant_txn_id: merchantTxnId 
                });
                
                const attemptData = result?.attempt || result;
                
                if (!attemptData) {
                    setError('Payment record not found. Please contact support.');
                    setIsPolling(false);
                    return true;
                }

                setAttempt(attemptData);
                setError('');

                if (TERMINAL_STATUSES.includes(attemptData.status)) {
                    setIsPolling(false);
                    setLoading(false);
                    return true;
                }

                return false;
            } catch (attemptError) {
                const errorMsg = attemptError?.response?.data?.message 
                    || attemptError?.message 
                    || 'Unable to verify payment status.';
                
                if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
                    setError('Verification timed out. ' + errorMsg);
                    setIsPolling(false);
                    return true;
                }

                if (attemptError?.response?.status === 404) {
                    setError('Payment not found. It may still be processing. Try again later.');
                    setIsPolling(false);
                    return true;
                }

                return false;
            }
        };

        setIsPolling(true);
        loadAttempt();

        const timer = window.setInterval(async () => {
            const shouldStop = await loadAttempt();
            if (shouldStop) {
                clearInterval(timer);
                setIsPolling(false);
            }
        }, POLL_INTERVAL_MS);

        return () => {
            clearInterval(timer);
            setIsPolling(false);
        };
    }, [merchantTxnId]);

    const handleManualRefresh = async () => {
        if (!merchantTxnId || isPolling) return;
        
        pollAttemptsRef.current = 0;
        setLoading(true);
        setError('');
        
        try {
            const result = await paymentService.verifyPayment({ 
                merchant_txn_id: merchantTxnId 
            });
            const attemptData = result?.attempt || result;
            setAttempt(attemptData);
            
            if (TERMINAL_STATUSES.includes(attemptData?.status)) {
                setLoading(false);
            }
        } catch (err) {
            setError('Failed to refresh. Please try again.');
            setLoading(false);
        }
    };

    const status = attempt?.status || (loading ? 'PENDING' : 'UNKNOWN');

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 px-4 py-10">
                <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                    <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                        <h1 className="mt-4 text-xl font-bold text-slate-900">Verifying Payment</h1>
                        <p className="mt-2 text-sm text-slate-500">
                            Please wait while we confirm your payment...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (error && !attempt) {
        return (
            <div className="min-h-screen bg-slate-50 px-4 py-10">
                <div className="mx-auto max-w-xl rounded-3xl border border-rose-200 bg-white p-8 shadow-sm">
                    <div className="flex flex-col items-center justify-center py-8">
                        <div className="rounded-full bg-rose-100 p-4">
                            <AlertCircle className="h-10 w-10 text-rose-600" />
                        </div>
                        <h1 className="mt-4 text-xl font-bold text-rose-900">Payment Verification Failed</h1>
                        <p className="mt-2 text-sm text-rose-600 text-center max-w-sm">
                            {error}
                        </p>
                        <button
                            onClick={handleManualRefresh}
                            disabled={isPolling}
                            className="mt-6 flex items-center gap-2 rounded-2xl bg-rose-600 px-6 py-3 font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${isPolling ? 'animate-spin' : ''}`} />
                            {isPolling ? 'Verifying...' : 'Try Again'}
                        </button>
                        <Link
                            to="/tenant/payments"
                            className="mt-4 text-sm font-medium text-slate-500 hover:text-slate-700"
                        >
                            Back to Payments
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-10">
            <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Payment Return</p>
                <h1 className="mt-3 text-3xl font-black text-slate-900">
                    {status === 'SUCCESS' ? 'Payment Confirmed' : 'Payment Status'}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                    {status === 'SUCCESS' 
                        ? 'Your payment has been successfully processed.' 
                        : `Current status: ${status}. Contact support if this does not change.`}
                </p>

                <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    {status === 'SUCCESS' && (
                        <div className="flex items-center gap-3 text-emerald-700">
                            <CheckCircle2 size={20} />
                            <span className="font-medium">Your payment has been confirmed and recorded.</span>
                        </div>
                    )}

                    {status !== 'SUCCESS' && (
                        <div className="flex items-center gap-3 text-amber-700">
                            <AlertCircle size={20} />
                            <span className="font-medium">Current status: {status}</span>
                        </div>
                    )}

                    {attempt && (
                        <div className="mt-4 space-y-2 text-sm text-slate-600">
                            <div className="flex justify-between">
                                <span className="font-semibold text-slate-800">Reference:</span>
                                <span className="font-mono">{attempt.merchant_txn_id || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-semibold text-slate-800">Amount:</span>
                                <span className="font-medium">₹{Number(attempt.amount || 0).toLocaleString('en-IN')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-semibold text-slate-800">Provider:</span>
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
                    <button
                        onClick={handleManualRefresh}
                        disabled={isPolling}
                        className="flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${isPolling ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TenantPaymentReturn;