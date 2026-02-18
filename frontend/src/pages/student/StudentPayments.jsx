import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Calendar, Download, AlertCircle, CheckCircle2, Clock, Smartphone, ChevronRight } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { MOCK_PAYMENTS } from '../../utils/mockData';
import PaymentModal from '../../components/student/payment/PaymentModal';

const StudentPayments = () => {
    const { user } = useAuth();
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // Simulate local state for payments to show instant updates
    const [localPayments, setLocalPayments] = useState(
        MOCK_PAYMENTS
            .filter(p => p.tenantId === user?.id)
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    );

    const pendingAmount = localPayments
        .filter(p => p.status === 'pending' || p.status === 'overdue')
        .reduce((sum, p) => sum + p.amount, 0);

    const isOverdue = localPayments.some(p => p.status === 'overdue');
    const nextDueDate = "5th " + new Date().toLocaleString('default', { month: 'long' }); // Mock logic

    // Countdown logic (Mock)
    const daysLeft = 4; // Mock countdown

    const handlePaymentSuccess = (newPayment) => {
        // Add new payment to top of list
        const paymentEntry = {
            ...newPayment,
            tenantId: user.id,
            tenantName: user.name,
            room: user.roomId,
            month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' })
        };

        // Update local state: Add new payment and mark pending as paid (mock logic)
        // In real app, we'd fetch updated data
        const updatedPendingRaw = localPayments.map(p => {
            if (p.status === 'pending' || p.status === 'overdue') {
                return { ...p, status: 'paid', date: paymentEntry.date, method: paymentEntry.method };
            }
            return p;
        });

        // For demo, just prepend the success entry if we want to show strict history
        // Or better, update the existing pending mock entry if it exists
        setLocalPayments([paymentEntry, ...updatedPendingRaw.filter(p => p.status !== 'pending' && p.status !== 'overdue')]);
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
