import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../api/services';

export const useDashboard = () => {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      return await dashboardService.getStats();
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      return await dashboardService.getStats();
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useMonthlyStats = (months = 6) => {
  return useQuery({
    queryKey: ['dashboard', 'monthly', months],
    queryFn: async () => {
      return await dashboardService.getMonthlyStats(months);
    },
    staleTime: 10 * 60 * 1000,
  });
};

export const useStudentStats = () => {
  return useQuery({
    queryKey: ['dashboard', 'student'],
    queryFn: async () => {
      // Assuming a service method exists or return placeholder
      // return await dashboardService.getStudentStats();
      return await dashboardService.getStats(); 
    },
    staleTime: 5 * 60 * 1000,
  });
};
