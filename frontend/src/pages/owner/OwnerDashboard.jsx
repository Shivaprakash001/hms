import React, { useState, useMemo, useEffect } from 'react';
import SmartDashboardGuidance from '../../components/SmartDashboardGuidance';
import FirstSuccessMoment from '../../components/FirstSuccessMoment';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import {
    AlertTriangle, X, Bell, Users, BedDouble, ArrowUpRight,
    Home, BarChart2, Zap, RefreshCw, ShieldAlert, TrendingUp,
    TrendingDown, ChevronRight, Target, Activity, Wallet,
    CheckCircle2, Clock, LayoutDashboard
} from 'lucide-react';
import { reminderService } from '../../api/services';
import { useAppPreferences } from '../../context/AppPreferencesContext';
import { formatCurrency } from '../../utils/format';
import { useCashflow, useTenantAnalytics, useFunnelAnalytics, useOperationsAnalytics, useAddonUsage } from '../../hooks/useAnalytics';

// ─── helpers ────────────────────────────────────────────────────────────────
// Field names from /dashboard/cashflow  → top_defaulters[].pending_amount, .days_overdue, .name
// Field names from /dashboard/tenants  → risky_tenants[].pending_amount, .avg_delay_days, .score, .name
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
    HIGH:   'bg-rose-100 text-rose-700 border-rose-200',
    MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
    LOW:    'bg-emerald-100 text-emerald-700 border-emerald-200',
};

// ─── main ───────────────────────────────────────────────────────────────────
const OwnerDashboard = () => {
    const navigate = useNavigate();
    const { preferences } = useAppPreferences();
    const [tab, setTab]           = useState('cashflow');
    const [dismissed, setDismissed] = useState(false);

    // ── Milestone notifications (for FirstSuccessMoment) ─────────────────────
    const [milestoneNotifs, setMilestoneNotifs] = useState([]);
    useEffect(() => {
        // Fetch unread notifications; filter milestone types in FirstSuccessMoment
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

    // Always-on: cashflow + addon (parallel, shared cache)
    const { data: cf, isLoading } = useCashflow();
    const { data: addonData }     = useAddonUsage();

    // Tab-specific: lazy-loaded — only fetches when tab becomes active
    const { data: ti, isLoading: tiLoading } = useTenantAnalytics(undefined, tab === 'tenants');
    const { data: fn, isLoading: fnLoading } = useFunnelAnalytics(undefined, tab === 'funnel');
    const { data: op, isLoading: opLoading } = useOperationsAnalytics(undefined, tab === 'operations');

    // Cashflow data shape from /dashboard/cashflow
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

    const cronStopped = !dismissed && addonData?.cron_stopped === true;
    const creditsLow  = !dismissed && Number(addonData?.credits_remaining ?? addonData?.remaining ?? 999) < 5;
    const showBanner  = cronStopped || creditsLow || (!dismissed && cfStats.overdueCount > 0);

    if (isLoading) return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <RefreshCw size={24} className="text-indigo-400 animate-spin" />
        </div>
    );

    return (
        <div className="relative pb-28 bg-slate-50 min-h-screen -mx-3 sm:-mx-8 -mt-3 sm:-mt-8">
            {/* First-success milestone celebrations */}
            <FirstSuccessMoment
                notifications={milestoneNotifs}
                onDismiss={handleMilestoneDismiss}
            />

            {showBanner && (
                <AlertBanner
                    cronStopped={cronStopped} creditsLow={creditsLow}
                    cfStats={cfStats} preferences={preferences}
                    onDismiss={() => setDismissed(true)}
                    onBuyCredits={() => navigate('/owner/billing')}
                    onView={() => setTab('tenants')}
                />
            )}
            <div className="px-4 pt-3">
                {tab === 'cashflow'    && <S1_Cashflow   cfStats={cfStats} cfSeverity={cf?.severity} cfInsights={cf?.insights ?? []} preferences={preferences} navigate={navigate} />}
                {tab === 'tenants'     && <S2_Tenants    data={ti?.data}   severity={ti?.severity}   insights={ti?.insights ?? []}  loading={tiLoading} preferences={preferences} navigate={navigate} />}
                {tab === 'funnel'      && <S3_Funnel     data={fn?.data}   severity={fn?.severity}   insights={fn?.insights ?? []}  loading={fnLoading} preferences={preferences} navigate={navigate} />}
                {tab === 'operations'  && <S4_Operations data={op?.data}   severity={op?.severity}   insights={op?.insights ?? []}  loading={opLoading} preferences={preferences} navigate={navigate} />}
            </div>
            <TabBar active={tab} onChange={setTab} badge={cfStats.overdueCount} />
        </div>
    );
};

// ─── alert banner ───────────────────────────────────────────────────────────
const AlertBanner = ({ cronStopped, creditsLow, cfStats, preferences, onDismiss, onBuyCredits, onView }) => {
    const crit = cronStopped || cfStats.overdueCount > 5;
    const b = crit ? { wrap: 'bg-rose-50 border-rose-200', icon: 'text-rose-500', title: 'text-rose-800', sub: 'text-rose-600', x: 'text-rose-300' } : { wrap: 'bg-amber-50 border-amber-200', icon: 'text-amber-500', title: 'text-amber-800', sub: 'text-amber-600', x: 'text-amber-300' };
    const title = cronStopped ? 'Reminders paused — credits exhausted' : creditsLow ? 'Credits running low — reminders may stop' : `${formatCurrency(cfStats.overdueAmt, preferences)} overdue — collect now`;
    const sub   = cronStopped ? 'Tenants may miss deadlines. Buy credits immediately.' : creditsLow ? 'Auto-reminders will stop soon.' : `${cfStats.overdueCount} tenant${cfStats.overdueCount !== 1 ? 's' : ''} haven't paid this month.`;
    return (
        <div className={`mx-4 mt-4 mb-1 rounded-2xl border p-4 ${b.wrap}`}>
            <div className="flex items-start gap-3">
                <AlertTriangle size={17} className={`shrink-0 mt-0.5 ${b.icon}`} />
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-extrabold ${b.title}`}>{title}</p>
                    <p className={`text-xs mt-0.5 ${b.sub}`}>{sub}</p>
                </div>
                <button onClick={onDismiss} className={`shrink-0 ${b.x}`}><X size={14} /></button>
            </div>
            <div className="flex gap-2 mt-3">
                {(cronStopped || creditsLow) && (
                    <button onClick={onBuyCredits} className="flex-1 py-2 bg-rose-500 text-white text-xs font-black rounded-xl active:scale-95">Buy Credits</button>
                )}
                {cfStats.overdueCount > 0 && (
                    <button onClick={onView} className={`flex-1 py-2 text-xs font-black rounded-xl active:scale-95 ${(cronStopped || creditsLow) ? 'bg-rose-100 text-rose-700' : 'bg-amber-500 text-white'}`}>View Defaulters</button>
                )}
            </div>
        </div>
    );
};

// ─── optimistic reminder button ─────────────────────────────────────────────
// States: idle → sending → sent (3s) → idle  |  idle → sending → error (2s) → idle
const ReminderButton = ({ tenantId, tenantName, onNoCredits }) => {
    const [s, setS] = useState('idle'); // idle | sent | error
    const tap = async () => {
        if (s !== 'idle') return; // block while feedback is showing
        setS('sent'); // optimistic: ✅ immediately
        try {
            const res = await reminderService.sendToTenant(tenantId);
            if (!res?.success) {
                setS('error');
                setTimeout(() => setS('idle'), 2000);
            } else {
                setTimeout(() => setS('idle'), 3000);
            }
        } catch (err) {
            if (err?.response?.data?.code === 'NO_REMINDERS_LEFT') { onNoCredits?.(); }
            setS('error');
            setTimeout(() => setS('idle'), 2000);
        }
    };
    if (s === 'sent')  return <div className="shrink-0 p-2.5 bg-emerald-50 text-emerald-600 rounded-xl" title={`Reminder sent to ${tenantName}`}><CheckCircle2 size={14} /></div>;
    if (s === 'error') return <button onClick={() => { setS('idle'); tap(); }} className="shrink-0 p-2.5 bg-rose-50 text-rose-600 rounded-xl active:scale-95" title="Failed — tap to retry"><Bell size={14} /></button>;
    return (
        <button onClick={tap} className="shrink-0 p-2.5 bg-indigo-50 text-indigo-600 rounded-xl active:scale-95" title={`Send reminder to ${tenantName}`}>
            <Bell size={14} />
        </button>
    );
};

const RemindAllButton = ({ tenants, onNoCredits }) => {
    const [s, setS] = useState('idle');
    const tap = async () => {
        if (s === 'sending') return;
        setS('sending');
        try {
            const res = await reminderService.sendBulk(tenants.map(dId));
            setS(res.sent > 0 ? 'sent' : 'error');
            setTimeout(() => setS('idle'), 3000);
        } catch (err) {
            if (err?.response?.data?.code === 'NO_REMINDERS_LEFT') { onNoCredits?.(); }
            setS('error');
            setTimeout(() => setS('idle'), 2000);
        }
    };
    const label = s === 'sent' ? 'All Sent ✓' : s === 'error' ? 'Some Failed' : s === 'sending' ? '...' : 'Remind All';
    return (
        <button onClick={tap} disabled={s === 'sending'} className={`text-xs font-black px-3 py-1.5 rounded-xl active:scale-95 disabled:opacity-50 transition ${
            s === 'sent' ? 'bg-emerald-50 text-emerald-700' : s === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-600'
        }`}>{label}</button>
    );
};

// shared loading skeleton
const TabSkeleton = () => (
    <div className="space-y-3 pt-4 animate-pulse">
        <div className="bg-slate-100 rounded-2xl h-28" />
        <div className="bg-slate-100 rounded-2xl h-20" />
        <div className="bg-slate-100 rounded-2xl h-20" />
    </div>
);

// shared insight strip — uses server-provided insights[] + severity
const InsightStrip = ({ insights, severity }) => {
    if (!insights?.length) return null;
    const cls = severity === 'HIGH' ? 'bg-rose-50 border-rose-100 text-rose-700'
        : severity === 'MEDIUM'     ? 'bg-amber-50 border-amber-100 text-amber-700'
        : 'bg-emerald-50 border-emerald-100 text-emerald-700';
    return (
        <div className={`rounded-2xl border p-4 ${cls}`}>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Insights</p>
            {insights.slice(0, 3).map((ins, i) => (
                <div key={i} className="flex items-start gap-2 text-xs font-semibold leading-snug mb-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-current mt-1 shrink-0 opacity-60" />{ins}
                </div>
            ))}
        </div>
    );
};

// ─── screen 1: cashflow command ───────────────────────────────────────────────
// Data source: /dashboard/cashflow
// Fields used: expected_rent, collected_amount, pending_amount, collection_rate,
//              overdue_amount, overdue_tenants_count,
//              top_defaulters[]{tenant_id, name, pending_amount, days_overdue},
//              daily_collection[]{date, amount}
const S1_Cashflow = ({ cfStats, cfSeverity, cfInsights, preferences, navigate }) => {
    // If the owner has no tenants and no expected rent, they are likely new.
    // SmartDashboardGuidance derives real state from the server — not just local flags.
    const isNewOwner = cfStats.expected === 0 && cfStats.topDefaulters.length === 0;
    if (isNewOwner) return <SmartDashboardGuidance />;

    const highRisk = cfStats.topDefaulters.filter(d => riskBadge(d) === 'HIGH').length;
    const actionItems = [
        cfStats.overdueCount > 0 && { id: 'remind',  icon: Bell,       color: 'text-indigo-600 bg-indigo-50',  label: `${cfStats.overdueCount} tenant${cfStats.overdueCount !== 1 ? 's' : ''} unpaid — send reminders`,                    cta: 'Payments',    path: '/owner/payments' },
        highRisk > 0             && { id: 'high',    icon: ShieldAlert, color: 'text-rose-600 bg-rose-50',      label: `${highRisk} high-risk tenant${highRisk !== 1 ? 's' : ''} — overdue > 10 days`,                                   cta: 'View',        path: '/owner/tenants'  },
        cfStats.pending > 0      && { id: 'collect', icon: Wallet,      color: 'text-emerald-600 bg-emerald-50', label: `${formatCurrency(cfStats.pending, preferences)} collectible right now`,                                          cta: 'Collect',     path: '/owner/payments' },
    ].filter(Boolean);

    const last = cfStats.daily[cfStats.daily.length - 1]?.v ?? 0;
    const prev = cfStats.daily[cfStats.daily.length - 2]?.v ?? 0;

    return (
        <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between py-1">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Cashflow</h1>
                    <p className="text-xs font-semibold text-slate-400">Revenue command center</p>
                </div>
                <button onClick={() => navigate('/owner/payments')} className="p-2 bg-white rounded-xl border border-slate-200 text-slate-500 active:scale-95">
                    <ArrowUpRight size={18} />
                </button>
            </div>

            {/* money grid — 4 cards from cashflow API */}
            <div className="grid grid-cols-2 gap-3">
                {[
                    { label: 'Expected',  value: formatCurrency(cfStats.expected,   preferences), sub: 'Total this month',              cls: 'bg-indigo-50 text-indigo-700' },
                    { label: 'Collected', value: formatCurrency(cfStats.collected,  preferences), sub: `${cfStats.rate.toFixed(1)}% rate`, cls: 'bg-emerald-50 text-emerald-700' },
                    { label: 'Pending',   value: formatCurrency(cfStats.pending,    preferences), sub: `${cfStats.overdueCount} unpaid`,  cls: cfStats.pending > 0 ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' : 'bg-slate-50 text-slate-600', pulse: cfStats.pending > 0 },
                    { label: 'Overdue',   value: formatCurrency(cfStats.overdueAmt, preferences), sub: 'Past due date',                   cls: cfStats.overdueAmt > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-600' },
                ].map(c => (
                    <button key={c.label} onClick={() => navigate('/owner/payments')} className={`p-4 rounded-2xl text-left active:scale-95 transition-transform ${c.cls}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-1">{c.label}</p>
                        <p className="text-[18px] font-black tracking-tight leading-none mb-1">{c.value}</p>
                        <p className="text-[11px] font-semibold opacity-70">{c.sub}</p>
                        {c.pulse && <span className="mt-2 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /><span className="text-[10px] font-black text-rose-500">Action needed</span></span>}
                    </button>
                ))}
            </div>

            {/* top defaulters — fields from API: tenant_id, name, pending_amount, days_overdue */}
            {cfStats.topDefaulters.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
                        <div className="flex items-center gap-2">
                            <ShieldAlert size={15} className="text-rose-500" />
                            <span className="text-sm font-black text-slate-900">Top Defaulters</span>
                            <span className="text-[11px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">{cfStats.topDefaulters.length}</span>
                        </div>
                        <RemindAllButton tenants={cfStats.topDefaulters} onNoCredits={() => navigate('/owner/billing')} />
                    </div>
                    <div className="divide-y divide-slate-50">
                        {cfStats.topDefaulters.map(d => {
                            const r = riskBadge(d);
                            return (
                                <div key={dId(d)} className="flex items-center gap-3 px-4 py-3 active:bg-slate-50">
                                    <button onClick={() => navigate(`/owner/tenants/${dId(d)}`)} className="flex-1 min-w-0 text-left">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${RC[r]}`}>{r}</span>
                                            <p className="text-sm font-extrabold text-slate-900 truncate">{dName(d)}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-black text-rose-600">{formatCurrency(dAmt(d), preferences)}</span>
                                            {dDays(d) > 0 && <span className="text-xs font-semibold text-slate-400">{dDays(d)}d overdue</span>}
                                        </div>
                                    </button>
                                    <ReminderButton tenantId={dId(d)} tenantName={dName(d)} onNoCredits={() => navigate('/owner/billing')} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* action center */}
            {actionItems.length > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-50">
                        <Zap size={15} className="text-amber-500" />
                        <span className="text-sm font-black text-slate-900">Action Center</span>
                        <span className="text-[11px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{actionItems.length}</span>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {actionItems.map(item => { const Icon = item.icon; return (
                            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}><Icon size={16} /></div>
                                <p className="flex-1 text-sm font-semibold text-slate-700 leading-snug">{item.label}</p>
                                <button onClick={() => navigate(item.path)} className="shrink-0 text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl active:scale-95 whitespace-nowrap">{item.cta}</button>
                            </div>
                        ); })}
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center shadow-sm">
                    <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-400" />
                    <p className="text-sm font-black text-slate-600">All clear — no urgent actions</p>
                </div>
            )}

            {/* sparkline — daily_collection from API */}
            {cfStats.daily.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Daily Collection</p>
                            <p className="text-lg font-black text-slate-900">{formatCurrency(last, preferences)}</p>
                        </div>
                        <span className={`flex items-center gap-1 text-xs font-black px-2 py-1 rounded-xl ${last >= prev ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'}`}>
                            {last >= prev ? <TrendingUp size={13} /> : <TrendingDown size={13} />} vs prev day
                        </span>
                    </div>
                    <div className="h-16">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={cfStats.daily} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={2} fill="url(#spark)" dot={false} />
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
// Data source: /dashboard/tenants
// Fields: distribution{good,medium,risky}, risky_tenants[]{tenant_id,name,score,pending_amount,avg_delay_days},
//         payment_behavior{on_time_percentage,avg_delay_days,reminder_dependency_rate},
//         exit_insights{total_exits,top_reasons[]{reason,count},churn_rate}
const S2_Tenants = ({ data, severity, insights, loading, preferences, navigate }) => {
    if (loading || !data) return <TabSkeleton />;
    const dist  = data.distribution    ?? { good: 0, medium: 0, risky: 0 };
    const risky = data.risky_tenants   ?? [];
    const beh   = data.payment_behavior ?? {};
    const exit  = data.exit_insights    ?? {};
    const total = (dist.good + dist.medium + dist.risky) || 1;

    return (
        <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between py-1">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tenant Intel</h1>
                    <p className="text-xs font-semibold text-slate-400">{total} scored tenants</p>
                </div>
                <button onClick={() => navigate('/owner/tenants')} className="p-2 bg-white rounded-xl border border-slate-200 text-slate-500 active:scale-95">
                    <ArrowUpRight size={18} />
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Health Distribution</p>
                <div className="flex rounded-xl overflow-hidden h-4 gap-0.5 mb-3">
                    {dist.good   > 0 && <div className="bg-emerald-400 rounded-l-xl" style={{ width: `${(dist.good   / total) * 100}%` }} />}
                    {dist.medium > 0 && <div className="bg-amber-400"                 style={{ width: `${(dist.medium / total) * 100}%` }} />}
                    {dist.risky  > 0 && <div className="bg-rose-500 rounded-r-xl"     style={{ width: `${(dist.risky  / total) * 100}%` }} />}
                </div>
                <div className="flex justify-between text-[11px] font-black">
                    <span className="text-emerald-600">{dist.good} Good</span>
                    <span className="text-amber-600">{dist.medium} Medium</span>
                    <span className="text-rose-600">{dist.risky} Risky</span>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'On-Time',    value: `${beh.on_time_percentage ?? 0}%`,  cls: (beh.on_time_percentage ?? 0) >= 70 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50' },
                    { label: 'Avg Delay',  value: (beh.avg_delay_days ?? 0) > 0 ? `${Math.round(beh.avg_delay_days)}d` : '—', cls: (beh.avg_delay_days ?? 0) > 7 ? 'text-rose-700 bg-rose-50' : 'text-slate-700 bg-slate-50' },
                    { label: 'Need Remind',value: `${beh.reminder_dependency_rate ?? 0}%`, cls: 'text-indigo-700 bg-indigo-50' },
                ].map(c => (
                    <div key={c.label} className={`rounded-2xl p-3 text-center ${c.cls}`}>
                        <p className="text-xl font-black">{c.value}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mt-0.5">{c.label}</p>
                    </div>
                ))}
            </div>

            {risky.length > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-50">
                        <ShieldAlert size={15} className="text-rose-500" />
                        <span className="text-sm font-black text-slate-900">Risky Tenants</span>
                        <span className="text-[11px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">{risky.length}</span>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {risky.map(t => (
                            <div key={t.tenant_id} className="flex items-center gap-3 px-4 py-3 active:bg-slate-50">
                                <button onClick={() => navigate(`/owner/tenants/${t.tenant_id}`)} className="flex-1 min-w-0 text-left">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${t.score < 30 ? RC.HIGH : RC.MEDIUM}`}>Score {t.score}</span>
                                        <p className="text-sm font-extrabold text-slate-900 truncate">{t.name}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {t.pending_amount > 0 && <span className="text-sm font-black text-rose-600">{formatCurrency(t.pending_amount, preferences)}</span>}
                                        {t.avg_delay_days > 0 && <span className="text-xs text-slate-400">{Math.round(t.avg_delay_days)}d avg delay</span>}
                                    </div>
                                </button>
                                <div className="flex gap-1.5 shrink-0">
                                    <ReminderButton tenantId={t.tenant_id} tenantName={t.name ?? 'Tenant'} onNoCredits={() => navigate('/owner/billing')} />
                                    <button onClick={() => navigate(`/owner/tenants/${t.tenant_id}`)} className="p-2 bg-slate-50 text-slate-500 rounded-xl active:scale-95">
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center shadow-sm">
                    <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
                    <p className="text-sm font-black text-slate-600">No risky tenants — all on track</p>
                </div>
            )}

            {exit.total_exits > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Exit Signals</p>
                    <div className="flex items-center gap-6 mb-3">
                        <div><p className="text-2xl font-black text-slate-900">{exit.total_exits}</p><p className="text-[10px] font-black text-slate-400 uppercase">Exits</p></div>
                        <div><p className="text-2xl font-black text-rose-600">{exit.churn_rate}%</p><p className="text-[10px] font-black text-slate-400 uppercase">Churn Rate</p></div>
                    </div>
                    {exit.top_reasons?.slice(0, 3).map((r, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1 border-t border-slate-50">
                            <span className="flex items-center gap-2 font-semibold text-slate-600"><span className="w-1.5 h-1.5 bg-slate-300 rounded-full" />{r.reason}</span>
                            <span className="font-black text-slate-900">{r.count}</span>
                        </div>
                    ))}
                </div>
            )}

            <InsightStrip insights={insights} severity={severity} />
        </div>
    );
};

// ─── screen 3: funnel ─────────────────────────────────────────────────────────
// Data source: /dashboard/funnel
// Fields: reminders_sent, conversions, conversion_rate, revenue_generated,
//         avg_time_to_pay_hours, channel_performance[]{channel,sent,converted,conversion_rate}
const S3_Funnel = ({ data, severity, insights, loading, preferences, navigate }) => {
    if (loading || !data) return <TabSkeleton />;
    const sent     = data.reminders_sent        ?? 0;
    const conv     = data.conversions           ?? 0;
    const rate     = Number(data.conversion_rate       ?? 0);
    const revenue  = Number(data.revenue_generated     ?? 0);
    const hours    = Number(data.avg_time_to_pay_hours ?? 0);
    const channels = data.channel_performance   ?? [];

    return (
        <div className="space-y-4 pt-2">
            <div className="py-1">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Revenue Funnel</h1>
                <p className="text-xs font-semibold text-slate-400">Reminder → payment pipeline</p>
            </div>

            {sent === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center shadow-sm">
                    <Target size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-black text-slate-500">No reminders sent this period</p>
                    <button onClick={() => navigate('/owner/payments')} className="mt-3 px-4 py-2 bg-indigo-500 text-white text-xs font-black rounded-xl active:scale-95">
                        Go to Payments
                    </button>
                </div>
            ) : (
                <>
                    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-3">
                        {[
                            { label: 'Reminders Sent',     value: sent, pct: 100,                              color: 'bg-indigo-500' },
                            { label: 'Payments Converted', value: conv, pct: Math.max(Math.round(rate), 4),    color: 'bg-emerald-500' },
                        ].map((s, i) => (
                            <div key={i}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-black text-slate-600">{s.label}</span>
                                    <span className="text-sm font-black text-slate-900">{s.value}</span>
                                </div>
                                <div className="h-8 bg-slate-50 rounded-xl overflow-hidden">
                                    <div className={`h-full ${s.color} rounded-xl flex items-center px-3`} style={{ width: `${s.pct}%` }}>
                                        <span className="text-[11px] font-black text-white">{s.pct}%</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-50 rounded-2xl p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 opacity-70 mb-1">Revenue via Reminders</p>
                            <p className="text-xl font-black text-emerald-700">{formatCurrency(revenue, preferences)}</p>
                            <p className="text-xs font-semibold text-emerald-600 mt-1">{rate.toFixed(1)}% conversion</p>
                        </div>
                        <div className="bg-indigo-50 rounded-2xl p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 opacity-70 mb-1">Avg Pay Time</p>
                            <p className="text-xl font-black text-indigo-700">{hours > 0 ? `${hours.toFixed(1)}h` : '—'}</p>
                            <p className="text-xs font-semibold text-indigo-600 mt-1">After reminder</p>
                        </div>
                    </div>

                    {channels.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Channel Performance</p>
                            {channels.map((ch, i) => (
                                <div key={i} className="flex items-center gap-3 mb-2">
                                    <span className="text-xs font-black text-slate-700 w-24 truncate uppercase">{ch.channel}</span>
                                    <div className="flex-1 h-2.5 bg-slate-50 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${Math.max(ch.conversion_rate, 3)}%` }} />
                                    </div>
                                    <span className="text-xs font-black text-slate-900 w-10 text-right">{ch.conversion_rate.toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            <InsightStrip insights={insights} severity={severity} />
        </div>
    );
};

// ─── screen 4: operations ─────────────────────────────────────────────────────
// Data source: /dashboard/operations
// Fields: occupancy_rate, total_rooms, occupied_rooms, avg_vacancy_days,
//         move_ins, move_outs, revenue, expenses, profit,
//         complaints{pending,resolved,avg_resolution_time_hours}
const S4_Operations = ({ data, severity, insights, loading, preferences, navigate }) => {
    if (loading || !data) return <TabSkeleton />;
    const occ      = Number(data.occupancy_rate ?? 0);
    const occupied = Number(data.occupied_rooms ?? 0);
    const rev      = Number(data.revenue        ?? 0);
    const exp      = Number(data.expenses       ?? 0);
    const profit   = Number(data.profit         ?? 0);
    const cp       = data.complaints ?? {};
    const vacant   = occ > 0 ? Math.max(0, Math.round(occupied * 100 / occ) - occupied) : 0;
    const profitPct = rev > 0 ? Math.round((profit / rev) * 100) : 0;

    return (
        <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between py-1">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">Operations</h1>
                    <p className="text-xs font-semibold text-slate-400">Property health overview</p>
                </div>
                <button onClick={() => navigate('/owner/rooms')} className="p-2 bg-white rounded-xl border border-slate-200 text-slate-500 active:scale-95">
                    <ArrowUpRight size={18} />
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Occupancy</p>
                        <p className="text-3xl font-black text-slate-900 mt-1">{occ.toFixed(1)}%</p>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5">{occupied} beds occupied · {data.total_rooms} rooms</p>
                    </div>
                    {vacant > 0 && (
                        <div className="text-right">
                            <p className="text-2xl font-black text-amber-600">{vacant}</p>
                            <p className="text-xs font-black text-amber-500">vacant</p>
                        </div>
                    )}
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-4">
                    <div className={`h-full rounded-full transition-all ${occ >= 80 ? 'bg-emerald-500' : occ >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${Math.min(occ, 100)}%` }} />
                </div>
                {vacant > 0 && (
                    <button onClick={() => navigate('/owner/rooms')} className="w-full py-3 text-sm font-black text-white bg-indigo-500 rounded-xl active:scale-95">
                        Fill {vacant} Vacant {vacant !== 1 ? 'Beds' : 'Bed'}
                    </button>
                )}
                <div className="flex gap-4 mt-3 pt-3 border-t border-slate-50">
                    <div><p className="text-sm font-black text-emerald-600">+{data.move_ins ?? 0}</p><p className="text-[10px] font-black text-slate-400 uppercase">Move-ins</p></div>
                    <div><p className="text-sm font-black text-rose-500">-{data.move_outs ?? 0}</p><p className="text-[10px] font-black text-slate-400 uppercase">Move-outs</p></div>
                    {data.avg_vacancy_days > 0 && <div><p className="text-sm font-black text-amber-600">{data.avg_vacancy_days}d</p><p className="text-[10px] font-black text-slate-400 uppercase">Avg Vacant</p></div>}
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Revenue vs Expenses</p>
                {[
                    { label: 'Revenue',  value: rev,    color: 'bg-emerald-500', pct: 100 },
                    { label: 'Expenses', value: exp,    color: 'bg-rose-400',    pct: rev > 0 ? Math.min(Math.round((exp / rev) * 100), 100) : 0 },
                    { label: 'Profit',   value: profit, color: profit >= 0 ? 'bg-indigo-500' : 'bg-rose-600', pct: Math.max(Math.abs(profitPct), 4) },
                ].map(row => (
                    <div key={row.label} className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-black text-slate-600">{row.label}</span>
                            <span className="text-sm font-black text-slate-900">{formatCurrency(row.value, preferences)}</span>
                        </div>
                        <div className="h-2.5 bg-slate-50 rounded-full overflow-hidden">
                            <div className={`h-full ${row.color} rounded-full`} style={{ width: `${Math.min(row.pct, 100)}%` }} />
                        </div>
                    </div>
                ))}
                <button onClick={() => navigate('/owner/expenses')} className="mt-2 w-full py-2.5 text-xs font-black text-indigo-600 bg-indigo-50 rounded-xl active:scale-95">
                    Manage Expenses
                </button>
            </div>

            {cp.pending > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock size={14} className="text-amber-600" />
                        <p className="text-sm font-extrabold text-amber-800">{cp.pending} complaint{cp.pending !== 1 ? 's' : ''} pending</p>
                    </div>
                    <p className="text-xs text-amber-600">Avg resolution: {cp.avg_resolution_time_hours?.toFixed(1)}h · {cp.resolved} resolved</p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                {[
                    { label: 'All Tenants', icon: Users,     path: '/owner/tenants',     cls: 'bg-indigo-50 text-indigo-600' },
                    { label: 'All Rooms',   icon: BedDouble,  path: '/owner/rooms',      cls: 'bg-purple-50 text-purple-600' },
                    { label: 'Payments',    icon: Wallet,     path: '/owner/payments',   cls: 'bg-emerald-50 text-emerald-600' },
                    { label: 'Activity',    icon: Activity,   path: '/owner/activities', cls: 'bg-slate-50 text-slate-600' },
                ].map(l => { const Icon = l.icon; return (
                    <button key={l.label} onClick={() => navigate(l.path)} className={`flex items-center gap-3 p-4 rounded-2xl active:scale-95 transition-transform ${l.cls}`}>
                        <Icon size={18} /><span className="text-sm font-black">{l.label}</span><ChevronRight size={14} className="ml-auto opacity-50" />
                    </button>
                ); })}
            </div>

            <InsightStrip insights={insights} severity={severity} />
        </div>
    );
};

// ─── bottom tab bar ──────────────────────────────────────────────────────────
const TabBar = ({ active, onChange, badge }) => {
    const tabs = [
        { id: 'cashflow',   label: 'Cashflow',   Icon: LayoutDashboard },
        { id: 'tenants',    label: 'Tenants',     Icon: Users           },
        { id: 'funnel',     label: 'Funnel',      Icon: BarChart2       },
        { id: 'operations', label: 'Operations',  Icon: Home            },
    ];
    return (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 safe-bottom">
            <div className="flex h-16 max-w-lg mx-auto">
                {tabs.map(t => {
                    const on = active === t.id;
                    return (
                        <button key={t.id} onClick={() => onChange(t.id)} className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors active:scale-95 ${on ? 'text-indigo-600' : 'text-slate-400'}`}>
                            <div className="relative">
                                <t.Icon size={20} strokeWidth={on ? 2.5 : 1.8} />
                                {t.id === 'tenants' && badge > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">{badge > 9 ? '9+' : badge}</span>
                                )}
                            </div>
                            <span className={`text-[10px] font-black tracking-wide ${on ? 'text-indigo-600' : 'text-slate-400'}`}>{t.label}</span>
                            {on && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-indigo-600 rounded-full" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default OwnerDashboard;
