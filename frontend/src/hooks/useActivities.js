import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { activityService } from '../api/services';
import { queryKeys } from '../lib/query/queryKeys';

export const useActivities = (hostelId, params) => {
  return useQuery({
    queryKey: queryKeys.activity.list(hostelId, params),
    queryFn: () => activityService.getAll(hostelId, params),
    enabled: !!hostelId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};
