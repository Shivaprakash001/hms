import { Link } from 'react-router-dom';
import { Building2, MapPin } from 'lucide-react';
import { useTenantDashboard } from '@features/tenant-portal/hooks/useTenantDashboard';
import { TenantPriorityStrip } from '@/portal/components/TenantPriorityStrip';
import { TenantScorePanel } from '@/portal/components/TenantScorePanel';
import { TenantActionCenter } from '@/portal/components/TenantActionCenter';
import { TenantAnnouncements } from '@/portal/components/TenantAnnouncements';
import { TenantDocumentStatus, hasRequiredDocuments } from '@/portal/components/TenantDocumentStatus';
import { TenantStatusBadge } from '@features/tenants/components/badges/TenantStatusBadge';
import { tenantService } from '@features/tenants/api';
import { IdleRender } from '@/shared/performance';

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
  } = useTenantDashboard();

  const prof = profile?.profile as Record<string, unknown> | undefined;
  const tenant = profile?.tenant as Record<string, unknown> | undefined;
  const hostel = profile?.hostel as Record<string, unknown> | undefined;
  const name = String(prof?.name ?? 'Tenant');
  const status = String(tenant?.status ?? profile?.status ?? 'ACTIVE');
  const roomNo = profile?.room?.room_no ?? profile?.room_no ?? null;
  const hostelName = String(hostel?.name ?? 'Sri Adithya Hostels');
  const hostelLogo = String(hostel?.logo_url ?? '');
  const hostelLocation = [hostel?.city, hostel?.state].filter(Boolean).join(', ');
  const profileDocs = (profile?.documents ?? documents) as unknown[] | undefined;
  const profileType = String(tenant?.profile_type ?? profile?.profile_type ?? 'STUDENT');
  const advanceBalance = Number(advance?.balance ?? 0);

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-2xl shadow-sm">
        <div
          className="px-5 py-4 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #1B2D5B 0%, #243A72 100%)' }}
        >
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #F07B1D 0%, transparent 60%)' }}
          />
          <div className="relative flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-white/15 ring-1 ring-white/20">
              {hostelLogo ? (
                <img src={hostelLogo} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Building2 className="h-6 w-6 text-white/80" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                Tenant Home
              </p>
              <h1
                className="truncate text-xl font-bold leading-tight text-white"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {hostelName}
              </h1>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 bg-card border border-t-0 border-border rounded-b-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Welcome back,</p>
              <p
                className="truncate text-xl font-bold text-foreground"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {name.split(' ')[0]}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {hostelLocation && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-accent" />
                    {hostelLocation}
                  </span>
                )}
                {roomNo ? (
                  <span className="rounded-full bg-primary/8 border border-primary/15 px-2.5 py-1 font-semibold text-primary text-[11px]">
                    Room {String(roomNo)}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 font-semibold text-amber-700 text-[11px]">
                    Room pending
                  </span>
                )}
              </div>
            </div>
            <TenantStatusBadge status={status} size="md" />
          </div>
        </div>
      </header>

      {dues ? (
        <TenantPriorityStrip dues={dues} payments={payments} moveOut={moveOut} />
      ) : (
        <TenantPrioritySkeleton />
      )}

      {Array.isArray(profileDocs) && !hasRequiredDocuments(profileDocs as never[], profileType) && (
        <Link
          to="/tenant/profile#documents"
          className="block rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 hover:border-amber-300 transition-colors"
        >
          <div className="flex items-start gap-3">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Identity documents pending</p>
              <p className="mt-0.5 text-xs text-amber-700 leading-relaxed">Upload your documents so the hostel can complete verification. &rarr; Tap to add now.</p>
            </div>
          </div>
        </Link>
      )}

      {/* My Stay Section */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">My Stay</h3>
        <div className="grid grid-cols-2 gap-3">
          {/* Current Room Card */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Current Room</p>
            <p className="mt-2 text-lg font-extrabold text-foreground">
              {roomNo ? `Room ${String(roomNo)}` : 'Pending Assignment'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Bed Allocation: Active</p>
          </div>

          {/* Move Out Card */}
          <Link
            to="/tenant/move-out"
            className="rounded-2xl border border-border bg-card p-4 hover:border-accent/40 hover:shadow-sm transition-all flex flex-col justify-between"
          >
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Move Out</p>
              <p className="mt-2 text-lg font-extrabold text-foreground truncate">
                {moveOut && typeof moveOut === 'object' && moveOut.status
                  ? moveOut.status === 'COMPLETED'
                    ? 'Stay Completed'
                    : String(moveOut.status).replace(/_/g, ' ')
                  : 'Request Exit'}
              </p>
            </div>
            <p className="text-[10px] text-accent mt-2 font-semibold">
              {moveOut && typeof moveOut === 'object' && moveOut.status
                ? moveOut.status === 'COMPLETED'
                  ? 'Share Feedback →'
                  : 'Track Status →'
                : 'Plan Departure →'}
            </p>
          </Link>
        </div>
      </section>

      <IdleRender>
        <TenantScorePanel score={score} />
      </IdleRender>

      <IdleRender>
        {advance && (
          <Link
            to="/tenant/financials"
            className="block rounded-2xl border border-border bg-card p-4 hover:border-accent/40 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Deposit & Future Rent Credit</p>
              <span className="text-xs text-accent font-semibold">&rarr; View details</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-secondary py-2.5 px-2">
                <p className="text-muted-foreground text-[10px] mb-0.5">Paid Deposit</p>
                <p className="text-sm font-bold text-foreground">{fmt(Number((advance as any)?.security_deposit_paid ?? 0))}</p>
              </div>
              <div className="rounded-xl bg-secondary py-2.5 px-2">
                <p className="text-muted-foreground text-[10px] mb-0.5">Future Rent Credit</p>
                <p className="text-sm font-bold text-foreground">{fmt(Number((advance as any)?.available_rent_advance ?? 0))}</p>
              </div>
              <div className="rounded-xl bg-accent/8 border border-accent/15 py-2.5 px-2">
                <p className="text-accent/70 text-[10px] mb-0.5">Refundable</p>
                <p className="text-sm font-bold text-accent">{fmt(advanceBalance)}</p>
              </div>
            </div>
          </Link>
        )}

        <TenantDocumentStatus documents={profileDocs as never[]} profileType={profileType} />

        <TenantAnnouncements
          items={
            Array.isArray(notifications)
              ? notifications
              : (notifications as { notifications?: unknown[] })?.notifications
          }
        />

        <TenantActionCenter />
      </IdleRender>

      {status === 'LEFT' && (
        <button
          type="button"
          onClick={() => tenantService.requestReactivation()}
          className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm active:scale-[0.98] transition-transform shadow-sm"
        >
          Request reactivation
        </button>
      )}
    </div>
  );
}

function TenantPrioritySkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="h-3 w-24 rounded bg-muted animate-pulse" />
      <div className="mt-3 h-6 w-36 rounded bg-muted animate-pulse" />
      <div className="mt-4 h-11 rounded-xl bg-muted animate-pulse" />
    </div>
  );
}
