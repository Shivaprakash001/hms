import React from 'react';
import { TrendingUp, Loader2 } from 'lucide-react';

const PLAN_DETAILS = {
  GROWTH:   { color: 'violet', tenants: '300 tenants', tagline: '3× more capacity' },
  BUSINESS: { color: 'indigo', tenants: 'Unlimited tenants', tagline: 'No tenant caps ever' },
};

export default function UpgradeNudgeCard({ overflow, onUpgrade, upgrading }) {
  if (!overflow?.upgrade_nudge?.show) return null;

  const { recommended_plan, monthly_overflow_cost, plan_price_gap, message } = overflow.upgrade_nudge;
  const details = PLAN_DETAILS[recommended_plan] || PLAN_DETAILS.GROWTH;
  const planName = recommended_plan
    ? recommended_plan.charAt(0) + recommended_plan.slice(1).toLowerCase()
    : 'Growth';

  const isViolet = details.color === 'violet';
  const baseClass = isViolet
    ? 'bg-violet-50 border-violet-200 text-violet-900'
    : 'bg-indigo-50 border-indigo-200 text-indigo-900';
  const btnClass = isViolet
    ? 'bg-violet-600 hover:bg-violet-700 text-white'
    : 'bg-indigo-600 hover:bg-indigo-700 text-white';
  const subtleClass = isViolet ? 'text-violet-600' : 'text-indigo-600';

  return (
    <div className={`rounded-2xl border p-5 ${baseClass}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isViolet ? 'bg-violet-100' : 'bg-indigo-100'
        }`}>
          <TrendingUp size={15} className={subtleClass} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">Consider upgrading to {planName}</p>
          <p className={`text-xs mt-0.5 ${subtleClass}`}>{details.tenants} · {details.tagline}</p>
        </div>
      </div>

      {message && (
        <p className={`text-xs mt-3 leading-relaxed ${subtleClass}`}>{message}</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
        <div className={`rounded-xl py-2 px-3 ${isViolet ? 'bg-violet-100' : 'bg-indigo-100'}`}>
          <p className={`font-bold text-sm ${subtleClass}`}>
            ₹{Math.round(monthly_overflow_cost / 100).toLocaleString('en-IN')}/mo
          </p>
          <p className="text-slate-500 text-[10px] mt-0.5">Overflow cost now</p>
        </div>
        <div className={`rounded-xl py-2 px-3 ${isViolet ? 'bg-violet-100' : 'bg-indigo-100'}`}>
          <p className={`font-bold text-sm ${subtleClass}`}>
            +₹{Math.round(plan_price_gap / 100).toLocaleString('en-IN')}/mo
          </p>
          <p className="text-slate-500 text-[10px] mt-0.5">To upgrade</p>
        </div>
      </div>

      <button
        onClick={() => onUpgrade && onUpgrade(recommended_plan)}
        disabled={!!upgrading}
        className={`mt-4 w-full py-2 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${btnClass} disabled:opacity-60`}
      >
        {upgrading === recommended_plan
          ? <><Loader2 size={14} className="animate-spin" /> Processing…</>
          : <>Upgrade to {planName} <TrendingUp size={13} /></>
        }
      </button>
    </div>
  );
}
