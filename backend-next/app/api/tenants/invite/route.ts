export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ApiResponse } from "@/src/lib/api-response";
import { ApiError } from "@/src/lib/api-error";
import { invitationService } from "@/src/services/tenants/invitation-service";
import { InvitationSchema } from "@/lib/validators";
import { planGate, TenantHardCapError } from "@/lib/services/plan-gate-service";


/**
 * 📧 Tenant Invitation System
 * POST /api/tenants/invite
 * Access: Owner/Admin only
 */
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return ApiResponse.error(ApiError.forbidden("Only owners/admins can invite tenants"));
  }

  try {
    const body = await req.json();
    const validatedData = InvitationSchema.safeParse(body);
    if (!validatedData.success) {
      return ApiResponse.error(ApiError.validationError("Validation failed"));
    }

    await planGate.assertTenantLimit(session.sub);

    const result = await invitationService.inviteTenant(validatedData.data, session.sub);
    
    return ApiResponse.success(result, 201);
  } catch (error: any) {
    if (error instanceof TenantHardCapError) {
      return NextResponse.json({
        error: {
          code: "TENANT_HARD_CAP_EXCEEDED",
          message: `Tenant hard cap reached (${error.current}/${error.hard_cap}). Upgrade to ${error.recommended_plan} to add more tenants.`,
          upgrade_required: true,
          recommended_plan: error.recommended_plan,
          current_count: error.current,
          hard_cap: error.hard_cap,
        }
      }, { status: 402 });
    }
    const rawMessage = String(error?.message || "Failed to send invitation");
    const [maybeCode, ...rest] = rawMessage.split(":");
    const normalizedCode = maybeCode?.trim();
    const normalizedMessage = rest.length > 0 ? rest.join(":").trim() : rawMessage;

    const statusMap: Record<string, number> = {
      VALIDATION_ERROR: 400,
      VALIDATION: 400,
      BAD_REQUEST: 400,
      PLAN_LIMIT: 402,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      ALREADY_EXISTS: 409,
      INTERNAL_ERROR: 500,
    };

    const status = statusMap[normalizedCode] || 500;
    return ApiResponse.error(new ApiError(status, normalizedCode || "INVITATION_ERROR", normalizedMessage));
  }
}
