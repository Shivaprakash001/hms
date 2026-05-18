import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Wallet, ArrowDownToLine, ArrowUpFromLine, Clock, Building2, RefreshCw,
  TrendingUp, AlertCircle, CheckCircle2, ArrowRight,
} from 'lucide-react';
import { ownerFinanceService } from '../../api/services';
import { formatCurrency, formatDate } from '../../utils/format';
import { useAppPreferences } from '../../context/AppPreferencesContext';

// Owner-facing settlement labels — these mirror the canonical states
// emitted by mapOwnerSettlementStatus in the backend service. We never
// surface internal payout_status values (PENDING/PROCESSING/SUCCESS/FAILED)
// or batch IDs to the owner.
const STATUS_META = {
  PENDING_SETTLEMENT:    { label: 'Pending Settlement',   className: 'bg-amber-50 text-amber-700 border-amber-200',  Icon: Clock },
  TRANSFER_IN_PROGRESS:  { label: 'Transfer In Progress', className: 'bg-sky-50 text-sky-700 border-sky-200',         Icon: RefreshCw },
  SETTLED:               { label: 'Settled',              className: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  SETTLEMENT_DELAYED:    { label: 'Settlement Delayed',   className: 'bg-rose-50 text-rose-700 border-rose-200',    Icon: AlertCircle },
};

function StatusPill({ status }) {
  const meta = STATUS_META[status] || { label: status, className: 'bg-slate-100 text-slate-700 border-slate-200', Icon: Clock };
  const Icon = meta.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
      <Icon size={12} />
      {meta.label}
    </span>
  );
}

function Tile({ label, value, sub, accent, Icon, loading }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
        {Icon && (
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${accent || 'bg-slate-50 text-slate-600'}`}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <div className={`mt-3 text-2xl font-black tracking-tight ${accent && accent.includes('text-') ? '' : 'text-slate-900'}`}>
        {loading ? <span className="text-slate-300">···</span> : value}
      </div>
      {sub ? <div className="mt-1 text-xs font-medium text-slate-500">{sub}</div> : null}
    </div>
  );
}

export default function OwnerFinance() {
  const { preferences } = useAppPreferences();

  const summaryQ = useQuery({
    queryKey: ['owner-finance-summary'],
    queryFn: () => ownerFinanceService.getSummary(),
    staleTime: 60_000,
  });
  const collectionsQ = useQuery({
    queryKey: ['owner-finance-collections', { limit: 25 }],
    queryFn: () => ownerFinanceService.getCollections({ limit: 25 }),
    staleTime: 60_000,
  });
  const byHostelQ = useQuery({
    queryKey: ['owner-finance-by-hostel'],
    queryFn: () => ownerFinanceService.getByHostel(),
    staleTime: 60_000,
  });

  const summary = summaryQ.data?.summary || summaryQ.data;
  const collections = collectionsQ.data?.collections || collectionsQ.data || [];
  const hostels = byHostelQ.data?.hostels || byHostelQ.data || [];

  const inr = (amount) => formatCurrency(Number(amount || 0), preferences);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Finance</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Money tenants paid, what's pending settlement to you, and what HMS has already transferred to your bank account.
          </p>
        </div>
        <Link
          to="/dashboard/finance/transfers"
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-ops-accent/300 hover:text-ops-accent"
        >
          View transfers
          <ArrowRight size={16} />
        </Link>
      </header>

      {/* Summary tiles */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Total Collected"
          value={summary ? inr(summary.total_collected.amount) : '—'}
          sub={summary ? `${summary.total_collected.collection_count} collections lifetime` : ''}
          accent="bg-slate-100 text-slate-700"
          Icon={Wallet}
          loading={summaryQ.isLoading}
        />
        <Tile
          label="Pending Settlement"
          value={summary ? inr(summary.pending_settlement.amount) : '—'}
          sub="Awaiting transfer to you"
          accent="bg-amber-50 text-amber-700"
          Icon={Clock}
          loading={summaryQ.isLoading}
        />
        <Tile
          label="Settled Payouts"
          value={summary ? inr(summary.settled_payouts.amount) : '—'}
          sub={summary ? `${summary.settled_payouts.transfer_count} transfers lifetime` : ''}
          accent="bg-emerald-50 text-emerald-700"
          Icon={ArrowDownToLine}
          loading={summaryQ.isLoading}
        />
        <Tile
          label={`Last ${summary?.recent_transfers?.window_days ?? 30} days`}
          value={summary ? inr(summary.recent_transfers.amount) : '—'}
          sub={summary ? `${summary.recent_transfers.transfer_count} recent transfers` : ''}
          accent="bg-sky-50 text-sky-700"
          Icon={TrendingUp}
          loading={summaryQ.isLoading}
        />
      </section>

      {/* By-hostel breakdown — only render when owner has multiple hostels with activity */}
      {hostels.length > 1 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Building2 size={18} className="text-slate-500" />
            <h2 className="text-base font-black text-slate-900">By Hostel</h2>
          </div>
          <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/60 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Hostel</th>
                    <th className="px-5 py-3 text-right">Collected</th>
                    <th className="px-5 py-3 text-right">Settled</th>
                    <th className="px-5 py-3 text-right">Pending</th>
                    <th className="px-5 py-3 text-right">In Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {byHostelQ.isLoading && (
                    <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-400">Loading…</td></tr>
                  )}
                  {!byHostelQ.isLoading && hostels.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-6 text-center text-slate-400">No financial activity yet.</td></tr>
                  )}
                  {hostels.map((h) => (
                    <tr key={h.hostel_id} className="transition hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-mono text-xs text-slate-600">{h.hostel_id.slice(0, 8)}…</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-700">{inr(h.lifetime_collected)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-emerald-700">{inr(h.lifetime_settled)}</td>
                      <td className="px-5 py-3 text-right font-bold text-amber-700">{inr(h.pending)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-sky-700">{h.in_progress_credit_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Recent collections */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <ArrowUpFromLine size={18} className="text-slate-500" />
          <h2 className="text-base font-black text-slate-900">Recent Collections</h2>
        </div>
        <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/60 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Collected At</th>
                  <th className="px-5 py-3">Hostel</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Settlement Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {collectionsQ.isLoading && (
                  <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-400">Loading…</td></tr>
                )}
                {!collectionsQ.isLoading && collections.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-400">No collections yet.</td></tr>
                )}
                {collections.map((c) => (
                  <tr key={c.id} className="transition hover:bg-slate-50/50">
                    <td className="px-5 py-3 text-slate-700">
                      {formatDate(c.collected_at, preferences, '') || new Date(c.collected_at).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600">{c.hostel_id?.slice(0, 8)}…</td>
                    <td className="px-5 py-3 text-right font-bold text-slate-900">{inr(c.amount)}</td>
                    <td className="px-5 py-3"><StatusPill status={c.settlement_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
