import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, FileCheck2, Send,
  BedDouble, Settings, LogOut, AlertTriangle, AlertCircle,
  History, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tenantService } from '@features/tenants/api';
import { paymentService } from '@features/payments/api';
import { ownerService } from '@features/owners/api';
import { useTenantProfile } from '@features/tenants/hooks/useTenantProfile';
import { useOwnerActions } from '@features/owner-actions/hooks/useOwnerActions';
import { TenantStatusBadge } from '@features/tenants/components/badges/TenantStatusBadge';
import { RentObligationList } from '@features/tenants/components/financial/RentObligationList';
import { WaiveObligationModal } from '@features/tenants/components/financial/WaiveObligationModal';
import { CancelObligationModal } from '@features/tenants/components/financial/CancelObligationModal';
import { CreateObligationModal } from '@features/tenants/components/financial/CreateObligationModal';
import { ObligationHistorySheet } from '@features/tenants/components/financial/ObligationHistorySheet';
import { CompactFinancialStrip, type FinancialSectionId } from '@features/tenants/components/financial/CompactFinancialStrip';
import { FinancialHealthBanner } from '@features/tenants/components/financial/FinancialHealthBanner';
import { PrimaryActionsBar } from '@features/tenants/components/financial/PrimaryActionsBar';
import { FinancialActivity } from '@features/tenants/components/financial/FinancialActivity';
import { LedgerStatement } from '@features/tenants/components/financial/LedgerStatement';
import { DocumentsHub } from '@features/tenants/components/financial/DocumentsHub';
import { FinancialWorkspaceNav } from '@features/tenants/components/profile/FinancialWorkspaceNav';
import { AllocationHistoryTimeline } from '@features/tenants/components/allocation/AllocationHistoryTimeline';
import { VerificationPanel } from '@features/tenants/components/documents/VerificationPanel';
import { ActivityTimeline } from '@features/tenants/components/profile/ActivityTimeline';
import { ExitWorkflowSection } from '@features/tenants/components/profile/ExitWorkflowSection';
import { getInitials } from '@features/tenants/utils/normalize';
import { RecordPaymentModal } from '@/app/components/modals/RecordPaymentModal';
import { hmsToast } from '@lib/toast';
import { useIsMobile } from '@/app/components/ui/use-mobile';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import api from '@lib/api-client';
import { EditInviteModal } from '@/app/components/modals/EditInviteModal';
import {
  ChangeRequestDrawer,
  PendingBanner,
  useTenantChangeRequests,
} from '@/features/change-management';

import { TenantHealthCard } from '@features/tenants/components/score/TenantHealthCard';
import { OwnerInsights } from '@features/tenants/components/profile/OwnerInsights';
import { PrivateNotes } from '@features/tenants/components/profile/PrivateNotes';
import { CommunicationCenter } from '@features/tenants/components/profile/CommunicationCenter';

const money = (value: unknown) => `₹${Number(value ?? 0).toLocaleString('en-IN')}`;
const date = (value: unknown) => (value ? new Date(String(value)).toLocaleDateString('en-IN') : '—');

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

type MobileTab = 'obligations' | 'activity' | 'ledger' | 'documents';

type ObligationModalState = {
  mode: 'create' | 'duplicate' | 'edit';
  initialValues?: { obligationType?: string; amount?: number; description?: string };
  replaceObligation?: any;
} | null;

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
  const isMobile = useIsMobile();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payObligationId, setPayObligationId] = useState<string | null>(null);
  const [paymentPrefillAmount, setPaymentPrefillAmount] = useState<number | undefined>(undefined);
  const [showEditInvite, setShowEditInvite] = useState(false);
  const [showChangeDrawer, setShowChangeDrawer] = useState(false);
  const [isKycExpanded, setIsKycExpanded] = useState(false);
  const [isStayExpanded, setIsStayExpanded] = useState(false);
  const [showCreateObligationModal, setShowCreateObligationModal] = useState(false);
  const [waiveObligation, setWaiveObligation] = useState<any>(null);
  const [cancelObligationTarget, setCancelObligationTarget] = useState<any>(null);
  const [historyObligation, setHistoryObligation] = useState<any>(null);
  const [obligationModal, setObligationModal] = useState<ObligationModalState>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('obligations');

  const { overview, allocations, dues, advance, full, financialTimeline, isLoading, isError, refetch } =
    useTenantProfile(hostelId, tenantId);

  const { findAction } = useOwnerActions(hostelId, tenantId);
  const personalInfoAction = findAction('TENANT_EDIT_PERSONAL_INFO');

  // Change Management: fetch pending requests for this tenant
  const {
    pendingCount: crPendingCount,
    recentChanges,
    refetch: refetchChangeRequests,
  } = useTenantChangeRequests(tenantId);

  const handleChangeSuccess = useCallback(() => {
    refetch();
    refetchChangeRequests();
  }, [refetch, refetchChangeRequests]);

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
    const todayMid = new Date();
    todayMid.setUTCHours(0, 0, 0, 0);
    const overduePending = obligations.filter((o: any) => {
      if (!['PENDING', 'PARTIAL'].includes(String(o.status).toUpperCase()) || !o.due_date) return false;
      const due = new Date(o.due_date);
      due.setUTCHours(0, 0, 0, 0);
      return due.getTime() < todayMid.getTime();
    });
    if (overduePending.length === 0) return 0;
    const oldestDueDate = Math.min(...overduePending.map((o: any) => new Date(o.due_date).getTime()));
    const diffDays = Math.floor((todayMid.getTime() - oldestDueDate) / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  }, [obligations]);

  // Agreement progress — time-based: months elapsed since agreement start / total duration (§ plan decision)
  const { agreementMonthsElapsed, agreementMonthsTotal } = useMemo(() => {
    const activeAllocation = (allocations || []).find((a: any) => a.is_active) ?? allocations?.[0];
    const startRaw = activeAllocation?.start_date;
    const durationMonths = Number(
      tenant?.agreement_duration_months ?? overview?.agreement_duration_months ?? 0,
    );
    if (!startRaw || !durationMonths) return { agreementMonthsElapsed: null, agreementMonthsTotal: null };
    const start = new Date(startRaw);
    if (Number.isNaN(start.getTime())) return { agreementMonthsElapsed: null, agreementMonthsTotal: null };
    const now = new Date();
    const elapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    return {
      agreementMonthsElapsed: Math.max(0, Math.min(durationMonths, elapsed)),
      agreementMonthsTotal: durationMonths,
    };
  }, [allocations, tenant, overview]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
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

  const overdueAmount = Number(paymentSummary?.overdue_amount ?? overview?.overdue_amount ?? 0);
  const outstandingAmount = Number(paymentSummary?.pending_amount ?? overview.outstanding ?? 0);
  const futureCredit = Number((advance as any)?.balance ?? (advance as any)?.current_balance ?? (advance as any)?.future_rent_credit ?? 0);
  const isOverdue = overdueAmount > 0;
  const nextRentGeneration = billingTimeline.data?.next_rent_generation;
  const nextRentDate = nextRentGeneration?.next_installment_due_date ?? null;
  const nextRentAmount = nextRentGeneration?.next_installment_amount ?? null;
  const nextRentLabel = nextRentGeneration?.installment_label ?? (nextRentDate ? date(nextRentDate) : null);

  const financialEvents = (financialTimeline as any)?.events ?? [];

  // ── Financial section navigation (desktop scroll, mobile tab switch) ──────
  const handleNavigate = (section: FinancialSectionId) => {
    const tabForSection: Partial<Record<FinancialSectionId, MobileTab>> = {
      'fin-obligations': 'obligations',
      'fin-activity': 'activity',
      'fin-ledger': 'ledger',
      'fin-documents': 'documents',
    };
    const tab = tabForSection[section];
    if (isMobile && tab) setMobileTab(tab);
    setTimeout(() => {
      document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, isMobile && tab ? 50 : 0);
  };

  const handleOpenReceivePayment = (prefillAmount?: number) => {
    setPayObligationId(null);
    setPaymentPrefillAmount(prefillAmount);
    setShowPaymentModal(true);
  };

  const handleDownloadReceipt = async (paymentId: string) => {
    try {
      const blob = await paymentService.downloadReceipt(paymentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${paymentId}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 250);
    } catch (e: any) {
      hmsToast.error(e, 'Download receipt');
    }
  };

  // ── Obligation card actions ────────────────────────────────────────────────
  const handleEditObligationSuccess = () => {
    const source = obligationModal?.replaceObligation;
    setObligationModal(null);
    refetch();
    if (source) {
      // Obligations are immutable — editing creates a corrected replacement, then
      // the original is cancelled to avoid double-counting. See plan §1 decision.
      setCancelObligationTarget({ ...source, __editReason: 'Superseded by edit' });
    }
  };

  const obligationsSection = (
    <div id="fin-obligations" className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-4 scroll-mt-20">
      <div className="flex justify-between items-center border-b border-border pb-3">
        <h3 className="text-sm font-bold text-foreground">Obligations</h3>
        <button
          type="button"
          onClick={() => setObligationModal({ mode: 'create' })}
          className="py-1.5 px-3 rounded-xl bg-accent/15 hover:bg-accent/20 text-accent text-xs font-semibold active:scale-95 transition-transform border border-accent/20"
        >
          + Add Charge
        </button>
      </div>
      <RentObligationList
        obligations={obligations as never[]}
        onRecordPayment={(id) => {
          setPayObligationId(id);
          setPaymentPrefillAmount(undefined);
          setShowPaymentModal(true);
        }}
        onWaiveObligation={(ob) => setWaiveObligation(ob)}
        onCancelObligation={(ob) => setCancelObligationTarget(ob)}
        onEditObligation={(ob) =>
          setObligationModal({
            mode: 'edit',
            initialValues: {
              obligationType: ob.obligation_type ?? ob.type,
              amount: Number(ob.outstanding ?? ob.amount ?? 0),
              description: ob.description,
            },
            replaceObligation: ob,
          })
        }
        onDuplicateObligation={(ob) =>
          setObligationModal({
            mode: 'duplicate',
            initialValues: {
              obligationType: ob.obligation_type ?? ob.type,
              amount: Number(ob.amount ?? 0),
              description: ob.description,
            },
          })
        }
        onViewHistory={(ob) => setHistoryObligation(ob)}
        hasActivePlan={Number(tenant?.monthly_rent ?? overview?.rent ?? 0) > 0}
      />
    </div>
  );

  const activitySection = (
    <FinancialActivity
      events={financialEvents}
      isLoading={(financialTimeline as any) === undefined}
      onDownloadReceipt={handleDownloadReceipt}
      onViewObligation={() => handleNavigate('fin-obligations')}
    />
  );

  const ledgerSection = (
    <LedgerStatement entries={(advance as any)?.entries ?? []} balance={futureCredit} />
  );

  const documentsSection = (
    <DocumentsHub
      tenantId={tenantId}
      hasAgreement={Boolean(allocations?.length > 0)}
      agreementUrl={null}
      recentPayments={recentPayments as any}
      recentChanges={recentChanges as any}
      onViewAllChanges={() => navigate(`/changes?tenantId=${tenantId}`)}
    />
  );

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
            {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : getInitials(name)}
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

      {/* Change Management: Pending Banner */}
      {status.toUpperCase() === 'ACTIVE' && (
        <PendingBanner
          pendingCount={crPendingCount}
          onViewAll={() => handleNavigate('fin-documents')}
        />
      )}

      {/* Row 1: Sticky Operations & Communication Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-3">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-accent" />
              Core Action Dashboard
            </span>
            <div className="flex flex-wrap gap-2">
              {status.toUpperCase() === 'ACTIVE' ? (
                <button
                  type="button"
                  onClick={() => setShowChangeDrawer(true)}
                  className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-4.5 py-3 rounded-xl bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80 active:scale-95 transition-all border border-border"
                >
                  <FileCheck2 className="w-4 h-4 text-accent" />
                  <span>{personalInfoAction?.label ?? 'Request Change'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowEditInvite(true)}
                  className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-4.5 py-3 rounded-xl bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80 active:scale-95 transition-all border border-border"
                >
                  <Send className="w-4 h-4 text-muted-foreground" />
                  <span>Edit Details</span>
                </button>
              )}

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
              timelineItems={[]}
            />
          </div>
        </div>
      </div>

      {/* Row 2: Insights Grid & Private Notes */}
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
          outstandingAmount={outstandingAmount}
          depositStatus={securityDepositAmount === 0 ? 'WAIVED' : 'PAID'}
          hasAgreement={Boolean(allocations?.length > 0)}
          documentStatus={String(compliance.document_verification_status ?? 'MISSING').toUpperCase()}
          joinedDate={date(tenant.joined_on ?? overview.joined_at)}
        />

        <PrivateNotes tenantId={tenantId} />
      </div>

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
                  Change payment terms: {String(request.current_frequency).replace(/_/g, ' ')} → {String(request.requested_frequency).replace(/_/g, ' ')}
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

      {/* ═══════════════════════ FINANCIAL WORKSPACE ═══════════════════════ */}
      <FinancialWorkspaceNav onNavigate={handleNavigate} />

      {/* §1 Summary */}
      <CompactFinancialStrip
        outstandingAmount={outstandingAmount}
        overdueDays={overdueDays}
        futureCredit={futureCredit}
        depositPaid={securityDepositAmount}
        overdueAmount={overdueAmount}
        nextRentDate={nextRentDate}
        nextRentAmount={nextRentAmount}
        agreementMonthsElapsed={agreementMonthsElapsed}
        agreementMonthsTotal={agreementMonthsTotal}
        onNavigate={handleNavigate}
      />

      {/* §1b Financial Health Banner + Recommended Next Action */}
      <FinancialHealthBanner
        overdueAmount={overdueAmount}
        overdueDays={overdueDays}
        pendingAmount={outstandingAmount}
        futureCredit={futureCredit}
        nextRentLabel={nextRentLabel}
        onCollect={(prefillAmount) => handleOpenReceivePayment(prefillAmount)}
      />

      {/* §2 Primary Actions */}
      <PrimaryActionsBar
        tenantId={tenantId}
        onReceivePayment={() => handleOpenReceivePayment()}
        onCreateCharge={() => setObligationModal({ mode: 'create' })}
        onCreateRent={() => setObligationModal({ mode: 'create', initialValues: { obligationType: 'RENT' } })}
        onViewReceipts={() => handleNavigate('fin-documents')}
      />

      {/* §3 Obligations + §4 Financial Activity */}
      {isMobile ? (
        <Tabs value={mobileTab} onValueChange={(v) => setMobileTab(v as MobileTab)}>
          <TabsList className="w-full overflow-x-auto scrollbar-hide">
            <TabsTrigger value="obligations">Obligations</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>
          <TabsContent value="obligations">{obligationsSection}</TabsContent>
          <TabsContent value="activity">{activitySection}</TabsContent>
          <TabsContent value="ledger">{ledgerSection}</TabsContent>
          <TabsContent value="documents">{documentsSection}</TabsContent>
        </Tabs>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5">{obligationsSection}</div>
            <div className="lg:col-span-7">{activitySection}</div>
          </div>
          {ledgerSection}
          {documentsSection}
        </>
      )}

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
            <div className="flex gap-3 flex-wrap justify-between items-center text-xs">
              <div className="flex gap-2">
                <button type="button" onClick={() => runComplianceAction('REMIND_DOCUMENTS', 'Document reminder sent')} className="text-accent font-semibold hover:underline">
                  Remind documents
                </button>
                <span className="text-muted-foreground/30">·</span>
                <button type="button" onClick={() => runComplianceAction('RESEND_RULES', 'Rules reminder sent')} className="text-muted-foreground hover:text-foreground hover:underline">
                  Resend rules reminder
                </button>
              </div>
              <button type="button" onClick={downloadAcceptanceRecord} className="text-muted-foreground hover:text-foreground hover:underline">
                Download rules acceptance JSON
              </button>
            </div>

            <VerificationPanel
              hostelId={hostelId}
              tenantId={tenantId}
              profileType={String(tenant?.profile_type ?? 'STUDENT')}
              documents={(full?.identification_documents ?? full?.documents ?? []) as Record<string, unknown>[]}
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

      {/* Non-financial general activity feed (KYC/room/comms) — kept separate from Financial Activity */}
      <div className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <History className="w-4.5 h-4.5 text-accent" />
          Recent Activity
        </h3>
        <ActivityTimeline
          hostelId={hostelId}
          tenantId={tenantId}
          tenantName={name}
          joinedOn={String(tenant.joined_on ?? overview.joined_at ?? '')}
          profileType={String(tenant?.profile_type ?? 'STUDENT')}
          documents={(full?.identification_documents ?? full?.documents ?? [])}
          allocations={allocations}
          timelineItems={[]}
          recentPayments={recentPayments}
          moveOutRequest={overview.move_out ?? overview.move_out_request}
        />
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
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${badgeClass}`}>{badgeText}</span>
                      <span className="text-[9px] text-muted-foreground ml-auto font-medium">
                        {invite.created_at ? new Date(invite.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
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
                      <div className="mt-1 text-[10px] text-muted-foreground p-2.5 bg-rose-500/5 rounded-xl border border-rose-500/10 font-mono">{invite.notes}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Change Request Drawer */}
      <ChangeRequestDrawer
        open={showChangeDrawer}
        onClose={() => setShowChangeDrawer(false)}
        tenantId={tenantId}
        hostelId={hostelId}
        tenantData={{ ...tenant, ...profile }}
        onSuccess={handleChangeSuccess}
      />

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <RecordPaymentModal
          hostelId={hostelId}
          context={{
            tenantId,
            obligationId: payObligationId || undefined,
            defaultAmount: paymentPrefillAmount,
            source: 'tenant-profile',
          }}
          initialTenantData={overview}
          onClose={() => {
            setShowPaymentModal(false);
            setPayObligationId(null);
            setPaymentPrefillAmount(undefined);
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

      {/* Waive Obligation Modal */}
      {waiveObligation && (
        <WaiveObligationModal
          isOpen={true}
          obligation={waiveObligation}
          onClose={() => setWaiveObligation(null)}
          onConfirm={async (reason, identityToken) => {
            await api.post(`/payments/obligations/${waiveObligation.id || waiveObligation.obligation_id}/waive`, {
              reason,
              identityToken,
            });
            refetch();
          }}
        />
      )}

      {/* Cancel Obligation Modal (also used as the second step of "Edit") */}
      {cancelObligationTarget && (
        <CancelObligationModal
          isOpen={true}
          obligation={cancelObligationTarget}
          onClose={() => setCancelObligationTarget(null)}
          onConfirm={async (reason, identityToken) => {
            const id = cancelObligationTarget.id || cancelObligationTarget.obligation_id;
            await api.post(`/payments/obligations/${id}/cancel`, {
              reason: cancelObligationTarget.__editReason ?? reason,
              identityToken,
            });
            refetch();
          }}
        />
      )}

      {/* Obligation History Sheet */}
      <ObligationHistorySheet
        obligationId={historyObligation ? (historyObligation.id || historyObligation.obligation_id) : null}
        label={historyObligation ? String(historyObligation.obligation_type || historyObligation.type || 'Obligation').replace(/_/g, ' ') : ''}
        onClose={() => setHistoryObligation(null)}
      />

      {/* Create / Duplicate / Edit Obligation Modal */}
      {(showCreateObligationModal || obligationModal) && (
        <CreateObligationModal
          isOpen={true}
          tenantId={tenantId}
          hostelId={hostelId}
          mode={obligationModal?.mode ?? 'create'}
          initialValues={obligationModal?.initialValues}
          onClose={() => {
            setShowCreateObligationModal(false);
            setObligationModal(null);
          }}
          onSuccess={obligationModal?.mode === 'edit' ? handleEditObligationSuccess : () => refetch()}
        />
      )}
    </div>
  );
}
