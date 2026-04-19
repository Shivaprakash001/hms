import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RoomCreateSchema } from "@/lib/validators";
import { propertyService } from "@/lib/services/property-service";

export const runtime = "nodejs";

/**
 * 🏠 ROOMS — List & Create
 * GET  /api/rooms/ — List rooms (grouped by floor or flat)
 * POST /api/rooms/ — Create a new room
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const { searchParams } = new URL(req.url);
    const grouped = searchParams.get("grouped") !== "false";

    if (grouped) {
      const floors = await propertyService.getFloorsWithRooms(session.sub);
      return apiResponse(floors);
    }

    // Flat list
    const rooms = await prisma.room.findMany({
      where: { hostel: { owner_id: session.sub }, is_active: true },
      orderBy: { room_no: "asc" },
    });
    return apiResponse(rooms);
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch rooms");
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json();
    const validated = RoomCreateSchema.safeParse(body);
    if (!validated.success) {
      return apiError("Validation error", "VALIDATION_ERROR", 400);
    }

    // Find the owner's hostel
    const hostel = await prisma.hostel.findFirst({
      where: { owner_id: session.sub, is_active: true },
    });
    if (!hostel) {
      return apiError("No hostel found. Please complete hostel setup first.", "NOT_FOUND", 404);
    }

    // Check for duplicate room number
    const existing = await prisma.room.findFirst({
      where: { hostel_id: hostel.id, room_no: validated.data.room_no },
    });
    if (existing) {
      return apiError(`Room ${validated.data.room_no} already exists`, "ALREADY_EXISTS", 409);
    }

    const room = await prisma.room.create({
      data: {
        hostel_id: hostel.id,
        room_no: validated.data.room_no,
        capacity: validated.data.capacity,
        floor: validated.data.floor,
        room_type: validated.data.room_type,
      },
    });

    return apiResponse(room, 201);
  } catch (error: any) {
    return apiError(error.message || "Failed to create room");
  }
}
