import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, BadgeCheck, Building2, CheckCircle2, CreditCard, Loader2,
  ShieldCheck, Smartphone, Sparkles, Wallet, Zap
} from 'lucide-react';
import api from '../../api/axios';
import { setStoredStep } from '../../hooks/useOnboardingState';

const PLAN_COPY = [
  {
    id: 'FREE',
    billingPlanId: 'FREE',
    name: 'Free',
    priceMonthly: 0,
    promise: 'Start organizing your hostel without commitment.',
    bestFor: 'Best for testing HMS with a small property.',
    cta: 'Start Free',
    tone: 'slate',
    features: ['1 hostel workspace', 'Basic rooms and tenants', 'Manual rent tracking', 'Payment history'],
  },
  {
    id: 'STANDARD',
    billingPlanId: 'STARTER',
    name: 'Standard',
    priceMonthly: 799,
    promise: 'Run monthly rent collection with less chasing.',
    bestFor: 'Recommended for active hostel owners.',
    cta: 'Continue with Standard',
    recommended: true,
    tone: 'indigo',
    features: ['Rent automation', 'Reminder credits support', 'Receipt-ready collections', 'Operational dashboard'],
  },
  {
    id: 'GROWTH',
    billingPlanId: 'GROWTH',
    name: 'Growth',
    priceMonthly: 1499,
    promise: 'Scale collections across more tenants and hostels.',
    bestFor: 'Best for growing PG and hostel businesses.',
    cta: 'Upgrade to Growth',
    tone: 'violet',
    features: ['Higher tenant limits', 'Advanced analytics', 'Multi-hostel ready', 'Priority business workflows'],
  },
];

const FEATURE_ROWS = [
  ['Business setup checklist', true, true, true],
  ['Rent and dues tracking', true, true, true],
  ['Automation workflows', false, true, true],
  ['Growth analytics', false, false, true],
];

function price(plan, cycle) {
  if (plan.priceMonthly === 0) return 'Free';
  const monthly = cycle === 'yearly' ? Math.round(plan.priceMonthly * 10 / 12) : plan.priceMonthly;
  return `₹${monthly.toLocaleString('en-IN')}`;
}

function PlanCard({ plan, cycle, selected, loading, onSelect }) {
  const isPaid = plan.priceMonthly > 0;
  const border = plan.recommended
    ? 'border-indigo-300 ring-2 ring-indigo-100 shadow-xl shadow-indigo-100/70'
    : selected
      ? 'border-slate-900 shadow-lg'
      : 'border-slate-200 shadow-sm';

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.985 }}
      onClick={() => onSelect(plan)}
      disabled={loading}
      className={`relative w-full text-left rounded-3xl border bg-white p-5 transition-all ${border}`}
    >
      {plan.recommended && (
        <div className="absolute -top-3 left-5 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
          Recommended
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-black text-slate-950">{plan.name}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{plan.bestFor}</p>
        </div>
        {selected && <CheckCircle2 className="text-emerald-500" size={22} />}
      </div>

      <div className="mt-5 flex items-end gap-1">
        <span className="text-3xl font-black tracking-tight text-slate-950">{price(plan, cycle)}</span>
        {isPaid && <span className="mb-1 text-xs font-bold text-slate-400">/month</span>}
      </div>
      {isPaid && cycle === 'yearly' && (
        <p className="mt-1 text-xs font-black text-emerald-600">Two months free with yearly billing</p>
      )}

      <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-600">{plan.promise}</p>

      <div className="mt-5 space-y-2.5">
        {plan.features.map((feature) => (
          <div key={feature} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <BadgeCheck size={15} className="text-emerald-500" />
            {feature}
          </div>
        ))}
      </div>

      <div className={`mt-6 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black ${
        plan.recommended ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-white'
      }`}>
        {loading && selected ? <Loader2 size={16} className="animate-spin" /> : plan.cta}
        {!loading && <ArrowRight size={15} />}
      </div>
    </motion.button>
  );
}

function CheckoutModal({ plan, cycle, loading, error, onClose, onConfirm }) {
  const [method, setMethod] = useState('upi');
  if (!plan) return null;
  const methods = [
    { id: 'upi', label: 'UPI', icon: Smartphone },
    { id: 'card', label: 'Card', icon: CreditCard },
    { id: 'netbanking', label: 'Net banking', icon: Wallet },
  ];

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        className="fixed inset-x-4 bottom-4 z-[90] mx-auto max-w-lg rounded-[2rem] bg-white p-5 shadow-2xl sm:inset-auto sm:top-1/2 sm:-translate-y-1/2"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-indigo-600">Secure checkout</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{plan.name} plan</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {price(plan, cycle)}/month · {cycle === 'yearly' ? 'yearly billing' : 'monthly billing'}
            </p>
          </div>
          <button onClick={onClose} disabled={loading} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-500">
            Close
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {methods.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMethod(id)}
              className={`rounded-2xl border p-3 text-center text-xs font-black transition ${
                method === id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500'
              }`}
            >
              <Icon size={18} className="mx-auto mb-1" />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 text-emerald-600" />
            <p className="text-sm font-semibold leading-relaxed text-slate-600">
              We will open a secure payment page. After confirmation, you will continue to hostel setup.
            </p>
          </div>
        </div>

        {error && <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

        <button
          type="button"
          onClick={() => onConfirm(plan)}
          disabled={loading}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white disabled:opacity-60"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : 'Continue to Payment'}
          {!loading && <ArrowRight size={16} />}
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

export default function OnboardingPlans() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [cycle, setCycle] = useState('monthly');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [loadingPlanId, setLoadingPlanId] = useState('');
  const [error, setError] = useState('');
  const verifiedRef = useRef(false);

  useEffect(() => {
    const merchantTxnId = searchParams.get('merchant_txn_id');
    if (!merchantTxnId || verifiedRef.current) return;
    verifiedRef.current = true;
    setLoadingPlanId('return');
    api.post('/payments/verify', { merchant_txn_id: merchantTxnId })
      .then(() => {
        setStoredStep('PLAN_SELECTED');
        navigate('/onboarding/hostel', { replace: true });
      })
      .catch(() => setError('Payment is still processing. You can continue once it is confirmed.'))
      .finally(() => setLoadingPlanId(''));
  }, [navigate, searchParams]);

  const yearlySavings = useMemo(() => 'Save 17%', []);

  const handleSelect = async (plan) => {
    setSelectedPlan(plan.id);
    setError('');
    if (plan.priceMonthly === 0) {
      setStoredStep('PLAN_SELECTED');
      navigate('/onboarding/hostel');
      return;
    }
    setCheckoutPlan(plan);
  };

  const handlePaidConfirm = async (plan) => {
    setLoadingPlanId(plan.id);
    setError('');
    try {
      const res = await api.post('/billing/upgrade', {
        plan_id: plan.billingPlanId,
        billing_cycle: cycle,
        return_url: `${window.location.origin}/onboarding/plans`,
      });
      const d = res.data?.data || res.data;
      const url = d?.payment?.checkout_url || d?.payment?.upi_intent_url;
      if (!url) throw new Error('Payment provider returned no checkout link.');
      window.location.href = url;
    } catch (err) {
      setError(err?.response?.data?.error?.message || err?.message || 'Could not start payment. Try again.');
    } finally {
      setLoadingPlanId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 p-6 text-white shadow-2xl shadow-indigo-950/20">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
          <Building2 size={24} />
        </div>
        <p className="text-xs font-black uppercase tracking-widest text-indigo-200">Choose how you want to run your hostel business</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Pick your operating plan</h1>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-indigo-100">
          Start simple, or unlock workflows that help you collect rent faster and run with fewer follow-ups.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setCycle('monthly')}
            className={`rounded-xl px-4 py-3 text-sm font-black ${cycle === 'monthly' ? 'bg-slate-950 text-white' : 'text-slate-500'}`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setCycle('yearly')}
            className={`rounded-xl px-4 py-3 text-sm font-black ${cycle === 'yearly' ? 'bg-slate-950 text-white' : 'text-slate-500'}`}
          >
            Yearly · {yearlySavings}
          </button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}

      <div className="space-y-4">
        {PLAN_COPY.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            cycle={cycle}
            selected={selectedPlan === plan.id}
            loading={loadingPlanId === plan.id}
            onSelect={handleSelect}
          />
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-600" />
          <p className="text-sm font-black text-slate-950">Compare the business workflows</p>
        </div>
        <div className="space-y-3">
          {FEATURE_ROWS.map(([label, free, standard, growth]) => (
            <div key={label} className="grid grid-cols-[1.4fr_0.7fr_0.9fr_0.8fr] items-center gap-2 text-xs">
              <span className="font-bold text-slate-600">{label}</span>
              {[free, standard, growth].map((ok, idx) => (
                <span key={idx} className="flex justify-center">
                  {ok ? <CheckCircle2 size={16} className="text-emerald-500" /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />}
                </span>
              ))}
            </div>
          ))}
          <div className="grid grid-cols-[1.4fr_0.7fr_0.9fr_0.8fr] gap-2 pt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span />
            <span className="text-center">Free</span>
            <span className="text-center">Standard</span>
            <span className="text-center">Growth</span>
          </div>
        </div>
      </div>

      <CheckoutModal
        plan={checkoutPlan}
        cycle={cycle}
        loading={loadingPlanId === checkoutPlan?.id}
        error={error}
        onClose={() => setCheckoutPlan(null)}
        onConfirm={handlePaidConfirm}
      />
    </div>
  );
}
