import { Link } from 'react-router-dom';
import { ArrowRight, Edit3, Loader2, Send, RefreshCw } from 'lucide-react';
import { fmtDate, statusBadgeColor } from './utils';

export function RenewalOffersList({
  isLoading,
  isError,
  onRetry,
  offerRows,
  filteredOfferRows,
  offersFilter,
  filterOptions,
  onFilterChange,
  onSend,
  isSending,
  onResend,
  isResending,
  onRevise,
}: {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  offerRows: any[];
  filteredOfferRows: any[];
  offersFilter: string;
  filterOptions: [string, string][];
  onFilterChange: (v: string) => void;
  onSend: (offerId: string) => void;
  isSending: boolean;
  onResend: (offerId: string) => void;
  isResending: boolean;
  onRevise: (offer: any) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {filterOptions.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onFilterChange(id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-all sm:py-1.5 ${
                offersFilter === id
                  ? 'border-accent bg-accent text-accent-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-background to-transparent sm:hidden" />
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            Loading renewal offers pipeline...
          </div>
        ) : isError ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-foreground">Could not load active offers</p>
            <button type="button" onClick={onRetry} className="mt-2 text-xs font-bold text-accent">Retry</button>
          </div>
        ) : offerRows.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-foreground">No renewal offers generated yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Generate renewal offers from the 'Expiring Stays' tab.</p>
          </div>
        ) : filteredOfferRows.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-foreground">No offers matching status filter</p>
            <p className="mt-1 text-xs text-muted-foreground">Try clearing the status filter to see all active offers.</p>
            <button
              type="button"
              onClick={() => onFilterChange('ALL')}
              className="mt-3 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground transition-all hover:bg-muted"
            >
              Clear Filter
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredOfferRows.map((offer: any) => {
              const tenant = offer.tenant || {};
              const isDraft = offer.status === 'DRAFT';
              const isSent = offer.status === 'SENT';
              const isDeclined = offer.status === 'DECLINED';
              // An offer past its window is dead to the tenant whether or not
              // the lifecycle sweep has flipped it to EXPIRED yet — the owner
              // gets the same Resend action in both cases.
              const lapsedAt = offer.offer_expires_at ? new Date(offer.offer_expires_at) : null;
              const isExpired =
                offer.status === 'EXPIRED' ||
                ((isDraft || isSent) && Boolean(lapsedAt) && (lapsedAt as Date).getTime() <= Date.now());

              return (
                <article key={offer.id} className="p-4 transition-all hover:bg-muted/30 sm:p-5">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-foreground">{tenant.profiles?.name || 'Tenant'}</h3>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusBadgeColor(offer.status)}`}>
                        {offer.status}
                      </span>
                      {offer.is_custom_override && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400">
                          CUSTOM
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                      <div className="font-medium text-muted-foreground">
                        Rent: <span className="font-bold text-foreground">₹{Number(offer.current_rent).toLocaleString('en-IN')}</span>
                        <ArrowRight className="mx-1 inline-block h-3 w-3 text-muted-foreground" />
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{Number(offer.proposed_rent).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="font-medium text-muted-foreground">
                        Deposit: <span className="font-bold text-foreground">₹{Number(offer.current_security_deposit).toLocaleString('en-IN')}</span>
                        <ArrowRight className="mx-1 inline-block h-3 w-3 text-muted-foreground" />
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{Number(offer.proposed_security_deposit).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="col-span-full font-medium text-muted-foreground">
                        Timeline: <span className="font-semibold text-foreground">{fmtDate(offer.proposed_start_date)} - {fmtDate(offer.proposed_end_date)} ({offer.proposed_duration_months}m)</span>
                      </div>
                      {offer.offer_expires_at && (isSent || isExpired) && (
                        <div className="col-span-full font-medium text-muted-foreground">
                          {isExpired ? 'Expired on' : 'Responds by'}:{' '}
                          <span className={`font-semibold ${isExpired ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
                            {fmtDate(offer.offer_expires_at)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      {Number(offer.additional_deposit_required) > 0 && (
                        <span className="flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-amber-600 dark:text-amber-400">
                          Deposit Top-up: ₹{Number(offer.additional_deposit_required).toLocaleString('en-IN')}
                        </span>
                      )}
                      {Number(offer.deposit_refund_eligible) > 0 && (
                        <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
                          Refund Eligible: ₹{Number(offer.deposit_refund_eligible).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    {offer.owner_notes && (
                      <p className="rounded border border-border bg-muted p-2 text-xs text-muted-foreground">
                        <span className="font-bold text-foreground">Owner Note:</span> {offer.owner_notes}
                      </p>
                    )}
                    {offer.decline_reason && (
                      <p className="rounded border border-rose-200 bg-rose-500/5 p-2 text-xs text-rose-700">
                        <span className="font-bold">Decline Reason:</span> {offer.decline_reason}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2 sm:justify-end">
                    {isDraft && !isExpired && (
                      <button
                        onClick={() => onSend(offer.id)}
                        disabled={isSending}
                        className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-bold text-accent-foreground shadow-sm transition-all hover:bg-accent/90 disabled:opacity-60 sm:h-9 sm:flex-none"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Send Offer
                      </button>
                    )}
                    {isExpired && (
                      <button
                        onClick={() => onResend(offer.id)}
                        disabled={isResending}
                        className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-bold text-accent-foreground shadow-sm transition-all hover:bg-accent/90 disabled:opacity-60 sm:h-9 sm:flex-none"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Resend Offer
                      </button>
                    )}
                    {(isDraft || isSent || isDeclined || isExpired) && (
                      <button
                        onClick={() => onRevise(offer)}
                        className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-4 text-xs font-bold text-foreground transition-all hover:bg-muted sm:h-9 sm:flex-none"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Revise
                      </button>
                    )}
                    <Link
                      to={`/agreements/renewals/${offer.agreement_id}`}
                      className="flex h-11 flex-1 items-center justify-center rounded-lg border border-border bg-card px-4 text-xs font-bold text-foreground transition-all hover:bg-muted sm:h-9 sm:flex-none"
                    >
                      Workspace
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
