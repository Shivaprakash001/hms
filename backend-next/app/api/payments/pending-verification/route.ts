export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { authService } from "@/lib/services/auth-service";
import { apiError } from "@/lib/utils/api-utils";
import { prisma } from "@/lib/db";

/**
 * GET /api/payments/pending-verification
 * 
 * Returns all PENDING_VERIFICATION payment attempts for the owner.
 * Used in the owner dashboard to show payments awaiting confirmation.
 */
export async function GET(req: Request) {
  try {
    const user = await authService.getCurrentUser(req);
    if (!user) {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      return apiError("Only owners can view pending verifications", "FORBIDDEN", 403);
    }

    const attempts = await prisma.paymentAttempt.findMany({
      where: {
        owner_id: user.id,
        status: "PENDING_VERIFICATION",
      },
      include: {
        tenant: {
          include: {
            profile: { select: { name: true, email: true, phone: true } },
          },
        },
        obligation: {
          include: {
            allocation: {
              include: { room: { select: { room_no: true } } },
            },
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    const items = attempts.map((a: any) => ({
      attempt_id: a.id,
      student_name: a.tenant?.profile?.name || "Unknown",
      student_email: a.tenant?.profile?.email || "",
      student_phone: a.tenant?.profile?.phone || "",
      room_no: a.obligation?.allocation?.room?.room_no || "N/A",
      amount: Number(a.amount),
      upi_reference: a.gateway_txn_id || "—",
      rent_month: a.obligation?.rent_month,
      submitted_at: a.raw_webhook_payload?.submitted_at || a.updated_at,
      created_at: a.created_at,
    }));

    return NextResponse.json({
      pending_count: items.length,
      items,
    });
  } catch (error: any) {
    console.error("Error fetching pending verifications:", error);
    const message = String(error?.message ?? error);
    return apiError(message, "INTERNAL_ERROR", 500);
  }
}
