import { NextResponse } from "next/server";
import { paymentService } from "@/lib/services/payment-service";
import { authService } from "@/lib/services/auth-service";
import { apiError } from "@/lib/utils/api-utils";
import { requireHostelBelongsToOwner } from "@/lib/security/scoped-query";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";


export async function GET(req: Request) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user || user.role !== "OWNER") {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const { searchParams } = new URL(req.url);
    const rentMonth = searchParams.get("rent_month");
    const status = searchParams.get("status");
    const hostelId = searchParams.get("hostelId") || undefined;
    await requireHostelBelongsToOwner(user.id, hostelId);
    if (!hostelId) return apiError("hostelId is required", "HOSTEL_CONTEXT_REQUIRED", 400);

    const result = await paymentService.getDuesReport(
      user.id,
      hostelId,
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
