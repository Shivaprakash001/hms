import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Plus,
  SlidersHorizontal,
  Building2,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  ChevronDown,
  CreditCard,
  UserPlus,
  IndianRupee,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '@context/AuthContext';
import { portfolioService } from '@features/dashboard/api';
import { paymentService } from '@features/payments/api';
import { queryKeys } from '@lib/queryKeys';
import { PortfolioRevenueChart } from '@/app/components/portfolio/PortfolioRevenueChart';
import { HostelPerformanceCard } from '@/app/components/portfolio/HostelPerformanceCard';
import { AddHostelModal } from '@/app/components/modals/AddHostelModal';
import { AddTenantModal } from '@/app/components/modals/AddTenantModal';
import { FilterModal, FilterOptions } from '@/app/components/modals/FilterModal';
import { EditHostelSheet } from '@/app/components/modals/EditHostelSheet';
import { RecordPaymentModal } from '@/app/components/modals/RecordPaymentModal';

const fmt = (n: number) => {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v.toLocaleString('en-IN')}`;
};

export function PortfolioView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddHostel, setShowAddHostel] = useState(false);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showTrends, setShowTrends] = useState(false);
  const [editingHostelId, setEditingHostelId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({ occupancy: [], revenue: [], alerts: [] });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.portfolio.performance(6),
    queryFn: () => portfolioService.getPerformance(6),
    staleTime: 2 * 60 * 1000,
  });

  const portfolio = data?.portfolio ?? {};
  const monthlyTrends = data?.monthly_trends ?? [];
  const rankings = data?.hostel_rankings ?? [];
  const topPerformer = rankings.find((h: { is_top_performer?: boolean }) => h.is_top_performer);
  const firstHostelId = rankings[0]?.hostel_id;

  const { data: duesData } = useQuery({
    queryKey: queryKeys.payments.dues(firstHostelId ?? ''),
    queryFn: () => paymentService.getAllDues(firstHostelId),
    enabled: Boolean(firstHostelId),
    staleTime: 60 * 1000,
  });

  const filteredRankings = rankings.filter((h: { hostel_name: string; city?: string | null }) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      h.hostel_name.toLowerCase().includes(q) ||
      String(h.city ?? '').toLowerCase().includes(q)
    );
  });

  const editingHostel = editingHostelId
    ? rankings.find((h: { hostel_id: string }) => h.hostel_id === editingHostelId)
    : null;

  const dues = Array.isArray(duesData)
    ? duesData
    : Array.isArray((duesData as Record<string, unknown> | undefined)?.dues)
      ? ((duesData as Record<string, unknown>).dues as Record<string, unknown>[])
      : [];
  const overdueRows = dues
    .filter((due) => {
      const dueDate = due.due_date ? new Date(String(due.due_date)).getTime() : 0;
      return Number(due.outstanding ?? due.amount ?? 0) > 0 && dueDate > 0 && dueDate < Date.now();
    })
    .map((due) => ({
      id: String(due.obligation_id ?? due.id),
      tenant: String(due.tenant_name ?? due.name ?? 'Tenant'),
      room: String(due.room_no ?? due.room_number ?? ''),
      amount: Number(due.outstanding ?? due.amount ?? 0),
      days: Math.max(1, Math.floor((Date.now() - new Date(String(due.due_date)).getTime()) / 86_400_000)),
    }))
    .sort((a, b) => b.amount - a.amount);
  const overdueTenantCount = new Set(overdueRows.map((row) => row.tenant)).size;
  const overdueAmount = overdueRows.reduce((sum, row) => sum + row.amount, 0) || Number(portfolio.total_due ?? 0);
  const overdueHint = overdueAmount > 0;
  const monthLabel = new Date().toLocaleString('en-IN', { month: 'long' });
  const collectionRate = Number(portfolio.collection_rate ?? 0);

  return (
    <div className="px-4 py-5 space-y-5 min-w-0 max-w-5xl mx-auto pb-24 md:pb-8">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">
            {user?.name ? `Good morning, ${user.name.split(' ')[0]}` : 'Owner home'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            What needs attention across {rankings.length} propert{rankings.length === 1 ? 'y' : 'ies'} today
          </p>
        </div>
        {overdueHint && (
          <button
            type="button"
            onClick={() => navigate('/alerts')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs font-semibold shrink-0"
          >
            <Bell className="w-3.5 h-3.5" />
            Action needed
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-72 bg-card border border-border rounded-xl animate-pulse" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">Failed to load portfolio data</p>
          <button type="button" onClick={() => refetch()} className="mt-3 text-sm text-accent font-medium">
            Retry
          </button>
        </div>
      ) : (
        <>
          {overdueHint && (
            <section className="rounded-2xl border border-destructive/25 bg-destructive/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                    {overdueTenantCount || overdueRows.length} tenant{(overdueTenantCount || overdueRows.length) === 1 ? '' : 's'} overdue
                  </p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{fmt(overdueAmount)} at risk</p>
                  <p className="text-xs text-muted-foreground">Start with the highest overdue accounts. The ledger can wait.</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/alerts')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-3 text-sm font-semibold text-destructive-foreground"
                >
                  Collect now
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Collected',
                value: fmt(Number(portfolio.total_revenue ?? 0)),
                icon: IndianRupee,
              },
              {
                label: 'Collection rate',
                value: `${collectionRate.toFixed(0)}%`,
                icon: TrendingUp,
              },
              {
                label: 'Active tenants',
                value: String(portfolio.active_tenants ?? 0),
                sub: `${Number(portfolio.occupancy_rate ?? 0).toFixed(0)}% occupancy`,
                icon: Users,
              },
            ].map(({ label, value, sub, icon: Icon, warn }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-3 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                    {label}
                  </span>
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${warn ? 'text-destructive' : 'text-accent'}`} />
                </div>
                <p className={`text-lg font-bold truncate ${warn ? 'text-destructive' : 'text-foreground'}`}>
                  {value}
                </p>
                {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
              </div>
            ))}
          </div>

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-accent/10 p-2 text-accent">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{monthLabel} collection digest</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Collected {fmt(Number(portfolio.total_revenue ?? 0))} of expected rent
                  {collectionRate > 0 ? ` (${collectionRate.toFixed(0)}%)` : ''}.
                  {' '}
                  {overdueTenantCount > 0
                    ? `${overdueTenantCount} tenant${overdueTenantCount === 1 ? '' : 's'} still outstanding.`
                    : 'No outstanding tenants in the current view.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/billing')}
                className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground"
              >
                Review
              </button>
            </div>
          </section>

          <div className="grid gap-2 sm:grid-cols-2">
            {firstHostelId && (
              <>
                <button
                  type="button"
                  onClick={() => setShowRecordPayment(true)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Record payment
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddTenant(true)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add Tenant
                </button>
              </>
            )}
          </div>

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Needs attention</h2>
                <p className="text-xs text-muted-foreground">Top overdue tenants from your active hostel</p>
              </div>
              <button type="button" onClick={() => navigate('/alerts')} className="text-xs font-semibold text-accent">
                View all
              </button>
            </div>
            {overdueRows.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700">
                No overdue rent found. You are clear for now.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {overdueRows.slice(0, 4).map((row) => (
                  <div key={row.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{row.tenant}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.days}d overdue{row.room ? ` · Room ${row.room}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-bold text-destructive">{fmt(row.amount)}</span>
                      <button
                        type="button"
                        onClick={() => navigate('/alerts')}
                        className="rounded-lg border border-amber-500/30 px-2.5 py-1.5 text-xs font-semibold text-amber-600"
                      >
                        Remind
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <button
              type="button"
              onClick={() => setShowTrends((value) => !value)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <BarChart3 className="h-4 w-4 text-accent" />
                Monthly trend
              </span>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showTrends ? 'rotate-180' : ''}`} />
            </button>
            {showTrends && (
              <div className="mt-3">
                <PortfolioRevenueChart
                  monthlyTrends={monthlyTrends}
                  topPerformerId={data?.top_performer_hostel_id}
                  topPerformerName={topPerformer?.hostel_name}
                />
              </div>
            )}
          </section>

          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search properties…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilter(true)}
              className="p-2.5 bg-card border border-border rounded-xl"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>

          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Property performance
              <span className="text-muted-foreground font-normal ml-1">(tap a property to manage rooms, tenants, billing)</span>
            </h2>
            {filteredRankings.length === 0 ? (
              <div className="text-center py-16 space-y-4 border border-dashed border-border rounded-xl">
                <Building2 className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
                <p className="text-sm text-muted-foreground">
                  {rankings.length === 0 ? 'No properties yet' : 'No matches'}
                </p>
                {rankings.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddHostel(true)}
                    className="px-5 py-2.5 bg-accent text-accent-foreground rounded-xl text-sm font-semibold"
                  >
                    Add first hostel
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRankings.map((hostel: Parameters<typeof HostelPerformanceCard>[0]['hostel'], i: number) => (
                  <HostelPerformanceCard
                    key={hostel.hostel_id}
                    hostel={hostel}
                    rank={i + 1}
                    onEdit={setEditingHostelId}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {showAddHostel && <AddHostelModal onClose={() => { setShowAddHostel(false); refetch(); }} />}
      {showAddTenant && <AddTenantModal onClose={() => { setShowAddTenant(false); refetch(); }} />}
      {showRecordPayment && firstHostelId && (
        <RecordPaymentModal hostelId={firstHostelId} onClose={() => setShowRecordPayment(false)} />
      )}
      {showFilter && (
        <FilterModal onClose={() => setShowFilter(false)} onApply={setFilters} currentFilters={filters} />
      )}
      {editingHostelId && editingHostel && (
        <EditHostelSheet
          hostelId={editingHostelId}
          hostelName={editingHostel.hostel_name}
          onClose={() => setEditingHostelId(null)}
        />
      )}
    </div>
  );
}
