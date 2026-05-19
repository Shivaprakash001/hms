import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminRoutes } from '@/platforms/admin/router/AdminRoutes';
import { OwnerRoutes } from '@/platforms/owner/router/OwnerRoutes';
import { TenantRoutes } from '@/platforms/tenant/router/TenantRoutes';
import { PublicRoutes } from './PublicRoutes';

export function AppRouter() {
  return (
    <Routes>
      {PublicRoutes()}
      {OwnerRoutes()}
      {TenantRoutes()}
      {AdminRoutes()}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
