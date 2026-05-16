import api from '@lib/api-client';
import { profileService } from '@features/profile/api';

export const ownerService = {
    getProfile: async () => {
        try {
            const response = await api.get('/owner/me/profile');
            return response.data;
        } catch (error) {
            if (error?.response?.status === 404) {
                const stored = localStorage.getItem('ownerUser');
                const parsed = stored ? JSON.parse(stored) : null;
                const profileId = parsed?.id;

                if (profileId) {
                    const owner = await profileService.get(profileId);
                    return {
                        owner,
                        hostel: {
                            name: '', phone: '', address: '', city: '', state: '', pincode: '', upi_id: '', gst_number: '', logo_url: ''
                        },
                        preferences: {
                            currency: 'INR',
                            rent_cycle: 'MONTHLY',
                            receipt_prefix: 'HMS',
                            timezone: 'Asia/Kolkata',
                            time_format: '12h',
                            auto_rent_day: 1,
                            phonepe_merchant_id: ''
                        }
                    };
                }
            }
            throw error;
        }
    },
    updateOwner: async (data) => {
        try {
            const response = await api.patch('/owner/me/profile', data);
            return response.data;
        } catch (error) {
            if (error?.response?.status === 404) {
                const stored = localStorage.getItem('ownerUser');
                const parsed = stored ? JSON.parse(stored) : null;
                const profileId = parsed?.id;
                if (profileId) {
                    const owner = await profileService.update(profileId, data);
                    return {
                        owner,
                        hostel: {
                            name: '', phone: '', address: '', city: '', state: '', pincode: '', upi_id: '', gst_number: '', logo_url: ''
                        },
                        preferences: {
                            currency: 'INR',
                            rent_cycle: 'MONTHLY',
                            receipt_prefix: 'HMS',
                            timezone: 'Asia/Kolkata',
                            time_format: '12h',
                            auto_rent_day: 1,
                            phonepe_merchant_id: ''
                        }
                    };
                }
            }
            throw error;
        }
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
