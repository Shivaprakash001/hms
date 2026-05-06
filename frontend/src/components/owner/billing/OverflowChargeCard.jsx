import React from 'react';
import { Zap, Receipt } from 'lucide-react';

function fmt(paise) {
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
}

export default function OverflowChargeCard({ overflow, currentPlan }) {
  if (!overflow?.enabled || overflow.overflow_count <= 0) return null;

  const {
    overflow_count,
    overflow_amount_paise,
    included_limit,
    active_tenants,
  } = overflow;

  const planPricePaise = currentPlan?.price_inr ?? 0;
  const totalThisMonthPaise = planPricePaise + overflow_amount_paise;
  const pricePerTenantPaise = overflow_count > 0 ? Math.round(overflow_amount_paise / overflow_count) : 0;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
          <Zap size={14} className="text-orange-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-orange-900">Extra Tenant Usage</p>
          <p className="text-[11px] text-orange-600">Charged at month-end</p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-2 text-xs">
        <div className="flex justify-between text-slate-600">
          <span>Active tenants</span>
          <span className="font-semibold text-slate-900">{active_tenants}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Plan includes</span>
          <span className="font-semibold text-slate-900">{included_limit}</span>
        </div>
        <div className="flex justify-between text-orange-700 font-semibold border-t border-orange-200 pt-2">
          <span>Extra tenants billed</span>
          <span>{overflow_count} × {fmt(pricePerTenantPaise)}</span>
        </div>
        <div className="flex justify-between text-orange-800 font-bold text-sm pt-1">
          <span>Overflow charge</span>
          <span>{fmt(overflow_amount_paise)}/mo</span>
        </div>
      </div>

      {/* Total this month */}
      {planPricePaise > 0 && (
        <div className="mt-4 pt-3 border-t border-orange-200">
          <div className="flex items-center gap-1.5 text-[11px] text-orange-600 mb-2">
            <Receipt size={11} />
            Estimated invoice this month
          </div>
          <div className="space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>{currentPlan?.name} plan</span>
              <span>{fmt(planPricePaise)}</span>
            </div>
            <div className="flex justify-between text-orange-700">
              <span>Extra tenant usage</span>
              <span>{fmt(overflow_amount_paise)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 text-sm border-t border-orange-200 pt-1.5 mt-1">
              <span>Total</span>
              <span>{fmt(totalThisMonthPaise)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
