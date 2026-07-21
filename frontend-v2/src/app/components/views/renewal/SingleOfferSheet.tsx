import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@shared/ui';
import { currentAgreementTerms, fmtDate } from './utils';

export function SingleOfferSheet({
  open,
  onOpenChange,
  row,
  availableRooms,
  onSubmit,
  isSubmitting,
  submittingLabel = 'Generating...',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: any;
  availableRooms: any[];
  onSubmit: (data: { selectedRoomId: string; rent: string; deposit: string; duration: string; notes: string }) => void;
  isSubmitting: boolean;
  submittingLabel?: string;
}) {
  const agreement = row?.current_agreement;

  if (!agreement) {
    return (
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <ResponsiveDialogContent className="sm:max-w-lg">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Create Custom Stay Offer</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody>
            <div className="space-y-3 rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-center">
              <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
              <div>
                <h3 className="text-sm font-bold text-destructive">No Active Agreement</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  This tenant does not have an active signed stay agreement. A renewal offer cannot be created without an active baseline.
                </p>
              </div>
            </div>
          </ResponsiveDialogBody>
          <ResponsiveDialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-11 rounded-lg border border-border bg-card px-4 text-xs font-bold text-foreground transition-all hover:bg-muted"
            >
              Close
            </button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
  }

  return (
    <SingleOfferForm
      open={open}
      onOpenChange={onOpenChange}
      row={row}
      agreement={agreement}
      availableRooms={availableRooms}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      submittingLabel={submittingLabel}
    />
  );
}

function SingleOfferForm({
  open,
  onOpenChange,
  row,
  agreement,
  availableRooms,
  onSubmit,
  isSubmitting,
  submittingLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: any;
  agreement: Record<string, any>;
  availableRooms: any[];
  onSubmit: (data: { selectedRoomId: string; rent: string; deposit: string; duration: string; notes: string }) => void;
  isSubmitting: boolean;
  submittingLabel: string;
}) {
  const current = currentAgreementTerms(agreement);
  const currentRoomId = row.tenant?.room?.id || row.tenant?.room_id || '';

  const [rent, setRent] = useState(String(current.rent || ''));
  const [deposit, setDeposit] = useState(String(current.deposit || ''));
  const [duration, setDuration] = useState(String(current.duration || '11'));
  const [notes, setNotes] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState(currentRoomId);

  const proposedRent = Number(rent || 0);
  const proposedDeposit = Number(deposit || 0);
  const proposedDuration = Number(duration || 0);
  const rentDiff = proposedRent - current.rent;
  const depositDiff = proposedDeposit - current.deposit;
  const durationDiff = proposedDuration - current.duration;

  const handleResetToCurrent = () => {
    setRent(String(current.rent));
    setDeposit(String(current.deposit));
    setDuration(String(current.duration));
  };

  const canSubmit = Boolean(rent && deposit && duration);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Create Custom Stay Offer</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tenant</p>
              <h4 className="text-sm font-bold text-foreground">{row.tenant?.name || 'Tenant'}</h4>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Current Room</p>
              <h4 className="text-sm font-bold text-foreground">Room {row.tenant?.room?.room_no || 'N/A'}</h4>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Current Agreement Summary</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Monthly Rent</span>
                <strong className="text-sm text-foreground">₹{current.rent.toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Deposit Held</span>
                <strong className="text-sm text-foreground">₹{current.deposit.toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Maintenance Charge</span>
                <strong className="text-foreground">
                  ₹{Number(agreement.contract?.maintenance ?? agreement.contract?.maintenance_charge ?? agreement.maintenance_charge ?? 0).toLocaleString('en-IN')}
                  {agreement.contract?.maintenance_type === 'MONTHLY' ? '/mo' : ''}
                </strong>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Duration</span>
                <strong className="text-foreground">{current.duration} months</strong>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Agreement Start</span>
                <strong className="text-foreground">{fmtDate(agreement.agreement_start_date)}</strong>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Agreement End</span>
                <strong className="text-foreground">{fmtDate(agreement.agreement_end_date)}</strong>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground">Room Assignment (Stay Location) *</label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="mt-1 h-11 w-full cursor-pointer rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {availableRooms.map((r: any) => {
                const occ = Number(r.occupied_count ?? 0);
                const cap = Number(r.capacity ?? 1);
                const floor = r.floor_name ? ` · ${r.floor_name}` : '';
                const isCurrent = r.id === currentRoomId;
                return (
                  <option key={r.id} value={r.id}>
                    {r.room_no}{floor} ({r.room_type || 'N/A'}) · {occ}/{cap} beds occupied {isCurrent ? '(Current Room)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="space-y-3.5 border-t border-border pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Proposed Renewal Offer Terms</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-foreground">Proposed Monthly Rent (₹) *</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={rent}
                  onChange={(e) => setRent(e.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-foreground">Proposed Security Deposit (₹) *</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-foreground">Proposed Duration (Months) *</label>
              <input
                type="number"
                inputMode="numeric"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground">Owner Notes / Custom Terms</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Discussed rent raise on call, agreed to premium room top-up."
                className="mt-1 h-20 w-full resize-none rounded-lg border border-border bg-card p-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Offer Comparison Summary</h3>
              <button type="button" onClick={handleResetToCurrent} className="flex items-center gap-1 text-xs font-bold text-accent hover:underline">
                <RefreshCw className="h-3.5 w-3.5" />
                Reset to Current
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <DeltaCard label="Rent Change" current={current.rent} proposed={proposedRent} diff={rentDiff} />
              <DeltaCard label="Deposit Change" current={current.deposit} proposed={proposedDeposit} diff={depositDiff} />
              <div className="space-y-1 rounded-xl border border-border bg-card p-3 text-center">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Duration</span>
                <div className="text-xs text-muted-foreground">{current.duration}m ➜ <strong className="text-foreground">{proposedDuration}m</strong></div>
                <div className="text-[10px] font-bold text-muted-foreground">
                  {durationDiff > 0 ? `+${durationDiff} months` : durationDiff < 0 ? `${durationDiff} months` : 'No Change'}
                </div>
              </div>
            </div>

            <div className={`rounded-xl border p-4 text-xs font-semibold ${
              depositDiff > 0
                ? 'border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300'
                : depositDiff < 0
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                : 'border-border bg-muted/40 text-muted-foreground'
            }`}>
              <div className="mb-1.5 flex items-center justify-between font-bold text-foreground">
                <span>Deposit Financial Action</span>
                <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                  {depositDiff > 0 ? 'Payment Action' : depositDiff < 0 ? 'Credit/Refund Action' : 'No Action'}
                </span>
              </div>
              <div className="space-y-1 font-medium text-muted-foreground">
                <div className="flex justify-between"><span>Current Deposit Held:</span><span className="font-bold text-foreground">₹{current.deposit.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between"><span>Proposed Deposit:</span><span className="font-bold text-foreground">₹{proposedDeposit.toLocaleString('en-IN')}</span></div>
                <div className="my-1.5 border-t border-dashed border-border" />
                <div className="flex justify-between font-bold text-foreground">
                  {depositDiff > 0 ? (
                    <>
                      <span className="text-amber-700 dark:text-amber-400">Tenant Top-up Required:</span>
                      <span className="text-sm font-extrabold text-amber-700 dark:text-amber-400">₹{depositDiff.toLocaleString('en-IN')}</span>
                    </>
                  ) : depositDiff < 0 ? (
                    <>
                      <span className="text-emerald-700 dark:text-emerald-400">Excess Refund / Credit to Account:</span>
                      <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">₹{Math.abs(depositDiff).toLocaleString('en-IN')}</span>
                    </>
                  ) : (
                    <>
                      <span>No Change in Deposit:</span>
                      <span>₹0</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-11 rounded-lg border border-border bg-card px-4 text-xs font-bold text-foreground transition-all hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit({ selectedRoomId, rent, deposit, duration, notes })}
            disabled={isSubmitting || !canSubmit}
            className="flex h-11 items-center justify-center gap-1.5 rounded-lg bg-accent px-5 text-xs font-bold text-accent-foreground shadow-sm transition-all hover:bg-accent/90 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {submittingLabel}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Generate Offer
              </>
            )}
          </button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function DeltaCard({ label, current, proposed, diff }: { label: string; current: number; proposed: number; diff: number }) {
  return (
    <div className="space-y-1 rounded-xl border border-border bg-card p-3 text-center">
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="text-xs text-muted-foreground">
        ₹{current.toLocaleString('en-IN')} ➜ <strong className="text-foreground">₹{proposed.toLocaleString('en-IN')}</strong>
      </div>
      <div className={`text-[10px] font-bold ${diff > 0 ? 'text-amber-600 dark:text-amber-400' : diff < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
        {diff > 0 ? `+₹${diff.toLocaleString('en-IN')}${current > 0 ? ` (+${((diff / current) * 100).toFixed(1)}%)` : ''}` : diff < 0 ? `-₹${Math.abs(diff).toLocaleString('en-IN')}` : 'No Change'}
      </div>
    </div>
  );
}
