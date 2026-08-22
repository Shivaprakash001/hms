export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";
import { renewalPipelineReadModelService } from "@/src/services/tenants/renewal-pipeline-read-model";

/**
 * 🔭 UNIFIED RENEWAL PIPELINE
 * GET /api/agreements/renewal-pipeline?hostelId=&stage=
 *
 * One row per agreement with a single lifecycle `stage`, backing the merged
 * owner renewal screen. Composes the expiry queue and the offer list — see
 * `renewal-pipeline-read-model.ts` for why neither alone is sufficient.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const hostelId = req.nextUrl.searchParams.get("hostelId");
    if (!hostelId) return apiError("hostelId is required", "BAD_REQUEST", 400);

    const stage = req.nextUrl.searchParams.get("stage") || undefined;
    const ownerId = session.role === "OWNER" ? resolveOwnerScope(session).owner_id : session.sub;

    const pipeline = await renewalPipelineReadModelService.getPipeline(ownerId, hostelId, { stage });
    return apiResponse(pipeline);
  } catch (error: any) {
    if (error.message?.startsWith("NOT_FOUND")) return apiError(error.message.split(": ")[1], "NOT_FOUND", 404);
    if (error.message?.startsWith("FORBIDDEN")) return apiError(error.message.split(": ")[1], "FORBIDDEN", 403);
    if (error.message?.startsWith("BAD_REQUEST")) return apiError(error.message.split(": ")[1], "BAD_REQUEST", 400);
    return apiError(error.message || "Failed to fetch renewal pipeline");
  }
}
