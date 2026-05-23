export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import crypto from "crypto";
import { getSession } from "@/lib/auth";
import { RoomCreateSchema } from "@/lib/validators";
import { ApiResponse } from "@/src/lib/api-response";
import { ApiError } from "@/src/lib/api-error";
import { roomRepository } from "@/src/repositories/roomRepository";
import { prisma } from "@/lib/db";
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
    const grouped = searchParams.get("grouped") === "true";
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

    // Flat list — includes active allocations so the UI can derive occupancy from source of truth
    const rawRooms = await prisma.rooms.findMany({
      where: {
        hostel_id: hostelId,
        hostels: { owner_id: scope.owner_id },
        is_active: true,
      },
      include: {
        floor_ref: { select: { id: true, name: true, sort_order: true } },
        room_allocations: {
          where: { is_active: true, end_date: null },
          include: {
            tenant: {
              select: {
                id: true,
                monthly_rent: true,
                profiles: { select: { name: true, phone: true } },
              },
            },
          },
        },
      },
      orderBy: { room_no: "asc" },
    });

    const rooms = rawRooms.map((room: any) => {
      const allocs = room.room_allocations ?? [];
      const occupiedCount = allocs.length;
      const firstTenant = allocs[0]?.tenant ?? null;
      const tenants = allocs.map((allocation: any) => ({
        allocation_id: allocation.id,
        tenant_id: allocation.tenant?.id ?? null,
        name: allocation.tenant?.profiles?.name ?? null,
        phone: allocation.tenant?.profiles?.phone ?? null,
        monthly_rent: Number(allocation.tenant?.monthly_rent ?? room.base_rent ?? 0),
        joined_date: allocation.start_date,
      }));
      const derivedStatus = occupiedCount === 0 ? "vacant" : "occupied";
      return {
        id: room.id,
        room_no: room.room_no,
        room_number: room.room_no,
        capacity: room.capacity,
        floor: room.floor,
        floor_id: room.floor_id ?? null,
        floor_name: room.floor_ref?.name ?? null,
        floor_sort_order: room.floor_ref?.sort_order ?? 999,
        base_rent: room.base_rent,
        monthly_rent: room.base_rent,
        rent: room.base_rent,
        wifi_name: room.wifi_name ?? null,
        notes: room.notes ?? null,
        hostel_id: room.hostel_id,
        is_active: room.is_active,
        status: derivedStatus,
        occupied_count: occupiedCount,
        vacant_count: Math.max(0, room.capacity - occupiedCount),
        tenants,
        tenant_name: firstTenant?.profiles?.name ?? null,
        tenant_id: firstTenant?.id ?? null,
        tenant_phone: firstTenant?.profiles?.phone ?? null,
        tenant_rent: firstTenant ? Number(firstTenant.monthly_rent ?? room.base_rent) : null,
      };
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
        floor_id: validated.data.floor_id,
        room_type: validated.data.room_type,
        base_rent: validated.data.base_rent,
        wifi_name: validated.data.wifi_name,
        wifi_password: validated.data.wifi_password,
        notes: validated.data.notes,
      },
    });

    console.log(`[rooms.POST] Room created: ${room.id}`);
    return ApiResponse.success(room, "Room created successfully", { status: 201 });
  } catch (error: any) {
    console.error("Detailed API Error [rooms.POST]:", error);
    return ApiResponse.error(error);
  }
}
