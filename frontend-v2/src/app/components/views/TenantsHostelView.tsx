import { lazy, Suspense, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, CheckSquare, GraduationCap, UserPlus, X } from 'lucide-react';
import { useTenantsList } from '@features/tenants/hooks/useTenantsList';
import { useTenantActions } from '@features/tenants/hooks/useTenantActions';
import { useTenantStore } from '@features/tenants/store/tenantStore';
import { TenantsLayout } from '@features/tenants/components/layout/TenantsLayout';
import { TenantsDashboard } from '@features/tenants/components/dashboard/TenantsDashboard';
import { TenantFilters } from '@features/tenants/components/list/TenantFilters';
import { TenantTable } from '@features/tenants/components/list/TenantTable';
import { TenantCardMobile } from '@features/tenants/components/list/TenantCardMobile';
import { reminderService } from '@features/notifications/api';
import { useIsMobile } from '@/app/components/ui/use-mobile';
import { IdleRender } from '@/shared/performance';
import type { NormalizedTenant } from '@features/tenants/utils/normalize';

const AcademicMixChart = lazy(() => import('./tenants/AcademicMixChart').then((m) => ({ default: m.AcademicMixChart })));
const AddTenantModal = lazy(() => import('@/app/components/modals/AddTenantModal').then((m) => ({ default: m.AddTenantModal })));
const TenantProfileDrawer = lazy(() => import('@features/tenants/components/profile/TenantProfileDrawer').then((m) => ({ default: m.TenantProfileDrawer })));

export function TenantsHostelView() {
  const { hostelId = '' } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [showInvite, setShowInvite] = useState(false);
  const [drawerTenant, setDrawerTenant] = useState<NormalizedTenant | null>(null);
  const [selectedTenantIds, setSelectedTenantIds] = useState<Set<string>>(new Set());
  const setPage = useTenantStore((s) => s.setPage);
  const page = useTenantStore((s) => s.page);
  const pageSize = useTenantStore((s) => s.pageSize);

  const { tenants, total, dashboard, isLoading, refetch } = useTenantsList(hostelId);
  const actions = useTenantActions(hostelId);

  const yearDistribution = useMemo(() => {
    const counts = {
      '1st Year': 0,
      '2nd Year': 0,
      '3rd Year': 0,
      '4th Year': 0,
      'Other': 0,
    };
    tenants.forEach((t) => {
      if (t.status !== 'ACTIVE') return;
      const year = t.yearOfStudy;
      if (year === 1) counts['1st Year']++;
      else if (year === 2) counts['2nd Year']++;
      else if (year === 3) counts['3rd Year']++;
      else if (year === 4) counts['4th Year']++;
      else counts['Other']++;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0);
  }, [tenants]);

  const activeStudentCount = useMemo(() => {
    return tenants.filter((t) => t.status === 'ACTIVE').length;
  }, [tenants]);

  const overdueTenants = useMemo(
    () =>
      tenants.filter(
        (t) =>
          t.status === 'ACTIVE' &&
          t.outstandingAmount > 0 &&
          ['PENDING', 'PARTIAL'].includes(String(t.paymentStatus).toUpperCase())
      ),
    [tenants]
  );

  const selectedTenants = useMemo(
    () => tenants.filter((tenant) => selectedTenantIds.has(tenant.id)),
    [tenants, selectedTenantIds]
  );

  const reminderMutation = useMutation({
    mutationFn: (tenantId: string) => reminderService.sendToTenant(tenantId),
    onSuccess: () => toast.success('Reminder sent'),
    onError: () => toast.error('Failed to send reminder'),
  });

  const bulkReminderMutation = useMutation({
    mutationFn: (tenantIds: string[]) => reminderService.sendBulk(tenantIds),
    onSuccess: (result) => {
      toast.success(`Sent ${result.sent} reminder${result.sent === 1 ? '' : 's'}`);
      if (result.failed > 0) toast.warning(`${result.failed} reminder${result.failed === 1 ? '' : 's'} failed`);
      setSelectedTenantIds(new Set());
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to send reminders'),
  });

  const toggleTenantSelection = (tenantId: string) => {
    setSelectedTenantIds((prev) => {
      const next = new Set(prev);
      next.has(tenantId) ? next.delete(tenantId) : next.add(tenantId);
      return next;
    });
  };

  const selectAllOverdue = () => {
    setSelectedTenantIds(new Set(overdueTenants.map((tenant) => tenant.id)));
  };

  const handleView = (t: NormalizedTenant) => {
    if (isMobile) setDrawerTenant(t);
    else navigate(`/hostels/${hostelId}/tenants/${t.id}`);
  };

  return (
  <>
    <TenantsLayout
      title="Tenants"
      subtitle="Manage residents, billing, and lifecycle"
      backTo={`/hostels/${hostelId}`}
      actions={
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent text-accent-foreground text-sm font-semibold"
        >
          <UserPlus className="w-4 h-4" />
          <span className="hidden sm:inline">Invite</span>
        </button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TenantsDashboard stats={dashboard} />
        </div>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/20">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Academic Mix</h3>
              <p className="text-xs text-muted-foreground mt-0.5">For room planning and batch-wise communication</p>
            </div>
            <GraduationCap className="h-4 w-4 text-accent" />
          </div>
          <div className="p-4 flex items-center gap-3">
            <IdleRender fallback={<div className="h-28 w-full rounded-xl bg-secondary animate-pulse" />}>
              <Suspense fallback={<div className="h-28 w-full rounded-xl bg-secondary animate-pulse" />}>
                <AcademicMixChart
                  distribution={yearDistribution}
                  activeStudentCount={activeStudentCount}
                />
              </Suspense>
            </IdleRender>
          </div>
        </div>
      </div>
      <BulkTenantActions
        overdueCount={overdueTenants.length}
        selectedCount={selectedTenants.length}
        onSelectOverdue={selectAllOverdue}
        onClear={() => setSelectedTenantIds(new Set())}
        onSend={() => bulkReminderMutation.mutate(selectedTenants.map((tenant) => tenant.id))}
        busy={bulkReminderMutation.isPending}
      />
      <TenantFilters />
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-secondary animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <TenantTable
            tenants={tenants}
            hostelId={hostelId}
            onReminder={(t) => reminderMutation.mutate(t.id)}
            onMoveOut={() => navigate(`/hostels/${hostelId}/move-outs`)}
            onResend={(t) => t.email && actions.resendInvite.mutate(t.email)}
            selectedIds={selectedTenantIds}
            onToggleSelect={toggleTenantSelection}
          />
          <TenantCardMobile
            tenants={tenants}
            hostelId={hostelId}
            onSelect={handleView}
            onReminder={(t) => reminderMutation.mutate(t.id)}
            onCall={actions.callTenant}
            onResend={(t) => t.email && actions.resendInvite.mutate(t.email)}
            selectedIds={selectedTenantIds}
            onToggleSelect={toggleTenantSelection}
          />
          {total > pageSize && (
            <div className="flex justify-center gap-2 pt-4">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="px-4 py-2 rounded-lg border border-border text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground self-center">
                Page {page + 1}
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
    </TenantsLayout>

    {showInvite && (
      <Suspense fallback={null}>
        <AddTenantModal hostelId={hostelId} onClose={() => { setShowInvite(false); refetch(); }} />
      </Suspense>
    )}

    {drawerTenant && (
      <Suspense fallback={null}>
        <TenantProfileDrawer
          open={!!drawerTenant}
          hostelId={hostelId}
          tenantId={drawerTenant.id}
          onClose={() => setDrawerTenant(null)}
        />
      </Suspense>
    )}
  </>
  );
}

function BulkTenantActions({
  overdueCount,
  selectedCount,
  onSelectOverdue,
  onClear,
  onSend,
  busy,
}: {
  overdueCount: number;
  selectedCount: number;
  onSelectOverdue: () => void;
  onClear: () => void;
  onSend: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Bulk reminders</p>
          <p className="text-xs text-muted-foreground">
            {selectedCount > 0
              ? `${selectedCount} tenant${selectedCount === 1 ? '' : 's'} selected`
              : overdueCount > 0
                ? `${overdueCount} overdue tenant${overdueCount === 1 ? '' : 's'} need attention`
                : 'No overdue tenants right now'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={overdueCount === 0}
            onClick={onSelectOverdue}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-50"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Select all overdue
          </button>
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
          <button
            type="button"
            disabled={selectedCount === 0 || busy}
            onClick={onSend}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground disabled:opacity-50"
          >
            <Bell className="h-3.5 w-3.5" />
            {busy ? 'Sending...' : 'Send reminder to selected'}
          </button>
        </div>
      </div>
    </div>
  );
}
