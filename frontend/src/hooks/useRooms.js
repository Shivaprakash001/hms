import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomService, allocationService } from '../api/services';

/**
 * Fetch all rooms with optional filtering
 */
export const useRooms = (params = {}) => {
  return useQuery({
    queryKey: ['rooms', params],
    queryFn: async () => {
      return await roomService.getAll(params);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

/**
 * Fetch a single room by ID
 */
export const useRoom = (roomId) => {
  return useQuery({
    queryKey: ['rooms', roomId],
    queryFn: async () => {
      if (!roomId) return null;
      return await roomService.getById(roomId);
    },
    enabled: !!roomId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

/**
 * Mutate: Create a new room
 */
export const useCreateRoom = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      return await roomService.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
};

/**
 * Mutate: Update a room
 */
export const useUpdateRoom = (roomId) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      return await roomService.update(roomId, data);
    },
    onSuccess: (updatedRoom) => {
      queryClient.setQueryData(['rooms', roomId], updatedRoom);
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
};

/**
 * Mutate: Delete a room
 */
export const useDeleteRoom = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomId) => {
      return await roomService.delete(roomId);
    },
    onSuccess: (_data, roomId) => {
      queryClient.removeQueries({ queryKey: ['rooms', roomId] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
};

/**
 * Fetch all active room allocations
 */
export const useActiveAllocations = () => {
  return useQuery({
    queryKey: ['allocations', 'active'],
    queryFn: async () => {
      return await allocationService.getAllActive();
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

/**
 * Mutate: Allocate a room to a tenant
 */
export const useAllocateRoom = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      return await allocationService.allocate(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
};

/**
 * Mutate: End a room allocation
 */
export const useEndAllocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ allocationId, data }) => {
      return await allocationService.end(allocationId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
};

/**
 * Mutate: Shift a tenant to a new room
 */
export const useShiftTenant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      return await allocationService.shift(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
};
