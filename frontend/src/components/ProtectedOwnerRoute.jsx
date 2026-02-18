import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedOwnerRoute = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <div>Loading...</div>; // Or a proper loading spinner
    }

    if (!user || user.role !== 'owner') {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

export default ProtectedOwnerRoute;
