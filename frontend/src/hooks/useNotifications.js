import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '../api/services';
import { queryKeys } from '../lib/query/queryKeys';

/**
 * Notification list — mounted in the top nav, so staleTime must be short
 * enough to feel live but not so short it hammers the DB on every page visit.
 * 90 seconds is a reasonable balance for a hostel context.
 */
export const useNotifications = () => {
  return useQuery({
    queryKey: queryKeys.notifications(),
    queryFn:  () => notificationService.getAll(),
    staleTime: 90 * 1000,
    gcTime:    5 * 60 * 1000,
    // Keep previous data visible while revalidating — no flicker
    placeholderData: (prev) => prev,
  });
};

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => notificationService.markAsRead(id),
    // Optimistic update: flip read flag in cache immediately
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.notifications() });
      const previous = qc.getQueryData(queryKeys.notifications());
      qc.setQueryData(queryKeys.notifications(), (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((n) => n.id === id ? { ...n, read: true } : n);
      });
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(queryKeys.notifications(), ctx.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications() });
    },
  });
};
