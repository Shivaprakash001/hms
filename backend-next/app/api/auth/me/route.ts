export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";


export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  try {
    const profile = await prisma.profile.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        email: true,
        role: true,
        is_profile_completed: true
      }
    });

    if (!profile) return apiError("User not found", "NOT_FOUND", 404);

    const extra: any = {};
    let studentId: string | null = null;

    if (profile.role === "STUDENT") {
      const student = await prisma.student.findUnique({
        where: { profile_id: profile.id },
        select: {
          id: true,
          monthly_rent: true,
          status: true,
          profile_completed: true,
          allocations: {
            where: { is_active: true },
            orderBy: { created_at: "desc" },
            take: 1,
            select: {
              room_id: true,
              room: {
                select: {
                  room_no: true,
                  capacity: true
                }
              }
            }
          }
        }
      });

      if (student) {
      studentId = student.id;
      extra.monthly_rent = student.monthly_rent;
      extra.student_status = student.status;
      extra.is_profile_completed = student.profile_completed || profile.is_profile_completed;

      const activeAlloc = student.allocations[0];
      if (activeAlloc) {
        extra.room_id = activeAlloc.room_id;
        extra.room_no = activeAlloc.room.room_no;
        extra.room_capacity = activeAlloc.room.capacity;
      }
      }
    } else {
      extra.is_profile_completed = profile.is_profile_completed;
    }

    return apiResponse({
      user_id: profile.id,
      email: profile.email,
      role: profile.role,
      student_id: studentId,
      is_admin: profile.role === "ADMIN",
      is_owner: profile.role === "OWNER",
      is_student: profile.role === "STUDENT",
      ...extra
    });
  } catch (error) {
    return apiError("Internal server error");
  }
}
