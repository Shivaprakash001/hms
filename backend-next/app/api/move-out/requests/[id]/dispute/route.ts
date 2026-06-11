export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { moveOutActorFromSession, moveOutService } from "@/lib/services/move-out-service";

/** POST /api/move-out/requests/[id]/dispute — Raise or resolve a dispute */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);
  try {
    const body = await req.json();
    const actor = moveOutActorFromSession(session);
    if (body.resolve && body.disputeId) {
      const result = await moveOutService.resolveDispute(body.disputeId, actor, body.resolutionNotes || "");
      return apiResponse(result);
    }
    const result = await moveOutService.raiseDispute({
      requestId: params.id, actor, disputeType: body.disputeType || "DEDUCTION",
      description: body.description || "", disputedAmount: body.disputedAmount,
      evidenceUrls: body.evidenceUrls || [],
    });
    return apiResponse(result, 201);
  } catch (error: any) {
    const msg = error.message || "Failed";
    if (msg.startsWith("VALIDATION:")) return apiError(msg, "VALIDATION_ERROR", 400);
    if (msg.startsWith("NOT_FOUND")) return apiError(msg, "NOT_FOUND", 404);
    if (msg.startsWith("FORBIDDEN:")) return apiError(msg, "FORBIDDEN", 403);
    if (msg.startsWith("UNAUTHORIZED:")) return apiError(msg, "UNAUTHORIZED", 401);
    return apiError(msg);
  }
}
