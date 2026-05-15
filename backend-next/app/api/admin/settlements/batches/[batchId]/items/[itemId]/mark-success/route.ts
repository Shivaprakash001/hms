export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { apiResponse, apiError } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/admin-ctx";
import { settlementBatchService } from "@/lib/services/settlement-batch-service";
import { mapServiceError, readJson } from "@/lib/api/admin-error";

/**
 * POST /api/admin/settlements/batches/:batchId/items/:itemId/mark-success
 * Body: { payoutReference: string, payoutMethod?: string, notes?: string }
 *
 * Marks a payout SUCCESS. Atomically writes the DEBIT_PAYOUT ledger row
 * and links it to the item. Idempotent: re-calling on a SUCCESS item
 * returns the existing state without side-effects.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const ctx = await requireAdmin(req);
  if (!ctx) return apiError("Admin access required", "FORBIDDEN", 403);
  const { itemId } = await params;
  const body = await readJson<{ payoutReference?: string; payoutMethod?: any; notes?: string }>(req);
  if (!body.payoutReference) return apiError("payoutReference is required", "BAD_REQUEST", 400);

  try {
    const result = await settlementBatchService.markItemSuccess(ctx, {
      itemId,
      payoutReference: body.payoutReference,
      payoutMethod: body.payoutMethod,
      notes: body.notes,
    });
    return apiResponse(result);
  } catch (err: any) {
    return mapServiceError(err);
  }
}
