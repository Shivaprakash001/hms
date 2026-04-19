import { NextRequest } from "next/server";
import { getSession, apiResponse, apiError } from "@/lib/auth";
import { invitationService } from "@/lib/services/invitation-service";
import { InvitationSchema } from "@/lib/validators";

export const runtime = "nodejs";

/**
 * 📧 Tenant Invitation System
 * Access: Owner only
 */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || session.role !== "OWNER") {
    return apiError("Only owners can invite tenants", "FORBIDDEN", 403);
  }

  try {
    const body = await req.json();
    const validatedData = InvitationSchema.parse(body);

    const result = await invitationService.inviteTenant(validatedData, session.sub);
    
    return apiResponse(result, 201);
  } catch (error: any) {
    if (error.name === "ZodError") return apiError("Validation failed", "VALIDATION_ERROR", 400);
    return apiError(error.message || "Failed to send invitation");
  }
}
