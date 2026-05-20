export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { moveOutService } from "@/lib/services/move-out-service";
import { resolveOwnerScope } from "@/lib/auth/resolve-operational-scope";

/**
 * POST /api/move-out/requests/[id]/inspect — Submit room inspection
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN", "WARDEN"].includes(session.role)) {
    return apiError("Forbidden", "FORBIDDEN", 403);
  }

  try {
    const { prisma } = await import("@/lib/db");
    const request = await prisma.move_out_requests.findUnique({
      where: { id: params.id },
      select: { owner_id: true }
    });
    if (!request) return apiError("Move-out request not found", "NOT_FOUND", 404);

    if (session.role === "OWNER" && request.owner_id !== session.sub) {
      return apiError("Forbidden", "FORBIDDEN", 403);
    }
    if (session.role === "WARDEN") {
      const userProfile = await prisma.profile.findUnique({
        where: { id: session.sub },
        select: { owner_id: true }
      });
      if (userProfile?.owner_id !== request.owner_id) {
        return apiError("Forbidden", "FORBIDDEN", 403);
      }
    }

    const body = await req.json();
    const result = await moveOutService.submitInspection({
      requestId: params.id,
      inspectedBy: session.sub,
      roomCondition: body.roomCondition || "GOOD",
      cleaningStatus: body.cleaningStatus || "CLEAN",
      damagesAmount: Number(body.damagesAmount) || 0,
      cleaningFee: Number(body.cleaningFee) || 0,
      missingItemsFee: Number(body.missingItemsFee) || 0,
      otherDeductions: Number(body.otherDeductions) || 0,
      deductionNotes: body.deductionNotes || null,
      evidenceUrls: body.evidenceUrls || [],
      notes: body.notes || null,
      items: body.items || [],
    });

    return apiResponse(result);
  } catch (error: any) {
    const msg = error.message || "Failed to submit inspection";
    if (msg.startsWith("VALIDATION:")) return apiError(msg, "VALIDATION_ERROR", 400);
    if (msg.startsWith("NOT_FOUND:")) return apiError(msg, "NOT_FOUND", 404);
    return apiError(msg);
  }
}
