import api from '@lib/api-client';

export const expenseService = {
    getAll: async (hostelId, params = {}) => {
        const requestParams = { ...params };
        if (hostelId && hostelId !== 'all') requestParams.hostelId = hostelId;
        const response = await api.get('/expenses', { params: requestParams });
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    getSuggestions: async () => {
        const response = await api.get('/expenses', { params: { mode: 'suggestions' } });
        const data = response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
        return data?.frequent_expenses || [];
    },
    getTitleSummary: async (title) => {
        const response = await api.get('/expenses', { params: { mode: 'title_summary', title } });
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    create: async (_hostelId, data) => {
        let payload = {
            ...data,
            expense_scope: 'BUSINESS',
        };
        // Remove hostelId from payload — expenses are portfolio-level
        delete payload.hostelId;

        if (data?.receipt_image instanceof File) {
            const { receipt_image, ...expenseData } = payload;
            const formData = new FormData();
            formData.append('expense_data', JSON.stringify(expenseData));
            formData.append('receipt_image', receipt_image);
            payload = formData;
        }
        const response = await api.post('/expenses', payload);
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    update: async (id, data) => {
        const response = await api.put(`/expenses/${id}`, data);
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    delete: async (id) => {
        const response = await api.delete(`/expenses/${id}`);
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    }
};
