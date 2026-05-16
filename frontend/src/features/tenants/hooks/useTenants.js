import { useMemo, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTenants as useTenantsQuery } from '../../../hooks/useTenants';
import { normalizeTenants, calculateTenantStats, calculateYearDistribution } from '../utils/tenantHelpers';

export const useTenants = ({ hostelId }) => {
    const location = useLocation();
    const navigate = useNavigate();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [showLeftTenants, setShowLeftTenants] = useState(false);
    const [extendedProfileTenant, setExtendedProfileTenant] = useState(null);

    // 1. Fetching Orchestration
    const { 
        data: tenantsResponse, 
        isLoading: loading, 
        error, 
        refetch: fetchTenants 
    } = useTenantsQuery(hostelId);

    // 2. Base Derived State
    const tenants = useMemo(() => normalizeTenants(tenantsResponse), [tenantsResponse]);

    // 3. Stats & Charts
    const stats = useMemo(() => calculateTenantStats(tenants), [tenants]);
    const yearDistribution = useMemo(() => calculateYearDistribution(tenants), [tenants]);

    // 4. Filtering Logic
    const filteredTenants = useMemo(() => {
        const INACTIVE_STATUSES = ['LEFT', 'CANCELLED', 'EXPIRED'];
        return tenants.filter(tenant => {
            const matchesSearch = tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                tenant.room.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (tenant.phone && tenant.phone.includes(searchTerm)) ||
                (tenant.rollNumber && tenant.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()));

            if (showLeftTenants) return matchesSearch;
            return matchesSearch && !INACTIVE_STATUSES.includes(tenant.status);
        });
    }, [tenants, searchTerm, showLeftTenants]);

    // 5. Selection Synchronization from Router State
    useEffect(() => {
        const selectedTenantId = location.state?.selectedTenantId;
        if (!selectedTenantId || tenants.length === 0) return;

        const matchedTenant = tenants.find(tenant => tenant.id === selectedTenantId);
        if (matchedTenant) {
            setExtendedProfileTenant(matchedTenant);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.pathname, location.state, navigate, tenants]);

    return {
        tenants,
        filteredTenants,
        stats,
        yearDistribution,
        searchTerm,
        setSearchTerm,
        showLeftTenants,
        setShowLeftTenants,
        extendedProfileTenant,
        setExtendedProfileTenant,
        loading,
        error,
        fetchTenants
    };
};
