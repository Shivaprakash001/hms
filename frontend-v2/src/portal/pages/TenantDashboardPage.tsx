import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, CreditCard, Phone, Mail, Loader2, Bell, Download, FileCheck2, Send, CalendarDays,
  CheckCircle2, XCircle, ShieldAlert, Smartphone, MessageSquare, BedDouble, User,
  Building2, Settings, IndianRupee, LogOut, CheckCircle, AlertTriangle, AlertCircle,
  Heart, Sparkles, MapPin
} from 'lucide-react';
import { toast } from 'sonner';
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
import { agreementService } from '@features/agreements/api';
import { IdleRender } from '@/shared/performance';

const fmt = (n: any) => {
  const num = Number(n);
  return `₹${(Number.isFinite(num) ? num : 0).toLocaleString('en-IN')}`;
};

export function TenantDashboardPage() {
  const queryClient = useQueryClient();
  const {
    profile,
    dues,
    payments,
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
  const renewalMutation = useMutation({
    mutationFn: (agreementId: string) => agreementService.createRenewalDraft(agreementId),
    onSuccess: () => {
      toast.success('Renewal draft created');
      queryClient.invalidateQueries({ queryKey: ['tenant', 'me', 'agreement-renewal'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || 'Unable to create renewal draft');
    },
  });

  const acceptOfferMutation = useMutation({
    mutationFn: (offerId: string) => agreementService.acceptRenewalOffer(offerId),
    onSuccess: () => {
      toast.success('Renewal offer accepted successfully! A draft agreement has been scheduled.');
      queryClient.invalidateQueries({ queryKey: ['tenant', 'me', 'renewal-offer'] });
      queryClient.invalidateQueries({ queryKey: ['tenant', 'me', 'profile'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || 'Unable to accept renewal offer');
    },
  });

  const declineOfferMutation = useMutation({
    mutationFn: ({ offerId, reason }: { offerId: string; reason: string }) => 
      agreementService.declineRenewalOffer(offerId, reason),
    onSuccess: () => {
      toast.success('Renewal offer declined.');
      queryClient.invalidateQueries({ queryKey: ['tenant', 'me', 'renewal-offer'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || 'Unable to decline renewal offer');
    },
  });

  const discussOfferMutation = useMutation({
    mutationFn: (offerId: string) => 
      agreementService.discussRenewalOffer(offerId, 'Let us discuss the renewal offer options.'),
    onSuccess: () => {
      toast.success('WhatsApp discussion request sent to owner!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || 'Unable to send discussion request');
    },
  });

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

      {dues ? (
        <TenantPriorityStrip dues={dues} payments={payments} moveOut={moveOut} />
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

      {renewalOffer ? (
        <TenantRenewalOfferCard
          offer={renewalOffer as Record<string, any>}
          onAccept={(id) => acceptOfferMutation.mutate(id)}
          onDecline={(id, reason) => declineOfferMutation.mutate({ offerId: id, reason })}
          onDiscuss={(id) => discussOfferMutation.mutate(id)}
          isAccepting={acceptOfferMutation.isPending}
          isDeclining={declineOfferMutation.isPending}
          isDiscussing={discussOfferMutation.isPending}
        />
      ) : (
        <TenantRenewalCard
          renewal={agreementRenewal as Record<string, unknown> | undefined}
          isCreating={renewalMutation.isPending}
          onRenew={(agreementId) => renewalMutation.mutate(agreementId)}
        />
      )}

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

function TenantRenewalCard({
  renewal,
}: {
  renewal?: Record<string, unknown>;
  isCreating?: boolean;
  onRenew?: (agreementId: string) => void;
}) {
  const state = String(renewal?.decision_state || 'CURRENT');
  const daysUntilExpiry = renewal?.days_until_expiry != null ? Number(renewal.days_until_expiry) : null;
  const daysOverdue = Number(renewal?.days_overdue || 0);

  if (!renewal || state === 'CURRENT') return null;

  const isCritical = state === 'RENEWAL_OVERDUE_CRITICAL' || state === 'EXPIRED_AND_RENT_OVERDUE';
  const isMoveOut = state === 'MOVE_OUT_IN_PROGRESS';
  const title = isMoveOut
    ? 'Move-out in progress'
    : state === 'EXPIRING_SOON' || (Array.isArray(renewal?.states) && (renewal.states as unknown[]).includes('EXPIRING_SOON'))
      ? `Agreement expires in ${daysUntilExpiry ?? 0} days`
      : isCritical
        ? 'Agreement renewal is overdue'
        : 'Agreement expired';
  const message = isMoveOut
    ? 'Renewal is paused while your move-out request is active.'
    : state === 'EXPIRING_SOON' || (Array.isArray(renewal?.states) && (renewal.states as unknown[]).includes('EXPIRING_SOON'))
      ? 'Hostel management is preparing stay extension offers. We will notify you once your renewal offer is ready.'
      : `Your agreement has expired. Please contact management to receive your renewal offer or request to move out${daysOverdue ? ` (${daysOverdue} days overdue)` : ''}.`;

  return (
    <section className={`rounded-2xl border p-4 shadow-sm ${isCritical ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isCritical ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-700'}`}>
          {isCritical ? <ShieldAlert className="w-5 h-5" /> : <CalendarDays className="w-5 h-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold ${isCritical ? 'text-rose-900' : 'text-amber-900'}`}>{title}</p>
          <p className={`mt-1 text-xs leading-relaxed ${isCritical ? 'text-rose-700' : 'text-amber-700'}`}>{message}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Link
          to="/tenant/move-out"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground shadow-sm hover:bg-slate-50 transition-colors"
        >
          Plan Move-out
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
    </section>
  );
}

function TenantRenewalOfferCard({
  offer,
  onAccept,
  onDecline,
  onDiscuss,
  isAccepting,
  isDeclining,
  isDiscussing,
}: {
  offer: Record<string, any>;
  onAccept: (id: string) => void;
  onDecline: (id: string, reason: string) => void;
  onDiscuss: (id: string) => void;
  isAccepting: boolean;
  isDeclining: boolean;
  isDiscussing: boolean;
}) {
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  if (!offer || (offer.status !== 'SENT' && offer.status !== 'DRAFT')) return null;

  const currentRent = Number(offer.current_rent ?? offer.agreement?.contract_rent ?? 0);
  const proposedRent = Number(offer.proposed_rent ?? 0);
  const rentDelta = proposedRent - currentRent;

  const currentDeposit = Number(offer.current_security_deposit ?? offer.agreement?.contract_security_deposit ?? 0);
  const proposedDeposit = Number(offer.proposed_security_deposit ?? 0);
  const depositHeld = Number(offer.deposit_held ?? currentDeposit);
  const additionalDeposit = Number(offer.additional_deposit_required ?? 0);

  const startDateFmt = offer.effective_from 
    ? new Date(offer.effective_from).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Next Period';

  const expiryDateFmt = offer.offer_expires_at
    ? new Date(offer.offer_expires_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'N/A';

  return (
    <section className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <FileCheck2 className="h-28 w-28 text-indigo-900" />
      </div>
      
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-700 flex items-center justify-center shrink-0">
          <FileCheck2 className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-600/10 text-indigo-700">
              Stay Renewal Offer
            </span>
            <h4 className="text-sm font-bold text-indigo-950 mt-1">Proposed Extension Terms</h4>
            <p className="text-xs text-indigo-900/70 mt-0.5">Please review the proposed terms for your upcoming contract period starting {startDateFmt}.</p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div className="bg-card rounded-xl p-3 border border-indigo-100/50 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current Rent</p>
              <p className="text-base font-extrabold text-foreground mt-0.5">{fmt(currentRent)}</p>
            </div>

            <div className="bg-card rounded-xl p-3 border border-indigo-100/50 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-900/70">New Rent</p>
              <p className="text-base font-extrabold text-indigo-950 mt-0.5">{fmt(proposedRent)}</p>
              {rentDelta !== 0 && (
                <p className={`text-[10px] font-semibold mt-0.5 ${rentDelta > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {rentDelta > 0 ? `+${fmt(rentDelta)}` : fmt(rentDelta)} change
                </p>
              )}
            </div>

            <div className="bg-card rounded-xl p-3 border border-indigo-100/50 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deposit Held</p>
              <p className="text-base font-extrabold text-foreground mt-0.5">{fmt(depositHeld)}</p>
            </div>

            <div className="bg-card rounded-xl p-3 border border-indigo-100/50 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-900/70">Additional Deposit</p>
              <p className="text-base font-extrabold text-indigo-950 mt-0.5">{fmt(additionalDeposit)}</p>
              {additionalDeposit > 0 ? (
                <p className="text-[10px] font-semibold text-rose-600 mt-0.5">
                  Top-up required
                </p>
              ) : (
                <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">
                  No top-up due
                </p>
              )}
            </div>
          </div>

          {/* Details list */}
          <div className="text-xs text-indigo-900/80 space-y-1 bg-white/40 rounded-xl p-3 max-w-md border border-indigo-100/20">
            <p>· Duration: <strong>{offer.proposed_duration_months} Months</strong></p>
            <p>· Offer Expires: <strong>{expiryDateFmt}</strong></p>
            {offer.owner_notes && (
              <div className="mt-2 bg-indigo-100/40 border-l-2 border-indigo-400 p-2.5 rounded-r-lg text-indigo-950 italic text-[11px]">
                &ldquo;{offer.owner_notes}&rdquo;
              </div>
            )}
          </div>

          {/* Revision history chain */}
          {offer.revisions && offer.revisions.length > 0 && (
            <div className="mt-4 pt-3 border-t border-indigo-100/50 max-w-md">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-900/60 mb-2">Offer Revision History</p>
              <div className="space-y-2 pl-2 border-l-2 border-indigo-200">
                {offer.revisions.map((rev: any, index: number) => {
                  const revNo = offer.revisions.length - index;
                  return (
                    <div key={rev.id} className="text-[11px] text-indigo-950/70">
                      <div className="flex items-center gap-1.5 font-semibold text-indigo-900">
                        <span>v{revNo}</span>
                        <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 uppercase tracking-wider scale-90">
                          {rev.status}
                        </span>
                      </div>
                      <div className="mt-0.5">
                        Rent: <span className="font-medium text-foreground">{fmt(rev.proposed_rent)}</span>,{' '}
                        Deposit: <span className="font-medium text-foreground">{fmt(rev.proposed_security_deposit)}</span>
                      </div>
                      {rev.updated_at && (
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Superseded on {new Date(rev.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!showDeclineForm ? (
            <div className="pt-2 flex flex-wrap items-center gap-2 max-w-md">
              <button
                type="button"
                disabled={isAccepting || isDeclining || isDiscussing}
                onClick={() => onAccept(offer.id)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors disabled:opacity-50 flex-1 justify-center min-w-[120px]"
              >
                {isAccepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Accept Offer
              </button>

              <button
                type="button"
                disabled={isAccepting || isDeclining || isDiscussing}
                onClick={() => onDiscuss(offer.id)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-transparent bg-indigo-600/10 hover:bg-indigo-600/20 px-4 py-2.5 text-xs font-bold text-indigo-950 transition-colors disabled:opacity-50 flex-1 justify-center min-w-[150px]"
              >
                {isDiscussing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                Request Discussion
              </button>

              <Link
                to="/tenant/move-out"
                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-card hover:bg-indigo-50/50 px-4 py-2.5 text-xs font-bold text-indigo-900 shadow-sm transition-colors flex-1 justify-center min-w-[120px]"
              >
                Plan Move-out
                <ArrowRight className="h-4 w-4 text-indigo-600/70" />
              </Link>

              <button
                type="button"
                disabled={isAccepting || isDeclining || isDiscussing}
                onClick={() => setShowDeclineForm(true)}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors underline underline-offset-4 ml-1 mt-1 animate-fadeIn"
              >
                Decline Offer
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-indigo-100/50 space-y-2 max-w-md">
              <p className="text-xs font-semibold text-indigo-950">Why are you declining this offer?</p>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="E.g., rent increase is too high, plan to vacate, room category change needed..."
                className="w-full min-h-[70px] rounded-xl border border-indigo-200 bg-card p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeclineForm(false);
                    setDeclineReason('');
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold text-indigo-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!declineReason.trim() || isDeclining}
                  onClick={() => onDecline(offer.id, declineReason)}
                  className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {isDeclining ? <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> : null}
                  Confirm Decline
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
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



