import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CreditCard, Phone, Mail, Bell, Download, FileCheck2, Send,
  XCircle, Smartphone, BedDouble, User,
  Building2, Settings, IndianRupee, LogOut, CheckCircle, AlertTriangle, AlertCircle,
  Heart, Sparkles, MapPin
} from 'lucide-react';
import { useTenantDashboard } from '@features/tenant-portal/hooks/useTenantDashboard';
import { TenantPriorityStrip } from '@/portal/components/TenantPriorityStrip';
import { TenantScorePanel } from '@/portal/components/TenantScorePanel';
import { TenantActionCenter } from '@/portal/components/TenantActionCenter';
import { OnboardingProgressTracker } from '@/platforms/tenant/components/OnboardingProgressTracker';
import { TenantReservationCard } from '@/platforms/tenant/components/TenantReservationCard';
import { TenantAnnouncements } from '@/portal/components/TenantAnnouncements';
import { TenantDocumentStatus, hasRequiredDocuments } from '@/portal/components/TenantDocumentStatus';
import { TenantStatusBadge } from '@features/tenants/components/badges/TenantStatusBadge';
import { tenantService } from '@features/tenants/api';
import { IdleRender } from '@/shared/performance';

const fmt = (n: any) => {
  const num = Number(n);
  return `₹${(Number.isFinite(num) ? num : 0).toLocaleString('en-IN')}`;
};

export function TenantDashboardPage() {
  const {
    profile,
    readModel,
    score,
    advance,
    moveOut,
    notifications,
    documents,
    agreementRenewal,
    renewalOffer,
  } = useTenantDashboard();

  const prof = profile?.profile as Record<string, unknown> | undefined;
  const tenant = profile?.tenant as Record<string, unknown> | undefined;
  const hostel = profile?.hostel as Record<string, unknown> | undefined;
  const ownerContact = profile?.owner_contact as Record<string, unknown> | undefined;
  const name = String(prof?.name ?? 'Tenant');
  const resStatus = profile?.reservation_status?.status ?? 'PAYMENT_PENDING';
  const status = String(tenant?.status ?? profile?.status ?? 'ACTIVE');
  const displayStatus = status === 'ACTIVE' ? resStatus : status;
  const roomNo = profile?.room?.room_no ?? profile?.room_no ?? null;
  const hostelName = String(hostel?.name ?? 'Sri Adithya Boys Hostel');
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
            <div className="flex flex-wrap gap-1.5 justify-end">
              {status === 'ACTIVE' ? (
                <>
                  <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 uppercase tracking-wide">
                    Account Active
                  </span>
                  <TenantStatusBadge status={resStatus} size="md" />
                </>
              ) : (
                <TenantStatusBadge status={status} size="md" />
              )}
            </div>
          </div>
        </div>
      </header>

      {profile && status !== 'FORMER_TENANT' && (
        <OnboardingProgressTracker profile={profile} />
      )}


      {status === 'FORMER_TENANT' && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-6 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Heart className="h-24 w-24 text-rose-500" />
          </div>
          <div className="relative space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              Farewell, Friend!
            </div>
            <h2 className="text-xl font-bold text-foreground leading-tight">
              Thank you for staying with us!
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
              You are no longer an active resident of <strong className="text-foreground">{hostelName}</strong>. 
              We are truly grateful for the time you spent with us and wish you the absolute best in all your future endeavors. 
              Your presence made our community warmer, and you will always be a part of our history!
            </p>
            {(tenant?.exit_date || profile?.tenant?.exit_date) && (
              <p className="text-xs text-muted-foreground">
                Departure Date: <strong className="text-foreground">{new Date(String(tenant?.exit_date || profile?.tenant?.exit_date)).toLocaleDateString('en-IN')}</strong>
              </p>
            )}
            <div className="pt-2 flex items-center gap-3">
              {ownerContact?.owner_email && (
                <a
                  href={`mailto:${ownerContact.owner_email}`}
                  className="inline-flex items-center gap-1.5 text-xs text-accent font-semibold hover:underline"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Contact Office
                </a>
              )}
              {ownerContact?.owner_phone && (
                <a
                  href={`tel:${ownerContact.owner_phone}`}
                  className="inline-flex items-center gap-1.5 text-xs text-accent font-semibold hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Call Support
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Prioritize Reservation Card if PAYMENT_PENDING */}
      {resStatus === 'PAYMENT_PENDING' && profile?.reservation_status && (
        <TenantReservationCard reservationStatus={profile.reservation_status} />
      )}

      {readModel ? (
        <TenantPriorityStrip readModel={readModel} moveOut={moveOut} />
      ) : (
        <TenantPrioritySkeleton />
      )}

      {/* Render Reservation Card here if NOT PAYMENT_PENDING */}
      {resStatus !== 'PAYMENT_PENDING' && profile?.reservation_status && (
        <TenantReservationCard reservationStatus={profile.reservation_status} />
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

      <TenantRenewalBanner
        renewal={agreementRenewal as Record<string, any> | undefined}
        offer={renewalOffer as Record<string, any> | undefined}
      />

      {/* My Stay Section */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-foreground">My Stay</h3>
        <div className={`grid gap-3 ${resStatus !== 'PAYMENT_PENDING' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {/* Current Room Card */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Current Room</p>
            <p className="mt-2 text-lg font-extrabold text-foreground">
              {roomNo ? `Room ${String(roomNo)}` : 'Pending Assignment'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Bed Allocation: Active</p>
          </div>

          {/* Move Out Card */}
          {resStatus !== 'PAYMENT_PENDING' && (
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
          )}
        </div>
      </section>

      {resStatus !== 'PAYMENT_PENDING' && (
        <IdleRender>
          <TenantScorePanel score={score} />
        </IdleRender>
      )}

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
                <p className="text-muted-foreground text-[10px] mb-0.5">Paid Security Deposit</p>
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

        {/* Quick-access Hostel Agreement download */}
        {(() => {
          const agreement = Array.isArray(profileDocs)
            ? (profileDocs as Record<string, unknown>[]).find(
                (d) => String(d.doc_type ?? '').toUpperCase() === 'RENTAL_AGREEMENT'
              )
            : null;
          if (!agreement?.download_url) return null;
          return (
            <a
              href={String(agreement.download_url)}
              target="_blank"
              rel="noreferrer"
              className="block rounded-2xl border border-accent/20 bg-gradient-to-r from-accent/5 to-card p-4 hover:border-accent/40 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <FileCheck2 className="w-5 h-5 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">Hostel Residency Agreement</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Signed &amp; ready for download</p>
                </div>
                <div className="flex items-center gap-1.5 text-accent font-semibold text-xs shrink-0">
                  <Download className="w-4 h-4" />
                  PDF
                </div>
              </div>
            </a>
          );
        })()}

        <TenantAnnouncements
          items={
            Array.isArray(notifications)
              ? notifications
              : (notifications as { notifications?: unknown[] })?.notifications
          }
        />

        <TenantActionCenter resStatus={resStatus} />
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

/**
 * Slim status banner + entry point to the dedicated `/tenant/renewal` page
 * (src/platforms/tenant/pages/TenantRenewalPage.tsx), which owns the full
 * review/accept/decline/discuss/sign flow. This banner's only job is to make
 * sure every renewal-relevant state is visible from the dashboard — including
 * "awaiting signature" and "signed", which previously had no UI at all once
 * an offer was accepted (both prior inline cards returned null in that gap).
 */
function TenantRenewalBanner({
  renewal,
  offer,
}: {
  renewal?: Record<string, any>;
  offer?: Record<string, any>;
}) {
  const draft = renewal?.renewal_draft as Record<string, any> | null | undefined;
  const decisionState = String(renewal?.decision_state || 'CURRENT');

  if (decisionState === 'MOVE_OUT_IN_PROGRESS') return null;

  let title: string | null = null;
  let tone: 'critical' | 'action' | 'info' = 'info';

  if (draft && draft.status !== 'SIGNED') {
    title = 'Sign your renewed agreement';
    tone = 'action';
  } else if (draft && draft.status === 'SIGNED') {
    title = 'Your agreement has been renewed';
    tone = 'info';
  } else if (offer && (offer.status === 'SENT' || offer.status === 'DRAFT')) {
    title = 'You have a new renewal offer to review';
    tone = 'action';
  } else if (decisionState !== 'CURRENT') {
    const isCritical = decisionState === 'RENEWAL_OVERDUE_CRITICAL' || decisionState === 'EXPIRED_AND_RENT_OVERDUE';
    title = isCritical ? 'Your agreement renewal is overdue' : 'Your agreement is expiring soon';
    tone = isCritical ? 'critical' : 'action';
  }

  if (!title) return null;

  const toneClasses =
    tone === 'critical'
      ? 'border-rose-200 bg-rose-50 text-rose-900'
      : tone === 'action'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-emerald-200 bg-emerald-50 text-emerald-900';

  return (
    <Link
      to="/tenant/renewal"
      className={`flex items-center justify-between gap-3 rounded-2xl border p-4 shadow-sm transition-opacity hover:opacity-90 ${toneClasses}`}
    >
      <div className="flex items-center gap-3">
        <FileCheck2 className="h-5 w-5 shrink-0" />
        <p className="text-sm font-bold">{title}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0" />
    </Link>
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



