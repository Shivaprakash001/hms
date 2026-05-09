import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { analyticsService, addonService } from '../api/services';
import { queryKeys } from '../lib/query/queryKeys';

/**
 * Owner cashflow analytics — the primary owner dashboard widget.
 * staleTime 5 min: data changes at most once per payment event, not continuously.
 */
export const useCashflow = (hostelId, range) => {
  return useQuery({
    queryKey: queryKeys.analytics.cashflow(hostelId, range),
    queryFn:  () => analyticsService.getCashflow(hostelId, range?.from, range?.to),
    enabled:  !!hostelId,
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

/**
 * Tenant analytics tab — lazy: only fetches when tab becomes active.
 * Pass enabled=false until the user navigates to that tab.
 */
export const useTenantAnalytics = (hostelId, range, enabled = true) => {
  return useQuery({
    queryKey: queryKeys.analytics.tenants(hostelId, range),
    queryFn:  () => analyticsService.getTenants(hostelId, range?.from, range?.to),
    enabled: !!hostelId && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useFunnelAnalytics = (hostelId, range, enabled = true) => {
  return useQuery({
    queryKey: queryKeys.analytics.funnel(hostelId, range),
    queryFn:  () => analyticsService.getFunnel(hostelId, range?.from, range?.to),
    enabled: !!hostelId && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useOperationsAnalytics = (hostelId, range, enabled = true) => {
  return useQuery({
    queryKey: queryKeys.analytics.operations(hostelId, range),
    queryFn:  () => analyticsService.getOperations(hostelId, range?.from, range?.to),
    enabled: !!hostelId && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
    placeholderData: keepPreviousData,
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
