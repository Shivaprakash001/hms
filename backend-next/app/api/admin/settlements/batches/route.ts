export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { apiResponse, apiError } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/admin-ctx";
import { settlementBatchService, BATCH_STATUS } from "@/lib/services/settlement-batch-service";

/**
 * GET /api/admin/settlements/batches
 * Query: ?status=DRAFT|APPROVED|...&limit=50&cursor=<id>
 *
 * Lists settlement batches with optional status filter. Strictly admin-only.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!ctx) return apiError("Admin access required", "FORBIDDEN", 403);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as keyof typeof BATCH_STATUS | null;
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 200);
  const cursor = searchParams.get("cursor");

  try {
    const batches = await settlementBatchService.listBatches({
      status: status ?? undefined,
      limit,
      cursor,
    });
    return apiResponse({ batches });
  } catch (err: any) {
    return apiError(err?.message || "list batches failed");
  }
}

/**
 * POST /api/admin/settlements/batches
 * Body: { notes?: string }
 *
 * Creates a new DRAFT batch. Items are added separately via the items
 * endpoint.
 */
export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req);
  if (!ctx) return apiError("Admin access required", "FORBIDDEN", 403);

  let body: { notes?: string } = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  try {
    const batch = await settlementBatchService.createBatch(ctx, { notes: body.notes ?? null });
    return apiResponse({ batch }, 201);
  } catch (err: any) {
    return apiError(err?.message || "create batch failed",
      err?.message?.startsWith("BAD_REQUEST") ? "BAD_REQUEST" : "INTERNAL",
      err?.message?.startsWith("BAD_REQUEST") ? 400 : 500);
  }
}
