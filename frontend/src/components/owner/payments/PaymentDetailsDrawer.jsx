
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, DollarSign, CreditCard, User, Home, Download, CheckCircle, Phone, Mail, Receipt, ArrowUpRight, FileClock, Landmark, Smartphone } from 'lucide-react';
import { useAppPreferences } from '../../../context/AppPreferencesContext';
import { formatCurrency, formatDate, formatMonthYear } from '../../../utils/format';

const labelMethod = (method) => {
    if (!method) return 'Not recorded';
    return method.split('_').map(part => part.charAt(0) + part.slice(1).toLowerCase()).join(' ');
};

const labelPreferredApp = (value) => {
    if (!value) return null;
    const labels = {
        gpay: 'Google Pay',
        phonepe: 'PhonePe',
        paytm: 'Paytm',
        upi: 'UPI',
        other: 'Other'
    };
    return labels[String(value).toLowerCase()] || value;
};

const DetailRow = ({ label, value, icon: Icon, valueClassName = 'text-slate-900' }) => (
    <div className="flex items-start justify-between gap-4 py-3">
        <div className="flex items-center gap-2 text-sm text-slate-500">
            {Icon ? <Icon size={15} className="text-slate-400" /> : null}
            <span>{label}</span>
        </div>
        <div className={`text-sm font-semibold text-right ${valueClassName}`}>{value}</div>
    </div>
);

const SectionCard = ({ title, children }) => (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">{title}</h3>
        <div className="mt-3 divide-y divide-slate-100">{children}</div>
    </section>
);

const PaymentDetailsDrawer = ({ isOpen, onClose, payment, onMarkPaid, onDownloadReceipt, onViewTenant, onViewHistory, onStartOnlineTest }) => {
    const { preferences } = useAppPreferences();
    const [showForm, setShowForm] = useState(false);
    const [payAmount, setPayAmount] = useState('');
    const [payMethod, setPayMethod] = useState('CASH');
    const [payRef, setPayRef] = useState('');

    useEffect(() => {
        if (payment) {
            setPayAmount(payment.amount || '');
            setShowForm(false);
            setPayMethod('CASH');
            setPayRef('');
        }
    }, [payment, isOpen]);

    if (!payment) return null;

    const paymentMethodLabel = (() => {
        const base = labelMethod(payment.method);
        const app = labelPreferredApp(payment.preferred_app);
        return app ? `${base} (${app})` : base;
    })();

    const createdDate = payment.createdAt || payment.date;
    const paidDate = payment.paymentDate || payment.date;
    const timeline = [
        {
            label: 'Payment Created',
            value: formatDate(createdDate, preferences, 'Not available'),
            complete: Boolean(createdDate)
        },
        {
            label: payment.method === 'UPI' ? 'Razorpay Checkout' : 'Payment Captured',
            value: payment.status === 'paid' ? formatDate(paidDate, preferences, 'Not available') : 'Awaiting payment',
            complete: payment.status === 'paid'
        },
        {
            label: 'Payment Verified',
            value: payment.status === 'paid' ? 'Marked paid' : 'Pending verification',
            complete: payment.status === 'paid'
        },
        {
            label: 'Receipt Generated',
            value: payment.isReceiptAvailable ? 'Ready to download' : 'Available after payment',
            complete: payment.isReceiptAvailable
        }
    ];

    const handleDownload = () => {
        if (onDownloadReceipt) {
            onDownloadReceipt(payment);
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
                            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/70">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">Payment Details</h2>
                                    <p className="text-sm text-slate-500">Transaction ID: {payment.transactionId || payment.reference_number || payment.id}</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 p-6 space-y-5 bg-slate-50/60">
                                <div className="rounded-3xl bg-slate-950 p-6 text-white relative overflow-hidden">
                                    <div className="absolute right-0 top-0 p-4 opacity-10">
                                        <DollarSign size={84} />
                                    </div>
                                    <p className="text-sm font-medium text-slate-400">Amount Paid</p>
                                    <div className="mt-2 text-4xl font-bold tracking-tight">{formatCurrency(payment.amount, preferences)}</div>
                                    <p className="mt-2 text-sm text-slate-400">Rent for {formatMonthYear(payment.month || payment.date, preferences, 'Not available')}</p>
                                    <div className="mt-5 flex flex-wrap items-center gap-2">
                                        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${payment.status === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                                            }`}>
                                            <span className={`h-2 w-2 rounded-full ${payment.status === 'paid' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                            {payment.status.toUpperCase()}
                                        </span>
                                        {payment.method ? (
                                            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
                                                {paymentMethodLabel}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>

                                <SectionCard title="Payment Summary">
                                    <DetailRow label="Amount Paid" value={formatCurrency(payment.amount, preferences)} icon={DollarSign} />
                                    <DetailRow label="Status" value={payment.status?.toUpperCase() || 'PENDING'} icon={CheckCircle} valueClassName={payment.status === 'paid' ? 'text-emerald-700' : 'text-amber-700'} />
                                    <DetailRow label="Payment Method" value={paymentMethodLabel} icon={CreditCard} />
                                    <DetailRow label="Transaction ID" value={payment.transactionId || payment.reference_number || payment.id} icon={Receipt} />
                                    <DetailRow label="Payment Date" value={formatDate(payment.paymentDate || payment.date, preferences, 'Not available')} icon={Calendar} />
                                </SectionCard>

                                <SectionCard title="Rent Details">
                                    <DetailRow label="Rent Month" value={formatMonthYear(payment.month || payment.date, preferences, 'Not available')} icon={Calendar} />
                                    <DetailRow label="Room" value={payment.room || 'Not assigned'} icon={Home} />
                                    <DetailRow label="Due Date" value={formatDate(payment.dueDate, preferences, 'Not available')} icon={FileClock} />
                                    <DetailRow label="Rent Entry ID" value={payment.obligationId || payment.id} icon={Landmark} />
                                </SectionCard>

                                <SectionCard title="Tenant Information">
                                    <DetailRow label="Name" value={payment.tenantName || 'Unknown'} icon={User} />
                                    <DetailRow label="Phone" value={payment.tenantPhone || 'Not available'} icon={Phone} />
                                    <DetailRow label="Email" value={payment.tenantEmail || 'Not available'} icon={Mail} />
                                </SectionCard>

                                {payment.recentPayments?.length > 0 ? (
                                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                        <div className="flex items-center justify-between gap-3">
                                            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Recent Payments By Tenant</h3>
                                            {onViewHistory ? (
                                                <button
                                                    onClick={() => onViewHistory({ tenantId: payment.tenantId, tenantName: payment.tenantName })}
                                                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                                                >
                                                    Full history
                                                </button>
                                            ) : null}
                                        </div>
                                        <div className="mt-4 space-y-3">
                                            {payment.recentPayments.map(item => (
                                                <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900">{formatMonthYear(item.month || item.date, preferences, 'Not available')}</p>
                                                        <p className="text-xs text-slate-500">{labelMethod(item.method)}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-bold text-slate-900">{formatCurrency(item.amount, preferences)}</p>
                                                        <p className="text-xs font-semibold uppercase text-emerald-600">{item.status}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                ) : null}

                                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Payment Timeline</h3>
                                    <div className="mt-4 space-y-3">
                                        {timeline.map((event, index) => (
                                            <div key={event.label} className="flex gap-3">
                                                <div className="flex flex-col items-center">
                                                    <div className={`mt-1 h-3 w-3 rounded-full ${event.complete ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                                    {index < timeline.length - 1 ? <div className="mt-1 h-10 w-px bg-slate-200" /> : null}
                                                </div>
                                                <div className="pb-2">
                                                    <p className="text-sm font-semibold text-slate-900">{event.label}</p>
                                                    <p className="text-xs text-slate-500">{event.value}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>

                            {/* Footer Actions */}
                            <div className="p-6 border-t border-slate-100 bg-white">
                                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <button
                                        onClick={() => onViewTenant?.(payment)}
                                        className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        <ArrowUpRight size={16} />
                                        View Tenant Profile
                                    </button>
                                    <button
                                        onClick={handleDownload}
                                        disabled={!payment.isReceiptAvailable}
                                        className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                                    >
                                        <Download size={16} />
                                        Download Receipt
                                    </button>
                                </div>
                                {payment.status !== 'paid' && Number(payment.balance || 0) > 0 && payment.status !== 'waived' && (
                                    <button
                                        onClick={() => onStartOnlineTest?.(payment)}
                                        className="mb-4 w-full py-3.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl font-bold hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Smartphone size={18} />
                                        Start Online Test Checkout
                                    </button>
                                )}
                                {payment.status !== 'paid' ? (
                                    showForm ? (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Amount Paid (₹)</label>
                                                <input 
                                                    type="number"
                                                    value={payAmount}
                                                    onChange={e => setPayAmount(e.target.value)}
                                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Payment Method</label>
                                                <select 
                                                    value={payMethod}
                                                    onChange={e => setPayMethod(e.target.value)}
                                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                                                >
                                                    <option value="CASH">Cash</option>
                                                    <option value="BANK_TRANSFER">Bank Transfer</option>
                                                    <option value="UPI">UPI</option>
                                                    <option value="OTHER">Other</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Reference / Notes (Optional)</label>
                                                <input 
                                                    type="text"
                                                    value={payRef}
                                                    onChange={e => setPayRef(e.target.value)}
                                                    placeholder="Trans ID or notes"
                                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                                                />
                                            </div>
                                            <div className="flex gap-2 pt-2">
                                                <button
                                                    onClick={() => setShowForm(false)}
                                                    className="flex-1 py-3 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => onMarkPaid({
                                                        paymentId: payment.id,
                                                        amount: parseFloat(payAmount),
                                                        method: payMethod,
                                                        reference_number: payRef
                                                    })}
                                                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <CheckCircle size={18} />
                                                    Record Payment
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowForm(true)}
                                            className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle size={18} />
                                            Record Offline Payment
                                        </button>
                                    )
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
