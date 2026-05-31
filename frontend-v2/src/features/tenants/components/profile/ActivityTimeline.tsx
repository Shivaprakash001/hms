import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { activityListService } from '@features/activity/api';
import { queryKeys } from '@lib/queryKeys';

interface Props {
  hostelId: string;
  tenantId: string;
  tenantName: string;
}

export function ActivityTimeline({ hostelId, tenantId, tenantName }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.tenants.activity(hostelId, tenantId),
    queryFn: () => activityListService.getList(hostelId, { tenantId, limit: 50 }),
    staleTime: 60_000,
  });

  const items = (Array.isArray(data) ? data : (data as Record<string, unknown>)?.items ?? (data as Record<string, unknown>)?.activity ?? []) as Record<string, unknown>[];

  const filtered = items.filter(
    (e) =>
      String(e.tenant_id ?? '') === tenantId ||
      String(e.tenant_name ?? '').toLowerCase().includes(tenantName.toLowerCase())
  );

  if (isLoading) {
    return <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />;
  }

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No activity recorded for this tenant yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {filtered.map((e, i) => (
        <div key={String(e.id ?? i)} className="flex gap-3">
          <div className="w-2 h-2 rounded-full bg-accent mt-2 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {String(e.detail ?? e.message ?? e.type ?? 'Event')}
            </p>
            <p className="text-xs text-muted-foreground">
              {e.created_at
                ? new Date(String(e.created_at)).toLocaleString('en-IN')
                : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
