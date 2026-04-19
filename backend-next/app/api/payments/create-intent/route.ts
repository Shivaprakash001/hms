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

    const { obligation_id, amount } = await req.json();
    if (!obligation_id) {
      return apiError("obligation_id is required", "VALIDATION_ERROR", 400);
    }

    const result = await paymentService.createPaymentIntent(
      obligation_id,
      amount ? Number(amount) : null,
      user.id,
      user.role === "STUDENT" ? user.id : undefined
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error creating payment intent:", error);
    const message = String(error?.message ?? error);
    if (message.includes("FORBIDDEN")) return apiError(message, "FORBIDDEN", 403);
    if (message.includes("NOT_FOUND")) return apiError(message, "NOT_FOUND", 404);
    return apiError(message, "INTERNAL_ERROR", 500);
  }
}
