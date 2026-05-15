export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { apiResponse, apiError } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/admin-ctx";
import { settlementBatchService } from "@/lib/services/settlement-batch-service";
import { mapServiceError, readJson } from "@/lib/api/admin-error";

/**
 * POST /api/admin/settlements/batches/:batchId/cancel
 * Body: { reason: string }
 *
 * Cancels a DRAFT/APPROVED/PROCESSING batch. Rejected if any item is
 * SUCCESS — real money has moved and must be reversed via a future
 * ADJUSTMENT_DEBIT compensating entry, not by un-doing.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const ctx = await requireAdmin(req);
  if (!ctx) return apiError("Admin access required", "FORBIDDEN", 403);
  const { batchId } = await params;
  const body = await readJson<{ reason?: string }>(req);
  if (!body.reason) return apiError("reason is required", "BAD_REQUEST", 400);

  try {
    const batch = await settlementBatchService.cancelBatch(ctx, batchId, body.reason);
    return apiResponse({ batch });
  } catch (err: any) {
    return mapServiceError(err);
  }
}
