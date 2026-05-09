import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { dashboardService } from '../api/services';
import { queryKeys } from '../lib/query/queryKeys';

/**
 * Owner dashboard stats (KPI cards, occupancy, etc.)
 * useDashboard and useDashboardStats are aliases — they share the same cache
 * entry so mounting both in the same render does ONE network request.
 */
export const useDashboard = (hostelId) => {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(hostelId),
    queryFn:  () => dashboardService.getStats(hostelId),
    enabled:  !!hostelId,
    staleTime: 5 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useDashboardStats = useDashboard;

export const useMonthlyStats = (hostelId, months = 6) => {
  return useQuery({
    queryKey: queryKeys.dashboard.monthly(hostelId, months),
    queryFn:  () => dashboardService.getMonthlyStats(hostelId, months),
    enabled:  !!hostelId,
    staleTime: 10 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useDashboardSummary = (hostelId) => {
  return useQuery({
    queryKey: queryKeys.dashboard.summary(hostelId),
    queryFn:  () => dashboardService.getSummary(hostelId),
    enabled:  !!hostelId,
    staleTime: 5 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};
