import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';

export function ProtectedTenantRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role?.toLowerCase() !== 'tenant') {
    return <Navigate to="/login" replace />;
  }

  if (!user.is_profile_completed) {
    return <Navigate to="/complete-profile" replace />;
  }

  return <Outlet />;
}
