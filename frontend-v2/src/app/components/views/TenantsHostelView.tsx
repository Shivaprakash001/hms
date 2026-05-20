import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import { useTenantsList } from '@features/tenants/hooks/useTenantsList';
import { useTenantActions } from '@features/tenants/hooks/useTenantActions';
import { useTenantStore } from '@features/tenants/store/tenantStore';
import { TenantsLayout } from '@features/tenants/components/layout/TenantsLayout';
import { TenantsDashboard } from '@features/tenants/components/dashboard/TenantsDashboard';
import { TenantFilters } from '@features/tenants/components/list/TenantFilters';
import { TenantTable } from '@features/tenants/components/list/TenantTable';
import { TenantCardMobile } from '@features/tenants/components/list/TenantCardMobile';
import { TenantProfileDrawer } from '@features/tenants/components/profile/TenantProfileDrawer';
import { AddTenantModal } from '@/app/components/modals/AddTenantModal';
import { reminderService } from '@features/notifications/api';
import { useIsMobile } from '@/app/components/ui/use-mobile';
import type { NormalizedTenant } from '@features/tenants/utils/normalize';

export function TenantsHostelView() {
  const { hostelId = '' } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [showInvite, setShowInvite] = useState(false);
  const [drawerTenant, setDrawerTenant] = useState<NormalizedTenant | null>(null);
  const setPage = useTenantStore((s) => s.setPage);
  const page = useTenantStore((s) => s.page);
  const pageSize = useTenantStore((s) => s.pageSize);

  const { tenants, total, dashboard, isLoading, refetch } = useTenantsList(hostelId);
  const actions = useTenantActions(hostelId);

  const reminderMutation = useMutation({
    mutationFn: (tenantId: string) => reminderService.sendToTenant(tenantId),
    onSuccess: () => toast.success('Reminder sent'),
    onError: () => toast.error('Failed to send reminder'),
  });

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
      <TenantsDashboard stats={dashboard} />
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
          />
          <TenantCardMobile
            tenants={tenants}
            hostelId={hostelId}
            onSelect={handleView}
            onReminder={(t) => reminderMutation.mutate(t.id)}
            onCall={actions.callTenant}
            onResend={(t) => t.email && actions.resendInvite.mutate(t.email)}
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
      <AddTenantModal hostelId={hostelId} onClose={() => { setShowInvite(false); refetch(); }} />
    )}

    {drawerTenant && (
      <TenantProfileDrawer
        open={!!drawerTenant}
        hostelId={hostelId}
        tenantId={drawerTenant.id}
        onClose={() => setDrawerTenant(null)}
      />
    )}
  </>
  );
}
