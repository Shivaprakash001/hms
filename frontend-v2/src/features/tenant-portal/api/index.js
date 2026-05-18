import api from '@lib/api-client';
import { tenantService } from '@features/tenants/api';
import { paymentService } from '@features/payments/api';
import { notificationService } from '@features/notifications/api';
import { moveOutService } from '@features/move-out/api';

const unwrap = (response) => {
  if (response.data?.success === true && response.data.data !== undefined) {
    return response.data.data;
  }
  return response.data;
};

export const tenantPortalApi = {
  ...tenantService,
  getDuesBreakdown: async () => {
    const response = await api.get('/payments/tenant-dues');
    return unwrap(response);
  },
  getMoveOutStatus: async () => {
    const response = await api.get('/move-out/tenant');
    return unwrap(response);
  },
  getNotifications: async () => {
    const response = await api.get('/notifications');
    const data = unwrap(response);
    return Array.isArray(data) ? data : data?.notifications ?? [];
  },
  getAdvance: async () => tenantService.getMyAdvance(),
  downloadReceipt: (paymentId) => paymentService.downloadReceipt(paymentId),
  createPaymentIntent: (data) => paymentService.createIntent(data),
  getAttempt: (attemptId) => paymentService.getAttempt(attemptId),
  submitUpiReference: (data) => paymentService.submitUpiReference(data),
  verifyPayment: (data) => paymentService.verifyPayment(data),
  markNotificationRead: (id) => notificationService.markAsRead(id),
  getMoveOutTimeline: () => moveOutService.getTimeline(),
};
