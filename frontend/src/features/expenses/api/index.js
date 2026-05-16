import api from '@lib/api-client';

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
