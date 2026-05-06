import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { paymentService, identityService } from '../api/services';
import { queryKeys } from '../lib/query/queryKeys';

export const useTenantPaymentHistory = (tenantId) => {
  return useQuery({
    queryKey: queryKeys.tenants.paymentHistory(tenantId),
    queryFn:  () => paymentService.getTenantHistory(tenantId),
    enabled:  !!tenantId,
    staleTime: 2 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useDuesReport = (params) => {
  return useQuery({
    queryKey: queryKeys.payments.dues(params),
    queryFn:  () => paymentService.getAllDues(params),
    staleTime: 2 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useLedger = (params) => {
  return useQuery({
    queryKey: queryKeys.payments.ledger(params),
    queryFn:  () => paymentService.getAll(params),
    staleTime: 2 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const usePendingVerifications = () => {
  return useQuery({
    queryKey: queryKeys.payments.pendingVerification(),
    queryFn:  () => paymentService.getPendingVerifications(),
    staleTime: 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useRecordPayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => paymentService.recordPayment(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.payments.all() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
  });
};

/**
 * Secure 2-step offline payment mutation.
 *
 * Usage:
 *   const { mutateAsync: recordOffline, isPending } = useOfflinePayment();
 *
 *   // Step 1 (handled by UI password modal — call identityService directly)
 *   const { identity_token } = await identityService.confirmIdentity(password);
 *
 *   // Step 2
 *   await recordOffline({ identityToken, obligationId, amountPaid, paymentMethod, ... });
 */
export const useOfflinePayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => paymentService.recordOfflinePayment(data),
    onSuccess: (_data, variables) => {
      // Precise invalidation: only the affected tenant's history + dues + dashboard
      if (variables.obligationId) {
        qc.invalidateQueries({ queryKey: queryKeys.payments.dues() });
        qc.invalidateQueries({ queryKey: queryKeys.payments.all() });
      }
      qc.invalidateQueries({ queryKey: queryKeys.analytics.all() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
  });
};

export const useGenerateMonthlyRent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rentMonth) => paymentService.generateRent(rentMonth),
    onSuccess:  () => qc.invalidateQueries({ queryKey: queryKeys.payments.all() }),
  });
};

export const useInitiatePayment = () => {
  return useMutation({
    mutationFn: (data) => paymentService.initiatePayment(data),
  });
};
