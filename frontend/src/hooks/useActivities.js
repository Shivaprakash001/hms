import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { activityService } from '../api/services';
import { queryKeys } from '../lib/query/queryKeys';

export const useActivities = (params) => {
  return useQuery({
    queryKey: queryKeys.activity.list(params),
    queryFn: () => activityService.getAll(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};
