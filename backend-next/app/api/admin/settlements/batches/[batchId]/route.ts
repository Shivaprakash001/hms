export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { apiResponse, apiError } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/admin-ctx";
import { settlementBatchService } from "@/lib/services/settlement-batch-service";

/**
 * GET /api/admin/settlements/batches/:batchId
 * Returns the batch with all its items (ordered by created_at asc).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const ctx = await requireAdmin(req);
  if (!ctx) return apiError("Admin access required", "FORBIDDEN", 403);

  const { batchId } = await params;
  try {
    const batch = await settlementBatchService.getBatch(batchId);
    if (!batch) return apiError("batch not found", "NOT_FOUND", 404);
    return apiResponse({ batch });
  } catch (err: any) {
    return apiError(err?.message || "get batch failed");
  }
}
