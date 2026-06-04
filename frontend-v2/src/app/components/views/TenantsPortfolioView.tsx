import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronRight, Upload } from 'lucide-react';
import { ownerService } from '@features/owners/api';
import { useTenantStore } from '@features/tenants/store/tenantStore';
import { TenantsLayout } from '@features/tenants/components/layout/TenantsLayout';
import { useTenantsList } from '@features/tenants/hooks/useTenantsList';
import { TenantFilters } from '@features/tenants/components/list/TenantFilters';
import { TenantCardMobile } from '@features/tenants/components/list/TenantCardMobile';
import { TenantTable } from '@features/tenants/components/list/TenantTable';

export function TenantsPortfolioView() {
  const navigate = useNavigate();
  const selectedHostelId = useTenantStore((s) => s.selectedHostelId);
  const setSelectedHostelId = useTenantStore((s) => s.setSelectedHostelId);
  const [hostelFilter, setHostelFilter] = useState(selectedHostelId ?? '');

  const { data: hostelsRaw } = useQuery({
    queryKey: ['owner', 'hostels'],
    queryFn: () => ownerService.getHostels(),
    staleTime: 5 * 60_000,
  });

  const hostels: Record<string, unknown>[] = Array.isArray(hostelsRaw)
    ? hostelsRaw
    : Array.isArray((hostelsRaw as Record<string, unknown>)?.hostels)
      ? ((hostelsRaw as Record<string, unknown>).hostels as Record<string, unknown>[])
      : [];

  const activeHostelId = hostelFilter || (hostels[0] ? String(hostels[0].id) : '');
  const { tenants, isLoading } = useTenantsList(activeHostelId || undefined, {
    enabled: Boolean(activeHostelId),
  });

  return (
    <TenantsLayout
      title="All tenants"
      subtitle="Portfolio-wide tenant operations"
      actions={
        <Link
          to="/tenants/import"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground"
        >
          <Upload className="h-4 w-4" />
          Bulk invite
        </Link>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm text-muted-foreground">
          Hostel
          <select
            value={activeHostelId}
            onChange={(e) => {
              setHostelFilter(e.target.value);
              setSelectedHostelId(e.target.value);
            }}
            className="mt-1 w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm"
          >
            {hostels.map((h) => (
              <option key={String(h.id)} value={String(h.id)}>
                {String(h.name ?? h.hostel_name ?? 'Hostel')}
              </option>
            ))}
          </select>
        </label>

        {activeHostelId && (
          <Link
            to={`/hostels/${activeHostelId}/tenants`}
            className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:border-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-accent" />
              <span className="font-medium text-foreground">Open full tenants dashboard</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </Link>
        )}

        {activeHostelId && (
          <>
            <TenantFilters />
            {isLoading ? (
              <div className="h-32 rounded-xl bg-secondary animate-pulse" />
            ) : (
              <>
                <TenantTable
                  tenants={tenants.slice(0, 10)}
                  hostelId={activeHostelId}
                  onMoveOut={() => navigate(`/hostels/${activeHostelId}/move-outs`)}
                />
                <TenantCardMobile tenants={tenants.slice(0, 10)} hostelId={activeHostelId} />
              </>
            )}
          </>
        )}
      </div>
    </TenantsLayout>
  );
}
