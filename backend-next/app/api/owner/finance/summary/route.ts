export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";
import { ownerFinancialViewService } from "@/lib/services/owner-financial-view-service";
import { mapServiceError } from "@/lib/api/admin-error";

/**
 * GET /api/owner/finance/summary?windowDays=30
 *
 * Returns the four owner-facing financial buckets:
 *   - total_collected      (lifetime CREDITs)
 *   - pending_settlement   (lifetime CREDIT - lifetime DEBIT_PAYOUT)
 *   - settled_payouts      (lifetime DEBIT_PAYOUT)
 *   - recent_transfers     (DEBIT_PAYOUT in last `windowDays`)
 *
 * Owner-scoped — caller can only see their own data. Admin role is NOT
 * accepted here (treasury surface lives at /api/admin/...).
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  try {
    const scope = resolveOwnerScope(session, { allowAdmin: false });
    const { searchParams } = new URL(req.url);
    const windowDays = Math.min(Math.max(Number(searchParams.get("windowDays") || 30), 1), 365);
    const summary = await ownerFinancialViewService.getOwnerSummary(scope.owner_id, windowDays);
    return apiResponse({ summary });
  } catch (err: any) {
    if (err?.code === "UNAUTHORIZED") return apiError(err.message, "UNAUTHORIZED", 401);
    if (err?.code === "FORBIDDEN") return apiError(err.message, "FORBIDDEN", 403);
    return mapServiceError(err);
  }
}
