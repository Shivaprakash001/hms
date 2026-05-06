import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomService, allocationService } from '../api/services';
import { queryKeys } from '../lib/query/queryKeys';

/**
 * Fetch all rooms with optional filtering
 */
export const useRooms = (params = {}) => {
  return useQuery({
    queryKey: queryKeys.rooms.list(params),
    queryFn:  () => roomService.getAll(params),
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
  });
};

/**
 * Fetch a single room by ID
 */
export const useRoom = (roomId) => {
  return useQuery({
    queryKey: queryKeys.rooms.detail(roomId),
    queryFn:  () => roomService.getById(roomId),
    enabled:  !!roomId,
    staleTime: 5 * 60 * 1000,
    gcTime:    10 * 60 * 1000,
  });
};

/**
 * Mutate: Create a new room
 */
export const useCreateRoom = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => roomService.create(data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: queryKeys.rooms.all() }),
  });
};

/**
 * Mutate: Update a room
 */
export const useUpdateRoom = (roomId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => roomService.update(roomId, data),
    onSuccess:  (updated) => {
      qc.setQueryData(queryKeys.rooms.detail(roomId), updated);
      qc.invalidateQueries({ queryKey: queryKeys.rooms.all() });
    },
  });
};

/**
 * Mutate: Delete a room
 */
export const useDeleteRoom = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => roomService.delete(id),
    onSuccess:  (_data, id) => {
      qc.removeQueries({ queryKey: queryKeys.rooms.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.rooms.all() });
    },
  });
};

/**
 * Fetch all active room allocations
 */
export const useActiveAllocations = () => {
  return useQuery({
    queryKey: queryKeys.allocations.active(),
    queryFn:  () => allocationService.getAllActive(),
    staleTime: 2 * 60 * 1000,
    gcTime:    5 * 60 * 1000,
  });
};

/**
 * Mutate: Allocate a room to a tenant
 */
export const useAllocateRoom = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => allocationService.allocate(data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: queryKeys.allocations.all() });
      qc.invalidateQueries({ queryKey: queryKeys.rooms.all() });
    },
  });
};

/**
 * Mutate: End a room allocation
 */
export const useEndAllocation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ allocationId, data }) => allocationService.end(allocationId, data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: queryKeys.allocations.all() });
      qc.invalidateQueries({ queryKey: queryKeys.rooms.all() });
    },
  });
};

/**
 * Mutate: Shift a tenant to a new room
 */
export const useShiftTenant = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => allocationService.shift(data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: queryKeys.allocations.all() });
      qc.invalidateQueries({ queryKey: queryKeys.rooms.all() });
    },
  });
};
