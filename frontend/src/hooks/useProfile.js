import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import { queryKeys } from '../lib/query/queryKeys';

/**
 * Current authenticated user — fetched from /auth/me.
 *
 * The AuthContext handles login/logout state transitions. This hook is for
 * components that need fresh server-side user data (profile pages, settings)
 * without re-running the auth bootstrap sequence.
 *
 * Cache strategy:
 *  - 10 min staleTime: user profile rarely changes mid-session
 *  - gcTime 30 min: keep in cache across tab navigations
 *  - refetchOnMount: 'always' so profile page always shows current data
 *    but sibling components share the same cache entry (no duplicate requests)
 */
export const useCurrentUser = () => {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn:  () => api.get('/auth/me').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    retry: 1,
  });
};
