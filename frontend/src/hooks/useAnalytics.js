import { useQuery } from '@tanstack/react-query';
import { analyticsService, addonService } from '../api/services';
import { queryKeys } from '../lib/query/queryKeys';

/**
 * Owner cashflow analytics — the primary owner dashboard widget.
 * staleTime 5 min: data changes at most once per payment event, not continuously.
 */
export const useCashflow = (range) => {
  return useQuery({
    queryKey: queryKeys.analytics.cashflow(range),
    queryFn:  () => analyticsService.getCashflow(range?.from, range?.to),
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
};

/**
 * Tenant analytics tab — lazy: only fetches when tab becomes active.
 * Pass enabled=false until the user navigates to that tab.
 */
export const useTenantAnalytics = (range, enabled = true) => {
  return useQuery({
    queryKey: queryKeys.analytics.tenants(range),
    queryFn:  () => analyticsService.getTenants(range?.from, range?.to),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
};

export const useFunnelAnalytics = (range, enabled = true) => {
  return useQuery({
    queryKey: queryKeys.analytics.funnel(range),
    queryFn:  () => analyticsService.getFunnel(range?.from, range?.to),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
};

export const useOperationsAnalytics = (range, enabled = true) => {
  return useQuery({
    queryKey: queryKeys.analytics.operations(range),
    queryFn:  () => analyticsService.getOperations(range?.from, range?.to),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
};

/**
 * Addon/credit usage — feeds the cron-stopped and low-credits banners.
 * Shorter staleTime because credits can deplete within a single session.
 */
export const useAddonUsage = () => {
  return useQuery({
    queryKey: queryKeys.addon.usage(),
    queryFn:  () => addonService.getUsage(),
    staleTime: 2 * 60 * 1000,
    gcTime:    5 * 60 * 1000,
  });
};
