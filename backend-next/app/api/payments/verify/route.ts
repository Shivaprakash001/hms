import { NextResponse } from "next/server";
import { paymentService } from "@/lib/services/payment-service";
import { authService } from "@/lib/services/auth-service";
import { apiError } from "@/lib/utils/api-utils";

export async function POST(req: Request) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user) {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const body = await req.json();
    const result = await paymentService.verifyPaymentStatus({
      userId: user.id,
      role: user.role,
      studentId: user.role === "STUDENT" ? user.id : undefined,
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
    return apiError(message, "INTERNAL_ERROR", 500);
  }
}
