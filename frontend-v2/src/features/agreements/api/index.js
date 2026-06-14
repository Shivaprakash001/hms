import api from '@lib/api-client';

const unwrap = (response) => {
  if (response.data?.success === true && response.data.data !== undefined) return response.data.data;
  return response.data?.data ?? response.data;
};

export const agreementService = {
  getRenewalQueue: async ({ hostelId, filter = 'all' } = {}) => {
    const response = await api.get('/agreements/renewals', { params: { hostelId, filter } });
    return unwrap(response);
  },
  getTenantRenewal: async () => {
    const response = await api.get('/tenant/agreement-renewal');
    return unwrap(response);
  },
  getHistory: async (tenantId) => {
    const response = await api.get('/agreements/history', { params: tenantId ? { tenantId } : {} });
    return unwrap(response);
  },
  getLifecycleRecovery: async ({ hostelId } = {}) => {
    const response = await api.get('/agreements/lifecycle-recovery', { params: hostelId ? { hostelId } : {} });
    return unwrap(response);
  },
  getLifecycleRecoveryCompletion: async ({ hostelId } = {}) => {
    const response = await api.get('/agreements/lifecycle-recovery/completion', { params: hostelId ? { hostelId } : {} });
    return unwrap(response);
  },
  exportLifecycleRecovery: async ({ hostelId } = {}) => {
    const response = await api.get('/agreements/lifecycle-recovery/export', {
      params: hostelId ? { hostelId } : {},
      responseType: 'blob',
    });
    return response.data;
  },
  recoverLifecycle: async (agreementId, data) => {
    const response = await api.post(`/agreements/${agreementId}/lifecycle-recovery`, data);
    return unwrap(response);
  },
  createRenewalDraft: async (agreementId) => {
    const response = await api.post(`/agreements/${agreementId}/renewal-draft`);
    return unwrap(response);
  },
  signRenewal: async (agreementId, data) => {
    const response = await api.post(`/agreements/${agreementId}/sign-renewal`, data);
    return unwrap(response);
  },
};
