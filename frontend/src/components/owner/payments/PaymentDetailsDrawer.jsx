
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, DollarSign, CreditCard, User, Home, Download, CheckCircle } from 'lucide-react';

const PaymentDetailsDrawer = ({ isOpen, onClose, payment, onMarkPaid, onDownloadReceipt }) => {
    if (!payment) return null;

    const handleDownload = () => {
        if (onDownloadReceipt) {
            onDownloadReceipt(payment.id);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-white shadow-2xl z-50 overflow-y-auto border-l border-slate-100"
                    >
                        <div className="flex flex-col h-full">
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">Payment Details</h2>
                                    <p className="text-sm text-slate-500">Transaction ID: #{payment.id}</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 p-6 space-y-8">
                                {/* Amount Card */}
                                <div className="bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <DollarSign size={80} />
                                    </div>
                                    <p className="text-slate-400 text-sm font-medium mb-1">Total Amount</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-bold">₹{payment.amount.toLocaleString()}</span>
                                        <span className="text-sm text-slate-400">/ month</span>
                                    </div>
                                    <div className={`mt-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${payment.status === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                                        }`}>
                                        <span className={`w-2 h-2 rounded-full mr-2 ${payment.status === 'paid' ? 'bg-emerald-400' : 'bg-amber-400'
                                            }`} />
                                        {payment.status.toUpperCase()}
                                    </div>
                                </div>

                                {/* Tenant Details */}
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Tenant Information</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/30">
                                            <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                                                {payment.tenantName.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-900">{payment.tenantName}</p>
                                                <p className="text-sm text-slate-500">Tenant</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 rounded-xl border border-slate-100 bg-white">
                                                <div className="flex items-center gap-2 text-slate-500 mb-1">
                                                    <Home size={16} />
                                                    <span className="text-xs font-semibold uppercase">Room</span>
                                                </div>
                                                <p className="font-medium text-slate-900">{payment.room}</p>
                                            </div>
                                            <div className="p-4 rounded-xl border border-slate-100 bg-white">
                                                <div className="flex items-center gap-2 text-slate-500 mb-1">
                                                    <Calendar size={16} />
                                                    <span className="text-xs font-semibold uppercase">Month</span>
                                                </div>
                                                <p className="font-medium text-slate-900">{payment.month}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Transaction Info */}
                                {payment.status === 'paid' && (
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Transaction Info</h3>
                                        <div className="p-4 rounded-xl border border-slate-100 bg-white space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500 text-sm">Payment Date</span>
                                                <span className="font-medium text-slate-900">{payment.date}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500 text-sm">Payment Method</span>
                                                <span className="font-medium text-slate-900 flex items-center gap-2">
                                                    <CreditCard size={14} className="text-slate-400" />
                                                    {payment.method}
                                                </span>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={handleDownload}
                                            className="flex items-center justify-center gap-2 w-full mt-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm"
                                        >
                                            <Download size={16} /> Download Receipt
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                                {payment.status !== 'paid' ? (
                                    <button
                                        onClick={() => onMarkPaid(payment.id)}
                                        className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle size={18} />
                                        Mark as Paid
                                    </button>
                                ) : (
                                    <div className="text-center p-3 bg-emerald-50 text-emerald-600 rounded-xl font-medium border border-emerald-100 flex items-center justify-center gap-2">
                                        <CheckCircle size={18} />
                                        Payment Completed
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default PaymentDetailsDrawer;
