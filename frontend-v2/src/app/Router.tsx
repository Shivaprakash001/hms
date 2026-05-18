import { Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ProtectedTenantRoute } from './components/ProtectedTenantRoute';
import { LoginPage } from './pages/LoginPage';
import { PortfolioView } from './components/views/PortfolioView';
import { AlertsView } from './components/views/AlertsView';
import { BillingView } from './components/views/BillingView';
import { SettingsView } from './components/views/SettingsView';
import { HostelDetailView } from './components/HostelDetailView';
import { TenantsPortfolioView } from './components/views/TenantsPortfolioView';
import { TenantsHostelView } from './components/views/TenantsHostelView';
import { TenantProfileRoute } from './components/views/TenantProfileRoute';
import { MoveOutsView } from './components/views/MoveOutsView';
import { TenantPortalLayout } from '@/portal/TenantPortalLayout';
import { ActivateAccountPage } from '@/portal/pages/ActivateAccountPage';
import { CompleteProfilePage } from '@/portal/pages/CompleteProfilePage';
import { TenantDashboardPage } from '@/portal/pages/TenantDashboardPage';
import { TenantFinancialsPage } from '@/portal/pages/TenantFinancialsPage';
import { TenantPaymentsPage } from '@/portal/pages/TenantPaymentsPage';
import { TenantRoomPage } from '@/portal/pages/TenantRoomPage';
import { TenantDocumentsPage } from '@/portal/pages/TenantDocumentsPage';
import { TenantComplaintsPage } from '@/portal/pages/TenantComplaintsPage';
import { TenantSettingsPage } from '@/portal/pages/TenantSettingsPage';
import { TenantProfilePortalPage } from '@/portal/pages/TenantProfilePortalPage';
import { TenantMoveOutPage } from '@/portal/pages/TenantMoveOutPage';
import { TenantPaymentReturnPage } from '@/portal/pages/TenantPaymentReturnPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/activate" element={<ActivateAccountPage />} />

      <Route
        element={
          <ProtectedRoute allowedRoles={['owner', 'admin']}>
            <App />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
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
        <Route path="/settings" element={<SettingsView />} />
      </Route>

      <Route path="/complete-profile" element={<CompleteProfilePage />} />

      <Route element={<ProtectedTenantRoute />}>
        <Route path="/payment-return" element={<TenantPaymentReturnPage />} />
        <Route element={<TenantPortalLayout />}>
          <Route path="/tenant/dashboard" element={<TenantDashboardPage />} />
          <Route path="/tenant/financials" element={<TenantFinancialsPage />} />
          <Route path="/tenant/payments" element={<TenantPaymentsPage />} />
          <Route path="/tenant/room" element={<TenantRoomPage />} />
          <Route path="/tenant/documents" element={<TenantDocumentsPage />} />
          <Route path="/tenant/complaints" element={<TenantComplaintsPage />} />
          <Route path="/tenant/settings" element={<TenantSettingsPage />} />
          <Route path="/tenant/profile" element={<TenantProfilePortalPage />} />
          <Route path="/tenant/move-out" element={<TenantMoveOutPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
