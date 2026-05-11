import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, TrendingUp, AlertCircle,
  ArrowRight, RefreshCw, Percent, IndianRupee,
} from 'lucide-react';
import { portfolioService } from '../../api/services';
import { queryKeys } from '../../lib/query/queryKeys';
import { toHostelPath } from '../../context/HostelContext';

function StatCard({ icon: Icon, label, value, sub, accent = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${colors[accent]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function HostelCard({ hostel }) {
  const navigate = useNavigate();
  const occupancyColor =
    hostel.occupancy_rate >= 80 ? 'text-emerald-600' :
    hostel.occupancy_rate >= 50 ? 'text-amber-600' : 'text-rose-600';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Building2 size={18} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 leading-tight">{hostel.name}</h3>
            {hostel.city && <p className="text-xs text-slate-400">{hostel.city}</p>}
          </div>
        </div>
        <button
          onClick={() => navigate(toHostelPath(hostel.hostel_id, '/owner/dashboard'))}
          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          Manage <ArrowRight size={12} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs text-slate-400 font-medium">Occupancy</p>
          <p className={`text-lg font-bold ${occupancyColor}`}>
            {hostel.occupancy_rate.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-400">{hostel.active_tenants} / {hostel.total_capacity} beds</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs text-slate-400 font-medium">Collection Rate</p>
          <p className="text-lg font-bold text-slate-900">{hostel.collection_rate.toFixed(1)}%</p>
          <p className="text-xs text-slate-400">this month</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs text-slate-400 font-medium">Collected</p>
          <p className="text-lg font-bold text-emerald-600">
            ₹{(hostel.collected_revenue / 1000).toFixed(1)}K
          </p>
        </div>
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs text-slate-400 font-medium">Pending</p>
          <p className={`text-lg font-bold ${hostel.pending_dues > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
            {hostel.pending_dues > 0 ? `₹${(hostel.pending_dues / 1000).toFixed(1)}K` : '—'}
          </p>
          {hostel.overdue_count > 0 && (
            <p className="text-xs text-rose-500">{hostel.overdue_count} overdue</p>
          )}
        </div>
      </div>

      {hostel.is_stale && (
        <p className="mt-3 text-xs text-amber-600 flex items-center gap-1">
          <RefreshCw size={11} /> Snapshot may be up to 30 hours old
        </p>
      )}
    </div>
  );
}

export default function Portfolio() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: queryKeys.portfolio.summary(),
    queryFn: portfolioService.getSummary,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const agg = data?.aggregate;
  const hostels = data?.hostels ?? [];

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-8 w-48 bg-slate-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 flex items-center gap-3 text-rose-700">
          <AlertCircle size={20} />
          <p className="text-sm font-medium">Failed to load portfolio. Please refresh.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Portfolio</h1>
          <p className="mt-1 text-sm text-slate-500">
            {hostels.length} hostel{hostels.length !== 1 ? 's' : ''} · aggregated from hostel snapshots
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {agg && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Active Tenants"
            value={agg.active_tenants}
            sub={`${agg.vacant_beds} vacant beds`}
            accent="indigo"
          />
          <StatCard
            icon={Percent}
            label="Occupancy"
            value={`${agg.occupancy_rate.toFixed(1)}%`}
            sub={`${agg.total_capacity} total capacity`}
            accent="emerald"
          />
          <StatCard
            icon={IndianRupee}
            label="Collected"
            value={`₹${(agg.rent_collected_this_month / 1000).toFixed(1)}K`}
            sub={`${agg.collection_rate.toFixed(1)}% rate`}
            accent="emerald"
          />
          <StatCard
            icon={TrendingUp}
            label="Pending Dues"
            value={`₹${(agg.pending_dues / 1000).toFixed(1)}K`}
            sub={`${agg.overdue_count} overdue obligations`}
            accent={agg.overdue_count > 0 ? 'rose' : 'amber'}
          />
        </div>
      )}

      {hostels.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center">
          <Building2 size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">No active hostels in your portfolio.</p>
        </div>
      ) : (
        <div>
          <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Hostels</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hostels.map((hostel) => (
              <HostelCard key={hostel.hostel_id} hostel={hostel} />
            ))}
          </div>
        </div>
      )}

      {data?.computed_at && (
        <p className="text-center text-xs text-slate-300">
          Computed at {new Date(data.computed_at).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
