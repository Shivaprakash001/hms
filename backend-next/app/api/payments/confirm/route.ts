import { NextResponse } from "next/server";
import { paymentService } from "@/lib/services/payment-service";
import { authService } from "@/lib/services/auth-service";
import { apiError } from "@/lib/utils/api-utils";
import { prisma } from "@/lib/db";

/**
 * POST /api/payments/confirm
 * 
 * Owner confirms or rejects a PENDING_VERIFICATION payment.
 * 
 * Body:
 *   { attempt_id: string, action: "confirm" | "reject" }
 * 
 * On confirm: attempt → SUCCESS, records payment, marks rent PAID
 * On reject:  attempt → FAILED
 */
export async function POST(req: Request) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user) {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      return apiError("Only owners can confirm payments", "FORBIDDEN", 403);
    }

    const body = await req.json();
    const { attempt_id, action } = body;

    if (!attempt_id) {
      return apiError("attempt_id is required", "VALIDATION_ERROR", 400);
    }
    if (!action || !["confirm", "reject"].includes(action)) {
      return apiError("action must be 'confirm' or 'reject'", "VALIDATION_ERROR", 400);
    }

    // Verify ownership
    const attempt = await prisma.paymentAttempt.findUnique({
      where: { id: attempt_id },
    });

    if (!attempt) {
      return apiError("Payment attempt not found", "NOT_FOUND", 404);
    }

    if (attempt.owner_id !== user.id) {
      return apiError("FORBIDDEN: You can only manage your own hostel's payments", "FORBIDDEN", 403);
    }

    if (attempt.status === "SUCCESS") {
      return NextResponse.json({
        message: "Payment already confirmed",
        attempt,
      });
    }

    if (action === "confirm") {
      // Finalize as SUCCESS — records the payment and updates obligation
      const finalized = await paymentService.finalizePaymentAttempt(
        attempt_id,
        "SUCCESS",
        attempt.gateway_txn_id || undefined,
        {
          source: "owner_confirmation",
          confirmed_by: user.id,
          confirmed_at: new Date().toISOString(),
        }
      );

      return NextResponse.json({
        message: "Payment confirmed successfully. Rent marked as paid.",
        attempt: finalized,
      });
    } else {
      // Reject — mark as FAILED
      const rejected = await prisma.paymentAttempt.update({
        where: { id: attempt_id },
        data: {
          status: "FAILED",
          raw_webhook_payload: {
            ...(attempt.raw_webhook_payload as any || {}),
            rejection: {
              rejected_by: user.id,
              rejected_at: new Date().toISOString(),
            },
          } as any,
        },
      });

      return NextResponse.json({
        message: "Payment rejected.",
        attempt: rejected,
      });
    }
  } catch (error: any) {
    console.error("Error confirming payment:", error);
    const message = String(error?.message ?? error);
    if (message.includes("FORBIDDEN")) return apiError(message, "FORBIDDEN", 403);
    if (message.includes("NOT_FOUND")) return apiError(message, "NOT_FOUND", 404);
    return apiError(message, "INTERNAL_ERROR", 500);
  }
}
