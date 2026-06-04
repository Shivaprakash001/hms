import { lazy, Suspense, useDeferredValue, useMemo, useState } from 'react';
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
  Phone,
  UserPlus,
  IndianRupee,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '@context/AuthContext';
import { portfolioService } from '@features/dashboard/api';
import { queryKeys } from '@lib/queryKeys';
import { HostelPerformanceCard } from '@/app/components/portfolio/HostelPerformanceCard';
import type { FilterOptions } from '@/app/components/modals/FilterModal';

const PortfolioRevenueChart = lazy(() => import('@/app/components/portfolio/PortfolioRevenueChart').then((m) => ({ default: m.PortfolioRevenueChart })));
const AddHostelModal = lazy(() => import('@/app/components/modals/AddHostelModal').then((m) => ({ default: m.AddHostelModal })));
const AddTenantModal = lazy(() => import('@/app/components/modals/AddTenantModal').then((m) => ({ default: m.AddTenantModal })));
const FilterModal = lazy(() => import('@/app/components/modals/FilterModal').then((m) => ({ default: m.FilterModal })));
const EditHostelSheet = lazy(() => import('@/app/components/modals/EditHostelSheet').then((m) => ({ default: m.EditHostelSheet })));
const RecordPaymentModal = lazy(() => import('@/app/components/modals/RecordPaymentModal').then((m) => ({ default: m.RecordPaymentModal })));

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
      <div className="h-[147px] rounded-2xl border border-border bg-card animate-pulse" />
      <div className="grid grid-cols-3 gap-3">
        <div className="h-[82px] rounded-xl border border-border bg-card animate-pulse" />
        <div className="h-[82px] rounded-xl border border-border bg-card animate-pulse" />
        <div className="h-[82px] rounded-xl border border-border bg-card animate-pulse" />
      </div>
      <div className="h-[90px] rounded-xl border border-border bg-card animate-pulse" />
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="h-12 rounded-xl bg-card border border-border animate-pulse" />
        <div className="h-12 rounded-xl bg-card border border-border animate-pulse" />
      </div>
      <div className="h-[214px] rounded-xl border border-border bg-card animate-pulse" />
    </div>
  );
}

export function PortfolioView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [showAddHostel, setShowAddHostel] = useState(false);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showTrends, setShowTrends] = useState(false);
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
  const firstHostelId = data?.focus_hostel_id ?? rankings[0]?.hostel_id;

  const filteredRankings = useMemo(() => rankings.filter((h: { hostel_name: string; city?: string | null }) => {
    const q = deferredSearchQuery.toLowerCase();
    if (!q) return true;
    return (
      h.hostel_name.toLowerCase().includes(q) ||
      String(h.city ?? '').toLowerCase().includes(q)
    );
  }), [rankings, deferredSearchQuery]);

  const editingHostel = editingHostelId
    ? rankings.find((h: { hostel_id: string }) => h.hostel_id === editingHostelId)
    : null;

  const overdueRows = useMemo(() => (Array.isArray(data?.overdue_preview)
    ? data.overdue_preview.map((due: Record<string, unknown>) => ({
      id: String(due.obligation_id ?? due.id),
      tenant: String(due.tenant_name ?? due.tenant ?? 'Tenant'),
      phone: String(due.tenant_phone ?? due.phone ?? due.tenantPhone ?? ''),
      room: String(due.room_no ?? due.room ?? ''),
      amount: Number(due.outstanding ?? due.amount ?? 0),
      days: Number(due.days ?? 1),
    }))
    : []), [data?.overdue_preview]);
  const overdueTenantCount = new Set(overdueRows.map((row) => row.tenant)).size;
  const overdueAmount = overdueRows.reduce((sum, row) => sum + row.amount, 0) || Number(portfolio.total_due ?? 0);
  const overdueHint = overdueAmount > 0;
  const monthLabel = new Date().toLocaleString('en-IN', { month: 'long' });
  const collectionRate = Number(portfolio.collection_rate ?? 0);

  return (
    <div className="px-4 py-5 space-y-5 min-w-0 max-w-5xl mx-auto pb-24 md:pb-8">
      <div className="flex min-h-[64px] items-start justify-between gap-2">
        <div className="min-w-0">
          <h1
            className="min-h-7 truncate text-2xl font-bold leading-7 text-foreground"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {user?.name ? `${(function() {
              const hour = new Date().getHours();
              if (hour < 12) return 'Good morning';
              if (hour < 17) return 'Good afternoon';
              if (hour < 21) return 'Good evening';
              return 'Good night';
            })()}, ${user.name.split(' ')[0]}` : 'Owner home'}
          </h1>
          <p className="mt-0.5 min-h-10 text-sm text-muted-foreground">
            What needs attention across {rankings.length} propert{rankings.length === 1 ? 'y' : 'ies'} today
          </p>
        </div>
        {overdueHint && (
          <button
            type="button"
            onClick={() => navigate('/alerts')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs font-semibold shrink-0"
          >
            <Bell className="w-3.5 h-3.5" />
            Action needed
          </button>
        )}
      </div>

      {isLoading ? (
        <PortfolioLoadingSkeleton />
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
                label: 'Collection',
                value: `${collectionRate.toFixed(0)}%`,
                icon: TrendingUp,
              },
              {
                label: 'Tenants',
                value: String(portfolio.active_tenants ?? 0),
                sub: `${Number(portfolio.occupancy_rate ?? 0).toFixed(0)}% occ.`,
                icon: Users,
              },
            ].map(({ label, value, sub, icon: Icon }) => (
              <div key={label} className="bg-card border border-border rounded-2xl p-3 min-w-0 hover:shadow-sm transition-shadow">
                <div className="w-7 h-7 rounded-xl bg-accent/10 flex items-center justify-center mb-2">
                  <Icon className="w-3.5 h-3.5 text-accent" />
                </div>
                <p className="text-lg font-bold truncate leading-tight text-foreground">
                  {value}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub ?? label}</p>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-accent/10 p-2.5 text-accent shrink-0">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">{monthLabel} digest</p>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  Collected {fmt(Number(portfolio.total_revenue ?? 0))}{collectionRate > 0 ? ` (${collectionRate.toFixed(0)}%)` : ''}.
                  {' '}
                  {overdueTenantCount > 0
                    ? `${overdueTenantCount} tenant${overdueTenantCount === 1 ? '' : 's'} still outstanding.`
                    : 'All clear — no outstanding tenants.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/billing')}
                className="shrink-0 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-semibold text-foreground hover:border-accent/40 transition-colors"
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
                  className="flex items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3.5 text-sm font-semibold text-accent-foreground active:scale-[0.98] transition-transform shadow-sm"
                >
                  <CreditCard className="w-4 h-4" />
                  Record payment
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddTenant(true)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98] transition-transform shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Add tenant
                </button>
              </>
            )}
          </div>

          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-foreground">Needs attention</h2>
                <p className="text-xs text-muted-foreground">Top overdue tenants</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/alerts')}
                className="text-xs font-semibold text-accent hover:underline"
              >
                View all
              </button>
            </div>
            {overdueRows.length === 0 ? (
              <div className="rounded-xl border border-success/20 bg-success/8 px-4 py-3 flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-success shrink-0" />
                <p className="text-sm text-success font-medium">All clear — no overdue rent.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {overdueRows.slice(0, 4).map((row) => {
                  const telHref = toTelHref(row.phone);
                  return (
                    <div key={row.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{row.tenant}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.days}d overdue{row.room ? ` · Room ${row.room}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-bold text-destructive">{fmt(row.amount)}</span>
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
                <Suspense fallback={<div className="h-56 rounded-xl bg-muted animate-pulse" />}>
                  <PortfolioRevenueChart
                    monthlyTrends={monthlyTrends}
                    topPerformerId={data?.top_performer_hostel_id}
                    topPerformerName={topPerformer?.hostel_name}
                  />
                </Suspense>
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

      {showAddHostel && (
        <Suspense fallback={null}>
          <AddHostelModal onClose={() => { setShowAddHostel(false); refetch(); }} />
        </Suspense>
      )}
      {showAddTenant && (
        <Suspense fallback={null}>
          <AddTenantModal onClose={() => { setShowAddTenant(false); refetch(); }} />
        </Suspense>
      )}
      {showRecordPayment && firstHostelId && (
        <Suspense fallback={null}>
          <RecordPaymentModal hostelId={firstHostelId} onClose={() => setShowRecordPayment(false)} />
        </Suspense>
      )}
      {showFilter && (
        <Suspense fallback={null}>
          <FilterModal onClose={() => setShowFilter(false)} onApply={setFilters} currentFilters={filters} />
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
