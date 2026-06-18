import { useState } from 'react';
import { PauseCircle, X } from 'lucide-react';

interface PauseHostelModalProps {
  hostelId: string;
  hostelName: string;
  onClose: () => void;
  onConfirm: (hostelId: string) => Promise<void>;
}

export function PauseHostelModal({
  hostelId,
  hostelName,
  onClose,
  onConfirm,
}: PauseHostelModalProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsPending(true);
    setError(null);
    try {
      await onConfirm(hostelId);
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
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <PauseCircle className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-foreground truncate">
              Temporarily close "{hostelName}"?
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
        <div className="px-5 py-5 space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            This hostel will be paused. No new rent will be generated and it
            will appear as "Temporarily Closed" on your dashboard.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You can resume operations at any time.
          </p>

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
            className="flex-1 py-3 bg-amber-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-opacity active:scale-[0.98] touch-manipulation"
          >
            {isPending ? 'Pausing…' : 'Temporarily close'}
          </button>
        </div>
      </div>
    </div>
  );
}
