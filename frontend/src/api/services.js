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

// --- Complaint Services ---
export const complaintService = {
    getAll: async (params) => {
        const response = await api.get('/complaints/', { params });
        return response.data;
    },
    create: async (data) => {
        const response = await api.post('/complaints/', data);
        return response.data;
    },
    updateStatus: async (id, status, remarks) => {
        const response = await api.patch(`/complaints/${id}/status`, { status, staff_remarks: remarks });
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
    generateRent: async (month) => {
        const response = await api.post('/payments/generate-monthly', { rent_month: month });
        return response.data;
    },
    waive: async (obligationId, reason) => {
        const response = await api.post(`/payments/obligations/${obligationId}/waive`, { reason });
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
