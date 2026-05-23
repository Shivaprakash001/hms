import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { UserPlus, GraduationCap } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
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

const YEAR_COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#8b5cf6', '#94a3b8'];

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
            {yearDistribution.length > 0 ? (
              <>
                <div className="h-28 w-28 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={yearDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={28}
                        outerRadius={48}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {yearDistribution.map((_, i) => (
                          <Cell key={i} fill={YEAR_COLORS[i % YEAR_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number) => [v, 'Tenants']}
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  {yearDistribution.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: YEAR_COLORS[i % YEAR_COLORS.length] }}
                      />
                      <span className="text-xs text-foreground flex-1 min-w-0 truncate">
                        {item.name}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground shrink-0">
                        {item.value} ({activeStudentCount > 0 ? Math.round((item.value / activeStudentCount) * 100) : 0}%)
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Tip: use this to plan renewal conversations and group notices by academic year.
                </p>
              </>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-6 w-full">
                No active students matching academic year range (1 to 4)
              </div>
            )}
          </div>
        </div>
      </div>
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
