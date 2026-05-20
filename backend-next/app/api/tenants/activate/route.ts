export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { apiError, apiResponse } from "@/lib/auth";
import { invitationService } from "@/src/services/tenants/invitation-service";
import { ActivationSchema } from "@/lib/validators";
import { activationWorkflowService } from "@/src/services/tenants/activation-workflow-service";


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

/**
 * Backend-controlled activation workflow mutation.
 * PATCH /api/tenants/activate
 * Body: { token, step, data }
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const token = String(body?.token || "").trim();
    const step = String(body?.step || "").trim().toUpperCase() as any;
    if (!token) return apiError("Activation token is required", "VALIDATION_ERROR", 400);

    const result = await activationWorkflowService.mutate(token, step, body?.data || {}, {
      ip: req.headers.get("x-forwarded-for") || req.ip || "unknown",
      userAgent: req.headers.get("user-agent") || "unknown",
    });
    return apiResponse(result, 200);
  } catch (error: any) {
    const rawMessage = String(error?.message || "Failed to update activation workflow");
    const [maybeCode, ...rest] = rawMessage.split(":");
    const normalizedCode = rest.length > 0 ? maybeCode?.trim() : "ACTIVATION_ERROR";
    const normalizedMessage = rest.length > 0 ? rest.join(":").trim() : rawMessage;

    const statusMap: Record<string, number> = {
      INVALID: 410,
      EXPIRED: 410,
      ALREADY_ACTIVE: 409,
      CANCELLED: 410,
      INVALID_TRANSITION: 409,
      VALIDATION_ERROR: 400,
      BAD_REQUEST: 400,
      NOT_FOUND: 404,
      INTERNAL_ERROR: 500,
    };

    const status = statusMap[normalizedCode] || 500;
    return apiError(normalizedMessage, normalizedCode || "ACTIVATION_ERROR", status);
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) return apiError("Activation token is required", "VALIDATION_ERROR", 400);

    const result = await invitationService.validateActivationToken(token);
    return apiResponse(result, 200);
  } catch (error: any) {
    const rawMessage = String(error?.message || "Failed to validate activation link");
    const [maybeCode, ...rest] = rawMessage.split(":");
    const normalizedCode = maybeCode?.trim();
    const normalizedMessage = rest.length > 0 ? rest.join(":").trim() : rawMessage;

    const statusMap: Record<string, number> = {
      INVALID: 410,
      VALIDATION_ERROR: 400,
      INTERNAL_ERROR: 500,
    };

    const status = statusMap[normalizedCode] || 500;
    return apiError(normalizedMessage, normalizedCode || "ACTIVATION_ERROR", status);
  }
}
