import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { tenantService } from '../api/services';
import { queryKeys } from '../lib/query/queryKeys';

export const useTenants = (filters = {}) => {
  return useQuery({
    queryKey: queryKeys.tenants.list(filters),
    queryFn:  () => tenantService.getAll(filters),
    staleTime: 5 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useTenant = (tenantId) => {
  return useQuery({
    queryKey: queryKeys.tenants.detail(tenantId),
    queryFn:  () => tenantService.getById(tenantId),
    enabled:  !!tenantId,
    staleTime: 5 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useCreateTenant = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => tenantService.create(data),
    onSuccess: (newTenant) => {
      qc.setQueryData(queryKeys.tenants.detail(newTenant.id), newTenant);
      qc.invalidateQueries({ queryKey: queryKeys.tenants.all() });
    },
  });
};

export const useUpdateTenant = (tenantId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => tenantService.update(tenantId, data),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.tenants.detail(tenantId), updated);
      qc.invalidateQueries({ queryKey: queryKeys.tenants.all() });
    },
  });
};

export const useDeleteTenant = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => tenantService.delete(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: queryKeys.tenants.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.tenants.all() });
    },
  });
};
