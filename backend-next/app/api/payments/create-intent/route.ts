export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { paymentService } from "@/lib/services/payment-service";
import { authService } from "@/lib/services/auth-service";
import { apiError } from "@/lib/utils/api-utils";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";

const logger = getLogger("create-intent");

export async function POST(req: Request) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user) {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const { obligation_ids } = await req.json();
    if (!Array.isArray(obligation_ids) || obligation_ids.length === 0) {
      return apiError("obligation_ids must be a non-empty array", "VALIDATION_ERROR", 400);
    }

    const ids: string[] = obligation_ids.map((id: any) => String(id)).filter(Boolean);

    logger.info("create_intent_called", {
      userId: user.id,
      userRole: user.role,
      obligationCount: ids.length,
      obligationIds: ids,
    });

    let tenantId: string | undefined;
    if (user.role === "TENANT") {
      const tenant = await prisma.tenant.findUnique({
        where: { profile_id: user.id },
        select: { id: true },
      });
      if (!tenant) {
        return apiError("Tenant enrollment not found", "NOT_FOUND", 404);
      }
      tenantId = tenant.id;
    }

    const raw = await paymentService.createMultiObligationPaymentIntent(
      ids,
      user.id,
      tenantId
    );
    // Normalize: dedup path returns {attempt, isReused: true, ...}; new path returns PaymentAttempt directly
    const result = (raw as any).isReused === true ? (raw as any).attempt : raw;

    logger.info("redirecting_to_checkout", {
      attemptId: result.id,
      merchantTxnId: result.merchant_txn_id,
      checkoutUrl: result.checkout_url ? "present" : "missing",
      amount: result.amount,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error creating payment intent:", error);
    const message = String(error?.message ?? error);
    if (message.includes("FORBIDDEN")) return apiError(message, "FORBIDDEN", 403);
    if (message.includes("NOT_FOUND")) return apiError(message, "NOT_FOUND", 404);
    if (message.includes("BAD_REQUEST")) return apiError(message, "VALIDATION_ERROR", 400);
    if (message.includes("CONFIG_ERROR")) return apiError(message, "CONFIG_ERROR", 422);
    return apiError(message, "INTERNAL_ERROR", 500);
  }
}
