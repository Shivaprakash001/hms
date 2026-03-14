import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { complaintService } from '../api/services';

/**
 * Fetch all complaints with optional filtering
 */
export const useComplaints = (params = {}) => {
  return useQuery({
    queryKey: ['complaints', params],
    queryFn: async () => {
      return await complaintService.getAll(params);
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

/**
 * Mutate: Create a new complaint
 */
export const useCreateComplaint = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      return await complaintService.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
    },
  });
};

/**
 * Mutate: Update complaint status
 */
export const useUpdateComplaintStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, remarks }) => {
      return await complaintService.updateStatus(id, status, remarks);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
    },
  });
};
