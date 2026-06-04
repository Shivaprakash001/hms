import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { hmsToast } from '@lib/toast';
import { ErrorCard } from '@/shared/ui/error/ErrorCard';
import { getHmsError } from '@lib/errors';
import { X, IndianRupee, Calendar, Loader2, CheckCircle2 } from 'lucide-react';
import { paymentService } from '@features/payments/api';
import { tenantService } from '@features/tenants/api';
import { identityService } from '@features/auth/api';
import api from '@lib/api-client';
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

function dueBalance(due: Record<string, unknown>): number {
  const value = due.outstanding ?? due.remaining ?? due.balance ?? due.amount ?? 0;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

export function RecordPaymentModal({ onClose, hostelId, initialDueId = '', initialAmount = '' }: RecordPaymentModalProps) {
  const queryClient = useQueryClient();
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedDueId, setSelectedDueId] = useState(initialDueId);
  const [isAdvancePayment, setIsAdvancePayment] = useState(false);
  const [tenantSearch, setTenantSearch] = useState('');
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

  const { data: tenantsData, isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants', 'active-list', hostelId],
    queryFn: () => tenantService.getAll(hostelId, { status: 'ACTIVE', limit: 1000 }),
    enabled: Boolean(hostelId),
    staleTime: 60 * 1000,
  });

  const rawDues: Record<string, unknown>[] = Array.isArray(duesData)
    ? duesData
    : Array.isArray((duesData as Record<string, unknown>)?.dues)
    ? ((duesData as Record<string, unknown>).dues as Record<string, unknown>[])
    : [];

  const dues = rawDues.filter((due) => dueBalance(due) > 0);

  const tenants = useMemo(() => {
    if (!tenantsData) return [];
    const list = Array.isArray(tenantsData)
      ? tenantsData
      : Array.isArray((tenantsData as any)?.tenants)
      ? ((tenantsData as any).tenants as any[])
      : [];
    return list.map((t: any) => {
      const profile = t.profiles ?? t.profile;
      const roomAlloc = (t.room_allocations ?? t.allocations) as any[];
      const activeAlloc = Array.isArray(roomAlloc)
        ? roomAlloc.find((a: any) => a.is_active === true && !a.end_date) ?? roomAlloc[0]
        : null;
      const roomNo = activeAlloc?.room?.room_no ?? t.room_no ?? 'N/A';
      return {
        id: t.id,
        name: profile?.name ?? t.name ?? 'Tenant',
        room: roomNo,
        phone: profile?.phone ?? t.phone ?? 'N/A',
        email: profile?.email ?? t.email ?? '',
      };
    });
  }, [tenantsData]);

  useEffect(() => {
    if (initialDueId && rawDues.length > 0 && !selectedTenantId) {
      const initialDue = rawDues.find((d) => String(d.obligation_id ?? d.id) === initialDueId);
      if (initialDue) {
        setSelectedTenantId(String(initialDue.tenant_id));
        setSelectedDueId(initialDueId);
        setIsAdvancePayment(false);
        if (initialAmount) {
          setAmount(initialAmount);
        } else {
          setAmount(String(dueBalance(initialDue)));
        }
      }
    }
  }, [initialDueId, rawDues, initialAmount, selectedTenantId]);

  const filteredTenants = tenants.filter((t) => {
    const haystack = [t.name, t.room, t.phone, t.email].join(' ').toLowerCase();
    return haystack.includes(tenantSearch.trim().toLowerCase());
  });

  const selectedDue = dues.find((d) => String(d.obligation_id ?? d.id) === selectedDueId);
  const outstandingForSelected = selectedDue ? dueBalance(selectedDue) : 0;

  const handleSelectTenant = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    const tenantDues = rawDues.filter((d) => String(d.tenant_id) === tenantId && dueBalance(d) > 0);
    if (tenantDues.length > 0) {
      setIsAdvancePayment(false);
      const firstDue = tenantDues[0];
      const dueId = String(firstDue.obligation_id ?? firstDue.id);
      setSelectedDueId(dueId);
      setAmount(String(dueBalance(firstDue)));
    } else {
      setIsAdvancePayment(true);
      setSelectedDueId('');
      setAmount('');
    }
  };

  const mutation = useMutation({
    mutationFn: async (payload: {
      isAdvance: boolean;
      tenantId: string;
      obligationId?: string;
      amountPaid: number;
      paymentMethod: string;
      referenceNumber?: string;
      paymentDate: string;
      note?: string;
      password: string;
    }) => {
      const identity = await identityService.confirmIdentity(payload.password);
      const identityToken = identity?.identity_token ?? identity?.data?.identity_token;
      if (!identityToken) throw new Error('Identity verification failed. Please try again.');

      if (payload.isAdvance) {
        const advanceNotes = [
          payload.note || 'Recorded offline future rent payment',
          payload.referenceNumber ? `Reference: ${payload.referenceNumber}` : '',
          `Payment mode: ${payload.paymentMethod}`,
          `Payment date: ${payload.paymentDate}`,
        ].filter(Boolean).join(' · ');
        const response = await api.post(`/tenants/${payload.tenantId}/advance`, {
          action: 'credit',
          reason: 'TOPUP',
          amount: payload.amountPaid,
          notes: advanceNotes,
          reference_type: 'OFFLINE_RENT_ADVANCE',
        });
        const result = response.data?.data ?? response.data;
        return {
          amount_paid: payload.amountPaid,
          payment_method: payload.paymentMethod,
          is_advance: true,
          entry: result?.entry,
        };
      } else {
        return paymentService.recordOfflinePayment({
          identityToken,
          obligationId: payload.obligationId!,
          amountPaid: payload.amountPaid,
          paymentMethod: payload.paymentMethod,
          referenceNumber: payload.referenceNumber,
          paymentDate: payload.paymentDate,
          note: payload.note,
          hostelId,
        });
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all(hostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.dues(hostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all(hostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.all() });
      if (selectedTenantId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tenants.advance(hostelId, selectedTenantId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.tenants.full(hostelId, selectedTenantId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.tenants.overview(hostelId, selectedTenantId) });
      }
      const recorded = result?.payment ?? result;
      hmsToast.paymentSuccess(Number(recorded?.amount_paid ?? amount));
      setSuccessSummary(recorded);
    },
    onError: (error: unknown) => {
      setApiError(error);
      hmsToast.error(error, 'Record payment');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantId) {
      setFieldError('Select a tenant to record payment.');
      return;
    }
    if (!isAdvancePayment && !selectedDueId) {
      setFieldError('Select a tenant due to record payment.');
      return;
    }
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setFieldError('Enter a valid payment amount.');
      return;
    }
    if (!isAdvancePayment && outstandingForSelected > 0 && parsedAmount > outstandingForSelected) {
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
      isAdvance: isAdvancePayment,
      tenantId: selectedTenantId,
      obligationId: isAdvancePayment ? undefined : selectedDueId,
      amountPaid: parsedAmount,
      paymentMethod: paymentMode.toUpperCase(),
      referenceNumber: referenceNumber || undefined,
      paymentDate,
      note: note || undefined,
      password,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-background w-full max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl sm:max-w-lg">
        <div className="sticky top-0 bg-background border-b border-border px-4 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Quick collect</h2>
            <p className="text-xs text-muted-foreground">Search tenant, record rent paid or future rent cash/UPI.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          {/* Tenant / Search */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Select Tenant *</label>
            {tenantsLoading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading tenants...
              </div>
            ) : !selectedTenantId ? (
              <div className="space-y-2">
                <input
                  type="search"
                  value={tenantSearch}
                  onChange={(event) => setTenantSearch(event.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                  placeholder="Search tenant by name, room, phone..."
                />
                <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-card divide-y divide-border">
                  {filteredTenants.slice(0, 8).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectTenant(t.id)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm text-foreground hover:bg-secondary"
                    >
                      <span>
                        <span className="block font-medium">{t.name}</span>
                        <span className="block text-xs text-muted-foreground">Room {t.room} • {t.phone}</span>
                      </span>
                    </button>
                  ))}
                  {filteredTenants.length === 0 && (
                    <div className="px-3 py-4 text-xs text-muted-foreground">No matching active tenants found.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-secondary rounded-xl border border-border">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {tenants.find((t) => t.id === selectedTenantId)?.name || 'Selected Tenant'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Room {tenants.find((t) => t.id === selectedTenantId)?.room || 'N/A'} • {tenants.find((t) => t.id === selectedTenantId)?.phone || 'N/A'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTenantId('');
                    setSelectedDueId('');
                    setIsAdvancePayment(false);
                    setAmount('');
                  }}
                  className="text-xs font-bold text-accent hover:underline px-2 py-1"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Payment Target */}
          {selectedTenantId && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Payment Target *</label>
              {(() => {
                const tenantDues = rawDues.filter(
                  (d) => String(d.tenant_id) === selectedTenantId && dueBalance(d) > 0
                );
                if (tenantDues.length === 0) {
                  return (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-xs text-emerald-800 font-medium">
                      This tenant has no pending dues. Amount will be recorded as future rent credit, not security deposit.
                    </div>
                  );
                }
                return (
                  <select
                    value={isAdvancePayment ? 'advance' : selectedDueId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'advance') {
                        setIsAdvancePayment(true);
                        setSelectedDueId('');
                        setAmount('');
                      } else {
                        setIsAdvancePayment(false);
                        setSelectedDueId(val);
                        const due = tenantDues.find((d) => String(d.obligation_id ?? d.id) === val);
                        if (due) {
                          setAmount(String(dueBalance(due)));
                        }
                      }
                    }}
                    className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                  >
                    {tenantDues.map((d) => {
                      const id = String(d.obligation_id ?? d.id);
                      const outstanding = dueBalance(d);
                      const formattedMonth = d.rent_month
                        ? new Date(String(d.rent_month)).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
                        : 'Rent Due';
                      return (
                        <option key={id} value={id}>
                          {formattedMonth} (Outstanding: ₹{outstanding.toLocaleString('en-IN')})
                        </option>
                      );
                    })}
                    <option value="advance">Future Rent Credit (prepaid rent)</option>
                  </select>
                );
              })()}
            </div>
          )}

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
            {selectedDue && outstandingForSelected > 0 && !isAdvancePayment && (
              <p className="text-xs text-[#F59E0B] mt-1.5">Outstanding: ₹{outstandingForSelected.toLocaleString('en-IN')}</p>
            )}
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
                <p className="text-xs text-emerald-600 mt-1">
                  {successSummary.is_advance
                    ? "→ The tenant's future rent credit has been updated."
                    : "→ The tenant's outstanding bill has been updated."}
                </p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={mutation.isPending || !selectedTenantId || (!isAdvancePayment && !selectedDueId) || duesLoading || Boolean(successSummary)}
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
