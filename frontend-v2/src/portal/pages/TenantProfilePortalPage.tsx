import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { tenantService } from '@features/tenants/api';

export function TenantProfilePortalPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['tenant', 'me', 'profile'],
    queryFn: () => tenantService.getMyProfile(),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const prof = (data?.profile ?? data?.profiles ?? data) as Record<string, unknown>;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-foreground">Profile</h1>
      <div className="p-4 rounded-xl border border-border bg-card space-y-3 text-sm">
        <p><span className="text-muted-foreground">Name:</span> {String(prof.name ?? '—')}</p>
        <p><span className="text-muted-foreground">Email:</span> {String(prof.email ?? '—')}</p>
        <p><span className="text-muted-foreground">Phone:</span> {String(prof.phone ?? '—')}</p>
      </div>
    </div>
  );
}
