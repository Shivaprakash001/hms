import { Route } from 'react-router-dom';
import { ProtectedTenantRoute } from '@/app/components/ProtectedTenantRoute';
import { TenantPortalLayout } from '@/portal/TenantPortalLayout';
import { TenantDashboardPage } from '@/portal/pages/TenantDashboardPage';
import { TenantFinancialsPage } from '@/portal/pages/TenantFinancialsPage';
import { TenantMoveOutPage } from '@/portal/pages/TenantMoveOutPage';
import { TenantPaymentReturnPage } from '@/portal/pages/TenantPaymentReturnPage';
import { TenantPaymentsPage } from '@/portal/pages/TenantPaymentsPage';
import { TenantProfilePortalPage } from '@/portal/pages/TenantProfilePortalPage';
import { TenantRoomPage } from '@/portal/pages/TenantRoomPage';

export function TenantRoutes() {
  return (
    <Route element={<ProtectedTenantRoute />}>
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
