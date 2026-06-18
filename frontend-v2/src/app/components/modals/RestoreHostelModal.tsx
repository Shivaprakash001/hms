import { useState } from 'react';
import { RotateCcw, X } from 'lucide-react';

interface RestoreHostelModalProps {
  hostelId: string;
  hostelName: string;
  archivedAt?: string | null;
  archiveReason?: string | null;
  onClose: () => void;
  onConfirm: (hostelId: string, targetStatus: 'ACTIVE' | 'INACTIVE') => Promise<void>;
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export function RestoreHostelModal({
  hostelId,
  hostelName,
  archivedAt,
  archiveReason,
  onClose,
  onConfirm,
}: RestoreHostelModalProps) {
  const [targetStatus, setTargetStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsPending(true);
    setError(null);
    try {
      await onConfirm(hostelId, targetStatus);
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ??
        err?.message ??
        'Something went wrong. Please try again.'
      );
      setIsPending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-md bg-background rounded-t-2xl md:rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
            <RotateCcw className="w-4.5 h-4.5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-foreground truncate">
              Restore "{hostelName}"?
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-5">
          {/* Archive context */}
          {(archivedAt || archiveReason) && (
            <div className="rounded-xl bg-secondary/50 p-3.5 space-y-1">
              {archivedAt && (
                <p className="text-xs text-muted-foreground">
                  Closed on <span className="text-foreground font-medium">{formatDate(archivedAt)}</span>
                </p>
              )}
              {archiveReason && (
                <p className="text-xs text-muted-foreground">
                  Reason: <span className="text-foreground font-medium">{archiveReason}</span>
                </p>
              )}
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            How would you like to restore it?
          </p>

          {/* Radio options */}
          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
            {/* Running */}
            <label
              className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${
                targetStatus === 'ACTIVE' ? 'bg-accent/5' : 'hover:bg-secondary/50'
              }`}
            >
              <input
                type="radio"
                name="restoreStatus"
                value="ACTIVE"
                checked={targetStatus === 'ACTIVE'}
                onChange={() => setTargetStatus('ACTIVE')}
                className="mt-0.5 w-4 h-4 accent-[hsl(var(--accent))] shrink-0"
              />
              <div>
                <p className="text-sm font-semibold text-foreground">Running</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Resume full operations
                </p>
              </div>
            </label>

            {/* Temporarily Closed */}
            <label
              className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${
                targetStatus === 'INACTIVE' ? 'bg-accent/5' : 'hover:bg-secondary/50'
              }`}
            >
              <input
                type="radio"
                name="restoreStatus"
                value="INACTIVE"
                checked={targetStatus === 'INACTIVE'}
                onChange={() => setTargetStatus('INACTIVE')}
                className="mt-0.5 w-4 h-4 accent-[hsl(var(--accent))] shrink-0"
              />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Temporarily Closed
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Keep operations paused but make it visible on dashboard
                </p>
              </div>
            </label>
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border bg-card flex gap-3">
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
            disabled={isPending}
            className="flex-1 py-3 bg-accent text-accent-foreground text-sm font-semibold rounded-xl disabled:opacity-50 transition-opacity active:scale-[0.98] touch-manipulation"
          >
            {isPending ? 'Restoring…' : 'Restore hostel'}
          </button>
        </div>
      </div>
    </div>
  );
}
