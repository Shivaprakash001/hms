import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  try {
    const profile = await prisma.profile.findUnique({
      where: { id: session.sub },
      include: {
        student_details: {
          include: {
            allocations: {
              where: { is_active: true },
              include: { room: true }
            }
          }
        }
      }
    });

    if (!profile) return apiError("User not found", "NOT_FOUND", 404);

    const extra: any = {};
    if (profile.student_details) {
      extra.monthly_rent = profile.student_details.monthly_rent;
      extra.student_status = profile.student_details.status;
      extra.is_profile_completed = profile.student_details.profile_completed || profile.is_profile_completed;
      
      const activeAlloc = profile.student_details.allocations[0];
      if (activeAlloc) {
        extra.room_id = activeAlloc.room_id;
        extra.room_no = activeAlloc.room.room_no;
        extra.room_capacity = activeAlloc.room.capacity;
      }
    } else {
      extra.is_profile_completed = profile.is_profile_completed;
    }

    return apiResponse({
      user_id: profile.id,
      email: profile.email,
      role: profile.role,
      student_id: profile.student_details?.id || null,
      is_admin: profile.role === "ADMIN",
      is_owner: profile.role === "OWNER",
      is_student: profile.role === "STUDENT",
      ...extra
    });
  } catch (error) {
    return apiError("Internal server error");
  }
}
