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
    const [selectedObligation, setSelectedObligation] = useState(null);

    // Merge obligations and payments for the list
    const localPayments = useMemo(() => {
        const obs = (history.obligations || [])
            .filter(o => Number(o.amount) > 0) // Filter out ₹0 obligations
            .map(o => ({
                id: o.id,
                date: o.rent_month, // or due_date
                amount: o.amount,
                status: o.status.toLowerCase(), // pending, paid, partial
                type: 'Rent Due',
                method: '---',
                isReceiptAvailable: false,
                entityType: 'obligation'
            }));

        const pays = (history.payments || [])
            .filter(p => Number(p.amount_paid) > 0) // Filter out ₹0 payments
            .map(p => ({
                id: p.id,
                date: p.payment_date,
                amount: p.amount_paid,
                status: 'paid', // payments are always successful if recorded
                type: 'Payment',
                method: p.payment_method,
                reference_number: p.reference_number,
                isReceiptAvailable: true,
                entityType: 'payment'
            }));

        const unpaidObs = obs.filter(o => o.status !== 'paid');
        return [...unpaidObs, ...pays].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [history]);

    const unpaidObligations = useMemo(() => {
        const obs = history.obligations || [];
        const pays = history.payments || [];

        return obs.filter(o => o.status === 'PENDING' || o.status === 'PARTIAL').map(o => {
            const paidSoFar = pays
                .filter(p => p.obligation_id === o.id)
                .reduce((sum, p) => sum + Number(p.amount_paid), 0);
            
            return {
                ...o,
                paidSoFar,
                remainingBalance: Number(o.amount) - paidSoFar
            };
        }).filter(o => o.remainingBalance > 0);
    }, [history]);

    const pendingAmount = history.outstanding_balance || 0;
    const monthlyRent = user?.monthly_rent || 0;
    const rentAssigned = monthlyRent > 0;

    const isOverdue = localPayments.some(p => p.status === 'overdue');

    // Prefer the backend-calculated next due date so student UI stays aligned
    // with generated obligations and the owner's configured auto rent day.
    const getNextDueInfo = () => {
        const now = new Date();
        const backendNextDueDate = history?.next_due_date;

        if (backendNextDueDate) {
            const next = new Date(backendNextDueDate);
            next.setHours(0, 0, 0, 0);
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            const daysLeft = Math.ceil((next - today) / (1000 * 60 * 60 * 24));
            const label = next.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
            return { label, daysLeft };
        }

        const dueDay = user?.due_day;
        if (!dueDay) return { label: 'N/A', daysLeft: null };
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

    const handleDownloadReceipt = async (paymentId) => {
        try {
            if (!paymentId) {
                alert('Invalid payment selected for receipt download.');
                return;
            }
            
            // Show loading state (you can add a state variable for this)
            const blob = await paymentService.downloadReceipt(paymentId);
            
            // Validate blob
            if (!blob || blob.size === 0) {
                throw new Error('Empty receipt file received');
            }
            
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `receipt_${paymentId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to download receipt:", error?.response?.data || error);
            
            // Better error messages
            let errorMessage = 'Could not download receipt. Please try again.';
            if (error?.response?.status === 404) {
                const details = error?.response?.data?.detail;
                if (typeof details === 'object' && details?.details) {
                    errorMessage = `${details.message}\n\n${details.details}`;
                } else if (typeof details === 'string') {
                    errorMessage = details;
                } else {
                    errorMessage = 'Receipt not found. The payment may still be processing. Please wait a moment and try again.';
                }
            } else if (error?.response?.status === 403) {
                errorMessage = 'You are not authorized to download this receipt.';
            } else if (error?.response?.status === 500) {
                errorMessage = 'Server error. Please try again in a few moments.';
            } else if (error?.message?.includes('Empty')) {
                errorMessage = 'Receipt file is empty. Please contact support.';
            } else if (!navigator.onLine) {
                errorMessage = 'No internet connection. Please check your network.';
            }
            
            alert(errorMessage);
        }
    };

    const handleDownloadFromRow = async (txn) => {
        if (!txn?.isReceiptAvailable || txn?.entityType !== 'payment') {
            alert('Receipt is only available for completed payment transactions.');
            return;
        }
        await handleDownloadReceipt(txn.id);
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
                <div className={`p-6 rounded-2xl border shadow-sm relative overflow-hidden transition-all ${
                    !rentAssigned
                        ? 'bg-amber-50 border-amber-100'
                        : pendingAmount > 0
                            ? 'bg-rose-50 border-rose-100'
                            : 'bg-emerald-50 border-emerald-100'
                    }`}>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${
                        !rentAssigned ? 'text-amber-600' : pendingAmount > 0 ? 'text-rose-600' : 'text-emerald-600'
                        }`}>
                        {!rentAssigned ? 'Rent Not Set' : pendingAmount > 0 ? 'Pending Dues' : 'Payment Status'}
                    </p>
                    <h3 className={`text-3xl font-black ${
                        !rentAssigned ? 'text-amber-900' : pendingAmount > 0 ? 'text-rose-900' : 'text-emerald-900'
                        }`}>
                        {!rentAssigned ? 'Not Assigned' : pendingAmount > 0 ? `₹${pendingAmount.toLocaleString()}` : 'All Clear'}
                    </h3>

                    {!rentAssigned ? (
                        <div className="mt-4 flex items-center gap-2 text-sm text-amber-700 font-bold bg-amber-100/50 px-3 py-1.5 rounded-lg w-fit">
                            <AlertCircle size={16} />
                            <span>Contact your owner</span>
                        </div>
                    ) : pendingAmount > 0 ? (
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
                        <h3 className="text-2xl font-bold">{rentAssigned ? nextDueDate : 'N/A'}</h3>
                        {rentAssigned && daysLeft !== null && <p className="text-slate-400 text-xs mt-1">{daysLeft} days remaining</p>}
                    </div>

                    {!rentAssigned ? (
                        <div className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-amber-500/20 text-amber-400 mt-4">
                            <AlertCircle size={16} />
                            <span>No Rent Assigned</span>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                if (unpaidObligations && unpaidObligations.length > 0) {
                                    const validObs = unpaidObligations.filter(ob => ob.remainingBalance > 0);
                                    if (validObs.length > 0) {
                                        setSelectedObligation(validObs[validObs.length - 1]);
                                        setShowPaymentModal(true);
                                    }
                                }
                            }}
                            disabled={polling || (pendingAmount > 0 && unpaidObligations.filter(ob => ob.remainingBalance > 0).length === 0)}
                            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 mt-4 ${
                                polling
                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                    : pendingAmount > 0 && unpaidObligations.filter(ob => ob.remainingBalance > 0).length > 0
                                        ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-indigo-500/30'
                                        : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                            }`}
                        >
                            {polling ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Verifying…</span>
                                </>
                            ) : pendingAmount > 0 && unpaidObligations.length > 0 ? (
                                <>
                                    <CreditCard size={16} />
                                    <span>Pay ₹{pendingAmount.toLocaleString()} Now</span>
                                    <ChevronRight size={16} />
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={16} />
                                    <span>No Dues</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* 2. Pending Obligations List */}
            {unpaidObligations.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mt-8">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-rose-50/30">
                        <div>
                            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                                <AlertCircle size={20} className="text-rose-500" />
                                Pending Dues ({unpaidObligations.length})
                            </h3>
                            <p className="text-slate-500 text-sm mt-1">Please clear these dues.</p>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        {unpaidObligations.map(ob => (
                            <div key={ob.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors bg-white shadow-sm">
                                <div>
                                    <h4 className="font-black text-slate-900 text-lg">
                                        {new Date(ob.rent_month).toLocaleString('default', { month: 'long', year: 'numeric' })} Rent
                                    </h4>
                                    <div className="flex flex-wrap gap-4 mt-2 text-sm font-medium">
                                        <div className="text-slate-500">
                                            Total: <span className="text-slate-900">₹{Number(ob.amount).toLocaleString()}</span>
                                        </div>
                                        {ob.paidSoFar > 0 && (
                                            <div className="text-emerald-600">
                                                Paid: ₹{ob.paidSoFar.toLocaleString()}
                                            </div>
                                        )}
                                        <div className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded">
                                            Remaining: ₹{ob.remainingBalance.toLocaleString()}
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2">Due Date: {ob.due_date}</p>
                                </div>
                                <button
                                    onClick={() => {
                                        if (ob.remainingBalance > 0) {
                                            setSelectedObligation(ob);
                                            setShowPaymentModal(true);
                                        }
                                    }}
                                    disabled={ob.remainingBalance <= 0}
                                    className={`px-6 py-3 rounded-xl font-bold shadow-sm transition-all flex items-center gap-2 shrink-0 ${
                                        ob.remainingBalance > 0 
                                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95' 
                                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    }`}
                                >
                                    {ob.remainingBalance > 0 ? (
                                        <>Pay Now <ChevronRight size={16} /></>
                                    ) : (
                                        <>Processing...</>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                                            ₹{Number(txn.amount).toLocaleString()}
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
                                            {(txn.status === 'paid' || txn.status === 'success') && txn.isReceiptAvailable && (
                                                <button 
                                                    onClick={() => handleDownloadFromRow(txn)}
                                                    className="text-slate-400 hover:text-indigo-600 transition-colors p-2 hover:bg-indigo-50 rounded-lg">
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
                onClose={() => { setShowPaymentModal(false); setSelectedObligation(null); }}
                amount={selectedObligation ? selectedObligation.remainingBalance : (pendingAmount > 0 ? pendingAmount : 0)}
                obligationId={selectedObligation ? selectedObligation.id : null}
                onSuccess={handlePaymentSuccess}
            />
        </div>
    );
};

export default StudentPayments;
