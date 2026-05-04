import React, { useEffect, useState } from 'react';
import {
    CreditCard, Users, Building2, CheckCircle2, XCircle,
    Clock3, CalendarDays, TrendingUp, Loader2, RefreshCw,
    Zap, MessageSquare, BarChart3, Layout, AlertTriangle, PhoneCall
} from 'lucide-react';
import { billingService } from '../../api/services';
import api from '../../api/axios';
import BuyRemindersModal from '../../components/owner/BuyRemindersModal';

// Plan tier order — used to determine upgrade vs downgrade
const PLAN_ORDER = ['FREE', 'STARTER', 'GROWTH', 'BUSINESS', 'SCALE'];

function limitDisplay(val) {
    if (val === 0 || val === null || val === undefined) return 'Unlimited';
    return String(val);
}

function fmtPrice(plan) {
    if (!plan) return 'Free';
    if (plan.is_custom_pricing || plan.id === 'SCALE') return "Let's talk";
    if (!plan.price || plan.price === 0) return 'Free';
    return `₹${Number(plan.price).toLocaleString('en-IN')}/mo`;
}

function fmtDate(d) {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
    const map = {
        FREE:     'bg-slate-100 text-slate-600',
        ACTIVE:   'bg-emerald-100 text-emerald-700',
        TRIAL:    'bg-blue-100 text-blue-700',
        GRACE:    'bg-amber-100 text-amber-700',
        PAST_DUE: 'bg-amber-100 text-amber-700',
        EXPIRED:  'bg-rose-100 text-rose-700',
        LIMITED:  'bg-orange-100 text-orange-700',
    };
    const label = { FREE: 'Free', ACTIVE: 'Active', TRIAL: 'Trial', GRACE: 'Grace Period', PAST_DUE: 'Past Due', EXPIRED: 'Expired', LIMITED: 'Limited' };
    const s = (status || 'FREE').toUpperCase();
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[s] || map.FREE}`}>
            {label[s] || s}
        </span>
    );
}

function FeatureCheck({ enabled }) {
    return enabled
        ? <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
        : <XCircle size={15} className="text-slate-300 flex-shrink-0" />;
}

function InfoBox({ label, value, ok }) {
    return (
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{label}</p>
            <p className={`font-semibold mt-1 text-sm ${ok === true ? 'text-emerald-700' : ok === false ? 'text-slate-400' : 'text-slate-800'}`}>
                {value}
            </p>
        </div>
    );
}

function UsageBar({ label, used, limit, Icon }) {
    const hasLimit = typeof limit === 'number' && limit > 0;
    const pct = hasLimit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    const barColor = pct >= 90 ? 'bg-rose-500' : pct >= 75 ? 'bg-amber-400' : 'bg-indigo-500';
    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                    {Icon && <Icon size={14} className="text-slate-400" />}
                    {label}
                </div>
                <span className="text-xs text-slate-500">{used} / {hasLimit ? limit : '∞'}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                {hasLimit
                    ? <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                    : <div className="h-full rounded-full bg-emerald-400 opacity-30 w-full" />
                }
            </div>
        </div>
    );
}

function PlanCard({ plan, isCurrent, isUpgrade, upgrading, onUpgrade, onBuyCredits }) {
    const isScale = plan.id === 'SCALE';
    const isPopular = !!plan.is_popular;

    const features = [
        { Icon: Building2, label: `${limitDisplay(plan.hostel_limit)} Hostel${plan.hostel_limit === 1 ? '' : 's'}`, ok: true },
        { Icon: Users,     label: `${limitDisplay(plan.tenant_limit)} Tenants`, ok: true },
        { Icon: Zap,       label: 'Automation',  ok: plan.automation },
        { Icon: Layout,    label: 'Multi-hostel', ok: plan.multi_hostel },
        { Icon: BarChart3, label: 'Analytics',   ok: plan.analytics },
        { Icon: MessageSquare, label: 'Send reminders using credits', ok: true },
    ];

    return (
        <div className={`relative flex flex-col rounded-2xl border p-5 transition-shadow ${
            isScale 
                ? 'border-slate-200 bg-slate-50'
                : isCurrent
                ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-200'
                : isPopular
                    ? 'border-violet-200 bg-white shadow-lg'
                    : 'border-slate-200 bg-white hover:shadow-md'
        }`}>
            {isCurrent && !isScale && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[9px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full whitespace-nowrap">
                    Current Plan
                </span>
            )}
            {!isCurrent && isPopular && !isScale && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-[9px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full">
                    Popular
                </span>
            )}
            {isScale && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-[9px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full whitespace-nowrap">
                    For large PG chains
                </span>
            )}

            <p className="text-sm font-bold text-slate-900">{plan.name}</p>
            <p className={`text-xl font-extrabold mt-1 ${isScale ? 'text-slate-500 text-base' : 'text-slate-900'}`}>
                {fmtPrice(plan)}
            </p>
            {!isScale && plan.price > 0 && (
                <p className="text-[10px] text-slate-400">billed monthly</p>
            )}

            <ul className="mt-4 space-y-2 flex-1">
                {features.map(f => (
                    <li key={f.label} className={`flex items-center gap-2 text-xs ${f.ok ? 'text-slate-700' : 'text-slate-400'}`}>
                        <FeatureCheck enabled={f.ok} />
                        {f.label}
                    </li>
                ))}
            </ul>

            <div className="mt-5">
                {isCurrent ? (
                    plan.id === 'FREE' ? (
                        <div className="space-y-2">
                            <div className="w-full py-2 rounded-xl bg-indigo-100 text-indigo-600 text-sm font-semibold text-center cursor-default">
                                Current Plan
                            </div>
                            <button
                                onClick={onBuyCredits}
                                className="w-full py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition-colors"
                            >
                                Buy Credits
                            </button>
                        </div>
                    ) : (
                        <div className="w-full py-2 rounded-xl bg-indigo-100 text-indigo-600 text-sm font-semibold text-center cursor-default">
                            Current Plan
                        </div>
                    )
                ) : isScale ? (
                    <a
                        href="mailto:hello@trishul.solutions?subject=SCALE%20Plan%20Enquiry"
                        className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition-colors"
                    >
                        <PhoneCall size={13} /> Contact Us
                    </a>
                ) : isUpgrade ? (
                    <button
                        onClick={() => onUpgrade(plan.id)}
                        disabled={!!upgrading}
                        className="w-full py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        {upgrading ? <Loader2 size={14} className="animate-spin" /> : <TrendingUp size={14} />}
                        {upgrading ? 'Processing…' : 'Upgrade'}
                    </button>
                ) : (
                    <div className="w-full py-2 rounded-xl border border-slate-200 text-slate-400 text-sm font-semibold text-center cursor-not-allowed">
                        Downgrade
                    </div>
                )}
            </div>
        </div>
    );
}

function ComparisonTable({ plans, currentPlanId }) {
    if (!plans.length) return null;
    const rows = [
        { label: 'Hostels',      render: p => limitDisplay(p.hostel_limit) },
        { label: 'Tenants',      render: p => limitDisplay(p.tenant_limit) },
        { label: 'Automation',   bool: 'automation' },
        { label: 'Multi-hostel', bool: 'multi_hostel' },
        { label: 'Analytics',    bool: 'analytics' },
        { label: 'Pay-per-use features (Reminders, Messaging)', alwaysTrue: true },
    ];
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
                <thead>
                    <tr className="border-b border-slate-100">
                        <th className="text-left py-2 pr-6 text-xs font-bold text-slate-400 uppercase tracking-wide w-32">Feature</th>
                        {plans.map(p => (
                            <th key={p.id} className={`py-2 px-3 text-center text-xs font-bold uppercase tracking-wide ${p.id === currentPlanId ? 'text-indigo-700' : 'text-slate-500'}`}>
                                {p.name}
                                {p.id === currentPlanId && <span className="ml-1 text-[9px] bg-indigo-100 text-indigo-600 px-1 rounded-full align-middle">you</span>}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {rows.map(row => (
                        <tr key={row.label} className="hover:bg-slate-50/70">
                            <td className="py-3 pr-6 text-xs font-semibold text-slate-600">{row.label}</td>
                            {plans.map(p => (
                                <td key={p.id} className={`py-3 px-3 text-center ${p.id === currentPlanId ? 'bg-indigo-50/40' : ''}`}>
                                    {row.alwaysTrue
                                        ? <div className="flex justify-center"><FeatureCheck enabled={true} /></div>
                                        : row.bool
                                        ? <div className="flex justify-center"><FeatureCheck enabled={!!p[row.bool]} /></div>
                                        : <span className="text-xs font-semibold text-slate-700">{row.render(p)}</span>
                                    }
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function BillingHistory({ items }) {
    if (!items.length) {
        return <p className="text-sm text-slate-400">No invoices yet. Upgrade to a paid plan to see billing history.</p>;
    }
    const statusStyle = {
        PAID:    'bg-emerald-50 text-emerald-600',
        PENDING: 'bg-amber-50 text-amber-600',
        FAILED:  'bg-rose-50 text-rose-600',
    };
    return (
        <div className="space-y-2">
            {items.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div>
                        <p className="text-sm font-semibold text-slate-900">{item.invoice_number || 'Invoice'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{fmtDate(item.billing_month || item.created_at)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">₹{Number(item.amount || 0).toLocaleString('en-IN')}</p>
                        <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${statusStyle[item.status] || 'bg-slate-100 text-slate-500'}`}>
                            {item.status}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BillingPlans() {
    const [loading, setLoading]       = useState(true);
    const [error, setError]           = useState('');
    const [subscription, setSubscription] = useState(null);
    const [plans, setPlans]           = useState([]);
    const [upgrading, setUpgrading]   = useState(null);
    const [upgradeError, setUpgradeError] = useState('');
    const [buyModalOpen, setBuyModalOpen] = useState(false);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const [subData, plansData] = await Promise.all([
                billingService.getSubscription(),
                billingService.getPlans(),
            ]);
            setSubscription(subData || null);

            let fetchedPlans = Array.isArray(plansData) ? plansData : (plansData?.data || []);
            const sortedPlans = [...fetchedPlans].sort(
                (a, b) => PLAN_ORDER.indexOf(a.id) - PLAN_ORDER.indexOf(b.id)
            );
            setPlans(sortedPlans);
        } catch (e) {
            setError(e?.response?.data?.error?.message || e?.message || 'Failed to load billing data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleUpgrade = async (planId) => {
        setUpgrading(planId);
        setUpgradeError('');
        try {
            const res = await api.post('/billing/upgrade', { plan_id: planId });
            const d = res.data?.data || res.data;
            const url = d?.payment?.checkout_url || d?.payment?.upi_intent_url;
            if (url) {
                window.location.href = url;
            } else {
                setUpgradeError('Payment provider returned no checkout URL. Check PhonePe configuration in Vercel.');
            }
        } catch (e) {
            setUpgradeError(e?.response?.data?.error?.message || e?.message || 'Upgrade failed. Please try again.');
        } finally {
            setUpgrading(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <Loader2 className="animate-spin text-indigo-500 mr-3" size={28} />
                <span className="text-slate-500 text-sm">Loading billing data…</span>
            </div>
        );
    }

    const currentPlan  = subscription?.current_plan || {};
    const currentPlanId = currentPlan.id || 'FREE';
    const currentPlanIndex = PLAN_ORDER.indexOf(currentPlanId);
    const usage        = subscription?.usage || { tenants: { used: 0, limit: 15 }, hostels: { used: 0, limit: 1 } };
    const subMeta      = subscription?.subscription || { status: 'FREE' };
    const history      = subscription?.billing_history || [];

    return (
        <div className="space-y-6 max-w-6xl">

            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Billing & Plans</h2>
                <p className="text-sm text-slate-500 mt-1">Manage your subscription, usage limits, and payment history.</p>
            </div>

            {error && (
                <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">
                    <AlertTriangle size={15} className="flex-shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button onClick={load} className="flex items-center gap-1 text-xs font-semibold hover:underline ml-auto">
                        <RefreshCw size={12} /> Retry
                    </button>
                </div>
            )}

            {upgradeError && (
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-3">
                    <AlertTriangle size={15} className="flex-shrink-0" />
                    <span>{upgradeError}</span>
                </div>
            )}

            {/* Current Plan + Subscription Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-base font-bold text-slate-900">Current Plan</h3>
                        <StatusBadge status={subMeta.status} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <InfoBox label="Plan"             value={currentPlan.name || 'Free'} />
                        <InfoBox label="Price"            value={fmtPrice(currentPlan)} />
                        <InfoBox label="Hostels Allowed"  value={limitDisplay(currentPlan.hostel_limit)} />
                        <InfoBox label="Tenants Allowed"  value={limitDisplay(currentPlan.tenant_limit)} />
                        <InfoBox label="Automation"       value={currentPlan.automation ? 'Enabled' : 'Disabled'} ok={currentPlan.automation} />
                    </div>
                </div>

                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 mb-4">Subscription</h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2">
                            <CreditCard size={14} className="text-slate-400" />
                            <span className="text-slate-500 font-medium">Status</span>
                            <StatusBadge status={subMeta.status} />
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                            <Clock3 size={14} className="text-slate-400" />
                            <span className="text-slate-500 font-medium">Started</span>
                            <span>{fmtDate(subMeta.start_date)}</span>
                        </div>
                        {subMeta.end_date && (
                            <div className="flex items-center gap-2 text-slate-600">
                                <CalendarDays size={14} className="text-slate-400" />
                                <span className="text-slate-500 font-medium">Ends</span>
                                <span>{fmtDate(subMeta.end_date)}</span>
                            </div>
                        )}
                        {subMeta.renewal_required && (
                            <div className="mt-2 p-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700 flex items-center gap-1.5">
                                <AlertTriangle size={12} /> Renewal required to maintain access
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Usage */}
            <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-5">Usage</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <UsageBar label="Tenants" used={usage.tenants?.used || 0} limit={usage.tenants?.limit} Icon={Users} />
                    <UsageBar label="Hostels"  used={usage.hostels?.used || 0}  limit={usage.hostels?.limit}  Icon={Building2} />
                </div>
            </section>

            {/* Available Plans */}
            {plans.length > 0 && (
                <section>
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Available Plans</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {plans.filter(p => p.id !== 'SCALE').map(plan => {
                            const idx = PLAN_ORDER.indexOf(plan.id);
                            return (
                                <PlanCard
                                    key={plan.id}
                                    plan={plan}
                                    isCurrent={plan.id === currentPlanId}
                                    isUpgrade={idx > currentPlanIndex && idx !== -1}
                                    upgrading={upgrading === plan.id}
                                    onUpgrade={handleUpgrade}
                                    onBuyCredits={() => setBuyModalOpen(true)}
                                />
                            );
                        })}
                    </div>
                    
                    {plans.find(p => p.id === 'SCALE') && (() => {
                        const plan = plans.find(p => p.id === 'SCALE');
                        return (
                            <div className="mt-8 max-w-sm mx-auto flex flex-col items-center">
                                <p className="text-sm font-semibold text-slate-500 mb-3 uppercase tracking-wide">Need more?</p>
                                <div className="w-full">
                                    <PlanCard
                                        key={plan.id}
                                        plan={plan}
                                        isCurrent={plan.id === currentPlanId}
                                        isUpgrade={false}
                                        upgrading={false}
                                        onUpgrade={handleUpgrade}
                                    />
                                </div>
                            </div>
                        );
                    })()}
                </section>
            )}

            {/* Feature Comparison */}
            {plans.length > 0 && (
                <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 mb-4">Feature Comparison</h3>
                    <ComparisonTable plans={plans} currentPlanId={currentPlanId} />
                </section>
            )}

            {/* Billing History */}
            <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-4">Billing History</h3>
                <BillingHistory items={history} />
            </section>

            {/* Modals */}
            {buyModalOpen && (
                <BuyRemindersModal onClose={() => setBuyModalOpen(false)} trigger="billing_page_free_tier" />
            )}
        </div>
    );
}
