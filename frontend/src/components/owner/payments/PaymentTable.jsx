
import React from 'react';
import { motion } from 'framer-motion';
import { MoreVertical, CheckCircle, Clock, AlertCircle, Eye, History } from 'lucide-react';

const PaymentTable = ({ payments, onSelectPayment, onViewHistory }) => {
    return (
        <div className="overflow-x-auto">
            {/* Desktop Table View */}
            <table className="w-full hidden md:table">
                <thead>
                    <tr className="border-b border-slate-100">
                        <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tenant</th>
                        <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Room</th>
                        <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Month</th>
                        <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                        <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="text-right py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {payments.length === 0 ? (
                        <tr>
                            <td colSpan="6" className="py-12 text-center">
                                <div className="flex flex-col items-center justify-center text-slate-400">
                                    <Clock size={48} className="mb-4 text-slate-200" />
                                    <p className="text-lg font-medium text-slate-900">No payments found</p>
                                    <p className="text-sm">Try adjusting your filters.</p>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        payments.map((payment) => (
                            <motion.tr
                                key={payment.id}
                                layoutId={`row-${payment.id}`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                                onClick={() => onSelectPayment(payment)}
                            >
                                <td className="py-4 px-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                            {payment.tenantName.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900 text-sm">{payment.tenantName}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-4 px-6 text-sm text-slate-600">
                                    <span className="bg-slate-100 px-2 py-1 rounded-md text-xs font-semibold text-slate-600">
                                        {payment.room}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-sm text-slate-600 font-medium">{payment.month}</td>
                                <td className="py-4 px-6 text-sm font-bold text-slate-900">₹{payment.amount.toLocaleString()}</td>
                                <td className="py-4 px-6">
                                    <StatusBadge status={payment.status} />
                                </td>
                                <td className="py-4 px-6 text-right flex items-center justify-end gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onViewHistory(payment);
                                        }}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="View History"
                                    >
                                        <History size={18} />
                                    </button>
                                    <button
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        title="View Details"
                                    >
                                        <Eye size={18} />
                                    </button>
                                </td>
                            </motion.tr>
                        ))
                    )}
                </tbody>
            </table>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4 p-4">
                {payments.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <Clock size={32} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm font-medium">No payments found</p>
                    </div>
                ) : (
                    payments.map((payment) => (
                        <motion.div
                            key={payment.id}
                            layoutId={`card-${payment.id}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm space-y-3"
                            onClick={() => onSelectPayment(payment)}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                        {payment.tenantName.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-900 text-sm">{payment.tenantName}</p>
                                        <p className="text-xs text-slate-500 font-medium">Room {payment.room}</p>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-slate-900">₹{payment.amount.toLocaleString()}</span>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-50 text-xs">
                                <span className="text-slate-500 bg-slate-50 px-2 py-1 rounded-md">{payment.month}</span>
                                <StatusBadge status={payment.status} />
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
};

const StatusBadge = ({ status }) => {
    const styles = {
        paid: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        pending: 'bg-amber-50 text-amber-700 border-amber-100',
        overdue: 'bg-rose-50 text-rose-700 border-rose-100'
    };

    const icons = {
        paid: CheckCircle,
        pending: Clock,
        overdue: AlertCircle
    };

    const Icon = icons[status] || Clock;

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.pending}`}>
            <Icon size={12} />
            <span className="capitalize">{status}</span>
        </span>
    );
};

export default PaymentTable;
