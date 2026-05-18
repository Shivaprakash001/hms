import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, IndianRupee, Calendar, Loader2 } from 'lucide-react';
import { paymentService } from '@features/payments/api';
import { queryKeys } from '@lib/queryKeys';

interface RecordPaymentModalProps {
  onClose: () => void;
  hostelId: string;
}

export function RecordPaymentModal({ onClose, hostelId }: RecordPaymentModalProps) {
  const queryClient = useQueryClient();
  const [selectedDueId, setSelectedDueId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [note, setNote] = useState('');
  const [apiError, setApiError] = useState<string | null>(null);

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

  const mutation = useMutation({
    mutationFn: (payload: Parameters<typeof paymentService.recordOfflinePayment>[0]) =>
      paymentService.recordOfflinePayment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all(hostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.dues(hostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats(hostelId) });
      toast.success('Payment recorded successfully');
      onClose();
    },
    onError: (error: unknown) => {
      const msg =
        (error as { response?: { data?: { message?: string; error?: { message?: string } } } })?.response?.data?.message ||
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        (error as { message?: string })?.message ||
        'Failed to record payment';
      setApiError(msg);
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDue) return;
    setApiError(null);
    mutation.mutate({
      obligationId: String(selectedDue.obligation_id ?? selectedDue.id),
      identityToken: String(selectedDue.identity_token ?? selectedDue.tenant_identity_token ?? ''),
      amountPaid: Number(amount),
      paymentMethod: paymentMode.toUpperCase(),
      referenceNumber: referenceNumber || undefined,
      paymentDate,
      note: note || undefined,
      hostelId,
    });
  };

  const outstandingForSelected = selectedDue ? Number(selectedDue.outstanding ?? selectedDue.amount ?? 0) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-background w-full max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl sm:max-w-lg">
        <div className="sticky top-0 bg-background border-b border-border px-4 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Record Payment</h2>
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
              <select
                required
                value={selectedDueId}
                onChange={(e) => {
                  setSelectedDueId(e.target.value);
                  const due = dues.find((d) => String(d.obligation_id ?? d.id) === e.target.value);
                  if (due) setAmount(String(due.outstanding ?? due.amount ?? ''));
                }}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">Choose tenant</option>
                {dues.map((d) => {
                  const id = String(d.obligation_id ?? d.id);
                  const name = String(d.tenant_name ?? d.name ?? 'Tenant');
                  const room = d.room_no ?? d.room_number ? ` - Room ${d.room_no ?? d.room_number}` : '';
                  const outstanding = Number(d.outstanding ?? d.amount ?? 0);
                  return (
                    <option key={id} value={id}>
                      {name}{room} — ₹{outstanding.toLocaleString('en-IN')}
                    </option>
                  );
                })}
              </select>
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
            <div className="grid grid-cols-3 gap-2">
              {['cash', 'upi', 'bank'].map((mode) => (
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
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
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
            <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg">{apiError}</div>
          )}

          <button
            type="submit"
            disabled={mutation.isPending || !selectedDueId || duesLoading}
            className="w-full bg-accent text-accent-foreground py-4 rounded-xl font-medium active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {mutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Recording...</>
            ) : 'Record Payment'}
          </button>
        </form>
      </div>
    </div>
  );
}
