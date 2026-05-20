export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { roomAllocationService } from "@/src/services/rooms/room-allocation-service";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  if (!session) {
    return apiError("Authentication required", "UNAUTHORIZED", 401);
  }

  try {
    const tenantId = params.id;
    const history = await roomAllocationService.getTenantHistory(tenantId);
    return apiResponse(history);
  } catch (error: any) {
    console.error("Detailed API Error [allocations.tenant.GET]:", error);
    return Response.json(
      {
        success: false,
        error: "Internal Server Error"
      },
      { status: 500 }
    );
  }
}
