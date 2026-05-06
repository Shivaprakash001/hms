import { useQuery } from '@tanstack/react-query';
import { billingService } from '../api/services';

const queryKeys = {
    all: ['billing'],
    subscription: () => [...queryKeys.all, 'subscription'],
    plans: () => [...queryKeys.all, 'plans'],
};

export const useSubscription = () => {
    return useQuery({
        queryKey: queryKeys.subscription(),
        queryFn: () => billingService.getSubscription(),
        staleTime: 5 * 60 * 1000,
        cacheTime: 10 * 60 * 1000,
        keepPreviousData: true,
    });
};

export const usePlans = () => {
    return useQuery({
        queryKey: queryKeys.plans(),
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
        staleTime: 60 * 60 * 1000, // 1 hour for plans
        cacheTime: 60 * 60 * 1000,
        keepPreviousData: true,
    });
};
