export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { apiResponse, apiError } from "@/lib/auth";
import { authService } from "@/lib/services/auth-service";
import { RegisterSchema } from "@/lib/validators";
import { normalizeIndianPhone, verifyFirebasePhoneToken } from "@/lib/firebase-admin";


/**
 * 📝 AUTH REGISTER — Owner Registration
 * Public endpoint. Only creates Owner/Admin accounts.
 * Tenants must be invited by an owner.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = RegisterSchema.safeParse(body);

    if (!validated.success) {
      return apiError("Validation error", "VALIDATION_ERROR", 400);
    }

    const normalizedPhone = normalizeIndianPhone(validated.data.phone);
    if (!normalizedPhone) {
      return apiError("Valid Indian mobile number is required", "VALIDATION_ERROR", 400);
    }

    await verifyFirebasePhoneToken(validated.data.firebase_phone_id_token, normalizedPhone);

    const profile = await authService.registerOwner({
      ...validated.data,
      phone: normalizedPhone,
      mobile_verified: true,
    });

    return apiResponse(profile, 201);
  } catch (error: any) {
    if (error.message.startsWith("ALREADY_EXISTS"))
      return apiError(error.message.split(": ")[1], "ALREADY_EXISTS", 400);
    if (error.message.startsWith("PHONE_VERIFICATION_FAILED"))
      return apiError(error.message.split(": ")[1], "PHONE_VERIFICATION_FAILED", 403);
    if (error.message.startsWith("INTERNAL"))
      return apiError(error.message.split(": ")[1], "INTERNAL_ERROR", 500);
    return apiError(error.message || "Registration failed");
  }
}
