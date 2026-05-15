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

    console.log("Send OTP endpoint reached:", {
      phone,
      normalizedPhone,
      msg91AuthKeyExists: Boolean(process.env.MSG91_AUTH_KEY),
      msg91TemplateId: process.env.MSG91_TEMPLATE_ID,
    });

    const result = await msg91Service.sendOtp(normalizedPhone);

    console.log("Send OTP endpoint MSG91 result:", result);

    return apiResponse({ message: "OTP sent successfully" });
  } catch (error: any) {
    console.error("Send OTP endpoint error:", error);
    return apiError(error.message || "Failed to send OTP", "INTERNAL_ERROR", 500);
  }
}
