import { Link } from 'react-router-dom';
import { Building2, DoorOpen, Loader2, MapPin } from 'lucide-react';
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

  const prof = profile?.profile as Record<string, unknown> | undefined;
  const tenant = profile?.tenant as Record<string, unknown> | undefined;
  const hostel = profile?.hostel as Record<string, unknown> | undefined;
  const name = String(prof?.name ?? 'Tenant');
  const status = String(tenant?.status ?? profile?.status ?? 'ACTIVE');
  const roomNo = profile?.room?.room_no ?? profile?.room_no ?? null;
  const hostelName = String(hostel?.name ?? 'Sri Adithya Hostels');
  const hostelLogo = String(hostel?.logo_url ?? '');
  const hostelLocation = [hostel?.city, hostel?.state].filter(Boolean).join(', ');
  const profileDocs = (profile?.documents ?? documents) as unknown[];
  const activeMoveOut =
    moveOut?.status && !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(String(moveOut.status).toUpperCase());

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
      <header className="overflow-hidden rounded-2xl border border-accent/20 bg-card shadow-sm">
        <div className="bg-accent px-5 py-4 text-accent-foreground">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-white/15 ring-1 ring-white/25">
              {hostelLogo ? (
                <img src={hostelLogo} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Building2 className="h-6 w-6" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">
                Tenant Home
              </p>
              <h1 className="truncate text-2xl font-bold leading-tight">{hostelName}</h1>
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Welcome back,</p>
              <p className="truncate text-xl font-bold text-foreground">{name.split(' ')[0]}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {hostelLocation && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-accent" />
                    {hostelLocation}
                  </span>
                )}
                {roomNo ? (
                  <span className="rounded-full bg-accent/10 px-2.5 py-1 font-medium text-accent">
                    Room {String(roomNo)}
                  </span>
                ) : (
                  <span className="font-medium text-amber-600">
                    Room assignment pending
                  </span>
                )}
              </div>
            </div>
            <TenantStatusBadge status={status} size="md" />
          </div>
        </div>
      </header>

      <TenantPriorityStrip dues={dues} payments={payments} moveOut={moveOut} />

      {!activeMoveOut && status === 'ACTIVE' && (
        <Link
          to="/tenant/move-out"
          className="flex items-center justify-between gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-4 text-sm transition-colors hover:border-accent/40"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <DoorOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Planning to move out?</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Send a request to start inspection and settlement.</p>
            </div>
          </div>
          <span className="shrink-0 text-xs font-semibold text-accent">Start</span>
        </Link>
      )}

      {profileDocs.length === 0 && (
        <Link
          to="/tenant/profile#documents"
          className="block rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <p className="font-semibold">Identity documents pending</p>
          <p className="mt-1 text-xs">Upload your documents after activation so the hostel can complete verification.</p>
        </Link>
      )}

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

      <TenantDocumentStatus documents={profileDocs as never[]} />

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
