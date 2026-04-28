import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, CheckCircle, Clock, AlertCircle, Download } from 'lucide-react';
import { paymentService } from '../../../api/services';

const TenantHistoryModal = ({ isOpen, onClose, tenantId, tenantName }) => {
    const [history, setHistory] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const fetchHistory = async () => {
            if (!isOpen || !tenantId) return;
            setIsLoading(true);
            try {
                const data = await paymentService.getTenantHistory(tenantId);
                const obligations = (data?.obligations || []).map(item => ({
                    id: item.id,
                    amount: Number(item.amount),
                    month: item.rent_month,
                    date: item.due_date,
                    status: String(item.status || 'PENDING').toLowerCase(),
                    entityType: 'obligation',
                    isReceiptAvailable: false
                }));

                const payments = (data?.payments || []).map(item => ({
                    id: item.id,
                    amount: Number(item.amount_paid),
                    month: item.payment_date,
                    date: item.payment_date,
                    status: 'paid',
                    entityType: 'payment',
                    isReceiptAvailable: true
                }));

                const merged = [...obligations.filter(item => item.status !== 'paid'), ...payments]
                    .sort((a, b) => new Date(b.date) - new Date(a.date));

                setHistory(merged);
            } catch (error) {
                console.error("Failed to fetch tenant history:", error);
                setHistory([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchHistory();
    }, [isOpen, tenantId]);

    const handleDownloadReceipt = async (paymentId) => {
        try {
            const blob = await paymentService.downloadReceipt(paymentId);
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `receipt_${paymentId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to download receipt:', error);
            alert('Failed to download receipt.');
        }
    };

    if (!isOpen) return null;

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
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 transition-opacity"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden pointer-events-auto flex flex-col">
                            {/* Header */}
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">Payment History</h2>
                                    <p className="text-sm text-slate-500 font-medium">For {tenantName}</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="overflow-y-auto p-6">
                                {isLoading ? (
                                    <div className="text-center py-12 text-slate-400">
                                        <p>Loading payment history...</p>
                                    </div>
                                ) : history.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400">
                                        <p>No payment history found for this tenant.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {history.map((payment) => (
                                            <div
                                                key={payment.id}
                                                className="border border-slate-100 rounded-xl p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${payment.status === 'paid' ? 'bg-emerald-100 text-emerald-600' :
                                                        payment.status === 'overdue' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                                                        }`}>
                                                        <DollarSignIcon status={payment.status} />
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-lg">₹{payment.amount.toLocaleString()}</p>
                                                        <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                                                            <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-semibold uppercase">
                                                                {new Date(payment.month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                                                            </span>
                                                            <span>•</span>
                                                            <span className="flex items-center gap-1">
                                                                <Calendar size={12} />
                                                                {new Date(payment.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <StatusBadge status={payment.status} />
                                                    {payment.status === 'paid' && (
                                                        <button
                                                            onClick={() => handleDownloadReceipt(payment.id)}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                            title="Download Receipt"
                                                        >
                                                            <Download size={18} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
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

const DollarSignIcon = ({ status }) => {
    if (status === 'paid') return <CheckCircle size={20} />;
    if (status === 'overdue') return <AlertCircle size={20} />;
    return <Clock size={20} />;
};

const StatusBadge = ({ status }) => {
    const styles = {
        paid: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        pending: 'bg-amber-50 text-amber-700 border-amber-100',
        overdue: 'bg-rose-50 text-rose-700 border-rose-100'
    };

    return (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${styles[status]}`}>
            <span className="capitalize">{status}</span>
        </span>
    );
};

export default TenantHistoryModal;
