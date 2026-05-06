import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { expenseService } from '../api/services';
import { queryKeys } from '../lib/query/queryKeys';

export const useExpenses = () => {
  return useQuery({
    queryKey: queryKeys.expenses.list(),
    queryFn:  () => expenseService.getAll(),
    staleTime: 10 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useCreateExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => expenseService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.expenses.all() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
  });
};

export const useUpdateExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => expenseService.update(id, data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: queryKeys.expenses.all() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
  });
};

export const useDeleteExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => expenseService.delete(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: queryKeys.expenses.all() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
  });
};
