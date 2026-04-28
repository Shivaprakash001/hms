import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantService } from '../api/services';

/**
 * Fetch all tenants with optional filtering
 */
export const useTenants = (options = {}) => {
  return useQuery({
    queryKey: ['tenants', options],
    queryFn: async () => {
      return await tenantService.getAll(options);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

/**
 * Fetch single tenant by ID
 */
export const useTenant = (tenantId) => {
  return useQuery({
    queryKey: ['tenants', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      return await tenantService.getById(tenantId);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

/**
 * Mutate: Create new tenant
 */
export const useCreateTenant = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data) => {
      return await tenantService.create(data);
    },
    onSuccess: (newTenant) => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.setQueryData(['tenants', newTenant.id], newTenant);
    },
  });
};

/**
 * Mutate: Update tenant
 */
export const useUpdateTenant = (tenantId) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data) => {
      return await tenantService.update(tenantId, data);
    },
    onSuccess: (updatedTenant) => {
      queryClient.setQueryData(['tenants', tenantId], updatedTenant);
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });
};

/**
 * Mutate: Delete tenant
 */
export const useDeleteTenant = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (tenantId) => {
      return await tenantService.delete(tenantId);
    },
    onSuccess: (_data, tenantId) => {
      queryClient.removeQueries({ queryKey: ['tenants', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });
};
