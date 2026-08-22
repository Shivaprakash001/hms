import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Edit3, FileText, Loader2, Plus, RefreshCw, Send, XCircle } from 'lucide-react';
import { agreementService } from '@features/agreements/api';
import {
  ResponsiveSheet,
  ResponsiveSheetContent,
  ResponsiveSheetHeader,
  ResponsiveSheetTitle,
  ResponsiveSheetDescription,
  ResponsiveSheetBody,
  ResponsiveSheetFooter,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@shared/ui';
import { fmtDate, initials, stageBadgeColor, stageLabel, statusBadgeColor } from './utils';

const READINESS_LABELS: Record<string, string> = {
  PREDECESSOR_NOT_RENEWABLE: 'Current agreement is not in a renewable status',
  INVALID_RENEWAL_CHAIN: 'Renewal chain is inconsistent',
  MOVE_OUT_IN_PROGRESS: 'A move-out is already in progress for this tenant',
  AGREEMENT_LIFECYCLE_INCOMPLETE: 'Agreement is missing required lifecycle details',
  SECURITY_DEPOSIT_UNPAID: 'Security deposit top-up is unpaid',
  AGREEMENT_SUCCESSOR_EXISTS: 'A renewal agreement already exists',
};

/**
 * Everything the standalone /agreements/renewals/:agreementId workspace page
 * used to show, as a slide-over beside the list instead of a separate screen.
 *
 * The heavy per-agreement payload (timeline, offer history, financials,
 * documents, readiness) is fetched lazily on open via the *existing*
 * getRenewalWorkspace endpoint — the list itself stays light, and that endpoint
 * needed no changes to be reused here.
 */
export function RenewalDetailSheet({
  row,
  open,
  onOpenChange,
  onCreateOffer,
  onSend,
  onResend,
  onRevise,
  busy,
}: {
  row: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateOffer: (row: any) => void;
  onSend: (row: any) => void;
  onResend: (row: any) => void;
  onRevise: (row: any) => void;
  busy: boolean;
}) {
  const [tab, setTab] = useState('timeline');
  const agreementId = row?.agreement_id;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['agreements', 'renewal-workspace', agreementId],
    queryFn: () => agreementService.getRenewalWorkspace(agreementId as string),
    enabled: Boolean(agreementId) && open,
    staleTime: 15_000,
  });

  const tenant = row?.tenant || {};
  const offer = row?.latest_offer;
  const urgency = row?.urgency || {};

  const successor = data?.successorAgreement;
  const offers = Array.isArray(data?.offers) ? data.offers : [];
  const timeline = Array.isArray(data?.timeline) ? data.timeline : [];
  const documents = Array.isArray(data?.documents) ? data.documents : [];
  const financial = data?.financial || {};
  const readiness = data?.readiness;

  const currentRent = Number(row?.agreement?.rent || 0);
  const currentDeposit = Number(row?.agreement?.security_deposit || 0);
  const proposedRent = successor ? Number(successor.contract_rent || 0) : offer ? Number(offer.proposed_rent || 0) : null;
  const proposedDeposit = successor ? Number(successor.contract_security_deposit || 0) : offer ? Number(offer.proposed_security_deposit || 0) : null;

  const hasAction = row?.can?.create_offer || row?.can?.send_offer || row?.can?.resend_offer || row?.can?.revise_offer;

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange}>
      <ResponsiveSheetContent>
        <ResponsiveSheetHeader>
          <div className="flex items-center gap-3 pr-8">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-extrabold text-primary">
              {initials(tenant.name)}
            </div>
            <div className="min-w-0">
              <ResponsiveSheetTitle className="truncate">{tenant.name || 'Tenant'}</ResponsiveSheetTitle>
              <ResponsiveSheetDescription>
                Room {tenant.room?.room_no || 'N/A'}
                {tenant.room?.floor_name ? ` · ${tenant.room.floor_name}` : ''}
                {' · '}Agreement v{row?.agreement?.agreement_version || 1}
              </ResponsiveSheetDescription>
            </div>
            <span className={`ml-auto shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${stageBadgeColor(row?.stage)}`}>
              {stageLabel(row?.stage)}
            </span>
          </div>
        </ResponsiveSheetHeader>

        <ResponsiveSheetBody className="space-y-4">
          {row?.stage_reason && (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">{row.stage_reason}</p>
          )}

          {/* Urgency, stated plainly and separately from the stage. */}
          {(urgency.overdue_rent?.count > 0 || urgency.contract_lapsed) && (
            <section className="space-y-1.5 rounded-xl border border-destructive/30 bg-destructive/[0.04] p-3">
              {urgency.contract_lapsed && (
                <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Agreement lapsed {fmtDate(row?.agreement?.agreement_end_date)}
                  {urgency.days_overdue > 0 ? ` · ${urgency.days_overdue} days ago` : ''}
                </p>
              )}
              {urgency.overdue_rent?.count > 0 && (
                <p className="flex items-center gap-1.5 text-xs font-bold text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Rent overdue ₹{Number(urgency.overdue_rent.amount || 0).toLocaleString('en-IN')} across {urgency.overdue_rent.count} month(s)
                </p>
              )}
            </section>
          )}

          {readiness && !readiness.ready && (
            <section className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/[0.04] p-3">
              <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                Blocking activation · {readiness.failures.length} issue{readiness.failures.length > 1 ? 's' : ''}
              </div>
              <ul className="space-y-1">
                {readiness.failures.map((f: any) => (
                  <li key={f.code} className="flex items-start gap-2 text-xs font-medium text-foreground">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                    {READINESS_LABELS[f.code] || f.reason}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {readiness?.ready && (
            <section className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Ready to activate — all readiness checks pass.
            </section>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-3">
              <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Current</h3>
              <CompareRow label="Rent" value={`₹${currentRent.toLocaleString('en-IN')}/mo`} />
              <CompareRow label="Deposit" value={`₹${currentDeposit.toLocaleString('en-IN')}`} />
              <CompareRow label="Ends" value={fmtDate(row?.agreement?.agreement_end_date)} />
            </div>
            <div className="rounded-xl border border-accent/30 bg-accent/[0.03] p-3">
              <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-accent">
                {successor ? 'Successor Agreement' : 'Proposed'}
              </h3>
              {proposedRent === null ? (
                <p className="text-xs text-muted-foreground">No offer generated yet.</p>
              ) : (
                <>
                  <CompareRow label="Rent" value={`₹${proposedRent.toLocaleString('en-IN')}/mo`} delta={proposedRent - currentRent} />
                  <CompareRow label="Deposit" value={`₹${(proposedDeposit || 0).toLocaleString('en-IN')}`} delta={(proposedDeposit || 0) - currentDeposit} />
                  {successor ? (
                    <CompareRow label="Starts" value={fmtDate(successor.agreement_start_date)} />
                  ) : (
                    <CompareRow
                      label={urgency.offer_expired_at ? 'Lapsed' : 'Responds by'}
                      value={fmtDate(urgency.offer_expired_at || urgency.offer_response_due || offer?.offer_expires_at)}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              Loading full history...
            </div>
          ) : isError ? (
            <div className="py-10 text-center">
              <p className="text-xs font-semibold text-foreground">Could not load this renewal's history</p>
              <button type="button" onClick={() => refetch()} className="mt-2 text-xs font-bold text-accent">Retry</button>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-border bg-card p-3">
                <h3 className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Financial Summary</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Total Due" value={`₹${Number(financial.total_due || 0).toLocaleString('en-IN')}`} tone={Number(financial.total_due) > 0 ? 'destructive' : 'default'} />
                  <Stat label="Overdue" value={`₹${Number(financial.overdue_amount || 0).toLocaleString('en-IN')}`} tone={Number(financial.overdue_amount) > 0 ? 'destructive' : 'default'} />
                  <Stat label="Deposit Held" value={`₹${Number(financial.security_deposit?.paid || 0).toLocaleString('en-IN')}`} />
                  <Stat label="Future Credit" value={`₹${Number(financial.future_rent_credit || 0).toLocaleString('en-IN')}`} />
                </div>
              </div>

              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="w-full overflow-x-auto scrollbar-hide">
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="offers">Offers {offers.length > 0 ? `(${offers.length})` : ''}</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                </TabsList>

                <TabsContent value="timeline">
                  {timeline.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">No events recorded yet.</p>
                  ) : (
                    <ol className="relative space-y-3 border-l border-border py-2 pl-5">
                      {[...timeline].reverse().map((event: any) => (
                        <li key={event.id} className="relative">
                          <span className="absolute -left-[1.44rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
                          <p className="text-xs font-bold text-foreground">
                            {event.event_type.replace(/_/g, ' ')}
                            {event.metadata?.resend ? ' · resent' : ''}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {new Date(event.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · by {event.actor_type}
                          </p>
                          {event.reason && <p className="mt-0.5 text-[11px] text-muted-foreground">{event.reason}</p>}
                        </li>
                      ))}
                    </ol>
                  )}
                </TabsContent>

                <TabsContent value="offers">
                  {offers.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">No offers generated yet.</p>
                  ) : (
                    <div className="divide-y divide-border rounded-xl border border-border">
                      {offers.map((o: any) => (
                        <div key={o.id} className="flex items-center justify-between gap-3 p-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadgeColor(o.status)}`}>{o.status}</span>
                              <span className="text-xs font-bold text-foreground">₹{Number(o.proposed_rent).toLocaleString('en-IN')}/mo</span>
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {fmtDate(o.proposed_start_date)} – {fmtDate(o.proposed_end_date)} ({o.proposed_duration_months}m)
                            </p>
                            {o.decline_reason && <p className="mt-0.5 text-[11px] text-rose-600 dark:text-rose-400">{o.decline_reason}</p>}
                          </div>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{fmtDate(o.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="documents">
                  {documents.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">No documents on file.</p>
                  ) : (
                    <div className="divide-y divide-border rounded-xl border border-border">
                      {documents.map((doc: any) => (
                        <div key={doc.id} className="flex items-center gap-3 p-3">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-foreground">{doc.doc_type}</p>
                            <p className="text-[11px] text-muted-foreground">{doc.document_status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}

          {tenant.id && data?.hostel?.id && (
            <Link
              to={`/hostels/${data.hostel.id}/tenants/${tenant.id}`}
              className="block rounded-lg border border-border bg-card px-3 py-2.5 text-center text-xs font-bold text-foreground hover:bg-muted"
            >
              View Tenant Profile
            </Link>
          )}
        </ResponsiveSheetBody>

        {hasAction && (
          <ResponsiveSheetFooter className="flex-row flex-wrap">
            {row.can.create_offer && (
              <SheetButton primary onClick={() => onCreateOffer(row)} icon={<Plus className="h-4 w-4" />}>Create Offer</SheetButton>
            )}
            {row.can.send_offer && (
              <SheetButton primary busy={busy} onClick={() => onSend(row)} icon={<Send className="h-4 w-4" />}>Send Offer</SheetButton>
            )}
            {row.can.resend_offer && (
              <SheetButton primary busy={busy} onClick={() => onResend(row)} icon={<RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />}>Resend Offer</SheetButton>
            )}
            {row.can.revise_offer && (
              <SheetButton onClick={() => onRevise(row)} icon={<Edit3 className="h-4 w-4" />}>Revise</SheetButton>
            )}
          </ResponsiveSheetFooter>
        )}
      </ResponsiveSheetContent>
    </ResponsiveSheet>
  );
}

function SheetButton({
  children,
  onClick,
  icon,
  primary = false,
  busy = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon?: React.ReactNode;
  primary?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-bold transition-all disabled:opacity-60 ${
        primary
          ? 'bg-accent text-accent-foreground shadow-sm hover:bg-accent/90'
          : 'border border-border bg-card text-foreground hover:bg-muted'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function CompareRow({ label, value, delta }: { label: string; value: React.ReactNode; delta?: number }) {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-bold text-foreground">
        {value}
        {typeof delta === 'number' && delta !== 0 && (
          <span className={`text-[10px] font-bold ${delta > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            ({delta > 0 ? '+' : ''}₹{delta.toLocaleString('en-IN')})
          </span>
        )}
      </span>
    </div>
  );
}

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'destructive' }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2.5">
      <p className={`text-sm font-extrabold tabular-nums ${tone === 'destructive' ? 'text-destructive' : 'text-foreground'}`}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
