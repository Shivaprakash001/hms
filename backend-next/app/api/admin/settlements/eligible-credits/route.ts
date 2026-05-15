export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { apiResponse, apiError } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/admin-ctx";
import { settlementBatchService } from "@/lib/services/settlement-batch-service";
import { mapServiceError } from "@/lib/api/admin-error";

/**
 * GET /api/admin/settlements/eligible-credits?ownerId=...&hostelId=...&limit=...
 * Returns the FIFO-ordered list of CREDIT rows that are NOT yet covered
 * by any active batch item. Used by the "create payout item" UI to
 * preview what will be paid out.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!ctx) return apiError("Admin access required", "FORBIDDEN", 403);

  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("ownerId");
  const hostelId = searchParams.get("hostelId");
  if (!ownerId || !hostelId) return apiError("ownerId and hostelId required", "BAD_REQUEST", 400);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 500), 1), 5000);

  try {
    const credits = await settlementBatchService.listEligibleCreditsForOwnerHostel(ownerId, hostelId, limit);
    return apiResponse({ credits });
  } catch (err: any) {
    return mapServiceError(err);
  }
}
