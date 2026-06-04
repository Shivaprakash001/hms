import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, Loader2, Bell, Download, FileCheck2, Send, CalendarDays, CheckCircle2, XCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tenantService } from '@features/tenants/api';
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
import { ReminderActionBar } from '@features/tenants/components/actions/ReminderActionBar';
import { getInitials } from '@features/tenants/utils/normalize';
import { RecordPaymentModal } from '@/app/components/modals/RecordPaymentModal';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'allocation', label: 'Room' },
  { id: 'billing', label: 'Billing' },
  { id: 'payments', label: 'Payments' },
  { id: 'documents', label: 'Documents' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'activity', label: 'Activity' },
  { id: 'exit', label: 'Exit' },
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
  if (item.type === 'PAYMENT' || item.type === 'ADVANCE_CREDIT') return Number(item.amount ?? 0);
  return Number(item.remaining ?? item.amount ?? 0);
};
const billingTimelineDateVerb = (item: Record<string, unknown>) =>
  item.type === 'PAYMENT' || item.type === 'ADVANCE_CREDIT' ? 'Paid' : 'Due';

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

  const { overview, allocations, dues, advance, full, isLoading, isError, refetch } =
    useTenantProfile(hostelId, tenantId, section);
  const actions = useTenantActions(hostelId);
  const billingTimeline = useQuery({
    queryKey: ['tenant', tenantId, 'billing-timeline'],
    queryFn: () => tenantService.getTenantBillingTimeline(tenantId),
    enabled: Boolean(tenantId) && section === 'billing',
  });
  const frequencyRequests = useQuery({
    queryKey: ['owner', 'billing-frequency-requests', tenantId],
    queryFn: () => ownerService.getFrequencyChangeRequests({ tenantId, status: 'PENDING' }),
    enabled: Boolean(tenantId) && section === 'billing',
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

  const profile = (overview?.profile ?? overview?.profiles ?? full?.profiles ?? {}) as Record<string, unknown>;
  const tenant = (overview?.tenant ?? overview ?? {}) as Record<string, unknown>;
  const name = String(profile?.name ?? tenant?.name ?? 'Tenant');
  const status = String(tenant?.status ?? overview?.status ?? 'ACTIVE');
  const photoUrl = String(tenant?.photo_url ?? overview?.photo_url ?? '').trim();
  const primaryPhone = String(profile?.phone ?? tenant?.phone_1 ?? overview?.phone ?? '').trim();
  const email = String(profile?.email ?? overview?.email ?? '').trim();
  const currentRoom = (tenant.current_room ?? overview?.current_room ?? null) as Record<string, unknown> | null;

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
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-4 py-5 max-w-3xl mx-auto pb-8 min-w-0">
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
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
            {primaryPhone && (
              <button
                type="button"
                onClick={() => actions.callTenant(primaryPhone)}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Phone className="w-3.5 h-3.5" />
                {primaryPhone}
              </button>
            )}
            {email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                {email}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-5 pb-1">
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${
              section === id
                ? 'bg-accent text-accent-foreground'
                : 'bg-secondary text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="p-3 rounded-xl border border-border bg-card">
              <p className="text-muted-foreground text-xs">Joined</p>
              <p className="font-medium">{date(tenant.joined_on ?? overview.joined_at)}</p>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card">
              <p className="text-muted-foreground text-xs">Room</p>
              <p className="font-medium">
                {currentRoom?.room_no ?? tenant.room_number ?? overview.room_number ?? 'Not assigned'}
              </p>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card">
              <p className="text-muted-foreground text-xs">Profile type</p>
              <p className="font-medium">{title(tenant.profile_type ?? overview.profile_type)}</p>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card">
              <p className="text-muted-foreground text-xs">Documents</p>
              <p className="font-medium">
                {tenant.document_verified || overview.document_verified
                  ? 'Verified'
                  : `${uploadedDocTypes.length}/${requiredDocTypes.length || 2} uploaded`}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="p-3 rounded-xl border border-border bg-card">
              <p className="text-muted-foreground text-xs">Primary phone</p>
              <p className="font-medium">{primaryPhone || 'Not provided'}</p>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card">
              <p className="text-muted-foreground text-xs">Guardian / emergency</p>
              <p className="font-medium">{String(tenant.guardian_phone ?? profile.emergency_contact ?? 'Not provided')}</p>
            </div>
          </div>
          <TenantFinancialSummary summary={paymentSummary} advance={advance as Record<string, unknown>} />
        </div>
      )}

      {section === 'allocation' && (
        <AllocationHistoryTimeline
          hostelId={hostelId}
          tenantId={tenantId}
          allocations={allocations}
          currentRoom={currentRoom}
          onChanged={refetch}
        />
      )}

      {section === 'billing' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-border bg-card space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Monthly rent:</span>{' '}
              <strong>{money(tenant.monthly_rent ?? overview.rent)}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Security deposit:</span>{' '}
              <strong>{money(securityDepositAmount)}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Maintenance:</span>{' '}
              <strong>
                {money(tenant.maintenance_charge ?? tenant.maintenance_amount)} (
                {String(tenant.maintenance_type ?? 'MONTHLY')})
              </strong>
            </p>
            <p>
              <span className="text-muted-foreground">Billing start:</span>{' '}
              <strong>{date(tenant.billing_start_date)}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Current room:</span>{' '}
              <strong>
                {currentRoom?.room_no ?? tenant.room_number ?? overview.room_number ?? 'Not assigned'}
                {currentRoom?.floor != null || tenant.floor != null ? ` · Floor ${currentRoom?.floor ?? tenant.floor}` : ''}
              </strong>
            </p>
            <p>
              <span className="text-muted-foreground">Active billing frequency:</span>{' '}
              <strong>{title(billingTimeline.data?.active_frequency ?? tenant.payment_frequency ?? 'MONTHLY')}</strong>
            </p>
            {billingTimeline.data?.billing_settings && (
              <p>
                <span className="text-muted-foreground">Due date rule:</span>{' '}
                <strong>
                  Generated {ordinal(billingTimeline.data.billing_settings.auto_rent_day)},
                  due {ordinal(billingTimeline.data.billing_settings.due_day)} each month
                  {billingTimeline.data.billing_settings.grace_days > 0
                    ? ` · ${billingTimeline.data.billing_settings.grace_days}d grace`
                    : ''}
                </strong>
              </p>
            )}
          </div>

          {pendingBillingRequests.length > 0 && (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-3">
              <p className="text-sm font-semibold text-amber-950">Pending billing frequency request</p>
              {pendingBillingRequests.map((request: any) => (
                <div key={request.id} className="rounded-lg bg-white/80 border border-amber-200 p-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {String(request.current_frequency).replaceAll('_', ' ')} → {String(request.requested_frequency).replaceAll('_', ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Effective {request.effective_from ? new Date(request.effective_from).toLocaleDateString('en-IN') : 'next clean period'}
                        {request.reason ? ` · ${request.reason}` : ''}
                      </p>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                      {request.risk_snapshot?.risk_level ?? 'REVIEW'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-background p-2">
                      <p className="text-muted-foreground">Pending dues</p>
                      <p className="font-bold">₹{Number(request.settlement_snapshot?.pending_dues ?? 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="rounded-lg bg-background p-2">
                      <p className="text-muted-foreground">Next expected</p>
                      <p className="font-bold">
                        {request.projection_snapshot?.expected_next_payment_date
                          ? new Date(request.projection_snapshot.expected_next_payment_date).toLocaleDateString('en-IN')
                          : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={decisionMutation.isPending}
                      onClick={() => decisionMutation.mutate({ id: request.id, action: 'APPROVE' })}
                      className="inline-flex items-center gap-2 rounded-xl bg-accent text-accent-foreground px-3 py-2 text-xs font-bold disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={decisionMutation.isPending}
                      onClick={() => decisionMutation.mutate({ id: request.id, action: 'REJECT' })}
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {timelineItems.length > 0 && (
            <div className="p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="w-4 h-4 text-accent" />
                <p className="text-sm font-semibold text-foreground">Billing timeline</p>
              </div>
              <div className="space-y-2">
                {timelineItems.slice(0, 12).map((item: any) => (
                  <div key={item.timeline_id ?? item.obligation_id} className="flex justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                    <div>
                      <p className="font-semibold">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {billingTimelineLabel(item)} · {billingTimelineDateVerb(item)} {new Date(item.due_date).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">₹{billingTimelineAmount(item).toLocaleString('en-IN')}</p>
                      <p className="text-[11px] font-bold uppercase text-muted-foreground">{String(item.state).replaceAll('_', ' ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <TenantFinancialSummary summary={paymentSummary} advance={advance as Record<string, unknown>} />
          <RentObligationList
            obligations={obligations as never[]}
            onRecordPayment={(id) => setPayObligationId(id)}
            onSetupBilling={() => setSection('billing')}
          />
        </div>
      )}

      {section === 'payments' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">Recent payments</h2>
            {recentPayments.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No payment history recorded yet.</p>
            ) : (
              <div className="mt-3 divide-y divide-border">
                {recentPayments.slice(0, 8).map((payment) => (
                  <div key={String(payment.id)} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{money(payment.amount ?? payment.amount_paid)}</p>
                      <p className="text-xs text-muted-foreground">
                        {date(payment.date ?? payment.payment_date)} · {title(payment.method ?? payment.payment_method)}
                      </p>
                    </div>
                    {payment.reference_number && (
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-[10px] text-muted-foreground">
                        {String(payment.reference_number)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <RentObligationList
            obligations={obligations as never[]}
            onRecordPayment={(id) => setPayObligationId(id)}
          />
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
          onUpdated={refetch}
        />
      )}

      {section === 'compliance' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <ComplianceCard
              label="Activation progress"
              value={`${Number(compliance.activation_progress_percent ?? 0)}%`}
              good={Number(compliance.activation_progress_percent ?? 0) === 100}
            />
            <ComplianceCard
              label="Last activity"
              value={
                compliance.onboarding_last_activity_at
                  ? new Date(String(compliance.onboarding_last_activity_at)).toLocaleDateString('en-IN')
                  : '—'
              }
              good={Boolean(compliance.onboarding_last_activity_at)}
            />
            <ComplianceCard
              label="Profile completed"
              value={compliance.profile_completed ? 'Complete' : 'Pending'}
              good={Boolean(compliance.profile_completed)}
            />
            <ComplianceCard
              label="Rules accepted"
              value={
                compliance.rules_accepted
                  ? new Date(String(compliance.rules_accepted_at)).toLocaleDateString('en-IN')
                  : 'Pending'
              }
              good={Boolean(compliance.rules_accepted)}
            />
            <ComplianceCard
              label="Documents uploaded"
              value={`${Number(compliance.documents_uploaded ?? uploadedDocTypes.length ?? 0)}/${requiredDocTypes.length || 2}`}
              good={Number(compliance.documents_uploaded ?? 0) > 0}
            />
            <ComplianceCard
              label="Verification"
              value={String(compliance.document_verification_status ?? 'PENDING')}
              good={String(compliance.document_verification_status) === 'VERIFIED'}
            />
          </div>

          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            <p className="font-semibold text-foreground">Owner actions</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {status === 'INVITED' && (
                <button
                  type="button"
                  onClick={() => runComplianceAction('RESEND_INVITE', 'Invitation resent')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium"
                >
                  <Send className="w-4 h-4 text-accent" />
                  Resend invite
                </button>
              )}
              {status === 'INVITED' && (
                <button
                  type="button"
                  onClick={() => runComplianceAction('REGENERATE_INVITE_TOKEN', 'Activation link regenerated')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium"
                >
                  <Send className="w-4 h-4 text-accent" />
                  Regenerate link
                </button>
              )}
              {status === 'INVITED' && (
                <button
                  type="button"
                  onClick={() => runComplianceAction('EXTEND_INVITATION_EXPIRY', 'Invitation expiry extended')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium"
                >
                  <Bell className="w-4 h-4 text-accent" />
                  Extend expiry
                </button>
              )}
              <button
                type="button"
                onClick={() => runComplianceAction('RESEND_RULES', 'Rules reminder sent')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium"
              >
                <Bell className="w-4 h-4 text-accent" />
                Resend rules
              </button>
              <button
                type="button"
                onClick={() => runComplianceAction('REMIND_DOCUMENTS', 'Document reminder sent')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium"
              >
                <FileCheck2 className="w-4 h-4 text-accent" />
                Remind documents
              </button>
              <button
                type="button"
                onClick={downloadAcceptanceRecord}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium"
              >
                <Download className="w-4 h-4 text-accent" />
                Download acceptance
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Document approval and rejection happen only in the Documents tab.
            </p>
          </div>
        </div>
      )}

      {section === 'activity' && (
        <ActivityTimeline hostelId={hostelId} tenantId={tenantId} tenantName={name} />
      )}

      {section === 'exit' && (
        <ExitWorkflowSection hostelId={hostelId} tenantId={tenantId} status={status} />
      )}

      {status === 'ACTIVE' && (
        <ReminderActionBar hostelId={hostelId} tenantId={tenantId} className="mt-5 mb-2" />
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
    </div>
  );
}

function ComplianceCard({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="p-3 rounded-xl border border-border bg-card">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={`font-medium ${good ? 'text-emerald-600' : 'text-amber-600'}`}>{value}</p>
    </div>
  );
}
