import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, Phone, CheckCircle, Building2, CreditCard, ChevronDown, FileText, Loader2, CalendarDays, ExternalLink } from 'lucide-react';
import { ownerService } from '@features/owners/api';
import { paymentService } from '@features/payments/api';
import { tenantService } from '@features/tenants/api';
import { queryKeys } from '@lib/queryKeys';
import { RecordPaymentModal } from '../modals/RecordPaymentModal';

function fmt(n: unknown): string {
  const v = Number(n || 0);
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  return `₹${v.toLocaleString('en-IN')}`;
}

function daysOverdue(dueDateStr: unknown): number {
  if (!dueDateStr) return 0;
  const diff = Date.now() - new Date(String(dueDateStr)).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function daysUntilDue(dueDateStr: unknown): number {
  if (!dueDateStr) return 0;
  const diff = new Date(String(dueDateStr)).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text && text !== 'undefined' && text !== 'null') return text;
  }
  return '';
}

function dueBalance(due: Record<string, unknown>): number {
  const value = due.outstanding ?? due.remaining ?? due.balance ?? due.amount ?? 0;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

function WhatsAppIcon() {
  return (
    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.062 5.248 5.31 0 11.779 0c3.136.001 6.086 1.222 8.31 3.448 2.223 2.225 3.443 5.177 3.44 8.31-.005 6.545-5.253 11.793-11.722 11.793-1.996-.001-3.957-.509-5.698-1.474L0 24zm6.59-4.846c1.6.95 3.197 1.451 4.793 1.451 5.378 0 9.756-4.379 9.76-9.761.002-2.607-1.01-5.059-2.85-6.902C16.452 2.097 13.997 1.08 11.391 1.08c-5.385 0-9.766 4.381-9.77 9.763-.001 1.624.42 3.208 1.22 4.61L1.82 21.848l6.09-1.597zM17.06 13.9c-.3-.15-1.78-.88-2.05-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.23-.65.08-2.63-1.1-4.22-2.45-5.07-3.92-.22-.38.22-.35.63-1.16.08-.15.04-.28-.02-.43-.06-.15-.48-1.16-.66-1.59-.17-.42-.35-.36-.48-.37l-.4-.01c-.15 0-.4.06-.6.28-.2.22-.78.76-.78 1.86s.8 2.16.9 2.3c.12.15 1.58 2.41 3.83 3.38 2.25.97 2.25.65 2.65.61.4-.04 1.78-.73 2.03-1.43.25-.7.25-1.3.17-1.43-.08-.13-.28-.21-.58-.36z"/>
    </svg>
  );
}

export function AlertsView() {
  const queryClient = useQueryClient();
  const [selectedHostelId, setSelectedHostelId] = useState<string | null>(null);
  const [showHostelPicker, setShowHostelPicker] = useState(false);
  const [recordPayment, setRecordPayment] = useState<{ hostelId: string; dueId?: string; amount?: string } | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'overdue' | 'upcoming' | 'docs' | 'payments'>('all');

  const { data: hostelsData } = useQuery({
    queryKey: queryKeys.owner.hostels(),
    queryFn: ownerService.getHostels,
    staleTime: 5 * 60 * 1000,
  });

  const hostels: Record<string, unknown>[] = Array.isArray(hostelsData)
    ? hostelsData
    : Array.isArray((hostelsData as Record<string, unknown>)?.hostels)
    ? ((hostelsData as Record<string, unknown>).hostels as Record<string, unknown>[])
    : [];

  const activeHostelId = selectedHostelId ?? (hostels.length > 0 ? String(hostels[0].id ?? '') : null);
  const activeHostel = hostels.find((h) => String(h.id) === activeHostelId);

  const { data: duesData, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.payments.dues(activeHostelId ?? 'none'),
    queryFn: () => paymentService.getAllDues(activeHostelId!),
    enabled: !!activeHostelId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: pendingDocsData } = useQuery({
    queryKey: ['tenants', 'pending-documents', activeHostelId ?? 'none'],
    queryFn: () => tenantService.getPendingDocuments(activeHostelId || ''),
    enabled: !!activeHostelId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: billingRequestsData } = useQuery({
    queryKey: ['owner', 'billing-frequency-requests', activeHostelId ?? 'none'],
    queryFn: () => ownerService.getFrequencyChangeRequests({ hostelId: activeHostelId || '', status: 'PENDING' }),
    enabled: !!activeHostelId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const decisionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      ownerService.decideFrequencyChangeRequest(id, action),
    onSuccess: () => {
      toast.success('Billing request updated');
      queryClient.invalidateQueries({ queryKey: ['owner', 'billing-frequency-requests', activeHostelId ?? 'none'] });
      refetch();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || 'Could not update billing request');
    },
  });

  const billingRequests: Record<string, any>[] = Array.isArray(billingRequestsData)
    ? billingRequestsData
    : Array.isArray(billingRequestsData?.requests)
    ? billingRequestsData.requests
    : [];

  const { data: pendingPaymentsData, refetch: refetchPayments } = useQuery({
    queryKey: ['payments', 'pending-verification', activeHostelId ?? 'none'],
    queryFn: () => paymentService.getPendingVerifications(activeHostelId!),
    enabled: !!activeHostelId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: (attemptId: string) => paymentService.confirmPayment(attemptId),
    onSuccess: () => {
      toast.success('Payment confirmed successfully');
      queryClient.invalidateQueries({ queryKey: ['payments', 'pending-verification', activeHostelId ?? 'none'] });
      refetchPayments();
      refetch();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || 'Could not confirm payment');
    },
  });

  const rejectPaymentMutation = useMutation({
    mutationFn: (attemptId: string) => paymentService.rejectPayment(attemptId),
    onSuccess: () => {
      toast.success('Payment rejected');
      queryClient.invalidateQueries({ queryKey: ['payments', 'pending-verification', activeHostelId ?? 'none'] });
      refetchPayments();
      refetch();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || 'Could not reject payment');
    },
  });

  const pendingPayments: Record<string, any>[] = Array.isArray(pendingPaymentsData?.items)
    ? pendingPaymentsData.items
    : [];

  const pendingDocs: Record<string, any>[] = Array.isArray(pendingDocsData)
    ? pendingDocsData
    : [];

  const rawDues: Record<string, unknown>[] = Array.isArray(duesData)
    ? duesData
    : Array.isArray((duesData as Record<string, unknown>)?.dues)
    ? ((duesData as Record<string, unknown>).dues as Record<string, unknown>[])
    : [];
  const dues = rawDues.filter((due) => dueBalance(due) > 0);

  const now = Date.now();

  const sortedDues = [...dues].sort((a, b) => {
    const aDate = a.due_date ? new Date(String(a.due_date)).getTime() : 0;
    const bDate = b.due_date ? new Date(String(b.due_date)).getTime() : 0;
    const aOverdue = aDate < now;
    const bOverdue = bDate < now;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    return dueBalance(b) - dueBalance(a);
  });

  const overdueList = sortedDues.filter((d) => d.due_date && new Date(String(d.due_date)).getTime() < now);
  const pendingList = sortedDues.filter((d) => !d.due_date || new Date(String(d.due_date)).getTime() >= now);
  const totalOverdueAmount = overdueList.reduce((sum, d) => sum + dueBalance(d), 0);
  const actionsCount = overdueList.length + pendingPayments.length + billingRequests.length + pendingDocs.length;

  const showHighPriority = overdueList.length > 0 && (activeFilter === 'all' || activeFilter === 'overdue');
  const showMediumPriority = (pendingPayments.length > 0 || billingRequests.length > 0) && (activeFilter === 'all' || activeFilter === 'payments');
  const showLowPriority = (pendingDocs.length > 0 && (activeFilter === 'all' || activeFilter === 'docs')) || (pendingList.length > 0 && (activeFilter === 'all' || activeFilter === 'upcoming'));

  const hasData = overdueList.length > 0 || pendingList.length > 0 || pendingDocs.length > 0 || billingRequests.length > 0 || pendingPayments.length > 0;

  return (
    <div className="px-4 py-5 space-y-5 min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">Alerts & Verifications</h1>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">
            {isLoading ? (
              'Loading…'
            ) : (
              `${fmt(totalOverdueAmount)} at risk · ${actionsCount} action${actionsCount === 1 ? '' : 's'} needed`
            )}
          </p>
        </div>
        {hostels.length > 1 && (
          <div className="relative shrink-0">
            <button
              onClick={() => setShowHostelPicker((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-card border border-border rounded-lg text-xs font-medium text-foreground touch-manipulation"
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate max-w-[100px]">{activeHostel ? String(activeHostel.name ?? '') : 'Hostel'}</span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            </button>
            {showHostelPicker && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-20 min-w-[160px] overflow-hidden">
                {hostels.map((h) => (
                  <button
                    key={String(h.id)}
                    onClick={() => { setSelectedHostelId(String(h.id)); setShowHostelPicker(false); }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                      String(h.id) === activeHostelId ? 'bg-accent/10 text-accent font-medium' : 'text-foreground hover:bg-secondary'
                    }`}
                  >
                    {String(h.name ?? '')}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modern Status Chips summary */}
      {!isLoading && hasData && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
          <button
            onClick={() => setActiveFilter(activeFilter === 'overdue' ? 'all' : 'overdue')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shrink-0 ${
              activeFilter === 'overdue'
                ? 'bg-[#EF4444] text-white border-transparent shadow-sm'
                : 'bg-[#EF4444]/8 text-[#EF4444] border-[#EF4444]/20 hover:bg-[#EF4444]/15'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] shrink-0" style={{ display: activeFilter === 'overdue' ? 'none' : 'inline-block' }} />
            Overdue {overdueList.length}
          </button>
          <button
            onClick={() => setActiveFilter(activeFilter === 'upcoming' ? 'all' : 'upcoming')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shrink-0 ${
              activeFilter === 'upcoming'
                ? 'bg-[#F59E0B] text-white border-transparent shadow-sm'
                : 'bg-[#F59E0B]/8 text-[#F59E0B] border-[#F59E0B]/20 hover:bg-[#F59E0B]/15'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] shrink-0" style={{ display: activeFilter === 'upcoming' ? 'none' : 'inline-block' }} />
            Upcoming {pendingList.length}
          </button>
          <button
            onClick={() => setActiveFilter(activeFilter === 'docs' ? 'all' : 'docs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shrink-0 ${
              activeFilter === 'docs'
                ? 'bg-blue-600 text-white border-transparent shadow-sm'
                : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100/50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" style={{ display: activeFilter === 'docs' ? 'none' : 'inline-block' }} />
            Docs {pendingDocs.length}
          </button>
          <button
            onClick={() => setActiveFilter(activeFilter === 'payments' ? 'all' : 'payments')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shrink-0 ${
              activeFilter === 'payments'
                ? 'bg-emerald-600 text-white border-transparent shadow-sm'
                : 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100/50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" style={{ display: activeFilter === 'payments' ? 'none' : 'inline-block' }} />
            Payments {pendingPayments.length + billingRequests.length}
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 h-24 animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p className="text-sm text-muted-foreground">Failed to load dues</p>
          <button onClick={() => refetch()} className="text-xs text-accent font-medium active:scale-95 transition-transform">Retry</button>
        </div>
      )}

      {/* Empty State — All Clear */}
      {!isLoading && !isError && !hasData && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 bg-[#10B981]/10 rounded-full flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-[#10B981]" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">All clear</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-[280px] mx-auto">
              No outstanding payments, pending verifications, or billing requests.
            </p>
          </div>
        </div>
      )}

      {/* HIGH PRIORITY */}
      {!isLoading && showHighPriority && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-border pb-1">
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest bg-red-50 px-2 py-0.5 rounded">High Priority</span>
          </div>
          {overdueList.length > 0 && (activeFilter === 'all' || activeFilter === 'overdue') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#EF4444] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                  Overdue Rent
                </h3>
                <span className="text-[10px] bg-[#EF4444]/10 text-[#EF4444] px-1.5 py-0.5 rounded-md font-semibold">{overdueList.length}</span>
              </div>
              {overdueList.map((due, i) => (
                <DueCard
                  key={String(due.obligation_id ?? due.id ?? i)}
                  due={due}
                  isOverdue
                  activeHostel={activeHostel}
                  onRecordPayment={() =>
                    activeHostelId && setRecordPayment({
                      hostelId: activeHostelId,
                      dueId: String(due.obligation_id ?? due.id ?? i),
                      amount: String(dueBalance(due)),
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* MEDIUM PRIORITY */}
      {!isLoading && showMediumPriority && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 border-b border-border pb-1">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded">Medium Priority</span>
          </div>

          {/* Pending Payment Confirmation */}
          {pendingPayments.length > 0 && (activeFilter === 'all' || activeFilter === 'payments') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Pending Payment Confirmation
                </h3>
                <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md font-semibold">{pendingPayments.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingPayments.map((payment) => {
                  const attemptId = payment.attempt_id;
                  const tenantName = payment.tenant_name || 'Tenant';
                  const room = payment.room_no || 'N/A';
                  const amount = payment.amount;
                  const upiRef = payment.upi_reference || '—';
                  const isAdvance = payment.payment_type === 'ADVANCE' || payment.flow_type === 'ADVANCE';
                  const description = isAdvance ? 'Bulk Advance Payment' : `Rent for ${payment.rent_month || '—'}`;
                  const hostelName = activeHostel ? String(activeHostel.name ?? '') : 'Sri Adithya Hostels';

                  const rawPhone = String(payment.tenant_phone || '');
                  const telPhone = rawPhone ? rawPhone.replace(/[^\d+]/g, '') : null;
                  let paymentWhatsappUrl = null;
                  if (rawPhone) {
                    let clean = rawPhone.replace(/[^\d]/g, '');
                    if (clean.length === 10) {
                      clean = '91' + clean;
                    }
                    const message = `Hi ${tenantName}, this is regarding your rent payment of ${fmt(amount)} at ${hostelName}. I'm reviewing the UPI transaction reference ${upiRef}. Thank you!`;
                    paymentWhatsappUrl = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
                  }

                  return (
                    <div key={attemptId} className="bg-card border border-emerald-100 hover:border-emerald-200 rounded-xl p-3 flex flex-col justify-between gap-3 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold text-sm">
                          {tenantName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-semibold text-foreground truncate text-sm">{tenantName}</h4>
                            <span className="text-xs text-muted-foreground shrink-0">Room {room}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Amount: <span className="font-bold text-foreground">{fmt(amount)}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Type: <span className="font-semibold text-emerald-600">{description}</span>
                          </p>
                          {upiRef && (
                            <div className="mt-2 bg-secondary/50 p-2 rounded-lg text-xs font-mono select-all flex items-center justify-between">
                              <span className="text-muted-foreground">UPI Ref:</span>
                              <span className="font-semibold text-foreground">{upiRef}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {telPhone && (
                          <a
                            href={`tel:${telPhone}`}
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95 transition-all shrink-0"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        {paymentWhatsappUrl && (
                          <a
                            href={paymentWhatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 active:scale-95 transition-all shrink-0"
                          >
                            <WhatsAppIcon />
                          </a>
                        )}
                        <button
                          onClick={() => rejectPaymentMutation.mutate(attemptId)}
                          disabled={rejectPaymentMutation.isPending || confirmPaymentMutation.isPending}
                          className="flex-1 bg-secondary text-secondary-foreground py-2 rounded-lg text-xs font-semibold hover:bg-secondary/80 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {rejectPaymentMutation.isPending && rejectPaymentMutation.variables === attemptId && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          )}
                          Reject
                        </button>
                        <button
                          onClick={() => confirmPaymentMutation.mutate(attemptId)}
                          disabled={confirmPaymentMutation.isPending || rejectPaymentMutation.isPending}
                          className="flex-1 bg-accent text-accent-foreground py-2 rounded-lg text-xs font-semibold hover:opacity-90 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {confirmPaymentMutation.isPending && confirmPaymentMutation.variables === attemptId && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          )}
                          Confirm
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Billing Contract Requests */}
          {billingRequests.length > 0 && (activeFilter === 'all' || activeFilter === 'payments') && (
            <div className="space-y-3 mt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  Billing Contract Requests
                </h3>
                <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-md font-semibold">{billingRequests.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {billingRequests.map((req) => {
                  const reqId = req.id;
                  const tenantName = req.tenants?.profiles?.name || 'Tenant';
                  const requestedFrequency = String(req.requested_frequency).replaceAll('_', ' ');
                  const currentFrequency = String(req.active_frequency || 'MONTHLY').replaceAll('_', ' ');
                  const reason = req.reason ? String(req.reason) : 'No reason provided';
                  const effectiveFrom = req.effective_from ? new Date(req.effective_from) : null;
                  const hostelName = activeHostel ? String(activeHostel.name ?? '') : 'Sri Adithya Hostels';

                  const rawPhone = String(req.tenants?.profiles?.phone || '');
                  const telPhone = rawPhone ? rawPhone.replace(/[^\d+]/g, '') : null;
                  let reqWhatsappUrl = null;
                  if (rawPhone) {
                    let clean = rawPhone.replace(/[^\d]/g, '');
                    if (clean.length === 10) {
                      clean = '91' + clean;
                    }
                    const message = `Hi ${tenantName}, this is regarding your billing frequency change request to ${requestedFrequency} at ${hostelName}. Let's chat about this!`;
                    reqWhatsappUrl = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
                  }

                  return (
                    <div key={reqId} className="bg-card border border-purple-100 hover:border-purple-200 rounded-xl p-3 flex flex-col justify-between gap-3 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 font-bold text-sm">
                          {tenantName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground truncate text-sm">{tenantName}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Requested: <span className="font-semibold text-purple-600">{requestedFrequency}</span> (from {currentFrequency})
                          </p>
                          {effectiveFrom && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Effective: {effectiveFrom.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded-lg mt-2 italic">
                            "{reason}"
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {telPhone && (
                          <a
                            href={`tel:${telPhone}`}
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95 transition-all shrink-0"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        {reqWhatsappUrl && (
                          <a
                            href={reqWhatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 active:scale-95 transition-all shrink-0"
                          >
                            <WhatsAppIcon />
                          </a>
                        )}
                        <button
                          onClick={() => decisionMutation.mutate({ id: reqId, action: 'REJECT' })}
                          disabled={decisionMutation.isPending}
                          className="flex-1 bg-secondary text-secondary-foreground py-2 rounded-lg text-xs font-semibold hover:bg-secondary/80 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {decisionMutation.isPending && decisionMutation.variables?.id === reqId && decisionMutation.variables?.action === 'REJECT' && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          )}
                          Reject
                        </button>
                        <button
                          onClick={() => decisionMutation.mutate({ id: reqId, action: 'APPROVE' })}
                          disabled={decisionMutation.isPending}
                          className="flex-1 bg-accent text-accent-foreground py-2 rounded-lg text-xs font-semibold hover:opacity-90 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {decisionMutation.isPending && decisionMutation.variables?.id === reqId && decisionMutation.variables?.action === 'APPROVE' && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          )}
                          Approve
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* LOW PRIORITY */}
      {!isLoading && showLowPriority && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 border-b border-border pb-1">
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-widest font-mono">Low Priority</span>
          </div>

          {/* Missing Documents */}
          {pendingDocs.length > 0 && (activeFilter === 'all' || activeFilter === 'docs') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Missing Documents
                </h3>
                <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-semibold">{pendingDocs.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingDocs.map((doc) => {
                  const docId = firstNonEmptyString(doc.id);
                  const tenantId = firstNonEmptyString(doc.tenant_id, doc.tenantId, (doc.tenant as Record<string, unknown> | undefined)?.id);
                  const hostelId = firstNonEmptyString(doc.hostel_id, doc.hostelId, activeHostelId);
                  const profilePath = tenantId && hostelId ? `/hostels/${hostelId}/tenants/${tenantId}?tab=documents` : '';
                  const name = String(doc.tenant_name || 'Tenant');
                  const docType = String(doc.doc_type || 'Document');
                  const room = String(doc.room_no || 'N/A');
                  const uploadedAt = doc.uploaded_at ? new Date(String(doc.uploaded_at)) : null;
                  const avatarUrl = doc.photo_url ?? doc.avatar ?? doc.tenant_avatar ?? doc.tenant_avatar_url ?? doc.avatar_url;
                  const hostelName = activeHostel ? String(activeHostel.name ?? '') : 'Sri Adithya Hostels';

                  const rawPhone = String(doc.tenant_phone || '');
                  const telPhone = rawPhone ? rawPhone.replace(/[^\d+]/g, '') : null;
                  let docWhatsappUrl = null;
                  if (rawPhone) {
                    let clean = rawPhone.replace(/[^\d]/g, '');
                    if (clean.length === 10) {
                      clean = '91' + clean;
                    }
                    const message = `Hi ${name}, this is a reminder to please upload your pending document (${docType}) for verification at ${hostelName}. Thank you!`;
                    docWhatsappUrl = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
                  }

                  return (
                    <div key={docId} className="bg-card border border-blue-100 hover:border-blue-200 rounded-xl p-3 flex flex-col justify-between gap-3 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3">
                        {avatarUrl ? (
                          <img src={String(avatarUrl)} alt={name} className="w-10 h-10 rounded-full object-cover shrink-0 border border-border" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-bold text-sm">
                            {name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-semibold text-foreground truncate text-sm">{name}</h4>
                            <span className="text-xs text-muted-foreground shrink-0">Room {room}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Document: <span className="font-semibold text-blue-600">{docType}</span>
                          </p>
                          {uploadedAt && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Uploaded {uploadedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {telPhone && (
                          <a
                            href={`tel:${telPhone}`}
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95 transition-all shrink-0"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        {docWhatsappUrl && (
                          <a
                            href={docWhatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 active:scale-95 transition-all shrink-0"
                          >
                            <WhatsAppIcon />
                          </a>
                        )}
                        {profilePath && (
                          <Link
                            to={profilePath}
                            className="flex-1 bg-accent text-accent-foreground py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-98 transition-all"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Verify
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming Rent */}
          {pendingList.length > 0 && (activeFilter === 'all' || activeFilter === 'upcoming') && (
            <div className="space-y-3 mt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#F59E0B] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                  Upcoming Rent
                </h3>
                <span className="text-[10px] bg-[#F59E0B]/10 text-[#F59E0B] px-1.5 py-0.5 rounded-md font-semibold">{pendingList.length}</span>
              </div>
              {pendingList.map((due, i) => (
                <DueCard
                  key={String(due.obligation_id ?? due.id ?? i)}
                  due={due}
                  isOverdue={false}
                  activeHostel={activeHostel}
                  onRecordPayment={() =>
                    activeHostelId && setRecordPayment({
                      hostelId: activeHostelId,
                      dueId: String(due.obligation_id ?? due.id ?? i),
                      amount: String(dueBalance(due)),
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Record Payment Modal */}
      {recordPayment && (
        <RecordPaymentModal
          hostelId={recordPayment.hostelId}
          initialDueId={recordPayment.dueId}
          initialAmount={recordPayment.amount}
          onClose={() => setRecordPayment(null)}
        />
      )}
    </div>
  );
}

interface DueCardProps {
  due: Record<string, unknown>;
  isOverdue: boolean;
  activeHostel: Record<string, unknown> | undefined;
  onRecordPayment: () => void;
}

function DueCard({ due, isOverdue, activeHostel, onRecordPayment }: DueCardProps) {
  const amount = dueBalance(due);
  const tenantName = String(due.tenant_name ?? due.name ?? 'Tenant');
  const room = due.room_no ?? due.room_number;
  const rawPhone = due.phone ?? due.tenant_phone ?? due.tenantPhone;
  const phone = rawPhone ? String(rawPhone).trim() : null;
  const telPhone = phone ? phone.replace(/[^\d+]/g, '') : null;
  const avatarUrl = due.photo_url ?? due.avatar ?? due.tenant_avatar ?? due.tenant_avatar_url ?? due.avatar_url;

  const days = isOverdue ? daysOverdue(due.due_date) : daysUntilDue(due.due_date);
  const formattedDueDate = due.due_date
    ? new Date(String(due.due_date)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '';

  const urgencyLabel = isOverdue
    ? (days > 0 ? `${days}d overdue (Due ${formattedDueDate})` : `Overdue (Due ${formattedDueDate})`)
    : (days > 0 ? `Due in ${days}d (${formattedDueDate})` : `Due today (${formattedDueDate})`);

  const hostelName = activeHostel ? String(activeHostel.name ?? '') : 'Sri Adithya Hostels';
  let whatsappUrl = null;
  if (phone) {
    let clean = phone.replace(/[^\d]/g, '');
    if (clean.length === 10) {
      clean = '91' + clean;
    }
    const message = `Hi ${tenantName}, this is a friendly reminder regarding your rent of ${fmt(amount)} at ${hostelName}. Please clear it at your earliest convenience or let us know if you've already paid. Thank you!`;
    whatsappUrl = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  }

  return (
    <div className={`bg-card border ${isOverdue ? 'border-red-100 hover:border-red-200' : 'border-amber-100 hover:border-amber-200'} rounded-xl p-3 flex items-center justify-between gap-3 min-w-0 shadow-sm transition-all hover:shadow-md`}>
      <div className="flex items-center gap-3 min-w-0">
        {/* Profile Pic / Initial */}
        {avatarUrl ? (
          <img src={String(avatarUrl)} alt={tenantName} className="w-10 h-10 rounded-full object-cover shrink-0 border border-border" />
        ) : (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            isOverdue ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
          }`}>
            <span className="text-sm font-bold">{tenantName.charAt(0).toUpperCase()}</span>
          </div>
        )}

        {/* Details */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-semibold text-foreground truncate text-sm">{tenantName}</h4>
            {room && <span className="text-xs text-muted-foreground shrink-0">· Room {String(room)}</span>}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
              isOverdue ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
            }`}>
              {urgencyLabel}
            </span>
            <span className="text-xs font-bold text-foreground">{fmt(amount)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0 ml-1">
        {telPhone && (
          <a
            href={`tel:${telPhone}`}
            aria-label={`Call ${tenantName}`}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95 transition-all"
          >
            <Phone className="w-4 h-4" />
          </a>
        )}
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`WhatsApp ${tenantName}`}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 active:scale-95 transition-all"
          >
            <WhatsAppIcon />
          </a>
        )}
        <button
          onClick={onRecordPayment}
          aria-label="Record Payment"
          className="w-9 h-9 flex items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm hover:opacity-90 active:scale-95 transition-all"
        >
          <CreditCard className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
