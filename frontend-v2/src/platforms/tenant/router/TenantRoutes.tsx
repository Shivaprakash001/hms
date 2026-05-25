import { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';

const TenantPortalLayout = lazy(() => import('@/portal/TenantPortalLayout').then((m) => ({ default: m.TenantPortalLayout })));
const TenantDashboardPage = lazy(() => import('@/portal/pages/TenantDashboardPage').then((m) => ({ default: m.TenantDashboardPage })));
const TenantFinancialsPage = lazy(() => import('@/portal/pages/TenantFinancialsPage').then((m) => ({ default: m.TenantFinancialsPage })));
const TenantMoveOutPage = lazy(() => import('@/portal/pages/TenantMoveOutPage').then((m) => ({ default: m.TenantMoveOutPage })));
const TenantPaymentReturnPage = lazy(() => import('@/portal/pages/TenantPaymentReturnPage').then((m) => ({ default: m.TenantPaymentReturnPage })));
const TenantPaymentsPage = lazy(() => import('@/portal/pages/TenantPaymentsPage').then((m) => ({ default: m.TenantPaymentsPage })));
const TenantProfilePortalPage = lazy(() => import('@/portal/pages/TenantProfilePortalPage').then((m) => ({ default: m.TenantProfilePortalPage })));
const TenantRoomPage = lazy(() => import('@/portal/pages/TenantRoomPage').then((m) => ({ default: m.TenantRoomPage })));
const TenantProviderShell = lazy(() => import('./TenantProviderShell').then((m) => ({ default: m.TenantProviderShell })));

function TenantRouteFallback() {
  return (
    <div className="min-h-screen bg-background px-4 py-5">
      <div className="space-y-4">
        <div className="h-28 rounded-2xl bg-muted animate-pulse" />
        <div className="h-16 rounded-xl bg-muted animate-pulse" />
        <div className="h-36 rounded-xl bg-muted animate-pulse" />
      </div>
    </div>
  );
}

function TenantBoundary() {
  return (
    <Suspense fallback={<TenantRouteFallback />}>
      <TenantProviderShell />
    </Suspense>
  );
}

export function TenantRoutes() {
  return (
    <Route element={<TenantBoundary />}>
      <Route path="/payment-return" element={<TenantPaymentReturnPage />} />
      <Route element={<TenantPortalLayout />}>
        <Route path="/tenant/dashboard" element={<TenantDashboardPage />} />
        <Route path="/tenant/financials" element={<TenantFinancialsPage />} />
        <Route path="/tenant/payments" element={<TenantPaymentsPage />} />
        <Route path="/tenant/room" element={<TenantRoomPage />} />
        <Route path="/tenant/profile" element={<TenantProfilePortalPage />} />
        <Route path="/tenant/move-out" element={<TenantMoveOutPage />} />
      </Route>
    </Route>
  );
}
