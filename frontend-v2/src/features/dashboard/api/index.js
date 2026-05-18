import api, { requestWithRetry } from '@lib/api-client';

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

export const portfolioService = {
    getSummary: async () => {
        const response = await requestWithRetry(() => api.get('/owner/portfolio/summary'));
        return response.data?.data ?? response.data;
    },
    getPerformance: async (months = 6) => {
        const response = await requestWithRetry(() =>
            api.get('/dashboard/portfolio-performance', { params: { months } })
        );
        return response.data?.data ?? response.data;
    },
};
