export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { propertyService } from "@/lib/services/property-service";


/**
 * 🏠 ROOM OVERVIEW — Get
 * GET /api/rooms/[id]/overview
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
    const overview = await propertyService.getRoomOverview(params.id, session.sub);
    return apiResponse(overview);
  } catch (error: any) {
    const msg = typeof error === 'string' ? error : error?.message ?? String(error);
    if (msg.startsWith("NOT_FOUND"))
      return apiError(msg.split(": ")[1] ?? msg, "NOT_FOUND", 404);
    return apiError(msg || "Failed to fetch room overview");
  }
}
