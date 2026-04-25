import { NextRequest, NextResponse } from "next/server";
import { paymentService } from "@/lib/services/payment-service";
import { authService } from "@/lib/services/auth-service";
import { apiError } from "@/lib/utils/api-utils";

export async function GET(req: NextRequest) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user || (user.role !== "OWNER" && user.role !== "ADMIN")) {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const rentMonth = req.nextUrl.searchParams.get("rent_month");
    if (!rentMonth) {
      return apiError("rent_month is required", "VALIDATION_ERROR", 400);
    }

    const result = await paymentService.previewMonthlyRent(
      new Date(rentMonth),
      user.role === "OWNER" ? user.id : undefined
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error previewing rent generation:", error);
    const message = String(error?.message ?? error);
    return apiError(message, "INTERNAL_ERROR", 500);
  }
}

