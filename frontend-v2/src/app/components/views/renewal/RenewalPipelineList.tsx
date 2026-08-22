import { AlertTriangle, ArrowRight, ChevronRight, Clock, Edit3, Loader2, LogOut, Plus, RefreshCw, Send, ShieldAlert, Sparkles } from 'lucide-react';
import { daysUntil, expiryPhrase, fmtDate, initials, needsOwnerAction, stageBadgeColor, stageLabel } from './utils';

/**
 * One row per agreement covering the whole renewal lifecycle — the merged
 * replacement for the old Expiring Stays + Offers Pipeline tabs, which each
 * rendered half of the same tenant with a different status vocabulary.
 *
 * The row shows `stage` (where the renewal actually is) as the headline badge
 * and urgency (lapsed contract, overdue rent, response window) as separate
 * chips. Action buttons come from the server's `can` flags rather than being
 * re-derived here, so the UI can no longer offer a button whose endpoint will
 * reject it.
 */
export function RenewalPipelineList({
  isLoading,
  isError,
  onRetry,
  rows,
  selectedIds,
  onToggleSelect,
  onSelectGroup,
  onClearSelection,
  onBulkGenerate,
  onOpenDetail,
  onCreateOffer,
  onSend,
  onResend,
  onRevise,
  busyAgreementId,
}: {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  rows: any[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectGroup: (ids: string[], checked: boolean) => void;
  onClearSelection: () => void;
  onBulkGenerate: () => void;
  onOpenDetail: (row: any) => void;
  onCreateOffer: (row: any) => void;
  onSend: (row: any) => void;
  onResend: (row: any) => void;
  onRevise: (row: any) => void;
  busyAgreementId: string | null;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
        Loading renewals...
      </div>
    );
  }
  if (isError) {
    return (
      <div className="rounded-xl border border-border bg-card py-16 text-center">
        <p className="text-sm font-semibold text-foreground">Could not load renewals</p>
        <button type="button" onClick={onRetry} className="mt-2 text-xs font-bold text-accent">Retry</button>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card py-16 text-center">
        <p className="text-sm font-semibold text-foreground">Nothing here</p>
        <p className="mt-1 text-xs text-muted-foreground">No renewals match the current stage and room filters.</p>
      </div>
    );
  }

  const actionRows = rows.filter((row: any) => needsOwnerAction(row.stage));
  const waitingRows = rows.filter((row: any) => !needsOwnerAction(row.stage));
  // Only rows that can actually take a new offer are bulk-selectable — the old
  // list let you select anything and then failed per-row inside the campaign.
  const selectableIds = (list: any[]) => list.filter((r: any) => r.can?.create_offer).map((r: any) => r.agreement_id);

  return (
    <div className="space-y-5 pb-24">
      <Group
        title="Needs you"
        count={actionRows.length}
        tone="action"
        rows={actionRows}
        selectableIds={selectableIds(actionRows)}
        selectedIds={selectedIds}
        onSelectGroup={onSelectGroup}
        onToggleSelect={onToggleSelect}
        onOpenDetail={onOpenDetail}
        onCreateOffer={onCreateOffer}
        onSend={onSend}
        onResend={onResend}
        onRevise={onRevise}
        busyAgreementId={busyAgreementId}
      />
      <Group
        title="Waiting on tenant"
        count={waitingRows.length}
        tone="waiting"
        rows={waitingRows}
        selectableIds={selectableIds(waitingRows)}
        selectedIds={selectedIds}
        onSelectGroup={onSelectGroup}
        onToggleSelect={onToggleSelect}
        onOpenDetail={onOpenDetail}
        onCreateOffer={onCreateOffer}
        onSend={onSend}
        onResend={onResend}
        onRevise={onRevise}
        busyAgreementId={busyAgreementId}
      />

      {selectedIds.size > 0 && (
        <div className="fixed inset-x-4 bottom-20 z-30 flex items-center justify-between gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-lg sm:sticky sm:bottom-4 sm:inset-x-auto">
          <span className="text-sm font-bold">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClearSelection} className="rounded-lg px-3 py-2 text-xs font-bold text-primary-foreground/80 hover:text-primary-foreground">
              Clear
            </button>
            <button
              type="button"
              onClick={onBulkGenerate}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-accent-foreground shadow-sm hover:bg-accent/90"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate Offers
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Group({
  title,
  count,
  tone,
  rows,
  selectableIds,
  selectedIds,
  onSelectGroup,
  ...rowProps
}: any) {
  if (rows.length === 0) return null;
  const allSelected = selectableIds.length > 0 && selectableIds.every((id: string) => selectedIds.has(id));

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        {selectableIds.length > 0 && (
          <input
            type="checkbox"
            aria-label={`Select all in ${title}`}
            checked={allSelected}
            onChange={(e) => onSelectGroup(selectableIds, e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
        )}
        {tone === 'action' ? (
          <ShieldAlert className="h-3.5 w-3.5 text-accent" />
        ) : (
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <h2 className={`text-xs font-extrabold uppercase tracking-wide ${tone === 'action' ? 'text-accent' : 'text-muted-foreground'}`}>
          {title} · {count}
        </h2>
      </div>
      <div className={`divide-y divide-border overflow-hidden rounded-xl border bg-card ${tone === 'action' ? 'border-accent/30' : 'border-border'}`}>
        {rows.map((row: any) => (
          <PipelineRow
            key={row.agreement_id}
            row={row}
            checked={selectedIds.has(row.agreement_id)}
            selectable={Boolean(row.can?.create_offer)}
            {...rowProps}
          />
        ))}
      </div>
    </section>
  );
}

function PipelineRow({
  row,
  checked,
  selectable,
  onToggleSelect,
  onOpenDetail,
  onCreateOffer,
  onSend,
  onResend,
  onRevise,
  busyAgreementId,
}: any) {
  const tenant = row.tenant || {};
  const agreement = row.agreement || {};
  const offer = row.latest_offer;
  const urgency = row.urgency || {};
  const busy = busyAgreementId === row.agreement_id;
  const respondInDays = daysUntil(urgency.offer_response_due);
  const expiry = expiryPhrase(row);

  return (
    <article className="transition-all hover:bg-muted/30">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        {selectable ? (
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggleSelect(row.agreement_id)}
            aria-label={`Select ${tenant.name || 'tenant'}`}
            className="mt-3 h-4 w-4 shrink-0 accent-accent"
          />
        ) : (
          <span className="mt-3 h-4 w-4 shrink-0" aria-hidden />
        )}

        <button
          type="button"
          onClick={() => onOpenDetail(row)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-extrabold text-primary">
            {initials(tenant.name)}
          </span>
          <span className="min-w-0 flex-1 space-y-1.5">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-base font-bold text-foreground">{tenant.name || 'Tenant'}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${stageBadgeColor(row.stage)}`}>
                {stageLabel(row.stage)}
              </span>
            </span>

            <span className="block text-xs font-semibold text-muted-foreground">
              Room {tenant.room?.room_no || 'N/A'}
              {tenant.room?.room_type ? ` (${tenant.room.room_type})` : ''}
              {tenant.room?.floor_name ? ` · ${tenant.room.floor_name}` : ''}
              {' · '}v{agreement.agreement_version || 1} · Ends {fmtDate(agreement.agreement_end_date)}
            </span>

            {/* Terms: current, and the proposal once one exists. */}
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground">
              <span>
                Rent: <strong className="text-foreground">₹{Number(agreement.rent || 0).toLocaleString('en-IN')}</strong>
                {offer && (
                  <>
                    <ArrowRight className="mx-1 inline-block h-3 w-3" />
                    <strong className="text-emerald-600 dark:text-emerald-400">₹{Number(offer.proposed_rent).toLocaleString('en-IN')}</strong>
                  </>
                )}
              </span>
              <span>
                Deposit: <strong className="text-foreground">₹{Number(agreement.security_deposit || 0).toLocaleString('en-IN')}</strong>
                {offer && (
                  <>
                    <ArrowRight className="mx-1 inline-block h-3 w-3" />
                    <strong className="text-emerald-600 dark:text-emerald-400">₹{Number(offer.proposed_security_deposit).toLocaleString('en-IN')}</strong>
                  </>
                )}
              </span>
            </span>

            {/* Urgency chips — deliberately separate from the stage badge. */}
            <span className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {urgency.overdue_rent?.count > 0 && (
                <Chip tone="danger" icon={<AlertTriangle className="h-3 w-3" />}>
                  Overdue ₹{Number(urgency.overdue_rent.amount || 0).toLocaleString('en-IN')} ({urgency.overdue_rent.count} mo)
                </Chip>
              )}
              {expiry && <Chip tone={urgency.past_grace_period ? 'danger' : 'warn'}>{expiry}</Chip>}
              {respondInDays !== null && respondInDays >= 0 && (
                <Chip tone={respondInDays <= 3 ? 'warn' : 'muted'} icon={<Clock className="h-3 w-3" />}>
                  {respondInDays === 0 ? 'Responds by today' : `${respondInDays}d to respond`}
                </Chip>
              )}
              {urgency.offer_expired_at && <Chip tone="warn">Lapsed {fmtDate(urgency.offer_expired_at)}</Chip>}
              {Number(offer?.additional_deposit_required) > 0 && (
                <Chip tone="warn">Top-up ₹{Number(offer.additional_deposit_required).toLocaleString('en-IN')}</Chip>
              )}
              {urgency.move_out && (
                <Chip tone="muted" icon={<LogOut className="h-3 w-3" />}>Move-out {urgency.move_out.status}</Chip>
              )}
              {row.offers_count > 1 && <Chip tone="muted">{row.offers_count} offers</Chip>}
            </span>

            {row.stage_reason && (
              <span className="block pt-0.5 text-[11px] font-medium text-muted-foreground">{row.stage_reason}</span>
            )}
          </span>
          <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-4 sm:justify-end sm:px-5">
        {row.can?.create_offer && (
          <RowButton primary onClick={() => onCreateOffer(row)} icon={<Plus className="h-3.5 w-3.5" />}>Create Offer</RowButton>
        )}
        {row.can?.send_offer && (
          <RowButton primary busy={busy} onClick={() => onSend(row)} icon={<Send className="h-3.5 w-3.5" />}>Send Offer</RowButton>
        )}
        {row.can?.resend_offer && (
          <RowButton primary busy={busy} onClick={() => onResend(row)} icon={<RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />}>Resend</RowButton>
        )}
        {row.can?.revise_offer && (
          <RowButton onClick={() => onRevise(row)} icon={<Edit3 className="h-3.5 w-3.5" />}>Revise</RowButton>
        )}
        <RowButton onClick={() => onOpenDetail(row)}>Details</RowButton>
      </div>
    </article>
  );
}

function Chip({ tone, icon, children }: { tone: 'danger' | 'warn' | 'muted'; icon?: React.ReactNode; children: React.ReactNode }) {
  const tones = {
    danger: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
    warn: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    muted: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold ${tones[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

function RowButton({
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
      className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-bold transition-all disabled:opacity-60 sm:h-9 sm:flex-none ${
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
