export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { paymentService } from "@/lib/services/payment-service";
import { authService } from "@/lib/services/auth-service";
import { apiError } from "@/lib/utils/api-utils";
import { prisma } from "@/lib/db";

/**
 * 📊 TENANT DUES — Full breakdown of all unpaid obligations (RENT + LATE_FEE)
 *
 * GET /api/payments/tenant-dues?tenant_id=xxx
 *
 * Response:
 * {
 *   tenant_id: "...",
 *   items: [
 *     { obligation_id, type: "RENT", rent_month, amount: 8000, outstanding: 8000, ... },
 *     { obligation_id, type: "LATE_FEE", rent_month, amount: 500, outstanding: 500, ... }
 *   ],
 *   total_due: 8500,
 *   rent_due: 8000,
 *   late_fees_due: 500,
 *   obligation_count: 2
 * }
 */
export async function GET(req: NextRequest) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user) {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const { searchParams } = new URL(req.url);
    let tenantId = searchParams.get("tenant_id");

    // Tenants can only view their own dues
    if (user.role === "TENANT") {
      const tenant = await prisma.tenants.findUnique({
        where: { profile_id: user.id },
        select: { id: true },
      });
      if (!tenant) return apiError("Tenant not found", "NOT_FOUND", 404);
      tenantId = tenant.id;
    }

    if (!tenantId) {
      return apiError("tenant_id is required", "VALIDATION_ERROR", 400);
    }

    // Owners can only view their own tenants
    if (user.role === "OWNER") {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { owner_id: true },
      });
      if (!tenant || tenant.owner_id !== user.id) {
        return apiError("Forbidden", "FORBIDDEN", 403);
      }
    }

    const result = await paymentService.getTenantTotalDues(tenantId);
    return Response.json(result);
  } catch (error: any) {
    console.error("Error fetching tenant dues:", error);
    const message = String(error?.message ?? error);
    return apiError(message, "INTERNAL_ERROR", 500);
  }
}
