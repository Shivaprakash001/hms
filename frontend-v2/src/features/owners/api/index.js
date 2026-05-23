import api from '@lib/api-client';

export const ownerService = {
    getProfile: async () => {
        const response = await api.get('/owner/me/profile');
        return response.data;
    },
    updateOwner: async (data) => {
        const response = await api.patch('/owner/me/profile', data);
        return response.data;
    },
    updateProfileSection: async (data) => {
        const response = await api.patch('/profile', data);
        return response.data;
    },
    updateHostel: async (data, hostelId) => {
        if (hostelId) {
            const response = await api.patch(`/hostels/${hostelId}`, data);
            return response.data;
        }
        const response = await api.patch('/owner/me/hostel', data);
        return response.data;
    },
    updatePreferences: async (data, hostelId) => {
        if (hostelId) {
            const response = await api.patch(`/hostels/${hostelId}/preferences`, data);
            return response.data;
        }
        const response = await api.patch('/owner/me/preferences', data);
        return response.data;
    },
    getHostelPreferences: async (hostelId) => {
        const response = await api.get(`/hostels/${hostelId}/preferences`);
        return response.data;
    },
    getHostels: async () => {
        const response = await api.get('/owner/hostels');
        return response.data;
    },
    createHostel: async (data) => {
        const response = await api.post('/owner/hostels', data);
        return response.data;
    },
    getHostelBillingDefaults: async (hostelId) => {
        const response = await api.get(`/hostels/${hostelId}/billing-defaults`);
        return response.data;
    },
    updateHostelBillingDefaults: async (hostelId, billingDefaults) => {
        const response = await api.patch(`/hostels/${hostelId}/billing-defaults`, { billing_defaults: billingDefaults });
        return response.data;
    },
    uploadLogo: async (file, hostelId) => {
        const formData = new FormData();
        formData.append('file', file);
        const endpoint = hostelId ? `/hostels/${hostelId}/logo` : '/owner/logo';
        const response = await api.post(endpoint, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },
    removeLogo: async (hostelId) => {
        const endpoint = hostelId ? `/hostels/${hostelId}/logo` : '/owner/logo';
        const response = await api.delete(endpoint);
        return response.data;
    },
    searchTenants: async (query, limit = 10, signal) => {
        const response = await api.get('/owner/search', {
            params: { q: query, limit },
            signal
        });
        return response.data;
    },
    sendTestReminder: async (type = 'DUE_SOON', hostelId) => {
        const response = await api.post('/notifications/test-reminder', { type, hostel_id: hostelId });
        return response.data;
    },
    updateSectionConfig: async (hostelId, section, data) => {
        const response = await api.patch(`/hostels/${hostelId}/${section}`, data);
        return response.data;
    },
    updateHostelPolicy: async (hostelId, policyPatch) => {
        const response = await api.patch(`/hostels/${hostelId}/preferences`, { policy: policyPatch });
        return response.data;
    },
    getFrequencyChangeRequests: async (params = {}) => {
        const response = await api.get('/owner/billing/frequency-requests', { params });
        return response.data?.data ?? response.data;
    },
    decideFrequencyChangeRequest: async (requestId, action, rejection_reason = '') => {
        const response = await api.post(`/owner/billing/frequency-requests/${requestId}/decision`, { action, rejection_reason });
        return response.data?.data ?? response.data;
    }
};

export const bulkImportService = {
    generateGoogleFormPrompt: async ({ hostelId, notes }) => {
        const response = await api.post('/bulk-import/google-form-prompt', {
            hostel_id: hostelId,
            notes,
        });
        return response.data;
    },
    uploadTenantIdentityFile: async (formData) => {
        const response = await api.post('/bulk-import/upload', formData);
        return response.data;
    },
    getBatchPreview: async (batchId) => {
        const response = await api.get(`/bulk-import/${batchId}/confirm`);
        return response.data;
    },
    confirmBatchImport: async (batchId) => {
        const response = await api.post(`/bulk-import/${batchId}/confirm`);
        return response.data;
    },
};

export const activationService = {
    get: async () => {
        const response = await api.get('/owner/me/activation');
        return response.data;
    },
    persistStep: async (step, options = {}) => {
        const response = await api.patch('/owner/me/activation', { step, ...options });
        return response.data;
    },
};
