
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Download, TrendingUp, TrendingDown, DollarSign, Zap, CheckCircle2, AlertCircle, X, Loader2, Clock, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

// Components
import PaymentStatsCard from '../../components/owner/payments/PaymentStatsCard';
import PaymentTable from '../../components/owner/payments/PaymentTable';
import PaymentDetailsDrawer from '../../components/owner/payments/PaymentDetailsDrawer';
import TenantHistoryModal from '../../components/owner/payments/TenantHistoryModal';
import OnlinePaymentTestModal from '../../components/owner/payments/OnlinePaymentTestModal';
import { billingService, paymentService } from '../../api/services';
import { useLedger, usePendingVerifications } from '../../hooks/usePayments';
import { useQueryClient } from '@tanstack/react-query';
import { useAppPreferences } from '../../context/AppPreferencesContext';
import { formatCurrency, formatMonthYear } from '../../utils/format';

const Payments = () => {
    const navigate = useNavigate();
    const { preferences } = useAppPreferences();
    const qc = useQueryClient();
    const [confirmingId, setConfirmingId] = useState(null);
    const [confirmToast, setConfirmToast] = useState(null);
    const [canGenerateReceipts, setCanGenerateReceipts] = useState(false);
    const [planName, setPlanName] = useState('Free');

    const [tenantFilter, setTenantFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [methodFilter, setMethodFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [historyTenant, setHistoryTenant] = useState(null);
    const [onlineTestTarget, setOnlineTestTarget] = useState(null);
    const [exportLoading, setExportLoading] = useState(false);
    const [showGenModal, setShowGenModal] = useState(false);
    const [genMonth, setGenMonth] = useState('');
    const [genLoading, setGenLoading] = useState(false);
    const [genResult, setGenResult] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    const paymentFilters = useMemo(() => ({
        tenant_id: tenantFilter !== 'all' ? tenantFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter.toUpperCase() : undefined,
        method: methodFilter !== 'all' ? methodFilter : undefined,
        month: monthFilter !== 'all' ? monthFilter : undefined,
    }), [tenantFilter, statusFilter, methodFilter, monthFilter]);

    const { data: ledgerData, isLoading, refetch: refetchLedger } = useLedger(paymentFilters);
    const { data: pendingData, refetch: refetchPending } = usePendingVerifications();

    const ledgerRows = ledgerData?.payments || [];
    const paymentRecords = ledgerData?.payment_records || [];
    const summaryStats = ledgerData?.stats || {
        total_collected: 0,
        pending_dues: 0,
        overdue_amount: 0,
        active_tenants: 0,
        pending_rows: 0,
        overdue_rows: 0,
    };
    const serverTotal = Number(ledgerData?.total || 0);

    const pendingConfirmations = useMemo(() => {
        return (pendingData?.items || []).filter(i => i.status === 'PENDING_MANUAL_CONFIRMATION');
    }, [pendingData]);

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 300);
        return () => clearTimeout(t);
    }, [searchTerm]);

    useEffect(() => {
        let mounted = true;
        const loadSubscription = async () => {
            try {
                const sub = await billingService.getSubscription();
                if (!mounted) return;
                setCanGenerateReceipts(Boolean(sub?.current_plan?.can_generate_receipts));
                setPlanName(sub?.current_plan?.name || 'Free');
            } catch (_) {
                if (!mounted) return;
                setCanGenerateReceipts(false);
                setPlanName('Free');
            }
        };
        loadSubscription();
        return () => {
            mounted = false;
        };
    }, []);

    const filteredData = useMemo(() => {
        return ledgerRows.filter(item => {
            const matchesSearch = (item.tenantName || "").toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                (item.room || "").toString().includes(debouncedSearch) ||
                (item.tenantPhone || "").toString().includes(debouncedSearch);
            return matchesSearch;
        });
    }, [ledgerRows, debouncedSearch]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredData.slice(start, start + pageSize);
    }, [filteredData, currentPage, pageSize]);

    const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, monthFilter, methodFilter, tenantFilter, pageSize]);

    // Stats
    const stats = useMemo(() => {
        return {
            totalCollected: Number(summaryStats.total_collected || 0),
            totalPending: Number(summaryStats.pending_dues || 0),
            overdueAmount: Number(summaryStats.overdue_amount || 0),
            uniqueTenants: Number(summaryStats.active_tenants || 0),
            pendingRows: Number(summaryStats.pending_rows || 0),
            overdueRows: Number(summaryStats.overdue_rows || 0),
        };
    }, [summaryStats]);

    // Mark as paid
    const handleMarkAsPaid = (_formData) => {
        // Payment recorded by PaymentDetailsDrawer. Invalidate all affected cache keys
        // so every observer (ledger, dashboard, analytics) updates without a manual refresh.
        qc.invalidateQueries({ queryKey: queryKeys.payments.all() });
        qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
        qc.invalidateQueries({ queryKey: queryKeys.analytics.all() });
        setSelectedPayment(null);
    };

    const handleDownloadReceipt = async (paymentId) => {
        try {
            if (!paymentId) {
                alert('Invalid payment ID');
                return;
            }
            const blob = await paymentService.downloadReceipt(paymentId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Receipt_${paymentId.substring(0, 8)}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to download receipt:", error?.response?.data || error);
            let errorMessage = 'Failed to download receipt';
            if (error?.response?.status === 404) {
                errorMessage = 'Receipt not found';
            } else if (error?.response?.status === 403) {
                errorMessage = 'Upgrade to Growth plan to generate receipts';
            } else if (error?.response?.status === 500) {
                errorMessage = 'Server error - please try again';
            }
            alert(errorMessage);
        }
    };

    const handleDownloadFromSelection = async (payment) => {
        if (!payment?.isReceiptAvailable || !payment?.latestPaymentId) {
            alert('Receipt is only available for recorded transactions.');
            return;
        }
        await handleDownloadReceipt(payment.latestPaymentId);
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
            refetchLedger(); // refresh list
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

    const handlePreviewRent = async () => {
        setPreviewLoading(true);
        try {
            const data = await paymentService.previewGenerateRent(genMonth);
            setPreviewData(data);
        } catch (error) {
            console.error("Preview rent failed:", error);
            alert(error.response?.data?.detail?.message || 'Failed to preview monthly generation');
        } finally {
            setPreviewLoading(false);
        }
    };

    // Unique months from existing payments/transactions for month filter
    const availableMonths = useMemo(() => {
        const months = new Set(ledgerRows.map(p => p.month?.slice(0, 7)).filter(Boolean));
        return [...months].sort().reverse();
    }, [ledgerRows]);

    const availableMethods = useMemo(() => {
        const methods = new Set();
        ledgerRows.forEach((row) => {
            (row.paymentMethods || []).forEach((method) => methods.add(method));
        });
        return [...methods].sort();
    }, [ledgerRows]);

    const tenantRecentPayments = useMemo(() => {
        return paymentRecords.reduce((acc, txn) => {
            if (!txn.tenantId) return acc;
            if (!acc[txn.tenantId]) {
                acc[txn.tenantId] = [];
            }
            acc[txn.tenantId].push(txn);
            acc[txn.tenantId].sort((a, b) => new Date(b.paymentDate || b.date) - new Date(a.paymentDate || a.date));
            acc[txn.tenantId] = acc[txn.tenantId].slice(0, 5);
            return acc;
        }, {});
    }, [paymentRecords]);

    const selectedPaymentWithContext = useMemo(() => {
        if (!selectedPayment) return null;
        return {
            ...selectedPayment,
            recentPayments: selectedPayment.tenantId ? (tenantRecentPayments[selectedPayment.tenantId] || []).filter(item => item.id !== selectedPayment.id).slice(0, 3) : []
        };
    }, [selectedPayment, tenantRecentPayments]);

    const handleViewTenant = (payment) => {
        if (!payment?.tenantId) {
            alert('Tenant profile is not available for this entry.');
            return;
        }
        navigate('/owner/tenants', { state: { selectedTenantId: payment.tenantId } });
    };

    const handleOpenOnlineTest = (payment) => {
        if (!payment?.obligationId) {
            alert('No rent entry selected for payment.');
            return;
        }
        if (Number(payment?.balance || 0) <= 0) {
            alert('This rent entry has no pending balance.');
            return;
        }
        setOnlineTestTarget(payment);
    };

    const handleOnlineSettled = () => {
        refetchLedger();
    };

    const handleManualConfirm = async (attemptId) => {
        setConfirmingId(attemptId);
        setConfirmToast(null);
        try {
            await paymentService.manualConfirmPayment(attemptId);
            setConfirmToast({ type: 'success', msg: 'Payment confirmed. Rent marked as paid.' });
            refetchPending();
            refetchLedger();
        } catch (err) {
            const msg = err?.response?.data?.error || err?.response?.data?.message || 'Confirmation failed. Please try again.';
            setConfirmToast({ type: 'error', msg });
        } finally {
            setConfirmingId(null);
            setTimeout(() => setConfirmToast(null), 4000);
        }
    };

    const availableTenants = useMemo(() => {
        const map = new Map();
        ledgerRows.forEach((row) => {
            if (!row.tenantId || !row.tenantName) return;
            if (!map.has(row.tenantId)) {
                map.set(row.tenantId, row.tenantName);
            }
        });
        return [...map.entries()]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [ledgerRows]);

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Header Section */}
            <div className="flex flex-col gap-5 sticky top-0 z-20 bg-[#f8fafc] pt-2 pb-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payments & Rent Ledger</h1>
                    <p className="text-slate-500 text-sm">Unified ledger of rent, payments, balances, and collection actions.</p>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="relative group w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search tenants, phone, room..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-slate-400 shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportReport}
                            disabled={exportLoading}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm font-bold text-sm disabled:opacity-60"
                        >
                            {exportLoading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                            <span className="hidden sm:inline">{exportLoading ? 'Exporting...' : 'Export Report'}</span>
                            <span className="sm:hidden">{exportLoading ? 'Exporting...' : 'Export'}</span>
                        </button>
                        <button
                            onClick={() => {
                                setShowGenModal(true);
                                setGenResult(null);
                                setPreviewData(null);
                            }}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all font-bold text-sm active:scale-95"
                        >
                            <Zap size={16} /> 
                            <span className="hidden sm:inline">Generate Monthly Rent</span>
                            <span className="sm:hidden">Generate Rent</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Pending Manual Confirmations Panel */}
            {pendingConfirmations.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Clock size={18} className="text-amber-600" />
                            <h2 className="font-bold text-slate-900 text-base">
                                Payments Awaiting Confirmation
                            </h2>
                            <span className="ml-1 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold w-5 h-5">
                                {pendingConfirmations.length}
                            </span>
                        </div>
                        <p className="text-xs text-amber-700 hidden sm:block">
                            These UPI payments were received but require your manual approval (FREE plan).
                        </p>
                    </div>

                    {confirmToast && (
                        <div className={`mb-3 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${
                            confirmToast.type === 'success'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                            {confirmToast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                            {confirmToast.msg}
                        </div>
                    )}

                    <div className="space-y-3">
                        {pendingConfirmations.map((item) => (
                            <div
                                key={item.attempt_id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white p-4"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <UserCheck size={15} className="text-amber-600 shrink-0" />
                                        <span className="font-semibold text-slate-900 truncate">{item.tenant_name}</span>
                                        {item.room_no && item.room_no !== 'N/A' && (
                                            <span className="text-xs text-slate-500">Room {item.room_no}</span>
                                        )}
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                                        <span>₹{Number(item.amount || 0).toLocaleString('en-IN')}</span>
                                        {item.upi_reference && item.upi_reference !== '—' && (
                                            <span className="font-mono">Ref: {item.upi_reference}</span>
                                        )}
                                        {item.rent_month && (
                                            <span>{new Date(item.rent_month).toLocaleString('en-IN', { month: 'short', year: 'numeric' })}</span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2 shrink-0">
                                    <button
                                        onClick={() => handleManualConfirm(item.attempt_id)}
                                        disabled={confirmingId === item.attempt_id}
                                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                    >
                                        {confirmingId === item.attempt_id
                                            ? <Loader2 size={14} className="animate-spin" />
                                            : <CheckCircle2 size={14} />}
                                        Confirm
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!canGenerateReceipts && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <p className="text-sm font-bold text-indigo-900">Receipts are available on Growth and above</p>
                        <p className="text-xs text-indigo-700 mt-1">You are on {planName}. Existing payment history still works; upgrade to unlock receipt generation.</p>
                    </div>
                    <button
                        onClick={() => navigate('/owner/billing')}
                        className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 transition-colors"
                    >
                        Upgrade Plan
                    </button>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
                <PaymentStatsCard
                    title="Total Collected"
                    value={formatCurrency(stats.totalCollected, preferences)}
                    type="success"
                    icon={TrendingUp}
                    subtext={<span className="text-emerald-600 flex items-center gap-1"><TrendingUp size={12} /> Filtered scope</span>}
                />
                <PaymentStatsCard
                    title="Pending Dues"
                    value={formatCurrency(stats.totalPending, preferences)}
                    type="warning"
                    icon={TrendingDown}
                    subtext={<span className="text-amber-600 flex items-center gap-1">{stats.pendingRows} due rows</span>}
                />
                <PaymentStatsCard
                    title="Overdue Amount"
                    value={formatCurrency(stats.overdueAmount, preferences)}
                    type="danger"
                    icon={AlertCircle}
                    subtext={<span className="text-rose-600 flex items-center gap-1">{stats.overdueRows} overdue</span>}
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
                
                {/* Filters Bar */}
                <div className="p-4 border-b border-slate-100 bg-white space-y-4 w-full overflow-hidden">

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center pb-1 w-full">
                        <select
                            className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 hover:border-slate-300 transition-all cursor-pointer"
                            value={tenantFilter}
                            onChange={(e) => setTenantFilter(e.target.value)}
                        >
                            <option value="all">All Tenants</option>
                            {availableTenants.map((tenant) => (
                                <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                            ))}
                        </select>

                        <select
                            className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 hover:border-slate-300 transition-all cursor-pointer"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="paid">Paid</option>
                            <option value="partial">Partial</option>
                            <option value="pending">Pending</option>
                            <option value="overdue">Overdue</option>
                            <option value="waived">Waived</option>
                        </select>

                        <select
                            className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 hover:border-slate-300 transition-all cursor-pointer"
                            value={methodFilter}
                            onChange={(e) => setMethodFilter(e.target.value)}
                        >
                            <option value="all">All Methods</option>
                            {availableMethods.map(method => (
                                <option key={method} value={method}>{method}</option>
                            ))}
                        </select>

                        <select
                            className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 hover:border-slate-300 transition-all cursor-pointer"
                            value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value)}
                        >
                            <option value="all">All Months</option>
                            {availableMonths.map(m => (
                                <option key={m} value={m}>
                                    {formatMonthYear(`${m}-01`, preferences)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Table */}
                <PaymentTable
                    payments={paginatedData}
                    onSelectPayment={setSelectedPayment}
                    onViewHistory={setHistoryTenant}
                    onDownloadReceipt={handleDownloadReceipt}
                    onStartOnlineTest={handleOpenOnlineTest}
                />

                {/* Pagination */}
                <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
                    <span>Showing {filteredData.length === 0 ? 0 : ((currentPage - 1) * pageSize + 1)}-{Math.min(currentPage * pageSize, filteredData.length)} of {debouncedSearch ? filteredData.length : serverTotal} results</span>
                    <div className="flex items-center gap-2">
                        <select
                            className="px-2 py-1 border border-slate-200 rounded-lg bg-white"
                            value={String(pageSize)}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                        >
                            <option value="10">10</option>
                            <option value="25">25</option>
                            <option value="50">50</option>
                        </select>
                        <button
                            className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                            disabled={currentPage <= 1}
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        >
                            Previous
                        </button>
                        <button
                            className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        >
                            Next
                        </button>
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
                                        <p className="text-sm text-slate-500 mt-0.5">Create rent entries for all active tenants</p>
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
                                                    onChange={(e) => {
                                                        setGenMonth(e.target.value + '-01');
                                                        setPreviewData(null);
                                                    }}
                                                    max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
                                                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                                                />
                                                <p className="text-xs text-slate-400 mt-2">
                                                    This will create rent entries for all tenants who had an active room in {formatMonthYear(genMonth, preferences)}.
                                                </p>
                                            </div>

                                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
                                                <p className="font-bold mb-1">⚡ What happens next?</p>
                                                <ul className="space-y-1 text-amber-700 list-disc ml-4">
                                                    <li>Rent based on each tenant's assigned monthly rate</li>
                                                    <li>Prorated for tenants who joined mid-month</li>
                                                    <li>Tenant's "Pay Now" button becomes active</li>
                                                    <li>Already-created months are safely skipped</li>
                                                </ul>
                                            </div>

                                            {previewData && (
                                                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800">
                                                    <p className="font-bold mb-1">Preview</p>
                                                    <p>Total tenants: <span className="font-semibold">{previewData.tenants || 0}</span></p>
                                                    <p>Rent already added: <span className="font-semibold">{previewData.tenants_already_generated || 0}</span></p>
                                                    <p>New rents to create: <span className="font-semibold">{previewData.tenants_to_create || 0}</span></p>
                                                    <p>Total amount: <span className="font-semibold">{formatCurrency(previewData.total_amount || 0, preferences)}</span></p>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <button
                                                    onClick={handlePreviewRent}
                                                    disabled={previewLoading || genLoading}
                                                    className="w-full py-3 bg-white border border-indigo-200 text-indigo-700 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                                                >
                                                    {previewLoading ? <><Loader2 className="animate-spin" size={18} /> Previewing...</> : <>Preview</>}
                                                </button>

                                                <button
                                                    onClick={handleGenerateRent}
                                                    disabled={genLoading || !previewData}
                                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-60"
                                                >
                                                    {genLoading ? (
                                                        <><Loader2 className="animate-spin" size={18} /> Creating rent entries...</>
                                                    ) : (
                                                        <><Zap size={18} /> Generate</>
                                                    )}
                                                </button>
                                            </div>
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
                                                <h3 className="text-xl font-black text-slate-900">Rent Created Successfully</h3>
                                                <p className="text-slate-500 mt-1 text-sm">
                                                    {genResult.data?.created ?? 0} tenant rent{(genResult.data?.created ?? 0) !== 1 ? 's' : ''} added
                                                </p>
                                                {(genResult.data?.skipped ?? 0) > 0 && (
                                                    <p className="text-slate-400 text-xs mt-0.5">
                                                        {genResult.data.skipped} tenant{genResult.data.skipped !== 1 ? 's' : ''} already had rent for this month
                                                    </p>
                                                )}
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
                payment={selectedPaymentWithContext}
                onMarkPaid={handleMarkAsPaid}
                onDownloadReceipt={handleDownloadFromSelection}
                onViewTenant={handleViewTenant}
                onViewHistory={setHistoryTenant}
                onStartOnlineTest={handleOpenOnlineTest}
            />

            <OnlinePaymentTestModal
                isOpen={!!onlineTestTarget}
                onClose={() => setOnlineTestTarget(null)}
                obligation={onlineTestTarget}
                onSettled={handleOnlineSettled}
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
