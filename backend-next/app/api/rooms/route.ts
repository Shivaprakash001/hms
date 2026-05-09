export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RoomCreateSchema } from "@/lib/validators";
import { propertyService } from "@/lib/services/property-service";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";
import { assertHostelBelongsToOwner, scopedRoomWhere } from "@/lib/security/scoped-query";
import { eventLog } from "@/lib/services/event-log-service";


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
    const scope = resolveOwnerScope(session);
    const { searchParams } = new URL(req.url);
    const grouped = searchParams.get("grouped") !== "false";
    const hostelId = searchParams.get("hostelId") || undefined; // Phase 4: hostel isolation
    await assertHostelBelongsToOwner(scope.owner_id, hostelId);

    if (grouped) {
      const floors = await propertyService.getFloorsWithRooms(scope.owner_id, hostelId);
      return apiResponse(floors);
    }

    // Flat list
    const rooms = await prisma.room.findMany({
      where: scopedRoomWhere({ owner_id: scope.owner_id, hostel_id: hostelId }, { is_active: true }),
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
    const scope = resolveOwnerScope(session);
    const body = await req.json();
    const validated = RoomCreateSchema.safeParse(body);
    if (!validated.success) {
      return apiError("Validation error", "VALIDATION_ERROR", 400);
    }

    // Phase 2: accept explicit hostelId from frontend; fallback remains owner-scoped.
    let hostelId = body.hostelId;
    let hostel;
    if (hostelId) {
      hostel = await assertHostelBelongsToOwner(scope.owner_id, hostelId);
    } else {
      hostel = await prisma.hostel.findFirst({
        where: { owner_id: scope.owner_id, is_active: true },
        orderBy: { created_at: "asc" },
      });

      if (!hostel) {
        const existingHostelCount = await prisma.hostel.count({
          where: { owner_id: scope.owner_id },
        });

        // Onboarding allows users to skip hostel details. Creating the first
        // room still needs a deterministic owner-owned hostel boundary, so we
        // create a minimal placeholder only when this owner has no hostel rows
        // at all. We never borrow or infer a hostel from another owner.
        if (existingHostelCount === 0) {
          hostel = await prisma.hostel.create({
            data: {
              owner_id: scope.owner_id,
              name: "My Hostel",
              phone: "",
              address: "",
              is_active: true,
            },
          });

          await eventLog.log("DEFAULT_HOSTEL_CREATED_FOR_ROOM_ONBOARDING", scope.owner_id, {
            hostel_id: hostel.id,
            reason: "ROOM_CREATION_WITHOUT_EXISTING_HOSTEL",
          });
        }
      }
    }
    if (!hostel) {
      return apiError("No hostel found. Please complete hostel setup first.", "NOT_FOUND", 404);
    }

    // Check for duplicate room number
    const existing = await prisma.room.findFirst({
      where: { hostel_id: hostel.id, room_no: validated.data.room_no, is_active: true },
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
