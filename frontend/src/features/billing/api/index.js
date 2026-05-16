import api from '@lib/api-client';

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
