export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { paymentService } from "@/src/services/payments/payment-service";
import { getSession } from "@/lib/auth";
import { ApiResponse } from "@/src/lib/api-response";
import { ApiError } from "@/src/lib/api-error";
import { requireHostelBelongsToOwner } from "@/lib/security/scoped-query";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session || session.role !== "OWNER") {
      return ApiResponse.error(ApiError.forbidden("Unauthorized"));
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const tenantId = searchParams.get("tenant_id") || undefined;
    const status = searchParams.get("status") || undefined;
    const method = searchParams.get("method") || undefined;
    const month = searchParams.get("month") || undefined;
    const hostelId = searchParams.get("hostelId") || undefined;
    await requireHostelBelongsToOwner(session.id, hostelId);
    if (!hostelId) return ApiResponse.error(ApiError.badRequest("hostelId is required"));

    const filters = {
      tenantId,
      status,
      method,
      month,
    };

    const result = await paymentService.getAllPayments(
      session.id,
      hostelId,
      isNaN(limit) ? 50 : limit,
      isNaN(offset) ? 0 : offset,
      filters
    );

    return ApiResponse.success(result);
  } catch (error: any) {
    console.error("Error fetching payments:", error);
    return ApiResponse.error(ApiError.internal("Failed to fetch payments", error));
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return ApiResponse.error(ApiError.unauthorized("Unauthorized"));
    }

    const data = await req.json();
    const hostelId = data.hostelId || data.hostel_id;
    if (!hostelId) {
      return ApiResponse.error(ApiError.badRequest("hostelId is required"));
    }

    // Authorization check for manual recording: only OWNER/ADMIN
    if (session.role !== "OWNER" && session.role !== "ADMIN") {
      return ApiResponse.error(ApiError.forbidden("Only owners can record manual payments"));
    }

    const result = await paymentService.recordPayment({
      hostelId,
      obligationId: data.obligation_id,
      amountPaid: Number(data.amount_paid),
      paymentMethod: data.payment_method,
      referenceNumber: data.reference_number,
      paymentDate: data.payment_date ? new Date(data.payment_date) : undefined,
      userId: session.id,
      ownerId: session.id,
    });

    return ApiResponse.success(result);
  } catch (error: any) {
    console.error("Error recording payment:", error);
    return ApiResponse.error(ApiError.internal("Failed to record payment", error));
  }
}
