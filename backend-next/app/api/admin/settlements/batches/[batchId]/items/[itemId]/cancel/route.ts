export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { apiResponse, apiError } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/admin-ctx";
import { settlementBatchService } from "@/lib/services/settlement-batch-service";
import { mapServiceError, readJson } from "@/lib/api/admin-error";

/**
 * POST /api/admin/settlements/batches/:batchId/items/:itemId/cancel
 * Body: { reason: string }
 *
 * Cancels a PENDING item in a DRAFT batch. Sets payout_status=CANCELLED
 * which releases coverage of its credits for future batches. Does NOT
 * write a ledger entry (no money has moved).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const ctx = await requireAdmin(req);
  if (!ctx) return apiError("Admin access required", "FORBIDDEN", 403);
  const { itemId } = await params;
  const body = await readJson<{ reason?: string }>(req);
  if (!body.reason) return apiError("reason is required", "BAD_REQUEST", 400);

  try {
    const item = await settlementBatchService.cancelItem(ctx, itemId, body.reason);
    return apiResponse({ item });
  } catch (err: any) {
    return mapServiceError(err);
  }
}
