export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { moveOutService } from "@/lib/services/move-out-service";

/**
 * POST /api/move-out/requests/[id]/feedback — Submit exit feedback
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

  try {
    const body = await req.json();

    // Resolve tenant context
    const { prisma } = await import("@/lib/db");
    const request = await prisma.move_out_requests.findUnique({
      where: { id: params.id },
      select: { tenant_id: true, hostel_id: true, tenant: { select: { profile_id: true } } },
    });
    if (!request) return apiError("Move-out request not found", "NOT_FOUND", 404);

    // Only the tenant themselves or the owner can submit feedback
    if (session.role === "TENANT" && request.tenant.profile_id !== session.sub) {
      return apiError("Forbidden", "FORBIDDEN", 403);
    }

    const result = await moveOutService.submitFeedback({
      requestId: params.id,
      tenantId: request.tenant_id,
      hostelId: request.hostel_id,
      ratingCleanliness: body.ratingCleanliness,
      ratingFood: body.ratingFood,
      ratingWifi: body.ratingWifi,
      ratingManagement: body.ratingManagement,
      ratingMaintenance: body.ratingMaintenance,
      ratingSafety: body.ratingSafety,
      ratingValue: body.ratingValue,
      overallRating: body.overallRating,
      wouldRecommend: body.wouldRecommend,
      improvementText: body.improvementText,
      experienceText: body.experienceText,
    });

    return apiResponse(result, 201);
  } catch (error: any) {
    const msg = error.message || "Failed to submit feedback";
    if (msg.startsWith("VALIDATION:")) return apiError(msg, "VALIDATION_ERROR", 400);
    if (msg.startsWith("NOT_FOUND:")) return apiError(msg, "NOT_FOUND", 404);
    return apiError(msg);
  }
}
