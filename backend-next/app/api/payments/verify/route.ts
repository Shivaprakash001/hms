export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { paymentService } from "@/lib/services/payment-service";
import { authService } from "@/lib/services/auth-service";
import { apiError } from "@/lib/utils/api-utils";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user) {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    // user.id is profile_id, but payment attempts store tenant_id (tenants table PK).
    let tenantId: string | undefined;
    if (user.role === "TENANT") {
      const tenant = await prisma.tenant.findUnique({
        where: { profile_id: user.id },
        select: { id: true },
      });
      tenantId = tenant?.id;
    }

    const body = await req.json();
    const result = await paymentService.verifyPaymentStatus({
      userId: user.id,
      role: user.role,
      tenantId,
      attemptId: body?.attempt_id,
      merchantTxnId: body?.merchant_txn_id || body?.merchantTransactionId,
      gatewayTxnId: body?.gateway_txn_id || body?.transactionId || body?.gateway_transaction_id,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error verifying payment:", error);
    const message = String(error?.message ?? error);
    if (message.includes("FORBIDDEN")) return apiError(message, "FORBIDDEN", 403);
    if (message.includes("NOT_FOUND")) return apiError(message, "NOT_FOUND", 404);
    if (message.includes("BAD_REQUEST")) return apiError(message, "VALIDATION_ERROR", 400);
    if (message.includes("CONFIG_ERROR")) return apiError(message, "CONFIG_ERROR", 422);
    return apiError(message, "INTERNAL_ERROR", 500);
  }
}
