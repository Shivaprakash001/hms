export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";
import { ownerFinancialViewService } from "@/lib/services/owner-financial-view-service";
import { mapServiceError } from "@/lib/api/admin-error";

/**
 * GET /api/owner/finance/transfers
 *   ?hostelId=…&limit=50&cursorCreatedAt=ISO&cursorId=…
 *
 * Lists the owner's settled transfers (DEBIT_PAYOUT entries). Each row
 * exposes the bank reference (UTR/NEFT/etc.) — that's the owner's
 * authoritative settlement proof.
 *
 * HMS-internal fields (settlement_batch_id, batch_number, admin ids) are
 * never returned. Strictly owner-scoped.
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

    const transfers = await ownerFinancialViewService.listOwnerTransfers({
      ownerId: scope.owner_id,
      hostelId,
      limit,
      cursorCreatedAt,
      cursorId,
    });
    const last = transfers[transfers.length - 1];
    return apiResponse({
      transfers,
      next_cursor: transfers.length === limit && last
        ? { cursorCreatedAt: last.transferred_at, cursorId: last.id }
        : null,
    });
  } catch (err: any) {
    if (err?.code === "UNAUTHORIZED") return apiError(err.message, "UNAUTHORIZED", 401);
    if (err?.code === "FORBIDDEN") return apiError(err.message, "FORBIDDEN", 403);
    return mapServiceError(err);
  }
}
