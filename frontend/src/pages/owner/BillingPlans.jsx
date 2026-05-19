import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    CreditCard, Users, Building2, CheckCircle2, XCircle,
    Clock3, CalendarDays, TrendingUp, Loader2, RefreshCw,
    Zap, MessageSquare, BarChart3, Layout, AlertTriangle, PhoneCall, Receipt, Sparkles, ArrowRight
} from 'lucide-react';
import api from '../../api/axios';
import BuyRemindersModal from '../../components/owner/BuyRemindersModal';
import { useSubscription, usePlans } from '../../hooks/useBilling';
import OverflowUsageMeter from '../../components/owner/billing/OverflowUsageMeter';
import OverflowChargeCard from '../../components/owner/billing/OverflowChargeCard';
import UpgradeNudgeCard from '../../components/owner/billing/UpgradeNudgeCard';
import { motion, AnimatePresence } from 'framer-motion';

function limitDisplay(val) {
    if (val === 0 || val === null || val === undefined) return 'Unlimited';
    return String(val);
}

function fmtPrice(plan) {
    if (!plan) return 'Free';
    if (plan.is_custom_pricing || plan.id === 'SCALE') return "Let's talk";
    if (!plan.price || plan.price === 0) return 'Free';
    return `₹${Number(plan.price).toLocaleString('en-IN')}`;
}

function fmtDate(d) {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
    const map = {
        FREE:     'bg-slate-100 text-slate-600',
        ACTIVE:   'bg-emerald-50 text-emerald-600 border-emerald-100',
        TRIAL:    'bg-blue-50 text-blue-600 border-blue-100',
        GRACE:    'bg-amber-50 text-amber-600 border-amber-100',
        PAST_DUE: 'bg-rose-50 text-rose-600 border-rose-100',
        EXPIRED:  'bg-rose-100 text-rose-700',
        LIMITED:  'bg-orange-100 text-orange-700',
    };
    const s = (status || 'FREE').toUpperCase();
    return (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${map[s] || map.FREE}`}>
            {s}
        </span>
    );
}

function UsageBar({ label, used, limit, Icon }) {
    const hasLimit = typeof limit === 'number' && limit > 0;
    const pct = hasLimit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    const barColor = pct >= 90 ? 'bg-rose-500' : pct >= 75 ? 'bg-amber-400' : 'bg-ops-accent';
    return (
        <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 shadow-sm">
                        {Icon && <Icon size={16} />}
                    </div>
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">{label}</span>
                </div>
                <span className="text-xs font-black text-slate-900">{used} / {hasLimit ? limit : '∞'}</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200/50 overflow-hidden">
                {hasLimit
                    ? <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className={`h-full rounded-full ${barColor}`} />
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
        { label: `${limitDisplay(plan.hostel_limit)} Hostels`, ok: true },
        { label: `${limitDisplay(plan.tenant_limit)} Tenants`, ok: true },
        { label: 'Smart Automation', ok: plan.automation },
        { label: 'Multi-hostel Management', ok: plan.multi_hostel },
        { label: 'Business Analytics', ok: plan.analytics },
    ];

    return (
        <motion.div 
            whileHover={{ y: -4 }}
            className={`relative flex flex-col rounded-[2.5rem] border p-8 transition-all duration-300 h-full ${
                isCurrent
                ? 'border-purple-200 bg-ops-accent/10/50 shadow-2xl shadow-purple-100/50 ring-2 ring-purple-100'
                : isPopular
                    ? 'border-ops-accent/100 bg-white shadow-2xl shadow-teal-50 hover:border-ops-accent/200'
                    : 'border-slate-100 bg-white hover:border-slate-200'
            }`}
        >
            {isCurrent && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full shadow-lg">
                    Active Plan
                </div>
            )}
            {!isCurrent && isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-ops-accent text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full shadow-lg">
                    Most Popular
                </div>
            )}

            <div className="mb-8">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">{plan.name}</p>
                <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-slate-900 tracking-tighter">{fmtPrice(plan)}</span>
                    {!isScale && plan.price > 0 && <span className="text-slate-400 text-sm font-bold">/mo</span>}
                </div>
            </div>

            <ul className="space-y-4 mb-10 flex-1">
                {features.map((f, i) => (
                    <li key={i} className={`flex items-center gap-3 text-xs font-bold ${f.ok ? 'text-slate-700' : 'text-slate-300'}`}>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${f.ok ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-200'}`}>
                            {f.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        </div>
                        {f.label}
                    </li>
                ))}
            </ul>

            <div className="mt-auto">
                {isCurrent ? (
                    plan.id === 'FREE' ? (
                        <div className="space-y-4">
                            <Button 
                                onClick={onBuyCredits}
                                className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 flex items-center justify-center gap-2 group"
                            >
                                <Zap size={14} className="text-amber-400" />
                                Buy Reminders
                            </Button>
                        </div>
                    ) : (
                        <div className="w-full h-14 bg-purple-100 text-ops-accent rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center">
                            Currently Active
                        </div>
                    )
                ) : isScale ? (
                    <Button 
                        onClick={() => window.location.href = "mailto:hello@sriadithyahostels.in"}
                        className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest"
                    >
                        Contact Enterprise
                    </Button>
                ) : isUpgrade ? (
                    <Button 
                        onClick={() => onUpgrade(plan.id)}
                        disabled={!!upgrading}
                        className="w-full h-14 bg-brand-gradient text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-purple-100 flex items-center justify-center gap-2 group"
                    >
                        {upgrading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {upgrading ? 'Processing...' : 'Upgrade Now'}
                        {!upgrading && <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />}
                    </Button>
                ) : (
                    <div className="w-full h-14 border border-slate-100 text-slate-300 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center">
                        Downgrade
                    </div>
                )}
            </div>
        </motion.div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BillingPlans() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { data: subscription, isLoading: subLoading, error: subError, refetch: refetchSub } = useSubscription();
    const { data: plans = [], isLoading: plansLoading, error: plansError, refetch: refetchPlans } = usePlans();
    
    const [upgrading, setUpgrading]   = useState(null);
    const [upgradeError, setUpgradeError] = useState('');
    const [returnStatus, setReturnStatus] = useState('');
    const [buyModalOpen, setBuyModalOpen] = useState(false);
    const verifiedReturnRef = useRef(false);

    useEffect(() => {
        const merchantTxnId = searchParams.get('merchant_txn_id');
        if (!merchantTxnId || verifiedReturnRef.current) return;
        verifiedReturnRef.current = true;
        setReturnStatus('Verifying payment...');
        api.post('/payments/verify', { merchant_txn_id: merchantTxnId })
            .then(() => {
                setReturnStatus('Subscription activated!');
                refetchSub(); refetchPlans();
            })
            .catch(() => setReturnStatus('Verification failed.'))
            .finally(() => navigate('/dashboard/billing', { replace: true }));
    }, [navigate, refetchPlans, refetchSub, searchParams]);

    const handleUpgrade = async (planId) => {
        setUpgrading(planId);
        try {
            const res = await api.post('/billing/upgrade', { plan_id: planId });
            const url = res.data?.data?.payment?.checkout_url || res.data?.payment?.checkout_url;
            if (url) window.location.href = url;
            else setUpgradeError('Payment gateway error.');
        } catch (e) {
            setUpgradeError(e?.response?.data?.error?.message || 'Upgrade failed.');
        } finally {
            setUpgrading(null);
        }
    };

    if (subLoading || plansLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
                <div className="w-12 h-12 bg-ops-accent/10 rounded-2xl flex items-center justify-center text-ops-accent animate-pulse">
                    <RefreshCw size={24} className="animate-spin" />
                </div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Syncing Billing...</p>
            </div>
        );
    }

    const currentPlanId = subscription?.current_plan?.id || 'FREE';
    const PLAN_ORDER = ['FREE', 'STARTER', 'GROWTH', 'BUSINESS', 'SCALE'];
    const currentPlanIndex = PLAN_ORDER.indexOf(currentPlanId);
    const usage = subscription?.usage || { tenants: { used: 0, limit: 15 }, hostels: { used: 0, limit: 1 } };
    const overflow = subscription?.overflow || null;

    return (
        <div className="space-y-10 pb-20">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-1">Management</p>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Billing & Plans</h1>
                </div>
                <div className="flex gap-3">
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                            <StatusBadge status={subscription?.subscription?.status} />
                        </div>
                        <div className="w-px h-8 bg-slate-100" />
                        <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Plan</p>
                            <p className="text-xs font-black text-slate-900">{subscription?.current_plan?.name}</p>
                        </div>
                    </div>
                </div>
            </header>

            {(upgradeError || returnStatus) && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }}
                    className={`p-4 rounded-[1.5rem] border text-xs font-bold flex items-center gap-3 ${upgradeError ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}
                >
                    {upgradeError ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                    {upgradeError || returnStatus}
                </motion.div>
            )}

            <section className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xl shadow-slate-50">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-ops-accent/10 rounded-xl flex items-center justify-center text-ops-accent shadow-sm">
                        <TrendingUp size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-900">Resource Usage</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Capacity monitoring</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {overflow?.enabled
                        ? <OverflowUsageMeter overflow={overflow} />
                        : <UsageBar label="Tenants" used={usage.tenants?.used || 0} limit={usage.tenants?.limit} Icon={Users} />
                    }
                    <UsageBar label="Hostels" used={usage.hostels?.used || 0} limit={usage.hostels?.limit} Icon={Building2} />
                </div>
                {overflow?.overflow_count > 0 && (
                    <div className="mt-8">
                        <OverflowChargeCard overflow={overflow} currentPlan={subscription?.current_plan} />
                    </div>
                )}
            </section>

            {overflow?.upgrade_nudge?.show && (
                <UpgradeNudgeCard overflow={overflow} onUpgrade={handleUpgrade} upgrading={upgrading} />
            )}

            <section>
                <div className="flex items-center gap-3 mb-8 px-4">
                    <div className="w-10 h-10 bg-ops-accent/10 rounded-xl flex items-center justify-center text-ops-accent shadow-sm">
                        <Zap size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-900">Select a Plan</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Scale your property portfolio</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {plans.filter(p => p.id !== 'SCALE').map((plan, idx) => (
                        <PlanCard
                            key={plan.id}
                            plan={plan}
                            isCurrent={plan.id === currentPlanId}
                            isUpgrade={idx > currentPlanIndex}
                            upgrading={upgrading === plan.id}
                            onUpgrade={handleUpgrade}
                            onBuyCredits={() => setBuyModalOpen(true)}
                        />
                    ))}
                </div>
                
                {plans.find(p => p.id === 'SCALE') && (
                    <div className="mt-12 max-w-lg mx-auto">
                        <PlanCard
                            plan={plans.find(p => p.id === 'SCALE')}
                            isCurrent={currentPlanId === 'SCALE'}
                            isUpgrade={currentPlanIndex < 4}
                            onUpgrade={handleUpgrade}
                        />
                    </div>
                )}
            </section>

            <section className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xl shadow-slate-50">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 shadow-sm">
                        <Receipt size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-900">Billing History</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Previous invoices</p>
                    </div>
                </div>
                <div className="space-y-4">
                    {subscription?.billing_history?.length > 0 ? (
                        subscription.billing_history.map(item => (
                            <div key={item.id} className="p-6 rounded-[2rem] border border-slate-50 hover:bg-slate-50 transition-all flex items-center justify-between group">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-indigo-400 transition-colors shadow-sm">
                                        <Receipt size={20} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-slate-900">{item.invoice_number || 'Premium Subscription'}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{fmtDate(item.created_at)}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-black text-slate-900">₹{Number(item.amount || 0).toLocaleString('en-IN')}</p>
                                    <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border ${item.status === 'PAID' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                        {item.status}
                                    </span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">No transaction history found</p>
                        </div>
                    )}
                </div>
            </section>

            {buyModalOpen && <BuyRemindersModal onClose={() => setBuyModalOpen(false)} />}
        </div>
    );
}

// Helper components
const Button = ({ children, className, onClick, disabled, type = "button" }) => (
    <button 
        type={type}
        disabled={disabled}
        onClick={onClick}
        className={`transition-all active:scale-95 disabled:opacity-50 ${className}`}
    >
        {children}
    </button>
);
