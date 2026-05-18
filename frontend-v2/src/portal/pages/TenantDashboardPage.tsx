import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTenantDashboard } from '@features/tenant-portal/hooks/useTenantDashboard';
import { TenantPriorityStrip } from '@/portal/components/TenantPriorityStrip';
import { TenantScorePanel } from '@/portal/components/TenantScorePanel';
import { TenantActionCenter } from '@/portal/components/TenantActionCenter';
import { TenantAnnouncements } from '@/portal/components/TenantAnnouncements';
import { TenantDocumentStatus } from '@/portal/components/TenantDocumentStatus';
import { TenantStatusBadge } from '@features/tenants/components/badges/TenantStatusBadge';
import { tenantService } from '@features/tenants/api';

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

export function TenantDashboardPage() {
  const {
    profile,
    dues,
    payments,
    score,
    advance,
    moveOut,
    notifications,
    documents,
    isLoading,
  } = useTenantDashboard();

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const prof = (profile?.profile ?? profile?.profiles) as Record<string, unknown> | undefined;
  const name = String(prof?.name ?? prof?.full_name ?? 'Tenant');
  const status = String(profile?.status ?? 'ACTIVE');
  const allocation = (profile as Record<string, unknown>)?.room_allocations as
    | { room?: { room_no?: string } }[]
    | undefined;
  const roomNo =
    profile?.room_no ??
    allocation?.[0]?.room?.room_no ??
    profile?.current_room?.room_no;

  const advanceBalance = Number(advance?.balance ?? 0);
  const depositCredits = (advance?.entries ?? []).filter(
    (e: { type?: string; reason?: string }) =>
      e.type === 'CREDIT' && ['DEPOSIT', 'TOPUP'].includes(String(e.reason))
  );
  const depositTotal = depositCredits.reduce(
    (s: number, e: { amount?: number }) => s + Number(e.amount ?? 0),
    0
  );
  const adjustments = depositTotal > 0 ? depositTotal - advanceBalance : 0;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="text-xl font-bold text-foreground">Hi, {name.split(' ')[0]}</h1>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <TenantStatusBadge status={status} size="md" />
          {roomNo ? (
            <span className="text-xs text-muted-foreground">Room {String(roomNo)}</span>
          ) : (
            <span className="text-xs text-amber-600 font-medium">
              Room assignment pending from hostel
            </span>
          )}
        </div>
      </header>

      <TenantPriorityStrip dues={dues} payments={payments} moveOut={moveOut} />

      <TenantScorePanel score={score} />

      {advance && (
        <Link
          to="/tenant/financials"
          className="block rounded-xl border border-border bg-card p-4 hover:border-accent/40 transition-colors"
        >
          <p className="text-xs text-muted-foreground uppercase font-semibold">Security deposit</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <p className="text-muted-foreground text-[10px]">Deposited</p>
              <p className="font-bold">{fmt(depositTotal || advanceBalance)}</p>
            </div>
            {adjustments > 0 && (
              <div>
                <p className="text-muted-foreground text-[10px]">Adjustments</p>
                <p className="font-bold">{fmt(adjustments)}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground text-[10px]">Refundable</p>
              <p className="font-bold text-accent">{fmt(advanceBalance)}</p>
            </div>
          </div>
        </Link>
      )}

      <TenantDocumentStatus documents={documents as never[]} />

      <TenantAnnouncements
        items={
          Array.isArray(notifications)
            ? notifications
            : (notifications as { notifications?: unknown[] })?.notifications
        }
      />

      <TenantActionCenter />

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
