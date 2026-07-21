import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2, Plus, ShieldAlert, Sparkles } from 'lucide-react';
import { fmtDate, initials, isCriticalState, stateLabel } from './utils';

type QueueFilter = 'all' | 'expiring' | 'expired' | 'overdue' | 'move_out';

export function RenewalQueueList({
  isLoading,
  isError,
  onRetry,
  rows,
  filter,
  filters,
  onFilterChange,
  roomNoFilter,
  roomNoOptions,
  onRoomNoFilterChange,
  roomTypeFilter,
  roomTypeOptions,
  onRoomTypeFilterChange,
  floorFilter,
  floorOptions,
  onFloorFilterChange,
  onCreateOffer,
  selectedIds,
  onToggleSelect,
  onSelectGroup,
  onClearSelection,
  onBulkGenerate,
}: {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  rows: any[];
  filter: QueueFilter;
  filters: [QueueFilter, string][];
  onFilterChange: (f: QueueFilter) => void;
  roomNoFilter: string;
  roomNoOptions: string[];
  onRoomNoFilterChange: (v: string) => void;
  roomTypeFilter: string;
  roomTypeOptions: string[];
  onRoomTypeFilterChange: (v: string) => void;
  floorFilter: string;
  floorOptions: string[];
  onFloorFilterChange: (v: string) => void;
  onCreateOffer: (row: any) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectGroup: (ids: string[], checked: boolean) => void;
  onClearSelection: () => void;
  onBulkGenerate: () => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
        Loading renewal queue stays...
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

  const attentionRows = rows.filter((row: any) => isCriticalState(row.decision_state));
  const standardRows = rows.filter((row: any) => !isCriticalState(row.decision_state));
  const attentionIds = attentionRows.map((r: any) => r.current_agreement?.id).filter(Boolean);
  const standardIds = standardRows.map((r: any) => r.current_agreement?.id).filter(Boolean);

  return (
    <div className="space-y-4 pb-16">
      <div className="relative">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {filters.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onFilterChange(id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-all sm:py-1.5 ${
                filter === id
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

      {(roomNoOptions.length > 0 || roomTypeOptions.length > 0 || floorOptions.length > 0) && (
        <div className="grid grid-cols-3 gap-2">
          <select
            value={roomNoFilter}
            onChange={(e) => onRoomNoFilterChange(e.target.value)}
            className="h-10 min-w-0 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-foreground"
          >
            <option value="all">All Rooms</option>
            {roomNoOptions.map((roomNo) => (
              <option key={roomNo} value={roomNo}>Room {roomNo}</option>
            ))}
          </select>
          <select
            value={roomTypeFilter}
            onChange={(e) => onRoomTypeFilterChange(e.target.value)}
            className="h-10 min-w-0 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-foreground"
          >
            <option value="all">All Room Types</option>
            {roomTypeOptions.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <select
            value={floorFilter}
            onChange={(e) => onFloorFilterChange(e.target.value)}
            className="h-10 min-w-0 rounded-lg border border-border bg-card px-2 text-xs font-semibold text-foreground"
          >
            <option value="all">All Floors</option>
            {floorOptions.map((floor) => (
              <option key={floor} value={floor}>{floor}</option>
            ))}
          </select>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card py-16 text-center">
          <p className="text-sm font-semibold text-foreground">No stays match these filters</p>
          <p className="mt-1 text-xs text-muted-foreground">Try clearing the room type or floor filter.</p>
        </div>
      ) : (
        <>
          {attentionRows.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <input
                  type="checkbox"
                  aria-label="Select all in Needs Your Attention"
                  checked={attentionIds.length > 0 && attentionIds.every((id) => selectedIds.has(id))}
                  onChange={(e) => onSelectGroup(attentionIds, e.target.checked)}
                  className="h-4 w-4 accent-accent"
                />
                <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                <h2 className="text-xs font-extrabold uppercase tracking-wide text-destructive">
                  Needs Your Attention · {attentionRows.length}
                </h2>
              </div>
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-destructive/30 bg-destructive/[0.03]">
                {attentionRows.map((row: any) => (
                  <QueueRow
                    key={row.current_agreement?.id}
                    row={row}
                    critical
                    onCreateOffer={onCreateOffer}
                    checked={selectedIds.has(row.current_agreement?.id)}
                    onToggle={() => onToggleSelect(row.current_agreement?.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {standardRows.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <input
                  type="checkbox"
                  aria-label="Select all in All Other Expiring Stays"
                  checked={standardIds.length > 0 && standardIds.every((id) => selectedIds.has(id))}
                  onChange={(e) => onSelectGroup(standardIds, e.target.checked)}
                  className="h-4 w-4 accent-accent"
                />
                {attentionRows.length > 0 && (
                  <h2 className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                    All Other Expiring Stays · {standardRows.length}
                  </h2>
                )}
              </div>
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {standardRows.map((row: any) => (
                  <QueueRow
                    key={row.current_agreement?.id}
                    row={row}
                    critical={false}
                    onCreateOffer={onCreateOffer}
                    checked={selectedIds.has(row.current_agreement?.id)}
                    onToggle={() => onToggleSelect(row.current_agreement?.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

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

function QueueRow({
  row,
  critical,
  onCreateOffer,
  checked,
  onToggle,
}: {
  row: any;
  critical: boolean;
  onCreateOffer: (row: any) => void;
  checked: boolean;
  onToggle: () => void;
}) {
  const agreement = row.current_agreement || {};
  const tenant = row.tenant || {};
  return (
    <article className="p-4 transition-all hover:bg-muted/30 sm:p-5">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`Select ${tenant.name || 'tenant'}`}
          className="mt-3 h-4 w-4 shrink-0 accent-accent"
        />
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-extrabold text-primary">
          {initials(tenant.name)}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-bold text-foreground">{tenant.name || 'Tenant'}</p>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${critical ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'}`}>
              {stateLabel(row.decision_state)}
            </span>
          </div>
          <p className="text-xs font-semibold text-muted-foreground">
            Room {tenant.room?.room_no || 'N/A'} ({tenant.room?.room_type || 'N/A'}){tenant.room?.floor_name ? ` · ${tenant.room.floor_name}` : ''} · Agreement v{agreement.agreement_version || 1} · Ends {fmtDate(agreement.agreement_end_date)}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground">
            <span>Rent: <strong className="text-foreground">₹{Number(agreement.contract?.rent ?? agreement.contract_rent ?? 0).toLocaleString('en-IN')}</strong></span>
            <span>Deposit: <strong className="text-foreground">₹{Number(agreement.contract?.security_deposit ?? agreement.contract_security_deposit ?? 0).toLocaleString('en-IN')}</strong></span>
          </div>
          {row.overdue_rent?.count > 0 && (
            <p className="flex items-center gap-1 text-xs font-bold text-rose-700 dark:text-rose-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              Overdue: ₹{Number(row.overdue_rent.amount || 0).toLocaleString('en-IN')} ({row.overdue_rent.count} mo)
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 sm:justify-end">
        <button
          onClick={() => onCreateOffer(row)}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-bold text-accent-foreground shadow-sm transition-all hover:bg-accent/90 sm:h-9 sm:flex-none"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Offer
        </button>
        <Link
          to={`/agreements/renewals/${agreement.id}`}
          className="flex h-11 flex-1 items-center justify-center rounded-lg border border-border bg-card px-4 text-xs font-bold text-foreground transition-all hover:bg-muted sm:h-9 sm:flex-none"
        >
          Workspace
        </Link>
      </div>
    </article>
  );
}
