import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { moveOutService } from '@features/move-out/api';
import { MoveOutStepper } from '@features/tenants/components/moveout/MoveOutStepper';
import { queryKeys } from '@lib/queryKeys';

interface Props {
  hostelId: string;
  tenantId: string;
  status: string;
}

export function ExitWorkflowSection({ hostelId, tenantId, status }: Props) {
  const { data: requests } = useQuery({
    queryKey: queryKeys.tenants.moveOut(hostelId, tenantId),
    queryFn: () => moveOutService.listRequests(hostelId, {}),
    enabled: status === 'MOVE_OUT_REQUESTED' || status === 'ACTIVE',
  });

  const list = Array.isArray(requests) ? requests : (requests as Record<string, unknown>)?.requests ?? [];
  const active = (list as Record<string, unknown>[]).find(
    (r) => String(r.tenant_id) === tenantId && !['COMPLETED', 'CANCELLED'].includes(String(r.status))
  );

  if (status === 'LEFT') {
    return <p className="text-sm text-muted-foreground">This tenant has completed their exit.</p>;
  }

  if (!active) {
    return (
      <div className="p-4 rounded-xl border border-border bg-card text-sm">
        <p className="text-muted-foreground mb-3">No active move-out request.</p>
        <Link
          to={`/hostels/${hostelId}/move-outs`}
          className="inline-flex px-4 py-2.5 rounded-xl bg-accent text-accent-foreground font-semibold text-sm"
        >
          Open move-out management
        </Link>
      </div>
    );
  }

  return <MoveOutStepper request={active} hostelId={hostelId} />;
}
