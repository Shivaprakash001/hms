import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Phone, Mail, Loader2, Bell, Download, FileCheck2, Send, CalendarDays,
  CheckCircle2, XCircle, ShieldAlert, Smartphone, MessageSquare, BedDouble, User,
  Building2, Settings, IndianRupee, LogOut, CheckCircle, AlertTriangle, AlertCircle,
  History
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tenantService } from '@features/tenants/api';
import { TenantScoreCard } from '@features/tenants/components/score/TenantScoreCard';
import { ownerService } from '@features/owners/api';
import { useTenantProfile } from '@features/tenants/hooks/useTenantProfile';
import { useTenantActions } from '@features/tenants/hooks/useTenantActions';
import { TenantStatusBadge } from '@features/tenants/components/badges/TenantStatusBadge';
import { TenantFinancialSummary } from '@features/tenants/components/financial/TenantFinancialSummary';
import { RentObligationList } from '@features/tenants/components/financial/RentObligationList';
import { AllocationHistoryTimeline } from '@features/tenants/components/allocation/AllocationHistoryTimeline';
import { VerificationPanel } from '@features/tenants/components/documents/VerificationPanel';
import { ActivityTimeline } from '@features/tenants/components/profile/ActivityTimeline';
import { ExitWorkflowSection } from '@features/tenants/components/profile/ExitWorkflowSection';
import { getInitials } from '@features/tenants/utils/normalize';
import { RecordPaymentModal } from '@/app/components/modals/RecordPaymentModal';
import { EditInviteModal } from '@/app/components/modals/EditInviteModal';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'stay', label: 'Stay' },
  { id: 'money', label: 'Money' },
  { id: 'documents', label: 'Documents' },
  { id: 'activity', label: 'Activity' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

const money = (value: unknown) => `₹${Number(value ?? 0).toLocaleString('en-IN')}`;
const date = (value: unknown) => (value ? new Date(String(value)).toLocaleDateString('en-IN') : '—');
const title = (value: unknown) => String(value ?? '—').replaceAll('_', ' ');
const ordinal = (n: number) => { const s = ['th','st','nd','rd']; const v = n % 100; return n + (s[(v-20)%10] || s[v] || s[0]); };
const billingTimelineLabel = (item: Record<string, unknown>) => {
  if (item.type === 'ADVANCE_CREDIT') return 'Future rent credit';
  return String(item.type).replace('PROJECTED_', '').replaceAll('_', ' ');
};
const billingTimelineAmount = (item: Record<string, unknown>) => {
  return Number(item.amount ?? 0);
};
const billingTimelineDateVerb = (item: Record<string, unknown>) =>
  item.type === 'PAYMENT' || item.type === 'ADVANCE_CREDIT' ? 'Paid' : 'Due';
const billingTimelineTone = (item: Record<string, unknown>) => {
  if (item.type === 'PAYMENT' || item.type === 'ADVANCE_CREDIT' || item.state === 'covered') {
    return 'border-emerald-200 bg-emerald-50/60';
  }
  if (item.state === 'upcoming') return 'border-dashed border-accent/30 bg-accent/5';
  return 'border-border';
};

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
  const [searchParams] = useSearchParams();
  const [section, setSection] = useState<SectionId>((searchParams.get('tab') as SectionId) || 'overview');
  const [payObligationId, setPayObligationId] = useState<string | null>(null);
  const [showEditInvite, setShowEditInvite] = useState(false);

  const { overview, allocations, dues, advance, full, isLoading, isError, refetch } =
    useTenantProfile(hostelId, tenantId, section);
  const actions = useTenantActions(hostelId);
  const billingTimeline = useQuery({
    queryKey: ['tenant', tenantId, 'billing-timeline'],
    queryFn: () => tenantService.getTenantBillingTimeline(tenantId),
    enabled: Boolean(tenantId) && section === 'money',
  });
  const frequencyRequests = useQuery({
    queryKey: ['owner', 'billing-frequency-requests', tenantId],
    queryFn: () => ownerService.getFrequencyChangeRequests({ tenantId, status: 'PENDING' }),
    enabled: Boolean(tenantId) && section === 'money',
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

  const { data: tenantScore, isLoading: scoreLoading } = useQuery({
    queryKey: ['tenant-score', tenantId],
    queryFn: () => tenantService.getTenantScore(tenantId),
    enabled: Boolean(tenantId) && section === 'overview',
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
          className="mt-4 text-sm text-accent"
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
    <div className="px-4 py-5 max-w-3xl mx-auto pb-24 min-w-0">
      <button
        type="button"
        onClick={() => (onBack ? onBack() : navigate(`/hostels/${hostelId}/tenants`))}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Tenants
      </button>

      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-accent/15 overflow-hidden flex items-center justify-center text-lg font-bold text-accent shrink-0">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            getInitials(name)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">{name}</h1>
            <TenantStatusBadge status={status} size="md" />
            {isOverdue && (
              <span className="inline-flex items-center rounded-full border font-medium px-2.5 py-1 text-xs bg-rose-500/15 text-rose-600 border-rose-500/30">
                Overdue
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Room: <strong className="text-foreground">{displayedRoomNo ?? 'Not assigned'}</strong>
            {' · '}
            Joined: <strong className="text-foreground">{date(tenant.joined_on ?? overview.joined_at)}</strong>
            {(tenant.exit_date ?? overview?.exit_date) && (
              <>
                {' · '}
                Move-out: <strong className="text-foreground">{date(tenant.exit_date ?? overview.exit_date)}</strong>
              </>
            )}
            {' · '}
            Dues: <strong className={isOverdue ? 'text-rose-600' : 'text-foreground'}>{money(paymentSummary?.pending_amount ?? overview.outstanding ?? 0)}</strong>
          </p>
        </div>
      </div>

      {needsRoomAssignment && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-amber-900">Tenant requires room assignment</p>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                This tenant is active but not allocated to a room. Assign a room before relying on occupancy or rent-by-room reports.
              </p>
              <button
                type="button"
                onClick={() => setSection('stay')}
                className="mt-3 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white"
              >
                Assign Room
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-5 pb-1 border-b border-border">
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={`shrink-0 px-4 py-2 border-b-2 font-medium text-xs transition-all duration-200 ${
              section === id
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'overview' && (
        <div className="space-y-4">
          {/* Behavior Score */}
          <TenantScoreCard scoreData={tenantScore} loading={scoreLoading} />

          {/* Emergency / Guardian Contact Info Card */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-3 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              Emergency / Guardian Contact
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Guardian Name</p>
                <p className="font-semibold text-foreground mt-0.5">
                  {String(tenant.guardian_name || profile.guardian_name || 'Not provided')}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Guardian Phone</p>
                {tenant.guardian_phone || profile.guardian_phone ? (
                  <button
                    onClick={() => actions.callTenant(String(tenant.guardian_phone || profile.guardian_phone))}
                    className="font-semibold text-accent hover:underline mt-0.5 block text-left"
                  >
                    {String(tenant.guardian_phone || profile.guardian_phone)}
                  </button>
                ) : (
                  <p className="font-semibold text-foreground mt-0.5">Not provided</p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground">Relationship</p>
                <p className="font-semibold text-foreground mt-0.5">
                  {String(tenant.guardian_relation || profile.guardian_relation || 'Not provided')}
                </p>
              </div>
            </div>
          </div>

          {/* Identity details card */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-3 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <User className="w-4 h-4 text-accent" />
              Identity Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-muted-foreground">Profile Type</p>
                <p className="font-semibold text-foreground mt-0.5">{title(tenant.profile_type ?? overview.profile_type)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Primary Phone</p>
                <p className="font-semibold text-foreground mt-0.5">{primaryPhone || 'Not provided'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Email Address</p>
                <p className="font-semibold text-foreground mt-0.5">{email || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Gender</p>
                <p className="font-semibold text-foreground mt-0.5">{String(tenant.gender ?? 'Not provided')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date of Birth</p>
                <p className="font-semibold text-foreground mt-0.5">{date(tenant.date_of_birth)}</p>
              </div>
              
              {/* Conditional academic details */}
              {String(tenant.profile_type ?? overview.profile_type).toUpperCase() === 'STUDENT' ? (
                <>
                  <div className="col-span-2 border-t border-border pt-3 mt-1">
                    <p className="text-muted-foreground">College Name</p>
                    <p className="font-semibold text-foreground mt-0.5">{String(tenant.college_name || 'Not provided')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Course</p>
                    <p className="font-semibold text-foreground mt-0.5">{String(tenant.course || 'Not provided')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Year of Study</p>
                    <p className="font-semibold text-foreground mt-0.5">{tenant.year_of_study ? `${tenant.year_of_study} Year` : 'Not provided'}</p>
                  </div>
                  {tenant.branch && (
                    <div>
                      <p className="text-muted-foreground">Branch</p>
                      <p className="font-semibold text-foreground mt-0.5">{String(tenant.branch)}</p>
                    </div>
                  )}
                  {tenant.roll_number && (
                    <div>
                      <p className="text-muted-foreground">Roll Number</p>
                      <p className="font-semibold text-foreground mt-0.5">{String(tenant.roll_number)}</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {tenant.office_name && (
                    <div className="col-span-2 border-t border-border pt-3 mt-1">
                      <p className="text-muted-foreground">Office / Workplace</p>
                      <p className="font-semibold text-foreground mt-0.5">{String(tenant.office_name)}</p>
                    </div>
                  )}
                  {tenant.job_role && (
                    <div>
                      <p className="text-muted-foreground">Job Role / Designation</p>
                      <p className="font-semibold text-foreground mt-0.5">{String(tenant.job_role)}</p>
                    </div>
                  )}
                  {tenant.office_location && (
                    <div>
                      <p className="text-muted-foreground">Office Location</p>
                      <p className="font-semibold text-foreground mt-0.5">{String(tenant.office_location)}</p>
                    </div>
                  )}
                </>
              )}
              
              <div className="col-span-2 border-t border-border pt-3">
                <p className="text-muted-foreground">Permanent Address</p>
                <p className="font-semibold text-foreground mt-0.5 leading-relaxed">{String(tenant.permanent_address || 'Not provided')}</p>
              </div>
            </div>
          </div>

          {/* Binary Operational Onboarding Statuses Card */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-3 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Onboarding &amp; Compliance Status
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-secondary/30 rounded-xl border border-border">
                <p className="text-muted-foreground">Profile Details</p>
                <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${compliance.profile_completed ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}`}>
                  {compliance.profile_completed ? 'Complete' : 'Pending'}
                </span>
              </div>
              <div className="p-3 bg-secondary/30 rounded-xl border border-border">
                <p className="text-muted-foreground">Documents Verified</p>
                <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${String(compliance.document_verification_status).toUpperCase() === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}`}>
                  {String(compliance.document_verification_status).toUpperCase() === 'VERIFIED' ? 'Verified' : 'Pending Review'}
                </span>
              </div>
              <div className="p-3 bg-secondary/30 rounded-xl border border-border">
                <p className="text-muted-foreground">Hostel Rules</p>
                <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${compliance.rules_accepted ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}`}>
                  {compliance.rules_accepted ? 'Accepted' : 'Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic contextual actions */}
          {status === 'INVITED' ? (
            <div className="p-4 rounded-xl border border-border bg-card space-y-3 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground">Onboarding Actions</h3>
              <div className="grid gap-2.5 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setShowEditInvite(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-xs font-bold hover:bg-secondary transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-accent" />
                  Resend Invite
                </button>
                <button
                  type="button"
                  onClick={() => runComplianceAction('EXTEND_INVITATION_EXPIRY', 'Invitation expiry extended')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-xs font-bold hover:bg-secondary transition-colors"
                >
                  <Bell className="w-3.5 h-3.5 text-accent" />
                  Extend Expiry
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Cancel this invitation?')) {
                      actions.cancelInvite.mutate(tenantId);
                    }
                  }}
                  disabled={actions.cancelInvite.isPending}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-500/5 text-rose-500 px-3.5 py-2.5 text-xs font-bold hover:bg-rose-500/10 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Cancel Invite
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-border bg-card space-y-3 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground">Operations Actions</h3>
              <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-4">
                {primaryPhone && (
                  <button
                    type="button"
                    onClick={() => actions.callTenant(primaryPhone)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent text-accent-foreground px-3 py-2 text-xs font-bold active:scale-95 transition-transform"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Call Tenant
                  </button>
                )}
                {primaryPhone && (
                  <button
                    type="button"
                    onClick={() => whatsAppTenant(primaryPhone)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-white px-3 py-2 text-xs font-bold active:scale-95 transition-transform hover:bg-emerald-700"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    WhatsApp
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSection('stay')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-secondary transition-colors"
                >
                  <BedDouble className="w-3.5 h-3.5 text-accent" />
                  Move Room
                </button>
                <button
                  type="button"
                  onClick={() => runComplianceAction('REMIND_DOCUMENTS', 'Document reminder sent')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-secondary transition-colors"
                >
                  <FileCheck2 className="w-3.5 h-3.5 text-accent" />
                  Request Docs
                </button>
              </div>

              {/* Secondary operations links */}
              <div className="flex gap-3 flex-wrap pt-2 justify-center sm:justify-start border-t border-border/40">
                <button
                  type="button"
                  onClick={() => runComplianceAction('RESEND_RULES', 'Rules reminder sent')}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  Resend rules reminder
                </button>
                <span className="text-muted-foreground/30">·</span>
                <button
                  type="button"
                  onClick={downloadAcceptanceRecord}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  Download rules acceptance JSON
                </button>
              </div>
            </div>
          )}

          {/* Invitation History Timeline Card */}
          {((tenant?.tenant_invitations ?? overview?.tenant_invitations ?? []) as any[]).length > 0 && (
            <div className="p-4 rounded-xl border border-border bg-card space-y-4 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <History className="w-4 h-4 text-accent" />
                Invitation History
              </h3>
              
              <div className="relative pl-6 border-l border-border space-y-5 ml-2 mt-2">
                {((tenant?.tenant_invitations ?? overview?.tenant_invitations ?? []) as any[]).map((invite: any, index: number, arr: any[]) => {
                  const versionNum = arr.length - index;
                  const isActive = index === 0;
                  
                  // Status badge helper
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
                    <div key={invite.id} className="relative group">
                      {/* Timeline dot */}
                      <span className={`absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full border-2 bg-card ${isActive ? 'border-accent animate-pulse' : 'border-muted'}`} />
                      
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-foreground">Version {versionNum}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${badgeClass}`}>
                            {badgeText}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {invite.created_at ? new Date(invite.created_at).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : ''}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1.5 text-xs text-muted-foreground p-3 bg-secondary/20 rounded-xl border border-border/40">
                          <div>
                            <span className="block text-[10px] text-muted-foreground/75 uppercase tracking-wider">Room</span>
                            <span className="font-medium text-foreground">{invite.room?.room_no || 'Unassigned'}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-muted-foreground/75 uppercase tracking-wider">Monthly Rent</span>
                            <span className="font-medium text-foreground">{money(invite.monthly_rent)}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-muted-foreground/75 uppercase tracking-wider">Agreement Period</span>
                            <span className="font-medium text-foreground">
                              {invite.agreement_duration_months ? `${invite.agreement_duration_months} mo` : '—'}
                              {invite.agreement_start_date ? ` (from ${new Date(invite.agreement_start_date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })})` : ''}
                            </span>
                          </div>
                        </div>

                        {invite.notes && (
                          <div className="mt-2 text-[11px] text-muted-foreground p-3 bg-rose-500/5 rounded-xl border border-rose-500/10 font-sans leading-relaxed">
                            <span className="block font-semibold text-rose-600/90 mb-1">Changes Log</span>
                            <div className="whitespace-pre-line text-muted-foreground/90 font-mono text-[10px]">
                              {invite.notes}
                            </div>
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
      )}

      {section === 'stay' && (
        <div className="space-y-6">
          <AllocationHistoryTimeline
            hostelId={hostelId}
            tenantId={tenantId}
            allocations={allocations}
            currentRoom={currentRoom}
            onChanged={refetch}
          />
          <div className="border-t border-border pt-6">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <LogOut className="w-4.5 h-4.5 text-muted-foreground" />
              Exit &amp; Move-Out Status
            </h3>
            <ExitWorkflowSection hostelId={hostelId} tenantId={tenantId} status={status} />
          </div>
        </div>
      )}

      {section === 'money' && (
        <div className="space-y-4">
          <TenantFinancialSummary summary={paymentSummary} advance={advance as Record<string, unknown>} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Rent Plan Config & Outstanding Dues */}
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card space-y-2.5 text-xs shadow-sm">
                <p className="font-semibold text-foreground text-sm border-b border-border pb-1.5 mb-2">Rent &amp; Billing Settings</p>
                <p><span className="text-muted-foreground">Monthly Rent:</span> <strong>{money(tenant.monthly_rent ?? overview.rent)}</strong></p>
                <p><span className="text-muted-foreground">Security Deposit:</span> <strong>{money(securityDepositAmount)}</strong></p>
                <p>
                  <span className="text-muted-foreground">Maintenance:</span>{' '}
                  <strong>
                    {money(tenant.maintenance_charge ?? tenant.maintenance_amount)} (
                    {String(tenant.maintenance_type ?? 'MONTHLY')})
                  </strong>
                </p>
                <p><span className="text-muted-foreground">Billing Start Date:</span> <strong>{date(tenant.billing_start_date)}</strong></p>
                <p><span className="text-muted-foreground">Billing Frequency:</span> <strong>{title(billingTimeline.data?.active_frequency ?? tenant.payment_frequency ?? 'MONTHLY')}</strong></p>
                {billingTimeline.data?.billing_settings && (
                  <p>
                    <span className="text-muted-foreground">Due Date Rule:</span>{' '}
                    <strong>
                      Generated {ordinal(billingTimeline.data.billing_settings.auto_rent_day)}, due {ordinal(billingTimeline.data.billing_settings.due_day)} each month
                    </strong>
                  </p>
                )}
              </div>

              {pendingBillingRequests.length > 0 && (
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-3 shadow-sm">
                  <p className="text-sm font-semibold text-amber-950">Pending frequency request</p>
                  {pendingBillingRequests.map((request: any) => (
                    <div key={request.id} className="rounded-lg bg-white/80 border border-amber-200 p-3 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {String(request.current_frequency).replaceAll('_', ' ')} → {String(request.requested_frequency).replaceAll('_', ' ')}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Effective {request.effective_from ? new Date(request.effective_from).toLocaleDateString('en-IN') : 'next clean period'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={decisionMutation.isPending}
                          onClick={() => decisionMutation.mutate({ id: request.id, action: 'APPROVE' })}
                          className="inline-flex items-center gap-1 bg-accent text-accent-foreground px-3 py-1.5 rounded-lg text-xs font-bold"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={decisionMutation.isPending}
                          onClick={() => decisionMutation.mutate({ id: request.id, action: 'REJECT' })}
                          className="inline-flex items-center gap-1 border border-border bg-background px-3 py-1.5 rounded-lg text-xs font-bold"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <RentObligationList
                obligations={obligations as never[]}
                onRecordPayment={(id) => setPayObligationId(id)}
                hasActivePlan={Number(tenant?.monthly_rent ?? overview?.rent ?? 0) > 0}
              />
            </div>

            {/* Financial Timeline */}
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center gap-2 mb-3 border-b border-border pb-2">
                  <CalendarDays className="w-4 h-4 text-accent" />
                  <p className="text-sm font-semibold text-foreground">Financial Timeline</p>
                </div>
                {billingTimeline.data?.next_rent_generation && (
                  <div className="mb-4 rounded-xl border border-accent/20 bg-accent/5 p-3.5 text-xs shadow-sm">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <p className="font-bold text-foreground">Next Rent Generation</p>
                        <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                          Scheduled: {new Date(billingTimeline.data.next_rent_generation.next_rent_generation_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-muted-foreground text-[11px] leading-relaxed">
                          Period: {new Date(billingTimeline.data.next_rent_generation.period_start).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-extrabold text-foreground text-sm">
                          ₹{billingTimeline.data.next_rent_generation.next_installment_amount.toLocaleString('en-IN')}
                        </p>
                        <p className="text-muted-foreground mt-1 text-[11px]">
                          Due by: {new Date(billingTimeline.data.next_rent_generation.next_installment_due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                        {billingTimeline.data.next_rent_generation.next_maintenance_amount > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            + ₹{billingTimeline.data.next_rent_generation.next_maintenance_amount.toLocaleString('en-IN')} Maintenance
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {mergedTimeline.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">No billing or payment history recorded yet.</p>
                ) : (
                  <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                    {mergedTimeline.slice(0, 16).map((item) => (
                      <div key={item.id} className={`flex justify-between gap-3 rounded-xl border p-3.5 text-xs ${item.tone} shadow-sm`}>
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">{item.title}</p>
                          <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">{item.subtitle}</p>
                          <p className="text-[10px] text-muted-foreground mt-1.5 font-medium">
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
            </div>
          </div>
        </div>
      )}

      {section === 'documents' && (
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
      )}

      {section === 'activity' && (
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
      )}

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
