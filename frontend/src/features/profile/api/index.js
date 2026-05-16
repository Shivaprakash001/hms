import api from '@lib/api-client';

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
