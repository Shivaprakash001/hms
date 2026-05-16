import api from './axios';
import axios from 'axios';

// --- Auth Services ---
export const authService = {
    login: async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        return response.data;
    },
    getCurrentUser: async () => {
        const response = await api.get('/auth/me');
        return response.data;
    },
    register: async (data) => {
        const response = await api.post('/auth/register', data);
        return response.data;
    },
    changePassword: async (oldPassword, newPassword) => {
        const response = await api.post('/auth/change-password', {
            old_password: oldPassword,
            new_password: newPassword
        });
        return response.data;
    }
};

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
export const tenantService = {
    getAll: async (hostelId, params = {}) => {
        const response = await api.get('/tenants', { params: { ...params, hostelId } });
        return response.data;
    },
    getById: async (id) => {
        const response = await api.get(`/tenants/${id}`);
        return response.data;
    },
    getOwnerTenantOverview: async (id) => {
        const response = await api.get(`/tenants/owner/tenants/${id}/overview`);
        return response.data;
    },
    getByProfileId: async (profileId) => {
        const response = await api.get(`/tenants/by-profile/${profileId}`);
        return response.data;
    },
    getMyProfile: async () => {
        const response = await api.get('/tenants/me/profile');
        return response.data;
    },
    updateMyProfile: async (data) => {
        const response = await api.patch('/tenants/me/profile', data);
        return response.data;
    },
    completeMyProfile: async (data, profilePhotoFile = null) => {
        const formData = new FormData();
        formData.append('profile_data', JSON.stringify(data));
        if (profilePhotoFile) formData.append('profile_photo', profilePhotoFile);
        try {
            const response = await api.post('/tenants/me/complete-profile', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data;
        } catch (error) {
            // Backward compatibility for deployments still using old route.
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
        return response.data;
    },
    getMyRoom: async () => {
        const response = await api.get('/tenants/me/room');
        return response.data;
    },
    getMyOnboardingSettings: async () => {
        const response = await api.get('/tenants/me/onboarding-settings');
        return response.data;
    },
    getMyScore: async () => {
        const response = await api.get('/tenants/me/score');
        return response.data;
    },
    create: async (data) => {
        const response = await api.post('/tenants', data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await api.put(`/tenants/${id}`, data);
        return response.data;
    },
    delete: async (id) => {
        const response = await api.delete(`/tenants/${id}`);
        return response.data;
    },
    reactivate: async (id, data) => {
        const response = await api.post(`/tenants/${id}/reactivate`, data);
        return response.data;
    },
    requestReactivation: async () => {
        const response = await api.post('/tenants/me/reactivation-request');
        return response.data;
    },
    getReactivationRequests: async () => {
        const response = await api.get('/tenants/owner/reactivation-requests');
        return response.data;
    },
    decideReactivationRequest: async (requestId, action, notes = '') => {
        const response = await api.post(`/tenants/owner/reactivation-requests/${requestId}/decision`, { action, notes });
        return response.data;
    },
    invite: async (data) => {
        const response = await api.post('/tenants/invite', data);
        return response.data;
    },
    resendInvitation: async (email) => {
        const response = await api.post('/tenants/resend-invitation', { email });
        return response.data;
    },
    cancelInvitation: async (id) => {
        const response = await api.post(`/tenants/${id}/cancel-invitation`);
        return response.data;
    }
};

// --- Room Services ---
export const roomService = {
    getAll: async (hostelId, params = {}) => {
        const response = await api.get('/rooms', { params: { ...params, hostelId } });
        return response.data;
    },
    getById: async (id) => {
        const response = await api.get(`/rooms/${id}`);
        return response.data;
    },
    getOverview: async (id) => {
        const response = await api.get(`/rooms/${id}/overview`);
        return response.data;
    },
    getInviteDefaults: async (id) => {
        const response = await api.get(`/rooms/${id}/invite-defaults`);
        return response.data;
    },
    create: async (hostelId, data) => {
        const response = await api.post('/rooms', { ...data, hostelId });
        return response.data;
    },
    update: async (id, data) => {
        const response = await api.patch(`/rooms/${id}`, data);
        return response.data;
    },
    delete: async (id) => {
        const response = await api.delete(`/rooms/${id}`);
        return response.data;
    }
};

// --- Allocation Services ---
export const allocationService = {
    allocate: async (hostelId, data) => {
        const response = await api.post('/allocations', { ...data, hostelId });
        return response.data;
    },
    end: async (allocationId, data) => {
        const response = await api.patch(`/allocations/${allocationId}/end`, data);
        return response.data;
    },
    shift: async (hostelId, data) => {
        const response = await api.post('/allocations/shift', { ...data, hostelId });
        return response.data;
    },
    getTenantHistory: async (tenantId, hostelId) => {
        const response = await api.get(`/allocations/tenant/${tenantId}`);
        return response.data;
    },
    getAllActive: async (hostelId) => {
        const response = await api.get('/allocations', { params: { hostelId } });
        return response.data;
    },
    getHistory: async () => {
        const response = await api.get('/allocations/owner-history');
        return response.data;
    }
};


// --- Secure Identity Confirmation ---
export const identityService = {
    confirmIdentity: async (password) => {
        const response = await api.post('/auth/confirm-identity', { password });
        return response.data; // { identity_token, expires_in, purpose }
    },
};

// --- Payment Services ---
export const paymentService = {
    getAll: async (hostelId, params = {}) => {
        const response = await api.get('/payments', { params: { ...params, hostelId } });
        return response.data;
    },
    getAllDues: async (hostelId, params = {}) => {
        const response = await api.get('/payments/dues', { params: { ...params, hostelId } });
        return response.data;
    },
    getTenantHistory: async (tenantId, hostelId) => {
        try {
            const storedTenant = localStorage.getItem('tenantUser');
            const storedOwner = localStorage.getItem('ownerUser');
            const isTenantSession = Boolean(storedTenant && !storedOwner);

            if (isTenantSession) {
                const meResponse = await api.get('/tenants/me/payments/history');
                return meResponse.data;
            }

            if (tenantId) {
                // Owner fetches a tenant-scoped ledger from payments service
                const [dues, paymentsResult] = await Promise.all([
                    api.get('/payments/dues', { params: { tenant_id: tenantId, hostelId } }),
                    api.get('/payments', { params: { tenant_id: tenantId, limit: 500, hostelId } })
                ]);

                const obligations = (dues.data || []).filter((o) => o.tenant_id === tenantId);
                const payments = (paymentsResult.data?.payments || []).map((p) => ({
                    id: p.id,
                    obligation_id: p.obligation_id,
                    amount_paid: Number(p.amount_paid || 0),
                    payment_date: p.payment_date,
                    payment_method: p.payment_method,
                    reference_number: p.reference_number,
                    transaction_id: p.reference_number || p.id,
                    rent_month: p.rent_month
                }));

                const totalDue = obligations.reduce((sum, o) => sum + Number(o.amount || 0), 0);
                const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);

                return {
                    tenant_id: tenantId,
                    obligations: obligations.map((o) => ({
                        id: o.obligation_id || o.id,
                        rent_month: o.rent_month,
                        due_date: o.due_date,
                        amount: Number(o.amount || 0),
                        status: o.status,
                        remaining_due: Number(o.outstanding || 0),
                        payments: payments
                            .filter((p) => p.obligation_id === (o.obligation_id || o.id))
                            .map((p) => ({
                                id: p.id,
                                amount_paid: Number(p.amount_paid || 0),
                                payment_date: p.payment_date,
                                method: p.payment_method,
                                transaction_id: p.transaction_id
                            }))
                    })),
                    payments: payments.sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()),
                    total_due: totalDue,
                    total_paid: totalPaid,
                    outstanding_balance: Math.max(totalDue - totalPaid, 0)
                };
            }

            const fallbackMe = await api.get('/tenants/me/payments/history');
            return fallbackMe.data;
        } catch (error) {
            if (error?.response?.status === 404) {
                const fallback = await api.get('/tenants/me/payments/history');
                return fallback.data;
            }
            throw error;
        }
    },
    recordPayment: async (data) => {
        try {
            const response = await axios.post('/api/payments/record-offline', data, { withCredentials: true });
            return response.data;
        } catch (error) {
            // Keep original fallback behavior just in case
            if (error?.response?.status === 404) {
                const fallback = await axios.post('/api/payments/record-offline', data, { withCredentials: true });
                return fallback.data;
            }
            throw error;
        }
    },
    recordOfflinePayment: async ({ identityToken, obligationId, amountPaid, paymentMethod, referenceNumber, paymentDate, note, hostelId }) => {
        const response = await axios.post('/api/payments/record-offline', {
            identity_token: identityToken,
            obligation_id: obligationId,
            amount_paid: amountPaid,
            payment_method: paymentMethod,
            reference_number: referenceNumber,
            payment_date: paymentDate,
            note,
            hostelId,
        }, { withCredentials: true });
        return response.data;
    },
    initiatePayment: async (data) => {
        const response = await api.post('/payments/initiate', data);
        return response.data;
    },
    /**
     * Verify a PhonePe payment server-side after the checkout callback fires.
     * @param {Object} data - Provider verification payload plus obligation context when present.
     */
    verifyPayment: async (data) => {
        const response = await api.post('/payments/verify', data);
        return response.data;
    },
    /**
     * Reconcile pending payments with the configured provider (admin/owner).
     * @param {string[]} [paymentIds] - Optional list of payment IDs; omit to reconcile all pending.
     */
    reconcilePayments: async (paymentIds, hostelId, paymentDomain) => {
        const body = paymentIds ? { payment_ids: paymentIds } : {};
        if (hostelId) body.hostelId = hostelId;
        if (paymentDomain) body.paymentDomain = paymentDomain;
        const response = await api.post('/payments/reconcile', body);
        return response.data;
    },
    createIntent: async (data) => {
        const response = await api.post('/payments/create-intent', data);
        return response.data;
    },
    createTestIntent: async (data) => {
        const response = await api.post('/payments/test-intent', data);
        return response.data;
    },
    getAttempt: async (attemptId) => {
        const response = await api.get(`/payments/attempts/${attemptId}`);
        return response.data;
    },
    submitUpiReference: async (data) => {
        const response = await api.post('/payments/submit-reference', data);
        return response.data;
    },
    confirmPayment: async (attemptId) => {
        const response = await api.post('/payments/confirm', { attempt_id: attemptId, action: 'confirm' });
        return response.data;
    },
    rejectPayment: async (attemptId) => {
        const response = await api.post('/payments/confirm', { attempt_id: attemptId, action: 'reject' });
        return response.data;
    },
    getPendingVerifications: async (hostelId) => {
        const response = await api.get('/payments/pending-verification', { params: { hostelId } });
        return response.data;
    },
    manualConfirmPayment: async (attemptId) => {
        const response = await api.post('/payments/manual-confirm', { attempt_id: attemptId });
        return response.data;
    },
    generateRent: async (hostelId, month) => {
        const response = await api.post('/rent/generate', { month, hostelId });
        return response.data;
    },
    previewGenerateRent: async (hostelId, month) => {
        const response = await api.get('/rent/generate', { params: { month, hostelId } });
        return response.data;
    },
    waive: async (obligationId, reason) => {
        const response = await api.post(`/payments/obligations/${obligationId}/waive`, { reason });
        return response.data;
    },
    downloadReceipt: async (paymentId) => {
        const response = await api.get(`/payments/${paymentId}/receipt`, {
            responseType: 'blob'
        });

        // Validate that we got a PDF, not a JSON error wrapped in a blob
        const blob = response.data;
        if (blob.type && blob.type.includes('application/json')) {
            const text = await blob.text();
            let detail = 'Unknown error';
            try {
                const parsed = JSON.parse(text);
                detail = parsed?.detail || parsed?.error || text;
            } catch {
                detail = text;
            }
            const err = new Error(detail);
            err.response = { status: response.status, data: { detail } };
            throw err;
        }

        return blob;
    },

    downloadInvoice: async (paymentId) => {
        const response = await api.get(`/invoices/${paymentId}`);
        if (response.data && response.data.url) {
            window.open(response.data.url, '_blank');
        }
        return true;
    },
    exportReport: async (params = {}) => {
        const response = await api.get('/payments/export', {
            params,
            responseType: 'blob'
        });
        return {
            blob: response.data,
            contentDisposition: response.headers?.['content-disposition'] || ''
        };
    },
    bulkGenerate: async (data) => {
        const response = await api.post('/payments/bulk-generate', data);
        return response.data;
    },
    previewPayment: async (obligationIds, hostelId) => {
        const response = await api.get('/payments/preview', { 
            params: { ids: obligationIds.join(','), ...(hostelId ? { hostelId } : {}) }
        });
        return response.data;
    }
};

// --- Expense Service ---
export const expenseService = {
    getAll: async (hostelId) => {
        const response = await api.get('/expenses', { params: { hostelId } });
        return response.data;
    },
    create: async (hostelId, data) => {
        const response = await api.post('/expenses', { ...data, hostelId });
        return response.data;
    },
    update: async (id, data) => {
        const response = await api.put(`/expenses/${id}`, data);
        return response.data;
    },
    delete: async (id) => {
        const response = await api.delete(`/expenses/${id}`);
        return response.data;
    }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const requestWithRetry = async (fn, { retries = 2, delayMs = 1500 } = {}) => {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const status = error?.response?.status;
            const shouldRetry = !status || [502, 503, 504].includes(status);
            if (!shouldRetry || attempt === retries) {
                throw error;
            }
            await sleep(delayMs * (attempt + 1));
        }
    }
    throw lastError;
};

// --- Dashboard Service ---
export const dashboardService = {
    getUnified: async (hostelId, months = 6) => {
        const response = await api.get('/dashboard', { params: { months, hostelId } });
        return response.data;
    },
    getSummary: async (hostelId) => {
        const response = await requestWithRetry(() => api.get('/dashboard/summary', { params: { hostelId } }));
        return response.data;
    },
    getStats: async (hostelId) => {
        const response = await requestWithRetry(() => api.get('/dashboard/stats', { params: { hostelId } }));
        return response.data;
    },
    getMonthlyStats: async (hostelId, months = 6) => {
        const response = await requestWithRetry(() => api.get('/dashboard/monthly-stats', { params: { months, hostelId } }));
        return response.data;
    }
};

// --- Rent Generation Service ---
export const rentService = {
    preview: async (hostelId, month) => {
        const params = { ...(month ? { month } : {}), hostelId };
        const response = await api.get('/rent/generate', { params });
        return response.data;
    },
    generate: async (hostelId, month) => {
        const response = await api.post('/rent/generate', { ...(month ? { month } : {}), hostelId });
        return response.data;
    }
};

// --- Portfolio Service (owner-scoped — reads hostel snapshot aggregates) ---
export const portfolioService = {
    getSummary: async () => {
        const response = await requestWithRetry(() => api.get('/owner/portfolio/summary'));
        return response.data;
    },
};

// --- Activity Service ---
export const activityService = {
    getAll: async (hostelId, params = {}) => {
        const response = await requestWithRetry(() => api.get('/activity', { params: { ...params, hostelId } }));
        return response.data;
    }
};

// --- Notification Service ---
export const notificationService = {
    getAll: async () => {
        const response = await api.get('/notifications');
        return response.data;
    },
    markAsRead: async (id) => {
        const response = await api.post(`/notifications/${id}/read`);
        return response.data;
    }
};

// --- Tenant Document Service ---
export const tenantDocumentService = {
    upload: async (tenantId, docType, documentNumber, file) => {
        const formData = new FormData();
        formData.append('docType', docType);
        if (documentNumber) formData.append('docNumber', documentNumber);
        formData.append('file', file);
        const response = await api.post(`/tenants/${tenantId}/documents`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },
    getAll: async (tenantId) => {
        if (!tenantId) {
            const response = await api.get('/tenants/me/documents');
            return response.data?.documents || response.data || [];
        }
        const response = await api.get(`/tenants/${tenantId}/documents`);
        return response.data?.documents || response.data || [];
    },
    delete: async (tenantId, docId) => {
        const response = await api.delete(`/tenants/${tenantId}/documents/${docId}`);
        return response.data;
    },
};

// --- SSE Token Service ---
export const sseService = {
    getToken: async () => {
        const response = await api.get('/events-token');
        return response.data.token;
    }
};

// --- Analytics Dashboard Service (dedicated endpoints, backend-next) ---
export const analyticsService = {
    getCashflow: async (hostelId, from, to) => {
        const params = { hostelId };
        if (from) params.from = from;
        if (to)   params.to   = to;
        const response = await api.get('/dashboard/cashflow', { params });
        return response.data;
    },
    getTenants: async (hostelId, from, to) => {
        const params = { hostelId };
        if (from) params.from = from;
        if (to)   params.to   = to;
        const response = await api.get('/dashboard/tenants', { params });
        return response.data;
    },
    getFunnel: async (hostelId, from, to) => {
        const params = { hostelId };
        if (from) params.from = from;
        if (to)   params.to   = to;
        const response = await api.get('/dashboard/funnel', { params });
        return response.data;
    },
    getOperations: async (hostelId, from, to) => {
        const params = { hostelId };
        if (from) params.from = from;
        if (to)   params.to   = to;
        const response = await api.get('/dashboard/operations', { params });
        return response.data;
    },
};

// --- Reminder Service ---
export const reminderService = {
    sendToTenant: async (tenantId) => {
        const response = await api.post('/notifications/send-reminder', { tenant_id: tenantId });
        return response.data;
    },
    sendBulk: async (tenants) => {
        const results = await Promise.allSettled(
            tenants.map(id => api.post('/notifications/send-reminder', { tenant_id: id }).then(r => r.data))
        );
        const sent = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
        const noCredits = results.some(r => r.status === 'rejected' && (r.reason?.response?.data?.error?.code || r.reason?.response?.data?.code) === 'NO_REMINDERS_LEFT');
        if (noCredits) {
            const err = new Error('No reminder credits left');
            err.response = { data: { error: { code: 'NO_REMINDERS_LEFT' } } };
            throw err;
        }
        const failed = results.length - sent;
        return { sent, failed, total: results.length };
    },
};

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
