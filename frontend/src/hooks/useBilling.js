import { useQuery } from '@tanstack/react-query';
import { billingService } from '../api/services';
import { keepPreviousData } from '@tanstack/react-query';

export const useSubscription = () => {
    return useQuery({
        queryKey: ['owner', 'subscription', 'current'],
        queryFn: () => billingService.getSubscription(),
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        placeholderData: keepPreviousData,
    });
};

export const usePlans = () => {
    return useQuery({
        queryKey: ['owner', 'subscription', 'plans'],
        queryFn: async () => {
            const data = await billingService.getPlans();
            const fetchedPlans = Array.isArray(data) ? data : (data?.data || []);
            const PLAN_ORDER = ['FREE', 'STARTER', 'GROWTH', 'BUSINESS', 'SCALE'];
            return [...fetchedPlans].sort((a, b) => {
                const ai = PLAN_ORDER.indexOf(a.id);
                const bi = PLAN_ORDER.indexOf(b.id);
                const sa = ai === -1 ? PLAN_ORDER.length : ai;
                const sb = bi === -1 ? PLAN_ORDER.length : bi;
                return sa - sb;
            });
        },
        staleTime: 60 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
        placeholderData: keepPreviousData,
    });
};
