import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { paymentService, identityService } from '../api/services';
import { queryKeys } from '../lib/query/queryKeys';

export const useTenantPaymentHistory = (hostelId, tenantId) => {
  return useQuery({
    queryKey: queryKeys.tenants.paymentHistory(hostelId, tenantId),
    queryFn:  () => paymentService.getTenantHistory(tenantId),
    enabled:  !!hostelId && !!tenantId,
    staleTime: 2 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useDuesReport = (hostelId, params) => {
  return useQuery({
    queryKey: queryKeys.payments.dues(hostelId, params),
    queryFn:  () => paymentService.getAllDues(hostelId, params),
    enabled:  !!hostelId,
    staleTime: 2 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useLedger = (hostelId, params) => {
  return useQuery({
    queryKey: queryKeys.payments.ledger(hostelId, params),
    queryFn:  () => paymentService.getAll(hostelId, params),
    enabled:  !!hostelId,
    staleTime: 2 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const usePendingVerifications = (hostelId) => {
  return useQuery({
    queryKey: queryKeys.payments.pendingVerification(hostelId),
    queryFn:  () => paymentService.getPendingVerifications(hostelId),
    enabled:  !!hostelId,
    staleTime: 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useRecordPayment = (hostelId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => paymentService.recordPayment({ ...data, hostelId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.payments.all(hostelId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
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
export const useOfflinePayment = (hostelId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => paymentService.recordOfflinePayment({ ...data, hostelId }),
    onSuccess: (_data, variables) => {
      // Precise invalidation: only the affected tenant's history + dues + dashboard
      if (variables.obligationId) {
        qc.invalidateQueries({ queryKey: queryKeys.payments.dues(hostelId) });
        qc.invalidateQueries({ queryKey: queryKeys.payments.all(hostelId) });
      }
      qc.invalidateQueries({ queryKey: queryKeys.analytics.all(hostelId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
    },
  });
};

export const useGenerateMonthlyRent = (hostelId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rentMonth) => paymentService.generateRent(hostelId, rentMonth),
    onSuccess:  () => qc.invalidateQueries({ queryKey: queryKeys.payments.all(hostelId) }),
  });
};

export const useInitiatePayment = () => {
  return useMutation({
    mutationFn: (data) => paymentService.initiatePayment(data),
  });
};
