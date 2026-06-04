import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  SlidersHorizontal,
  Building2,
  ArrowRight,
  BarChart3,
  CheckCircle,
  IndianRupee,
  TrendingUp,
  Users,
  Phone,
  Bell,
} from 'lucide-react';
import { useAuth } from '@context/AuthContext';
import { portfolioService } from '@features/dashboard/api';
import { queryKeys } from '@lib/queryKeys';
import { HostelPerformanceCard } from '@/app/components/portfolio/HostelPerformanceCard';
import type { FilterOptions } from '@/app/components/modals/FilterModal';

const PortfolioRevenueChart = lazy(() =>
  import('@/app/components/portfolio/PortfolioRevenueChart').then((m) => ({
    default: m.PortfolioRevenueChart,
  }))
);
const AddHostelModal = lazy(() =>
  import('@/app/components/modals/AddHostelModal').then((m) => ({ default: m.AddHostelModal }))
);
const FilterModal = lazy(() =>
  import('@/app/components/modals/FilterModal').then((m) => ({ default: m.FilterModal }))
);
const EditHostelSheet = lazy(() =>
  import('@/app/components/modals/EditHostelSheet').then((m) => ({ default: m.EditHostelSheet }))
);

const fmt = (n: number) => {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v.toLocaleString('en-IN')}`;
};

const toTelHref = (phone: unknown) => {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
};

function PortfolioLoadingSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="h-[110px] rounded-2xl border border-border bg-card animate-pulse" />
      <div className="grid grid-cols-3 gap-3">
        <div className="h-[82px] rounded-xl border border-border bg-card animate-pulse" />
        <div className="h-[82px] rounded-xl border border-border bg-card animate-pulse" />
        <div className="h-[82px] rounded-xl border border-border bg-card animate-pulse" />
      </div>
      <div className="h-10 rounded-xl border border-border bg-card animate-pulse" />
      <div className="h-[214px] rounded-xl border border-border bg-card animate-pulse" />
    </div>
  );
}

export function PortfolioView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddHostel, setShowAddHostel] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [editingHostelId, setEditingHostelId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({ occupancy: [], revenue: [], alerts: [] });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.portfolio.shell(6),
    queryFn: () => portfolioService.getShell(6),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const portfolio = data?.portfolio ?? {};
  const monthlyTrends = data?.monthly_trends ?? [];
  const rankings = data?.hostel_rankings ?? [];
  const topPerformer = rankings.find((h: { is_top_performer?: boolean }) => h.is_top_performer);

  const filteredRankings = useMemo(
    () =>
      rankings.filter((h: { hostel_name: string; city?: string | null }) => {
        const q = searchQuery.toLowerCase();
        if (!q) return true;
        return (
          h.hostel_name.toLowerCase().includes(q) ||
          String(h.city ?? '').toLowerCase().includes(q)
        );
      }),
    [rankings, searchQuery]
  );

  const editingHostel = editingHostelId
    ? rankings.find((h: { hostel_id: string }) => h.hostel_id === editingHostelId)
    : null;

  const overdueRows = useMemo(
    () =>
      Array.isArray(data?.overdue_preview)
        ? data.overdue_preview.map((due: Record<string, unknown>) => ({
            id: String(due.obligation_id ?? due.id),
            tenant: String(due.tenant_name ?? due.tenant ?? 'Tenant'),
            phone: String(due.tenant_phone ?? due.phone ?? ''),
            room: String(due.room_no ?? due.room ?? ''),
            amount: Number(due.outstanding ?? due.amount ?? 0),
            days: Number(due.days ?? 1),
          }))
        : [],
    [data?.overdue_preview]
  );

  // ─── Priority signals (correctly separated) ───────────────────────────────
  // isOverdue: real past-due obligations from overdue_preview
  // isDueSoon: future-due rent exists but nothing is actually overdue yet
  // isVacant:  beds sitting empty (only when finances are clean)
  const overdueAmount = overdueRows.reduce((s, r) => s + r.amount, 0);
  const overdueTenantCount = new Set(overdueRows.map((r) => r.tenant)).size;
  const isOverdue = overdueRows.length > 0;

  const totalDue = Number(portfolio.total_due ?? 0);
  const isDueSoon = !isOverdue && totalDue > 0;

  const vacantBeds = Number(portfolio.vacant_beds ?? 0);
  const totalCapacity = Number(portfolio.total_capacity ?? 0);
  const activeTenants = Number(portfolio.active_tenants ?? 0);
  const isVacant = !isOverdue && !isDueSoon && vacantBeds > 0;

  const collectionRate = Number(portfolio.collection_rate ?? 0);
  const totalRevenue = Number(portfolio.total_revenue ?? 0);
  const occupancyRate = Number(portfolio.occupancy_rate ?? 0);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Good night';
  })();

  const monthLabel = new Date().toLocaleString('en-IN', { month: 'long' });

  return (
    <div className="px-4 py-5 space-y-5 min-w-0 max-w-5xl mx-auto pb-24 md:pb-8">
      {/* ── Header ── */}
      <div>
        <h1
          className="truncate text-2xl font-bold leading-7 text-foreground"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {user?.name ? `${greeting}, ${user.name.split(' ')[0]}` : 'Owner home'}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {rankings.length} propert{rankings.length === 1 ? 'y' : 'ies'} · {monthLabel} snapshot
        </p>
      </div>

      {isLoading ? (
        <PortfolioLoadingSkeleton />
      ) : isError ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">Failed to load portfolio data</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 text-sm text-accent font-medium"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* ── PHASE 1: Priority Card — ONE state at a time ── */}
          {isOverdue && (
            <section
              className="rounded-2xl border border-destructive/25 bg-destructive/10 p-4"
              aria-label="Overdue rent alert"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                    {overdueTenantCount} tenant{overdueTenantCount === 1 ? '' : 's'} overdue
                  </p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {fmt(overdueAmount)} overdue
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Collect from highest accounts first.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/alerts')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-3 text-sm font-semibold text-destructive-foreground active:scale-[0.98]"
                >
                  Collect rent
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {isDueSoon && (
            <section
              className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/30 dark:bg-amber-900/20"
              aria-label="Rent due this month"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                    Rent due · {monthLabel}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{fmt(totalDue)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {collectionRate > 0
                      ? `${collectionRate.toFixed(0)}% collected so far.`
                      : 'No collections recorded yet.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/billing')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-semibold text-amber-800 active:scale-[0.98] dark:bg-amber-800 dark:border-amber-700 dark:text-amber-200"
                >
                  Review collections
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {isVacant && (
            <section
              className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/30 dark:bg-blue-900/20"
              aria-label="Vacant beds"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">
                    Vacant beds
                  </p>
                  <p className="mt-1 text-2xl font-bold text-foreground">
                    {vacantBeds} bed{vacantBeds === 1 ? '' : 's'} open
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeTenants}/{totalCapacity} occupied — fill to increase revenue.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/tenants')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm font-semibold text-blue-800 active:scale-[0.98] dark:bg-blue-800 dark:border-blue-700 dark:text-blue-200"
                >
                  Add tenant
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {/* ── PHASE 2: KPI Grid — hostel-focused labels ── */}
          <div className="grid grid-cols-3 gap-3" aria-label="Key metrics">
            {/* Occupancy */}
            <div className="bg-card border border-border rounded-2xl p-3 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-accent/10 flex items-center justify-center mb-2">
                <Users className="w-3.5 h-3.5 text-accent" />
              </div>
              <p className="text-lg font-bold truncate leading-tight text-foreground">
                {totalCapacity > 0 ? `${activeTenants}/${totalCapacity}` : `${activeTenants}`}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {vacantBeds > 0 ? `${vacantBeds} vacant` : 'Beds filled'}
              </p>
            </div>

            {/* Outstanding Rent */}
            <div className="bg-card border border-border rounded-2xl p-3 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-destructive/10 flex items-center justify-center mb-2">
                <IndianRupee className="w-3.5 h-3.5 text-destructive" />
              </div>
              <p className="text-lg font-bold truncate leading-tight text-foreground">
                {fmt(totalDue)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Outstanding</p>
            </div>

            {/* Collections */}
            <div className="bg-card border border-border rounded-2xl p-3 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-accent/10 flex items-center justify-center mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-accent" />
              </div>
              <p className="text-lg font-bold truncate leading-tight text-foreground">
                {fmt(totalRevenue)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {collectionRate > 0 ? `${collectionRate.toFixed(0)}% collected` : 'Collected'}
              </p>
            </div>
          </div>

          {/* ── PHASE 3: Needs Attention — collapses when empty ── */}
          {overdueRows.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-success/20 bg-success/8 px-4 py-3">
              <CheckCircle className="w-4 h-4 text-success shrink-0" />
              <p className="text-sm text-success font-medium">
                No urgent items — all tenants current
              </p>
            </div>
          ) : (
            <section className="rounded-2xl border border-border bg-card p-4" aria-label="Needs attention">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-foreground">Needs attention</h2>
                  <p className="text-xs text-muted-foreground">Highest overdue first</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/alerts')}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  View all
                </button>
              </div>
              <div className="divide-y divide-border">
                {overdueRows.slice(0, 4).map((row) => {
                  const telHref = toTelHref(row.phone);
                  return (
                    <div key={row.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {row.tenant}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.days}d overdue{row.room ? ` · Room ${row.room}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-bold text-destructive">
                          {fmt(row.amount)}
                        </span>
                        {telHref && (
                          <a
                            href={telHref}
                            aria-label={`Call ${row.tenant}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => navigate('/alerts')}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-xs font-semibold text-amber-700"
                        >
                          <Bell className="h-3.5 w-3.5" />
                          Remind
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── PHASE 4: Monthly Trend — always visible ── */}
          <section className="rounded-xl border border-border bg-card p-4" aria-label="Monthly trend">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold text-foreground">Monthly trend</h2>
            </div>
            <Suspense fallback={<div className="h-52 rounded-xl bg-muted animate-pulse" />}>
              <PortfolioRevenueChart
                monthlyTrends={monthlyTrends}
                topPerformerId={data?.top_performer_hostel_id}
                topPerformerName={topPerformer?.hostel_name}
              />
            </Suspense>
          </section>

          {/* ── Search + Filter ── */}
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
              aria-label="Filter properties"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>

          {/* ── PHASE 5: Properties ── */}
          <section aria-label="Properties">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground">Properties</h2>
              <span className="text-xs text-muted-foreground">Tap to manage</span>
            </div>
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
                {filteredRankings.map(
                  (hostel: Parameters<typeof HostelPerformanceCard>[0]['hostel'], i: number) => (
                    <HostelPerformanceCard
                      key={hostel.hostel_id}
                      hostel={hostel}
                      rank={i + 1}
                      onEdit={setEditingHostelId}
                    />
                  )
                )}
              </div>
            )}
          </section>
        </>
      )}

      {showAddHostel && (
        <Suspense fallback={null}>
          <AddHostelModal onClose={() => { setShowAddHostel(false); refetch(); }} />
        </Suspense>
      )}
      {showFilter && (
        <Suspense fallback={null}>
          <FilterModal
            onClose={() => setShowFilter(false)}
            onApply={setFilters}
            currentFilters={filters}
          />
        </Suspense>
      )}
      {editingHostelId && editingHostel && (
        <Suspense fallback={null}>
          <EditHostelSheet
            hostelId={editingHostelId}
            hostelName={editingHostel.hostel_name}
            onClose={() => setEditingHostelId(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
