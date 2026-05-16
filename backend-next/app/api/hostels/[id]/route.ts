export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";
import { prisma } from "@/lib/db";
import { eventLog } from "@/lib/services/event-log-service";

const HOSTEL_FIELDS = ["name", "phone", "address", "city", "state", "pincode", "upi_id", "gst_number"];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  if (!session) {
    console.warn("[hostels.id.PATCH] Unauthorized access attempt");
    return apiError("Unauthorized", "UNAUTHORIZED", 401);
  }

  try {
    const scope = resolveOwnerScope(session);
    const body = await req.json().catch(() => ({}));
    
    console.log(`[hostels.id.PATCH] Updating hostel ${params.id} for owner ${scope.owner_id}`, body);
    
    const data: Record<string, any> = {};
    for (const key of HOSTEL_FIELDS) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    if (body.hostel_name !== undefined) data.name = body.hostel_name;
    if (body.hostel_phone !== undefined) data.phone = body.hostel_phone;
    
    if (Object.keys(data).length === 0) {
      console.warn("[hostels.id.PATCH] No valid fields to update", body);
      return apiError("No valid hostel fields to update", "VALIDATION_ERROR", 400);
    }

    const updated = await prisma.hostels.updateMany({
      where: { id: params.id, owner_id: scope.owner_id, is_active: true },
      data,
    });
    
    if (updated.count !== 1) {
      console.warn(`[hostels.id.PATCH] Hostel ${params.id} not found or not owned by ${scope.owner_id}`);
      return apiError("Hostel is not owned by the authenticated owner", "FORBIDDEN", 403);
    }

    const hostel = await prisma.hostels.findFirst({
      where: { id: params.id, owner_id: scope.owner_id, is_active: true },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        upi_id: true,
        gst_number: true,
        logo_url: true,
      },
    });

    await eventLog.log("HOSTEL_SETTINGS_UPDATED", scope.owner_id, {
      hostel_id: params.id,
      changed_fields: Object.keys(data),
    });

    console.log(`[hostels.id.PATCH] Hostel ${params.id} updated successfully`);
    return apiResponse({
      success: true,
      hostel
    });
  } catch (error: any) {
    console.error(`Detailed API Error [hostels.id.PATCH] (${params.id}):`, error);
    const msg = String(error?.message || "Failed to update hostel");
    
    if (msg.startsWith("FORBIDDEN")) return apiError(msg.split(":")[1]?.trim() || msg, "FORBIDDEN", 403);
    if (msg.startsWith("VALIDATION")) return apiError(msg.split(":")[1]?.trim() || msg, "VALIDATION_ERROR", 400);
    
    return Response.json(
      {
        success: false,
        error: "Internal Server Error"
      },
      { status: 500 }
    );
  }
}
