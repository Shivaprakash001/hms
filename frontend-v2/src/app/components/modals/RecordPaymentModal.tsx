import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { hmsToast } from '@lib/toast';
import { ErrorCard } from '@/shared/ui/error/ErrorCard';
import { getHmsError } from '@lib/errors';
import { X, IndianRupee, Calendar, Loader2, CheckCircle2 } from 'lucide-react';
import { paymentService } from '@features/payments/api';
import { identityService } from '@features/auth/api';
import { queryKeys } from '@lib/queryKeys';

interface RecordPaymentModalProps {
  onClose: () => void;
  hostelId: string;
  initialDueId?: string;
  initialAmount?: string;
}

interface OfflinePaymentPayload {
  obligationId: string;
  amountPaid: number;
  paymentMethod: string;
  referenceNumber?: string;
  paymentDate: string;
  note?: string;
  hostelId: string;
}

export function RecordPaymentModal({ onClose, hostelId, initialDueId = '', initialAmount = '' }: RecordPaymentModalProps) {
  const queryClient = useQueryClient();
  const [selectedDueId, setSelectedDueId] = useState(initialDueId);
  const [dueSearch, setDueSearch] = useState('');
  const [amount, setAmount] = useState(initialAmount);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [note, setNote] = useState('');
  const [password, setPassword] = useState('');
  const [apiError, setApiError] = useState<unknown>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<Record<string, unknown> | null>(null);

  const { data: duesData, isLoading: duesLoading } = useQuery({
    queryKey: queryKeys.payments.dues(hostelId),
    queryFn: () => paymentService.getAllDues(hostelId),
    staleTime: 60 * 1000,
  });

  const dues: Record<string, unknown>[] = Array.isArray(duesData)
    ? duesData
    : Array.isArray((duesData as Record<string, unknown>)?.dues)
    ? ((duesData as Record<string, unknown>).dues as Record<string, unknown>[])
    : [];

  const selectedDue = dues.find((d) => String(d.obligation_id ?? d.id) === selectedDueId);
  const filteredDues = dues.filter((due) => {
    const haystack = [
      due.tenant_name,
      due.name,
      due.room_no,
      due.room_number,
      due.phone,
      due.email,
    ].join(' ').toLowerCase();
    return haystack.includes(dueSearch.trim().toLowerCase());
  });

  const mutation = useMutation({
    mutationFn: async (payload: OfflinePaymentPayload & { password: string }) => {
      const identity = await identityService.confirmIdentity(payload.password);
      const identityToken = identity?.identity_token ?? identity?.data?.identity_token;
      if (!identityToken) throw new Error('Identity verification failed. Please try again.');
      return paymentService.recordOfflinePayment({
        identityToken,
        obligationId: payload.obligationId,
        amountPaid: payload.amountPaid,
        paymentMethod: payload.paymentMethod,
        referenceNumber: payload.referenceNumber,
        paymentDate: payload.paymentDate,
        note: payload.note,
        hostelId: payload.hostelId,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all(hostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.dues(hostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(hostelId) });
      const recorded = result?.payment ?? result;
      hmsToast.paymentSuccess(Number((recorded as Record<string, unknown>)?.amount_paid ?? amount));
      setSuccessSummary(recorded);
    },
    onError: (error: unknown) => {
      setApiError(error);
      hmsToast.error(error, 'Record payment');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDue) {
      setFieldError('Select a tenant due to record payment.');
      return;
    }
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setFieldError('Enter a valid payment amount.');
      return;
    }
    if (outstandingForSelected > 0 && parsedAmount > outstandingForSelected) {
      setFieldError(`Amount cannot exceed outstanding balance of ₹${outstandingForSelected.toLocaleString('en-IN')}.`);
      return;
    }
    if (!password.trim()) {
      setFieldError('Enter your password to confirm this offline payment.');
      return;
    }
    if (mutation.isPending) return;
    setApiError(null);
    setFieldError(null);
    setSuccessSummary(null);
    mutation.mutate({
      obligationId: String(selectedDue.obligation_id ?? selectedDue.id),
      amountPaid: parsedAmount,
      paymentMethod: paymentMode.toUpperCase(),
      referenceNumber: referenceNumber || undefined,
      paymentDate,
      note: note || undefined,
      hostelId,
      password,
    });
  };

  const outstandingForSelected = selectedDue ? Number(selectedDue.outstanding ?? selectedDue.amount ?? 0) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-background w-full max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl sm:max-w-lg">
        <div className="sticky top-0 bg-background border-b border-border px-4 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Quick collect</h2>
            <p className="text-xs text-muted-foreground">Search tenant, confirm amount, record cash or UPI.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          {/* Tenant / Obligation */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Select Tenant Due *</label>
            {duesLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading dues...
              </div>
            ) : dues.length === 0 ? (
              <div className="py-3 text-sm text-muted-foreground">No pending dues found for this hostel</div>
            ) : (
              <div className="space-y-2">
                <input
                  type="search"
                  value={dueSearch}
                  onChange={(event) => setDueSearch(event.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Search tenant, room, phone..."
                />
                <div className="max-h-44 overflow-y-auto rounded-xl border border-border bg-card divide-y divide-border">
                  {filteredDues.slice(0, 8).map((d) => {
                    const id = String(d.obligation_id ?? d.id);
                    const name = String(d.tenant_name ?? d.name ?? 'Tenant');
                    const room = d.room_no ?? d.room_number ? `Room ${d.room_no ?? d.room_number}` : 'Room N/A';
                    const outstanding = Number(d.outstanding ?? d.amount ?? 0);
                    const selected = selectedDueId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setSelectedDueId(id);
                          setAmount(String(d.outstanding ?? d.amount ?? ''));
                        }}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm ${
                          selected ? 'bg-accent/10 text-accent' : 'text-foreground hover:bg-secondary'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{name}</span>
                          <span className="block text-xs text-muted-foreground">{room}</span>
                        </span>
                        <span className="shrink-0 font-semibold">₹{outstanding.toLocaleString('en-IN')}</span>
                      </button>
                    );
                  })}
                  {filteredDues.length === 0 && (
                    <div className="px-3 py-4 text-sm text-muted-foreground">No matching tenant dues.</div>
                  )}
                </div>
              </div>
            )}
            {selectedDue && outstandingForSelected > 0 && (
              <p className="text-xs text-[#F59E0B] mt-1.5">Outstanding: ₹{outstandingForSelected.toLocaleString('en-IN')}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Amount *</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="number"
                required
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="0"
              />
            </div>
          </div>

          {/* Payment Mode */}
          <div>
            <label className="block text-xs text-muted-foreground mb-2">Payment Mode *</label>
            <div className="grid grid-cols-2 gap-2">
              {['cash', 'upi'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMode(mode)}
                  className={`py-2.5 px-4 rounded-lg text-sm font-medium capitalize transition-colors ${
                    paymentMode === mode
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-card border border-border text-foreground'
                  }`}
                >
                  Record {mode.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPaymentMode('bank')}
              className={`mt-2 w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                paymentMode === 'bank'
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-card border border-border text-foreground'
              }`}
            >
              Bank transfer
            </button>
          </div>

          {/* Reference Number */}
          {(paymentMode === 'upi' || paymentMode === 'bank') && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Reference / UTR Number</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Transaction reference"
              />
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Payment Date *</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Note (Optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              placeholder="Any notes about this payment..."
            />
          </div>

          {apiError && (
            <ErrorCard
              error={getHmsError(apiError, 'Record payment')}
              compact
              onRetry={() => setApiError(null)}
              retryLabel="Dismiss"
            />
          )}

          {fieldError && (
            <ErrorCard
              title="Please check the form"
              description={fieldError}
              action="Correct the field above and try again."
              compact
            />
          )}

          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Confirm Password *</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="Enter your password"
              autoComplete="current-password"
            />
            <p className="text-xs text-muted-foreground mt-1.5">Required for secure offline payment recording.</p>
          </div>

          {successSummary && (
            <div className="flex items-start gap-3 px-4 py-4 rounded-xl border border-emerald-200 bg-emerald-50" role="status">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-800">Payment recorded successfully</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  {`₹${Number((successSummary as Record<string, unknown>).amount_paid ?? amount).toLocaleString('en-IN')} via ${String((successSummary as Record<string, unknown>).payment_method ?? paymentMode.toUpperCase())}`}
                </p>
                <p className="text-xs text-emerald-600 mt-1">→ The tenant\'s balance has been updated.</p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={mutation.isPending || !selectedDueId || duesLoading || Boolean(successSummary)}
            className="w-full bg-accent text-accent-foreground py-4 rounded-xl font-medium active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {mutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Verifying & Recording...</>
            ) : 'Record Payment'}
          </button>
          {successSummary && (
            <button
              type="button"
              onClick={onClose}
              className="w-full border border-border text-foreground py-3 rounded-xl font-medium active:scale-95 transition-transform"
            >
              Done
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
