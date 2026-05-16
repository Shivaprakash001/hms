import api from './axios';
import axios from 'axios';

export { authService } from '@features/auth/api';

// --- Profile Service ---
export const profileService = {
    get: async (profileId) => {
        const response = await api.get(`/profiles/${profileId}`);
        return response.data;
    },
    update: async (profileId, data) => {
        const response = await api.put(`/profiles/${profileId}`, data);
        return response.data;
    },
    getUnassignedTenants: async () => {
        const response = await api.get('/profiles/unassigned/tenants');
        return response.data;
    }
};

// --- Owner Service ---
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

// --- Bulk Import / Onboarding Campaign Services ---
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

// --- Billing & Plans Service ---
export const billingService = {

    getSubscription: async () => {
        const response = await api.get('/owner/me/subscription');
        return response.data;
    },
    getPlans: async () => {
        const response = await api.get('/plans');
        return response.data;
    },
    getUsage: async () => {
        const response = await api.get('/owner/me/usage');
        return response.data;
    },
    getOverflowStatus: async () => {
        const response = await api.get('/billing/overflow');
        return response.data;
    },
};

// --- Addon Service ---
export const addonService = {
    getUsage: async () => {
        const response = await api.get('/addons/usage');
        return response.data;
    },
    purchasePack: async (pack, trigger = 'manual') => {
        const response = await api.post('/addons/purchase', { pack, trigger });
        return response.data; // { checkout_url, attempt_id, amount, credits, pack }
    },
    getAutoTopup: async () => {
        const response = await api.get('/addons/usage');
        return response.data?.auto_topup ?? false;
    },
    setAutoTopup: async (enabled, trigger = 'settings') => {
        const response = await api.patch('/addons/usage', { auto_topup: enabled, trigger });
        return response.data;
    },
    verifyPayment: async (attemptId) => {
        const response = await api.post('/addons/verify', { attempt_id: attemptId });
        return response.data; // { verified, already_credited, credits_remaining }
    },
};

// --- Tenant Services ---
export { tenantService } from '@features/tenants/api';

// --- Room Services ---
export { roomService, allocationService } from '@features/rooms/api';


// --- Secure Identity Confirmation ---
export const identityService = {
    confirmIdentity: async (password) => {
        const response = await api.post('/auth/confirm-identity', { password });
        return response.data; // { identity_token, expires_in, purpose }
    },
};

// --- Payment Services ---
export { paymentService } from '@features/payments/api';

// --- Expense Service ---
export { expenseService } from '@features/expenses/api';

// requestWithRetry moved to api-client.js

// --- Dashboard Service ---
export { dashboardService } from '@features/dashboard/api';

// --- Rent Generation Service ---
export { rentService } from '@features/payments/api';

export { portfolioService } from '@features/dashboard/api';

// --- Activity Service ---
export const activityService = {
    getAll: async (hostelId, params = {}) => {
        const response = await requestWithRetry(() => api.get('/activity', { params: { ...params, hostelId } }));
        return response.data;
    }
};

// --- Notification Service ---
export { notificationService } from '@features/notifications/api';

// --- Tenant Document Service ---
export { tenantDocumentService } from '@features/uploads/api';

// --- SSE Token Service ---
export const sseService = {
    getToken: async () => {
        const response = await api.get('/events-token');
        return response.data.token;
    }
};

// --- Analytics Dashboard Service (dedicated endpoints, backend-next) ---
export { analyticsService } from '@features/reports/api';

// --- Reminder Service ---
export { reminderService } from '@features/notifications/api';

// --- Activation / Onboarding Intelligence Service ---
export const activationService = {
    /**
     * Derive operational activation state from real server DB data.
     * Returns: { operational_state, activation_score, completed_steps,
     *            missing_steps, blockers, recommendations, next_action,
     *            readiness, raw }
     */
    get: async () => {
        const response = await api.get('/owner/me/activation');
        return response.data;
    },
    /**
     * Persist an onboarding step server-side for cross-device sync.
     * @param {string} step
     * @param {{ skipped?: boolean, source?: string }} [options]
     */
    persistStep: async (step, options = {}) => {
        const response = await api.patch('/owner/me/activation', { step, ...options });
        return response.data;
    },
};

// --- Owner Finance Service (Phase 6) ---
//
// Read-only owner-facing settlement visibility. Maps directly to the
// /api/owner/finance/* endpoints exposed by owner-financial-view-service.
// All amounts are decimal strings on the wire to preserve precision; the
// UI parses with Number() at render time.
export const ownerFinanceService = {
    getSummary: async () => {
        const response = await api.get('/owner/finance/summary');
        return response.data;
    },
    getCollections: async (params = {}) => {
        const response = await api.get('/owner/finance/collections', { params });
        return response.data;
    },
    getTransfers: async (params = {}) => {
        const response = await api.get('/owner/finance/transfers', { params });
        return response.data;
    },
    getByHostel: async () => {
        const response = await api.get('/owner/finance/by-hostel');
        return response.data;
    },
};

// --- Admin Reconciliation Service (Phase 7) ---
//
// Admin-only. Drives /api/admin/finance/reconciliation/*. The scan is
// read-only by default; pass { persist: true } to write deduped issues.
// Issue transitions are append-only at the audit-row level: status moves
// (OPEN → INVESTIGATING/RESOLVED/IGNORED), but the diagnostic payload
// (description, fingerprint, scope, metadata) is immutable.
export const adminReconciliationService = {
    scan: async ({ limit = 500, persist = false } = {}) => {
        const response = await api.post('/admin/finance/reconciliation/scan', { limit, persist });
        return response.data;
    },
    listIssues: async (params = {}) => {
        const response = await api.get('/admin/finance/reconciliation/issues', { params });
        return response.data;
    },
    transitionIssue: async (issueId, { status, notes }) => {
        const response = await api.patch(`/admin/finance/reconciliation/issues/${issueId}`, { status, notes });
        return response.data;
    },
};
