import api from '@lib/api-client';

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
