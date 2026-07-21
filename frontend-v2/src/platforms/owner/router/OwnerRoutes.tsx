import { lazy, Suspense } from 'react';
import { Navigate, Route } from 'react-router-dom';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';

const App = lazy(() => import('@/app/App'));
const PortfolioView = lazy(() => import('@/app/components/views/PortfolioView').then((m) => ({ default: m.PortfolioView })));
const HostelDetailView = lazy(() => import('@/app/components/HostelDetailView').then((m) => ({ default: m.HostelDetailView })));
const TenantsPortfolioView = lazy(() => import('@/app/components/views/TenantsPortfolioView').then((m) => ({ default: m.TenantsPortfolioView })));
const TenantProfileRoute = lazy(() => import('@/app/components/views/TenantProfileRoute').then((m) => ({ default: m.TenantProfileRoute })));
const BulkInvitationImportView = lazy(() => import('@/app/components/views/BulkInvitationImportView').then((m) => ({ default: m.BulkInvitationImportView })));
const MoveOutsView = lazy(() => import('@/app/components/views/MoveOutsView').then((m) => ({ default: m.MoveOutsView })));
const RenewalQueueView = lazy(() => import('@/app/components/views/RenewalQueueView').then((m) => ({ default: m.RenewalQueueView })));
const RenewalWorkspaceView = lazy(() => import('@/app/components/views/RenewalWorkspaceView').then((m) => ({ default: m.RenewalWorkspaceView })));
const AgreementLifecycleRecoveryView = lazy(() => import('@/app/components/views/AgreementLifecycleRecoveryView').then((m) => ({ default: m.AgreementLifecycleRecoveryView })));
const AlertsView = lazy(() => import('@/app/components/views/AlertsView').then((m) => ({ default: m.AlertsView })));
const BillingView = lazy(() => import('@/app/components/views/BillingView').then((m) => ({ default: m.BillingView })));
const SettingsView = lazy(() => import('@/app/components/views/SettingsView').then((m) => ({ default: m.SettingsView })));
const ActivityLogsView = lazy(() => import('@/app/components/views/ActivityLogsView').then((m) => ({ default: m.ActivityLogsView })));
const OwnerProviderShell = lazy(() => import('./OwnerProviderShell').then((m) => ({ default: m.OwnerProviderShell })));

function OwnerRouteFallback() {
  return (
    <div className="min-h-screen bg-background px-4 py-5">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-10 w-48 rounded-lg bg-muted animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-20 rounded-xl bg-muted animate-pulse" />
          <div className="h-20 rounded-xl bg-muted animate-pulse" />
          <div className="h-20 rounded-xl bg-muted animate-pulse" />
        </div>
        <div className="h-40 rounded-xl bg-muted animate-pulse" />
      </div>
    </div>
  );
}

function OwnerBoundary() {
  return (
    <ErrorBoundary context="owner-routes">
      <Suspense fallback={<OwnerRouteFallback />}>
        <OwnerProviderShell />
      </Suspense>
    </ErrorBoundary>
  );
}

export function OwnerRoutes() {
  return (
    <Route
      element={<OwnerBoundary />}
    >
      <Route element={<App />}>
        <Route path="/dashboard" element={<PortfolioView />} />
        <Route path="/hostels" element={<Navigate to="/dashboard" replace />} />
        <Route path="/hostels/:hostelId" element={<HostelDetailView />} />
        <Route path="/hostels/:hostelId/:tab" element={<HostelDetailView />} />
        <Route path="/tenants" element={<TenantsPortfolioView />} />
        <Route path="/tenants/import" element={<BulkInvitationImportView />} />
        <Route path="/hostels/:hostelId/tenants/:tenantId" element={<TenantProfileRoute />} />
        <Route path="/hostels/:hostelId/move-outs" element={<MoveOutsView />} />
        <Route path="/move-outs" element={<MoveOutsView />} />
        <Route path="/agreements/renewals" element={<RenewalQueueView />} />
        <Route path="/agreements/renewals/:agreementId" element={<RenewalWorkspaceView />} />
        <Route path="/agreements/lifecycle-recovery" element={<AgreementLifecycleRecoveryView />} />
        <Route path="/alerts" element={<AlertsView />} />
        <Route path="/billing" element={<BillingView />} />
        <Route path="/admissions" element={<Navigate to="/dashboard" replace />} />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="/activity" element={<ActivityLogsView />} />
      </Route>
    </Route>
  );
}
