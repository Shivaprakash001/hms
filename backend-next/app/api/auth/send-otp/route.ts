import { NextRequest } from "next/server";
import { apiResponse, apiError } from "@/lib/auth";
import { msg91Service } from "@/lib/services/msg91-service";
import { normalizeIndianPhone } from "@/lib/utils/phone-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return apiError("Phone number is required", "VALIDATION_ERROR", 400);
    }

    const normalizedPhone = normalizeIndianPhone(phone);
    if (!normalizedPhone) {
      return apiError("Invalid Indian phone number", "VALIDATION_ERROR", 400);
    }

    await msg91Service.sendOtp(normalizedPhone);

    return apiResponse({ message: "OTP sent successfully" });
  } catch (error: any) {
    return apiError(error.message || "Failed to send OTP", "INTERNAL_ERROR", 500);
  }
}
