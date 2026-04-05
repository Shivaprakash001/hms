import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, Wallet, CalendarDays, CheckCircle2, Clock3 } from 'lucide-react';
import { billingService } from '../../api/services';

export default function BillingPlans() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [subscription, setSubscription] = useState(null);
    const [plans, setPlans] = useState([]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const [subData, plansData] = await Promise.all([
                    billingService.getSubscription(),
                    billingService.getPlans()
                ]);
                setSubscription(subData || null);
                setPlans(Array.isArray(plansData) ? plansData : []);
            } catch (e) {
                const detail = e?.response?.data?.detail;
                setError(typeof detail === 'string' ? detail : (detail?.message || 'Failed to load billing data'));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const currentPlan = subscription?.current_plan || {
        name: 'Starter',
        price: 0,
        currency: 'INR',
        room_limit: 50,
        hostel_limit: 1,
        next_billing_date: null,
    };

    const usage = subscription?.usage || {
        rooms: { used: 0, limit: 50 },
        tenants: { used: 0, limit: null },
        storage: { used_mb: 0, limit_mb: 500 },
        hostels: { used: 1, limit: 1 }
    };

    const billingHistory = subscription?.billing_history || [];
    const paymentMethod = subscription?.payment_method || { label: 'No payment method added' };
    const subscriptionMeta = subscription?.subscription || { status: 'FREE', start_date: null, next_billing_date: null, renewal_required: false };

    const availablePlans = useMemo(() => {
        if (plans.length > 0) return plans;
        return [
            { code: 'STARTER', name: 'Starter', price: 0, currency: 'INR', room_limit: 50, hostel_limit: 1, features: ['1 Hostel', '50 Rooms'] },
            { code: 'PRO', name: 'Pro', price: 999, currency: 'INR', room_limit: 200, hostel_limit: 3, features: ['3 Hostels', '200 Rooms'] },
            { code: 'BUSINESS', name: 'Business', price: 2499, currency: 'INR', room_limit: null, hostel_limit: null, features: ['Unlimited Hostels', 'Unlimited Rooms', 'Priority Support'] },
        ];
    }, [plans]);

    if (loading) {
        return <div className="p-6 text-slate-500">Loading billing and plans...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Billing & Plans</h2>
                <p className="text-sm text-slate-500 mt-1">Track plan, usage, and billing readiness for Razorpay launch.</p>
            </div>

            {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl px-4 py-3">{error}</div>}

            <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-4">Current Plan</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <Info label="Plan" value={`${currentPlan.name} Plan`} />
                    <Info label="Price" value={`${symbolFor(currentPlan.currency)}${currentPlan.price} / month`} />
                    <Info label="Rooms Allowed" value={limitText(currentPlan.room_limit)} />
                    <Info label="Tenants Allowed" value={'Unlimited'} />
                    <Info label="Hostels Allowed" value={limitText(currentPlan.hostel_limit)} />
                    <Info label="Next Billing Date" value={currentPlan.next_billing_date || 'N/A'} />
                </div>
                <button className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold opacity-80 cursor-not-allowed">
                    <CreditCard size={16} /> Upgrade coming soon
                </button>
            </section>

            <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-4">Usage Limits</h3>
                <div className="space-y-4">
                    <UsageBar label="Rooms Used" used={usage.rooms?.used || 0} limit={usage.rooms?.limit} />
                    <UsageBar label="Tenants" used={usage.tenants?.used || 0} limit={usage.tenants?.limit} />
                    <UsageBar label="Hostels" used={usage.hostels?.used || 0} limit={usage.hostels?.limit} />
                    <UsageBar label="Storage" used={usage.storage?.used_mb || 0} limit={usage.storage?.limit_mb} unit="MB" />
                </div>
            </section>

            <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-4">Available Plans</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {availablePlans.map((plan) => (
                        <div key={plan.code || plan.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                            <p className="text-sm font-bold text-slate-900">{plan.name}</p>
                            <p className="text-xl font-extrabold text-slate-900 mt-1">{symbolFor(plan.currency)}{plan.price}<span className="text-xs font-medium text-slate-500">/month</span></p>
                            <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
                                <li className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> {limitText(plan.hostel_limit)} Hostels</li>
                                <li className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-500" /> {limitText(plan.room_limit)} Rooms</li>
                            </ul>
                            <button className="mt-4 w-full py-2 rounded-lg bg-white border border-slate-200 text-slate-500 text-sm font-semibold cursor-not-allowed">Upgrade coming soon</button>
                        </div>
                    ))}
                </div>
            </section>

            <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-4">Billing History</h3>
                {billingHistory.length === 0 ? (
                    <div className="text-sm text-slate-500">Starter plan active. No paid invoices yet.</div>
                ) : (
                    <div className="space-y-2">
                        {billingHistory.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">{item.invoice_number || 'Invoice'}</p>
                                    <p className="text-xs text-slate-500">{item.billing_month || item.created_at}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-slate-900">{symbolFor(item.currency)}{item.amount}</p>
                                    <p className="text-xs text-slate-500 uppercase">{item.status}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 mb-3">Payment Method</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Wallet size={16} /> {paymentMethod.label || 'No payment method added'}
                    </div>
                    <button className="mt-4 px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-500 cursor-not-allowed">Update payment method (coming soon)</button>
                </section>

                <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-base font-bold text-slate-900 mb-3">Subscription Status</h3>
                    <div className="space-y-2 text-sm text-slate-600">
                        <p className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Status: {subscriptionMeta.status || 'FREE'}</p>
                        <p className="flex items-center gap-2"><Clock3 size={16} className="text-slate-500" /> Started: {subscriptionMeta.start_date || 'N/A'}</p>
                        <p className="flex items-center gap-2"><CalendarDays size={16} className="text-slate-500" /> Renewal: {subscriptionMeta.next_billing_date || 'No renewal required'}</p>
                    </div>
                </section>
            </div>
        </div>
    );
}

function Info({ label, value }) {
    return (
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{label}</p>
            <p className="text-slate-800 font-semibold mt-1">{value}</p>
        </div>
    );
}

function UsageBar({ label, used, limit, unit = '' }) {
    const percentage = typeof limit === 'number' && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    return (
        <div>
            <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold text-slate-800">{label}</span>
                <span className="text-slate-500">{displayUsage(used, limit, unit)}</span>
            </div>
            {typeof limit === 'number' && limit > 0 ? (
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${percentage}%` }} />
                </div>
            ) : (
                <p className="text-xs text-slate-400">Unlimited</p>
            )}
        </div>
    );
}

function displayUsage(used, limit, unit) {
    const suffix = unit ? ` ${unit}` : '';
    if (typeof limit === 'number') return `${used}${suffix} / ${limit}${suffix}`;
    return `${used}${suffix} / Unlimited`;
}

function limitText(value) {
    return (typeof value === 'number' && value > 0) ? `${value}` : 'Unlimited';
}

function symbolFor(currency) {
    if (currency === 'INR') return '₹';
    if (currency === 'USD') return '$';
    if (currency === 'EUR') return '€';
    if (currency === 'GBP') return '£';
    return '₹';
}
