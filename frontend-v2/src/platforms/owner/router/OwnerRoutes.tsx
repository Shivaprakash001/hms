import { lazy, Suspense } from 'react';
import { Navigate, Route } from 'react-router-dom';

const App = lazy(() => import('@/app/App'));
const PortfolioView = lazy(() => import('@/app/components/views/PortfolioView').then((m) => ({ default: m.PortfolioView })));
const HostelDetailView = lazy(() => import('@/app/components/HostelDetailView').then((m) => ({ default: m.HostelDetailView })));
const TenantsPortfolioView = lazy(() => import('@/app/components/views/TenantsPortfolioView').then((m) => ({ default: m.TenantsPortfolioView })));
const TenantsHostelView = lazy(() => import('@/app/components/views/TenantsHostelView').then((m) => ({ default: m.TenantsHostelView })));
const TenantProfileRoute = lazy(() => import('@/app/components/views/TenantProfileRoute').then((m) => ({ default: m.TenantProfileRoute })));
const MoveOutsView = lazy(() => import('@/app/components/views/MoveOutsView').then((m) => ({ default: m.MoveOutsView })));
const AlertsView = lazy(() => import('@/app/components/views/AlertsView').then((m) => ({ default: m.AlertsView })));
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
    <Suspense fallback={<OwnerRouteFallback />}>
      <OwnerProviderShell />
    </Suspense>
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
        <Route path="/hostels/:hostelId/tenants" element={<TenantsHostelView />} />
        <Route path="/hostels/:hostelId/tenants/:tenantId" element={<TenantProfileRoute />} />
        <Route path="/hostels/:hostelId/move-outs" element={<MoveOutsView />} />
        <Route path="/alerts" element={<AlertsView />} />
        <Route path="/billing" element={<BillingView />} />
        <Route path="/admissions" element={<AdmissionsView />} />
        <Route path="/settings" element={<SettingsView />} />
      </Route>
    </Route>
  );
}
