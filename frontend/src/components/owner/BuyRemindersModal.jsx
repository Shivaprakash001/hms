/**
 * BuyRemindersModal — Production-grade reminder credit purchase modal.
 *
 * Trigger contexts:
 *   'empty'  — zero credits, action blocked
 *   'low'    — credits ≤ 20, nudge to top up
 *   'manual' — owner clicked "Buy Credits" in settings
 *
 * Flow:
 *   1. Pick pack (default: 500)
 *   2. POST /api/addons/purchase → { checkout_url }
 *   3. Redirect to PhonePe hosted checkout
 *   4. Webhook credits addon_usage
 *   5. Redirect back to /owner/billing?status=addon_success&credits=500
 */
import React, { useState } from 'react';
import { X, Zap, Check, Loader2, AlertTriangle, ArrowRight, CreditCard, Clock } from 'lucide-react';
import { addonService } from '../../api/services';

const PACKS = [
    {
        id: '200',
        credits: 200,
        amount: 99,
        label: '200 Reminders',
        price: '₹99',
        perCredit: '₹0.50 / reminder',
        daysLabel: '~20 days of reminders',
    },
    {
        id: '500',
        credits: 500,
        amount: 199,
        label: '500 Reminders',
        price: '₹199',
        perCredit: '₹0.40 / reminder',
        daysLabel: '~50 days of reminders',
        badge: 'Most Popular',
    },
];

// Rough estimate: avg hostel has ~10 tenants, sends ~10 reminders/day on heavy days
function daysLabel(credits) {
    if (credits <= 0) return null;
    const days = Math.floor(credits / 10);
    return days < 1 ? null : `~${days} days of reminders`;
}

const URGENCY = {
    empty: {
        title: '⚠️ Rent reminders are paused',
        body: 'Tenants may miss payments. Buy credits now to resume sending reminders.',
        color: 'from-rose-600 to-orange-600',
    },
    low: {
        title: 'Running low on credits',
        body: 'Top up now to avoid reminders being paused mid-cycle.',
        color: 'from-orange-500 to-amber-500',
    },
    manual: {
        title: 'Buy Reminder Credits',
        body: 'Stay on top of rent collection by sending reminders to tenants.',
        color: 'from-violet-600 to-indigo-600',
    },
};

export default function BuyRemindersModal({ onClose, trigger = 'manual', currentCredits = null }) {
    const [selected, setSelected] = useState('500');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const urgency = URGENCY[trigger] || URGENCY.manual;
    const selectedPack = PACKS.find(p => p.id === selected);

    // Time-to-exhaustion signal
    const exhaustionLabel = currentCredits !== null && currentCredits > 0
        ? daysLabel(currentCredits)
        : null;

    const handleBuy = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await addonService.purchasePack(selected);
            if (!result?.checkout_url) {
                setError('Could not create payment. Please try again.');
                setLoading(false);
                return;
            }
            // Redirect to PhonePe — stays loading until navigation completes
            window.location.href = result.checkout_url;
        } catch (e) {
            const msg = e?.response?.data?.message || 'Failed to initiate payment. Please try again.';
            setError(msg);
            setLoading(false);
        }
    };

    const handleBackdrop = (e) => {
        if (e.target === e.currentTarget && !loading) onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-slate-900/70 backdrop-blur-sm px-4 pb-4 sm:pb-0"
            onClick={handleBackdrop}
        >
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">

                {/* ── Header ── */}
                <div className={`bg-gradient-to-br ${urgency.color} px-6 pt-5 pb-8 relative`}>
                    <button onClick={onClose} disabled={loading}
                        className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition disabled:opacity-40">
                        <X size={14} />
                    </button>
                    <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                        <Zap size={22} className="text-white" />
                    </div>
                    <h2 className="text-lg font-bold text-white">{urgency.title}</h2>
                    <p className="text-sm text-white/80 mt-1 leading-relaxed">{urgency.body}</p>

                    {/* Time-to-exhaustion signal */}
                    {exhaustionLabel && trigger === 'low' && (
                        <div className="mt-2 flex items-center gap-1.5 bg-white/15 rounded-lg px-2.5 py-1.5 w-fit">
                            <Clock size={12} className="text-white/80" />
                            <span className="text-xs font-medium text-white/90">{exhaustionLabel} remaining</span>
                        </div>
                    )}
                </div>

                {/* ── Pack selector ── */}
                <div className="px-5 pt-5 pb-3 space-y-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Choose a pack</p>
                    {PACKS.map((pack) => (
                        <button key={pack.id} type="button" disabled={loading}
                            onClick={() => setSelected(pack.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                                selected === pack.id
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                            } disabled:opacity-60`}
                        >
                            {/* Radio circle */}
                            <div className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                                selected === pack.id ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                            }`}>
                                {selected === pack.id && <Check size={8} className="text-white" strokeWidth={3} />}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-sm font-semibold ${selected === pack.id ? 'text-indigo-800' : 'text-slate-700'}`}>
                                        {pack.label}
                                    </span>
                                    {pack.badge && (
                                        <span className="px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-600 text-[10px] font-bold uppercase tracking-wider">
                                            {pack.badge}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5">{pack.perCredit} · {pack.daysLabel}</p>
                            </div>

                            <span className={`text-base font-bold flex-shrink-0 ${selected === pack.id ? 'text-indigo-600' : 'text-slate-600'}`}>
                                {pack.price}
                            </span>
                        </button>
                    ))}
                </div>

                {/* ── Error ── */}
                {error && (
                    <div className="mx-5 mb-3 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                        <AlertTriangle size={14} className="text-rose-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-rose-700">{error}</p>
                    </div>
                )}

                {/* ── CTA ── */}
                <div className="px-5 pb-4 pt-1 flex flex-col gap-2">
                    <button type="button" onClick={handleBuy} disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
                        {loading
                            ? <><Loader2 size={16} className="animate-spin" /> Redirecting to payment…</>
                            : <><CreditCard size={16} /> Buy {selectedPack?.credits} Credits — {selectedPack?.price} <ArrowRight size={14} /></>}
                    </button>
                    {!loading && (
                        <button type="button" onClick={onClose}
                            className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 transition">
                            {trigger === 'empty' ? 'Skip for now (reminders stay paused)' : 'Maybe later'}
                        </button>
                    )}
                </div>

                {/* ── Trust signal ── */}
                <div className="pb-4 text-center">
                    <p className="text-[11px] text-slate-400">🔒 Secure payment via PhonePe · Credits never expire</p>
                </div>
            </div>
        </div>
    );
}
