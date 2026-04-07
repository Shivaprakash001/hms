import api from './axios';

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
    getUnassignedStudents: async () => {
        const response = await api.get('/profiles/unassigned/students');
        return response.data;
    }
};

// --- Owner Service ---
export const ownerService = {
    _requestWithFallback: async (method, path, data) => {
        try {
            const response = await api.request({ method, url: path, data });
            return response.data;
        } catch (error) {
            if (error?.response?.status === 404 && !path.startsWith('/api/v1/')) {
                const fallbackResponse = await api.request({ method, url: `/api/v1${path}`, data });
                return fallbackResponse.data;
            }
            throw error;
        }
    },
    getProfile: async () => {
        try {
            return await ownerService._requestWithFallback('get', '/owner/me/profile');
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
                            auto_rent_day: 1
                        }
                    };
                }
            }
            throw error;
        }
    },
    updateOwner: async (data) => {
        try {
            return await ownerService._requestWithFallback('patch', '/owner/me/profile', data);
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
                            auto_rent_day: 1
                        }
                    };
                }
            }
            throw error;
        }
    },
    updateHostel: async (data) => {
        return ownerService._requestWithFallback('patch', '/owner/me/hostel', data);
    },
    updatePreferences: async (data) => {
        return ownerService._requestWithFallback('patch', '/owner/me/preferences', data);
    },
    uploadLogo: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await api.post('/owner/logo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data;
        } catch (error) {
            if (error?.response?.status === 404) {
                const fallback = await api.post('/api/v1/owner/logo', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                return fallback.data;
            }
            throw error;
        }
    },
    searchTenants: async (query, limit = 10) => {
        const response = await api.get('/owner/search', {
            params: { q: query, limit }
        });
        return response.data;
    }
};

// --- Billing & Plans Service ---
export const billingService = {
    _requestWithFallback: async (method, path, data) => {
        try {
            const response = await api.request({ method, url: path, data });
            return response.data;
        } catch (error) {
            if (error?.response?.status === 404 && !path.startsWith('/api/v1/')) {
                const fallbackResponse = await api.request({ method, url: `/api/v1${path}`, data });
                return fallbackResponse.data;
            }
            throw error;
        }
    },
    getSubscription: async () => {
        return billingService._requestWithFallback('get', '/owner/me/subscription');
    },
    getPlans: async () => {
        return billingService._requestWithFallback('get', '/plans');
    },
    getUsage: async () => {
        return billingService._requestWithFallback('get', '/owner/me/usage');
    }
};

// --- Student Services ---
export const studentService = {
    getAll: async (params) => {
        const response = await api.get('/students/', { params });
        return response.data;
    },
    getById: async (id) => {
        const response = await api.get(`/students/${id}`);
        return response.data;
    },
    getOwnerTenantOverview: async (id) => {
        const response = await api.get(`/students/owner/tenants/${id}/overview`);
        return response.data;
    },
    getByProfileId: async (profileId) => {
        const response = await api.get(`/students/by-profile/${profileId}`);
        return response.data;
    },
    getMyProfile: async () => {
        const response = await api.get('/students/me/profile');
        return response.data;
    },
    updateMyProfile: async (data) => {
        const response = await api.patch('/students/me/profile', data);
        return response.data;
    },
    completeMyProfile: async (data, aadhaarFile) => {
        const formData = new FormData();
        formData.append('profile_data', JSON.stringify(data));
        formData.append('aadhaar_file', aadhaarFile);
        try {
            const response = await api.post('/students/me/complete-profile', formData, {
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
        const response = await api.get('/students/me/documents');
        return response.data;
    },
    getMyPaymentHistory: async () => {
        const response = await api.get('/students/me/payments/history');
        return response.data;
    },
    getMyRoom: async () => {
        const response = await api.get('/students/me/room');
        return response.data;
    },
    create: async (data) => {
        const response = await api.post('/students/', data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await api.put(`/students/${id}`, data);
        return response.data;
    },
    delete: async (id) => {
        const response = await api.delete(`/students/${id}`);
        return response.data;
    },
    reactivate: async (id, data) => {
        const response = await api.post(`/students/${id}/reactivate`, data);
        return response.data;
    },
    requestReactivation: async () => {
        const response = await api.post('/students/me/reactivation-request');
        return response.data;
    },
    getReactivationRequests: async () => {
        const response = await api.get('/students/owner/reactivation-requests');
        return response.data;
    },
    decideReactivationRequest: async (requestId, action, notes = '') => {
        const response = await api.post(`/students/owner/reactivation-requests/${requestId}/decision`, { action, notes });
        return response.data;
    },
    invite: async (data) => {
        const response = await api.post('/students/invite', data);
        return response.data;
    },
    resendInvitation: async (email) => {
        const response = await api.post('/students/resend-invitation', { email });
        return response.data;
    }
};

// --- Room Services ---
export const roomService = {
    getAll: async (params) => {
        const response = await api.get('/rooms/', { params });
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
    create: async (data) => {
        const response = await api.post('/rooms/', data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await api.put(`/rooms/${id}`, data);
        return response.data;
    },
    delete: async (id) => {
        const response = await api.delete(`/rooms/${id}`);
        return response.data;
    }
};

// --- Allocation Services ---
export const allocationService = {
    allocate: async (data) => {
        const response = await api.post('/allocations/', data);
        return response.data;
    },
    end: async (allocationId, data) => {
        const response = await api.patch(`/allocations/${allocationId}/end`, data);
        return response.data;
    },
    shift: async (data) => {
        const response = await api.post('/allocations/shift', data);
        return response.data;
    },
    getStudentHistory: async (studentId) => {
        const response = await api.get(`/allocations/student/${studentId}`);
        return response.data;
    },
    getAllActive: async () => {
        const response = await api.get('/allocations/active');
        return response.data;
    },
    getHistory: async () => {
        const response = await api.get('/allocations/owner-history');
        return response.data;
    }
};


// --- Payment Services ---
export const paymentService = {
    getAll: async (params) => {
        const response = await api.get('/payments/', { params });
        return response.data;
    },
    getAllDues: async (params) => {
        const response = await api.get('/payments/dues', { params });
        return response.data;
    },
    getStudentHistory: async (studentId) => {
        const response = await api.get(`/payments/student/${studentId}`);
        return response.data;
    },
    recordPayment: async (data) => {
        try {
            const response = await api.post('/owner/payments/offline', data);
            return response.data;
        } catch (error) {
            if (error?.response?.status === 404) {
                const fallback = await api.post('/payments/offline', data);
                return fallback.data;
            }
            throw error;
        }
    },
    initiatePayment: async (data) => {
        const response = await api.post('/payments/initiate', data);
        return response.data;
    },
    /**
     * Verify a Razorpay payment server-side after the checkout callback fires.
     * @param {Object} data - { razorpay_order_id, razorpay_payment_id, razorpay_signature, obligation_id? }
     */
    verifyPayment: async (data) => {
        const response = await api.post('/payments/verify', data);
        return response.data;
    },
    /**
     * Reconcile pending payments with Razorpay (admin/owner).
     * @param {string[]} [paymentIds] - Optional list of payment IDs; omit to reconcile all pending.
     */
    reconcilePayments: async (paymentIds) => {
        const body = paymentIds ? { payment_ids: paymentIds } : {};
        const response = await api.post('/payments/reconcile', body);
        return response.data;
    },
    generateRent: async (month) => {
        const response = await api.post('/payments/generate-monthly', { rent_month: month });
        return response.data;
    },
    previewGenerateRent: async (month) => {
        const response = await api.get('/payments/generate-preview', { params: { rent_month: month } });
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
            try { detail = JSON.parse(text).detail || text; } catch { detail = text; }
            const err = new Error(detail);
            err.response = { status: 400, data: { detail } };
            throw err;
        }

        return blob;
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
    }
};

// --- Expense Service ---
export const expenseService = {
    getAll: async () => {
        const response = await api.get('/expenses/');
        return response.data;
    },
    create: async (data) => {
        const response = await api.post('/expenses/', data);
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

// --- Dashboard Service ---
export const dashboardService = {
    getSummary: async () => {
        const response = await api.get('/dashboard/summary');
        return response.data;
    },
    getStats: async () => {
        const response = await api.get('/dashboard/stats');
        return response.data;
    },
    getMonthlyStats: async (months = 6) => {
        const response = await api.get(`/dashboard/monthly-stats?months=${months}`);
        return response.data;
    }
};

// --- Activity Service ---
export const activityService = {
    getAll: async (params = {}) => {
        const response = await api.get('/activity/', { params });
        return response.data;
    }
};

// --- Notification Service ---
export const notificationService = {
    getAll: async () => {
        const response = await api.get('/notifications/');
        return response.data;
    },
    markAsRead: async (id) => {
        const response = await api.patch(`/notifications/${id}/read`);
        return response.data;
    }
};

// --- Tenant Document Service ---
export const tenantDocumentService = {
    upload: async (tenantId, docType, documentNumber, file) => {
        const formData = new FormData();
        formData.append('doc_type', docType);
        if (documentNumber) formData.append('document_number', documentNumber);
        formData.append('file', file);
        const response = await api.post(`/tenants/${tenantId}/documents`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },
    getAll: async (tenantId) => {
        const response = await api.get(`/tenants/${tenantId}/documents`);
        return response.data;
    },
    delete: async (tenantId, docId) => {
        const response = await api.delete(`/tenants/${tenantId}/documents/${docId}`);
        return response.data;
    },
    verify: async (tenantId, docId) => {
        const response = await api.patch(`/tenants/${tenantId}/documents/${docId}/verify`);
        return response.data;
    },
    reject: async (tenantId, docId, reason) => {
        const response = await api.patch(`/tenants/${tenantId}/documents/${docId}/reject`, { reason });
        return response.data;
    }
};
