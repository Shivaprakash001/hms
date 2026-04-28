import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentService } from '../api/services';

/**
 * Fetch payment history for a tenant
 */
export const useStudentPaymentHistory = (tenantId) => {
  return useQuery({
    queryKey: ['payments', 'history', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      return await paymentService.getStudentHistory(tenantId);
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

/**
 * Fetch all dues report
 */
export const useDuesReport = () => {
  return useQuery({
    queryKey: ['payments', 'dues'],
    queryFn: async () => {
      return await paymentService.getAllDues();
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

/**
 * Mutate: Record a payment
 */
export const useRecordPayment = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data) => {
      return await paymentService.recordPayment(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

/**
 * Mutate: Generate monthly rent
 */
export const useGenerateMonthlyRent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (rentMonth) => {
      return await paymentService.generateRent(rentMonth);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
};

/**
 * Mutate: Initiate Razorpay payment
 */
export const useInitiatePayment = () => {
  return useMutation({
    mutationFn: async (data) => {
      // Assuming a service for initiation exists, otherwise use placeholder
      // return await paymentService.initiateRazorpayOrder(data);
      return data; 
    },
  });
};
