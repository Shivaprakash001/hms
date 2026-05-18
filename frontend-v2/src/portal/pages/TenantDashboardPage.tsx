import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Loader2, Wallet, DoorOpen } from 'lucide-react';
import { tenantService } from '@features/tenants/api';
import { TenantStatusBadge } from '@features/tenants/components/badges/TenantStatusBadge';

export function TenantDashboardPage() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['tenant', 'me', 'profile'],
    queryFn: () => tenantService.getMyProfile(),
  });

  const { data: room } = useQuery({
    queryKey: ['tenant', 'me', 'room'],
    queryFn: () => tenantService.getMyRoom(),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const tenant = (profile?.tenant ?? profile) as Record<string, unknown>;
  const prof = (profile?.profile ?? profile?.profiles) as Record<string, unknown> | undefined;
  const status = String(tenant?.status ?? 'ACTIVE');
  const name = String(prof?.name ?? 'Tenant');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Hi, {name.split(' ')[0]}</h1>
        <div className="mt-2">
          <TenantStatusBadge status={status} size="md" />
        </div>
      </div>

      {room && (
        <div className="p-4 rounded-xl border border-border bg-card">
          <p className="text-xs text-muted-foreground uppercase">Your room</p>
          <p className="text-lg font-semibold mt-1">
            Room {String((room as Record<string, unknown>).room_no ?? (room as Record<string, unknown>).room?.room_no ?? '—')}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/tenant/payments"
          className="p-4 rounded-xl border border-border bg-card flex flex-col gap-2"
        >
          <Wallet className="w-5 h-5 text-accent" />
          <span className="font-medium text-sm">Payments</span>
        </Link>
        <Link
          to="/tenant/move-out"
          className="p-4 rounded-xl border border-border bg-card flex flex-col gap-2"
        >
          <DoorOpen className="w-5 h-5 text-accent" />
          <span className="font-medium text-sm">Move-out</span>
        </Link>
      </div>

      {status === 'LEFT' && (
        <button
          type="button"
          onClick={() => tenantService.requestReactivation()}
          className="w-full py-3 rounded-xl border border-accent text-accent font-semibold text-sm"
        >
          Request reactivation
        </button>
      )}
    </div>
  );
}
