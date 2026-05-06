import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CreditCard, Calendar, Download, CheckCircle2, Clock, Smartphone, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useAppPreferences } from '../../context/AppPreferencesContext';
import { paymentService, tenantService } from '../../api/services';
import PaymentModal from '../../components/tenant/payment/PaymentModal';
import { formatCurrency, formatDate, formatDateTime, formatMonthYear } from '../../utils/format';
import TenantScoreCard from '../../components/tenant/TenantScoreCard';

const TenantPayments = () => {
    const { user } = useAuth();
    const { preferences } = useAppPreferences();
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [expandedRows, setExpandedRows] = useState({});
    const [downloadingId, setDownloadingId] = useState(null);
    const [downloadedId, setDownloadedId] = useState(null);

    const [history, setHistory] = useState({ payments: [], obligations: [] });
    const [selectedObligations, setSelectedObligations] = useState([]);
    const [tenantScore, setTenantScore] = useState(null);

    // Fetch data
    const loadHistory = useCallback(async () => {
        try {
            const data = await paymentService.getTenantHistory(user.tenant_id);
            setHistory(data);
        } catch (error) {
            console.error("Failed to load payment history:", error);
        }
    }, [user?.tenant_id]);

    useEffect(() => {
        if (user?.tenant_id) {
            loadHistory();
            tenantService.getMyScore().then(setTenantScore).catch(() => setTenantScore(null));
        }
    }, [user?.tenant_id, loadHistory]);

    const localPayments = useMemo(() => {
        const obs = (history.obligations || [])
            .filter(o => String(o.status).toUpperCase() !== 'PAID')
            .map(o => ({
                id: o.id,
                date: o.due_date || o.rent_month,
                amount: o.remaining_due ?? o.amount,
                status: 'pending',
                month_paid: o.rent_month,
                type: 'Rent Due',
                method: '---',
                transaction_id: '---'
            }));

        const pays = (history.payments || []).map(p => ({
            id: p.id,
            date: p.payment_date,
            amount: p.amount_paid,
            status: 'paid',
            type: 'Payment',
            method: p.payment_method,
            transaction_id: p.transaction_id || p.reference_number || p.id,
            month_paid: p.rent_month,
            payment_time: p.payment_date
        }));

        return [...obs, ...pays].sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [history]);

    const pendingAmount = history.outstanding_balance || 0;
    const payableObligation = useMemo(
        () => history.obligations?.find(o => o.status === 'PENDING' || o.status === 'PARTIAL' || o.status === 'pending' || o.status === 'partial'),
        [history.obligations]
    );

    const obligationsMap = useMemo(() => {
        const map = {};
        (history.obligations || []).forEach((o) => {
            map[o.id] = o;
        });
        return map;
    }, [history.obligations]);

    const selectedTotal = useMemo(() => {
        return selectedObligations.reduce((sum, id) => {
            const o = obligationsMap[id];
            const balance = Number(o?.remaining_due ?? o?.amount ?? 0);
            return sum + balance;
        }, 0);
    }, [selectedObligations, obligationsMap]);

    const selectableObligations = useMemo(() => {
        return (history.obligations || [])
            .filter((o) => {
                const status = String(o.status || '').toUpperCase();
                return status !== 'PAID' && status !== 'WAIVED';
            })
            .sort((a, b) => new Date(a.rent_month || a.due_date || 0) - new Date(b.rent_month || b.due_date || 0));
    }, [history.obligations]);

    const nextDueDate = history.next_due_date ? formatDate(history.next_due_date, preferences) : 'No dues';
    const monthlyRent = Number(history.monthly_rent || user?.monthly_rent || 0);

    const handlePaymentSuccess = async () => {
        try {
            await loadHistory();
        } catch (error) {
            console.error("Payment failed", error);
        } finally {
            setShowPaymentModal(false);
            setSelectedObligations([]);
        }
    };

    const handleDownloadReceipt = async (txn) => {
        if (!txn?.id) return;
        try {
            setDownloadingId(txn.id);
            setDownloadedId(null);
            const blob = await paymentService.downloadReceipt(txn.id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Receipt_${txn.id.substring(0, 8)}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
            setDownloadedId(txn.id);
            setTimeout(() => setDownloadedId((prev) => (prev === txn.id ? null : prev)), 3000);
        } catch (error) {
            console.error("Download failed:", error);
            alert("Failed to download receipt.");
        } finally {
            setDownloadingId((prev) => (prev === txn.id ? null : prev));
        }
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            <TenantScoreCard scoreData={tenantScore} compact />
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
                    <h3 className="text-3xl font-black text-slate-900">{formatCurrency(monthlyRent, preferences)}</h3>
                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-500 font-medium">
                        <Calendar size={16} className="text-indigo-500" />
                        <span>Due on {user?.due_day ? `${user.due_day}th` : '---'} of every month</span>
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
                        {pendingAmount > 0 ? formatCurrency(pendingAmount, preferences) : 'All Clear'}
                    </h3>

                    {pendingAmount > 0 ? (
                        <div className="mt-4 flex items-center gap-2 text-sm text-rose-700 font-bold bg-rose-100/50 px-3 py-1.5 rounded-lg w-fit">
                            <Clock size={16} />
                            <span>Payment pending</span>
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
                        disabled={selectedTotal <= 0}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${selectedTotal > 0
                            ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-indigo-500/30'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                    >
                        {selectedTotal > 0 ? (
                            <>
                                <span>Pay Selected</span>
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

            {/* 2. Select Obligations */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="font-bold text-slate-900 text-lg">Select Dues to Pay</h3>
                        <p className="text-sm text-slate-500">Choose the rent entries you want to settle now.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSelectedObligations(selectableObligations.map((o) => o.id))}
                            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                            disabled={selectableObligations.length === 0}
                        >
                            Select All
                        </button>
                        <button
                            onClick={() => setSelectedObligations([])}
                            className="text-sm font-semibold text-slate-500 hover:text-slate-700"
                            disabled={selectedObligations.length === 0}
                        >
                            Clear
                        </button>
                    </div>
                </div>
                {selectableObligations.length === 0 ? (
                    <div className="px-6 py-10 text-center text-slate-400">No pending dues available.</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {selectableObligations.map((o) => {
                            const balance = Number(o.remaining_due ?? o.amount ?? 0);
                            const isChecked = selectedObligations.includes(o.id);
                            return (
                                <label key={o.id} className="flex items-center justify-between gap-4 px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            checked={isChecked}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setSelectedObligations((prev) =>
                                                    checked ? [...prev, o.id] : prev.filter((id) => id !== o.id)
                                                );
                                            }}
                                        />
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">{formatMonthYear(o.rent_month || o.due_date, preferences)}</p>
                                            <p className="text-xs text-slate-500">Due {o.due_date ? formatDate(o.due_date, preferences) : '---'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-slate-900">{formatCurrency(balance, preferences)}</p>
                                        <p className="text-xs text-slate-500">Balance</p>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                )}
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-sm">
                    <span className="text-slate-500">Selected: {selectedObligations.length}</span>
                    <span className="font-bold text-slate-900">Total: {formatCurrency(selectedTotal, preferences)}</span>
                </div>
            </div>

            {/* 3. Payment History Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 text-lg">Payment History</h3>
                </div>

                <div className="hidden md:block overflow-x-auto">
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
                                    <tr
                                        key={txn.id || i}
                                        className="hover:bg-slate-50/80 transition-colors"
                                    >
                                        <td className="px-6 py-4 text-sm font-medium text-slate-700">
                                            {txn.date ? formatDate(txn.date, preferences) : 'Pending'}
                                        </td>
                                        <td className="px-6 py-4 text-xs font-mono text-slate-500 bg-slate-100 w-fit rounded px-2 py-1">
                                            {txn.transaction_id || '---'}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-black text-slate-900">
                                            {formatCurrency(txn.amount, preferences)}
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
                                                <button 
                                                    onClick={() => handleDownloadReceipt(txn)}
                                                    disabled={downloadingId === txn.id}
                                                    className="text-slate-400 hover:text-indigo-600 transition-colors p-2 hover:bg-indigo-50 rounded-lg"
                                                    title="Download PDF Receipt"
                                                >
                                                    {downloadingId === txn.id ? (
                                                        <Loader2 size={18} className="animate-spin" />
                                                    ) : downloadedId === txn.id ? (
                                                        <CheckCircle2 size={18} className="text-emerald-600" />
                                                    ) : (
                                                        <Download size={18} />
                                                    )}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="md:hidden divide-y divide-slate-100">
                    {localPayments.length === 0 ? (
                        <div className="px-4 py-10 text-center text-slate-400 text-sm">
                            Start your first payment to see history here.
                        </div>
                    ) : (
                        localPayments.map((txn, i) => {
                            const rowKey = txn.id || `${txn.type}-${i}`;
                            const isExpanded = Boolean(expandedRows[rowKey]);
                            return (
                                <div key={rowKey} className="px-4 py-3">
                                    <button
                                        onClick={() => setExpandedRows((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }))}
                                        className="w-full text-left"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-slate-800">
                                                    {txn.date ? formatDate(txn.date, preferences) : 'Pending'}
                                                </p>
                                                <p className="text-xs mt-1 text-slate-500">
                                                    Status: {txn.status === 'paid' ? 'Paid' : 'Pending'}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-slate-900">{formatCurrency(Number(txn.amount || 0), preferences)}</p>
                                                <ChevronDown size={16} className={`ml-auto mt-1 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </div>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2 text-xs">
                                            <p><span className="text-slate-400">Transaction ID:</span> <span className="font-mono text-slate-700">{txn.transaction_id || '---'}</span></p>
                                            <p><span className="text-slate-400">Payment Method:</span> <span className="font-semibold text-slate-700">{txn.method || '---'}</span></p>
                                            <p><span className="text-slate-400">Payment Time:</span> <span className="font-semibold text-slate-700">{txn.payment_time ? formatDateTime(txn.payment_time, preferences) : '---'}</span></p>
                                            <p><span className="text-slate-400">Month Paid:</span> <span className="font-semibold text-slate-700">{txn.month_paid ? formatMonthYear(txn.month_paid, preferences) : '---'}</span></p>
                                            {(txn.status === 'paid' || txn.status === 'success') && (
                                                <button
                                                    onClick={() => handleDownloadReceipt(txn)}
                                                    disabled={downloadingId === txn.id}
                                                    className="w-full mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-2 text-slate-700 font-semibold"
                                                >
                                                    {downloadingId === txn.id ? (
                                                        <>
                                                            <Loader2 size={14} className="animate-spin" />
                                                            Downloading...
                                                        </>
                                                    ) : downloadedId === txn.id ? (
                                                        <>
                                                            <CheckCircle2 size={14} className="text-emerald-600" />
                                                            Downloaded
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Download size={14} />
                                                            Download Receipt
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Payment Modal */}
            <PaymentModal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                amount={selectedTotal > 0 ? selectedTotal : 0}
                obligationId={selectedObligations.length === 1 ? selectedObligations[0] : null}
                obligationIds={selectedObligations}
                onSuccess={handlePaymentSuccess}
            />
        </div>
    );
};

export default TenantPayments;
