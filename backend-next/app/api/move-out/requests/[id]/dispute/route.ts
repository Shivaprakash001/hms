export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { moveOutService } from "@/lib/services/move-out-service";

/** POST /api/move-out/requests/[id]/dispute — Raise or resolve a dispute */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession(req);
  if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);
  try {
    const body = await req.json();
    if (body.resolve && body.disputeId) {
      const result = await moveOutService.resolveDispute(body.disputeId, session.sub, body.resolutionNotes || "");
      return apiResponse(result);
    }
    const result = await moveOutService.raiseDispute({
      requestId: params.id, raisedBy: session.sub,
      raisedByRole: session.role, disputeType: body.disputeType || "DEDUCTION",
      description: body.description || "", disputedAmount: body.disputedAmount,
      evidenceUrls: body.evidenceUrls || [],
    });
    return apiResponse(result, 201);
  } catch (error: any) {
    const msg = error.message || "Failed";
    if (msg.startsWith("VALIDATION:")) return apiError(msg, "VALIDATION_ERROR", 400);
    if (msg.startsWith("NOT_FOUND")) return apiError(msg, "NOT_FOUND", 404);
    return apiError(msg);
  }
}
