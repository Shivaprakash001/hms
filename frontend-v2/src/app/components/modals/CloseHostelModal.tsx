import { useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

interface CloseHostelModalProps {
  hostelId: string;
  hostelName: string;
  onClose: () => void;
  onConfirm: (hostelId: string, reason: string) => Promise<void>;
}

const PRESERVED = [
  'Payment history',
  'Receipts & invoices',
  'Expense records',
  'Tenant agreements',
  'Activity logs',
];

const STOPPED = [
  'Adding new tenants',
  'Generating monthly rent',
  'Managing rooms',
  'Sending payment reminders',
  'Appearing on your dashboard',
];

export function CloseHostelModal({
  hostelId,
  hostelName,
  onClose,
  onConfirm,
}: CloseHostelModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const canSubmit = reason.trim().length >= 3 && !isPending;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setError(null);
    setIsPending(true);
    try {
      await onConfirm(hostelId, reason.trim());
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ??
        err?.message ??
        'Something went wrong. Please try again.';
      // Surface the active-tenants guard from the backend trigger
      if (msg.toLowerCase().includes('active') && msg.toLowerCase().includes('tenant')) {
        setError('This hostel still has tenants with active beds. Move all tenants out before closing.');
      } else {
        setError(msg);
      }
      setIsPending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-lg bg-background rounded-t-2xl md:rounded-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4.5 h-4.5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-foreground truncate">
              Close "{hostelName}"?
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Closing this hostel will stop all day-to-day operations.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Preserved */}
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-900/15 p-4">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-2.5">
              ✓ You can still access:
            </p>
            <ul className="space-y-1.5">
              {PRESERVED.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Stopped */}
          <div className="rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-900/15 p-4">
            <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2.5">
              ✕ These will stop:
            </p>
            <ul className="space-y-1.5">
              {STOPPED.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <X className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Why are you closing this hostel?
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Hostel sold, Lease ended, Temporary shutdown..."
              rows={3}
              className="w-full rounded-xl border border-border bg-card px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive/30 resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Required. This helps you remember later why it was closed.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-border bg-card flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 text-sm text-muted-foreground border border-border rounded-xl hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="flex-1 py-3 bg-destructive text-destructive-foreground text-sm font-semibold rounded-xl disabled:opacity-50 transition-opacity active:scale-[0.98] touch-manipulation"
          >
            {isPending ? 'Closing…' : 'Close this hostel'}
          </button>
        </div>
      </div>
    </div>
  );
}
