import { useEffect, useMemo, useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { hmsToast } from '@lib/toast';
import { ErrorCard } from '@/shared/ui/error/ErrorCard';
import { getHmsError } from '@lib/errors';
import { X, IndianRupee, Calendar, Loader2, CheckCircle2, ArrowRight, Wallet, TrendingUp } from 'lucide-react';
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

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

export function RecordPaymentModal({ onClose, hostelId, initialDueId = '', initialAmount = '' }: RecordPaymentModalProps) {
  const queryClient = useQueryClient();
  const [selectedHostelId, setSelectedHostelId] = useState<string>(() => {
    return hostelId === 'all' ? '' : hostelId;
  });
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');
  const [amount, setAmount] = useState(initialAmount);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [note, setNote] = useState('');
  const [password, setPassword] = useState('');
  const [apiError, setApiError] = useState<unknown>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any>(null);

  const { data: hostelsData } = useQuery({
    queryKey: ['owner', 'hostels'],
    queryFn: () => import('@features/owners/api').then((m) => m.ownerService.getHostels()),
    staleTime: 10 * 60 * 1000,
    enabled: hostelId === 'all',
  });

  const hostelsList = useMemo(() => {
    return Array.isArray(hostelsData)
      ? hostelsData
      : Array.isArray((hostelsData as any)?.data?.hostels)
        ? (hostelsData as any).data.hostels
        : Array.isArray((hostelsData as any)?.hostels)
          ? (hostelsData as any).hostels
          : [];
  }, [hostelsData]);

  const { data: tenantsData, isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants', 'active-list', selectedHostelId],
    queryFn: () => tenantService.getAll(selectedHostelId, { status: 'ACTIVE', limit: 1000 }),
    enabled: Boolean(selectedHostelId),
    staleTime: 60 * 1000,
  });

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

  // V2: Settlement Preview — live dry-run of where money would go
  const parsedAmount = Number(amount) || 0;
  const previewEnabled = Boolean(selectedTenantId) && parsedAmount > 0 && Boolean(selectedHostelId);
  
  const { data: previewData, isLoading: previewLoading, isFetching: previewFetching } = useQuery({
    queryKey: ['settlement-preview', selectedTenantId, parsedAmount, selectedHostelId],
    queryFn: () => paymentService.settlementPreview(selectedTenantId, parsedAmount, selectedHostelId),
    enabled: previewEnabled,
    staleTime: 5_000,
    retry: false,
  });

  const filteredTenants = tenants.filter((t) => {
    const haystack = [t.name, t.room, t.phone, t.email].join(' ').toLowerCase();
    return haystack.includes(tenantSearch.trim().toLowerCase());
  });

  const handleSelectTenant = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    setAmount('');
    setFieldError(null);
    setApiError(null);
  };

  const mutation = useMutation({
    mutationFn: async (payload: {
      tenantId: string;
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

      // V2: Always use tenant-level settlement — engine decides allocation
      return paymentService.recordTenantPayment({
        identityToken,
        tenantId: payload.tenantId,
        amountPaid: payload.amountPaid,
        paymentMethod: payload.paymentMethod,
        referenceNumber: payload.referenceNumber,
        paymentDate: payload.paymentDate,
        note: payload.note,
        hostelId: selectedHostelId,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all(selectedHostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.dues(selectedHostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(selectedHostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all(selectedHostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.all() });
      if (selectedTenantId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tenants.advance(selectedHostelId, selectedTenantId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.tenants.full(selectedHostelId, selectedTenantId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.tenants.overview(selectedHostelId, selectedTenantId) });
      }
      hmsToast.paymentSuccess(parsedAmount);
      setSuccessResult(result);
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
    if (!parsedAmount || parsedAmount <= 0) {
      setFieldError('Enter a valid payment amount.');
      return;
    }
    if (!password.trim()) {
      setFieldError('Enter your password to confirm this offline payment.');
      return;
    }
    if (mutation.isPending) return;
    setApiError(null);
    setFieldError(null);
    setSuccessResult(null);
    mutation.mutate({
      tenantId: selectedTenantId,
      amountPaid: parsedAmount,
      paymentMethod: paymentMode.toUpperCase(),
      referenceNumber: referenceNumber || undefined,
      paymentDate,
      note: note || undefined,
      password,
    });
  };

  // Settlement breakdown from success result
  const breakdown = successResult?.settlement_breakdown;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-background w-full max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl sm:max-w-lg">
        <div className="sticky top-0 bg-background border-b border-border px-4 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Quick Collect</h2>
            <p className="text-xs text-muted-foreground">Enter amount → system settles automatically.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {successResult ? (
          /* ═══ SUCCESS STATE ═══ */
          <div className="p-5 space-y-5">
            <div className="text-center space-y-2 py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Payment Recorded</h3>
              <p className="text-2xl font-black text-foreground">{fmt(parsedAmount)}</p>
              <p className="text-xs text-muted-foreground">
                via {paymentMode.toUpperCase()} • {tenants.find(t => t.id === selectedTenantId)?.name}
              </p>
            </div>

            {/* Settlement Breakdown */}
            {breakdown && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 bg-secondary/50 border-b border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settlement Breakdown</p>
                </div>
                <div className="divide-y divide-border">
                  {breakdown.allocations?.map((alloc: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${alloc.result === 'PAID' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className="text-sm text-foreground font-medium">{alloc.label}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-foreground">{fmt(alloc.allocated)}</span>
                        <span className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded ${
                          alloc.result === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}>{alloc.result}</span>
                      </div>
                    </div>
                  ))}
                  {breakdown.future_credit > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-blue-50/50">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        <span className="text-sm text-blue-800 font-medium">Future Rent Credit</span>
                      </div>
                      <span className="text-sm font-bold text-blue-700">{fmt(breakdown.future_credit)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full bg-accent text-accent-foreground py-4 rounded-xl font-medium active:scale-95 transition-transform"
            >
              Done
            </button>
          </div>
        ) : (
          /* ═══ FORM STATE ═══ */
          <form onSubmit={handleSubmit} className="p-4 space-y-5">
            {/* Hostel Selector (if opened from 'all' view) */}
            {hostelId === 'all' && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Select Hostel *</label>
                <select
                  value={selectedHostelId}
                  onChange={(e) => {
                    setSelectedHostelId(e.target.value);
                    setSelectedTenantId('');
                    setAmount('');
                  }}
                  className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                >
                  <option value="">-- Choose Hostel --</option>
                  {hostelsList.map((h: any) => (
                    <option key={h.id} value={h.id}>
                      {h.name ?? h.hostel_name ?? h.id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!selectedHostelId ? (
              <div className="text-center py-8 border border-dashed border-border rounded-xl">
                <p className="text-sm text-muted-foreground font-medium">Please select a hostel to proceed.</p>
              </div>
            ) : (
              <>
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
                          setAmount('');
                        }}
                        className="text-xs font-bold text-accent hover:underline px-2 py-1"
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>

                {/* V2: Amount — first class, no obligation selection needed */}
                {selectedTenantId && (
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1.5">Amount Received *</label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="number"
                        required
                        min="1"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-lg font-bold"
                        placeholder="Enter any amount"
                        autoFocus
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Any amount accepted. System auto-settles obligations by priority.
                    </p>
                  </div>
                )}

                {/* V2: Live Settlement Preview */}
                {selectedTenantId && parsedAmount > 0 && (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="px-4 py-2.5 bg-secondary/50 border-b border-border flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Settlement Preview
                      </p>
                      {(previewLoading || previewFetching) && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {previewData ? (
                      <div className="divide-y divide-border">
                        {previewData.allocations?.filter((a: any) => a.allocated > 0).map((alloc: any, i: number) => (
                          <div key={i} className="flex items-center justify-between px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <ArrowRight className="w-3 h-3 text-muted-foreground" />
                              <span className="text-sm text-foreground">{alloc.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">{fmt(alloc.allocated)}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                alloc.result === 'PAID' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                              }`}>{alloc.result}</span>
                            </div>
                          </div>
                        ))}
                        {previewData.future_credit > 0 && (
                          <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50/50">
                            <div className="flex items-center gap-2">
                              <Wallet className="w-3.5 h-3.5 text-blue-600" />
                              <span className="text-sm text-blue-800 font-medium">Future Rent Credit</span>
                            </div>
                            <span className="text-sm font-bold text-blue-700">{fmt(previewData.future_credit)}</span>
                          </div>
                        )}
                        {previewData.allocations?.length === 0 && previewData.future_credit > 0 && (
                          <div className="px-4 py-3 text-xs text-blue-700 bg-blue-50/50">
                            No outstanding dues. Full amount will be credited as future rent.
                          </div>
                        )}
                        {previewData.remaining_outstanding > 0 && (
                          <div className="px-4 py-2 text-xs text-muted-foreground bg-secondary/30">
                            Remaining outstanding after payment: {fmt(previewData.remaining_outstanding)}
                          </div>
                        )}
                      </div>
                    ) : !previewLoading ? (
                      <div className="px-4 py-3 text-xs text-muted-foreground">
                        Enter an amount to see settlement preview.
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Payment Mode */}
                {selectedTenantId && (
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
                )}

                {/* Reference Number */}
                {selectedTenantId && (paymentMode === 'upi' || paymentMode === 'bank') && (
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
                {selectedTenantId && (
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
                )}

                {/* Note */}
                {selectedTenantId && (
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
                )}

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

                {/* Password Confirmation */}
                {selectedTenantId && (
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
                )}

                <button
                  type="submit"
                  disabled={mutation.isPending || !selectedTenantId || parsedAmount <= 0 || Boolean(successResult)}
                  className="w-full bg-accent text-accent-foreground py-4 rounded-xl font-medium active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {mutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Verifying & Recording...</>
                  ) : 'Record Payment'}
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
