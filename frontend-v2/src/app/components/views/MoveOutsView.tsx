import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { moveOutService } from '@features/move-out/api';
import { queryKeys } from '@lib/queryKeys';
import { TenantsLayout } from '@features/tenants/components/layout/TenantsLayout';
import { MoveOutStepper } from '@features/tenants/components/moveout/MoveOutStepper';
import { TenantStatusBadge } from '@features/tenants/components/badges/TenantStatusBadge';

export function MoveOutsView() {
  const { hostelId = '' } = useParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.moveOut.list(hostelId),
    queryFn: () => moveOutService.listRequests(hostelId),
    enabled: Boolean(hostelId),
  });

  const { data: detail } = useQuery({
    queryKey: queryKeys.moveOut.detail(hostelId, selectedId ?? ''),
    queryFn: () => moveOutService.getRequest(selectedId!),
    enabled: Boolean(selectedId),
  });

  const inspectMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      moveOutService.inspect(selectedId!, payload),
    onSuccess: () => {
      toast.success('Inspection recorded');
      qc.invalidateQueries({ queryKey: queryKeys.moveOut.all(hostelId) });
    },
  });

  const settleMutation = useMutation({
    mutationFn: () => moveOutService.settle(selectedId!),
    onSuccess: () => {
      toast.success('Settlement approved');
      qc.invalidateQueries({ queryKey: queryKeys.moveOut.all(hostelId) });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => moveOutService.complete(selectedId!),
    onSuccess: () => {
      toast.success('Move-out completed');
      qc.invalidateQueries({ queryKey: queryKeys.moveOut.all(hostelId) });
    },
  });

  const list = Array.isArray(data) ? data : (data as Record<string, unknown>)?.requests ?? [];
  const active = detail ?? (list as Record<string, unknown>[]).find((r) => String(r.id) === selectedId);

  return (
    <TenantsLayout title="Move-outs" subtitle="Inspection, settlement, and exit workflow" backTo={`/hostels/${hostelId}/tenants`}>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
          ) : (list as Record<string, unknown>[]).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No move-out requests</p>
          ) : (
            (list as Record<string, unknown>[]).map((r) => (
              <button
                key={String(r.id)}
                type="button"
                onClick={() => setSelectedId(String(r.id))}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  selectedId === String(r.id) ? 'border-accent bg-accent/5' : 'border-border bg-card'
                }`}
              >
                <p className="font-medium">{String(r.tenant_name ?? r.tenant?.profile?.name ?? 'Tenant')}</p>
                <div className="flex items-center gap-2 mt-1">
                  <TenantStatusBadge status={String(r.status)} />
                </div>
              </button>
            ))
          )}
        </div>

        <div>
          {active ? (
            <div className="space-y-4">
              <MoveOutStepper request={active as Record<string, unknown>} hostelId={hostelId} />
              <div className="flex flex-col gap-2">
                {String(active.status) === 'REQUESTED' && (
                  <button
                    type="button"
                    onClick={() => inspectMutation.mutate({ damages: [], cleaning_fee: 0 })}
                    className="py-2.5 rounded-xl bg-secondary font-medium text-sm"
                  >
                    Start inspection
                  </button>
                )}
                {String(active.status) === 'INSPECTION_DONE' && (
                  <button
                    type="button"
                    onClick={() => settleMutation.mutate()}
                    className="py-2.5 rounded-xl bg-accent text-accent-foreground font-semibold text-sm"
                  >
                    Approve settlement
                  </button>
                )}
                {String(active.status) === 'SETTLEMENT_APPROVED' && (
                  <button
                    type="button"
                    onClick={() => completeMutation.mutate()}
                    className="py-2.5 rounded-xl bg-accent text-accent-foreground font-semibold text-sm"
                  >
                    Complete move-out
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">Select a request</p>
          )}
        </div>
      </div>
    </TenantsLayout>
  );
}
