import { Navigate, Route } from 'react-router-dom';
import App from '@/app/App';
import { ProtectedRoute } from '@/app/components/ProtectedRoute';
import { HostelDetailView } from '@/app/components/HostelDetailView';
import { AlertsView } from '@/app/components/views/AlertsView';
import { BillingView } from '@/app/components/views/BillingView';
import { MoveOutsView } from '@/app/components/views/MoveOutsView';
import { PortfolioView } from '@/app/components/views/PortfolioView';
import { SettingsView } from '@/app/components/views/SettingsView';
import { TenantProfileRoute } from '@/app/components/views/TenantProfileRoute';
import { TenantsHostelView } from '@/app/components/views/TenantsHostelView';
import { TenantsPortfolioView } from '@/app/components/views/TenantsPortfolioView';

export function OwnerRoutes() {
  return (
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
  );
}
