export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import crypto from "crypto";
import { getSession } from "@/lib/auth";
import { RoomCreateSchema } from "@/lib/validators";
import { ApiResponse } from "@/src/lib/api-response";
import { ApiError } from "@/src/lib/api-error";
import { roomRepository } from "@/src/repositories/roomRepository";
import { propertyService } from "@/lib/services/property-service";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";
import { assertHostelBelongsToOwner, requireHostelBelongsToOwner, scopedRoomWhere } from "@/lib/security/scoped-query";


/**
 * 🏠 ROOMS — List & Create
 * GET  /api/rooms/ — List rooms (grouped by floor or flat)
 * POST /api/rooms/ — Create a new room
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    console.warn(`[rooms.GET] Forbidden access attempt by ${session?.role} ${session?.sub}`);
    return ApiResponse.error(ApiError.forbidden("Forbidden"));
  }

  try {
    const scope = resolveOwnerScope(session);
    const { searchParams } = new URL(req.url);
    const grouped = searchParams.get("grouped") !== "false";
    const hostelId = searchParams.get("hostelId") || undefined;
    
    console.log(`[rooms.GET] Fetching rooms for owner ${scope.owner_id}, hostel ${hostelId}, grouped=${grouped}`);
    
    await requireHostelBelongsToOwner(scope.owner_id, hostelId);
    if (!hostelId) {
      console.warn("[rooms.GET] Missing hostelId context");
      return ApiResponse.error(ApiError.badRequest("hostelId is required"));
    }

    if (grouped) {
      const floors = await propertyService.getFloorsWithRooms(scope.owner_id, hostelId);
      return ApiResponse.success(floors);
    }

    // Flat list
    const rooms = await roomRepository.findMany({
      where: scopedRoomWhere({ owner_id: scope.owner_id, hostel_id: hostelId }, { is_active: true }),
      orderBy: { room_no: "asc" },
    });
    
    return ApiResponse.success(rooms);
  } catch (error: any) {
    console.error("Detailed API Error [rooms.GET]:", error);
    return ApiResponse.error(error);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    console.warn(`[rooms.POST] Forbidden access attempt by ${session?.role} ${session?.sub}`);
    return ApiResponse.error(ApiError.forbidden("Forbidden"));
  }

  try {
    const scope = resolveOwnerScope(session);
    const body = await req.json().catch(() => ({}));
    console.log(`[rooms.POST] Creating room for owner ${scope.owner_id}`, body);
    
    const validated = RoomCreateSchema.safeParse(body);
    if (!validated.success) {
      console.warn(`[rooms.POST] Validation failed for owner ${scope.owner_id}`);
      return ApiResponse.error(ApiError.validationError("Validation error", { issues: validated.error.errors }));
    }

    let hostelId = body.hostelId;
    let hostel;
    if (hostelId) {
      hostel = await assertHostelBelongsToOwner(scope.owner_id, hostelId);
    } else {
      await requireHostelBelongsToOwner(scope.owner_id, hostelId);
    }
    
    if (!hostel) {
      console.warn(`[rooms.POST] Hostel context missing for owner ${scope.owner_id}`);
      return ApiResponse.error(ApiError.notFound("No hostel found. Please complete hostel setup first."));
    }

    // Check for duplicate room number
    const existing = await roomRepository.findFirst({
      where: { hostel_id: hostel.id, room_no: validated.data.room_no, is_active: true },
    });
    
    if (existing) {
      console.warn(`[rooms.POST] Room ${validated.data.room_no} already exists in hostel ${hostel.id}`);
      return ApiResponse.error(ApiError.conflict(`Room ${validated.data.room_no} already exists`));
    }

    const room = await roomRepository.create({
      data: {
        id: crypto.randomUUID(),
        hostel_id: hostel.id,
        room_no: validated.data.room_no,
        capacity: validated.data.capacity,
        floor: validated.data.floor,
        room_type: validated.data.room_type,
        base_rent: validated.data.base_rent,
      },
    });

    console.log(`[rooms.POST] Room created: ${room.id}`);
    return ApiResponse.success(room, "Room created successfully", { status: 201 });
  } catch (error: any) {
    console.error("Detailed API Error [rooms.POST]:", error);
    return ApiResponse.error(error);
  }
}
