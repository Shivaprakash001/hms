import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { tenantService } from '../api/services';
import { queryKeys } from '../lib/query/queryKeys';

export const useTenants = (hostelId, filters = {}) => {
  return useQuery({
    queryKey: queryKeys.tenants.list(hostelId, filters),
    queryFn:  () => tenantService.getAll(hostelId, filters),
    enabled:  !!hostelId,
    staleTime: 5 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useTenant = (hostelId, tenantId) => {
  return useQuery({
    queryKey: queryKeys.tenants.detail(hostelId, tenantId),
    queryFn:  () => tenantService.getById(tenantId),
    enabled:  !!hostelId && !!tenantId,
    staleTime: 5 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

export const useCreateTenant = (hostelId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => tenantService.create(data),
    onSuccess: (newTenant) => {
      qc.setQueryData(queryKeys.tenants.detail(hostelId, newTenant.id), newTenant);
      qc.invalidateQueries({ queryKey: queryKeys.tenants.all(hostelId) });
    },
  });
};

export const useUpdateTenant = (hostelId, tenantId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => tenantService.update(tenantId, data),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.tenants.detail(hostelId, tenantId), updated);
      qc.invalidateQueries({ queryKey: queryKeys.tenants.all(hostelId) });
    },
  });
};

export const useDeleteTenant = (hostelId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => tenantService.delete(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: queryKeys.tenants.detail(hostelId, id) });
      qc.invalidateQueries({ queryKey: queryKeys.tenants.all(hostelId) });
    },
  });
};
