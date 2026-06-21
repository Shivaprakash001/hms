import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, Phone, CheckCircle, Building2, CreditCard, ChevronDown, FileText, Loader2, CalendarDays, ExternalLink } from 'lucide-react';
import { ownerService } from '@features/owners/api';
import { paymentService } from '@features/payments/api';
import { tenantService } from '@features/tenants/api';
import { moveOutService } from '@features/move-out/api';
import { agreementService } from '@features/agreements/api';
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
  const [activeFilter, setActiveFilter] = useState<'all' | 'overdue' | 'renewals' | 'docs' | 'payments' | 'move-out'>('all');

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

  const { data: moveOutData } = useQuery({
    queryKey: queryKeys.moveOut.list(activeHostelId ?? 'none'),
    queryFn: () => moveOutService.listRequests(activeHostelId || ''),
    enabled: !!activeHostelId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const moveOutRequests: Record<string, any>[] = Array.isArray(moveOutData?.requests)
    ? moveOutData.requests
    : [];

  const activeMoveOutRequests = moveOutRequests.filter(
    (req) => req.status !== 'COMPLETED' && req.status !== 'REJECTED' && req.status !== 'CANCELLED'
  );

  const { data: renewalQueueData } = useQuery({
    queryKey: ['agreements', 'renewal-queue', activeHostelId ?? 'none', 'all'],
    queryFn: () => agreementService.getRenewalQueue({ hostelId: activeHostelId || '', filter: 'all' }),
    enabled: !!activeHostelId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const renewalRequests: Record<string, any>[] = Array.isArray(renewalQueueData?.renewals)
    ? renewalQueueData.renewals
    : [];

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

  // Group overdue rent by tenant
  const groupedOverdueMap: Record<string, any> = {};
  for (const due of overdueList) {
    const tId = firstNonEmptyString(due.tenant_id, due.tenantId);
    if (!tId) continue;
    const amount = dueBalance(due);
    if (amount <= 0) continue;

    if (!groupedOverdueMap[tId]) {
      groupedOverdueMap[tId] = {
        tenant_id: tId,
        tenant_name: String(due.tenant_name ?? due.name ?? 'Tenant'),
        room_no: String(due.room_no ?? due.room_number ?? 'N/A'),
        tenant_phone: String(due.phone ?? due.tenant_phone ?? due.tenantPhone ?? ''),
        photo_url: due.photo_url,
        avatar: due.avatar,
        tenant_avatar: due.tenant_avatar,
        tenant_avatar_url: due.tenant_avatar_url,
        avatar_url: due.avatar_url,
        total_amount: 0,
        oldest_due_date: due.due_date ? String(due.due_date) : '',
        dues_count: 0,
        oldest_due_id: String(due.obligation_id ?? due.id ?? ''),
        dues: [],
      };
    }

    const entry = groupedOverdueMap[tId];
    entry.total_amount += amount;
    entry.dues_count += 1;
    entry.dues.push(due);

    if (due.due_date && entry.oldest_due_date) {
      if (new Date(String(due.due_date)).getTime() < new Date(entry.oldest_due_date).getTime()) {
        entry.oldest_due_date = String(due.due_date);
        entry.oldest_due_id = String(due.obligation_id ?? due.id ?? '');
      }
    } else if (due.due_date) {
      entry.oldest_due_date = String(due.due_date);
      entry.oldest_due_id = String(due.obligation_id ?? due.id ?? '');
    }
  }
  const groupedOverdueList = Object.values(groupedOverdueMap);

  // Group pending payments by tenant
  const groupedPaymentsMap: Record<string, any> = {};
  for (const payment of pendingPayments) {
    const tId = firstNonEmptyString(payment.tenant_id, payment.tenantId);
    if (!tId) continue;

    if (!groupedPaymentsMap[tId]) {
      groupedPaymentsMap[tId] = {
        tenant_id: tId,
        tenant_name: payment.tenant_name || 'Tenant',
        room_no: payment.room_no || 'N/A',
        tenant_phone: payment.tenant_phone || '',
        photo_url: payment.photo_url || payment.avatar || payment.tenant_avatar || payment.tenant_avatar_url || payment.avatar_url,
        payments: [],
      };
    }
    groupedPaymentsMap[tId].payments.push(payment);
  }
  const groupedPaymentsList = Object.values(groupedPaymentsMap);

  // Group billing requests by tenant
  const groupedBillingMap: Record<string, any> = {};
  for (const req of billingRequests) {
    const tId = firstNonEmptyString(req.tenant_id, req.tenantId, req.tenants?.id);
    if (!tId) continue;

    if (!groupedBillingMap[tId]) {
      groupedBillingMap[tId] = {
        tenant_id: tId,
        tenant_name: req.tenants?.profiles?.name || 'Tenant',
        room_no: req.room_no || 'N/A',
        tenant_phone: req.tenants?.profiles?.phone || '',
        requests: [],
      };
    }
    groupedBillingMap[tId].requests.push(req);
  }
  const groupedBillingList = Object.values(groupedBillingMap);

  // Group pending documents by tenant
  const groupedDocsMap: Record<string, any> = {};
  for (const doc of pendingDocs) {
    const tId = firstNonEmptyString(doc.tenant_id, doc.tenantId, (doc.tenant as Record<string, unknown> | undefined)?.id);
    if (!tId) continue;

    if (!groupedDocsMap[tId]) {
      groupedDocsMap[tId] = {
        tenant_id: tId,
        tenant_name: String(doc.tenant_name || 'Tenant'),
        room_no: String(doc.room_no || 'N/A'),
        tenant_phone: String(doc.tenant_phone || ''),
        avatar_url: doc.photo_url ?? doc.avatar ?? doc.tenant_avatar ?? doc.tenant_avatar_url ?? doc.avatar_url,
        documents: [],
      };
    }
    groupedDocsMap[tId].documents.push(doc);
  }
  const groupedDocsList = Object.values(groupedDocsMap);

  const totalOverdueAmount = overdueList.reduce((sum, d) => sum + dueBalance(d), 0);
  const actionsCount =
    groupedOverdueList.length +
    groupedPaymentsList.length +
    groupedBillingList.length +
    groupedDocsList.length +
    activeMoveOutRequests.length +
    renewalRequests.length;

  const showHighPriority =
    groupedOverdueList.length > 0 &&
    (activeFilter === 'all' || activeFilter === 'overdue');

  const showMediumPriority =
    (groupedPaymentsList.length > 0 || groupedBillingList.length > 0 || activeMoveOutRequests.length > 0 || renewalRequests.length > 0) &&
    (activeFilter === 'all' || activeFilter === 'payments' || activeFilter === 'move-out' || activeFilter === 'renewals');

  const showLowPriority =
    groupedDocsList.length > 0 && (activeFilter === 'all' || activeFilter === 'docs');

  const hasData =
    groupedOverdueList.length > 0 ||
    groupedDocsList.length > 0 ||
    groupedBillingList.length > 0 ||
    groupedPaymentsList.length > 0 ||
    activeMoveOutRequests.length > 0 ||
    renewalRequests.length > 0;

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
            Overdue {groupedOverdueList.length}
          </button>

          <button
            onClick={() => setActiveFilter(activeFilter === 'renewals' ? 'all' : 'renewals')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shrink-0 ${
              activeFilter === 'renewals'
                ? 'bg-[#F59E0B] text-white border-transparent shadow-sm'
                : 'bg-[#F59E0B]/8 text-[#F59E0B] border-[#F59E0B]/20 hover:bg-[#F59E0B]/15'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] shrink-0" style={{ display: activeFilter === 'renewals' ? 'none' : 'inline-block' }} />
            Renewals {renewalRequests.length}
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
            Docs {groupedDocsList.length}
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
            Payments {groupedPaymentsList.length + groupedBillingList.length}
          </button>
          <button
            onClick={() => setActiveFilter(activeFilter === 'move-out' ? 'all' : 'move-out')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shrink-0 ${
              activeFilter === 'move-out'
                ? 'bg-rose-600 text-white border-transparent shadow-sm'
                : 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100/50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" style={{ display: activeFilter === 'move-out' ? 'none' : 'inline-block' }} />
            Move-outs {activeMoveOutRequests.length}
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
          {groupedOverdueList.length > 0 && (activeFilter === 'all' || activeFilter === 'overdue') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#EF4444] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
                  Overdue Rent
                </h3>
                <span className="text-[10px] bg-[#EF4444]/10 text-[#EF4444] px-1.5 py-0.5 rounded-md font-semibold">{groupedOverdueList.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groupedOverdueList.map((gDue: any) => (
                  <GroupedDueCard
                    key={gDue.tenant_id}
                    tenantId={gDue.tenant_id}
                    tenantName={gDue.tenant_name}
                    roomNo={gDue.room_no}
                    tenantPhone={gDue.tenant_phone}
                    avatarUrl={gDue.photo_url ?? gDue.avatar ?? gDue.tenant_avatar ?? gDue.tenant_avatar_url ?? gDue.avatar_url}
                    totalAmount={gDue.total_amount}
                    duesCount={gDue.dues_count}
                    oldestDueDate={gDue.oldest_due_date}
                    dues={gDue.dues}
                    isOverdue={true}
                    activeHostel={activeHostel}
                    onRecordPayment={(dueId, amount) =>
                      activeHostelId && setRecordPayment({
                        hostelId: activeHostelId,
                        dueId,
                        amount,
                      })
                    }
                  />
                ))}
              </div>
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
          {groupedPaymentsList.length > 0 && (activeFilter === 'all' || activeFilter === 'payments') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Pending Payment Confirmation
                </h3>
                <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md font-semibold">{groupedPaymentsList.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groupedPaymentsList.map((gPayment: any) => (
                  <GroupedPaymentCard
                    key={gPayment.tenant_id}
                    tenantName={gPayment.tenant_name}
                    roomNo={gPayment.room_no}
                    tenantPhone={gPayment.tenant_phone}
                    avatarUrl={gPayment.photo_url}
                    payments={gPayment.payments}
                    activeHostel={activeHostel}
                    onConfirm={(attemptId) => confirmPaymentMutation.mutate(attemptId)}
                    onReject={(attemptId) => rejectPaymentMutation.mutate(attemptId)}
                    confirmPending={confirmPaymentMutation.isPending}
                    rejectPending={rejectPaymentMutation.isPending}
                    pendingAttemptId={
                      confirmPaymentMutation.isPending
                        ? String(confirmPaymentMutation.variables ?? '')
                        : rejectPaymentMutation.isPending
                        ? String(rejectPaymentMutation.variables ?? '')
                        : null
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Billing Contract Requests */}
          {groupedBillingList.length > 0 && (activeFilter === 'all' || activeFilter === 'payments') && (
            <div className="space-y-3 mt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  Billing Contract Requests
                </h3>
                <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-md font-semibold">{groupedBillingList.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groupedBillingList.map((gBilling: any) => (
                  <GroupedBillingCard
                    key={gBilling.tenant_id}
                    tenantName={gBilling.tenant_name}
                    roomNo={gBilling.room_no}
                    tenantPhone={gBilling.tenant_phone}
                    requests={gBilling.requests}
                    activeHostel={activeHostel}
                    onApprove={(id) => decisionMutation.mutate({ id, action: 'APPROVE' })}
                    onReject={(id) => decisionMutation.mutate({ id, action: 'REJECT' })}
                    pendingDecision={decisionMutation.isPending}
                    pendingId={decisionMutation.isPending ? String(decisionMutation.variables?.id ?? '') : null}
                    pendingAction={decisionMutation.isPending ? decisionMutation.variables?.action : null}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Move-out Requests */}
          {activeMoveOutRequests.length > 0 && (activeFilter === 'all' || activeFilter === 'move-out') && (
            <div className="space-y-3 mt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  Move-out Requests
                </h3>
                <span className="text-[10px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-md font-semibold">{activeMoveOutRequests.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeMoveOutRequests.map((req) => (
                  <MoveOutCard key={req.id} request={req} activeHostel={activeHostel} />
                ))}
              </div>
            </div>
          )}

          {/* Agreement Renewal Requests */}
          {renewalRequests.length > 0 && (activeFilter === 'all' || activeFilter === 'renewals') && (
            <div className="space-y-3 mt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Agreement Renewal Requests
                </h3>
                <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md font-semibold">{renewalRequests.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {renewalRequests.map((row) => {
                  const agreement = row.current_agreement || {};
                  const tenant = row.tenant || {};
                  const critical = ['EXPIRED_AND_RENT_OVERDUE', 'RENEWAL_OVERDUE_CRITICAL'].includes(row.decision_state);
                  return (
                    <RenewalAlertCard
                      key={agreement.id}
                      row={row}
                      critical={critical}
                      agreement={agreement}
                      tenant={tenant}
                      activeHostel={activeHostel}
                    />
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
          {groupedDocsList.length > 0 && (activeFilter === 'all' || activeFilter === 'docs') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Missing Documents
                </h3>
                <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-semibold">{groupedDocsList.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groupedDocsList.map((gDocs: any) => {
                  const firstDoc = gDocs.documents[0];
                  const hostelId = firstNonEmptyString(firstDoc.hostel_id, firstDoc.hostelId, activeHostelId);
                  const profilePath = gDocs.tenant_id && hostelId ? `/hostels/${hostelId}/tenants/${gDocs.tenant_id}?tab=documents` : '';

                  return (
                    <GroupedDocsCard
                      key={gDocs.tenant_id}
                      tenantName={gDocs.tenant_name}
                      roomNo={gDocs.room_no}
                      tenantPhone={gDocs.tenant_phone}
                      avatarUrl={gDocs.avatar_url}
                      documents={gDocs.documents}
                      activeHostel={activeHostel}
                      profilePath={profilePath}
                    />
                  );
                })}
              </div>
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

interface GroupedDueCardProps {
  tenantId: string;
  tenantName: string;
  roomNo: string;
  tenantPhone: string;
  avatarUrl?: string;
  totalAmount: number;
  duesCount: number;
  oldestDueDate?: string;
  dues: Record<string, any>[];
  isOverdue: boolean;
  activeHostel: Record<string, unknown> | undefined;
  onRecordPayment: (dueId: string, amount: string) => void;
}

function GroupedDueCard({
  tenantId,
  tenantName,
  roomNo,
  tenantPhone,
  avatarUrl,
  totalAmount,
  duesCount,
  oldestDueDate,
  dues,
  isOverdue,
  activeHostel,
  onRecordPayment,
}: GroupedDueCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const telPhone = tenantPhone ? tenantPhone.replace(/[^\d+]/g, '') : null;
  const hostelName = activeHostel ? String(activeHostel.name ?? '') : 'Sri Adithya Boys Hostel';

  let whatsappUrl = null;
  if (tenantPhone) {
    let clean = tenantPhone.replace(/[^\d]/g, '');
    if (clean.length === 10) {
      clean = '91' + clean;
    }
    const message = `Hi ${tenantName}, this is a friendly reminder regarding your outstanding rent of ${fmt(totalAmount)} at ${hostelName}. Please clear it at your earliest convenience. Thank you!`;
    whatsappUrl = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  }

  const formattedDate = oldestDueDate
    ? new Date(oldestDueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '';

  const label = isOverdue
    ? `Overdue (${duesCount} item${duesCount > 1 ? 's' : ''})`
    : `Upcoming (${duesCount} item${duesCount > 1 ? 's' : ''})`;

  return (
    <div className={`bg-card border ${isOverdue ? 'border-red-100 hover:border-red-200' : 'border-amber-100 hover:border-amber-200'} rounded-xl p-3 flex flex-col gap-3 shadow-sm transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={tenantName} className="w-10 h-10 rounded-full object-cover shrink-0 border border-border" />
          ) : (
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${isOverdue ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
              {tenantName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="font-semibold text-foreground truncate text-sm">{tenantName}</h4>
              <span className="text-xs text-muted-foreground shrink-0">· Room {roomNo}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${isOverdue ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                {label}
              </span>
              <span className="text-xs font-bold text-foreground">{fmt(totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
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
          {dues.length > 1 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95 transition-all"
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
          {dues.length === 1 && (
            <button
              onClick={() => onRecordPayment(String(dues[0].obligation_id ?? dues[0].id), String(dueBalance(dues[0])))}
              aria-label="Record Payment"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm hover:opacity-90 active:scale-95 transition-all"
            >
              <CreditCard className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {isExpanded && dues.length > 1 && (
        <div className="mt-1 pt-2 border-t border-border space-y-2">
          {dues.map((due, idx) => {
            const dueId = String(due.obligation_id ?? due.id ?? idx);
            const bal = dueBalance(due);
            const dueDate = due.due_date ? new Date(String(due.due_date)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
            return (
              <div key={dueId} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 text-xs">
                <div>
                  <p className="font-medium text-foreground">{due.description || 'Rent'}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Due {dueDate}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{fmt(bal)}</span>
                  <button
                    onClick={() => onRecordPayment(dueId, String(bal))}
                    className="p-1.5 rounded-full bg-accent text-accent-foreground hover:opacity-90 active:scale-95 transition-all"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface GroupedPaymentCardProps {
  tenantName: string;
  roomNo: string;
  tenantPhone: string;
  avatarUrl?: string;
  payments: Record<string, any>[];
  activeHostel: Record<string, unknown> | undefined;
  onConfirm: (attemptId: string) => void;
  onReject: (attemptId: string) => void;
  confirmPending: boolean;
  rejectPending: boolean;
  pendingAttemptId: string | null;
}

function GroupedPaymentCard({
  tenantName,
  roomNo,
  tenantPhone,
  avatarUrl,
  payments,
  activeHostel,
  onConfirm,
  onReject,
  confirmPending,
  rejectPending,
  pendingAttemptId,
}: GroupedPaymentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const telPhone = tenantPhone ? tenantPhone.replace(/[^\d+]/g, '') : null;
  const hostelName = activeHostel ? String(activeHostel.name ?? '') : 'Sri Adithya Boys Hostel';

  let whatsappUrl = null;
  if (tenantPhone) {
    let clean = tenantPhone.replace(/[^\d]/g, '');
    if (clean.length === 10) {
      clean = '91' + clean;
    }
    const message = `Hi ${tenantName}, this is regarding your rent payment confirmation request${payments.length > 1 ? 's' : ''} at ${hostelName}. Let's chat about this.`;
    whatsappUrl = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  }

  const totalAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return (
    <div className="bg-card border border-emerald-100 hover:border-emerald-200 rounded-xl p-3 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={tenantName} className="w-10 h-10 rounded-full object-cover shrink-0 border border-border" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold text-sm">
              {tenantName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="font-semibold text-foreground truncate text-sm">{tenantName}</h4>
              <span className="text-xs text-muted-foreground shrink-0">· Room {roomNo}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md">
                Pending Confirmation ({payments.length})
              </span>
              <span className="text-xs font-bold text-foreground">{fmt(totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {telPhone && (
            <a
              href={`tel:${telPhone}`}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95 transition-all shrink-0"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 active:scale-95 transition-all shrink-0"
            >
              <WhatsAppIcon />
            </a>
          )}
          {payments.length > 1 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95 transition-all"
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {!isExpanded || payments.length === 1 ? (
        <div className="space-y-2">
          {payments.length > 1 && (
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Showing oldest request. Expand to manage all.</p>
          )}
          {(() => {
            const payment = payments[0];
            const upiRef = payment.upi_reference || '—';
            const isAdvance = payment.payment_type === 'ADVANCE' || payment.flow_type === 'ADVANCE';
            const description = isAdvance ? 'Security Deposit' : `Rent for ${payment.rent_month || '—'}`;
            return (
              <div className="bg-secondary/20 p-2.5 rounded-lg flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{description}</span>
                  <span className="font-bold text-foreground">{fmt(payment.amount)}</span>
                </div>
                {upiRef && upiRef !== '—' && (
                  <div className="bg-secondary/50 p-1.5 rounded text-[10px] font-mono select-all flex items-center justify-between">
                    <span className="text-muted-foreground">UPI:</span>
                    <span className="font-semibold text-foreground">{upiRef}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => onReject(payment.attempt_id)}
                    disabled={rejectPending || confirmPending}
                    className="flex-1 bg-secondary text-secondary-foreground py-1.5 rounded-md text-[11px] font-semibold hover:bg-secondary/80 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {rejectPending && pendingAttemptId === payment.attempt_id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Reject
                  </button>
                  <button
                    onClick={() => onConfirm(payment.attempt_id)}
                    disabled={confirmPending || rejectPending}
                    className="flex-1 bg-accent text-accent-foreground py-1.5 rounded-md text-[11px] font-semibold hover:opacity-90 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {confirmPending && pendingAttemptId === payment.attempt_id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Confirm
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="space-y-3 pt-2 border-t border-border">
          {payments.map((payment) => {
            const upiRef = payment.upi_reference || '—';
            const isAdvance = payment.payment_type === 'ADVANCE' || payment.flow_type === 'ADVANCE';
            const description = isAdvance ? 'Security Deposit' : `Rent for ${payment.rent_month || '—'}`;
            return (
              <div key={payment.attempt_id} className="bg-secondary/20 p-2.5 rounded-lg flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{description}</span>
                  <span className="font-bold text-foreground">{fmt(payment.amount)}</span>
                </div>
                {upiRef && upiRef !== '—' && (
                  <div className="bg-secondary/50 p-1.5 rounded text-[10px] font-mono select-all flex items-center justify-between">
                    <span className="text-muted-foreground">UPI:</span>
                    <span className="font-semibold text-foreground">{upiRef}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => onReject(payment.attempt_id)}
                    disabled={rejectPending || confirmPending}
                    className="flex-1 bg-secondary text-secondary-foreground py-1.5 rounded-md text-[11px] font-semibold hover:bg-secondary/80 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {rejectPending && pendingAttemptId === payment.attempt_id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Reject
                  </button>
                  <button
                    onClick={() => onConfirm(payment.attempt_id)}
                    disabled={confirmPending || rejectPending}
                    className="flex-1 bg-accent text-accent-foreground py-1.5 rounded-md text-[11px] font-semibold hover:opacity-90 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {confirmPending && pendingAttemptId === payment.attempt_id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Confirm
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface GroupedBillingCardProps {
  tenantName: string;
  roomNo: string;
  tenantPhone: string;
  requests: Record<string, any>[];
  activeHostel: Record<string, unknown> | undefined;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  pendingDecision: boolean;
  pendingId: string | null;
  pendingAction: 'APPROVE' | 'REJECT' | null;
}

function GroupedBillingCard({
  tenantName,
  roomNo,
  tenantPhone,
  requests,
  activeHostel,
  onApprove,
  onReject,
  pendingDecision,
  pendingId,
  pendingAction,
}: GroupedBillingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const telPhone = tenantPhone ? tenantPhone.replace(/[^\d+]/g, '') : null;
  const hostelName = activeHostel ? String(activeHostel.name ?? '') : 'Sri Adithya Boys Hostel';

  let whatsappUrl = null;
  if (tenantPhone) {
    let clean = tenantPhone.replace(/[^\d]/g, '');
    if (clean.length === 10) {
      clean = '91' + clean;
    }
    const message = `Hi ${tenantName}, this is regarding your billing frequency change request at ${hostelName}. Let's chat!`;
    whatsappUrl = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  }

  return (
    <div className="bg-card border border-purple-100 hover:border-purple-200 rounded-xl p-3 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 font-bold text-sm">
            {tenantName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="font-semibold text-foreground truncate text-sm">{tenantName}</h4>
              <span className="text-xs text-muted-foreground shrink-0">· Room {roomNo}</span>
            </div>
            <p className="text-[10px] font-semibold bg-purple-50 text-purple-600 px-2 py-0.5 rounded-md mt-1 w-max">
              Billing Request ({requests.length})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {telPhone && (
            <a
              href={`tel:${telPhone}`}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95 transition-all shrink-0"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 active:scale-95 transition-all shrink-0"
            >
              <WhatsAppIcon />
            </a>
          )}
          {requests.length > 1 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95 transition-all"
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {!isExpanded || requests.length === 1 ? (
        <div className="space-y-2">
          {requests.length > 1 && (
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Showing oldest request. Expand to manage all.</p>
          )}
          {(() => {
            const req = requests[0];
            const requestedFrequency = String(req.requested_frequency).replaceAll('_', ' ');
            const currentFrequency = String(req.active_frequency || 'MONTHLY').replaceAll('_', ' ');
            const reason = req.reason ? String(req.reason) : 'No reason provided';
            const effectiveFrom = req.effective_from ? new Date(req.effective_from) : null;
            return (
              <div className="bg-secondary/20 p-2.5 rounded-lg flex flex-col gap-2">
                <div className="text-xs text-foreground">
                  Change to <span className="font-semibold text-purple-600">{requestedFrequency}</span> (from {currentFrequency})
                </div>
                {effectiveFrom && (
                  <p className="text-[10px] text-muted-foreground">
                    Effective: {effectiveFrom.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                )}
                {reason && (
                  <p className="text-[11px] text-muted-foreground bg-secondary/50 p-2 rounded-lg italic">
                    "{reason}"
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => onReject(req.id)}
                    disabled={pendingDecision}
                    className="flex-1 bg-secondary text-secondary-foreground py-1.5 rounded-md text-[11px] font-semibold hover:bg-secondary/80 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {pendingDecision && pendingId === req.id && pendingAction === 'REJECT' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Reject
                  </button>
                  <button
                    onClick={() => onApprove(req.id)}
                    disabled={pendingDecision}
                    className="flex-1 bg-accent text-accent-foreground py-1.5 rounded-md text-[11px] font-semibold hover:opacity-90 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {pendingDecision && pendingId === req.id && pendingAction === 'APPROVE' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Approve
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="space-y-3 pt-2 border-t border-border">
          {requests.map((req) => {
            const requestedFrequency = String(req.requested_frequency).replaceAll('_', ' ');
            const currentFrequency = String(req.active_frequency || 'MONTHLY').replaceAll('_', ' ');
            const reason = req.reason ? String(req.reason) : 'No reason provided';
            const effectiveFrom = req.effective_from ? new Date(req.effective_from) : null;
            return (
              <div key={req.id} className="bg-secondary/20 p-2.5 rounded-lg flex flex-col gap-2">
                <div className="text-xs text-foreground">
                  Change to <span className="font-semibold text-purple-600">{requestedFrequency}</span> (from {currentFrequency})
                </div>
                {effectiveFrom && (
                  <p className="text-[10px] text-muted-foreground">
                    Effective: {effectiveFrom.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                )}
                {reason && (
                  <p className="text-[11px] text-muted-foreground bg-secondary/50 p-2 rounded-lg italic">
                    "{reason}"
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => onReject(req.id)}
                    disabled={pendingDecision}
                    className="flex-1 bg-secondary text-secondary-foreground py-1.5 rounded-md text-[11px] font-semibold hover:bg-secondary/80 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {pendingDecision && pendingId === req.id && pendingAction === 'REJECT' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Reject
                  </button>
                  <button
                    onClick={() => onApprove(req.id)}
                    disabled={pendingDecision}
                    className="flex-1 bg-accent text-accent-foreground py-1.5 rounded-md text-[11px] font-semibold hover:opacity-90 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {pendingDecision && pendingId === req.id && pendingAction === 'APPROVE' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Approve
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface GroupedDocsCardProps {
  tenantName: string;
  roomNo: string;
  tenantPhone: string;
  avatarUrl?: string;
  documents: Record<string, any>[];
  activeHostel: Record<string, unknown> | undefined;
  profilePath: string;
}

function GroupedDocsCard({
  tenantName,
  roomNo,
  tenantPhone,
  avatarUrl,
  documents,
  activeHostel,
  profilePath,
}: GroupedDocsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const telPhone = tenantPhone ? tenantPhone.replace(/[^\d+]/g, '') : null;
  const hostelName = activeHostel ? String(activeHostel.name ?? '') : 'Sri Adithya Boys Hostel';

  let whatsappUrl = null;
  if (tenantPhone) {
    let clean = tenantPhone.replace(/[^\d]/g, '');
    if (clean.length === 10) {
      clean = '91' + clean;
    }
    const message = `Hi ${tenantName}, this is a reminder to please upload your pending document${documents.length > 1 ? 's' : ''} (${documents.map((d) => d.doc_type).join(', ')}) for verification at ${hostelName}. Thank you!`;
    whatsappUrl = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  }

  return (
    <div className="bg-card border border-blue-100 hover:border-blue-200 rounded-xl p-3 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={tenantName} className="w-10 h-10 rounded-full object-cover shrink-0 border border-border" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-bold text-sm">
              {tenantName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="font-semibold text-foreground truncate text-sm">{tenantName}</h4>
              <span className="text-xs text-muted-foreground shrink-0">· Room {roomNo}</span>
            </div>
            <p className="text-[10px] font-semibold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md mt-1 w-max">
              Missing Documents ({documents.length})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {telPhone && (
            <a
              className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95 transition-all shrink-0"
              href={`tel:${telPhone}`}
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
          {whatsappUrl && (
            <a
              className="w-9 h-9 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 active:scale-95 transition-all shrink-0"
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <WhatsAppIcon />
            </a>
          )}
          {documents.length > 1 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95 transition-all"
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
          {profilePath && (
            <Link
              className="w-9 h-9 flex items-center justify-center rounded-full bg-accent text-accent-foreground hover:opacity-90 active:scale-95 transition-all shadow-sm"
              to={profilePath}
              aria-label="Verify Documents"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>

      {isExpanded && documents.length > 1 && (
        <div className="mt-1 pt-2 border-t border-border space-y-1">
          {documents.map((doc, idx) => {
            const uploadedAt = doc.uploaded_at ? new Date(String(doc.uploaded_at)) : null;
            return (
              <div key={doc.id || idx} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 text-xs">
                <div>
                  <p className="font-semibold text-blue-600">{doc.doc_type || 'Document'}</p>
                  {uploadedAt && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Uploaded {uploadedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface MoveOutCardProps {
  request: Record<string, any>;
  activeHostel: Record<string, unknown> | undefined;
}

function MoveOutCard({ request, activeHostel }: MoveOutCardProps) {
  const tenantName = request.tenant?.profiles?.name || 'Tenant';
  const tenantId = request.tenant_id || request.tenant?.id;
  const hostelId = request.hostel_id || activeHostel?.id;
  const roomNo = request.tenant?.room_no || request.tenant?.room?.room_number || 'N/A';
  const tenantPhone = request.tenant?.profiles?.phone || '';
  const exitDateStr = request.requested_date || request.created_at;
  const exitDate = exitDateStr ? new Date(exitDateStr) : null;
  const status = request.status || 'PENDING';

  const telPhone = tenantPhone ? tenantPhone.replace(/[^\d+]/g, '') : null;
  const hostelName = activeHostel ? String(activeHostel.name ?? '') : 'Sri Adithya Boys Hostel';

  let whatsappUrl = null;
  if (tenantPhone) {
    let clean = tenantPhone.replace(/[^\d]/g, '');
    if (clean.length === 10) {
      clean = '91' + clean;
    }
    const message = `Hi ${tenantName}, this is regarding your move-out request at ${hostelName}. Let's discuss the exit details.`;
    whatsappUrl = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  }

  const profilePath = tenantId && hostelId ? `/hostels/${hostelId}/tenants/${tenantId}?tab=stay` : '';

  return (
    <div className="bg-card border border-rose-100 hover:border-rose-200 rounded-xl p-3 flex flex-col justify-between gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 font-bold text-sm">
          {tenantName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-foreground truncate text-sm">{tenantName}</h4>
            <span className="text-xs text-muted-foreground shrink-0">Room {roomNo}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            Requested Exit Date:{' '}
            <span className="font-semibold text-foreground">
              {exitDate ? exitDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
            </span>
          </p>
          <div className="mt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-600 px-2 py-0.5 rounded">
              Status: {status}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {telPhone && (
          <a
            className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95 transition-all shrink-0"
            href={`tel:${telPhone}`}
          >
            <Phone className="w-4 h-4" />
          </a>
        )}
        {whatsappUrl && (
          <a
            className="w-9 h-9 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 active:scale-95 transition-all shrink-0"
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
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
            Manage Exit
          </Link>
        )}
      </div>
    </div>
  );
}

function fmtDate(value: unknown) {
  if (!value) return 'Not set';
  return new Date(String(value)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function stateLabel(state: string) {
  switch (state) {
    case 'EXPIRED_AND_RENT_OVERDUE': return 'Expired + Rent Overdue';
    case 'RENEWAL_OVERDUE_CRITICAL': return 'Overdue Critical';
    case 'RENEWAL_DECISION_PENDING': return 'Renewal Pending';
    case 'MOVE_OUT_IN_PROGRESS': return 'Move-out Conflict';
    case 'EXPIRING_SOON': return 'Expiring Soon';
    case 'RENEWAL_AVAILABLE': return 'Renewal Available';
    default: return state.replace(/_/g, ' ');
  }
}

interface RenewalAlertCardProps {
  row: Record<string, any>;
  critical: boolean;
  agreement: Record<string, any>;
  tenant: Record<string, any>;
  activeHostel: Record<string, unknown> | undefined;
}

function RenewalAlertCard({ row, critical, agreement, tenant, activeHostel }: RenewalAlertCardProps) {
  const tenantName = tenant.name || 'Tenant';
  const tenantId = tenant.id;
  const hostelId = agreement.hostel_id || activeHostel?.id;
  const roomNo = tenant.room?.room_no || 'N/A';
  const tenantPhone = tenant.phone || '';

  const telPhone = tenantPhone ? tenantPhone.replace(/[^\d+]/g, '') : null;
  const hostelName = activeHostel ? String(activeHostel.name ?? '') : 'Sri Adithya Hostels';

  let whatsappUrl = null;
  if (tenantPhone) {
    let clean = tenantPhone.replace(/[^\d]/g, '');
    if (clean.length === 10) {
      clean = '91' + clean;
    }
    const message = `Hi ${tenantName}, this is regarding your agreement renewal at ${hostelName}. Please let us know if you wish to renew your agreement.`;
    whatsappUrl = `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
  }

  const profilePath = tenantId && hostelId ? `/hostels/${hostelId}/tenants/${tenantId}?tab=stay` : '';

  return (
    <div className={`bg-card border ${critical ? 'border-rose-100 hover:border-rose-200' : 'border-amber-100 hover:border-amber-200'} rounded-xl p-3 flex flex-col justify-between gap-3 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full ${critical ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'} flex items-center justify-center shrink-0 font-bold text-sm`}>
          {tenantName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-foreground truncate text-sm">{tenantName}</h4>
            <span className="text-xs text-muted-foreground shrink-0">Room {roomNo}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${critical ? 'bg-rose-500/10 text-rose-700' : 'bg-amber-500/10 text-amber-700'}`}>
              {stateLabel(row.decision_state)}
            </span>
            <span className="text-[10px] text-muted-foreground">v{agreement.agreement_version || 1}</span>
          </div>
          
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            Ends:{' '}
            <span className="font-semibold text-foreground">
              {fmtDate(agreement.agreement_end_date)}
            </span>
          </p>

          {row.overdue_rent?.count > 0 && (
            <p className="mt-1 text-xs font-semibold text-rose-700">
              Rent overdue: ₹{Number(row.overdue_rent.amount || 0).toLocaleString('en-IN')}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {telPhone && (
          <a
            className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95 transition-all shrink-0"
            href={`tel:${telPhone}`}
          >
            <Phone className="w-4 h-4" />
          </a>
        )}
        {whatsappUrl && (
          <a
            className="w-9 h-9 flex items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 active:scale-95 transition-all shrink-0"
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
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
            Manage Stay
          </Link>
        )}
      </div>
    </div>
  );
}
