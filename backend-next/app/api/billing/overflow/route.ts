export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { overflowBillingService } from "@/lib/services/overflow-billing-service";

/**
 * GET /api/billing/overflow
 * Returns current overflow status for the authenticated owner.
 * Used by the billing dashboard to show usage meters, projected charges,
 * and upgrade nudges.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "OWNER") {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const status = await overflowBillingService.getOverflowStatus(session.sub);
    return apiResponse(status);
  } catch (error: any) {
    return apiError(error.message || "Failed to fetch overflow status");
  }
}
