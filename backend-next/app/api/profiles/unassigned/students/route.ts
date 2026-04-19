import { NextRequest } from "next/server";
import { getSession, apiError, apiResponse } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/profiles/unassigned/students
 * Returns student profiles that are not currently allocated to an active room.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const students = await prisma.student.findMany({
      where: {
        owner_id: session.sub,
        status: { not: "LEFT" },
        allocations: {
          none: {
            is_active: true,
            end_date: null,
          },
        },
      },
      select: {
        id: true,
        profile_id: true,
        status: true,
        profile: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    });

    const profiles = students.map((student) => ({
      id: student.profile_id,
      student_id: student.id,
      name: student.profile.name,
      email: student.profile.email,
      phone: student.profile.phone,
      status: student.status,
    }));

    return apiResponse({ profiles });
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch unassigned students");
  }
}
