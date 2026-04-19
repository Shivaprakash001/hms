import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { invitationService } from "@/lib/services/invitation-service";
import { InvitationSchema } from "@/lib/validators";

export const runtime = "nodejs";

/**
 * 📧 Tenant Invitation System
 * POST /api/students/invite
 * Access: Owner/Admin only
 */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return apiError("Only owners/admins can invite tenants", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json();
    const validatedData = InvitationSchema.safeParse(body);
    if (!validatedData.success) {
      return apiError("Validation failed", "VALIDATION_ERROR", 400);
    }

    const result = await invitationService.inviteTenant(validatedData.data, session.sub);
    
    return apiResponse(result, 201);
  } catch (error: any) {
    return apiError(error.message || "Failed to send invitation");
  }
}
