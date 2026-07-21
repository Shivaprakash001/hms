import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, Loader2, XCircle } from 'lucide-react';
import { agreementService } from '@features/agreements/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@shared/ui';
import { fmtDate, initials, statusBadgeColor } from './renewal/utils';

const READINESS_LABELS: Record<string, string> = {
  PREDECESSOR_NOT_RENEWABLE: 'Current agreement is not in a renewable status',
  INVALID_RENEWAL_CHAIN: 'Renewal chain is inconsistent',
  MOVE_OUT_IN_PROGRESS: 'A move-out is already in progress for this tenant',
  AGREEMENT_LIFECYCLE_INCOMPLETE: 'Agreement is missing required lifecycle details',
  SECURITY_DEPOSIT_UNPAID: 'Security deposit top-up is unpaid',
  AGREEMENT_SUCCESSOR_EXISTS: 'A renewal agreement already exists',
};

export function RenewalWorkspaceView() {
  const { agreementId } = useParams<{ agreementId: string }>();
  const [tab, setTab] = useState('timeline');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['agreements', 'renewal-workspace', agreementId],
    queryFn: () => agreementService.getRenewalWorkspace(agreementId as string),
    enabled: Boolean(agreementId),
    staleTime: 15_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
        Loading renewal workspace...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm font-semibold text-foreground">Could not load this renewal</p>
        <button type="button" onClick={() => refetch()} className="mt-2 text-xs font-bold text-accent">Retry</button>
      </div>
    );
  }

  const agreement = data.agreement || {};
  const successor = data.successorAgreement;
  const tenant = data.tenant || {};
  const financial = data.financial || {};
  const latestOffer = data.latestOffer;
  const offers = Array.isArray(data.offers) ? data.offers : [];
  const timeline = Array.isArray(data.timeline) ? data.timeline : [];
  const documents = Array.isArray(data.documents) ? data.documents : [];
  const readiness = data.readiness;

  const currentRent = Number(agreement.contract_rent || 0);
  const currentDeposit = Number(agreement.contract_security_deposit || 0);
  const proposedRent = successor ? Number(successor.contract_rent || 0) : latestOffer ? Number(latestOffer.proposed_rent || 0) : null;
  const proposedDeposit = successor ? Number(successor.contract_security_deposit || 0) : latestOffer ? Number(latestOffer.proposed_security_deposit || 0) : null;

  return (
    <div className="space-y-4 px-4 py-4 sm:px-0 sm:py-0">
      <Link to="/agreements/renewals" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Renewal Pipeline
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-base font-extrabold text-primary">
            {initials(tenant.name)}
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">{tenant.name || 'Tenant'}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {tenant.room && <span>Room {tenant.room.room_no}{tenant.room.room_type ? ` · ${tenant.room.room_type}` : ''}</span>}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadgeColor(agreement.status)}`}>{agreement.status}</span>
            </div>
          </div>
        </div>
        {tenant.id && (
          <Link
            to={`/hostels/${data.hostel?.id}/tenants/${tenant.id}`}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold text-foreground hover:bg-muted"
          >
            View Tenant Profile
          </Link>
        )}
      </header>

      {readiness && !readiness.ready && (
        <section className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/[0.04] p-4">
          <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            Blocking Activation · {readiness.failures.length} issue{readiness.failures.length > 1 ? 's' : ''}
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
      {readiness && readiness.ready && (
        <section className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Ready to activate — all readiness checks pass.
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Current Agreement</h3>
          <CompareRow label="Rent" value={`₹${currentRent.toLocaleString('en-IN')}/mo`} />
          <CompareRow label="Deposit Held" value={`₹${currentDeposit.toLocaleString('en-IN')}`} />
          <CompareRow label="Duration" value={agreement.agreement_duration_months ? `${agreement.agreement_duration_months} months` : '—'} />
          <CompareRow label="Ends" value={fmtDate(agreement.agreement_end_date)} />
        </div>
        <div className="rounded-xl border border-accent/30 bg-accent/[0.03] p-4">
          <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-accent">{successor ? 'Successor Agreement' : 'Latest Offer'}</h3>
          {proposedRent === null ? (
            <p className="text-xs text-muted-foreground">No offer has been generated yet.</p>
          ) : (
            <>
              <CompareRow label="Rent" value={`₹${proposedRent.toLocaleString('en-IN')}/mo`} delta={proposedRent - currentRent} />
              <CompareRow label="Deposit" value={`₹${(proposedDeposit || 0).toLocaleString('en-IN')}`} delta={(proposedDeposit || 0) - currentDeposit} />
              {!successor && latestOffer && (
                <CompareRow label="Offer Status" value={<span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadgeColor(latestOffer.status)}`}>{latestOffer.status}</span>} />
              )}
              {successor && <CompareRow label="Starts" value={fmtDate(successor.agreement_start_date)} />}
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">Financial Summary</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total Due" value={`₹${Number(financial.total_due || 0).toLocaleString('en-IN')}`} tone={Number(financial.total_due) > 0 ? 'destructive' : 'default'} />
          <Stat label="Overdue" value={`₹${Number(financial.overdue_amount || 0).toLocaleString('en-IN')}`} tone={Number(financial.overdue_amount) > 0 ? 'destructive' : 'default'} />
          <Stat label="Deposit Held" value={`₹${Number(financial.security_deposit?.paid || 0).toLocaleString('en-IN')}`} />
          <Stat label="Future Credit" value={`₹${Number(financial.future_rent_credit || 0).toLocaleString('en-IN')}`} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full overflow-x-auto scrollbar-hide">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="offers">Offer History</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          {timeline.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">No events recorded yet.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-border py-2 pl-5">
              {[...timeline].reverse().map((event: any) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[1.44rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
                  <p className="text-xs font-bold text-foreground">{event.event_type.replace(/_/g, ' ')}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {new Date(event.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · by {event.actor_type}
                  </p>
                  {event.reason && <p className="mt-1 text-xs text-muted-foreground">{event.reason}</p>}
                </li>
              ))}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="offers">
          {offers.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">No offers generated for this agreement yet.</p>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {offers.map((offer: any) => (
                <div key={offer.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusBadgeColor(offer.status)}`}>{offer.status}</span>
                      <span className="text-xs font-bold text-foreground">₹{Number(offer.proposed_rent).toLocaleString('en-IN')}/mo</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{fmtDate(offer.proposed_start_date)} – {fmtDate(offer.proposed_end_date)} ({offer.proposed_duration_months}m)</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{fmtDate(offer.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents">
          {documents.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">No documents on file.</p>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {documents.map((doc: any) => (
                <div key={doc.id} className="flex items-center gap-3 p-4">
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
    </div>
  );
}

function CompareRow({ label, value, delta }: { label: string; value: React.ReactNode; delta?: number }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs">
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
    <div className="rounded-lg bg-muted/50 p-3">
      <p className={`text-sm font-extrabold tabular-nums ${tone === 'destructive' ? 'text-destructive' : 'text-foreground'}`}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
