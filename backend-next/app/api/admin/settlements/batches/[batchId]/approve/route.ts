export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { apiResponse, apiError } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/admin-ctx";
import { settlementBatchService } from "@/lib/services/settlement-batch-service";
import { mapServiceError } from "@/lib/api/admin-error";

/**
 * POST /api/admin/settlements/batches/:batchId/approve
 * DRAFT -> APPROVED. Locks the batch from item add/cancel. Requires at
 * least one live item.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const ctx = await requireAdmin(req);
  if (!ctx) return apiError("Admin access required", "FORBIDDEN", 403);
  const { batchId } = await params;
  try {
    const batch = await settlementBatchService.approveBatch(ctx, batchId);
    return apiResponse({ batch });
  } catch (err: any) {
    return mapServiceError(err);
  }
}
