import React from 'react';
import { Users, AlertTriangle, TrendingUp } from 'lucide-react';

const THRESHOLD_CONFIG = {
  SAFE:       { bar: 'bg-indigo-500',  label: null,                                             banner: null },
  WARNING_80: { bar: 'bg-amber-400',   label: 'Nearing capacity',                               banner: 'warning' },
  OVERFLOW:   { bar: 'bg-orange-500',  label: 'Extra tenant usage charges apply',               banner: 'overflow' },
  NEAR_CAP:   { bar: 'bg-rose-500',    label: 'Near hard cap — upgrade for smoother scaling',   banner: 'near_cap' },
  AT_CAP:     { bar: 'bg-rose-600',    label: 'Hard cap reached — upgrade required',            banner: 'at_cap' },
};

export default function OverflowUsageMeter({ overflow }) {
  if (!overflow || !overflow.enabled) return null;

  const {
    active_tenants,
    included_limit,
    overflow_count,
    hard_cap,
    percentage_of_included,
    percentage_of_hard_cap,
    threshold,
    overflow_amount_paise,
  } = overflow;

  const cfg = THRESHOLD_CONFIG[threshold] || THRESHOLD_CONFIG.SAFE;
  const pricePerTenant = overflow_amount_paise > 0 && overflow_count > 0
    ? Math.round(overflow_amount_paise / overflow_count / 100)
    : 0;

  // Bar uses hard_cap as denominator for full visual; included limit marked as notch
  const pctFull = hard_cap > 0 ? Math.min(100, Math.round((active_tenants / hard_cap) * 100)) : 0;
  const includedNotchPct = hard_cap > 0 ? Math.round((included_limit / hard_cap) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Users size={14} className="text-slate-400" />
          Tenants
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-800">{active_tenants}</span>
          <span>/ {included_limit} included</span>
          {overflow_count > 0 && (
            <span className="text-orange-600 font-semibold">(+{overflow_count} overflow)</span>
          )}
        </div>
      </div>

      {/* Segmented bar */}
      <div className="relative h-2.5 rounded-full bg-slate-100 overflow-visible">
        {/* Filled portion */}
        <div
          className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
          style={{ width: `${pctFull}%` }}
        />
        {/* Included limit notch */}
        {hard_cap > included_limit && (
          <div
            className="absolute top-0 h-full w-px bg-slate-400 opacity-60"
            style={{ left: `${includedNotchPct}%` }}
          />
        )}
      </div>

      {/* Scale labels */}
      <div className="flex justify-between text-[10px] text-slate-400">
        <span>0</span>
        {hard_cap > included_limit && (
          <span className="relative" style={{ left: `${includedNotchPct - 50}%` }}>
            {included_limit} <span className="text-slate-300">incl.</span>
          </span>
        )}
        <span className="font-medium text-slate-500">{hard_cap} cap</span>
      </div>

      {/* Threshold label */}
      {cfg.label && (
        <div className={`flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 ${
          threshold === 'AT_CAP'   ? 'bg-rose-50 text-rose-700 border border-rose-100' :
          threshold === 'NEAR_CAP' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
          threshold === 'OVERFLOW' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                                     'bg-amber-50 text-amber-700 border border-amber-100'
        }`}>
          <AlertTriangle size={12} className="flex-shrink-0" />
          {cfg.label}
          {overflow_count > 0 && pricePerTenant > 0 && threshold === 'OVERFLOW' && (
            <span className="ml-auto font-semibold">+₹{pricePerTenant}/tenant/mo</span>
          )}
        </div>
      )}
    </div>
  );
}
