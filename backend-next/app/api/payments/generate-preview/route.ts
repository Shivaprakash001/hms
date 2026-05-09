export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { rentGenerationService } from "@/lib/services/rent-generation-service";
import { authService } from "@/lib/services/auth-service";
import { apiError } from "@/lib/utils/api-utils";
import { requireHostelBelongsToOwner } from "@/lib/security/scoped-query";

/**
 * 🔧 FIX C1: Redirected from old paymentService.previewMonthlyRent to canonical rentGenerationService.
 * The old preview used different logic (prorated rent, no preferences) vs the actual generator.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user || (user.role !== "OWNER" && user.role !== "ADMIN")) {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const rentMonth = req.nextUrl.searchParams.get("rent_month");
    const hostelId = req.nextUrl.searchParams.get("hostelId") || undefined;
    if (!hostelId) {
      return apiError("hostelId is required", "HOSTEL_CONTEXT_REQUIRED", 400);
    }
    await requireHostelBelongsToOwner(user.id, hostelId);

    let targetDate: Date | undefined;
    if (rentMonth) {
      targetDate = new Date(rentMonth);
    }

    const result = await rentGenerationService.previewMonthlyRent(
      targetDate,
      user.id,
      hostelId
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error previewing rent generation:", error);
    const message = String(error?.message ?? error);
    return apiError(message, "INTERNAL_ERROR", 500);
  }
}
