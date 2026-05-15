export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { apiResponse, apiError } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/admin-ctx";
import { settlementBatchService } from "@/lib/services/settlement-batch-service";
import { mapServiceError, readJson } from "@/lib/api/admin-error";

/**
 * POST /api/admin/settlements/batches/:batchId/items/:itemId/mark-failed
 * Body: { reason: string }
 *
 * Marks a payout FAILED. NO debit is written (no money moved). The
 * covered credits become eligible for the next batch automatically.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const ctx = await requireAdmin(req);
  if (!ctx) return apiError("Admin access required", "FORBIDDEN", 403);
  const { itemId } = await params;
  const body = await readJson<{ reason?: string }>(req);
  if (!body.reason) return apiError("reason is required", "BAD_REQUEST", 400);

  try {
    const result = await settlementBatchService.markItemFailed(ctx, { itemId, reason: body.reason });
    return apiResponse(result);
  } catch (err: any) {
    return mapServiceError(err);
  }
}
