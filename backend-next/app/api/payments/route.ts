export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { paymentService } from "@/lib/services/payment-service";
import { authService } from "@/lib/services/auth-service";
import { apiError } from "@/lib/utils/api-utils";
import { requireHostelBelongsToOwner } from "@/lib/security/scoped-query";

export async function GET(req: Request) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user || user.role !== "OWNER") {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const tenantId = searchParams.get("tenant_id") || undefined;
    const status = searchParams.get("status") || undefined;
    const method = searchParams.get("method") || undefined;
    const month = searchParams.get("month") || undefined;
    const hostelId = searchParams.get("hostelId") || undefined;
    await requireHostelBelongsToOwner(user.id, hostelId);
    if (!hostelId) return apiError("hostelId is required", "HOSTEL_CONTEXT_REQUIRED", 400);

    const filters = {
      tenantId,
      status,
      method,
      month,
    };

    const result = await paymentService.getAllPayments(
      user.id,
      hostelId,
      isNaN(limit) ? 50 : limit,
      isNaN(offset) ? 0 : offset,
      filters
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching payments:", error);
    const message = String(error?.message ?? error);
    return apiError(message, "INTERNAL_ERROR", 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user) {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const data = await req.json();
    const hostelId = data.hostelId || data.hostel_id;
    if (!hostelId) {
      return apiError("hostelId is required", "HOSTEL_CONTEXT_REQUIRED", 400);
    }

    // Authorization check for manual recording: only OWNER/ADMIN
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      return apiError("Only owners can record manual payments", "FORBIDDEN", 403);
    }

    const result = await paymentService.recordPayment({
      hostelId,
      obligationId: data.obligation_id,
      amountPaid: Number(data.amount_paid),
      paymentMethod: data.payment_method,
      referenceNumber: data.reference_number,
      paymentDate: data.payment_date ? new Date(data.payment_date) : undefined,
      userId: user.id,
      ownerId: user.id,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error recording payment:", error);
    const message = String(error?.message ?? error);
    return apiError(message, "INTERNAL_ERROR", 500);
  }
}
