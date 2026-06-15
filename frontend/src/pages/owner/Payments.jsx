import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Banknote, CalendarClock, CheckCircle2, ChevronDown, Clock, CreditCard, Download, FileText, History, Landmark, Loader2, RefreshCw, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Sparkles, WalletCards, X, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

import PaymentDetailsDrawer from '../../components/owner/payments/PaymentDetailsDrawer';
import TenantHistoryModal from '../../components/owner/payments/TenantHistoryModal';
import OnlinePaymentModal from '../../components/owner/payments/OnlinePaymentModal';
import { billingService, paymentService } from '../../api/services';
import { useLedger, usePendingVerifications } from '../../hooks/usePayments';
import { useAppPreferences } from '../../context/AppPreferencesContext';
import { useHostelContext } from '../../context/HostelContext';
import { queryKeys } from '../../lib/query/queryKeys';
import { formatCurrency, formatDate, formatMonthYear } from '../../utils/format';

const tabs = [
  { id: 'dues', label: 'Dues', icon: WalletCards },
  { id: 'collections', label: 'Collections', icon: Banknote },
  { id: 'deposits', label: 'Deposits', icon: ShieldCheck },
  { id: 'refunds', label: 'Refunds', icon: RotateCcw },
  { id: 'settlements', label: 'Settlements', icon: Landmark },
  { id: 'receipts', label: 'Receipts', icon: FileText },
];

const statusStyles = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  partial: 'bg-sky-50 text-sky-700 border-sky-100',
  overdue: 'bg-rose-50 text-rose-700 border-rose-100',
  waived: 'bg-slate-100 text-slate-700 border-slate-200',
  pending_verification: 'bg-violet-50 text-violet-700 border-violet-100 animate-pulse',
  processing: 'bg-blue-50 text-blue-700 border-blue-100 animate-pulse',
};

function normalizeRentPreview(previewData) {
  if (!previewData) return null;
  const items = Array.isArray(previewData.items) ? previewData.items : [];
  const willCreate = Number(previewData.tenants_to_create ?? previewData.will_create ?? items.filter((item) => !item.will_skip).length ?? 0);
  return {
    items,
    totalTenants: Number(previewData.tenants ?? previewData.total ?? items.length ?? 0),
    alreadyGenerated: Number(previewData.tenants_already_generated ?? items.filter((item) => item.already_generated).length ?? 0),
    willCreate,
    willSkip: Number(previewData.will_skip ?? Math.max(items.length - willCreate, 0) ?? 0),
    totalAmount: Number(previewData.total_amount ?? items.reduce((sum, item) => sum + (!item.will_skip ? Number(item.rent_amount || 0) : 0), 0)),
  };
}

const daysBetween = (dateValue) => {
  if (!dateValue) return 0;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
};

const cycleKey = (row) => `${row.tenantId || row.tenantName || 'tenant'}-${String(row.month || row.date || 'cycle').slice(0, 10)}`;

const buildFinancialItem = (row) => {
  const monthlyStay = Number(row.rentAmount ?? row.amount ?? 0);
  const paid = Number(row.paidAmount ?? 0);
  const outstanding = Number(row.balance ?? Math.max(monthlyStay - paid, 0));
  const maintenance = Number(row.maintenanceAmount ?? row.maintenance_amount ?? 0);
  const credits = Number(row.creditAmount ?? row.credit_amount ?? 0);
  const previousAdjustments = Number(row.adjustmentAmount ?? row.adjustment_amount ?? 0);
  const status = String(row.status || (outstanding <= 0 ? 'paid' : 'pending')).toLowerCase();
  return {
    ...row,
    id: row.id || row.obligationId || cycleKey(row),
    obligationId: row.obligationId || row.id,
    cycle: row.month || row.date || row.rent_month,
    room: row.room || row.roomNo || row.room_no || 'Unassigned',
    monthlyStay,
    maintenance,
    credits,
    previousAdjustments,
    paid,
    outstanding,
    finalTotal: Math.max(monthlyStay + maintenance + previousAdjustments - credits, 0),
    status,
    overdueDays: status === 'overdue' ? Math.max(daysBetween(row.dueDate || row.due_date), 1) : 0,
    dueDate: row.dueDate || row.due_date,
  };
};

function EmptyState({ icon: Icon = Sparkles, title, text }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Icon size={22} /></div>
      <h3 className="mt-4 text-base font-black text-slate-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{text}</p>
    </div>
  );
}

function SkeletonFinancials() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-3xl bg-slate-100" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-64 animate-pulse rounded-3xl bg-slate-100" />)}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, title, amount, explanation, trend, tone = 'slate' }) {
  const toneMap = {
    slate: 'bg-slate-900 text-white border-slate-900',
    blue: 'bg-blue-50 text-blue-800 border-blue-100',
    green: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    amber: 'bg-amber-50 text-amber-800 border-amber-100',
    rose: 'bg-rose-50 text-rose-800 border-rose-100',
  };
  const dark = tone === 'slate';
  return (
    <section className={`rounded-3xl border p-5 shadow-sm ${toneMap[tone] || toneMap.slate}`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${dark ? 'bg-white/10 text-white' : 'bg-white/80 text-current'}`}><Icon size={20} /></div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${dark ? 'bg-white/10 text-slate-200' : 'bg-white/75 text-current'}`}>{trend}</span>
      </div>
      <p className={`mt-5 text-xs font-black uppercase tracking-[0.18em] ${dark ? 'text-slate-300' : 'text-current/70'}`}>{title}</p>
      <div className="mt-2 text-2xl font-black tracking-tight">{amount}</div>
      <p className={`mt-3 text-sm leading-5 ${dark ? 'text-slate-300' : 'text-current/75'}`}>{explanation}</p>
    </section>
  );
}

function StatusPill({ status, label }) {
  const prettyLabels = {
    pending_verification: 'Verifying',
    processing: 'Processing',
  };
  const displayLabel = label || prettyLabels[status] || status;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyles[status] || statusStyles.pending}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{displayLabel}</span>;
}

function AmountLine({ label, amount, helper, strong = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div>
        <p className={`${strong ? 'font-black text-slate-900' : 'font-semibold text-slate-700'} text-sm`}>{label}</p>
        {helper ? <p className="mt-0.5 text-xs text-slate-500">{helper}</p> : null}
      </div>
      <p className={`${strong ? 'text-lg font-black text-slate-950' : 'text-sm font-bold text-slate-800'} shrink-0`}>{amount}</p>
    </div>
  );
}

function FinancialCard({ item, preferences, onBreakdown, onCollect, onHistory }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-black text-slate-950">{item.tenantName || 'Tenant'} <span className="font-semibold text-slate-400">- Room {item.room}</span></h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{formatMonthYear(item.cycle, preferences, 'Current cycle')}</p>
        </div>
        <StatusPill status={item.status} label={item.status === 'overdue' ? `${item.overdueDays}d overdue` : item.status} />
      </div>

      <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-2">
        <AmountLine label={`Monthly Stay - ${formatMonthYear(item.cycle, preferences, 'Cycle')}`} helper="Includes any late fee adjustment in one payable amount" amount={formatCurrency(item.monthlyStay, preferences)} />
        {item.maintenance > 0 ? <AmountLine label="Maintenance Charges" helper="Operational utilities and service adjustments" amount={formatCurrency(item.maintenance, preferences)} /> : null}
        {item.previousAdjustments > 0 ? <AmountLine label="Previous Adjustments" amount={formatCurrency(item.previousAdjustments, preferences)} /> : null}
        {item.credits > 0 ? <AmountLine label="Credits Applied" amount={`-${formatCurrency(item.credits, preferences)}`} /> : null}
        <div className="mt-2 border-t border-slate-200 pt-2">
          <AmountLine label="Outstanding" amount={formatCurrency(item.outstanding, preferences)} strong />
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-500">This amount includes pending monthly stay and adjustments. Deposits and refundable balances are handled separately.</p>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:flex">
        <button onClick={() => onBreakdown(item)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><ChevronDown size={16} />Breakdown</button>
        <button onClick={() => onHistory(item)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"><History size={16} />Timeline</button>
        {item.outstanding > 0 ? <button onClick={() => onCollect(item)} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 sm:ml-auto"><WalletCards size={16} />Collect Payment</button> : null}
      </div>
    </article>
  );
}

function BreakdownDrawer({ item, preferences, onClose, onCollect, onHistory }) {
  return (
    <AnimatePresence>
      {item && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm" />
          <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 26, stiffness: 210 }} className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto border-l border-slate-200 bg-slate-50 shadow-2xl sm:max-w-lg">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white/95 p-5 backdrop-blur">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Financial Breakdown</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">{item.tenantName || 'Tenant'} - Room {item.room}</h2>
                <p className="text-sm text-slate-500">{formatMonthYear(item.cycle, preferences, 'Billing cycle')}</p>
              </div>
              <button onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
            </div>
            <div className="space-y-5 p-5">
              <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <p className="text-sm font-bold text-slate-500">Final Total</p>
                <p className="mt-2 text-4xl font-black text-slate-950">{formatCurrency(item.outstanding, preferences)}</p>
                <p className="mt-3 text-sm text-slate-500">Late fees are included inside Monthly Stay so tenants pay one clear obligation.</p>
              </section>
              <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">You are collecting for</h3>
                <div className="mt-4 divide-y divide-slate-100">
                  <AmountLine label={`Monthly Stay (${formatMonthYear(item.cycle, preferences, 'Cycle')})`} helper="Includes late fee adjustment" amount={formatCurrency(item.monthlyStay, preferences)} />
                  <AmountLine label="Maintenance Charges" helper="WiFi, utilities, cleaning, repairs or service adjustments" amount={formatCurrency(item.maintenance, preferences)} />
                  <AmountLine label="Previous Adjustments" amount={formatCurrency(item.previousAdjustments, preferences)} />
                  <AmountLine label="Credits" amount={`-${formatCurrency(item.credits, preferences)}`} />
                  <AmountLine label="Final Total" amount={formatCurrency(item.outstanding, preferences)} strong />
                </div>
              </section>
              <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Financial Activity Timeline</h3>
                <div className="mt-4 space-y-4">
                  {[
                    ['Monthly stay generated', formatDate(item.createdAt || item.cycle, preferences, 'Generated for cycle'), true],
                    ['Late fee applied', item.status === 'overdue' ? 'Included in Monthly Stay' : 'No separate payment row', true],
                    ['Payment status updated', item.status === 'paid' ? 'Completed' : item.status === 'partial' ? 'Partial payment received' : 'Awaiting collection', true],
                    ['Receipt', item.latestPaymentId ? 'Available after collection' : 'Created once payment is recorded', Boolean(item.latestPaymentId)],
                  ].map(([label, value, active]) => (
                    <div key={label} className="flex gap-3">
                      <span className={`mt-1 h-3 w-3 rounded-full ${active ? 'bg-slate-900' : 'bg-slate-200'}`} />
                      <div><p className="text-sm font-bold text-slate-900">{label}</p><p className="text-sm text-slate-500">{value}</p></div>
                    </div>
                  ))}
                </div>
              </section>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => onHistory(item)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">Full History</button>
                {item.outstanding > 0 ? <button onClick={() => onCollect(item)} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">Collect Payment</button> : <button className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">Settled</button>}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

const Payments = () => {
  const navigate = useNavigate();
  const { hostelId } = useHostelContext();
  const { preferences } = useAppPreferences();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('dues');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [recordItem, setRecordItem] = useState(null);
  const [historyTenant, setHistoryTenant] = useState(null);
  const [onlinePaymentTarget, setOnlinePaymentTarget] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [toast, setToast] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [canGenerateReceipts, setCanGenerateReceipts] = useState(false);
  const [planName, setPlanName] = useState('Free');
  const [showGenModal, setShowGenModal] = useState(false);
  const [genMonth, setGenMonth] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState(null);

  const filters = useMemo(() => ({ status: statusFilter !== 'all' ? statusFilter.toUpperCase() : undefined }), [statusFilter]);
  const { data: ledgerData, isLoading, isError, refetch } = useLedger(hostelId, filters);
  const { data: pendingData, refetch: refetchPending } = usePendingVerifications(hostelId);
  const rentPreview = useMemo(() => normalizeRentPreview(previewData), [previewData]);

  const financialItems = useMemo(() => (ledgerData?.payments || []).map(buildFinancialItem), [ledgerData]);
  const pendingConfirmations = useMemo(() => (pendingData?.items || []).filter((item) => item.status === 'PENDING_MANUAL_CONFIRMATION'), [pendingData]);

  useEffect(() => {
    let mounted = true;
    billingService.getSubscription().then((sub) => {
      if (!mounted) return;
      setCanGenerateReceipts(Boolean(sub?.current_plan?.can_generate_receipts));
      setPlanName(sub?.current_plan?.name || 'Free');
    }).catch(() => mounted && setCanGenerateReceipts(false));
    return () => { mounted = false; };
  }, []);

  const visibleItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return financialItems.filter((item) => {
      const matchesSearch = !query || [item.tenantName, item.room, item.tenantPhone].some((value) => String(value || '').toLowerCase().includes(query));
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      if (!matchesSearch || !matchesStatus) return false;
      if (activeTab === 'dues') return item.outstanding > 0;
      if (activeTab === 'collections') return item.paid > 0 || item.status === 'paid';
      if (activeTab === 'receipts') return item.latestPaymentId || item.status === 'paid';
      return true;
    });
  }, [activeTab, financialItems, searchTerm, statusFilter]);

  const metrics = useMemo(() => {
    const outstanding = financialItems.reduce((sum, item) => sum + (item.outstanding > 0 ? item.monthlyStay : 0), 0);
    const maintenance = financialItems.reduce((sum, item) => sum + (item.outstanding > 0 ? item.maintenance : 0), 0);
    const collected = Number(ledgerData?.stats?.total_collected || financialItems.reduce((sum, item) => sum + item.paid, 0));
    const overdue = financialItems.filter((item) => item.status === 'overdue' || item.overdueDays > 0);
    return {
      outstanding,
      depositsHeld: Number(ledgerData?.stats?.security_deposits_held || ledgerData?.stats?.deposits_held || 0),
      pendingRefunds: Number(ledgerData?.stats?.pending_refunds || 0),
      overdueAccounts: overdue.length,
      maxOverdueDays: overdue.reduce((max, item) => Math.max(max, item.overdueDays), 0),
      maintenance,
      collected,
    };
  }, [financialItems, ledgerData]);

  const handleRefreshAll = () => {
    refetch();
    refetchPending();
  };

  const handleMarkAsPaid = () => {
    qc.invalidateQueries({ queryKey: queryKeys.payments.all(hostelId) });
    qc.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
    qc.invalidateQueries({ queryKey: queryKeys.analytics.all(hostelId) });
    setRecordItem(null);
    setSelectedItem(null);
  };

  const handleManualConfirm = async (attemptId) => {
    setConfirmingId(attemptId);
    setToast(null);
    try {
      await paymentService.manualConfirmPayment(attemptId);
      setToast({ type: 'success', msg: 'Payment confirmed and added to collections.' });
      handleRefreshAll();
    } catch (err) {
      setToast({ type: 'error', msg: err?.response?.data?.message || 'Confirmation failed. Please try again.' });
    } finally {
      setConfirmingId(null);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleDownloadReceipt = async (payment) => {
    const paymentId = payment?.latestPaymentId || payment?.id || payment;
    if (!paymentId) return alert('Receipt is available after payment is recorded.');
    try {
      const blob = await paymentService.downloadReceipt(paymentId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt_${String(paymentId).slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert(error?.response?.data?.detail || 'Failed to download receipt.');
    }
  };

  const handleExportReport = async () => {
    setExportLoading(true);
    try {
      const { blob, contentDisposition } = await paymentService.exportReport({});
      const filenameMatch = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(contentDisposition || '');
      const fileName = filenameMatch?.[1] ? decodeURIComponent(filenameMatch[1]) : 'financials_report.xlsx';
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export financial report. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const handlePreviewRent = async () => {
    setPreviewLoading(true);
    try {
      setPreviewData(await paymentService.previewGenerateRent(hostelId, genMonth));
    } catch (error) {
      alert(error?.response?.data?.detail?.message || 'Failed to preview monthly stay generation.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleGenerateRent = async () => {
    setGenLoading(true);
    setGenResult(null);
    try {
      const data = await paymentService.generateRent(hostelId, genMonth);
      setGenResult({ success: true, data });
      handleRefreshAll();
    } catch (error) {
      setGenResult({ success: false, error: error?.response?.data?.detail?.message || error?.message || 'Generation failed.' });
    } finally {
      setGenLoading(false);
    }
  };

  const depositsView = activeTab === 'deposits';
  const refundsView = activeTab === 'refunds';
  const settlementsView = activeTab === 'settlements';

  return (
    <div className="space-y-7 animate-fade-in-up">
      <header className="sticky top-0 z-20 -mx-2 bg-slate-50/95 px-2 pb-4 pt-2 backdrop-blur">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Hostel money operations</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Financials</h1>
            <p className="mt-1 text-sm text-slate-500">Clear dues, collections, deposits, refunds, settlements, and receipts without ledger noise.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button onClick={handleRefreshAll} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"><RefreshCw size={16} />Refresh</button>
            <button onClick={handleExportReport} disabled={exportLoading} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">{exportLoading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}Export</button>
            <button onClick={() => { setShowGenModal(true); setGenResult(null); setPreviewData(null); }} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800"><Zap size={16} />Generate Monthly Stay</button>
          </div>
        </div>
      </header>

      {isLoading ? <SkeletonFinancials /> : isError ? (
        <EmptyState icon={AlertCircle} title="Financials could not load" text="Please refresh once. Your existing records are safe; this screen only reads operational financial data." />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard icon={WalletCards} title="Outstanding Monthly Stay" amount={formatCurrency(metrics.outstanding, preferences)} explanation="Monthly stay amounts still awaiting collection. Late fees are included in this single payable amount." trend={`${financialItems.filter((i) => i.outstanding > 0).length} accounts`} />
            <MetricCard icon={ShieldCheck} title="Security Deposits Held" amount={formatCurrency(metrics.depositsHeld, preferences)} explanation="Refundable deposit balance kept separate from rent collections." trend="Liability" tone="blue" />
            <MetricCard icon={RotateCcw} title="Pending Refunds" amount={formatCurrency(metrics.pendingRefunds, preferences)} explanation="Refunds waiting for owner action or settlement completion." trend={metrics.pendingRefunds > 0 ? 'Needs review' : 'Clear'} tone="green" />
            <MetricCard icon={Clock} title="Overdue Accounts" amount={String(metrics.overdueAccounts)} explanation="Accounts past due. Use calm reminders before escalation." trend={metrics.maxOverdueDays ? `Oldest ${metrics.maxOverdueDays}d` : 'No aging'} tone={metrics.overdueAccounts > 0 ? 'rose' : 'green'} />
            <MetricCard icon={CalendarClock} title="Maintenance Charges Due" amount={formatCurrency(metrics.maintenance, preferences)} explanation="Operational charges such as WiFi, electricity, cleaning, repairs, and utility adjustments." trend="Operational" tone="amber" />
            <MetricCard icon={Banknote} title="This Month Collections" amount={formatCurrency(metrics.collected, preferences)} explanation="Recorded collections in the current filtered scope." trend="Collected" tone="green" />
          </section>

          {pendingConfirmations.length > 0 && (
            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-base font-black text-slate-950">Collection confirmations</h2><p className="text-sm text-amber-800">UPI references received and waiting for owner approval.</p></div>
                {toast ? <span className={`rounded-full px-3 py-1 text-xs font-bold ${toast.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{toast.msg}</span> : null}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {pendingConfirmations.map((item) => (
                  <div key={item.attempt_id} className="rounded-2xl border border-amber-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-900">{item.tenant_name}</p><p className="text-sm text-slate-500">Room {item.room_no || '-'} - {item.rent_month ? formatMonthYear(item.rent_month, preferences) : 'Payment received'}</p></div><p className="font-black text-slate-950">{formatCurrency(item.amount, preferences)}</p></div>
                    <button onClick={() => handleManualConfirm(item.attempt_id)} disabled={confirmingId === item.attempt_id} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60">{confirmingId === item.attempt_id ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}Confirm collection</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!canGenerateReceipts && (
            <section className="rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p><span className="font-black">Receipts are limited on {planName}.</span> Collections still work; upgrade when you want generated PDF receipts for every payment.</p><button onClick={() => navigate('/dashboard/billing')} className="rounded-2xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white">View plans</button></div>
            </section>
          )}

          <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setActiveTab(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black ${activeTab === id ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><Icon size={16} />{label}</button>)}
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search tenant, room, phone" className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-semibold outline-none focus:border-slate-400" /></div>
            <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-600"><SlidersHorizontal size={16} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="bg-transparent outline-none"><option value="all">All statuses</option><option value="pending">Pending</option><option value="partial">Partial</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="waived">Waived</option></select></label>
          </section>

          {depositsView ? <DepositExperience preferences={preferences} amount={metrics.depositsHeld} /> : refundsView ? <RefundExperience preferences={preferences} amount={metrics.pendingRefunds} /> : settlementsView ? <SettlementExperience preferences={preferences} /> : visibleItems.length === 0 ? (
            <EmptyState icon={activeTab === 'collections' ? Banknote : WalletCards} title={activeTab === 'dues' ? 'No pending dues right now.' : activeTab === 'collections' ? 'All tenant collections are up to date.' : 'No receipts available yet.'} text={activeTab === 'dues' ? 'When monthly stay or operational charges are generated, they will appear here as tenant-cycle cards.' : 'Financial activity will appear here once tenants start paying.'} />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {visibleItems.map((item) => <FinancialCard key={item.id} item={item} preferences={preferences} onBreakdown={setSelectedItem} onCollect={(target) => setRecordItem(target)} onHistory={setHistoryTenant} />)}
            </div>
          )}
        </>
      )}

      <BreakdownDrawer item={selectedItem} preferences={preferences} onClose={() => setSelectedItem(null)} onCollect={(target) => setRecordItem(target)} onHistory={setHistoryTenant} />
      <PaymentDetailsDrawer isOpen={!!recordItem} onClose={() => setRecordItem(null)} payment={recordItem} hostelId={hostelId} onMarkPaid={handleMarkAsPaid} onDownloadReceipt={handleDownloadReceipt} onViewTenant={(payment) => payment?.tenantId && navigate(`/hostels/${hostelId}/tenants`, { state: { selectedTenantId: payment.tenantId } })} onViewHistory={setHistoryTenant} onStartOnlinePayment={setOnlinePaymentTarget} />
      <OnlinePaymentModal isOpen={!!onlinePaymentTarget} onClose={() => setOnlinePaymentTarget(null)} obligation={onlinePaymentTarget} onSettled={handleRefreshAll} />
      <TenantHistoryModal isOpen={!!historyTenant} onClose={() => setHistoryTenant(null)} tenantId={historyTenant?.tenantId} tenantName={historyTenant?.tenantName} hostelId={hostelId} />

      <GenerateMonthlyStayModal open={showGenModal} onClose={() => !genLoading && setShowGenModal(false)} preferences={preferences} genMonth={genMonth} setGenMonth={setGenMonth} rentPreview={rentPreview} previewLoading={previewLoading} genLoading={genLoading} genResult={genResult} onPreview={handlePreviewRent} onGenerate={handleGenerateRent} />
    </div>
  );
};

function DepositExperience({ preferences, amount }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
      <div className="rounded-3xl border border-blue-100 bg-blue-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-500">Refundable liability</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">Security Deposits Held</h2>
        <p className="mt-2 text-sm text-blue-900/75">Deposits are not rent payments. They stay visible here for refund, deduction, and settlement clarity.</p>
        <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">Deposit Held</p><p className="mt-2 text-4xl font-black text-slate-950">{formatCurrency(amount, preferences)}</p><p className="mt-2 text-sm text-slate-500">Refund status and deductions appear here when settlement data is available.</p></div>
      </div>
      <div className="space-y-3">
        {['Deposit collected and held separately', 'Deductions recorded during settlement', 'Refund pending until owner confirmation'].map((text) => <div key={text} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700"><ShieldCheck className="mb-2 text-blue-600" size={18} />{text}</div>)}
      </div>
    </section>
  );
}

function RefundExperience({ preferences, amount }) {
  return amount > 0 ? <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-6"><h2 className="text-2xl font-black text-slate-950">Refunds awaiting processing</h2><p className="mt-2 text-sm text-emerald-800">Review pending refunds and close them after transfer confirmation.</p><p className="mt-6 text-4xl font-black text-slate-950">{formatCurrency(amount, preferences)}</p></section> : <EmptyState icon={RotateCcw} title="No refunds awaiting processing." text="Deposit returns and overpayment adjustments will appear here with aging and settlement context." />;
}

function SettlementExperience() {
  return <EmptyState icon={Landmark} title="No settlements pending." text="Move-out settlements will show deposit held, deductions, refund pending, and completion history in one calm flow." />;
}

function GenerateMonthlyStayModal({ open, onClose, preferences, genMonth, setGenMonth, rentPreview, previewLoading, genLoading, genResult, onPreview, onGenerate }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"><motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }} className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl pointer-events-auto">
        <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50 p-6"><div><h2 className="text-xl font-black text-slate-950">Generate Monthly Stay</h2><p className="text-sm text-slate-500">Create one payable stay obligation per tenant.</p></div><button onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-200"><X size={18} /></button></div>
        <div className="space-y-5 p-6">
          {genResult ? genResult.success ? <div className="text-center"><CheckCircle2 className="mx-auto text-emerald-600" size={48} /><h3 className="mt-3 text-lg font-black text-slate-950">Monthly stay created</h3><p className="mt-1 text-sm text-slate-500">{genResult.data?.created ?? 0} tenant obligation(s) added.</p><button onClick={onClose} className="mt-5 w-full rounded-2xl bg-slate-950 py-3 text-sm font-black text-white">Done</button></div> : <div className="text-center"><AlertCircle className="mx-auto text-rose-600" size={48} /><h3 className="mt-3 text-lg font-black text-slate-950">Generation failed</h3><p className="mt-1 text-sm text-slate-500">{genResult.error}</p></div> : <>
            <label className="block"><span className="text-sm font-black text-slate-700">Billing cycle</span><input type="month" value={genMonth.slice(0, 7)} onChange={(event) => setGenMonth(`${event.target.value}-01`)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400" /></label>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">Tenants will see this as Monthly Stay. Any late fee remains included inside that single payable amount.</div>
            {rentPreview ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><p className="font-black text-slate-950">Preview</p><p className="mt-2">Tenants: <b>{rentPreview.totalTenants}</b></p><p>New obligations: <b>{rentPreview.willCreate}</b></p><p>Already present: <b>{rentPreview.alreadyGenerated}</b></p><p>Total: <b>{formatCurrency(rentPreview.totalAmount, preferences)}</b></p></div> : null}
            <div className="grid grid-cols-2 gap-3"><button onClick={onPreview} disabled={previewLoading || !genMonth} className="rounded-2xl border border-slate-200 py-3 text-sm font-black text-slate-700 disabled:opacity-50">{previewLoading ? 'Previewing...' : 'Preview'}</button><button onClick={onGenerate} disabled={genLoading || !rentPreview} className="rounded-2xl bg-slate-950 py-3 text-sm font-black text-white disabled:opacity-50">{genLoading ? 'Creating...' : 'Generate'}</button></div>
          </>}
        </div>
      </motion.div></div>
    </AnimatePresence>
  );
}

export default Payments;
