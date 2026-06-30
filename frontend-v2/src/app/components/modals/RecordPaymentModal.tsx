import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { hmsToast } from '@lib/toast';
import { ErrorCard } from '@/shared/ui/error/ErrorCard';
import { getHmsError } from '@lib/errors';
import { X, IndianRupee, Calendar, Loader2, CheckCircle2, ArrowRight, Wallet, TrendingUp } from 'lucide-react';
import { paymentService } from '@features/payments/api';
import { tenantService } from '@features/tenants/api';
import { identityService } from '@features/auth/api';
import { queryKeys } from '@lib/queryKeys';

export type PaymentContext = {
  tenantId?: string;
  obligationId?: string;
  defaultAmount?: string | number;
  source:
    | 'tenant-profile'
    | 'financial-center'
    | 'alerts'
    | 'activity-center'
    | 'quick-collect';
};

interface RecordPaymentModalProps {
  onClose: () => void;
  hostelId: string;
  context: PaymentContext;
  initialTenantData?: any;
}

const fmt = (n: number) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

// Separate UI from Payment Logic: Payment Hook / Controller
export function usePaymentController(hostelId: string, currentTenant: any) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      context,
      form,
    }: {
      context: PaymentContext;
      form: {
        amountPaid: number;
        paymentMethod: string;
        referenceNumber?: string;
        paymentDate: string;
        note?: string;
        password?: string;
      };
    }) => {
      if (!form.password?.trim()) {
        throw new Error('Enter your password to confirm this offline payment.');
      }
      const identity = await identityService.confirmIdentity(form.password);
      const identityToken = identity?.identity_token ?? identity?.data?.identity_token;
      if (!identityToken) throw new Error('Identity verification failed. Please try again.');

      if (context.obligationId) {
        return paymentService.recordOfflinePayment({
          identityToken,
          obligationId: context.obligationId,
          amountPaid: form.amountPaid,
          paymentMethod: form.paymentMethod,
          referenceNumber: form.referenceNumber,
          paymentDate: form.paymentDate,
          note: form.note,
          hostelId,
        });
      } else {
        const tenantId = context.tenantId || currentTenant?.id;
        if (!tenantId) throw new Error('No tenant context found for payment recording.');
        return paymentService.recordTenantPayment({
          identityToken,
          tenantId,
          amountPaid: form.amountPaid,
          paymentMethod: form.paymentMethod,
          referenceNumber: form.referenceNumber,
          paymentDate: form.paymentDate,
          note: form.note,
          hostelId: currentTenant?.hostel_id || hostelId,
        });
      }
    },
    onSuccess: (result, variables) => {
      const targetHostelId = currentTenant?.hostel_id || hostelId;
      const tenantId = variables.context.tenantId || currentTenant?.id;

      // Invalidate relevant query keys centrally
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all(targetHostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.dues(targetHostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all(targetHostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all(targetHostelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolio.all() });

      if (tenantId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.tenants.advance(targetHostelId, tenantId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.tenants.full(targetHostelId, tenantId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.tenants.overview(targetHostelId, tenantId) });
        queryClient.invalidateQueries({ queryKey: ['tenant-overview', tenantId] });
        queryClient.invalidateQueries({ queryKey: ['payments', 'tenant-dues', tenantId, targetHostelId] });
      }
    },
  });

  return mutation;
}

export function RecordPaymentModal({
  onClose,
  hostelId,
  context,
  initialTenantData,
}: RecordPaymentModalProps) {
  const queryClient = useQueryClient();
  const [selectedTenant, setSelectedTenant] = useState<any | null>(null);
  const [tenantSearch, setTenantSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Set initial amount based on context.defaultAmount (accept string or number)
  const initialAmountStr = context.defaultAmount ? String(context.defaultAmount) : '';
  const [amount, setAmount] = useState(initialAmountStr);
  
  const [paymentMode, setPaymentMode] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [note, setNote] = useState('');
  const [password, setPassword] = useState('');
  const [apiError, setApiError] = useState<unknown>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any>(null);
  const [hasPrefilled, setHasPrefilled] = useState(false);

  // Debounce search input for generic search path
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(tenantSearch);
    }, 250);
    return () => clearTimeout(handler);
  }, [tenantSearch]);

  // Global search for active tenants (enabled only in generic/search path)
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['payments', 'quick-collect', 'search', debouncedSearch],
    queryFn: () => paymentService.quickCollectSearch(debouncedSearch),
    enabled: !context.tenantId,
    staleTime: 5000,
  });

  // Contextual tenant lookup (enabled only if tenantId is provided)
  const { data: tenantContextData, isLoading: tenantContextLoading, error: tenantContextError } = useQuery({
    queryKey: ['tenant-overview', context.tenantId],
    queryFn: () => tenantService.getOwnerTenantOverview(context.tenantId!),
    enabled: Boolean(context.tenantId),
    initialData: initialTenantData,
  });

  // Map contextual tenant context or search-based selected tenant
  const currentTenant = useMemo(() => {
    if (context.tenantId) {
      if (!tenantContextData) return null;
      return {
        id: tenantContextData.id,
        name: tenantContextData.name,
        phone: tenantContextData.phone,
        email: tenantContextData.email,
        hostel_id: hostelId,
        hostel_name: tenantContextData.hostel_name || 'Hostel',
        room_no: tenantContextData.room_number || tenantContextData.room_no || 'N/A',
        outstanding_dues: Number(tenantContextData.outstanding || tenantContextData.outstanding_dues || 0),
        future_rent_credit: Number(tenantContextData.advance_balance || tenantContextData.future_rent_credit || 0),
        security_deposit_paid: Number(tenantContextData.security_deposit || tenantContextData.security_deposit_paid || 0),
        security_deposit_billed: Number(tenantContextData.security_deposit || tenantContextData.security_deposit_billed || 0),
      };
    }
    return selectedTenant;
  }, [context.tenantId, tenantContextData, selectedTenant, hostelId]);

  const resolvedTenantId = context.tenantId || selectedTenant?.id;
  const resolvedObligationId = context.obligationId;

  // Dues lookup to find specific obligation metadata and defaults
  const { data: duesData, isLoading: duesLoading } = useQuery({
    queryKey: ['payments', 'tenant-dues', resolvedTenantId, hostelId],
    queryFn: () => paymentService.getTenantDues(resolvedTenantId!, hostelId),
    enabled: Boolean(resolvedTenantId),
  });

  // Find specific obligation if obligation ID is present
  const targetObligation = useMemo(() => {
    if (!resolvedObligationId || !duesData?.items) return null;
    return duesData.items.find((item: any) => String(item.obligation_id) === String(resolvedObligationId));
  }, [resolvedObligationId, duesData]);

  // Derive initial amount based on obligation or general outstanding dues
  const defaultAmount = useMemo(() => {
    if (initialAmountStr) return initialAmountStr;
    if (targetObligation) return String(targetObligation.outstanding);
    if (context.tenantId && duesData?.total_due) return String(duesData.total_due);
    return '';
  }, [initialAmountStr, targetObligation, context.tenantId, duesData]);

  // Handle amount state auto-fill once duesData/targetObligation is ready
  useEffect(() => {
    if (defaultAmount && !hasPrefilled) {
      setAmount(defaultAmount);
      setHasPrefilled(true);
    }
  }, [defaultAmount, hasPrefilled]);

  const parsedAmount = Number(amount) || 0;
  // Disable preview if paying a specific obligation (direct routing)
  const previewEnabled = Boolean(currentTenant?.id) && parsedAmount > 0 && !resolvedObligationId;
  
  const { data: previewData, isLoading: previewLoading, isFetching: previewFetching } = useQuery({
    queryKey: ['settlement-preview', currentTenant?.id, parsedAmount, currentTenant?.hostel_id],
    queryFn: () => paymentService.settlementPreview(currentTenant!.id, parsedAmount, currentTenant!.hostel_id),
    enabled: previewEnabled,
    staleTime: 5_000,
    retry: false,
  });

  const handleSelectTenant = (t: any) => {
    setSelectedTenant(t);
    setAmount('');
    setFieldError(null);
    setApiError(null);
    setHasPrefilled(false);
  };

  // Instantiate payment controller hook
  const mutation = usePaymentController(hostelId, currentTenant);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant) {
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
      context,
      form: {
        amountPaid: parsedAmount,
        paymentMethod: paymentMode.toUpperCase(),
        referenceNumber: referenceNumber || undefined,
        paymentDate,
        note: note || undefined,
        password,
      }
    }, {
      onSuccess: (result) => {
        hmsToast.paymentSuccess(parsedAmount);
        setSuccessResult(result);
      },
      onError: (error: unknown) => {
        setApiError(error);
        hmsToast.error(error, 'Record payment');
      }
    });
  };

  const breakdown = successResult?.settlement_breakdown;
  const isContextLoading = tenantContextLoading || (Boolean(resolvedTenantId) && duesLoading && !hasPrefilled);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-background w-full max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl sm:max-w-lg">
        <div className="sticky top-0 bg-background border-b border-border px-4 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {context.tenantId ? 'Record Payment' : 'Quick Collect'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {resolvedObligationId 
                ? 'Recording payment for a specific obligation.'
                : 'Enter amount → system settles automatically.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {isContextLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <p className="text-sm text-muted-foreground">Loading tenant payment context...</p>
          </div>
        ) : !tenantContextLoading && tenantContextError ? (
          <div className="p-5">
            <ErrorCard
              title="Failed to load tenant details"
              error={tenantContextError}
            />
            <button
              onClick={onClose}
              className="mt-4 w-full bg-secondary text-secondary-foreground py-3 rounded-xl font-medium"
            >
              Close
            </button>
          </div>
        ) : successResult ? (
          /* ═══ SUCCESS STATE ═══ */
          <div className="p-5 space-y-5">
            <div className="text-center space-y-2 py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Payment Recorded</h3>
              <p className="text-2xl font-black text-foreground">{fmt(parsedAmount)}</p>
              <p className="text-xs text-muted-foreground">
                via {paymentMode.toUpperCase()} • {currentTenant?.name}
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
                          alloc.result === 'PAID' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                        }`}>{alloc.result}</span>
                      </div>
                    </div>
                  ))}
                  {breakdown.future_credit > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-blue-50/50 dark:bg-blue-500/5">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm text-blue-800 dark:text-blue-200 font-medium">Future Rent Credit</span>
                      </div>
                      <span className="text-sm font-bold text-blue-700 dark:text-blue-400">{fmt(breakdown.future_credit)}</span>
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
            {/* Tenant Selector / Metadata Display */}
            <div>
              {!context.tenantId && !currentTenant ? (
                /* Search Field (Only displayed in generic search-based mode) */
                <div className="space-y-2">
                  <label className="block text-xs text-muted-foreground mb-1.5">Select Tenant *</label>
                  <input
                    type="search"
                    value={tenantSearch}
                    onChange={(event) => setTenantSearch(event.target.value)}
                    className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                    placeholder="Search tenant by name, room, phone..."
                    autoFocus
                  />
                  <div className="max-h-60 overflow-y-auto rounded-xl border border-border bg-card divide-y divide-border">
                    {searchResults?.map((t: any) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelectTenant(t)}
                        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-secondary transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                            {t.name}
                            <span className="text-xs font-normal text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border">
                              {t.hostel_name} • Room {t.room_no}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t.phone} • {t.email || "No Email"}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-medium">
                            SD Billed: {fmt(t.security_deposit_billed)} • Paid: {fmt(t.security_deposit_paid)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-muted-foreground uppercase font-semibold">Outstanding</div>
                          <div className={`text-sm font-bold ${t.outstanding_dues > 0 ? 'text-amber-600 font-extrabold' : 'text-emerald-600 font-extrabold'}`}>
                            {fmt(t.outstanding_dues)}
                          </div>
                        </div>
                      </button>
                    ))}
                    {searchLoading && (
                      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin animate-duration-1000" /> Searching tenants...
                      </div>
                    )}
                    {!searchLoading && searchResults?.length === 0 && (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                        No active tenants found matching search.
                      </div>
                    )}
                  </div>
                </div>
              ) : currentTenant && (
                /* Detailed Selected Tenant Summary Panel */
                <div className="p-4 bg-secondary/50 rounded-xl border border-border space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">{currentTenant.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {currentTenant.phone} • {currentTenant.email || "No Email"}
                      </p>
                      <p className="text-xs font-medium text-foreground mt-1 bg-background inline-block px-2 py-0.5 rounded border border-border">
                        {currentTenant.hostel_name} • Room {currentTenant.room_no}
                      </p>
                    </div>
                    {/* Hide change button in context-aware mode */}
                    {!context.tenantId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTenant(null);
                          setAmount('');
                          setHasPrefilled(false);
                        }}
                        className="text-xs font-bold text-accent hover:underline px-2.5 py-1 bg-background rounded border border-border"
                      >
                        Change
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Outstanding</div>
                      <div className={`text-sm font-black ${currentTenant.outstanding_dues > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {fmt(currentTenant.outstanding_dues)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Future Credit</div>
                      <div className="text-sm font-bold text-blue-600">
                        {fmt(currentTenant.future_rent_credit)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-semibold">Security Deposit</div>
                      <div className="text-sm font-bold text-foreground">
                        {fmt(currentTenant.security_deposit_paid)} / {fmt(currentTenant.security_deposit_billed)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Specific Obligation Banner (Context-aware only) */}
            {currentTenant && targetObligation && (
              <div className="p-3.5 bg-amber-500/5 rounded-xl border border-amber-500/15 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                    Paying Rent Obligation
                  </span>
                  <span className="text-xs font-black text-amber-700 dark:text-amber-400">
                    {fmt(targetObligation.outstanding)} due
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground">
                  Rent for {new Date(targetObligation.rent_month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xs text-muted-foreground">
                  Due on {new Date(targetObligation.due_date).toLocaleDateString()}
                </p>
              </div>
            )}

            {/* V2: Amount — first class, no obligation selection needed */}
            {currentTenant && (
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
                {(() => {
                  const totalDue = targetObligation ? targetObligation.outstanding : (currentTenant.outstanding_dues || 0);
                  if (totalDue > 0) {
                    return (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => setAmount(String(totalDue))}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
                            parsedAmount === totalDue
                              ? 'bg-accent text-accent-foreground'
                              : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                          }`}
                        >
                          100% ({fmt(totalDue)})
                        </button>
                        {[75, 50, 25].map((pct) => {
                          const val = Math.round(totalDue * (pct / 100));
                          return (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => setAmount(String(val))}
                              className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
                                parsedAmount === val
                                  ? 'bg-accent text-accent-foreground'
                                  : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                              }`}
                            >
                              {pct}% ({fmt(val)})
                            </button>
                          );
                        })}
                      </div>
                    );
                  }
                  return null;
                })()}
                {!targetObligation && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Any amount accepted. System auto-settles obligations by priority.
                  </p>
                )}
              </div>
            )}

            {/* V2: Live Settlement Preview */}
            {previewEnabled && (
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
                            alloc.result === 'PAID' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                          }`}>{alloc.result}</span>
                        </div>
                      </div>
                    ))}
                    {previewData.future_credit > 0 && (
                      <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50/50 dark:bg-blue-500/5">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span className="text-sm text-blue-800 dark:text-blue-200 font-medium">Future Rent Credit</span>
                        </div>
                        <span className="text-sm font-bold text-blue-700 dark:text-blue-400">{fmt(previewData.future_credit)}</span>
                      </div>
                    )}
                    {previewData.allocations?.length === 0 && previewData.future_credit > 0 && (
                      <div className="px-4 py-3 text-xs text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/5">
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
            {currentTenant && (
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
            {currentTenant && (paymentMode === 'upi' || paymentMode === 'bank') && (
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
            {currentTenant && (
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
            {currentTenant && (
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
            {currentTenant && (
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
              disabled={mutation.isPending || !currentTenant || parsedAmount <= 0 || Boolean(successResult)}
              className="w-full bg-accent text-accent-foreground py-4 rounded-xl font-medium active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {mutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Verifying & Recording...</>
              ) : 'Record Payment'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
