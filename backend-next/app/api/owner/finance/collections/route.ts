export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";
import { ownerFinancialViewService } from "@/lib/services/owner-financial-view-service";
import { mapServiceError } from "@/lib/api/admin-error";

/**
 * GET /api/owner/finance/collections
 *   ?hostelId=...                    (optional filter to one hostel)
 *   &limit=50                        (1..200)
 *   &cursorCreatedAt=ISO&cursorId=…  (pagination — pass last row's values)
 *
 * Lists the owner's collected payments (CREDIT entries) annotated with
 * an owner-friendly settlement status:
 *   PENDING_SETTLEMENT | TRANSFER_IN_PROGRESS | SETTLED | SETTLEMENT_DELAYED
 *
 * Internal fields (covered_credit_ids, batch ids, admin actor ids) are
 * never returned. Strictly owner-scoped via the session.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  try {
    const scope = resolveOwnerScope(session, { allowAdmin: false });
    const { searchParams } = new URL(req.url);
    const hostelId = searchParams.get("hostelId") ?? undefined;
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);
    const cursorCreatedAt = searchParams.get("cursorCreatedAt");
    const cursorId = searchParams.get("cursorId");

    const collections = await ownerFinancialViewService.listOwnerCollections({
      ownerId: scope.owner_id,
      hostelId,
      limit,
      cursorCreatedAt,
      cursorId,
    });
    const last = collections[collections.length - 1];
    return apiResponse({
      collections,
      next_cursor: collections.length === limit && last
        ? { cursorCreatedAt: last.collected_at, cursorId: last.id }
        : null,
    });
  } catch (err: any) {
    if (err?.code === "UNAUTHORIZED") return apiError(err.message, "UNAUTHORIZED", 401);
    if (err?.code === "FORBIDDEN") return apiError(err.message, "FORBIDDEN", 403);
    return mapServiceError(err);
  }
}
