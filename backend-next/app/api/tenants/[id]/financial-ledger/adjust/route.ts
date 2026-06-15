export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { tenantFinancialLedgerService } from "@/src/services/payments/tenant-financial-ledger-service";

/**
 * POST /api/tenants/[id]/financial-ledger/adjust
 * Apply tenant future rent credit balance against an outstanding obligation.
 *
 * Body: { obligation_id, amount, notes? }
 * Auth: OWNER or ADMIN only
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json();
    const { obligation_id, amount, notes } = body;

    if (!obligation_id || typeof obligation_id !== "string") {
      return apiError("obligation_id is required", "VALIDATION_ERROR", 400);
    }
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return apiError("amount must be a positive number", "VALIDATION_ERROR", 400);
    }

    const ownerId = session.role === "OWNER" ? session.sub : session.sub;

    const result = await tenantFinancialLedgerService.adjustAgainstObligation({
      tenantId: params.id,
      ownerId,
      createdBy: session.sub,
      obligationId: obligation_id,
      amount,
      notes,
    });

    return apiResponse(result, 200);
  } catch (error: any) {
    const msg = String(error?.message ?? error);
    if (msg.includes("NOT_FOUND")) return apiError(msg, "NOT_FOUND", 404);
    if (msg.includes("FORBIDDEN")) return apiError(msg, "FORBIDDEN", 403);
    if (msg.includes("BAD_REQUEST")) return apiError(msg, "VALIDATION_ERROR", 400);
    return apiError(msg, "INTERNAL_ERROR", 500);
  }
}
