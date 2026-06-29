export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";
import { ApiResponse } from "@/src/lib/api-response";
import { ApiError } from "@/src/lib/api-error";
import { PaymentLinkService } from "@/src/services/payments/payment-link-service";
import { getFrontendUrl } from "@/lib/config/domains";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session || session.role !== "OWNER") {
      return ApiResponse.error(ApiError.forbidden("Unauthorized"));
    }

    const scope = resolveOwnerScope(session);
    const ownerId = scope.owner_id;

    const data = await req.json().catch(() => ({}));
    const { tenantId, obligationId } = data;

    if (!tenantId && !obligationId) {
      return ApiResponse.error(ApiError.badRequest("Either tenantId or obligationId must be provided"));
    }

    // 1. Perform authorization checks
    if (tenantId) {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { owner_id: true },
      });
      if (!tenant) {
        return ApiResponse.error(ApiError.notFound("Tenant not found"));
      }
      if (tenant.owner_id !== ownerId) {
        return ApiResponse.error(ApiError.forbidden("Tenant does not belong to this owner"));
      }
    }

    if (obligationId) {
      const obligation = await prisma.rent_obligations.findUnique({
        where: { id: obligationId },
        select: { owner_id: true },
      });
      if (!obligation) {
        return ApiResponse.error(ApiError.notFound("Rent obligation not found"));
      }
      if (obligation.owner_id !== ownerId) {
        return ApiResponse.error(ApiError.forbidden("Rent obligation does not belong to this owner"));
      }
    }

    // 2. Generate or fetch the payment link token
    const result = await PaymentLinkService.getOrCreateToken({ tenantId, obligationId });

    // 3. Construct canonical URL
    const baseUrl = getFrontendUrl().replace(/\/+$/, "");
    const paymentUrl = `${baseUrl}/pay/${result.token}`;

    return ApiResponse.success({
      token: result.token,
      expiresAt: result.expiresAt,
      url: paymentUrl,
    });
  } catch (error: any) {
    console.error("Error creating payment link token:", error);
    return ApiResponse.error(ApiError.internal(error.message || "Failed to generate payment link token"));
  }
}
