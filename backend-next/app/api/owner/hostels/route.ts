export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * 🏨 GET /api/owner/hostels
 *
 * Returns all hostels belonging to the authenticated owner.
 * Used by the frontend hostel switcher to select operational context.
 *
 * Response includes summary stats (room count, tenant count) for each hostel.
 * Access: Owner/Admin only
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const hostels = await prisma.hostel.findMany({
      where: { owner_id: session.sub, is_active: true },
      orderBy: { created_at: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        upi_id: true,
        is_active: true,
        created_at: true,
        rooms: {
          where: { is_active: true },
          select: {
            id: true,
            capacity: true,
            allocations: {
              where: { is_active: true, end_date: null },
              select: { id: true },
            },
          },
        },
      },
    });

    const result = hostels.map((hostel) => {
      const totalRooms = hostel.rooms.length;
      const totalCapacity = hostel.rooms.reduce((s, r) => s + r.capacity, 0);
      const occupiedBeds = hostel.rooms.reduce((s, r) => s + r.allocations.length, 0);
      const vacantBeds = Math.max(totalCapacity - occupiedBeds, 0);
      const occupancyRate = totalCapacity > 0 ? Math.round((occupiedBeds / totalCapacity) * 100) : 0;

      return {
        id: hostel.id,
        name: hostel.name,
        phone: hostel.phone,
        address: hostel.address,
        city: hostel.city,
        state: hostel.state,
        pincode: hostel.pincode,
        upi_id: hostel.upi_id,
        is_active: hostel.is_active,
        created_at: hostel.created_at,
        stats: {
          total_rooms: totalRooms,
          total_capacity: totalCapacity,
          occupied_beds: occupiedBeds,
          vacant_beds: vacantBeds,
          occupancy_rate: occupancyRate,
        },
      };
    });

    return apiResponse({
      hostels: result,
      total_hostels: result.length,
      is_multi_hostel: result.length > 1,
    });
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch hostels");
  }
}
