import { lazy, Suspense } from 'react';
import { Navigate, Route } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ownerService } from '@features/owners/api';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';

const App = lazy(() => import('@/app/App'));
const PortfolioView = lazy(() => import('@/app/components/views/PortfolioView').then((m) => ({ default: m.PortfolioView })));
const HostelDetailView = lazy(() => import('@/app/components/HostelDetailView').then((m) => ({ default: m.HostelDetailView })));
const TenantsPortfolioView = lazy(() => import('@/app/components/views/TenantsPortfolioView').then((m) => ({ default: m.TenantsPortfolioView })));
const TenantProfileRoute = lazy(() => import('@/app/components/views/TenantProfileRoute').then((m) => ({ default: m.TenantProfileRoute })));
const BulkInvitationImportView = lazy(() => import('@/app/components/views/BulkInvitationImportView').then((m) => ({ default: m.BulkInvitationImportView })));
const MoveOutsView = lazy(() => import('@/app/components/views/MoveOutsView').then((m) => ({ default: m.MoveOutsView })));
const BillingView = lazy(() => import('@/app/components/views/BillingView').then((m) => ({ default: m.BillingView })));
const AdmissionsView = lazy(() => import('@/app/components/views/AdmissionsView').then((m) => ({ default: m.AdmissionsView })));
const SettingsView = lazy(() => import('@/app/components/views/SettingsView').then((m) => ({ default: m.SettingsView })));
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

function GlobalActivityRedirect() {
  const { data: hostelsData, isLoading } = useQuery({
    queryKey: ['owner', 'hostels'],
    queryFn: ownerService.getHostels,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  const hostels = Array.isArray(hostelsData)
    ? hostelsData
    : Array.isArray((hostelsData as any)?.hostels)
    ? (hostelsData as any).hostels
    : [];

  const firstHostelId = hostels[0]?.id;
  if (!firstHostelId) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to={`/hostels/${firstHostelId}/activity`} replace />;
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
        <Route path="/alerts" element={<GlobalActivityRedirect />} />
        <Route path="/billing" element={<BillingView />} />
        <Route path="/admissions" element={<AdmissionsView />} />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="/activity" element={<GlobalActivityRedirect />} />
      </Route>
    </Route>
  );
}
