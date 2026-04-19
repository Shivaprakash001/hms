import { NextResponse } from "next/server";
import { paymentService } from "@/lib/services/payment-service";
import { authService } from "@/lib/services/auth-service";
import { apiError } from "@/lib/utils/api-utils";

export async function GET(req: Request) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user || user.role !== "OWNER") {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const { searchParams } = new URL(req.url);
    const rentMonth = searchParams.get("rent_month");
    const status = searchParams.get("status");

    const result = await paymentService.getDuesReport(
      user.id,
      rentMonth ? new Date(rentMonth) : undefined,
      status || undefined
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching dues report:", error);
    const message = String(error?.message ?? error);
    return apiError(message, "INTERNAL_ERROR", 500);
  }
}
