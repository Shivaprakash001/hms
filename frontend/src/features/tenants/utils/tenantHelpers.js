export const getInitials = (name) => {
    return name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
};

export const normalizeTenants = (tenantsResponse) => {
    if (!tenantsResponse) return [];
    const tenantsList = Array.isArray(tenantsResponse) ? tenantsResponse : (tenantsResponse.tenants || []);
    
    return tenantsList.map(s => ({
        id: s.id,
        profileId: s.profile_id,
        name: s.profile?.name || 'Unknown',
        email: s.profile?.email,
        phone: s.profile?.phone || 'N/A',
        rollNumber: s.roll_number || 'N/A',
        yearOfStudy: s.year_of_study || null,
        room: (s.allocations && s.allocations.length > 0 && s.allocations[0].room) ? s.allocations[0].room.room_no : 'N/A',
        roomId: (s.allocations && s.allocations.length > 0) ? s.allocations[0].room_id : null,
        floor: (s.allocations && s.allocations.length > 0 && s.allocations[0].room) ? (s.allocations[0].room.floor ?? 'N/A') : 'N/A',
        status: s.status,
        rent: s.monthly_rent,
        joinDate: s.joined_on,
        paymentSummary: s.payment_summary || {}
    }));
};

export const calculateTenantStats = (tenants) => {
    return {
        total: tenants.length,
        occupiedRooms: new Set(tenants.filter(s => s.room !== 'N/A').map(s => s.room)).size,
        paid: tenants.filter(s => s.paymentSummary?.payment_status === 'PAID').length,
        active: tenants.filter(s => s.status === 'ACTIVE').length,
        left: tenants.filter(s => ['LEFT', 'CANCELLED', 'EXPIRED'].includes(s.status)).length
    };
};

export const calculateYearDistribution = (tenants) => {
    const counts = {
        '1st Year': 0,
        '2nd Year': 0,
        '3rd Year': 0,
        '4th Year': 0,
        'Other': 0
    };
    tenants.forEach(s => {
        const year = Number(s.yearOfStudy);
        if (year === 1) counts['1st Year']++;
        else if (year === 2) counts['2nd Year']++;
        else if (year === 3) counts['3rd Year']++;
        else if (year === 4) counts['4th Year']++;
        else counts['Other']++;
    });
    return Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .filter(item => item.value > 0);
};
