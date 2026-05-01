
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Download, TrendingUp, TrendingDown, DollarSign, Zap, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

// Components
import PaymentStatsCard from '../../components/owner/payments/PaymentStatsCard';
import PaymentTable from '../../components/owner/payments/PaymentTable';
import PaymentDetailsDrawer from '../../components/owner/payments/PaymentDetailsDrawer';
import TenantHistoryModal from '../../components/owner/payments/TenantHistoryModal';
import OnlinePaymentTestModal from '../../components/owner/payments/OnlinePaymentTestModal';
import { paymentService } from '../../api/services';
import { useAppPreferences } from '../../context/AppPreferencesContext';
import { formatCurrency, formatMonthYear } from '../../utils/format';

const Payments = () => {
    const navigate = useNavigate();
    const { preferences } = useAppPreferences();
    const [ledgerRows, setLedgerRows] = useState([]);
    const [paymentRecords, setPaymentRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState('all');
    const [methodFilter, setMethodFilter] = useState('all');
    const [tenantFilter, setTenantFilter] = useState('all');
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [historyTenant, setHistoryTenant] = useState(null);
    const [onlineTestTarget, setOnlineTestTarget] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Generate rent modal state
    const [showGenModal, setShowGenModal] = useState(false);
    const [genMonth, setGenMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [genLoading, setGenLoading] = useState(false);
    const [genResult, setGenResult] = useState(null); // { success, count, skipped }
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [exportLoading, setExportLoading] = useState(false);

    useEffect(() => {
        loadLedger();
    }, []);

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 300);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const normalizeStatus = (status, dueDate, balance) => {
        const raw = String(status || '').toUpperCase();
        if (raw === 'PAID') return 'paid';
        if (raw === 'WAIVED') return 'waived';
        if (raw === 'PARTIAL') {
            if (!dueDate) return 'partial';
            return new Date(dueDate) < new Date() && Number(balance) > 0 ? 'overdue' : 'partial';
        }
        if (!dueDate) return 'pending';
        return new Date(dueDate) < new Date() && Number(balance) > 0 ? 'overdue' : 'pending';
    };

    const loadLedger = async () => {
        setIsLoading(true);
        try {
            const [dues, paymentsResult] = await Promise.all([
                paymentService.getAllDues(),
                paymentService.getAll({ limit: 1000 })
            ]);

            const paymentsData = paymentsResult?.payments || [];
            const normalizedPayments = paymentsData.map(item => ({
                id: item.id,
                obligationId: item.obligation_id,
                tenantId: item.tenant_id,
                tenantName: item.tenant_name,
                amount: Number(item.amount_paid || 0),
                month: item.rent_month,
                date: item.payment_date,
                paymentDate: item.payment_date,
                createdAt: item.created_at,
                method: item.payment_method,
                status: 'paid'
            }));
            setPaymentRecords(normalizedPayments);

            const paymentsByObligation = paymentsData.reduce((acc, item) => {
                const key = item.obligation_id;
                if (!key) return acc;
                if (!acc[key]) acc[key] = [];
                acc[key].push(item);
                return acc;
            }, {});

            // Create a map of all unique obligations from both dues and payments
            const combinedObligationsMap = new Map();

            // First add all dues explicitly returned by the dues API
            (dues || []).forEach(due => {
                combinedObligationsMap.set(due.obligation_id || due.id, due);
            });

            // Then add any obligations from the completed payments that might be missing from dues
            paymentsData.forEach(p => {
                if (p.obligation_id && !combinedObligationsMap.has(p.obligation_id)) {
                    combinedObligationsMap.set(p.obligation_id, {
                        ...p.obligation,
                        obligation_id: p.obligation_id,
                        tenant_id: p.tenant_id,
                        tenant_name: p.tenant_name,
                        tenant_phone: p.tenant?.profile?.phone,
                        tenant_email: p.tenant?.profile?.email,
                        room_no: p.tenant?.allocations?.[0]?.room?.room_no || 'N/A',
                        rent_month: p.rent_month,
                        due_date: p.obligation?.due_date,
                        amount: p.obligation?.amount || p.amount_paid,
                        status: p.obligation?.status || 'PAID',
                    });
                }
            });

            const rows = Array.from(combinedObligationsMap.values()).map((item) => {
                const obligationPayments = paymentsByObligation[item.obligation_id || item.id] || [];
                const paidAmount = obligationPayments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
                const rentAmount = Number(item.amount || 0);
                const balance = Math.max(0, rentAmount - paidAmount);
                const latestPayment = obligationPayments
                    .slice()
                    .sort((a, b) => new Date(b.payment_date || b.created_at || 0) - new Date(a.payment_date || a.created_at || 0))[0];

                const status = normalizeStatus(item.status, item.due_date || item.dueDate, balance);

                return {
                    id: item.obligation_id || item.id,
                    obligationId: item.obligation_id || item.id,
                    tenantId: item.tenant_id,
                    tenantName: item.tenant_name || 'Unknown',
                    tenantPhone: item.tenant_phone || null,
                    tenantEmail: item.tenant_email || null,
                    room: item.room_no || item.room || 'N/A',
                    month: item.rent_month || item.month,
                    dueDate: item.due_date || item.dueDate,
                    rentAmount,
                    paidAmount,
                    balance,
                    status,
                    statusRaw: String(item.status || '').toUpperCase(),
                    paymentMethod: latestPayment?.payment_method || null,
                    paymentMethods: [...new Set(obligationPayments.map((p) => p.payment_method).filter(Boolean))],
                    latestPaymentId: latestPayment?.id || null,
                    reference_number: latestPayment?.reference_number || null,
                    preferred_app: latestPayment?.preferred_app || null,
                    createdAt: latestPayment?.created_at || null,
                    paymentDate: latestPayment?.payment_date || null,
                    isReceiptAvailable: Boolean(latestPayment?.id),
                    entityType: 'ledger',
                    amount: balance > 0 ? balance : paidAmount || rentAmount,
                };
            });

            // Sort rows descending by month/date so newest appear first
            const sortedRows = rows.sort((a, b) => {
                if (b.month && a.month) return new Date(b.month) - new Date(a.month);
                return 0;
            });

            setLedgerRows(sortedRows);
        } catch (error) {
            console.error('Failed to load ledger:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredData = useMemo(() => {
        return ledgerRows.filter(item => {
            const matchesSearch = (item.tenantName || "").toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                (item.room || "").toString().includes(debouncedSearch) ||
                (item.tenantPhone || "").toString().includes(debouncedSearch);
            const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
            const matchesMonth = monthFilter === 'all' || item.month?.slice(0, 7) === monthFilter;
            const matchesMethod = methodFilter === 'all' || item.paymentMethods?.includes(methodFilter);
            const matchesTenant = tenantFilter === 'all' || item.tenantName === tenantFilter;
            return matchesSearch && matchesStatus && matchesMonth && matchesMethod && matchesTenant;
        });
    }, [ledgerRows, debouncedSearch, statusFilter, monthFilter, methodFilter, tenantFilter]);

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
        const totalCollected = ledgerRows.reduce((acc, curr) => acc + Number(curr.paidAmount || 0), 0);
        const totalPending = ledgerRows
            .filter(p => ['pending', 'partial', 'overdue'].includes(p.status))
            .reduce((acc, curr) => acc + Number(curr.balance || 0), 0);
        const overdueAmount = ledgerRows
            .filter(p => p.status === 'overdue')
            .reduce((acc, curr) => acc + Number(curr.balance || 0), 0);
        const uniqueTenants = new Set(ledgerRows.map(p => p.tenantName)).size;
        return { totalCollected, totalPending, overdueAmount, uniqueTenants };
    }, [ledgerRows]);

    // Mark as paid
    const handleMarkAsPaid = async (formData) => {
        try {
            const { paymentId, amount, method, reference_number } = formData;
            const payment = ledgerRows.find(p => p.id === paymentId);
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
            loadLedger();
            setSelectedPayment(null);
        } catch (error) {
            console.error("Failed to mark as paid:", error);
            alert(error.response?.data?.detail?.message || "Failed to record payment");
        }
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
                errorMessage = 'Unauthorized access';
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
            loadLedger(); // refresh list
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
        loadLedger();
    };

    const availableTenants = useMemo(() => {
        const names = new Set(ledgerRows.map(p => p.tenantName).filter(Boolean));
        return [...names].sort();
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

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
                <PaymentStatsCard
                    title="Total Collected"
                    value={formatCurrency(stats.totalCollected, preferences)}
                    type="success"
                    icon={TrendingUp}
                    subtext={<span className="text-emerald-600 flex items-center gap-1"><TrendingUp size={12} /> This month</span>}
                />
                <PaymentStatsCard
                    title="Pending Dues"
                    value={formatCurrency(stats.totalPending, preferences)}
                    type="warning"
                    icon={TrendingDown}
                    subtext={<span className="text-amber-600 flex items-center gap-1">{ledgerRows.filter(p => ['pending', 'partial', 'overdue'].includes(p.status)).length} due rows</span>}
                />
                <PaymentStatsCard
                    title="Overdue Amount"
                    value={formatCurrency(stats.overdueAmount, preferences)}
                    type="danger"
                    icon={AlertCircle}
                    subtext={<span className="text-rose-600 flex items-center gap-1">{ledgerRows.filter(p => p.status === 'overdue').length} overdue</span>}
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
                            {availableTenants.map(name => (
                                <option key={name} value={name}>{name}</option>
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
                    <span>Showing {filteredData.length === 0 ? 0 : ((currentPage - 1) * pageSize + 1)}-{Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} results</span>
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
