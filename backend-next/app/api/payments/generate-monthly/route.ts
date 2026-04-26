export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { paymentService } from "@/lib/services/payment-service";
import { authService } from "@/lib/services/auth-service";
import { apiError } from "@/lib/utils/api-utils";

export async function POST(req: Request) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user || (user.role !== "OWNER" && user.role !== "ADMIN")) {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const { rent_month } = await req.json();
    if (!rent_month) {
      return apiError("rent_month is required", "VALIDATION_ERROR", 400);
    }

    const result = await paymentService.generateMonthlyRent(
      new Date(rent_month),
      user.role === "OWNER" ? user.id : undefined
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error generating rent:", error);
    const message = String(error?.message ?? error);
    return apiError(message, "INTERNAL_ERROR", 500);
  }
}
