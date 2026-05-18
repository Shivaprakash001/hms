import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, Loader2 } from 'lucide-react';
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
  const [section, setSection] = useState<SectionId>('overview');
  const [payObligationId, setPayObligationId] = useState<string | null>(null);

  const { overview, allocations, dues, advance, full, isLoading, isError, refetch } =
    useTenantProfile(hostelId, tenantId, section);
  const actions = useTenantActions(hostelId);

  const profile = (overview?.profile ?? overview?.profiles ?? full?.profiles) as Record<string, unknown> | undefined;
  const tenant = (overview?.tenant ?? overview) as Record<string, unknown>;
  const name = String(profile?.name ?? tenant?.name ?? 'Tenant');
  const status = String(tenant?.status ?? overview?.status ?? 'ACTIVE');

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
        <div className="w-14 h-14 rounded-2xl bg-accent/15 flex items-center justify-center text-lg font-bold text-accent shrink-0">
          {getInitials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-foreground">{name}</h1>
            <TenantStatusBadge status={status} size="md" />
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
            {profile?.phone && (
              <button
                type="button"
                onClick={() => actions.callTenant(String(profile.phone))}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Phone className="w-3.5 h-3.5" />
                {String(profile.phone)}
              </button>
            )}
            {profile?.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                {String(profile.email)}
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
                {tenant?.joined_on
                  ? new Date(String(tenant.joined_on)).toLocaleDateString('en-IN')
                  : '—'}
              </p>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card">
              <p className="text-muted-foreground text-xs">Profile type</p>
              <p className="font-medium">{String(tenant?.profile_type ?? '—')}</p>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card">
              <p className="text-muted-foreground text-xs">Mobile verified</p>
              <p className="font-medium">{profile?.phone_verified ? 'Yes' : 'No'}</p>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card">
              <p className="text-muted-foreground text-xs">Documents</p>
              <p className="font-medium">{tenant?.document_verified ? 'Verified' : 'Pending'}</p>
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
              <strong>₹{Number(tenant?.monthly_rent ?? 0).toLocaleString('en-IN')}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Security deposit:</span>{' '}
              <strong>₹{Number(tenant?.advance_amount ?? tenant?.security_deposit ?? 0).toLocaleString('en-IN')}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Maintenance:</span>{' '}
              <strong>
                ₹{Number(tenant?.maintenance_amount ?? 0).toLocaleString('en-IN')} (
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
