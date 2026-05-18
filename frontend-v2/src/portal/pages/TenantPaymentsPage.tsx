import { Navigate } from 'react-router-dom';

/** @deprecated Use /tenant/financials */
export function TenantPaymentsPage() {
  return <Navigate to="/tenant/financials" replace />;
}
