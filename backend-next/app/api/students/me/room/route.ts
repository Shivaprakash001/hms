import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * 👨‍🎓 STUDENT ME ROOM
 * GET /api/students/me/room
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "STUDENT") {
    return apiError("Forbidden: Only students can access this endpoint", "FORBIDDEN", 403);
  }

  try {
    const student = await prisma.student.findUnique({
      where: { profile_id: session.sub },
      include: {
        allocations: {
          where: { is_active: true, end_date: null },
          include: { room: true }
        }
      }
    });

    if (!student) {
      return apiError("Student record not found", "NOT_FOUND", 404);
    }

    const allocation = student.allocations[0];
    if (!allocation) {
      return apiResponse({ room: null, roommates: [] });
    }

    const room = allocation.room;

    // Fetch roommates
    const occupants = await prisma.roomAllocation.findMany({
      where: {
        room_id: room.id,
        is_active: true,
        end_date: null,
        student_id: { not: student.id }
      },
      include: {
        student: { include: { profile: true } }
      }
    });

    const roommates = occupants.map(occ => ({
      name: occ.student.profile.name
    }));

    return apiResponse({
      room: {
        room_no: room.room_no,
        capacity: room.capacity,
        floor_id: room.floor
      },
      roommates
    });
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch room data");
  }
}
