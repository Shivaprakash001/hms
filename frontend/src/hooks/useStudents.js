import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentService } from '../api/services';

/**
 * Fetch all students with optional filtering
 */
export const useStudents = (options = {}) => {
  return useQuery({
    queryKey: ['students', options],
    queryFn: async () => {
      return await studentService.getAll(options);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

/**
 * Fetch single student by ID
 */
export const useStudent = (studentId) => {
  return useQuery({
    queryKey: ['students', studentId],
    queryFn: async () => {
      if (!studentId) return null;
      return await studentService.getById(studentId);
    },
    enabled: !!studentId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

/**
 * Mutate: Create new student
 */
export const useCreateStudent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data) => {
      return await studentService.create(data);
    },
    onSuccess: (newStudent) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.setQueryData(['students', newStudent.id], newStudent);
    },
  });
};

/**
 * Mutate: Update student
 */
export const useUpdateStudent = (studentId) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data) => {
      return await studentService.update(studentId, data);
    },
    onSuccess: (updatedStudent) => {
      queryClient.setQueryData(['students', studentId], updatedStudent);
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
};

/**
 * Mutate: Delete student
 */
export const useDeleteStudent = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (studentId) => {
      return await studentService.delete(studentId);
    },
    onSuccess: (_data, studentId) => {
      queryClient.removeQueries({ queryKey: ['students', studentId] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
};
