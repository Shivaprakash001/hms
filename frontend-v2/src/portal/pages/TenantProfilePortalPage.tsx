import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { tenantService } from '@features/tenants/api';
import { TenantDocumentStatus } from '@/portal/components/TenantDocumentStatus';

export function TenantProfilePortalPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['tenant', 'me', 'profile'],
    queryFn: () => tenantService.getMyProfile(),
  });

  const { data: documents } = useQuery({
    queryKey: ['tenant', 'me', 'documents'],
    queryFn: () => tenantService.getMyDocuments(),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const prof = (data?.profile ?? data?.profiles) as Record<string, unknown> | undefined;
  const tenant = data as Record<string, unknown>;
  const profileType = String(tenant.profile_type ?? 'STUDENT').toUpperCase();
  const isStudent = profileType === 'STUDENT';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Profile</h1>
        <Link to="/tenant/settings" className="text-sm text-accent font-medium">
          Settings
        </Link>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 space-y-3 text-sm">
        <h2 className="text-sm font-semibold text-foreground">Personal info</h2>
        <p>
          <span className="text-muted-foreground">Name</span>
          <br />
          <span className="font-medium">{String(prof?.name ?? '—')}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Phone</span>
          <br />
          <span className="font-medium">{String(prof?.phone ?? tenant.phone_1 ?? '—')}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Email</span>
          <br />
          <span className="font-medium">{String(prof?.email ?? tenant.personal_email ?? '—')}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Emergency contact</span>
          <br />
          <span className="font-medium">{String(prof?.emergency_contact ?? '—')}</span>
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-3 text-sm">
        <h2 className="text-sm font-semibold text-foreground">
          {isStudent ? 'Academic info' : 'Work info'}
        </h2>
        {isStudent ? (
          <>
            <p>
              <span className="text-muted-foreground">College</span>
              <br />
              <span className="font-medium">{String(tenant.college_name ?? '—')}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Course / year</span>
              <br />
              <span className="font-medium">
                {[tenant.course, tenant.year_of_study].filter(Boolean).join(' · ') || '—'}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">Roll no.</span>
              <br />
              <span className="font-medium">{String(tenant.roll_number ?? '—')}</span>
            </p>
          </>
        ) : (
          <>
            <p>
              <span className="text-muted-foreground">Office</span>
              <br />
              <span className="font-medium">{String(tenant.office_name ?? '—')}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Role</span>
              <br />
              <span className="font-medium">{String(tenant.job_role ?? '—')}</span>
            </p>
          </>
        )}
      </section>

      <TenantDocumentStatus documents={documents as never[]} />

      <p className="text-xs text-muted-foreground text-center">
        Need to update details? Contact hostel management or use complete-profile if invited.
      </p>
    </div>
  );
}
