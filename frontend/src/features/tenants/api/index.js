import api from '@lib/api-client';

export const tenantService = {
    getAll: async (hostelId, params = {}) => {
        const response = await api.get('/tenants', { params: { ...params, hostelId } });
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    getById: async (id) => {
        const response = await api.get(`/tenants/${id}`);
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    getOwnerTenantOverview: async (id) => {
        const response = await api.get(`/tenants/owner/tenants/${id}/overview`);
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    getByProfileId: async (profileId) => {
        const response = await api.get(`/tenants/by-profile/${profileId}`);
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    getMyProfile: async () => {
        const response = await api.get('/tenants/me/profile');
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    updateMyProfile: async (data) => {
        const response = await api.patch('/tenants/me/profile', data);
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    completeMyProfile: async (data, profilePhotoFile = null) => {
        const formData = new FormData();
        formData.append('profile_data', JSON.stringify(data));
        if (profilePhotoFile) formData.append('profile_photo', profilePhotoFile);
        try {
            const response = await api.post('/tenants/me/complete-profile', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
        } catch (error) {
            if (error?.response?.status === 404) {
                const fallback = await api.post('/profiles/complete', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                return fallback.data;
            }
            throw error;
        }
    },
    getMyDocuments: async () => {
        const response = await api.get('/tenants/me/documents');
        return response.data?.documents || response.data || [];
    },
    getMyPaymentHistory: async () => {
        const response = await api.get('/tenants/me/payments/history');
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    getMyRoom: async () => {
        const response = await api.get('/tenants/me/room');
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    getMyOnboardingSettings: async () => {
        const response = await api.get('/tenants/me/onboarding-settings');
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    getMyScore: async () => {
        const response = await api.get('/tenants/me/score');
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    create: async (data) => {
        const response = await api.post('/tenants', data);
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    update: async (id, data) => {
        const response = await api.put(`/tenants/${id}`, data);
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    delete: async (id) => {
        const response = await api.delete(`/tenants/${id}`);
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    reactivate: async (id, data) => {
        const response = await api.post(`/tenants/${id}/reactivate`, data);
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    requestReactivation: async () => {
        const response = await api.post('/tenants/me/reactivation-request');
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    getReactivationRequests: async () => {
        const response = await api.get('/tenants/owner/reactivation-requests');
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    decideReactivationRequest: async (requestId, action, notes = '') => {
        const response = await api.post(`/tenants/owner/reactivation-requests/${requestId}/decision`, { action, notes });
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    invite: async (data) => {
        const response = await api.post('/tenants/invite', data);
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    resendInvitation: async (email) => {
        const response = await api.post('/tenants/resend-invitation', { email });
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    cancelInvitation: async (id) => {
        const response = await api.post(`/tenants/${id}/cancel-invitation`);
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    }
};
