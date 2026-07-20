import { useState } from 'react';
import { X, Undo2, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { ErrorCard } from '@/shared/ui/error/ErrorCard';
import { getHmsError } from '@lib/errors';
import { recoveryService, type CorrectionCase } from '@features/recovery/api';

interface CorrectPaymentModalProps {
  paymentId: string;
  hostelId: string;
  tenantId: string;
  onClose: () => void;
}

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

/**
 * Reverse-only "Correct Payment" flow: reason → preview → confirm
 * (validate + execute treated as one logical confirm step).
 *
 * Consumes the already-built `/api/recovery/cases/*` Correction Case
 * platform. Transfer and Edit Reference/Notes corrections are out of scope
 * for this modal — see docs/business-logic for the follow-up plan.
 */
export function CorrectPaymentModal({ paymentId, hostelId, tenantId, onClose }: CorrectPaymentModalProps) {
  const [reason, setReason] = useState('');
  const [kase, setKase] = useState<CorrectionCase | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<unknown>(null);

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    setApiError(null);

    if (!reason.trim()) {
      setFieldError('Enter a reason for this correction.');
      return;
    }

    setIsPreviewing(true);
    try {
      const created = await recoveryService.createCase({
        hostelId,
        caseType: 'PAYMENT_REVERSAL',
        reason: reason.trim(),
        input: { paymentId },
      });
      setKase(created);
    } catch (err) {
      setApiError(err);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleEditReason = () => {
    setKase(null);
    setApiError(null);
    setSucceeded(false);
  };

  const handleConfirm = async () => {
    if (!kase || isConfirming) return;
    setApiError(null);
    setIsConfirming(true);
    try {
      // Treat validate + execute as one logical "confirm" step. If validate
      // rejects (422 — e.g. already reversed, payment gone), the throw here
      // stops us before execute() is ever called.
      await recoveryService.validate(kase.id);
      await recoveryService.execute(kase.id);
      setSucceeded(true);
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setApiError(err);
    } finally {
      setIsConfirming(false);
    }
  };

  const previewImpact = kase?.previewImpact ?? null;
  const isBusy = isPreviewing || isConfirming;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          disabled={isBusy}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 border-b border-border pb-4 mb-4">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
            <Undo2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Correct Payment</h3>
            <p className="text-xs text-muted-foreground">Reverses this payment and re-opens the obligation it settled</p>
          </div>
        </div>

        {succeeded ? (
          <div className="py-6 text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-bold text-foreground">Payment reversed</p>
            <p className="text-xs text-muted-foreground">Closing…</p>
          </div>
        ) : (
          <>
            <form onSubmit={handlePreview} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Reason for correction <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  disabled={isBusy || Boolean(kase)}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Recorded against the wrong tenant"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                />
                {kase && (
                  <button
                    type="button"
                    onClick={handleEditReason}
                    disabled={isBusy}
                    className="text-[11px] font-semibold text-accent hover:underline disabled:opacity-50"
                  >
                    Edit reason &amp; re-preview
                  </button>
                )}
              </div>

              {!kase && (
                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full h-10 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold active:scale-98 transition-transform flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isPreviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  <span>Preview Impact</span>
                </button>
              )}
            </form>

            {previewImpact && (
              <div className="mt-4 bg-muted/50 rounded-2xl p-4 border border-border/40 space-y-3 text-xs">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">What this correction will do</p>

                {previewImpact.ledgerEntries.length > 0 && (
                  <div className="space-y-1.5">
                    {previewImpact.ledgerEntries.map((entry, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span className="text-muted-foreground">
                          {entry.direction === 'DEBIT' ? 'Debit' : 'Credit'} ledger entry ({entry.reason.replaceAll('_', ' ').toLowerCase()})
                        </span>
                        <span className="font-semibold text-foreground">{fmt(entry.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {previewImpact.obligationChanges.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-border/40">
                    {previewImpact.obligationChanges.map((change) => {
                      const before = (change.before as { outstanding?: number } | null)?.outstanding;
                      const after = (change.after as { outstanding?: number } | null)?.outstanding;
                      return (
                        <div key={change.obligationId} className="flex justify-between">
                          <span className="text-muted-foreground">Obligation outstanding</span>
                          <span className="font-semibold text-foreground">
                            {fmt(Number(before ?? 0))} → {fmt(Number(after ?? 0))}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {previewImpact.warnings.length > 0 && (
                  <div className="pt-2 border-t border-border/40 space-y-1">
                    {previewImpact.warnings.map((warning, idx) => (
                      <p key={idx} className="text-amber-600 dark:text-amber-400">
                        {warning}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {fieldError && (
              <div className="mt-3">
                <ErrorCard title="Please check the form" description={fieldError} action="Correct the field above and try again." compact />
              </div>
            )}

            {apiError != null && (
              <div className="mt-3">
                <ErrorCard error={getHmsError(apiError, 'Correct payment')} compact onRetry={() => setApiError(null)} retryLabel="Dismiss" />
              </div>
            )}

            <div className="bg-rose-500/5 text-rose-600 dark:text-rose-400 rounded-xl p-3 border border-rose-500/10 text-xs leading-relaxed mt-4">
              <strong>Warning:</strong> Reversing writes a ledger correction and re-opens the affected obligation. This action cannot be undone from
              here.
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isBusy}
                className="px-4 h-10 rounded-xl border border-input bg-background text-sm font-semibold hover:bg-accent hover:text-accent-foreground active:scale-98 transition-transform disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!kase || isBusy}
                className="px-4 h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold active:scale-98 transition-transform flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                <span>Confirm Reversal</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
