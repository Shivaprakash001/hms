import { useState, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Phone, Mail, Loader2, Bell, Download, FileCheck2, Send, CalendarDays,
  CheckCircle2, XCircle, ShieldAlert, Smartphone, MessageSquare, BedDouble, User,
  Building2, Settings, IndianRupee, LogOut, CheckCircle, AlertTriangle, AlertCircle,
  History, ChevronDown, ChevronUp, Shield, HelpCircle
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tenantService } from '@features/tenants/api';
import { ownerService } from '@features/owners/api';
import { useTenantProfile } from '@features/tenants/hooks/useTenantProfile';
import { useTenantActions } from '@features/tenants/hooks/useTenantActions';
import { TenantStatusBadge } from '@features/tenants/components/badges/TenantStatusBadge';
import { RentObligationList } from '@features/tenants/components/financial/RentObligationList';
import { AllocationHistoryTimeline } from '@features/tenants/components/allocation/AllocationHistoryTimeline';
import { VerificationPanel } from '@features/tenants/components/documents/VerificationPanel';
import { ActivityTimeline } from '@features/tenants/components/profile/ActivityTimeline';
import { ExitWorkflowSection } from '@features/tenants/components/profile/ExitWorkflowSection';
import { getInitials } from '@features/tenants/utils/normalize';
import { RecordPaymentModal } from '@/app/components/modals/RecordPaymentModal';
import { EditInviteModal } from '@/app/components/modals/EditInviteModal';

import { CompactFinancialStrip } from '@features/tenants/components/financial/CompactFinancialStrip';
import { TenantHealthCard } from '@features/tenants/components/score/TenantHealthCard';
import { OwnerInsights } from '@features/tenants/components/profile/OwnerInsights';
import { PrivateNotes } from '@features/tenants/components/profile/PrivateNotes';
import { StickyOpsBar } from '@features/tenants/components/profile/StickyOpsBar';
import { CommunicationCenter } from '@features/tenants/components/profile/CommunicationCenter';

const money = (value: unknown) => `₹${Number(value ?? 0).toLocaleString('en-IN')}`;
const date = (value: unknown) => (value ? new Date(String(value)).toLocaleDateString('en-IN') : '—');
const title = (value: unknown) => String(value ?? '—').replaceAll('_', ' ');
const ordinal = (n: number) => { const s = ['th','st','nd','rd']; const v = n % 100; return n + (s[(v-20)%10] || s[v] || s[0]); };

const positiveAmount = (value: unknown) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

function firstPositiveAmount(...values: unknown[]) {
  for (const value of values) {
    const amount = positiveAmount(value);
    if (amount !== null) return amount;
  }
  return 0;
}

function findSecurityDepositFromObligations(obligations: Record<string, unknown>[]) {
  const deposit = obligations.find((item) => {
    const type = String(
      item.obligation_type ?? item.type ?? item.category ?? item.label ?? '',
    ).toUpperCase();
    return type.includes('ADVANCE') || type.includes('DEPOSIT');
  });
  return positiveAmount(
    deposit?.amount ?? deposit?.original_amount ?? deposit?.remaining ?? deposit?.outstanding,
  );
}

function listFrom<T = Record<string, unknown>>(value: unknown, keys: string[] = []): T[] {
  if (Array.isArray(value)) return value as T[];
  const record = value as Record<string, unknown> | undefined;
  for (const key of keys) {
    if (Array.isArray(record?.[key])) return record[key] as T[];
  }
  return [];
}

interface TenantProfilePageProps {
  hostelIdProp?: string;
  tenantIdProp?: string;
  onBack?: () => void;
}

export function TenantProfilePage({ hostelIdProp, tenantIdProp, onBack }: TenantProfilePageProps = {}) {
  const queryClient = useQueryClient();
  const params = useParams();
  const hostelId = hostelIdProp ?? params.hostelId ?? '';
  const tenantId = tenantIdProp ?? params.tenantId ?? '';
  const navigate = useNavigate();

  const [payObligationId, setPayObligationId] = useState<string | null>(null);
  const [showEditInvite, setShowEditInvite] = useState(false);
  const [isKycExpanded, setIsKycExpanded] = useState(false);
  const [isStayExpanded, setIsStayExpanded] = useState(false);
  const [rightColumnTab, setRightColumnTab] = useState<'activity' | 'ledger'>('activity');

  const { overview, allocations, dues, advance, full, isLoading, isError, refetch } =
    useTenantProfile(hostelId, tenantId);
  const actions = useTenantActions(hostelId);

  const billingTimeline = useQuery({
    queryKey: ['tenant', tenantId, 'billing-timeline'],
    queryFn: () => tenantService.getTenantBillingTimeline(tenantId),
    enabled: Boolean(tenantId),
  });

  const frequencyRequests = useQuery({
    queryKey: ['owner', 'billing-frequency-requests', tenantId],
    queryFn: () => ownerService.getFrequencyChangeRequests({ tenantId, status: 'PENDING' }),
    enabled: Boolean(tenantId),
  });

  const decisionMutation = useMutation({
    queryKey: ['owner', 'decide-frequency-request', tenantId],
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      ownerService.decideFrequencyChangeRequest(id, action),
    onSuccess: () => {
      toast.success('Billing request updated');
      queryClient.invalidateQueries({ queryKey: ['owner', 'billing-frequency-requests', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'billing-timeline'] });
      refetch();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || 'Could not update billing request');
    },
  });

  const { data: tenantScore } = useQuery({
    queryKey: ['tenant-score', tenantId],
    queryFn: () => tenantService.getTenantScore(tenantId),
    enabled: Boolean(tenantId),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const profile = (overview?.profile ?? overview?.profiles ?? full?.profiles ?? {}) as Record<string, unknown>;
  const tenant = (overview?.tenant ?? overview ?? {}) as Record<string, unknown>;
  const name = String(profile?.name ?? tenant?.name ?? 'Tenant');
  const status = String(tenant?.status ?? overview?.status ?? 'ACTIVE');
  const photoUrl = String(tenant?.photo_url ?? overview?.photo_url ?? '').trim();
  const primaryPhone = String(profile?.phone ?? tenant?.phone_1 ?? overview?.phone ?? '').trim();
  const email = String(profile?.email ?? overview?.email ?? '').trim();
  const currentRoom = (tenant.current_room ?? overview?.current_room ?? null) as Record<string, unknown> | null;
  const displayedRoomNo = currentRoom?.room_no ?? tenant.room_number ?? overview?.room_number ?? null;
  const needsRoomAssignment = status.toUpperCase() === 'ACTIVE' && !displayedRoomNo;

  const obligations = listFrom(dues, ['items', 'obligations']);
  const fullPayments = listFrom(full?.payments);
  const securityDepositAmount = firstPositiveAmount(
    tenant.security_deposit,
    overview?.security_deposit,
    tenant.advance_deposit,
    overview?.advance_deposit,
    (advance as Record<string, unknown> | undefined)?.security_deposit,
    findSecurityDepositFromObligations(obligations as Record<string, unknown>[]),
  );

  const overdueDays = useMemo(() => {
    const pending = obligations.filter((o: any) => 
      ['PENDING', 'PARTIAL'].includes(String(o.status).toUpperCase()) && o.due_date
    );
    if (pending.length === 0) return 0;
    const dueDates = pending.map((o: any) => new Date(o.due_date).getTime());
    const oldestDueDate = Math.min(...dueDates);
    const diffTime = Date.now() - oldestDueDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }, [obligations]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (isError || !overview) {
    return (
      <div className="text-center py-16 px-4">
        <p className="text-foreground font-medium">Failed to load tenant</p>
        <button
          type="button"
          onClick={() => (onBack ? onBack() : navigate(`/hostels/${hostelId}/tenants`))}
          className="mt-4 text-sm text-accent font-semibold"
        >
          Back to tenants
        </button>
      </div>
    );
  }

  const paymentSummary = (overview.payment_summary ??
    overview.financial_summary ?? {
      total_paid: overview.total_paid,
      pending_amount: overview.outstanding ?? overview.total_due,
      overdue_amount: overview.overdue_amount,
      deposit_balance: overview.advance_balance,
    }) as Record<string, unknown> | undefined;
  const compliance = (overview.compliance ?? {}) as Record<string, unknown>;
  const pendingBillingRequests = frequencyRequests.data?.requests ?? [];
  const timelineItems = billingTimeline.data?.items ?? [];
  const requiredDocTypes = listFrom<string>(compliance.required_document_types ?? full?.required_document_types);
  const uploadedDocTypes = listFrom<string>(compliance.document_types);
  const recentPayments = listFrom<Record<string, unknown>>(overview.recent_payments).length
    ? listFrom<Record<string, unknown>>(overview.recent_payments)
    : fullPayments.map((payment) => ({
        id: payment.id,
        amount: payment.amount_paid,
        date: payment.payment_date,
        method: payment.payment_method,
        reference_number: payment.reference_number,
      }));

  const runComplianceAction = async (action: string, success: string) => {
    try {
      await tenantService.runComplianceAction(tenantId, action);
      toast.success(success);
      refetch();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        'Action failed';
      toast.error(message);
    }
  };

  const downloadAcceptanceRecord = () => {
    if (!compliance?.rules_accepted) {
      toast.error('No rules acceptance record yet');
      return;
    }
    const record = {
      tenant_id: tenantId,
      tenant_name: name,
      accepted_at: compliance.rules_accepted_at,
      rules_version: compliance.rules_version,
      rule_version_id: compliance.rule_version_id,
      rules_snapshot: compliance.rules_snapshot,
    };
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/\s+/g, '-').toLowerCase()}-rules-acceptance.json`;
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 250);
  };

  const whatsAppTenant = (phone: string) => {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
  };

  const overdueAmount = Number(paymentSummary?.overdue_amount ?? overview?.overdue_amount ?? 0);
  const isOverdue = overdueAmount > 0;

  const mergedTimeline = (timelineItems || [])
    .map((item: any) => {
      if (item.type === 'CREDIT_APPLIED' || item.type === 'ADVANCE_CREDIT') {
        return {
          id: `t-${item.timeline_id ?? item.obligation_id}`,
          date: new Date(item.event_date || item.due_date),
          title: item.label || 'Future Rent Credit',
          subtitle: `Credit added via ${item.payment_method || 'Offline'}${item.reference_number ? ` · Ref: ${item.reference_number}` : ''}${item.notes ? ` · Note: ${item.notes}` : ''}`,
          dateVerb: 'Added on',
          amount: Number(item.amount ?? 0),
          status: 'Paid',
          statusColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
          tone: 'border-emerald-100 bg-emerald-50/20',
        };
      }

      if (String(item.type).endsWith('_PAID')) {
        const formattedDueDate = item.due_date ? new Date(item.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
        return {
          id: `t-${item.timeline_id ?? item.obligation_id}`,
          date: new Date(item.paid_date || item.event_date || item.due_date),
          title: item.label || 'Paid Event',
          subtitle: `Paid via ${item.payment_method || 'Cash'}${item.reference_number ? ` · Ref: ${item.reference_number}` : ''}${formattedDueDate ? ` · Originally due: ${formattedDueDate}` : ''}`,
          dateVerb: 'Paid on',
          amount: Number(item.amount ?? 0),
          status: 'Paid',
          statusColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
          tone: 'border-emerald-100 bg-emerald-50/20',
        };
      }

      if (item.type === 'PAYMENT_SETTLED' || item.type === 'PAYMENT') {
        return {
          id: `t-${item.timeline_id ?? item.obligation_id}`,
          date: new Date(item.paid_date || item.event_date || item.due_date),
          title: item.label || 'Payment Received',
          subtitle: `Paid via ${item.payment_method || 'Cash'}${item.reference_number ? ` · Ref: ${item.reference_number}` : ''}`,
          dateVerb: 'Paid on',
          amount: Number(item.amount ?? 0),
          status: 'Paid',
          statusColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
          tone: 'border-emerald-100 bg-emerald-50/20',
        };
      }

      const isCovered = item.state === 'covered' || item.state === 'paid' || item.status === 'PAID';
      const isUpcoming = item.state === 'upcoming';
      const amount = Number(item.amount ?? 0);
      const paid = Number(item.paid ?? 0);
      const remaining = Number(item.remaining ?? amount);

      const formattedDueDate = item.due_date ? new Date(item.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      let sub = formattedDueDate ? `Due by ${formattedDueDate}` : '';
      if (paid > 0 && remaining > 0) {
        sub += ` · ₹${paid.toLocaleString('en-IN')} paid, ₹${remaining.toLocaleString('en-IN')} remaining`;
      }

      return {
        id: `t-${item.timeline_id ?? item.obligation_id}`,
        date: new Date(item.event_date || item.due_date),
        title: item.label || 'Charge Generated',
        subtitle: sub,
        dateVerb: 'Due by',
        amount,
        status: String(item.state || item.status || 'pending').replaceAll('_', ' '),
        statusColor: isCovered
          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
          : isUpcoming
          ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
          : 'bg-rose-500/10 text-rose-600 border-rose-500/20',
        tone: isCovered
          ? 'border-emerald-100 bg-emerald-50/20'
          : isUpcoming
          ? 'border-dashed border-accent/20 bg-accent/5'
          : 'border-rose-100 bg-rose-50/20',
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="px-4 py-5 max-w-7xl mx-auto pb-24 min-w-0 space-y-6">
      {/* Top Navigation */}
      <button
        type="button"
        onClick={() => (onBack ? onBack() : navigate(`/hostels/${hostelId}/tenants`))}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Tenants
      </button>

      {/* Header Profile Banner */}
      <div className="p-5 rounded-2xl border border-border bg-card shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-accent/15 overflow-hidden flex items-center justify-center text-xl font-bold text-accent shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              getInitials(name)
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-foreground tracking-tight">{name}</h1>
              <TenantStatusBadge status={status} size="md" />
              {isOverdue && (
                <span className="inline-flex items-center rounded-full border font-bold px-2.5 py-0.5 text-[10px] uppercase bg-rose-500/15 text-rose-600 border-rose-500/30">
                  Overdue
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground font-medium flex flex-wrap gap-x-2 gap-y-1 items-center">
              <span>Room: <strong className="text-foreground">{displayedRoomNo ?? 'Not assigned'}</strong></span>
              <span className="text-muted-foreground/30">•</span>
              <span>Joined: <strong className="text-foreground">{date(tenant.joined_on ?? overview.joined_at)}</strong></span>
              {(tenant.exit_date ?? overview?.exit_date) && (
                <>
                  <span className="text-muted-foreground/30">•</span>
                  <span>Move-out: <strong className="text-foreground">{date(tenant.exit_date ?? overview.exit_date)}</strong></span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Top Info Pill */}
        <div className="w-full md:w-auto p-3.5 rounded-xl bg-secondary/40 border border-border flex items-center justify-between gap-6 shrink-0 text-xs">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Hostel Location</span>
            <span className="font-bold text-foreground mt-0.5 block">Hostel 2</span>
          </div>
          <div className="border-l border-border h-8 self-center" />
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Rent Agreement</span>
            <span className="font-bold text-foreground mt-0.5 block">
              {allocations?.length > 0 ? 'Active Contract' : 'No Active Contract'}
            </span>
          </div>
        </div>
      </div>

      {/* Row 1: Sticky Operations & Communication Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          {/* Operations Quick Action Bar */}
          <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-3">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-accent" />
              Core Action Dashboard
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  const pending = obligations.find((o: any) => ['PENDING', 'PARTIAL'].includes(o.status));
                  if (pending?.id) {
                    setPayObligationId(pending.id);
                  } else {
                    toast.error("No pending rent dues found to record payment.");
                  }
                }}
                className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-4.5 py-3 rounded-xl bg-accent text-accent-foreground text-xs font-bold hover:bg-accent/90 active:scale-95 transition-all shadow-sm"
              >
                <IndianRupee className="w-4 h-4" />
                <span>Record Payment</span>
              </button>
              
              <button
                type="button"
                onClick={() => setShowEditInvite(true)}
                className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-4.5 py-3 rounded-xl bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80 active:scale-95 transition-all border border-border"
              >
                <Send className="w-4 h-4 text-muted-foreground" />
                <span>Share Invite</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsStayExpanded(true);
                  setTimeout(() => {
                    document.getElementById('stay-details-section')?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
                className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-4.5 py-3 rounded-xl bg-rose-50/50 hover:bg-rose-50 text-rose-600 dark:bg-rose-950/10 dark:hover:bg-rose-950/20 dark:text-rose-400 text-xs font-semibold active:scale-95 transition-all border border-rose-500/20"
              >
                <LogOut className="w-4 h-4" />
                <span>Check-out / Exit</span>
              </button>
            </div>
          </div>
        </div>

        <div>
          {/* Communication Center Quick Buttons */}
          <div className="h-full">
            <CommunicationCenter
              tenantName={name}
              tenantPhone={primaryPhone}
              guardianName={String(tenant.guardian_name || profile.guardian_name || '') || undefined}
              guardianPhone={String(tenant.guardian_phone || profile.guardian_phone || '') || undefined}
              guardianRelation={String(tenant.guardian_relation || profile.guardian_relation || '') || undefined}
              emergencyName={String(tenant.emergency_name || profile.emergency_name || '') || undefined}
              emergencyPhone={String(tenant.emergency_phone || profile.emergency_phone || '') || undefined}
              emergencyRelation={String(tenant.emergency_relation || profile.emergency_relation || '') || undefined}
              timelineItems={timelineItems}
            />
          </div>
        </div>
      </div>

      {/* Row 2: Financial Strip */}
      <CompactFinancialStrip
        outstandingAmount={Number(paymentSummary?.pending_amount ?? overview.outstanding ?? 0)}
        overdueDays={overdueDays}
        futureCredit={Number(advance?.balance ?? advance?.current_balance ?? 0)}
        depositPaid={securityDepositAmount}
        overdueAmount={overdueAmount}
      />

      {/* Row 3: Insights Grid & Private Notes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <TenantHealthCard
          score={tenantScore?.score ?? 80}
          grade={tenantScore?.grade ?? 'GOOD'}
          trend={tenantScore?.trend ?? 'STABLE'}
          hasAgreement={Boolean(allocations?.length > 0)}
          documentStatus={String(compliance.document_verification_status ?? 'MISSING').toUpperCase()}
        />

        <OwnerInsights
          score={tenantScore?.score ?? null}
          overdueDays={overdueDays}
          outstandingAmount={Number(paymentSummary?.pending_amount ?? overview.outstanding ?? 0)}
          depositStatus={securityDepositAmount === 0 ? 'WAIVED' : 'PAID'}
          hasAgreement={Boolean(allocations?.length > 0)}
          documentStatus={String(compliance.document_verification_status ?? 'MISSING').toUpperCase()}
          joinedDate={date(tenant.joined_on ?? overview.joined_at)}
        />

        <PrivateNotes tenantId={tenantId} />
      </div>

      {/* Bottom Layout Workspace (Two-column) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (Dues, Stay Accordion, KYC Accordion) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Warning Bar */}
          {needsRoomAssignment && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-amber-900">Tenant requires room assignment</p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    This tenant is active but not allocated to a room. Assign a room to calculate billing correctly.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsStayExpanded(true)}
                    className="mt-3 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700"
                  >
                    Assign Room
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pending billing change request */}
          {pendingBillingRequests.length > 0 && (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-3 shadow-sm">
              <p className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                <span>Pending Frequency Request</span>
              </p>
              {pendingBillingRequests.map((request: any) => (
                <div key={request.id} className="rounded-lg bg-white border border-amber-200 p-3.5 space-y-3 shadow-xs">
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      Change payment terms: {String(request.current_frequency).replaceAll('_', ' ')} → {String(request.requested_frequency).replaceAll('_', ' ')}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Effective Date: {request.effective_from ? new Date(request.effective_from).toLocaleDateString('en-IN') : 'next period'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={decisionMutation.isPending}
                      onClick={() => decisionMutation.mutate({ id: request.id, action: 'APPROVE' })}
                      className="bg-accent text-accent-foreground px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-transform"
                    >
                      Approve Change
                    </button>
                    <button
                      type="button"
                      disabled={decisionMutation.isPending}
                      onClick={() => decisionMutation.mutate({ id: request.id, action: 'REJECT' })}
                      className="border border-border bg-background px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-transform"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Next Rent Generation Info */}
          {billingTimeline.data?.next_rent_generation && (
            <div className="p-4 rounded-2xl border border-accent/20 bg-accent/5 text-xs shadow-sm flex justify-between items-center gap-4">
              <div>
                <p className="font-extrabold text-foreground text-sm flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4 text-accent" />
                  Next Auto Rent Generation
                </p>
                <p className="text-muted-foreground mt-1 text-[11px]">
                  Scheduled: {new Date(billingTimeline.data.next_rent_generation.next_rent_generation_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {' · Period: '}{new Date(billingTimeline.data.next_rent_generation.period_start).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-black text-foreground text-sm">
                  ₹{billingTimeline.data.next_rent_generation.next_installment_amount.toLocaleString('en-IN')}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Due: {new Date(billingTimeline.data.next_rent_generation.next_installment_due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </p>
              </div>
            </div>
          )}

          {/* Rent Obligation List (Monthly Rent Dues) */}
          <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <IndianRupee className="w-4 h-4 text-accent" />
                Rent Dues &amp; Ledger List
              </h3>
            </div>
            <RentObligationList
              obligations={obligations as never[]}
              onRecordPayment={(id) => setPayObligationId(id)}
              hasActivePlan={Number(tenant?.monthly_rent ?? overview?.rent ?? 0) > 0}
            />
          </div>

          {/* Collapsible Identity & KYC Documents Card */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setIsKycExpanded(!isKycExpanded)}
              className="w-full flex items-center justify-between p-4 font-bold text-foreground text-sm border-none bg-transparent hover:bg-muted/5 transition-colors text-left"
            >
              <span className="flex items-center gap-1.5">
                <FileCheck2 className="w-4.5 h-4.5 text-accent" />
                KYC Verification &amp; Documents
              </span>
              <span className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${
                  compliance.document_verification_status === 'VERIFIED'
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    : compliance.document_verification_status === 'PENDING'
                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                }`}>
                  {String(compliance.document_verification_status ?? 'MISSING')}
                </span>
                {isKycExpanded ? <ChevronUp className="w-4.5 h-4.5" /> : <ChevronDown className="w-4.5 h-4.5" />}
              </span>
            </button>
            {isKycExpanded && (
              <div className="p-4 border-t border-border bg-secondary/5 space-y-4">
                {/* Secondary compliance actions links */}
                <div className="flex gap-3 flex-wrap justify-between items-center text-xs">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => runComplianceAction('REMIND_DOCUMENTS', 'Document reminder sent')}
                      className="text-accent font-semibold hover:underline"
                    >
                      Remind documents
                    </button>
                    <span className="text-muted-foreground/30">·</span>
                    <button
                      type="button"
                      onClick={() => runComplianceAction('RESEND_RULES', 'Rules reminder sent')}
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Resend rules reminder
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={downloadAcceptanceRecord}
                    className="text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Download rules acceptance JSON
                  </button>
                </div>

                <VerificationPanel
                  hostelId={hostelId}
                  tenantId={tenantId}
                  profileType={String(tenant?.profile_type ?? 'STUDENT')}
                  documents={
                    (full?.identification_documents ?? full?.documents ?? []) as Record<string, unknown>[]
                  }
                  photoUrl={photoUrl}
                  onUpdated={refetch}
                />
              </div>
            )}
          </div>

          {/* Collapsible Stay History & Move-Out settings */}
          <div id="stay-details-section" className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setIsStayExpanded(!isStayExpanded)}
              className="w-full flex items-center justify-between p-4 font-bold text-foreground text-sm border-none bg-transparent hover:bg-muted/5 transition-colors text-left"
            >
              <span className="flex items-center gap-1.5">
                <BedDouble className="w-4.5 h-4.5 text-accent" />
                Stay Details &amp; Checkout Workflow
              </span>
              <span className="flex items-center gap-2">
                <span className="text-[10px] px-2.5 py-0.5 rounded bg-secondary font-bold text-muted-foreground border border-border">
                  Room {displayedRoomNo ?? 'None'}
                </span>
                {isStayExpanded ? <ChevronUp className="w-4.5 h-4.5" /> : <ChevronDown className="w-4.5 h-4.5" />}
              </span>
            </button>
            {isStayExpanded && (
              <div className="p-4 border-t border-border bg-secondary/5 space-y-6">
                <AllocationHistoryTimeline
                  hostelId={hostelId}
                  tenantId={tenantId}
                  allocations={allocations}
                  currentRoom={currentRoom}
                  onChanged={refetch}
                />
                
                <div className="border-t border-border/60 pt-5">
                  <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5 uppercase tracking-wider text-muted-foreground">
                    <LogOut className="w-4 h-4 text-rose-500" />
                    Move-Out Settlement Workflow
                  </h4>
                  <ExitWorkflowSection hostelId={hostelId} tenantId={tenantId} status={status} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Unified Activity log & Ledger timeline) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-4">
            {/* Header tab buttons */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <History className="w-4.5 h-4.5 text-accent" />
                Workspace Feed
              </h3>
              <div className="flex gap-1.5 bg-secondary/60 p-1 rounded-xl border border-border/80">
                <button
                  type="button"
                  onClick={() => setRightColumnTab('activity')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    rightColumnTab === 'activity'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Activity
                </button>
                <button
                  type="button"
                  onClick={() => setRightColumnTab('ledger')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    rightColumnTab === 'ledger'
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Ledger
                </button>
              </div>
            </div>

            {/* Content body */}
            {rightColumnTab === 'activity' ? (
              <ActivityTimeline
                hostelId={hostelId}
                tenantId={tenantId}
                tenantName={name}
                joinedOn={String(tenant.joined_on ?? overview.joined_at ?? '')}
                profileType={String(tenant?.profile_type ?? 'STUDENT')}
                documents={(full?.identification_documents ?? full?.documents ?? [])}
                allocations={allocations}
                timelineItems={timelineItems}
                recentPayments={recentPayments}
                moveOutRequest={overview.move_out ?? overview.move_out_request}
              />
            ) : (
              <div className="space-y-3">
                {mergedTimeline.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">No ledger events recorded yet.</p>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {mergedTimeline.slice(0, 16).map((item) => (
                      <div key={item.id} className={`flex justify-between gap-3 rounded-xl border p-3.5 text-xs ${item.tone} shadow-sm`}>
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">{item.title}</p>
                          <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">{item.subtitle}</p>
                          <p className="text-[10px] text-muted-foreground mt-1.5 font-semibold">
                            {item.dateVerb}: {item.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-extrabold text-foreground text-sm">₹{item.amount.toLocaleString('en-IN')}</p>
                          <span className={`inline-block text-[9px] font-bold uppercase mt-2 px-2 py-0.5 rounded-full border ${item.statusColor}`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Invitation history card (only shown if invitations exist) */}
          {((tenant?.tenant_invitations ?? overview?.tenant_invitations ?? []) as any[]).length > 0 && (
            <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <History className="w-4.5 h-4.5 text-accent" />
                Invitation History Logs
              </h3>
              
              <div className="relative pl-5 border-l border-border space-y-4 ml-1">
                {((tenant?.tenant_invitations ?? overview?.tenant_invitations ?? []) as any[]).map((invite: any, index: number, arr: any[]) => {
                  const versionNum = arr.length - index;
                  const isActive = index === 0;
                  
                  let badgeText = 'Superseded';
                  let badgeClass = 'bg-secondary/40 text-muted-foreground border-border/50';
                  
                  if (isActive) {
                    if (status === 'ACTIVE') {
                      badgeText = 'Accepted';
                      badgeClass = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
                    } else if (status === 'CANCELLED') {
                      badgeText = 'Cancelled';
                      badgeClass = 'bg-rose-500/10 text-rose-600 border-rose-500/20';
                    } else {
                      badgeText = 'Active';
                      badgeClass = 'bg-accent/10 text-accent border-accent/20';
                    }
                  }

                  return (
                    <div key={invite.id} className="relative group text-xs">
                      <span className={`absolute -left-[26px] top-1.5 w-2 h-2 rounded-full border bg-card ${isActive ? 'border-accent animate-pulse' : 'border-muted'}`} />
                      
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-xs">Version {versionNum}</span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${badgeClass}`}>
                            {badgeText}
                          </span>
                          <span className="text-[9px] text-muted-foreground ml-auto font-medium">
                            {invite.created_at ? new Date(invite.created_at).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            }) : ''}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-1.5 text-[11px] text-muted-foreground p-2.5 bg-secondary/20 rounded-xl border border-border/40">
                          <div>
                            <span className="block text-[9px] text-muted-foreground/80 uppercase">Room</span>
                            <span className="font-bold text-foreground">{invite.room?.room_no || 'Unassigned'}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] text-muted-foreground/80 uppercase font-semibold">Monthly Rent</span>
                            <span className="font-bold text-foreground">{money(invite.monthly_rent)}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] text-muted-foreground/80 uppercase">Agreement</span>
                            <span className="font-bold text-foreground">
                              {invite.agreement_duration_months ? `${invite.agreement_duration_months} mo` : '—'}
                            </span>
                          </div>
                        </div>

                        {invite.notes && (
                          <div className="mt-1 text-[10px] text-muted-foreground p-2.5 bg-rose-500/5 rounded-xl border border-rose-500/10 font-mono">
                            {invite.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Record Payment Modal */}
      {payObligationId && (
        <RecordPaymentModal
          hostelId={hostelId}
          initialDueId={payObligationId}
          onClose={() => {
            setPayObligationId(null);
            refetch();
          }}
        />
      )}

      {/* Edit Invite Modal */}
      {showEditInvite && (
        <EditInviteModal
          tenantId={tenantId}
          hostelId={hostelId}
          onClose={() => {
            setShowEditInvite(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
