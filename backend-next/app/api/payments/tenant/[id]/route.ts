export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { ApiResponse, ApiError } from "@/src/lib/api-response";
import { paymentService } from "@/src/services/payments/payment-service";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  if (!session) return ApiError.unauthorized("Unauthorized");

  try {
    const tenantId = params.id;

    if (session.role === "TENANT") {
      const me = await prisma.tenants.findUnique({ where: { profile_id: session.sub }, select: { id: true } });
      if (!me || me.id !== tenantId) return ApiError.forbidden("Forbidden");
    }

    if (session.role === "OWNER") {
      const target = await prisma.tenants.findUnique({ where: { id: tenantId }, select: { owner_id: true } });
      if (!target || target.owner_id !== session.sub) return ApiError.forbidden("Forbidden");
    }

    const history = await paymentService.getTenantPaymentHistory(tenantId);
    return ApiResponse.success(history);
  } catch (error: any) {
    const msg = typeof error?.message === "string" ? error.message : String(error);
    if (msg.startsWith("NOT_FOUND")) return ApiError.notFound(msg.split(": ")[1] ?? msg);
    return ApiError.internal(msg || "Failed to fetch payment history");
  }
}
