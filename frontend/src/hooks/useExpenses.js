import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { expenseService } from '../api/services';
import { queryKeys } from '../lib/query/queryKeys';

export const useExpenses = (hostelId) => {
  return useQuery({
    queryKey: queryKeys.expenses.list(hostelId),
    queryFn:  () => expenseService.getAll(hostelId),
    enabled:  !!hostelId,
    staleTime: 10 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useCreateExpense = (hostelId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => expenseService.create(hostelId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.expenses.all(hostelId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
    },
  });
};

export const useUpdateExpense = (hostelId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => expenseService.update(id, data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: queryKeys.expenses.all(hostelId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
    },
  });
};

export const useDeleteExpense = (hostelId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => expenseService.delete(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: queryKeys.expenses.all(hostelId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
    },
  });
};
