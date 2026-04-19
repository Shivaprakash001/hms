import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { invitationService } from "@/lib/services/invitation-service";

export const runtime = "nodejs";

/**
 * 📧 RESEND INVITATION
 * POST /api/students/resend-invitation
 */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Only owners/admins can resend invitations", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json();
    if (!body.email) {
      return apiError("Email is required", "VALIDATION_ERROR", 400);
    }

    // Call invitation service to resend
    const result = await invitationService.resendInvitation(body.email);
    
    return apiResponse(result, 200);
  } catch (error: any) {
    if (error.message.startsWith("NOT_FOUND")) return apiError(error.message.split(": ")[1], "NOT_FOUND", 404);
    if (error.message.startsWith("BAD_REQUEST")) return apiError(error.message.split(": ")[1], "VALIDATION_ERROR", 400);
    return apiError(error.message || "Failed to resend invitation");
  }
}
