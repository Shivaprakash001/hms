import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

import { paymentService } from '../../api/services';

const TERMINAL_STATUSES = ['SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED'];

const StudentPaymentReturn = () => {
    const [searchParams] = useSearchParams();
    const [attempt, setAttempt] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const attemptId = searchParams.get('attempt_id')
        || searchParams.get('merchantOrderId')
        || sessionStorage.getItem('lastPaymentAttemptId')
        || localStorage.getItem('lastPaymentAttemptId');

    useEffect(() => {
        if (!attemptId) {
            setError('No payment attempt was found to verify.');
            setLoading(false);
            return undefined;
        }

        let timer;
        const loadAttempt = async () => {
            try {
                const result = await paymentService.getAttempt(attemptId);
                setAttempt(result);
                if (result.status === 'SUCCESS') {
                    sessionStorage.removeItem('lastPaymentAttemptId');
                    localStorage.removeItem('lastPaymentAttemptId');
                    localStorage.removeItem('lastPaymentMerchantTxnId');
                }
                if (!TERMINAL_STATUSES.includes(result.status)) {
                    timer = window.setTimeout(loadAttempt, 4000);
                } else {
                    setLoading(false);
                }
            } catch (attemptError) {
                setError('Unable to verify payment status right now.');
                setLoading(false);
            }
        };

        loadAttempt();
        return () => window.clearTimeout(timer);
    }, [attemptId]);

    const status = attempt?.status || (loading ? 'PENDING' : 'UNKNOWN');

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-10">
            <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Payment Return</p>
                <h1 className="mt-3 text-3xl font-black text-slate-900">Checking your payment status</h1>
                <p className="mt-2 text-sm text-slate-500">
                    We're verifying your UPI payment. This may take a moment.
                </p>

                <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    {loading && (
                        <div className="flex items-center gap-3 text-slate-700">
                            <Loader2 className="animate-spin" size={18} />
                            <span>Verifying payment status…</span>
                        </div>
                    )}

                    {!loading && status === 'SUCCESS' && (
                        <div className="flex items-center gap-3 text-emerald-700">
                            <CheckCircle2 size={20} />
                            <span>Your payment has been confirmed and recorded.</span>
                        </div>
                    )}

                    {!loading && status !== 'SUCCESS' && (
                        <div className="flex items-center gap-3 text-amber-700">
                            <AlertCircle size={20} />
                            <span>Current status: {status}. You can retry if this does not change soon.</span>
                        </div>
                    )}

                    {attempt && (
                        <div className="mt-4 space-y-2 text-sm text-slate-600">
                            <p><span className="font-semibold text-slate-800">Attempt:</span> {attempt.id}</p>
                            <p><span className="font-semibold text-slate-800">Reference:</span> {attempt.gateway_txn_id || attempt.merchant_txn_id || 'N/A'}</p>
                            <p><span className="font-semibold text-slate-800">Provider:</span> UPI Direct</p>
                        </div>
                    )}

                    {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
                </div>

                <div className="mt-8 flex gap-3">
                    <Link
                        to="/student/payments"
                        className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
                    >
                        Back To Payments
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default StudentPaymentReturn;
