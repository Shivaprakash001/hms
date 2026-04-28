import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedTenantRoute = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div>Loading...</div>; // Or a proper loading spinner
    }

    if (!user || user.role?.toLowerCase() !== 'tenant') {
        return <Navigate to="/" replace />;
    }

    if (!user.is_profile_completed) {
        return <Navigate to="/complete-profile" replace />;
    }

    return <Outlet />;
};

export default ProtectedTenantRoute;
