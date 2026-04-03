
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Download, TrendingUp, TrendingDown, DollarSign, Zap, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Components
import PaymentStatsCard from '../../components/owner/payments/PaymentStatsCard';
import PaymentTable from '../../components/owner/payments/PaymentTable';
import PaymentDetailsDrawer from '../../components/owner/payments/PaymentDetailsDrawer';
import TenantHistoryModal from '../../components/owner/payments/TenantHistoryModal';
import { paymentService } from '../../api/services';

const Payments = () => {
    const [payments, setPayments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState('all');
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [historyTenant, setHistoryTenant] = useState(null);

    // Generate rent modal state
    const [showGenModal, setShowGenModal] = useState(false);
    const [genMonth, setGenMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [genLoading, setGenLoading] = useState(false);
    const [genResult, setGenResult] = useState(null); // { success, count, skipped }
    const [exportLoading, setExportLoading] = useState(false);

    const [activeTab, setActiveTab] = useState('dues'); // 'dues' or 'transactions'
    const [transactions, setTransactions] = useState([]);
    
    // Initial Data Load
    useEffect(() => {
        if (activeTab === 'dues') {
            loadPayments();
        } else {
            loadTransactions();
        }
    }, [activeTab]);

    const loadPayments = async () => {
        setIsLoading(true);
        try {
            const data = await paymentService.getAllDues();
            const formatted = data.map(item => ({
                id: item.obligation_id,
                tenantName: item.student_name,
                room: item.room_no,
                type: 'Rent',
                amount: Number(item.amount),
                status: item.status.toLowerCase(),
                date: item.rent_month,
                method: '---',
                isReceiptAvailable: false,
                entityType: 'obligation'
            }));
            setPayments(formatted);
        } catch (error) {
            console.error("Failed to load payments:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadTransactions = async () => {
        setIsLoading(true);
        try {
            const result = await paymentService.getAll({ limit: 100 });
            const data = result.payments || [];
            const formatted = data.map(item => ({
                id: item.id,
                tenantName: item.student_name,
                room: 'N/A', // We might need to fetch room from student profile join if needed
                type: 'Payment',
                amount: Number(item.amount_paid),
                status: 'paid',
                date: item.payment_date,
                method: item.payment_method,
                reference_number: item.reference_number,
                isReceiptAvailable: true,
                entityType: 'payment'
            }));
            setTransactions(formatted);
        } catch (error) {
            console.error("Failed to load transactions:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Filtered data depending on active tab
    const filteredData = useMemo(() => {
        const sourceData = activeTab === 'dues' ? payments : transactions;
        return sourceData.filter(item => {
            const matchesSearch = item.tenantName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.room?.toString().includes(searchTerm);
            const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
            const matchesMonth = monthFilter === 'all' || item.date?.includes(monthFilter);
            return matchesSearch && matchesStatus && matchesMonth;
        });
    }, [payments, transactions, activeTab, searchTerm, statusFilter, monthFilter]);

    // Stats
    const stats = useMemo(() => {
        const totalCollected = payments.filter(p => p.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
        const totalPending = payments.filter(p => p.status === 'pending' || p.status === 'partial').reduce((acc, curr) => acc + curr.amount, 0);
        const uniqueTenants = new Set(payments.map(p => p.tenantName)).size;
        return { totalCollected, totalPending, uniqueTenants };
    }, [payments]);

    // Mark as paid
    const handleMarkAsPaid = async (formData) => {
        try {
            const { paymentId, amount, method, reference_number } = formData;
            const payment = payments.find(p => p.id === paymentId);
            if (payment && payment.status === 'paid') return;
            const today = new Date();
            const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
            await paymentService.recordPayment({
                obligation_id: paymentId,
                amount_paid: amount || payment.amount,
                payment_method: method || "CASH",
                reference_number: reference_number || "",
                payment_date: localDate
            });
            loadPayments();
            setSelectedPayment(null);
        } catch (error) {
            console.error("Failed to mark as paid:", error);
            alert(error.response?.data?.detail?.message || "Failed to record payment");
        }
    };

    const handleDownloadReceipt = async (paymentId, fallbackReferenceNumber = null) => {
        try {
            if (!paymentId) {
                alert('Invalid payment ID');
                return;
            }
            
            const blob = await paymentService.downloadReceipt(paymentId, fallbackReferenceNumber);
            
            // Validate blob
            if (!blob || blob.size === 0) {
                throw new Error('Empty receipt file received');
            }
            
            const url = window.URL.createObjectURL(new Blob([blob]));
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
            let errorMessage = 'Failed to download receipt';
            if (error?.response?.status === 404) {
                errorMessage = 'Receipt not found';
            } else if (error?.response?.status === 403) {
                errorMessage = 'Unauthorized access';
            } else if (error?.response?.status === 500) {
                errorMessage = 'Server error - please try again';
            } else if (error?.message?.includes('Empty')) {
                errorMessage = 'Receipt file is empty';
            }
            
            alert(errorMessage);
        }
    };

    const handleDownloadFromSelection = async (payment) => {
        if (!payment?.isReceiptAvailable || payment?.entityType !== 'payment') {
            alert('Receipt is only available for recorded transactions.');
            return;
        }
        await handleDownloadReceipt(payment.id, payment.reference_number);
    };

    const handleExportReport = async () => {
        setExportLoading(true);
        try {
            const params = {};
            if (monthFilter !== 'all') {
                const [year, month] = monthFilter.split('-');
                params.year = Number(year);
                params.month = Number(month);
            }

            const { blob, contentDisposition } = await paymentService.exportReport(params);
            if (!blob || blob.size === 0) {
                throw new Error('Empty file received');
            }

            const filenameMatch = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(contentDisposition || '');
            const fileName = filenameMatch?.[1] ? decodeURIComponent(filenameMatch[1]) : 'payments_report.xlsx';

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to export payments report:', error);
            alert('Failed to export payments report. Please try again.');
        } finally {
            setExportLoading(false);
        }
    };

    // Generate monthly rent
    const handleGenerateRent = async () => {
        setGenLoading(true);
        setGenResult(null);
        try {
            const data = await paymentService.generateRent(genMonth);
            setGenResult({ success: true, data });
            loadPayments(); // refresh list
        } catch (error) {
            console.error("Generate rent failed:", error);
            const errorMessage = error.response?.data?.detail?.message 
                || error.response?.data?.message 
                || error.message 
                || 'Generation failed. Please try again.';
            setGenResult({ success: false, error: errorMessage });
        } finally {
            setGenLoading(false);
        }
    };

    // Unique months from existing payments/transactions for month filter
    const availableMonths = useMemo(() => {
        const source = activeTab === 'dues' ? payments : transactions;
        const months = new Set(source.map(p => p.date?.slice(0, 7)).filter(Boolean));
        return [...months].sort().reverse();
    }, [payments, transactions, activeTab]);

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payments</h1>
                    <p className="text-slate-500 text-sm">Track and manage tenant payments</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={handleExportReport}
                        disabled={exportLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm font-semibold text-sm disabled:opacity-60"
                    >
                        {exportLoading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                        {exportLoading ? 'Exporting...' : 'Export Report'}
                    </button>
                    <button
                        onClick={() => { setShowGenModal(true); setGenResult(null); }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all font-semibold text-sm active:scale-95"
                    >
                        <Zap size={16} /> Generate Monthly Rent
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <PaymentStatsCard
                    title="Total Collected"
                    value={`₹${stats.totalCollected.toLocaleString()}`}
                    type="success"
                    icon={TrendingUp}
                    subtext={<span className="text-emerald-600 flex items-center gap-1"><TrendingUp size={12} /> This month</span>}
                />
                <PaymentStatsCard
                    title="Pending Dues"
                    value={`₹${stats.totalPending.toLocaleString()}`}
                    type="warning"
                    icon={TrendingDown}
                    subtext={<span className="text-amber-600 flex items-center gap-1">{payments.filter(p => p.status === 'pending').length} pending</span>}
                />
                <PaymentStatsCard
                    title="Active Tenants"
                    value={stats.uniqueTenants}
                    type="primary"
                    icon={DollarSign}
                    subtext={<span className="text-indigo-600">Total occupancy</span>}
                />
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                
                {/* Tabs */}
                <div className="p-4 border-b border-slate-100 flex gap-4">
                    <button 
                        onClick={() => setActiveTab('dues')}
                        className={`pb-2 px-2 text-sm font-bold transition-all border-b-2 ${activeTab === 'dues' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                    >
                        Rent Dues
                    </button>
                    <button 
                        onClick={() => setActiveTab('transactions')}
                        className={`pb-2 px-2 text-sm font-bold transition-all border-b-2 ${activeTab === 'transactions' ? 'text-indigo-600 border-indigo-600' : 'text-slate-400 border-transparent hover:text-slate-600'}`}
                    >
                        Recent Transactions
                    </button>
                </div>

                {/* Filters Bar */}
                <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-4 justify-between items-center sticky top-0 z-10">
                    <div className="relative w-full sm:w-72 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search tenant..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
                        {activeTab === 'dues' && (
                            <select
                                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 hover:border-slate-300 transition-all cursor-pointer"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="all">All Status</option>
                                <option value="paid">Paid</option>
                                <option value="pending">Pending</option>
                                <option value="overdue">Overdue</option>
                            </select>
                        )}

                        <select
                            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 hover:border-slate-300 transition-all cursor-pointer"
                            value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value)}
                        >
                            <option value="all">All Months</option>
                            {availableMonths.map(m => (
                                <option key={m} value={m}>
                                    {new Date(m + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Table */}
                <PaymentTable
                    payments={filteredData}
                    onSelectPayment={setSelectedPayment}
                    onViewHistory={setHistoryTenant}
                    onDownloadReceipt={activeTab === 'transactions' ? handleDownloadReceipt : null}
                />

                {/* Pagination */}
                <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
                    <span>Showing {filteredData.length} results</span>
                    <div className="flex gap-2">
                        <button className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50" disabled>Previous</button>
                        <button className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50" disabled>Next</button>
                    </div>
                </div>
            </div>

            {/* Generate Monthly Rent Modal */}
            <AnimatePresence>
                {showGenModal && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => !genLoading && setShowGenModal(false)}
                            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                        >
                            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md pointer-events-auto overflow-hidden">
                                {/* Header */}
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                                    <div>
                                        <h2 className="text-xl font-black text-slate-900">Generate Monthly Rent</h2>
                                        <p className="text-sm text-slate-500 mt-0.5">Create rent obligations for all active tenants</p>
                                    </div>
                                    {!genLoading && (
                                        <button onClick={() => setShowGenModal(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400">
                                            <X size={20} />
                                        </button>
                                    )}
                                </div>

                                <div className="p-6 space-y-6">
                                    {!genResult ? (
                                        <>
                                            <div>
                                                <label className="block text-sm font-bold text-slate-700 mb-2">Select Month</label>
                                                <input
                                                    type="month"
                                                    value={genMonth.slice(0, 7)}
                                                    onChange={(e) => setGenMonth(e.target.value + '-01')}
                                                    max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
                                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                                                />
                                                <p className="text-xs text-slate-400 mt-2">
                                                    This will create pending rent obligations for all tenants who had an active allocation in {new Date(genMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}.
                                                </p>
                                            </div>

                                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
                                                <p className="font-bold mb-1">⚡ What happens next?</p>
                                                <ul className="space-y-1 text-amber-700 list-disc ml-4">
                                                    <li>Rent based on each student's assigned monthly rate</li>
                                                    <li>Prorated for students who joined/left mid-month</li>
                                                    <li>Student's "Pay Now" button becomes active</li>
                                                    <li>Already-generated months are safely skipped</li>
                                                </ul>
                                            </div>

                                            <button
                                                onClick={handleGenerateRent}
                                                disabled={genLoading}
                                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-60"
                                            >
                                                {genLoading ? (
                                                    <><Loader2 className="animate-spin" size={20} /> Generating...</>
                                                ) : (
                                                    <><Zap size={20} /> Generate for {new Date(genMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}</>
                                                )}
                                            </button>
                                        </>
                                    ) : genResult.success ? (
                                        <div className="text-center py-4 space-y-4">
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{ type: "spring", stiffness: 200, damping: 10 }}
                                                className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto"
                                            >
                                                <CheckCircle2 size={40} strokeWidth={2.5} />
                                            </motion.div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900">Rent Obligations Created!</h3>
                                                <p className="text-slate-500 mt-1 text-sm">
                                                    {genResult.data?.generated_count ?? 0} obligations generated,&nbsp;
                                                    {genResult.data?.skipped_count ?? 0} skipped (already existing).
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setShowGenModal(false)}
                                                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold transition-all hover:bg-slate-800"
                                            >
                                                Done
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 space-y-4">
                                            <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                                                <AlertCircle size={40} />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900">Generation Failed</h3>
                                                <p className="text-slate-500 mt-1 text-sm">{genResult.error}</p>
                                            </div>
                                            <button
                                                onClick={() => setGenResult(null)}
                                                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                                            >
                                                Try Again
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Details Drawer */}
            <PaymentDetailsDrawer
                isOpen={!!selectedPayment}
                onClose={() => setSelectedPayment(null)}
                payment={selectedPayment}
                onMarkPaid={handleMarkAsPaid}
                onDownloadReceipt={handleDownloadFromSelection}
            />

            {/* Tenant History Modal */}
            <TenantHistoryModal
                isOpen={!!historyTenant}
                onClose={() => setHistoryTenant(null)}
                tenantId={historyTenant?.tenantId}
                tenantName={historyTenant?.tenantName}
            />
        </div>
    );
};

export default Payments;
