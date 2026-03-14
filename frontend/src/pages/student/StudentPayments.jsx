import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Calendar, Download, AlertCircle, CheckCircle2, Clock, Smartphone, ChevronRight, Loader2 } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { paymentService } from '../../api/services';
import PaymentModal from '../../components/student/payment/PaymentModal';

const POLL_INTERVAL_MS = 3000;  // check every 3 seconds
const POLL_MAX_ATTEMPTS = 12;   // give up after ~36 seconds

const StudentPayments = () => {
    const { user } = useAuth();
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    const [history, setHistory] = useState({ payments: [], obligations: [] });
    const [loading, setLoading] = useState(true);
    const [polling, setPolling] = useState(false);
    const pollTimerRef = useRef(null);
    const pollAttemptsRef = useRef(0);

    // Fetch data
    useEffect(() => {
        if (user?.student_id) {
            loadHistory();
        }
        return () => {
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
            setPolling(false);
        };
    }, [user]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const data = await paymentService.getStudentHistory(user.student_id);
            setHistory(data);
        } catch (error) {
            console.error("Failed to load payment history:", error);
        } finally {
            setLoading(false);
        }
    };

    // Poll until a new payment with the given razorpay_payment_id appears in history
    const startPolling = (razorpayPaymentId, previousBalance) => {
        if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        pollAttemptsRef.current = 0;
        setPolling(true);

        const check = async () => {
            pollAttemptsRef.current += 1;
            try {
                const data = await paymentService.getStudentHistory(user.student_id);

                const paymentRecorded = razorpayPaymentId
                    ? data.payments?.some(p => p.reference_number === razorpayPaymentId)
                    : Number(data.outstanding_balance) < Number(previousBalance);

                if (paymentRecorded) {
                    setHistory(data);
                    setPolling(false);
                    return;
                }
            } catch (err) {
                console.error("Polling error:", err);
            }

            if (pollAttemptsRef.current < POLL_MAX_ATTEMPTS) {
                pollTimerRef.current = setTimeout(check, POLL_INTERVAL_MS);
            } else {
                // Give up — refresh data once more and stop
                loadHistory();
                setPolling(false);
            }
        };

        pollTimerRef.current = setTimeout(check, POLL_INTERVAL_MS);
    };

    // Merge obligations and payments for the list
    const localPayments = useMemo(() => {
        const obs = (history.obligations || []).map(o => ({
            id: o.id,
            date: o.rent_month, // or due_date
            amount: o.amount,
            status: o.status.toLowerCase(), // pending, paid, partial
            type: 'Rent Due',
            method: '---'
        }));

        const pays = (history.payments || []).map(p => ({
            id: p.id,
            date: p.payment_date,
            amount: p.amount_paid,
            status: 'paid', // payments are always successful if recorded
            type: 'Payment',
            method: p.payment_method,
            reference_number: p.reference_number
        }));

        const unpaidObs = obs.filter(o => o.status !== 'paid');
        return [...unpaidObs, ...pays].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [history]);

    const pendingAmount = history.outstanding_balance || 0;

    // Derive the first pending obligation id to pass to PaymentModal
    const pendingObligationId = useMemo(() => {
        const ob = history.obligations?.find(o => o.status === 'PENDING' || o.status === 'PARTIAL');
        return ob?.id || null;
    }, [history]);

    const isOverdue = localPayments.some(p => p.status === 'overdue');

    // Compute real next due date from owner-configured due_day
    const getNextDueInfo = () => {
        const dueDay = user?.due_day;
        if (!dueDay) return { label: 'N/A', daysLeft: null };
        const now = new Date();
        let next = new Date(now.getFullYear(), now.getMonth(), dueDay);
        if (next <= now) {
            next = new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
        }
        const daysLeft = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
        const label = `${dueDay}th ${next.toLocaleString('default', { month: 'long' })}`;
        return { label, daysLeft };
    };
    const { label: nextDueDate, daysLeft } = getNextDueInfo();

    const handlePaymentSuccess = (razorpayResponse) => {
        setShowPaymentModal(false);
        // Start polling so the UI refreshes as soon as the webhook records the payment
        startPolling(razorpayResponse?.razorpay_payment_id, pendingAmount);
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payments & Dues</h1>
                    <p className="text-slate-500 text-sm">Manage your rent and payment history</p>
                </div>
            </div>

            {/* Polling / verification indicator */}
            {polling && (
                <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-sm text-indigo-700 font-medium">
                    <Loader2 size={18} className="animate-spin shrink-0" />
                    <span>Verifying your payment — this usually takes a few seconds…</span>
                </div>
            )}

            {/* 1. Payment Summary Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Rent Card */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <CreditCard size={100} />
                    </div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Monthly Rent</p>
                    <h3 className="text-3xl font-black text-slate-900">₹{(user?.monthly_rent || 0).toLocaleString()}</h3>
                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-500 font-medium">
                        <Calendar size={16} className="text-indigo-500" />
                        <span>Due on {user?.due_day ? `${user.due_day}th` : '---'} of every month</span>
                    </div>
                </div>

                {/* Due Amount Card - Dynamic Styling */}
                <div className={`p-6 rounded-2xl border shadow-sm relative overflow-hidden transition-all ${pendingAmount > 0
                    ? 'bg-rose-50 border-rose-100'
                    : 'bg-emerald-50 border-emerald-100'
                    }`}>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${pendingAmount > 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}>
                        {pendingAmount > 0 ? 'Pending Dues' : 'Payment Status'}
                    </p>
                    <h3 className={`text-3xl font-black ${pendingAmount > 0 ? 'text-rose-900' : 'text-emerald-900'
                        }`}>
                        {pendingAmount > 0 ? `₹${pendingAmount.toLocaleString()}` : 'All Clear'}
                    </h3>

                    {pendingAmount > 0 ? (
                        <div className="mt-4 flex items-center gap-2 text-sm text-rose-700 font-bold bg-rose-100/50 px-3 py-1.5 rounded-lg w-fit">
                            <Clock size={16} />
                            <span>{daysLeft} days left to pay</span>
                        </div>
                    ) : (
                        <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700 font-bold bg-emerald-100/50 px-3 py-1.5 rounded-lg w-fit">
                            <CheckCircle2 size={16} />
                            <span>Paid Successfully</span>
                        </div>
                    )}
                </div>

                {/* Pay Action Card */}
                <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl shadow-slate-900/10 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-10 -mt-10" />

                    <div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Next Due Date</p>
                        <h3 className="text-2xl font-bold">{nextDueDate}</h3>
                        {daysLeft !== null && <p className="text-slate-400 text-xs mt-1">{daysLeft} days remaining</p>}
                    </div>

                    <button
                        onClick={() => setShowPaymentModal(true)}
                        disabled={pendingAmount <= 0 || polling}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${pendingAmount > 0 && !polling
                            ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-indigo-500/30'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                    >
                        {polling ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>Verifying…</span>
                            </>
                        ) : pendingAmount > 0 ? (
                            <>
                                <span>Pay Now</span>
                                <ChevronRight size={16} />
                            </>
                        ) : (
                            <>
                                <CheckCircle2 size={16} />
                                <span>No Dues</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* 3. Payment History Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 text-lg">Payment History</h3>
                    <button className="text-indigo-600 hover:text-indigo-700 text-sm font-bold hover:underline flex items-center gap-1">
                        <Download size={16} /> Download All
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                {['Date', 'Txn ID', 'Amount', 'Method', 'Status', 'Receipt'].map(h => (
                                    <th key={h} className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {localPayments.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                                        Start your first payment to see history here.
                                    </td>
                                </tr>
                            ) : (
                                localPayments.map((txn, i) => (
                                    <motion.tr
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        key={txn.id || i}
                                        className="hover:bg-slate-50/80 transition-colors"
                                    >
                                        <td className="px-6 py-4 text-sm font-medium text-slate-700">
                                            {txn.date || 'Pending'}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-mono text-slate-500 bg-slate-100 w-fit rounded px-2 py-1">
                                            {txn.id || '---'}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-black text-slate-900">
                                            ₹{txn.amount.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            <div className="flex items-center gap-2">
                                                {txn.method === 'UPI' ? <Smartphone size={14} className="text-indigo-500" /> : <CreditCard size={14} className="text-emerald-500" />}
                                                {txn.method || '---'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${txn.status === 'paid' || txn.status === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                txn.status === 'overdue' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                    'bg-amber-50 text-amber-600 border-amber-100'
                                                }`}>
                                                {txn.status === 'paid' || txn.status === 'success' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                                                {txn.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {(txn.status === 'paid' || txn.status === 'success') && (
                                                <button className="text-slate-400 hover:text-indigo-600 transition-colors p-2 hover:bg-indigo-50 rounded-lg">
                                                    <Download size={18} />
                                                </button>
                                            )}
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Payment Modal */}
            <PaymentModal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                amount={pendingAmount > 0 ? pendingAmount : 0}
                obligationId={pendingObligationId}
                onSuccess={handlePaymentSuccess}
            />
        </div>
    );
};

export default StudentPayments;
