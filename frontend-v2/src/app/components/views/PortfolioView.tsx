import { lazy, Suspense, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, SlidersHorizontal, Building2, ArrowRight,
  IndianRupee, TrendingUp, Users,
  LogOut, UserCheck, Settings, X, ChevronRight, Activity, Plus,
  Banknote,
} from 'lucide-react';
import { useAuth } from '@context/AuthContext';
import { portfolioService } from '@features/dashboard/api';
import { agreementService } from '@features/agreements/api';
import { ownerService } from '@features/owners/api';
import { queryKeys } from '@lib/queryKeys';
import { HostelPerformanceCard } from '@/app/components/portfolio/HostelPerformanceCard';
import { UniversalSearchBar } from '@/app/components/portfolio/UniversalSearchBar';
import { HostelFilterChips, computeFilterCounts, applyHostelFilter, type HostelFilter } from '@/app/components/hostel/HostelFilterChips';
import type { FilterOptions } from '@/app/components/modals/FilterModal';
import { toast } from 'sonner';

const AddHostelModal = lazy(() =>
  import('@/app/components/modals/AddHostelModal').then((m) => ({ default: m.AddHostelModal }))
);
const FilterModal = lazy(() =>
  import('@/app/components/modals/FilterModal').then((m) => ({ default: m.FilterModal }))
);
const EditHostelSheet = lazy(() =>
  import('@/app/components/modals/EditHostelSheet').then((m) => ({ default: m.EditHostelSheet }))
);
const CloseHostelModal = lazy(() =>
  import('@/app/components/modals/CloseHostelModal').then((m) => ({ default: m.CloseHostelModal }))
);
const PauseHostelModal = lazy(() =>
  import('@/app/components/modals/PauseHostelModal').then((m) => ({ default: m.PauseHostelModal }))
);
const RestoreHostelModal = lazy(() =>
  import('@/app/components/modals/RestoreHostelModal').then((m) => ({ default: m.RestoreHostelModal }))
);
const SettingsView = lazy(() =>
  import('@/app/components/views/SettingsView').then((m) => ({ default: m.SettingsView }))
);

const fmt = (n: number) => {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  return `₹${v.toLocaleString('en-IN')}`;
};

function Skeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="h-[110px] rounded-2xl border border-border bg-card animate-pulse" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-[82px] rounded-xl border border-border bg-card animate-pulse" />)}
      </div>
      <div className="h-32 rounded-xl border border-border bg-card animate-pulse" />
      <div className="h-[214px] rounded-xl border border-border bg-card animate-pulse" />
    </div>
  );
}

export function PortfolioView() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddHostel, setShowAddHostel] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [editingHostelId, setEditingHostelId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({ occupancy: [], revenue: [], alerts: [] });
  const [showSettings, setShowSettings] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [hostelFilter, setHostelFilter] = useState<HostelFilter>('all');
  const [selectedCollectionMonthKey, setSelectedCollectionMonthKey] = useState<string | null>(null);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);

  // Lifecycle modal state
  type HostelImpact = { id: string; name: string; activeTenants?: number; occupiedBeds?: number; pendingDues?: number };
  const [closingHostel, setClosingHostel] = useState<HostelImpact | null>(null);
  const [pausingHostel, setPausingHostel] = useState<HostelImpact | null>(null);
  const [restoringHostel, setRestoringHostel] = useState<{ id: string; name: string; archived_at?: string | null; archive_reason?: string | null } | null>(null);

  const userInitials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.portfolio.shell(6),
    queryFn: () => portfolioService.getShell(6),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: renewalQueue } = useQuery({
    queryKey: ['agreements', 'renewal-queue', 'portfolio', 'all'],
    queryFn: () => agreementService.getRenewalQueue({ filter: 'all' }),
    staleTime: 60_000,
  });

  const portfolio = data?.portfolio ?? {};
  const monthlyTrends = data?.monthly_trends ?? [];
  const rankings = data?.hostel_rankings ?? [];

  // Find currently selected trend month or default to the latest (current) month
  const activeTrend = useMemo(() => {
    if (!monthlyTrends || monthlyTrends.length === 0) return null;
    if (selectedCollectionMonthKey) {
      return monthlyTrends.find((t: any) => t.month_key === selectedCollectionMonthKey) || monthlyTrends[monthlyTrends.length - 1];
    }
    return monthlyTrends[monthlyTrends.length - 1];
  }, [monthlyTrends, selectedCollectionMonthKey]);

  // Resolve rankings for the selected month to ensure consistency across the whole dashboard
  const resolvedRankings = useMemo(() => {
    if (!activeTrend || !activeTrend.hostels) return rankings;
    return rankings.map((h: any) => {
      const trendHostel = activeTrend.hostels.find((th: any) => th.hostel_id === h.hostel_id);
      if (trendHostel) {
        return {
          ...h,
          revenue: trendHostel.revenue,
          pending_dues: trendHostel.pending_dues ?? 0,
        };
      }
      return h;
    });
  }, [rankings, activeTrend]);

  const filteredRankings = useMemo(
    () => {
      const statusFiltered = applyHostelFilter(resolvedRankings, hostelFilter);
      return statusFiltered.filter((h: { hostel_name: string; city?: string | null }) => {
        const q = searchQuery.toLowerCase();
        if (!q) return true;
        return h.hostel_name.toLowerCase().includes(q) || String(h.city ?? '').toLowerCase().includes(q);
      });
    },
    [resolvedRankings, searchQuery, hostelFilter]
  );

  const filterCounts = useMemo(() => computeFilterCounts(resolvedRankings), [resolvedRankings]);

  const editingHostel = editingHostelId
    ? resolvedRankings.find((h: { hostel_id: string }) => h.hostel_id === editingHostelId)
    : null;

  const overdueRows = useMemo(
    () => Array.isArray(data?.overdue_preview)
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

  // ─── Operational signals ───────────────────────────────────────────────────
  const overdueAmount = overdueRows.reduce((s, r) => s + r.amount, 0);
  const overdueTenantCount = new Set(overdueRows.map((r) => r.tenant)).size;
  const isOverdue = overdueRows.length > 0;

  const totalDue = activeTrend ? Number(activeTrend.total_due ?? 0) : Number(portfolio.total_due ?? 0);
  const totalRevenue = activeTrend ? Number(activeTrend.total_revenue ?? 0) : Number(portfolio.total_revenue ?? 0);
  const collectionRate = useMemo(() => {
    if (activeTrend) {
      const expected = (activeTrend.total_revenue ?? 0) + (activeTrend.total_due ?? 0);
      return expected > 0 ? (activeTrend.total_revenue / expected) * 100 : 0;
    }
    return Number(portfolio.collection_rate ?? 0);
  }, [activeTrend, portfolio.collection_rate]);
  const activeTenants = Number(portfolio.active_tenants ?? 0);
  const occupiedBeds = Number(portfolio.occupied_beds ?? activeTenants);
  const totalCapacity = Number(portfolio.total_capacity ?? 0);
  const vacantBeds = Number(portfolio.vacant_beds ?? 0);
  const moveOutOpen = Number(portfolio.move_out_open ?? 0);
  const pendingInvites = Number(portfolio.pending_invites ?? 0);
  const renewalCounts = renewalQueue?.counts || {};

  // Priority card: Overdue → Move-Out → Vacancies → Pending Activations → Due Soon
  const priorityState = isOverdue ? 'overdue'
    : moveOutOpen > 0 ? 'moveout'
    : vacantBeds > 0 ? 'vacant'
    : pendingInvites > 0 ? 'activation'
    : totalDue > 0 ? 'duesoon'
    : 'clear';

  // Avg revenue per bed for vacancy loss estimate
  const avgBedRevenue = occupiedBeds > 0 ? totalRevenue / occupiedBeds : 0;
  const vacancyLoss = Math.round(avgBedRevenue * vacantBeds);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Good night';
  })();
  const monthLabel = new Date().toLocaleString('en-IN', { month: 'long' });

  // ─── Lifecycle action handlers ─────────────────────────────────────
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.shell(6) });
  }, [queryClient]);

  const handleCloseHostel = useCallback(async (hostelId: string, reason: string) => {
    await ownerService.updateHostel({ status: 'ARCHIVED', archive_reason: reason }, hostelId);
    toast.success(`"${closingHostel?.name}" has been closed`);
    setClosingHostel(null);
    invalidateAll();
  }, [closingHostel, invalidateAll]);

  const handlePauseHostel = useCallback(async (hostelId: string) => {
    await ownerService.updateHostel({ status: 'INACTIVE' }, hostelId);
    toast.success(`"${pausingHostel?.name}" has been temporarily closed`);
    setPausingHostel(null);
    invalidateAll();
  }, [pausingHostel, invalidateAll]);

  const handleResumeHostel = useCallback(async (hostelId: string, hostelName: string) => {
    await ownerService.updateHostel({ status: 'ACTIVE' }, hostelId);
    toast.success(`"${hostelName}" is now running`);
    invalidateAll();
  }, [invalidateAll]);

  const handleRestoreHostel = useCallback(async (hostelId: string, targetStatus: 'ACTIVE' | 'INACTIVE') => {
    await ownerService.updateHostel({ status: targetStatus }, hostelId);
    toast.success(`"${restoringHostel?.name}" has been restored`);
    setRestoringHostel(null);
    invalidateAll();
  }, [restoringHostel, invalidateAll]);

  return (
    <div className="px-4 py-5 space-y-5 min-w-0 max-w-5xl mx-auto pb-24 md:pb-8">

      {/* Header — avatar on right, greeting on left */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold leading-7 text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
            {user?.name ? `${greeting}, ${user.name.split(' ')[0]}` : 'Owner home'}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {rankings.length} hostel{rankings.length === 1 ? '' : 's'} · {monthLabel} snapshot
          </p>
        </div>
        {/* Avatar button — opens Settings on mobile */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowAvatarMenu((v) => !v)}
            className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-sm font-bold text-accent-foreground shadow-sm active:scale-95 transition-transform md:hidden"
            aria-label="Open settings"
          >
            {userInitials}
          </button>
          {/* Mobile avatar dropdown */}
          {showAvatarMenu && (
            <div className="absolute right-0 top-12 z-50 w-52 rounded-2xl border border-border bg-card shadow-xl p-2 md:hidden" onClick={() => setShowAvatarMenu(false)}>
              <div className="px-3 py-2 border-b border-border mb-1">
                <p className="text-sm font-semibold text-foreground truncate">{user?.name || 'Owner'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
              </div>
              <button type="button" onClick={() => { setShowAvatarMenu(false); setShowSettings(true); }} className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-secondary">
                <Settings className="w-4 h-4 text-muted-foreground" /> Settings
              </button>
              <button type="button" onClick={() => { setShowAvatarMenu(false); navigate('/activity'); }} className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-secondary">
                <Activity className="w-4 h-4 text-muted-foreground" /> System Logs
              </button>
              <button type="button" onClick={logout} className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10">
                <LogOut className="w-4 h-4" /> Log out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Universal search — tenant/room/phone across ALL hostels, results shown inline (no navigation until a result is picked) */}
      <UniversalSearchBar />

      {isLoading ? <Skeleton /> : isError ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">Failed to load portfolio data</p>
          <button type="button" onClick={() => refetch()} className="mt-3 text-sm text-accent font-medium">Retry</button>
        </div>
      ) : (
        <>
          {/* Priority Card — ONE state, priority order */}
          {priorityState === 'overdue' && (
            <section className="rounded-2xl border border-destructive/25 bg-destructive/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                    {overdueTenantCount} tenant{overdueTenantCount === 1 ? '' : 's'} overdue
                  </p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{fmt(overdueAmount)} overdue</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Collect from highest accounts first.</p>
                </div>
                <button type="button" onClick={() => navigate('/alerts')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-3 text-sm font-semibold text-destructive-foreground active:scale-[0.98]">
                  Collect rent <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {Number(renewalCounts.total || 0) > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-card p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Agreement renewals</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{Number(renewalCounts.total || 0)} need review</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Number(renewalCounts.expiring || 0)} expiring · {Number(renewalCounts.expired || 0)} expired · {Number(renewalCounts.overdue || 0)} overdue · {Number(renewalCounts.move_out || 0)} move-out conflicts
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/agreements/renewals')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground active:scale-[0.98]"
                >
                  Open queue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {priorityState === 'moveout' && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/30 dark:bg-amber-900/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Move-out requests</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{moveOutOpen} pending</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Resolve inspection and bed replacement plan.</p>
                </div>
                <button type="button" onClick={() => navigate('/move-outs')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-semibold text-amber-800 active:scale-[0.98] dark:bg-amber-800 dark:text-amber-200">
                  Review requests <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {priorityState === 'vacant' && (
            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/30 dark:bg-blue-900/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">Vacant beds</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{vacantBeds} bed{vacantBeds === 1 ? '' : 's'} open</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {occupiedBeds}/{totalCapacity} occupied
                    {vacancyLoss > 0 ? ` · ${fmt(vacancyLoss)}/mo potential revenue` : ''}
                  </p>
                </div>
                <button type="button" onClick={() => navigate('/tenants')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm font-semibold text-blue-800 active:scale-[0.98] dark:bg-blue-800 dark:text-blue-200">
                  Add tenant <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {priorityState === 'activation' && (
            <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800/30 dark:bg-indigo-900/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-400">Activation pending</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{pendingInvites} invited</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Tenants invited but haven't activated yet.</p>
                </div>
                <button type="button" onClick={() => navigate('/tenants')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-300 bg-white px-4 py-3 text-sm font-semibold text-indigo-800 active:scale-[0.98] dark:bg-indigo-800 dark:text-indigo-200">
                  Follow up <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {priorityState === 'duesoon' && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/30 dark:bg-amber-900/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Rent due · {monthLabel}</p>
                  <p className="mt-1 text-2xl font-bold text-foreground">{fmt(totalDue)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {collectionRate > 0 ? `${collectionRate.toFixed(0)}% collected so far.` : 'No collections recorded yet.'}
                  </p>
                </div>
                <button type="button" onClick={() => navigate('/billing')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm font-semibold text-amber-800 active:scale-[0.98] dark:bg-amber-800 dark:text-amber-200">
                  Review collections <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          {/* KPI Grid */}
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Snapshot</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-2xl p-3 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-accent/10 flex items-center justify-center mb-2">
                <Users className="w-3.5 h-3.5 text-accent" />
              </div>
              <p className="text-lg font-bold truncate leading-tight text-foreground">
                {totalCapacity > 0 ? `${occupiedBeds}/${totalCapacity}` : `${occupiedBeds}`}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {vacantBeds > 0 ? `${vacantBeds} vacant` : 'Beds filled'}
              </p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-3 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-destructive/10 flex items-center justify-center mb-2">
                <IndianRupee className="w-3.5 h-3.5 text-destructive" />
              </div>
              <p className="text-lg font-bold truncate leading-tight text-foreground">{fmt(totalDue)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Outstanding</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-3 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-accent/10 flex items-center justify-center mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-accent" />
              </div>
              <p className="text-lg font-bold truncate leading-tight text-foreground">{fmt(totalRevenue)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {collectionRate > 0 ? `${collectionRate.toFixed(0)}% collected` : 'Collected'}
              </p>
            </div>
          </div>

          {/* Collections Bar representation */}
          {(() => {
            const received = totalRevenue;
            const pending = totalDue;
            const total = received + pending;
            const receivedPct = total > 0 ? (received / total) * 100 : 0;
            const pendingPct = total > 0 ? (pending / total) * 100 : 0;
            const fmtFull = (val: number) => `₹${Number(val || 0).toLocaleString('en-IN')}`;

            return (
              <section className="rounded-2xl border border-border bg-card p-4 space-y-4 shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <Banknote className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold text-foreground">Collection</span>
                  </div>
                  {/* Dynamic Month Dropdown Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowMonthDropdown((v) => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-border bg-background hover:bg-accent hover:text-accent-foreground rounded-full text-xs font-semibold text-muted-foreground transition-colors select-none cursor-pointer"
                    >
                      <span>{activeTrend ? activeTrend.month : monthLabel}</span>
                      <span className="text-[10px] opacity-70">▼</span>
                    </button>
                    
                    {showMonthDropdown && (
                      <>
                        <div 
                          className="fixed inset-0 z-40" 
                          onClick={() => setShowMonthDropdown(false)} 
                        />
                        <div className="absolute right-0 mt-1 z-50 w-36 rounded-xl border border-border bg-card shadow-lg p-1 space-y-0.5">
                          {monthlyTrends.map((t: any) => (
                            <button
                              key={t.month_key}
                              type="button"
                              onClick={() => {
                                setSelectedCollectionMonthKey(t.month_key);
                                setShowMonthDropdown(false);
                                refetch();
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                                (activeTrend?.month_key === t.month_key)
                                  ? 'bg-accent text-accent-foreground'
                                  : 'text-foreground hover:bg-secondary'
                              }`}
                            >
                              {t.month}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Stacked progress bar */}
                <div className="w-full flex h-4 rounded-full overflow-hidden bg-secondary/30 gap-0.5">
                  {receivedPct > 0 && (
                    <div
                      style={{ width: `${receivedPct}%` }}
                      className="bg-emerald-500 rounded-l transition-all duration-500"
                      title={`Received: ${receivedPct.toFixed(1)}%`}
                    />
                  )}
                  {pendingPct > 0 && (
                    <div
                      style={{ width: `${pendingPct}%` }}
                      className="bg-rose-500 rounded-r transition-all duration-500"
                      title={`Pending: ${pendingPct.toFixed(1)}%`}
                    />
                  )}
                </div>

                {/* Legend & Details */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                      <span className="text-muted-foreground">Pending</span>
                    </div>
                    <span className="font-bold text-rose-500">{fmtFull(pending)}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-muted-foreground">Received</span>
                    </div>
                    <span className="font-bold text-emerald-500">{fmtFull(received)}</span>
                  </div>
                </div>

                {/* Divider & Total */}
                <div className="border-t border-dashed border-border pt-3.5 flex items-center justify-between text-sm font-semibold">
                  <span className="text-muted-foreground">Total collection</span>
                  <span className="text-foreground font-bold">{fmtFull(total)}</span>
                </div>
              </section>
            );
          })()}

          {/* Search + Filter */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="search" placeholder="Search properties…" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <button type="button" onClick={() => setShowFilter(true)}
              className="p-2.5 bg-card border border-border rounded-xl" aria-label="Filter">
              <SlidersHorizontal className="w-5 h-5" />
            </button>
          </div>

          {/* Properties */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground">Properties</h2>
              <button
                type="button"
                onClick={() => setShowAddHostel(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline active:scale-95 transition-transform"
              >
                <Plus className="w-3.5 h-3.5" /> Add hostel
              </button>
            </div>

            {/* Filter chips */}
            {rankings.length > 0 && (
              <div className="mb-3">
                <HostelFilterChips active={hostelFilter} onChange={setHostelFilter} counts={filterCounts} />
              </div>
            )}

            {filteredRankings.length === 0 ? (
              <div className="text-center py-16 space-y-4 border border-dashed border-border rounded-xl">
                <Building2 className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
                <p className="text-sm text-muted-foreground">
                  {rankings.length === 0
                    ? 'No properties yet'
                    : hostelFilter === 'running'
                    ? 'No running hostels'
                    : hostelFilter === 'closed'
                    ? 'No closed hostels'
                    : 'No matches'}
                </p>
                {rankings.length === 0 && (
                  <button type="button" onClick={() => setShowAddHostel(true)}
                    className="px-5 py-2.5 bg-accent text-accent-foreground rounded-xl text-sm font-semibold">
                    Add first hostel
                  </button>
                )}
                {hostelFilter === 'closed' && rankings.length > 0 && (
                  <p className="text-xs text-muted-foreground">All your hostels are currently running.</p>
                )}
                {hostelFilter === 'running' && rankings.length > 0 && (
                  <p className="text-xs text-muted-foreground">All your hostels are currently closed. Restore one to get started.</p>
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
                      onPause={(id, name) => setPausingHostel({
                        id, name,
                        activeTenants: hostel.active_tenants,
                        occupiedBeds: hostel.occupied_beds,
                        pendingDues: hostel.pending_dues,
                      })}
                      onClose={(id, name) => setClosingHostel({
                        id, name,
                        activeTenants: hostel.active_tenants,
                        occupiedBeds: hostel.occupied_beds,
                        pendingDues: hostel.pending_dues,
                      })}
                      onResume={handleResumeHostel}
                      onRestore={(id, name) => {
                        const h = rankings.find((r: any) => r.hostel_id === id);
                        setRestoringHostel({ id, name, archived_at: h?.archived_at, archive_reason: h?.archive_reason });
                      }}
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
          <FilterModal onClose={() => setShowFilter(false)} onApply={setFilters} currentFilters={filters} />
        </Suspense>
      )}
      {editingHostelId && editingHostel && (
        <Suspense fallback={null}>
          <EditHostelSheet hostelId={editingHostelId} hostelName={editingHostel.hostel_name} onClose={() => setEditingHostelId(null)} />
        </Suspense>
      )}

      {/* Lifecycle modals */}
      {closingHostel && (
        <Suspense fallback={null}>
          <CloseHostelModal
            hostelId={closingHostel.id}
            hostelName={closingHostel.name}
            activeTenants={closingHostel.activeTenants}
            occupiedBeds={closingHostel.occupiedBeds}
            pendingDues={closingHostel.pendingDues}
            onClose={() => setClosingHostel(null)}
            onConfirm={handleCloseHostel}
          />
        </Suspense>
      )}
      {pausingHostel && (
        <Suspense fallback={null}>
          <PauseHostelModal
            hostelId={pausingHostel.id}
            hostelName={pausingHostel.name}
            activeTenants={pausingHostel.activeTenants}
            occupiedBeds={pausingHostel.occupiedBeds}
            pendingDues={pausingHostel.pendingDues}
            onClose={() => setPausingHostel(null)}
            onConfirm={handlePauseHostel}
          />
        </Suspense>
      )}
      {restoringHostel && (
        <Suspense fallback={null}>
          <RestoreHostelModal
            hostelId={restoringHostel.id}
            hostelName={restoringHostel.name}
            archivedAt={restoringHostel.archived_at}
            archiveReason={restoringHostel.archive_reason}
            onClose={() => setRestoringHostel(null)}
            onConfirm={handleRestoreHostel}
          />
        </Suspense>
      )}

      {/* Settings Sheet — mobile only (desktop uses sidebar link) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setShowSettings(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl overflow-hidden"
            style={{ maxHeight: '92dvh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
              <h2 className="text-base font-bold text-foreground">Settings</h2>
              <button type="button" onClick={() => setShowSettings(false)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(92dvh - 61px)' }}>
              <Suspense fallback={<div className="p-8 space-y-3"><div className="h-10 rounded-xl bg-muted animate-pulse" /><div className="h-10 rounded-xl bg-muted animate-pulse" /><div className="h-10 rounded-xl bg-muted animate-pulse" /></div>}>
                <SettingsView embedded />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
