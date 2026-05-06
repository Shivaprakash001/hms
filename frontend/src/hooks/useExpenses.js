import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expenseService } from '../api/services';
import { queryKeys } from '../lib/query/queryKeys';

export const useExpenses = () => {
  return useQuery({
    queryKey: queryKeys.expenses.list(),
    queryFn:  () => expenseService.getAll(),
    staleTime: 10 * 60 * 1000,
    gcTime:    20 * 60 * 1000,
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

export const useUpdateExpense = (expenseId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => expenseService.update(expenseId, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: queryKeys.expenses.all() }),
  });
};

export const useDeleteExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => expenseService.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: queryKeys.expenses.all() }),
  });
};
