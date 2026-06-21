export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { ApiResponse } from "@/src/lib/api-response";
import { ApiError } from "@/src/lib/api-error";
import { financialService } from "@/src/services/payments/financial-service";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return ApiResponse.error(ApiError.unauthorized("Unauthorized"));

  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenant_id");

    if (!tenantId) {
      return ApiResponse.error(ApiError.badRequest("tenant_id query parameter is required"));
    }

    // Role-based Access Checks
    if (session.role === "TENANT") {
      const me = await prisma.tenants.findUnique({
        where: { profile_id: session.sub },
        select: { id: true },
      });
      if (!me || me.id !== tenantId) {
        return ApiResponse.error(ApiError.forbidden("Forbidden: You can only query your own financial status"));
      }
    } else if (session.role === "OWNER") {
      const target = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { owner_id: true },
      });
      if (!target || target.owner_id !== session.sub) {
        return ApiResponse.error(ApiError.forbidden("Forbidden: You do not have access to this tenant"));
      }
    } else {
      return ApiResponse.error(ApiError.forbidden("Forbidden: Access denied"));
    }

    const status = await financialService.getTenantFinancialStatus(tenantId);
    return ApiResponse.success(status);
  } catch (error: any) {
    const msg = typeof error?.message === "string" ? error.message : String(error);
    if (msg.startsWith("NOT_FOUND")) {
      return ApiResponse.error(ApiError.notFound(msg.split(": ")[1] ?? msg));
    }
    return ApiResponse.error(ApiError.internal(msg || "Failed to fetch financial status"));
  }
}
