import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BedDouble, CalendarDays, ChevronRight, ClipboardCheck, IndianRupee } from 'lucide-react';
import { moveOutService } from '@features/move-out/api';
import { queryKeys } from '@lib/queryKeys';
import { TabError, TabSkeleton } from '../shared/TabStates';

export function MoveOutsTab({ hostelId }: { hostelId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.moveOut.list(hostelId),
    queryFn: () => moveOutService.listRequests(hostelId, { limit: 20 }),
    enabled: Boolean(hostelId),
    staleTime: 60 * 1000,
  });

  if (isLoading) return <TabSkeleton />;
  if (isError) return <TabError onRetry={refetch} />;

  const moveouts: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : Array.isArray((data as Record<string, unknown>)?.requests)
    ? ((data as Record<string, unknown>).requests as Record<string, unknown>[])
    : [];

  if (moveouts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">No move-out requests yet</h3>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
          Tenant move-out requests, inspections, settlement approvals, and exit payments will appear here as soon as the workflow starts.
        </p>
        <Link
          to={`/hostels/${hostelId}/move-outs`}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-accent-foreground active:scale-95"
        >
          Open move-out workflow
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Move-out workflow</h3>
          <p className="text-xs text-muted-foreground">Live requests from tenant exit operations</p>
        </div>
        <Link to={`/hostels/${hostelId}/move-outs`} className="text-xs font-semibold text-accent">
          Manage
        </Link>
      </div>
      {moveouts.map((moveout, i) => {
        const tenant = moveout.tenant as Record<string, unknown> | undefined;
        const profile = (tenant?.profiles ?? tenant?.profile ?? moveout.profile) as Record<string, unknown> | undefined;
        const allocation = Array.isArray(tenant?.room_allocations)
          ? (tenant.room_allocations[0] as Record<string, unknown> | undefined)
          : undefined;
        const room = allocation?.room as Record<string, unknown> | undefined;
        const settlement = (moveout.settlement_preview ?? moveout.settlement ?? {}) as Record<string, unknown>;
        const status = String(moveout.status ?? 'REQUESTED');
        const plannedExit = String(moveout.planned_exit_date ?? moveout.move_out_date ?? moveout.updated_at ?? '');
        const tenantName = String(moveout.tenant_name ?? profile?.name ?? moveout.name ?? 'Tenant');
        const roomNo = String(room?.room_no ?? moveout.room_no ?? moveout.room_number ?? 'Unassigned');
        const netAmount = Number(settlement.net_settlement_amount ?? settlement.net_amount ?? 0);
        const direction = String(settlement.settlement_direction ?? settlement.direction ?? '');

        return (
          <Link
            key={String(moveout.id ?? i)}
            to={`/hostels/${hostelId}/move-outs`}
            className="block bg-card border border-border rounded-xl p-4 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="min-w-0">
                <div className="font-semibold text-foreground truncate">{tenantName}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <BedDouble className="h-3.5 w-3.5" />
                    Room {roomNo}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {plannedExit ? new Date(plannedExit).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Exit date pending'}
                  </span>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${moveOutStatusClass(status)}`}>
                {status.replaceAll('_', ' ')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-xs">
              <span className="text-muted-foreground">
                {direction === 'OWNER_OWES_TENANT'
                  ? 'Refund pending'
                  : direction === 'TENANT_OWES_OWNER'
                  ? 'Tenant payment pending'
                  : 'Settlement in progress'}
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <IndianRupee className="h-3.5 w-3.5" />
                {Math.abs(netAmount).toLocaleString('en-IN')}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function moveOutStatusClass(status: string) {
  if (status === 'COMPLETED') return 'bg-emerald-500/10 text-emerald-700';
  if (status === 'SETTLEMENT_PENDING_PAYMENT') return 'bg-orange-500/10 text-orange-700';
  if (status === 'PHYSICALLY_VACATED' || status === 'VACATED') return 'bg-indigo-500/10 text-indigo-700';
  if (status === 'SETTLEMENT_APPROVED' || status === 'APPROVED') return 'bg-amber-500/10 text-amber-700';
  return 'bg-accent/10 text-accent';
}
