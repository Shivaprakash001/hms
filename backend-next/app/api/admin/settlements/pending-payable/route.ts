export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { apiResponse, apiError } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/admin-ctx";
import { settlementBatchService } from "@/lib/services/settlement-batch-service";
import { mapServiceError } from "@/lib/api/admin-error";

/**
 * GET /api/admin/settlements/pending-payable?limit=200
 * Returns owners with at least one un-settled CREDIT, aggregated by
 * owner with hostel count, total pending amount, and oldest credit
 * timestamp. Drives the "Owner Settlement Queue" view.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!ctx) return apiError("Admin access required", "FORBIDDEN", 403);

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 200), 1), 1000);

  try {
    const owners = await settlementBatchService.listOwnersWithPendingPayable(limit);
    return apiResponse({ owners });
  } catch (err: any) {
    return mapServiceError(err);
  }
}
