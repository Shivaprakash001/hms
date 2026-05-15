export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";
import { ownerFinancialViewService } from "@/lib/services/owner-financial-view-service";
import { mapServiceError } from "@/lib/api/admin-error";

/**
 * GET /api/owner/finance/by-hostel
 *
 * Per-hostel breakdown of the owner's financial state:
 *   - lifetime_collected
 *   - lifetime_settled
 *   - pending (= collected - settled)
 *   - uncovered_credit_count   (no active item attribution yet)
 *   - in_progress_credit_count (in a PENDING/PROCESSING item)
 *
 * Used by the owner finance UI's "by hostel" section. Sorted by largest
 * pending first.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  try {
    const scope = resolveOwnerScope(session, { allowAdmin: false });
    const rows = await ownerFinancialViewService.getPendingByHostel(scope.owner_id);
    return apiResponse({ hostels: rows });
  } catch (err: any) {
    if (err?.code === "UNAUTHORIZED") return apiError(err.message, "UNAUTHORIZED", 401);
    if (err?.code === "FORBIDDEN") return apiError(err.message, "FORBIDDEN", 403);
    return mapServiceError(err);
  }
}
