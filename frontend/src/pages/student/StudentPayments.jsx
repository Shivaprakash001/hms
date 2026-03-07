import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Calendar, Download, AlertCircle, CheckCircle2, Clock, Smartphone, ChevronRight } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { paymentService } from '../../api/services';
import PaymentModal from '../../components/student/payment/PaymentModal';

const StudentPayments = () => {
    const { user } = useAuth();
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    const [history, setHistory] = useState({ payments: [], obligations: [] });
    const [loading, setLoading] = useState(true);

    // Fetch data
    useEffect(() => {
        if (user?.id) {
            loadHistory();
        }
    }, [user]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const data = await paymentService.getStudentHistory(user.id);
            setHistory(data);
        } catch (error) {
            console.error("Failed to load payment history:", error);
        } finally {
            setLoading(false);
        }
    };

    // Merge obligations and payments for the list
    const localPayments = React.useMemo(() => {
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
            method: p.payment_method
        }));

        // Filter out paid obligations from visual list if you only want to show history of "Events"
        // But usually students want to see "Rent for Feb" (Paid).
        // If an obligation is PAID, it duplicates information with the Payment?
        // Let's show Payments as the "History" of transactions.
        // And Obligations as "Dues".
        // The table columns are: Date, Txn ID, Amount, Method, Status.
        // This looks like a transaction ledger. 
        // So we should primarily show PAYMENTS.
        // But if we want to show "Pending", we must include unpaid obligations.

        const unpaidObs = obs.filter(o => o.status !== 'paid');
        return [...unpaidObs, ...pays].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [history]);

    const pendingAmount = history.outstanding_balance || 0;

    const isOverdue = localPayments.some(p => p.status === 'overdue');
    // Mock logic for next due date
    const nextDueDate = "5th " + new Date().toLocaleString('default', { month: 'long' });

    // Countdown logic (Mock)
    const daysLeft = 4; // Mock countdown

    const handlePaymentSuccess = async (paymentData) => {
        // PaymentModal returns data, we need to send to API
        try {
            // Find the pending obligation to pay against
            // For simplicity, pay against the oldest pending obligation
            // OR PaymentModal should handle the API call? 
            // If PaymentModal just returns card details, we call API here.
            // Let's assume PaymentModal handles the UI and returns "success".
            // User likely wants to pay the TOTAL pending amount.
            // We need to know WHICH obligation.
            // Auto-pay logic: Distribute amount across pending obligations?
            // Backend `record_payment` takes `obligation_id`.
            // So the modal or this handler needs to select the obligation.

            // For this iteration, let's assume we find the first pending obligation
            const pendingOb = history.obligations.find(o => o.status === 'pending' || o.status === 'partial');
            if (!pendingOb) {
                alert("No pending dues to pay!");
                return;
            }

            await paymentService.recordPayment({
                obligation_id: pendingOb.id,
                amount_paid: paymentData.amount || pendingAmount, // Assume full pay
                payment_method: "UPI", // Mock method from modal?
                payment_date: new Date().toISOString().split('T')[0]
            });

            loadHistory();
            setShowPaymentModal(false);
        } catch (error) {
            console.error("Payment failed", error);
            alert("Payment failed");
        }
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payments & Dues</h1>
                    <p className="text-slate-500 text-sm">Manage your rent and payment history</p>
                </div>
            </div>

            {/* 1. Payment Summary Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Rent Card */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <CreditCard size={100} />
                    </div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Monthly Rent</p>
                    <h3 className="text-3xl font-black text-slate-900">₹{user?.rent?.toLocaleString()}</h3>
                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-500 font-medium">
                        <Calendar size={16} className="text-indigo-500" />
                        <span>Due on 5th of every month</span>
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
                    </div>

                    <button
                        onClick={() => setShowPaymentModal(true)}
                        disabled={pendingAmount <= 0}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${pendingAmount > 0
                            ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-indigo-500/30'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                    >
                        {pendingAmount > 0 ? (
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
                onSuccess={handlePaymentSuccess}
            />
        </div>
    );
};

export default StudentPayments;
