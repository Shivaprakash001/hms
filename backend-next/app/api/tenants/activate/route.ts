export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { apiError, apiResponse } from "@/lib/auth";
import { invitationService } from "@/lib/services/invitation-service";
import { ActivationSchema } from "@/lib/validators";


/**
 * 🔐 Tenant Activation
 * POST /api/tenants/activate
 * Access: Public (token-based)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = ActivationSchema.safeParse(body);

    if (!validated.success) {
      return apiError("Validation failed", "VALIDATION_ERROR", 400);
    }

    const { token, password, confirm_password } = validated.data;
    if (password !== confirm_password) {
      return apiError("Passwords do not match", "VALIDATION_ERROR", 400);
    }

    const result = await invitationService.activateTenant(token, password);
    return apiResponse(result, 200);
  } catch (error: any) {
    const rawMessage = String(error?.message || "Failed to activate account");
    const [maybeCode, ...rest] = rawMessage.split(":");
    const normalizedCode = maybeCode?.trim();
    const normalizedMessage = rest.length > 0 ? rest.join(":").trim() : rawMessage;

    const statusMap: Record<string, number> = {
      INVALID: 400,
      VALIDATION_ERROR: 400,
      BAD_REQUEST: 400,
      NOT_FOUND: 404,
      INTERNAL_ERROR: 500,
    };

    const status = statusMap[normalizedCode] || 500;
    return apiError(normalizedMessage, normalizedCode || "ACTIVATION_ERROR", status);
  }
}

