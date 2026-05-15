import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { apiResponse, apiError } from "@/lib/auth";
import { generateIdentityToken } from "@/lib/auth-edge";
import { prisma } from "@/lib/db";
import { msg91Service } from "@/lib/services/msg91-service";
import { normalizeIndianPhone } from "@/lib/utils/phone-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OTP_PURPOSE = "PHONE_VERIFICATION";
const REGISTRATION_ACTION = "registration";
const TENANT_ACTION = "tenant_onboarding";

async function issueVerificationToken(phone: string, action: string) {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.identity_tokens.create({
    data: {
      jti,
      user_id: "PENDING_PHONE_VERIFICATION",
      purpose: OTP_PURPOSE,
      action,
      expires_at: expiresAt,
      used: false,
    },
  });

  return generateIdentityToken(phone, OTP_PURPOSE, jti, action);
}

export async function POST(req: NextRequest) {
  try {
    const { phone, otp, action } = await req.json();

    if (!phone || !otp) {
      return apiError("Phone and OTP are required", "VALIDATION_ERROR", 400);
    }

    const normalizedPhone = normalizeIndianPhone(phone);
    if (!normalizedPhone) {
      return apiError("Invalid Indian phone number", "VALIDATION_ERROR", 400);
    }

    await msg91Service.verifyOtp(normalizedPhone, otp);

    const tokenAction = action === TENANT_ACTION ? TENANT_ACTION : REGISTRATION_ACTION;
    const verificationToken = await issueVerificationToken(normalizedPhone, tokenAction);

    return apiResponse({
      message: "OTP verified successfully",
      verification_token: verificationToken,
    });
  } catch (error: any) {
    return apiError(error.message || "OTP verification failed", "UNAUTHORIZED", 401);
  }
}
