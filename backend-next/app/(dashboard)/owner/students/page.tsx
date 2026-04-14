"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/providers";

/**
 * 👩‍🎓 INTEGRATION EXAMPLE: Student List
 * Demonstrates: React Query + API Client + Auth Context
 */
export default function StudentsPage() {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["students", user?.id],
    queryFn: () => api.get<{ students: any[] }>("/students"),
    enabled: !!user,
  });

  if (isLoading) return <div className="p-8">Loading students...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {(error as any).message}</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Student Directory</h1>
      <div className="grid gap-4">
        {data?.students.map((student) => (
          <div key={student.id} className="p-4 bg-white shadow rounded-lg border">
            <p className="font-semibold">{student.profile.name}</p>
            <p className="text-sm text-gray-500">{student.profile.email}</p>
            <div className="mt-2">
              <span className={`px-2 py-1 text-xs rounded ${student.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {student.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
