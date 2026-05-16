export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { ApiResponse, ApiError } from "@/src/lib/api-response";
import { paymentService } from "@/src/services/payments/payment-service";
import { authService } from "@/lib/services/auth-service";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user) {
      return ApiError.unauthorized("Unauthorized");
    }

    const { searchParams } = new URL(req.url || "");
    const idsParam = searchParams.get("ids");
    if (!idsParam) {
      return ApiError.badRequest("ids query parameter is required", "VALIDATION_ERROR");
    }

    const obligationIds = idsParam.split(",").map(id => id.trim()).filter(Boolean);
    if (obligationIds.length === 0) {
      return ApiError.badRequest("ids must be a non-empty comma-separated list", "VALIDATION_ERROR");
    }

    let tenantId: string | undefined;
    if (user.role === "TENANT") {
      const tenant = await prisma.tenants.findUnique({
        where: { profile_id: user.id },
        select: { id: true },
      });
      if (!tenant) {
        return ApiError.notFound("Tenant enrollment not found");
      }
      tenantId = tenant.id;
    } else if (user.role === "OWNER") {
      const hostelId = searchParams.get("hostelId");
      if (!hostelId) return ApiError.badRequest("hostelId is required", "HOSTEL_CONTEXT_REQUIRED");
      const hostel = await prisma.hostels.findUnique({ where: { id: hostelId }, select: { owner_id: true } });
      if (!hostel || hostel.owner_id !== user.id) return ApiError.forbidden("Forbidden");
      const count = await prisma.rent_obligations.count({
        where: { id: { in: obligationIds }, owner_id: user.id, hostel_id: hostelId },
      });
      if (count !== obligationIds.length) {
        return ApiError.forbidden("All obligations must belong to the requested hostel");
      }
    } else if (user.role !== "ADMIN") {
      return ApiError.forbidden("Forbidden");
    }

    const preview = await paymentService.previewPaymentAmount(obligationIds, user.id, tenantId);

    const normalized = {
      items: preview.obligations.map((item: any) => ({
        id: item.id,
        tenant_id: item.tenant_id,
        rent_month: item.rent_month,
        type: item.obligation_type,
        due_amount: item.due_amount,
        paid_amount: item.paid_amount,
        outstanding_amount: item.outstanding_amount,
        status: item.status,
      })),
      total_outstanding: preview.total_outstanding,
      currency: preview.currency,
    };

    return ApiResponse.success(normalized);
  } catch (error: any) {
    console.error("Error previewing payment:", error);
    const message = String(error?.message ?? error);
    if (message.includes("FORBIDDEN")) return ApiError.forbidden(message.split(": ")[1] ?? message);
    if (message.includes("NOT_FOUND")) return ApiError.notFound(message.split(": ")[1] ?? message);
    if (message.includes("BAD_REQUEST")) return ApiError.badRequest(message.split(": ")[1] ?? message);
    return ApiError.internal(message);
  }
}
