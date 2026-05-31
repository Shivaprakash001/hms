import api from '@lib/api-client';

export const expenseService = {
    getAll: async (hostelId, params = {}) => {
        const requestParams = { ...params };
        if (hostelId) requestParams.hostelId = hostelId;
        const response = await api.get('/expenses', { params: requestParams });
        return response.data.success !== undefined ? (response.data.data !== undefined ? response.data.data : response.data) : response.data;
    },
    create: async (hostelId, data) => {
        let payload = { ...data, hostelId: data?.hostelId ?? hostelId ?? undefined };
        if (!payload.hostelId) delete payload.hostelId;
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
