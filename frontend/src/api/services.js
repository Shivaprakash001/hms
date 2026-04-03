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
    getByProfileId: async (profileId) => {
        const response = await api.get(`/students/by-profile/${profileId}`);
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
        const response = await api.post('/payments/', data);
        return response.data;
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
    getStats: async () => {
        const response = await api.get('/dashboard/stats');
        return response.data;
    },
    getMonthlyStats: async (months = 6) => {
        const response = await api.get(`/dashboard/monthly-stats?months=${months}`);
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
    }
};
