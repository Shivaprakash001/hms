export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import crypto from "crypto";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RoomCreateSchema } from "@/lib/validators";
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
    return apiError("Forbidden", "FORBIDDEN", 403);
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
      return apiError("hostelId is required", "HOSTEL_CONTEXT_REQUIRED", 400);
    }

    if (grouped) {
      const floors = await propertyService.getFloorsWithRooms(scope.owner_id, hostelId);
      return apiResponse({
        success: true,
        data: floors
      });
    }

    // Flat list
    const rooms = await prisma.rooms.findMany({
      where: scopedRoomWhere({ owner_id: scope.owner_id, hostel_id: hostelId }, { is_active: true }),
      orderBy: { room_no: "asc" },
    });
    
    return apiResponse({
      success: true,
      data: rooms
    });
  } catch (error: any) {
    console.error("Detailed API Error [rooms.GET]:", error);
    return Response.json(
      {
        success: false,
        error: "Internal Server Error"
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    console.warn(`[rooms.POST] Forbidden access attempt by ${session?.role} ${session?.sub}`);
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const scope = resolveOwnerScope(session);
    const body = await req.json().catch(() => ({}));
    console.log(`[rooms.POST] Creating room for owner ${scope.owner_id}`, body);
    
    const validated = RoomCreateSchema.safeParse(body);
    if (!validated.success) {
      console.warn(`[rooms.POST] Validation failed for owner ${scope.owner_id}`);
      return apiError("Validation error", "VALIDATION_ERROR", 400);
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
      return apiError("No hostel found. Please complete hostel setup first.", "NOT_FOUND", 404);
    }

    // Check for duplicate room number
    const existing = await prisma.rooms.findFirst({
      where: { hostel_id: hostel.id, room_no: validated.data.room_no, is_active: true },
    });
    
    if (existing) {
      console.warn(`[rooms.POST] Room ${validated.data.room_no} already exists in hostel ${hostel.id}`);
      return apiError(`Room ${validated.data.room_no} already exists`, "ALREADY_EXISTS", 409);
    }

    const room = await prisma.rooms.create({
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
    return apiResponse({
      success: true,
      data: room
    }, 201);
  } catch (error: any) {
    console.error("Detailed API Error [rooms.POST]:", error);
    return Response.json(
      {
        success: false,
        error: "Internal Server Error"
      },
      { status: 500 }
    );
  }
}
