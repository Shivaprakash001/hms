import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, Loader2, Bell, Download, FileCheck2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { tenantService } from '@features/tenants/api';
import { useTenantProfile } from '@features/tenants/hooks/useTenantProfile';
import { useTenantActions } from '@features/tenants/hooks/useTenantActions';
import { TenantStatusBadge } from '@features/tenants/components/badges/TenantStatusBadge';
import { TenantFinancialSummary } from '@features/tenants/components/financial/TenantFinancialSummary';
import { RentObligationList } from '@features/tenants/components/financial/RentObligationList';
import { AllocationHistoryTimeline } from '@features/tenants/components/allocation/AllocationHistoryTimeline';
import { VerificationPanel } from '@features/tenants/components/documents/VerificationPanel';
import { ActivityTimeline } from '@features/tenants/components/profile/ActivityTimeline';
import { ExitWorkflowSection } from '@features/tenants/components/profile/ExitWorkflowSection';
import { ComplaintsSection } from '@features/tenants/components/profile/ComplaintsSection';
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
  { id: 'complaints', label: 'Complaints' },
  { id: 'exit', label: 'Exit' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

interface TenantProfilePageProps {
  hostelIdProp?: string;
  tenantIdProp?: string;
  onBack?: () => void;
}

export function TenantProfilePage({ hostelIdProp, tenantIdProp, onBack }: TenantProfilePageProps = {}) {
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

  const profile = (overview?.profile ?? overview?.profiles ?? full?.profiles ?? {}) as Record<string, unknown>;
  const tenant = (overview?.tenant ?? overview ?? {}) as Record<string, unknown>;
  const name = String(profile?.name ?? tenant?.name ?? 'Tenant');
  const status = String(tenant?.status ?? overview?.status ?? 'ACTIVE');
  const photoUrl = String(tenant?.photo_url ?? overview?.photo_url ?? '').trim();
  const primaryPhone = String(profile?.phone ?? tenant?.phone_1 ?? overview?.phone ?? '').trim();
  const email = String(profile?.email ?? overview?.email ?? '').trim();

  const obligations = Array.isArray(dues)
    ? dues
    : Array.isArray((dues as Record<string, unknown>)?.obligations)
      ? ((dues as Record<string, unknown>).obligations as Record<string, unknown>[])
      : [];

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

  const paymentSummary = (overview.payment_summary ?? overview.financial_summary) as Record<string, unknown> | undefined;
  const compliance = (overview.compliance ?? {}) as Record<string, unknown>;

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
    <div className="px-4 py-5 max-w-3xl mx-auto pb-28 md:pb-8 min-w-0">
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
              <p className="font-medium">
                {tenant?.joined_on || overview?.joined_at
                  ? new Date(String(tenant.joined_on ?? overview.joined_at)).toLocaleDateString('en-IN')
                  : '—'}
              </p>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card">
              <p className="text-muted-foreground text-xs">Profile type</p>
              <p className="font-medium">{String(tenant?.profile_type ?? '—')}</p>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card">
              <p className="text-muted-foreground text-xs">Mobile verified</p>
              <p className="font-medium">{profile?.phone_verified || profile?.mobile_verified ? 'Yes' : 'No'}</p>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card">
              <p className="text-muted-foreground text-xs">Documents</p>
              <p className="font-medium">{tenant?.document_verified || overview?.document_verified ? 'Verified' : 'Pending'}</p>
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
          onChanged={refetch}
        />
      )}

      {section === 'billing' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-border bg-card space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Monthly rent:</span>{' '}
              <strong>₹{Number(tenant?.monthly_rent ?? overview?.rent ?? 0).toLocaleString('en-IN')}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Security deposit:</span>{' '}
              <strong>₹{Number(tenant?.advance_deposit ?? tenant?.advance_amount ?? tenant?.security_deposit ?? 0).toLocaleString('en-IN')}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Maintenance:</span>{' '}
              <strong>
                ₹{Number(tenant?.maintenance_charge ?? tenant?.maintenance_amount ?? 0).toLocaleString('en-IN')} (
                {String(tenant?.maintenance_type ?? 'MONTHLY')})
              </strong>
            </p>
          </div>
          <TenantFinancialSummary summary={paymentSummary} advance={advance as Record<string, unknown>} />
          <RentObligationList
            obligations={obligations as never[]}
            onRecordPayment={(id) => setPayObligationId(id)}
          />
        </div>
      )}

      {section === 'payments' && (
        <RentObligationList
          obligations={obligations as never[]}
          onRecordPayment={(id) => setPayObligationId(id)}
        />
      )}

      {section === 'documents' && (
        <VerificationPanel
          hostelId={hostelId}
          tenantId={tenantId}
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
              value={String(compliance.documents_uploaded ?? 0)}
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
              <button
                type="button"
                onClick={() => runComplianceAction('MARK_DOCUMENTS_VERIFIED', 'Documents marked verified')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium"
              >
                <FileCheck2 className="w-4 h-4 text-accent" />
                Mark docs verified
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Document verification actions remain in the Documents tab.
            </p>
          </div>
        </div>
      )}

      {section === 'activity' && (
        <ActivityTimeline hostelId={hostelId} tenantId={tenantId} tenantName={name} />
      )}

      {section === 'complaints' && <ComplaintsSection />}

      {section === 'exit' && (
        <ExitWorkflowSection hostelId={hostelId} tenantId={tenantId} status={status} />
      )}

      {status === 'ACTIVE' && (
        <ReminderActionBar hostelId={hostelId} tenantId={tenantId} className="fixed bottom-20 left-0 right-0 px-4 md:static md:mt-6 md:px-0" />
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
