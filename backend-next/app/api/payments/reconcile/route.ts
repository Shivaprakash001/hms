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
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      return apiError("Only owner/admin can reconcile attempts", "FORBIDDEN", 403);
    }

    const body = await req.json().catch(() => ({} as any));
    const ids = Array.isArray(body?.payment_ids)
      ? body.payment_ids.filter((v: any) => typeof v === "string" && v.trim().length > 0)
      : [];

    const result = await paymentService.reconcilePendingAttempts({
      ownerId: user.role === "OWNER" ? user.id : undefined,
      attemptIds: ids,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error reconciling pending attempts:", error);
    const message = String(error?.message ?? error);
    return apiError(message, "INTERNAL_ERROR", 500);
  }
}
