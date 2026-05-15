export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { apiResponse, apiError } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/admin-ctx";
import { settlementBatchService } from "@/lib/services/settlement-batch-service";
import { mapServiceError } from "@/lib/api/admin-error";

/**
 * GET /api/admin/settlements/reconciliation
 * Returns the four reconciliation views in one shot for the admin
 * reconciliation dashboard:
 *
 *   uncovered      - CREDITs not in any active batch item (= unsettled liability)
 *   over_covered   - same credit covered by >1 SUCCESS/PROCESSING item (should be empty)
 *   orphan_debits  - DEBIT_PAYOUT rows whose batch_item is missing/non-SUCCESS
 *   coverage_drift - items whose amount != SUM(covered credits) (canary for tampering)
 *
 * The first three datasets are bounded by a per-view `limit` query param
 * (default 200, max 1000). The uncovered view supports a separate `limit`.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!ctx) return apiError("Admin access required", "FORBIDDEN", 403);

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 200), 1), 1000);
  const uncoveredLimit = Math.min(Math.max(Number(searchParams.get("uncoveredLimit") || 1000), 1), 5000);

  try {
    const [uncovered, overCovered, orphanDebits, coverageDrift] = await Promise.all([
      settlementBatchService.findUncoveredCredits(uncoveredLimit),
      settlementBatchService.findOverCoveredCredits(limit),
      settlementBatchService.findOrphanDebits(limit),
      settlementBatchService.findCoverageDrift(limit),
    ]);
    return apiResponse({
      uncovered,
      over_covered: overCovered,
      orphan_debits: orphanDebits,
      coverage_drift: coverageDrift,
      counts: {
        uncovered: uncovered.length,
        over_covered: overCovered.length,
        orphan_debits: orphanDebits.length,
        coverage_drift: coverageDrift.length,
      },
    });
  } catch (err: any) {
    return mapServiceError(err);
  }
}
