import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { roomService, allocationService } from '../api/services';
import { queryKeys } from '../lib/query/queryKeys';

/**
 * Fetch all rooms with optional filtering
 */
export const useRooms = (hostelId, params = {}) => {
  return useQuery({
    queryKey: queryKeys.rooms.list(hostelId, params),
    queryFn:  () => roomService.getAll(hostelId, params),
    enabled:  !!hostelId,
    staleTime: 5 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

/**
 * Fetch a single room by ID
 */
export const useRoom = (hostelId, roomId) => {
  return useQuery({
    queryKey: queryKeys.rooms.detail(hostelId, roomId),
    queryFn:  () => roomService.getById(roomId),
    enabled:  !!hostelId && !!roomId,
    staleTime: 5 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

/**
 * Mutate: Create a new room
 */
export const useCreateRoom = (hostelId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => roomService.create(hostelId, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: queryKeys.rooms.all(hostelId) }),
  });
};

/**
 * Mutate: Update a room
 */
export const useUpdateRoom = (hostelId, roomId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => roomService.update(roomId, data),
    onSuccess:  (updated) => {
      qc.setQueryData(queryKeys.rooms.detail(hostelId, roomId), updated);
      qc.invalidateQueries({ queryKey: queryKeys.rooms.all(hostelId) });
    },
  });
};

/**
 * Mutate: Delete a room
 */
export const useDeleteRoom = (hostelId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => roomService.delete(id),
    onSuccess:  (_data, id) => {
      qc.removeQueries({ queryKey: queryKeys.rooms.detail(hostelId, id) });
      qc.invalidateQueries({ queryKey: queryKeys.rooms.all(hostelId) });
    },
  });
};

/**
 * Fetch all active room allocations
 */
export const useActiveAllocations = (hostelId) => {
  return useQuery({
    queryKey: queryKeys.allocations.active(hostelId),
    queryFn:  () => allocationService.getAllActive(hostelId),
    enabled:  !!hostelId,
    staleTime: 2 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
};

/**
 * Mutate: Allocate a room to a tenant
 */
export const useAllocateRoom = (hostelId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => allocationService.allocate(hostelId, data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: queryKeys.allocations.all(hostelId) });
      qc.invalidateQueries({ queryKey: queryKeys.rooms.all(hostelId) });
      qc.invalidateQueries({ queryKey: queryKeys.tenants.all(hostelId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
    },
  });
};

/**
 * Mutate: End a room allocation
 */
export const useEndAllocation = (hostelId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ allocationId, data }) => allocationService.end(allocationId, data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: queryKeys.allocations.all(hostelId) });
      qc.invalidateQueries({ queryKey: queryKeys.rooms.all(hostelId) });
      qc.invalidateQueries({ queryKey: queryKeys.tenants.all(hostelId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
    },
  });
};

/**
 * Mutate: Shift a tenant to a new room
 */
export const useShiftTenant = (hostelId) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => allocationService.shift(hostelId, data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: queryKeys.allocations.all(hostelId) });
      qc.invalidateQueries({ queryKey: queryKeys.rooms.all(hostelId) });
      qc.invalidateQueries({ queryKey: queryKeys.tenants.all(hostelId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all(hostelId) });
    },
  });
};
