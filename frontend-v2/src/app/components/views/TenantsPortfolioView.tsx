import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  UserPlus, Upload, Bell,
  AlertTriangle, CheckCircle2, ArrowRight, Download,
  Search, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { ownerService } from '@features/owners/api';
import { useTenantStore } from '@features/tenants/store/tenantStore';
import { useTenantsList } from '@features/tenants/hooks/useTenantsList';
import { useTenantActions } from '@features/tenants/hooks/useTenantActions';
import { reminderService } from '@features/notifications/api';
import { TenantCardMobile } from '@features/tenants/components/list/TenantCardMobile';
import type { NormalizedTenant } from '@features/tenants/utils/normalize';

const AddTenantModal = lazy(() =>
  import('@/app/components/modals/AddTenantModal').then((m) => ({ default: m.AddTenantModal }))
);
const TenantProfileDrawer = lazy(() =>
  import('@features/tenants/components/profile/TenantProfileDrawer').then((m) => ({ default: m.TenantProfileDrawer }))
);
const TenantTable = lazy(() =>
  import('@features/tenants/components/list/TenantTable').then((m) => ({ default: m.TenantTable }))
);

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) => {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v.toLocaleString('en-IN')}`;
};

function readHostels(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const obj = payload as Record<string, unknown> | undefined;
  if (Array.isArray(obj?.hostels)) return obj!.hostels as Record<string, unknown>[];
  if (Array.isArray((obj?.data as Record<string, unknown>)?.hostels))
    return (obj!.data as Record<string, unknown>).hostels as Record<string, unknown>[];
  return [];
}

// ─── Status filter chips ─────────────────────────────────────────────────────

type ChipFilter = 'all' | 'active' | 'invited' | 'overdue' | 'move_out' | 'inactive';

const CHIPS: { id: ChipFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'invited', label: 'Invited' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'move_out', label: 'Move-Out' },
  { id: 'inactive', label: 'Former' },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function SummaryBar({
  active, invites, moveOuts, overdue, pendingDues,
}: {
  active: number; invites: number; moveOuts: number; overdue: number; pendingDues: number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-sm text-foreground">
          <span className="font-bold text-foreground">{active}</span>
          <span className="text-muted-foreground ml-1">Active</span>
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-sm">
          <span className={`font-bold ${invites > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-foreground'}`}>{invites}</span>
          <span className="text-muted-foreground ml-1">Invites</span>
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-sm">
          <span className={`font-bold ${moveOuts > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>{moveOuts}</span>
          <span className="text-muted-foreground ml-1">Move-outs</span>
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-sm">
          <span className={`font-bold ${overdue > 0 ? 'text-destructive' : 'text-foreground'}`}>{overdue}</span>
          <span className="text-muted-foreground ml-1">Overdue</span>
        </span>
        {pendingDues > 0 && (
          <>
            <span className="hidden sm:block text-muted-foreground/40">·</span>
            <span className="w-full sm:w-auto text-sm font-bold text-destructive">
              {fmt(pendingDues)} Pending Dues
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function ActionCenter({
  overdue, invites, moveOuts, hostelId,
}: {
  overdue: number; invites: number; moveOuts: number; hostelId: string;
}) {
  const navigate = useNavigate();
  const hasActions = overdue > 0 || invites > 0 || moveOuts > 0;
  const setLifecycleFilter = useTenantStore((s) => s.setLifecycleFilter);

  if (!hasActions) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 dark:border-emerald-800/30 dark:bg-emerald-900/20">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">All tenant operations healthy</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
      {overdue > 0 && (
        <div className="flex items-center gap-3 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <p className="flex-1 text-sm text-foreground">
            <span className="font-semibold">{overdue} overdue</span> tenant{overdue === 1 ? '' : 's'}
          </p>
          <button
            type="button"
            onClick={() => { setLifecycleFilter('overdue'); }}
            className="shrink-0 flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            Send reminders <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
      {invites > 0 && (
        <div className="flex items-center gap-3 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-blue-500 shrink-0" />
          <p className="flex-1 text-sm text-foreground">
            <span className="font-semibold">{invites} pending</span> invitation{invites === 1 ? '' : 's'}
          </p>
          <button
            type="button"
            onClick={() => { setLifecycleFilter('invited'); }}
            className="shrink-0 flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            Review <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
      {moveOuts > 0 && (
        <div className="flex items-center gap-3 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="flex-1 text-sm text-foreground">
            <span className="font-semibold">{moveOuts} move-out</span> request{moveOuts === 1 ? '' : 's'}
          </p>
          <button
            type="button"
            onClick={() => navigate(`/hostels/${hostelId}/move-outs`)}
            className="shrink-0 flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            Review <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function BulkActions({
  hostelId,
  overdueCount,
  allTenants,
}: {
  hostelId: string;
  overdueCount: number;
  allTenants: NormalizedTenant[];
}) {
  const bulkReminderMutation = useMutation({
    mutationFn: (ids: string[]) => reminderService.sendBulk(ids),
    onSuccess: (result) => {
      toast.success(`Sent ${result.sent} reminder${result.sent === 1 ? '' : 's'}`);
      if (result.failed > 0) toast.warning(`${result.failed} failed`);
    },
    onError: () => toast.error('Failed to send reminders'),
  });

  const sendToOverdue = () => {
    const overdueTenants = allTenants.filter(
      (t) =>
        t.status === 'ACTIVE' &&
        t.outstandingAmount > 0 &&
        ['PENDING', 'PARTIAL'].includes(String(t.paymentStatus).toUpperCase())
    );
    if (overdueTenants.length === 0) {
      toast.info('No overdue tenants right now');
      return;
    }
    bulkReminderMutation.mutate(overdueTenants.map((t) => t.id));
  };

  const exportCsv = () => {
    const headers = 'Name,Room,Rent,Status,Outstanding\n';
    const rows = allTenants
      .map((t) => `"${t.name}","${t.room}","${t.rent}","${t.status}","${t.outstandingAmount}"`)
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tenants.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported tenants');
  };

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
      <Link
        to="/tenants/import"
        className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground hover:border-accent/40 transition-colors"
      >
        <Upload className="w-4 h-4 text-muted-foreground" />
        Bulk Invite
      </Link>
      <button
        type="button"
        onClick={exportCsv}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground hover:border-accent/40 transition-colors"
      >
        <Download className="w-4 h-4 text-muted-foreground" />
        Export
      </button>
      <button
        type="button"
        onClick={sendToOverdue}
        disabled={overdueCount === 0 || bulkReminderMutation.isPending}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-foreground hover:border-accent/40 transition-colors disabled:opacity-50"
      >
        <Bell className="w-4 h-4 text-muted-foreground" />
        {bulkReminderMutation.isPending ? 'Sending…' : 'Send Reminder'}
      </button>
    </div>
  );
}

function SearchAndFilters() {
  const searchQuery = useTenantStore((s) => s.searchQuery);
  const lifecycleFilter = useTenantStore((s) => s.lifecycleFilter);
  const setSearchQuery = useTenantStore((s) => s.setSearchQuery);
  const setLifecycleFilter = useTenantStore((s) => s.setLifecycleFilter);
  const setShowInactive = useTenantStore((s) => s.setShowInactive);

  const handleChip = (id: ChipFilter) => {
    setLifecycleFilter(id);
    setShowInactive(id === 'inactive');
  };

  // Map chip IDs to store LifecycleFilter IDs (they're the same here)
  const activeChip: ChipFilter =
    (CHIPS.find((c) => c.id === lifecycleFilter)?.id as ChipFilter) ?? 'all';

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search name, phone, room…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
        {CHIPS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleChip(id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors touch-manipulation ${
              activeChip === id
                ? 'bg-accent text-accent-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────────

export function TenantsPortfolioView() {
  const navigate = useNavigate();
  const selectedHostelId = useTenantStore((s) => s.selectedHostelId);
  const setSelectedHostelId = useTenantStore((s) => s.setSelectedHostelId);
  const page = useTenantStore((s) => s.page);
  const pageSize = useTenantStore((s) => s.pageSize);
  const setPage = useTenantStore((s) => s.setPage);

  const [showInvite, setShowInvite] = useState(false);
  const [drawerTenant, setDrawerTenant] = useState<NormalizedTenant | null>(null);

  // Load hostels
  const { data: hostelsRaw } = useQuery({
    queryKey: ['owner', 'hostels'],
    queryFn: () => ownerService.getHostels(),
    staleTime: 5 * 60_000,
  });
  const hostels = readHostels(hostelsRaw);
  const activeHostelId = selectedHostelId || (hostels[0] ? String(hostels[0].id) : '');

  // Load tenants + dashboard stats
  const { tenants, total, dashboard, isLoading, refetch } = useTenantsList(
    activeHostelId || undefined,
    { enabled: Boolean(activeHostelId) }
  );

  const actions = useTenantActions(activeHostelId);

  const reminderMutation = useMutation({
    mutationFn: (tenantId: string) => reminderService.sendToTenant(tenantId),
    onSuccess: () => toast.success('Reminder sent'),
    onError: () => toast.error('Failed to send reminder'),
  });

  // All tenants (unfiltered) for bulk reminder overdue calculation
  const allTenants = useMemo(() => tenants, [tenants]);

  const handleSelectTenant = (t: NormalizedTenant) => {
    setDrawerTenant(t);
  };

  return (
    <>
      {/* ── Page wrapper ── */}
      <div className="px-4 py-5 space-y-4 min-w-0 max-w-5xl mx-auto pb-28 md:pb-8">

        {/* ── Header ── */}
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-accent" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-foreground">Tenants</h1>
                <p className="text-sm text-muted-foreground truncate">Manage residents, invitations and move-outs</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent text-accent-foreground text-sm font-semibold active:scale-95 transition-transform"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite</span>
          </button>
        </header>

        {/* ── Hostel selector (only when multiple hostels) ── */}
        {hostels.length > 1 && (
          <select
            value={activeHostelId}
            onChange={(e) => setSelectedHostelId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {hostels.map((h) => (
              <option key={String(h.id)} value={String(h.id)}>
                {String(h.name ?? h.hostel_name ?? 'Hostel')}
              </option>
            ))}
          </select>
        )}

        {/* ── Loading skeleton ── */}
        {!activeHostelId && (
          <div className="space-y-3">
            <div className="h-16 rounded-2xl bg-muted animate-pulse" />
            <div className="h-12 rounded-xl bg-muted animate-pulse" />
          </div>
        )}

        {activeHostelId && (
          <>
            {/* ── Action Summary Bar ── */}
            <SummaryBar
              active={dashboard.active}
              invites={dashboard.pendingInvites}
              moveOuts={dashboard.moveOutRequests}
              overdue={dashboard.overdueTenants}
              pendingDues={dashboard.pendingDues}
            />

            {/* ── Action Center ── */}
            <ActionCenter
              overdue={dashboard.overdueTenants}
              invites={dashboard.pendingInvites}
              moveOuts={dashboard.moveOutRequests}
              hostelId={activeHostelId}
            />

            {/* ── Bulk Actions ── */}
            <BulkActions
              hostelId={activeHostelId}
              overdueCount={dashboard.overdueTenants}
              allTenants={allTenants}
            />

            {/* ── Search + Filter chips ── */}
            <SearchAndFilters />

            {/* ── Tenant List ── */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : tenants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 border border-dashed border-border rounded-xl">
                <Users className="w-10 h-10 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground">No tenants found</p>
                <button
                  type="button"
                  onClick={() => setShowInvite(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-accent-foreground text-sm font-semibold"
                >
                  <UserPlus className="w-4 h-4" /> Invite first tenant
                </button>
              </div>
            ) : (
              <>
                {/* Mobile virtualized card list */}
                <TenantCardMobile
                  tenants={tenants}
                  hostelId={activeHostelId}
                  onSelect={handleSelectTenant}
                  onReminder={(t) => reminderMutation.mutate(t.id)}
                  onCall={actions.callTenant}
                  onResend={(t) => t.email && actions.resendInvite.mutate(t.email)}
                />

                {/* Desktop table — lazy loaded, hidden on mobile */}
                <Suspense fallback={<div className="hidden md:block h-40 rounded-xl bg-muted animate-pulse" />}>
                  <TenantTable
                    tenants={tenants}
                    hostelId={activeHostelId}
                    onReminder={(t) => reminderMutation.mutate(t.id)}
                    onMoveOut={() => navigate(`/hostels/${activeHostelId}/move-outs`)}
                    onResend={(t) => t.email && actions.resendInvite.mutate(t.email)}
                  />
                </Suspense>

                {/* Pagination */}
                {total > pageSize && (
                  <div className="flex justify-center items-center gap-3 pt-4">
                    <button
                      type="button"
                      disabled={page === 0}
                      onClick={() => setPage(page - 1)}
                      className="px-4 py-2 rounded-lg border border-border text-sm disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-muted-foreground">
                      Page {page + 1} of {Math.ceil(total / pageSize)}
                    </span>
                    <button
                      type="button"
                      disabled={(page + 1) * pageSize >= total}
                      onClick={() => setPage(page + 1)}
                      className="px-4 py-2 rounded-lg border border-border text-sm disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Add Tenant Modal ── */}
      {showInvite && activeHostelId && (
        <Suspense fallback={null}>
          <AddTenantModal
            hostelId={activeHostelId}
            onClose={() => { setShowInvite(false); refetch(); }}
          />
        </Suspense>
      )}

      {/* ── Tenant Profile Drawer (mobile) ── */}
      {drawerTenant && activeHostelId && (
        <Suspense fallback={null}>
          <TenantProfileDrawer
            open={!!drawerTenant}
            hostelId={activeHostelId}
            tenantId={drawerTenant.id}
            onClose={() => setDrawerTenant(null)}
          />
        </Suspense>
      )}
    </>
  );
}
