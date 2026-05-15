export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { apiResponse, apiError } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/admin-ctx";
import { settlementBatchService } from "@/lib/services/settlement-batch-service";
import { mapServiceError, readJson } from "@/lib/api/admin-error";

/**
 * POST /api/admin/settlements/batches/:batchId/items
 * Body: {
 *   ownerId: string,
 *   hostelId: string,
 *   requestedAmountPaise?: number | null,    // exact-match FIFO subset; null = all eligible
 *   payoutMethod?: "NEFT" | "IMPS" | "UPI" | "RTGS" | "CHEQUE" | "OTHER"
 * }
 *
 * Adds a payout item to a DRAFT batch by attributing eligible CREDIT
 * rows from the canonical ledger.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const ctx = await requireAdmin(req);
  if (!ctx) return apiError("Admin access required", "FORBIDDEN", 403);
  const { batchId } = await params;
  const body = await readJson<{
    ownerId?: string;
    hostelId?: string;
    requestedAmountPaise?: number | null;
    payoutMethod?: any;
  }>(req);

  if (!body.ownerId || !body.hostelId) {
    return apiError("ownerId and hostelId are required", "BAD_REQUEST", 400);
  }

  try {
    const result = await settlementBatchService.addItem(ctx, {
      batchId,
      ownerId: body.ownerId,
      hostelId: body.hostelId,
      requestedAmountPaise: body.requestedAmountPaise ?? null,
      payoutMethod: body.payoutMethod,
    });
    return apiResponse(result, result.alreadyExisted ? 200 : 201);
  } catch (err: any) {
    return mapServiceError(err);
  }
}
