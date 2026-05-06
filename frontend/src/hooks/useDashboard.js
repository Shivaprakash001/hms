import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { dashboardService } from '../api/services';
import { queryKeys } from '../lib/query/queryKeys';

/**
 * Owner dashboard stats (KPI cards, occupancy, etc.)
 * useDashboard and useDashboardStats are aliases — they share the same cache
 * entry so mounting both in the same render does ONE network request.
 */
export const useDashboard = () => {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn:  () => dashboardService.getStats(),
    staleTime: 5 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useDashboardStats = useDashboard;

export const useMonthlyStats = (months = 6) => {
  return useQuery({
    queryKey: queryKeys.dashboard.monthly(months),
    queryFn:  () => dashboardService.getMonthlyStats(months),
    staleTime: 10 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useDashboardSummary = () => {
  return useQuery({
    queryKey: queryKeys.dashboard.summary(),
    queryFn:  () => dashboardService.getSummary(),
    staleTime: 5 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};
