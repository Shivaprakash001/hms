export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { moveOutService } from "@/lib/services/move-out-service";

/**
 * POST /api/move-out/requests/[id]/vacate — Vacate bed and release room allocation
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const result = await moveOutService.vacate(params.id, session.sub, body.physicalExitDate);
    return apiResponse(result);
  } catch (error: any) {
    const msg = error.message || "Failed to vacate bed";
    if (msg.startsWith("VALIDATION:")) return apiError(msg, "VALIDATION_ERROR", 400);
    if (msg.startsWith("NOT_FOUND:")) return apiError(msg, "NOT_FOUND", 404);
    return apiError(msg);
  }
}
