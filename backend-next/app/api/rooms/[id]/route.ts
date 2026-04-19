import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * 🏠 ROOM BY ID — Get, Update, Delete
 * GET    /api/rooms/[id]
 * PUT    /api/rooms/[id]
 * DELETE /api/rooms/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const room = await prisma.room.findFirst({
      where: { id: params.id, hostel: { owner_id: session.sub } },
    });

    if (!room) return apiError("Room not found", "NOT_FOUND", 404);
    return apiResponse(room);
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch room");
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json();

    // Verify ownership
    const existing = await prisma.room.findFirst({
      where: { id: params.id, hostel: { owner_id: session.sub } },
    });
    if (!existing) return apiError("Room not found", "NOT_FOUND", 404);

    const updateData: any = {};
    if (body.room_no !== undefined) updateData.room_no = body.room_no;
    if (body.capacity !== undefined) updateData.capacity = body.capacity;
    if (body.floor !== undefined) updateData.floor = body.floor;
    if (body.room_type !== undefined) updateData.room_type = body.room_type;

    const room = await prisma.room.update({
      where: { id: params.id },
      data: updateData,
    });

    return apiResponse(room);
  } catch (error: any) {
    return apiError(error.message || "Failed to update room");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    // Verify ownership
    const existing = await prisma.room.findFirst({
      where: { id: params.id, hostel: { owner_id: session.sub } },
    });
    if (!existing) return apiError("Room not found", "NOT_FOUND", 404);

    // Check for active allocations
    const activeAllocations = await prisma.roomAllocation.count({
      where: { room_id: params.id, is_active: true, end_date: null },
    });
    if (activeAllocations > 0) {
      return apiError("Cannot delete room with active tenants", "VALIDATION_ERROR", 400);
    }

    await prisma.room.delete({ where: { id: params.id } });
    return apiResponse(null, 204);
  } catch (error: any) {
    return apiError(error.message || "Failed to delete room");
  }
}
