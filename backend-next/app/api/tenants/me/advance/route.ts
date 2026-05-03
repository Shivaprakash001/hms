export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { tenantAdvanceService } from "@/lib/services/tenant-advance-service";

/**
 * GET /api/tenants/me/advance
 * Returns current advance balance + full ledger history for the authenticated tenant.
 *
 * Auth: TENANT only — derives tenant record from JWT sub (profile_id).
 * A tenant can ONLY see their own balance. No cross-tenant access possible.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);
  if (session.role !== "TENANT") return apiError("Forbidden — tenant access only", "FORBIDDEN", 403);

  try {
    const result = await tenantAdvanceService.getBalanceForTenant(session.sub);
    return apiResponse(result);
  } catch (error: any) {
    const msg = String(error?.message ?? error);
    if (msg.includes("NOT_FOUND")) return apiError(msg, "NOT_FOUND", 404);
    return apiError(msg, "INTERNAL_ERROR", 500);
  }
}
