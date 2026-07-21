import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@shared/ui';

export function ReviseOfferSheet({
  open,
  onOpenChange,
  offer,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: any;
  onSubmit: (data: { rent: string; deposit: string; duration: string; notes: string }) => void;
  isSubmitting: boolean;
}) {
  const [rent, setRent] = useState(String(offer?.proposed_rent || ''));
  const [deposit, setDeposit] = useState(String(offer?.proposed_security_deposit || ''));
  const [duration, setDuration] = useState(String(offer?.proposed_duration_months || '11'));
  const [notes, setNotes] = useState(offer?.owner_notes || '');

  const canSubmit = Boolean(rent && deposit && duration);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Revise Renewal Offer</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-4">
          <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <p className="font-bold text-foreground">Tenant: {offer?.tenant?.profiles?.name || 'Tenant'}</p>
            <p className="font-mono font-semibold text-muted-foreground">Current Status: {offer?.status}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-foreground">Revised Rent (₹) *</label>
              <input
                type="number"
                inputMode="numeric"
                value={rent}
                onChange={(e) => setRent(e.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground">Revised Security Deposit (₹) *</label>
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
            <label className="text-xs font-bold text-foreground">Revised Duration (Months) *</label>
            <input
              type="number"
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground">Revised Offer Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Tenant requested custom discount, agreed to ₹8,200 rent."
              className="mt-1 h-20 w-full resize-none rounded-lg border border-border bg-card p-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
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
            onClick={() => onSubmit({ rent, deposit, duration, notes })}
            disabled={isSubmitting || !canSubmit}
            className="flex h-11 items-center justify-center gap-1.5 rounded-lg bg-accent px-5 text-xs font-bold text-accent-foreground shadow-sm transition-all hover:bg-accent/90 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Revising...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Submit Revision
              </>
            )}
          </button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
