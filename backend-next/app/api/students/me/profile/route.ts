export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";


/**
 * 👨‍🎓 STUDENT ME PROFILE
 * GET /api/students/me/profile
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "STUDENT") {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const profile = await prisma.profile.findUnique({
      where: { id: session.sub },
      include: {
        student_details: {
          include: {
            allocations: {
              where: { is_active: true, end_date: null },
              include: { room: true }
            }
          }
        }
      }
    });

    if (!profile || !profile.student_details) {
      return apiError("Student profile not found", "NOT_FOUND", 404);
    }

    const student = profile.student_details;
    const allocation = student.allocations[0];

    return apiResponse({
      ...profile,
      student_details: student,
      room_no: allocation?.room?.room_no || null,
      status: student.status
    });
  } catch (error: any) {
    return apiError(error?.message || "Failed to fetch student profile");
  }
}
