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

    const { obligation_id, obligation_ids, amount } = await req.json();
    const ids: string[] = Array.isArray(obligation_ids)
      ? obligation_ids.map((id: any) => String(id)).filter(Boolean)
      : (obligation_id ? [String(obligation_id)] : []);

    if (ids.length === 0) {
      return apiError("obligation_id or obligation_ids is required", "VALIDATION_ERROR", 400);
    }

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

    const result = await paymentService.createPaymentIntent(
      ids,
      amount ? Number(amount) : null,
      user.id,
      tenantId
    );

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
