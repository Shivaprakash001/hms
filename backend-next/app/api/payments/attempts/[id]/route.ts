import { NextResponse } from "next/server";
import { paymentService } from "@/lib/services/payment-service";
import { authService } from "@/lib/services/auth-service";
import { apiError } from "@/lib/utils/api-utils";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";


export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user) {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    // user.id is profile_id, but payment attempts store tenant_id (tenants table PK).
    // Look up the real tenant ID for TENANT role.
    let tenantId: string | undefined;
    if (user.role === "TENANT") {
      const tenant = await prisma.tenants.findUnique({
        where: { profile_id: user.id },
        select: { id: true },
      });
      tenantId = tenant?.id;
    }

    const result = await paymentService.getPaymentAttempt(
      params.id,
      user.id,
      user.role,
      tenantId
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error fetching attempt:", error);
    const message = String(error?.message ?? error);
    if (message.includes("FORBIDDEN")) return apiError(message, "FORBIDDEN", 403);
    if (message.includes("NOT_FOUND")) return apiError(message, "NOT_FOUND", 404);
    return apiError(message, "INTERNAL_ERROR", 500);
  }
}
