import React, { useState, useMemo, useEffect } from 'react';
import SmartDashboardGuidance from '@components/SmartDashboardGuidance';
import FirstSuccessMoment from '@components/FirstSuccessMoment';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import {
    AlertTriangle, X, Bell, Users, BedDouble, ArrowUpRight,
    Home, BarChart2, Zap, RefreshCw, ShieldAlert, TrendingUp,
    TrendingDown, ChevronRight, Target, Activity, Wallet,
    CheckCircle2, Clock, LayoutDashboard, Sparkles, ArrowRight,
    CreditCard, Loader2, Search
} from 'lucide-react';
import { paymentService, reminderService, tenantService } from '@/api/services';
import { useAppPreferences } from '@/context/AppPreferencesContext';
import { formatCurrency } from '@utils/format';
import { useCashflow, useTenantAnalytics, useFunnelAnalytics, useOperationsAnalytics } from '@hooks/useAnalytics';
import { useHostelContext } from '@/context/HostelContext';
import { motion, AnimatePresence } from 'framer-motion';

// ─── helpers ────────────────────────────────────────────────────────────────
const dAmt  = d => Number(d?.pending_amount  ?? 0);
const dDays = d => Number(d?.days_overdue    ?? d?.avg_delay_days ?? 0);
const dName = d => d?.name ?? 'Tenant';
const dId   = d => d?.tenant_id ?? d?.id ?? '';

const riskBadge = d => {
    const days = dDays(d), amt = dAmt(d);
    if (days > 15 || amt > 8000) return 'HIGH';
    if (days > 7  || amt > 3000) return 'MEDIUM';
    return 'LOW';
};
const RC = {
    HIGH:   'bg-rose-50 text-rose-600 border-rose-100',
    MEDIUM: 'bg-amber-50 text-amber-600 border-amber-100',
    LOW:    'bg-emerald-50 text-emerald-600 border-emerald-100',
};
const apiErrorCode = err => err?.response?.data?.error?.code ?? err?.response?.data?.code;

// ─── main ───────────────────────────────────────────────────────────────────
const OwnerDashboard = () => {
    const navigate = useNavigate();
    const { hostelId } = useHostelContext();
    const opPath = (section) => `/dashboard/${hostelId}/${section}`;
    const { preferences } = useAppPreferences();
    const [tab, setTab]           = useState('cashflow');
    const [dismissed, setDismissed] = useState(false);
    const [showTestPayment, setShowTestPayment] = useState(false);

    // ── Milestone notifications (for FirstSuccessMoment) ─────────────────────
    const [milestoneNotifs, setMilestoneNotifs] = useState([]);
    useEffect(() => {
        import('../../api/services').then(({ notificationService }) => {
            notificationService.getAll().then(data => {
                const notifs = Array.isArray(data) ? data : (data?.notifications ?? []);
                setMilestoneNotifs(notifs.filter(n => !n.is_read));
            }).catch(() => {});
        });
    }, []);

    const handleMilestoneDismiss = (notifId) => {
        setMilestoneNotifs(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
        import('../../api/services').then(({ notificationService }) => {
            notificationService.markAsRead(notifId).catch(() => {});
        });
    };

    const { data: cf, isLoading } = useCashflow(hostelId);
    const { data: ti, isLoading: tiLoading } = useTenantAnalytics(hostelId, undefined, tab === 'tenants');
    const { data: fn, isLoading: fnLoading } = useFunnelAnalytics(hostelId, undefined, tab === 'funnel');
    const { data: op, isLoading: opLoading } = useOperationsAnalytics(hostelId, undefined, tab === 'operations');

    const cfd = cf?.data ?? {};
    const cfStats = useMemo(() => ({
        expected:      Number(cfd.expected_rent         ?? 0),
        collected:     Number(cfd.collected_amount      ?? 0),
        pending:       Number(cfd.pending_amount        ?? 0),
        rate:          Number(cfd.collection_rate       ?? 0),
        overdueAmt:    Number(cfd.overdue_amount        ?? 0),
        overdueCount:  Number(cfd.overdue_tenants_count ?? 0),
        topDefaulters: Array.isArray(cfd.top_defaulters) ? cfd.top_defaulters : [],
        daily:         Array.isArray(cfd.daily_collection) ? cfd.daily_collection.map(r => ({ label: r.date?.slice(5), v: Number(r.amount) })) : [],
    }), [cfd]);

    const showBanner = !dismissed && cfStats.overdueCount > 0;

    if (isLoading) return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 animate-pulse shadow-xl shadow-purple-50">
                <RefreshCw size={24} className="animate-spin" />
            </div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Syncing Intelligence...</p>
        </div>
    );

    return (
        <div className="relative pb-28 min-h-screen">
            <FirstSuccessMoment
                notifications={milestoneNotifs}
                onDismiss={handleMilestoneDismiss}
            />

            {showBanner && (
                <AlertBanner
                    cfStats={cfStats} preferences={preferences}
                    onDismiss={() => setDismissed(true)}
                    onView={() => setTab('tenants')}
                />
            )}
            
            <div className="px-4 pt-4 sm:pt-6 space-y-6">
                <AnimatePresence mode="wait">
                    {tab === 'cashflow'    && <motion.div key="cf" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}><S1_Cashflow   cfStats={cfStats} cfSeverity={cf?.severity} cfInsights={cf?.insights ?? []} preferences={preferences} navigate={navigate} opPath={opPath} onOpenTestPayment={() => setShowTestPayment(true)} /></motion.div>}
                    {tab === 'tenants'     && <motion.div key="ti" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}><S2_Tenants    data={ti?.data}   severity={ti?.severity}   insights={ti?.insights ?? []}  loading={tiLoading} preferences={preferences} navigate={navigate} opPath={opPath} /></motion.div>}
                    {tab === 'funnel'      && <motion.div key="fn" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}><S3_Funnel     data={fn?.data}   severity={fn?.severity}   insights={fn?.insights ?? []}  loading={fnLoading} preferences={preferences} navigate={navigate} opPath={opPath} /></motion.div>}
                    {tab === 'operations'  && <motion.div key="op" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}><S4_Operations data={op?.data}   severity={op?.severity}   insights={op?.insights ?? []}  loading={opLoading} preferences={preferences} navigate={navigate} opPath={opPath} /></motion.div>}
                </AnimatePresence>
            </div>
            <TabBar active={tab} onChange={setTab} badge={cfStats.overdueCount} />
            <TestPaymentModal
                isOpen={showTestPayment}
                onClose={() => setShowTestPayment(false)}
                hostelId={hostelId}
                preferences={preferences}
            />
        </div>
    );
};

// ─── alert banner ───────────────────────────────────────────────────────────
const AlertBanner = ({ cfStats, preferences, onDismiss, onView }) => {
    const crit = cfStats.overdueCount > 5;
    const theme = crit 
        ? { wrap: 'bg-rose-50/80 backdrop-blur-md border-rose-100', icon: 'text-rose-500', title: 'text-rose-900', sub: 'text-rose-700/80', secondary: 'bg-rose-100 text-rose-700' }
        : { wrap: 'bg-amber-50/80 backdrop-blur-md border-amber-100', icon: 'text-amber-500', title: 'text-amber-900', sub: 'text-amber-700/80', secondary: 'bg-amber-100 text-amber-700' };
    
    const title = 'Action Required';
    const sub   = `${cfStats.overdueCount} tenants unpaid this month.`;

    return (
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mx-4 mt-4 rounded-[2rem] border p-6 ${theme.wrap} shadow-xl shadow-slate-100/50`}
        >
            <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${theme.secondary}`}>
                    <AlertTriangle size={20} className={theme.icon} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-black uppercase tracking-tight ${theme.title}`}>{title}</p>
                    <p className={`text-xs mt-1 font-medium leading-relaxed ${theme.sub}`}>{sub}</p>
                </div>
                <button onClick={onDismiss} className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
            </div>
            <div className="flex gap-3 mt-5">
                {cfStats.overdueCount > 0 && (
                    <button onClick={onView} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl active:scale-95 transition-all ${theme.secondary}`}>View Defaulters</button>
                )}
            </div>
        </motion.div>
    );
};

// ─── shared components ───────────────────────────────────────────────────────
const ReminderButton = ({ tenantId, tenantName, onNoCredits }) => {
    const [s, setS] = useState('idle');
    const tap = async () => {
        if (s !== 'idle') return;
        setS('sending');
        try {
            const res = await reminderService.sendToTenant(tenantId);
            if (!res?.success) { setS('error'); setTimeout(() => setS('idle'), 2000); }
            else { setS('sent'); setTimeout(() => setS('idle'), 3000); }
        } catch (err) {
            if (apiErrorCode(err) === 'NO_REMINDERS_LEFT') onNoCredits?.();
            setS('error'); setTimeout(() => setS('idle'), 2000);
        }
    };
    const variants = {
        idle: { bg: 'bg-slate-50', text: 'text-slate-400', icon: Bell },
        sending: { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: RefreshCw },
        sent: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: CheckCircle2 },
        error: { bg: 'bg-rose-50', text: 'text-rose-600', icon: AlertTriangle }
    };
    const Current = variants[s];
    return (
        <button onClick={tap} className={`shrink-0 p-3 ${Current.bg} ${Current.text} rounded-2xl transition-all active:scale-90`}>
            <Current.icon size={16} className={s === 'sending' ? 'animate-spin' : ''} />
        </button>
    );
};

const TabSkeleton = () => (
    <div className="space-y-4 animate-pulse">
        <div className="bg-slate-100 rounded-[2.5rem] h-40" />
        <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-100 rounded-[2rem] h-24" />
            <div className="bg-slate-100 rounded-[2rem] h-24" />
        </div>
        <div className="bg-slate-100 rounded-[2rem] h-60" />
    </div>
);

const TestPaymentModal = ({ isOpen, onClose, hostelId, preferences }) => {
    const [tenants, setTenants] = useState([]);
    const [loadingTenants, setLoadingTenants] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedTenantId, setSelectedTenantId] = useState('');
    const [amount, setAmount] = useState('1');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen || !hostelId) return;
        let active = true;
        setLoadingTenants(true);
        setError('');
        tenantService.getAll(hostelId, { limit: 200 })
            .then((response) => {
                if (!active) return;
                const rows = Array.isArray(response) ? response : (response?.tenants || response?.data?.tenants || []);
                setTenants(rows);
                const firstActive = rows.find((tenant) => !['LEFT', 'CANCELLED', 'EXPIRED'].includes(tenant.status));
                setSelectedTenantId(firstActive?.id || rows[0]?.id || '');
            })
            .catch((tenantError) => {
                if (!active) return;
                setError(tenantError?.response?.data?.detail?.message || tenantError?.response?.data?.detail || 'Could not load tenants for this hostel.');
            })
            .finally(() => active && setLoadingTenants(false));
        return () => { active = false; };
    }, [hostelId, isOpen]);

    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setAmount('1');
            setError('');
            setSubmitting(false);
        }
    }, [isOpen]);

    const tenantLabel = (tenant) => {
        const name = tenant.profile?.name || tenant.profiles?.name || tenant.name || 'Tenant';
        const email = tenant.profile?.email || tenant.profiles?.email || tenant.email || '';
        const room = tenant.allocations?.[0]?.room?.room_no || tenant.room_allocations?.[0]?.room?.room_no || 'N/A';
        return { name, email, room };
    };

    const filteredTenants = useMemo(() => {
        const term = query.trim().toLowerCase();
        if (!term) return tenants;
        return tenants.filter((tenant) => {
            const label = tenantLabel(tenant);
            return `${label.name} ${label.email} ${label.room}`.toLowerCase().includes(term);
        });
    }, [query, tenants]);

    const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId);
    const selectedLabel = selectedTenant ? tenantLabel(selectedTenant) : null;
    const numericAmount = Number(amount);

    const startTestPayment = async () => {
        if (!selectedTenantId) {
            setError('Select a tenant first.');
            return;
        }
        if (!Number.isFinite(numericAmount) || numericAmount < 1 || numericAmount > 100) {
            setError('Use a test amount between ₹1 and ₹100.');
            return;
        }

        setSubmitting(true);
        setError('');
        try {
            const result = await paymentService.createTestIntent({
                tenant_id: selectedTenantId,
                hostelId,
                amount: numericAmount,
            });
            const attempt = result?.attempt || result;
            if (attempt?.checkout_url) {
                localStorage.setItem('lastPaymentAttemptId', attempt.id);
                localStorage.setItem('lastPaymentMerchantTxnId', attempt.merchant_txn_id || attempt.merchant_transaction_id || '');
                sessionStorage.setItem('lastPaymentAttemptId', attempt.id);
                window.location.href = attempt.checkout_url;
                return;
            }
            setError('The test due was created, but the provider did not return a checkout URL.');
        } catch (intentError) {
            setError(
                intentError?.response?.data?.detail?.message
                || intentError?.response?.data?.detail
                || intentError?.response?.data?.error?.message
                || 'Could not start the test payment.'
            );
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80]">
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
            <div className="absolute inset-0 flex items-end justify-center p-3 sm:items-center sm:p-6">
                <div className="w-full max-w-2xl rounded-[2rem] bg-white shadow-2xl">
                    <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">Treasury test checkout</p>
                            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Test a tenant payment</h2>
                            <p className="mt-1 text-sm text-slate-500">Create a small test due for any tenant and open the real PhonePe checkout.</p>
                        </div>
                        <button onClick={onClose} className="rounded-2xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="space-y-4 p-5 sm:p-6">
                        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                            This is owner-only and creates a scoped test charge. Payment still goes through HMS treasury, webhook verification, receipt, and settlement ledger.
                        </div>

                        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                            <label className="block">
                                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Search tenant</span>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                                    <input
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder="Name, email, room"
                                        className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 text-sm font-semibold outline-none focus:border-emerald-400"
                                    />
                                </div>
                            </label>
                            <label className="block">
                                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Amount</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    step="1"
                                    value={amount}
                                    onChange={(event) => setAmount(event.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black outline-none focus:border-emerald-400"
                                />
                            </label>
                        </div>

                        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                            {loadingTenants ? (
                                <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 py-8 text-sm font-bold text-slate-500">
                                    <Loader2 size={17} className="animate-spin" />
                                    Loading tenants
                                </div>
                            ) : filteredTenants.length === 0 ? (
                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm font-semibold text-slate-500">No tenant matches this search.</div>
                            ) : filteredTenants.map((tenant) => {
                                const label = tenantLabel(tenant);
                                const active = tenant.id === selectedTenantId;
                                return (
                                    <button
                                        key={tenant.id}
                                        type="button"
                                        onClick={() => setSelectedTenantId(tenant.id)}
                                        className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all ${active ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100 bg-white hover:bg-slate-50'}`}
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black text-slate-950">{label.name}</p>
                                            <p className="truncate text-xs font-semibold text-slate-500">{label.email || 'No email'} · Room {label.room}</p>
                                        </div>
                                        <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                            {active ? 'Selected' : tenant.status}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {selectedLabel && (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Checkout will be created for</p>
                                <p className="mt-1 text-sm font-black text-slate-950">{selectedLabel.name} · Room {selectedLabel.room}</p>
                                <p className="text-sm text-slate-500">{formatCurrency(numericAmount || 0, preferences)} test charge</p>
                            </div>
                        )}

                        {error && (
                            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                                {error}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={startTestPayment}
                            disabled={submitting || loadingTenants || !selectedTenantId}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                            {submitting ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                            {submitting ? 'Starting checkout...' : 'Create test due and open checkout'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const InsightStrip = ({ insights, severity }) => {
    if (!insights?.length) return null;
    const theme = severity === 'HIGH' ? 'bg-rose-50 border-rose-100 text-rose-700'
        : severity === 'MEDIUM'     ? 'bg-amber-50 border-amber-100 text-amber-700'
        : 'bg-indigo-50 border-indigo-100 text-indigo-700';
    return (
        <div className={`rounded-[2rem] border p-6 ${theme} shadow-sm relative overflow-hidden`}>
            <div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles size={40} /></div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-4 flex items-center gap-2">
                <Zap size={12} /> Intelligence Report
            </p>
            <div className="space-y-3">
                {insights.slice(0, 3).map((ins, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs font-bold leading-relaxed">
                        <div className="w-1.5 h-1.5 rounded-full bg-current mt-1.5 shrink-0 opacity-40" />
                        {ins}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── screen 1: cashflow ───────────────────────────────────────────────────────
const S1_Cashflow = ({ cfStats, cfSeverity, cfInsights, preferences, navigate, opPath, onOpenTestPayment }) => {
    const isNewOwner = cfStats.expected === 0 && cfStats.topDefaulters.length === 0;
    if (isNewOwner) return <SmartDashboardGuidance />;

    const highRisk = cfStats.topDefaulters.filter(d => riskBadge(d) === 'HIGH').length;
    const actionItems = [
        cfStats.overdueCount > 0 && { id: 'remind',  icon: Bell,       color: 'text-indigo-600 bg-indigo-50',  label: `${cfStats.overdueCount} Unpaid Dues`, desc: 'Send bulk WhatsApp reminders', path: null },
        highRisk > 0             && { id: 'high',    icon: ShieldAlert, color: 'text-rose-600 bg-rose-50',      label: `${highRisk} Critical Defaulters`, desc: 'Overdue by 10+ days', path: opPath('tenants') },
        cfStats.pending > 0      && { id: 'collect', icon: Wallet,      color: 'text-emerald-600 bg-emerald-50', label: 'Potential Revenue', desc: `${formatCurrency(cfStats.pending, preferences)} collectible`, path: opPath('payments') },
    ].filter(Boolean);

    return (
        <div className="space-y-6">
            <header className="flex items-end justify-between">
                <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-1">Financial State</p>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Overview</h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={onOpenTestPayment} className="inline-flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-black uppercase tracking-widest text-emerald-700 shadow-sm transition-all hover:bg-emerald-100 active:scale-95">
                        <CreditCard size={16} />
                        Test Payment
                    </button>
                    <button onClick={() => navigate(opPath('payments'))} className="p-3 bg-white rounded-2xl border border-slate-100 text-slate-400 hover:text-slate-900 shadow-sm transition-all active:scale-95">
                        <ArrowUpRight size={20} />
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-2 gap-4">
                {[
                    { label: 'Expected',  value: formatCurrency(cfStats.expected, preferences), sub: 'Monthly Goal', icon: <Target size={14}/>, cls: 'bg-white border-slate-100 text-slate-900' },
                    { label: 'Collected', value: formatCurrency(cfStats.collected, preferences), sub: `${cfStats.rate.toFixed(1)}% Yield`, icon: <CheckCircle2 size={14}/>, cls: 'bg-emerald-50 border-emerald-100 text-emerald-900' },
                    { label: 'Pending',   value: formatCurrency(cfStats.pending, preferences), sub: `${cfStats.overdueCount} Tenants`, icon: <Clock size={14}/>, cls: 'bg-white border-slate-100 text-slate-900', highlight: cfStats.pending > 0 },
                    { label: 'Overdue',   value: formatCurrency(cfStats.overdueAmt, preferences), sub: 'Past Due Date', icon: <AlertTriangle size={14}/>, cls: cfStats.overdueAmt > 0 ? 'bg-rose-50 border-rose-100 text-rose-900' : 'bg-white border-slate-100 text-slate-900' },
                ].map(c => (
                    <button key={c.label} onClick={() => navigate(opPath('payments'))} className={`p-6 rounded-[2rem] border text-left active:scale-95 transition-all shadow-sm group relative overflow-hidden ${c.cls}`}>
                        <div className="flex items-center gap-2 mb-3 opacity-40 group-hover:opacity-100 transition-opacity">
                            {c.icon}
                            <p className="text-[10px] font-black uppercase tracking-widest">{c.label}</p>
                        </div>
                        <p className="text-2xl font-black tracking-tighter mb-1">{c.value}</p>
                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-wider">{c.sub}</p>
                        {c.highlight && <div className="absolute top-4 right-4 w-2 h-2 bg-rose-500 rounded-full animate-ping" />}
                    </button>
                ))}
            </div>

            {cfStats.topDefaulters.length > 0 && (
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-50 overflow-hidden">
                    <div className="p-6 flex items-center justify-between bg-slate-50/50 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-rose-500 shadow-sm">
                                <ShieldAlert size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-900">Critical Dues</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cfStats.topDefaulters.length} Pending Actions</p>
                            </div>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {cfStats.topDefaulters.map(d => {
                            const r = riskBadge(d);
                            return (
                                <div key={dId(d)} className="p-5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${RC[r]}`}>{r}</span>
                                            <p className="text-sm font-black text-slate-900 truncate">{dName(d)}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-base font-black text-slate-900">{formatCurrency(dAmt(d), preferences)}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{dDays(d)} Days Overdue</span>
                                        </div>
                                    </div>
                                    <ReminderButton tenantId={dId(d)} tenantName={dName(d)} onNoCredits={() => navigate('/dashboard/billing')} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-100">
                <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><Activity size={100} /></div>
                <div className="relative z-10">
                    <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Action Center</p>
                    <div className="space-y-6">
                        {actionItems.map(item => { const Icon = item.icon; return (
                            <div key={item.id} className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center shrink-0 ${item.color} shadow-lg`}>
                                    <Icon size={20} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black tracking-tight">{item.label}</p>
                                    <p className="text-xs text-white/50 font-medium">{item.desc}</p>
                                </div>
                                <button 
                                    onClick={() => item.path ? navigate(item.path) : null}
                                    className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all active:scale-90"
                                >
                                    <ArrowRight size={18} />
                                </button>
                            </div>
                        ); })}
                    </div>
                </div>
            </div>

            {cfStats.daily.length > 0 && (
                <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xl shadow-slate-50">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Collection Trend</p>
                            <h3 className="text-xl font-black text-slate-900">Revenue Flow</h3>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black text-slate-900">{formatCurrency(cfStats.daily[cfStats.daily.length - 1]?.v ?? 0, preferences)}</p>
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Today's Batch</p>
                        </div>
                    </div>
                    <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={cfStats.daily}>
                                <defs>
                                    <linearGradient id="colorV" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="label" hide />
                                <YAxis hide />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                                    formatter={(value) => formatCurrency(value, preferences)}
                                />
                                <Area type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorV)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            <InsightStrip insights={cfInsights} severity={cfSeverity} />
        </div>
    );
};

// ─── screen 2: tenant intelligence ───────────────────────────────────────────
const S2_Tenants = ({ data, severity, insights, loading, preferences, navigate, opPath }) => {
    if (loading || !data) return <TabSkeleton />;
    const dist  = data.distribution    ?? { good: 0, medium: 0, risky: 0 };
    const risky = data.risky_tenants   ?? [];
    const beh   = data.payment_behavior ?? {};
    const total = (dist.good + dist.medium + dist.risky) || 1;

    return (
        <div className="space-y-6">
            <header className="flex items-end justify-between">
                <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-1">Member Insights</p>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Tenants</h1>
                </div>
                <button onClick={() => navigate(opPath('tenants'))} className="p-3 bg-white rounded-2xl border border-slate-100 text-slate-400 shadow-sm active:scale-95">
                    <Users size={20} />
                </button>
            </header>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xl shadow-slate-50">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Tenant Health Pulse</p>
                <div className="flex h-12 gap-1 mb-6">
                    <div className="bg-emerald-400 rounded-l-2xl flex items-center justify-center text-white text-[10px] font-black" style={{ width: `${(dist.good / total) * 100}%` }}>{dist.good > 0 && Math.round((dist.good/total)*100)+'%'}</div>
                    <div className="bg-amber-400 flex items-center justify-center text-white text-[10px] font-black" style={{ width: `${(dist.medium / total) * 100}%` }}>{dist.medium > 0 && Math.round((dist.medium/total)*100)+'%'}</div>
                    <div className="bg-rose-500 rounded-r-2xl flex items-center justify-center text-white text-[10px] font-black" style={{ width: `${(dist.risky / total) * 100}%` }}>{dist.risky > 0 && Math.round((dist.risky/total)*100)+'%'}</div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center"><p className="text-lg font-black text-emerald-600">{dist.good}</p><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Stable</p></div>
                    <div className="text-center border-x border-slate-50"><p className="text-lg font-black text-amber-600">{dist.medium}</p><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Watch</p></div>
                    <div className="text-center"><p className="text-lg font-black text-rose-600">{dist.risky}</p><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">At Risk</p></div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'On-Time', value: `${beh.on_time_percentage ?? 0}%`, color: 'text-emerald-600 bg-emerald-50' },
                    { label: 'Avg Delay', value: `${Math.round(beh.avg_delay_days ?? 0)}d`, color: 'text-amber-600 bg-amber-50' },
                    { label: 'Dependent', value: `${beh.reminder_dependency_rate ?? 0}%`, color: 'text-indigo-600 bg-indigo-50' }
                ].map(c => (
                    <div key={c.label} className={`p-5 rounded-[2rem] text-center ${c.color} shadow-sm border border-black/5`}>
                        <p className="text-xl font-black mb-1">{c.value}</p>
                        <p className="text-[8px] font-black uppercase tracking-widest opacity-60">{c.label}</p>
                    </div>
                ))}
            </div>

            {risky.length > 0 && (
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-50 overflow-hidden">
                    <div className="p-6 bg-rose-50/50 border-b border-slate-100 flex items-center gap-3">
                        <ShieldAlert className="text-rose-500" size={18} />
                        <h3 className="text-sm font-black text-slate-900">Risk Mitigation List</h3>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {risky.map(t => (
                            <div key={t.tenant_id} className="p-5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                        <p className="text-sm font-black text-slate-900">{t.name}</p>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Score: {t.score} · {formatCurrency(t.pending_amount, preferences)} due</p>
                                </div>
                                <ReminderButton tenantId={t.tenant_id} tenantName={t.name} onNoCredits={() => navigate('/dashboard/billing')} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <InsightStrip insights={insights} severity={severity} />
        </div>
    );
};

// ─── screen 3: funnel ─────────────────────────────────────────────────────────
const S3_Funnel = ({ data, severity, insights, loading, preferences, navigate, opPath }) => {
    if (loading || !data) return <TabSkeleton />;
    const sent = data.reminders_sent ?? 0;
    const rate = Number(data.conversion_rate ?? 0);
    const revenue = Number(data.revenue_generated ?? 0);
    const channels = data.channel_performance ?? [];

    return (
        <div className="space-y-6">
            <header className="flex items-end justify-between">
                <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-1">Pipeline Analysis</p>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Funnel</h1>
                </div>
                <button onClick={() => navigate(opPath('payments'))} className="p-3 bg-white rounded-2xl border border-slate-100 text-slate-400 shadow-sm active:scale-95">
                    <Target size={20} />
                </button>
            </header>

            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-100 relative overflow-hidden">
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl" />
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-1">Conversion Rate</p>
                        <h2 className="text-5xl font-black tracking-tighter">{rate.toFixed(1)}%</h2>
                    </div>
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-indigo-400">
                        <TrendingUp size={32} />
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/40">
                            <span>Reminders Sent</span>
                            <span>{sent}</span>
                        </div>
                        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} className="h-full bg-indigo-500" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/40">
                            <span>Payments Recieved</span>
                            <span>{data.conversions}</span>
                        </div>
                        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${rate}%` }} className="h-full bg-emerald-400" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Automated Revenue</p>
                    <p className="text-2xl font-black text-slate-900">{formatCurrency(revenue, preferences)}</p>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase mt-1">Via Reminders</p>
                </div>
                <div className="bg-white rounded-[2rem] border border-slate-100 p-6 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Avg Pay Time</p>
                    <p className="text-2xl font-black text-slate-900">{data.avg_time_to_pay_hours?.toFixed(1)}h</p>
                    <p className="text-[10px] font-bold text-indigo-500 uppercase mt-1">Post Alert</p>
                </div>
            </div>

            {channels.length > 0 && (
                <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xl shadow-slate-50">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Channel Efficiency</p>
                    <div className="space-y-5">
                        {channels.map((ch, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <span className="text-xs font-black text-slate-600 w-20 uppercase tracking-tighter">{ch.channel}</span>
                                <div className="flex-1 h-3 bg-slate-50 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${ch.conversion_rate}%` }} />
                                </div>
                                <span className="text-xs font-black text-slate-900">{ch.conversion_rate.toFixed(0)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <InsightStrip insights={insights} severity={severity} />
        </div>
    );
};

// ─── screen 4: operations ─────────────────────────────────────────────────────
const S4_Operations = ({ data, severity, insights, loading, preferences, navigate, opPath }) => {
    if (loading || !data) return <TabSkeleton />;
    const occ = Number(data.occupancy_rate ?? 0);
    const rev = Number(data.revenue ?? 0);
    const exp = Number(data.expenses ?? 0);
    const profit = Number(data.profit ?? 0);
    const vacant = occ > 0 ? Math.max(0, Math.round(Number(data.occupied_rooms) * 100 / occ) - Number(data.occupied_rooms)) : 0;

    return (
        <div className="space-y-6">
            <header className="flex items-end justify-between">
                <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-1">Property Status</p>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Operations</h1>
                </div>
                <button onClick={() => navigate(opPath('rooms'))} className="p-3 bg-white rounded-2xl border border-slate-100 text-slate-400 shadow-sm active:scale-95">
                    <Home size={20} />
                </button>
            </header>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xl shadow-slate-50">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Occupancy Rate</p>
                        <h2 className="text-5xl font-black text-slate-900 tracking-tighter">{occ.toFixed(1)}%</h2>
                    </div>
                    {vacant > 0 && (
                        <div className="bg-amber-50 text-amber-600 px-4 py-2 rounded-2xl border border-amber-100 text-center">
                            <p className="text-xl font-black">{vacant}</p>
                            <p className="text-[8px] font-black uppercase tracking-widest">Vacant</p>
                        </div>
                    )}
                </div>
                <div className="h-4 bg-slate-50 rounded-full overflow-hidden mb-8">
                    <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: `${occ}%` }} 
                        className={`h-full rounded-full ${occ >= 80 ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                    />
                </div>
                <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-50">
                    <div className="text-center"><p className="text-lg font-black text-emerald-600">+{data.move_ins || 0}</p><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">In</p></div>
                    <div className="text-center border-x border-slate-50"><p className="text-lg font-black text-rose-500">-{data.move_outs || 0}</p><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Out</p></div>
                    <div className="text-center"><p className="text-lg font-black text-slate-900">{data.total_rooms || 0}</p><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Rooms</p></div>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xl shadow-slate-50">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8">P&L Performance</p>
                <div className="space-y-6">
                    {[
                        { label: 'Revenue', value: rev, color: 'bg-emerald-500', max: rev },
                        { label: 'Expenses', value: exp, color: 'bg-rose-400', max: rev },
                        { label: 'Profit', value: profit, color: 'bg-indigo-500', max: rev }
                    ].map(row => (
                        <div key={row.label}>
                            <div className="flex justify-between items-center mb-2 px-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{row.label}</span>
                                <span className="text-sm font-black text-slate-900">{formatCurrency(row.value, preferences)}</span>
                            </div>
                            <div className="h-3 bg-slate-50 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }} 
                                    animate={{ width: `${(row.value / row.max) * 100}%` }} 
                                    className={`h-full ${row.color} rounded-full`} 
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <button onClick={() => navigate(opPath('expenses'))} className="w-full mt-10 h-14 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 active:scale-95 transition-all">
                    Detail Expense Audit
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {[
                    { label: 'Complaints', value: data.complaints?.pending || 0, icon: MessageSquare, cls: 'bg-white text-slate-900' },
                    { label: 'Maintenance', value: 'Active', icon: Activity, cls: 'bg-white text-slate-900' }
                ].map((item, i) => { const Icon = item.icon; return (
                    <div key={i} className={`p-6 rounded-[2rem] border border-slate-100 shadow-sm ${item.cls}`}>
                        <Icon className="text-slate-400 mb-4" size={20} />
                        <p className="text-2xl font-black mb-1">{item.value}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-60">{item.label}</p>
                    </div>
                ); })}
            </div>

            <InsightStrip insights={insights} severity={severity} />
        </div>
    );
};

// ─── bottom tab bar ──────────────────────────────────────────────────────────
const TabBar = ({ active, onChange, badge }) => {
    const tabs = [
        { id: 'cashflow',   label: 'Revenue',    Icon: Wallet },
        { id: 'tenants',    label: 'Tenants',     Icon: Users  },
        { id: 'funnel',     label: 'Funnel',      Icon: Target },
        { id: 'operations', label: 'Assets',      Icon: Home   },
    ];
    return (
        <div className="fixed bottom-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-t border-slate-100 pb-safe">
            <div className="flex h-20 max-w-lg mx-auto items-center px-4">
                {tabs.map(t => {
                    const on = active === t.id;
                    return (
                        <button 
                            key={t.id} 
                            onClick={() => onChange(t.id)} 
                            className={`flex-1 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 relative ${on ? 'text-purple-600' : 'text-slate-400'}`}
                        >
                            <div className={`p-2 rounded-2xl transition-all ${on ? 'bg-purple-50 scale-110 shadow-lg shadow-purple-50/50' : ''}`}>
                                <t.Icon size={20} strokeWidth={on ? 2.5 : 2} />
                                {t.id === 'tenants' && badge > 0 && (
                                    <span className="absolute top-1 right-1/4 w-4 h-4 bg-rose-500 rounded-full text-[8px] font-black text-white flex items-center justify-center shadow-lg border-2 border-white">{badge}</span>
                                )}
                            </div>
                            <span className={`text-[8px] font-black uppercase tracking-widest transition-opacity ${on ? 'opacity-100' : 'opacity-40'}`}>{t.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

// Dummy component for missing icon
const MessageSquare = ({ size, className }) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
);

export default OwnerDashboard;
