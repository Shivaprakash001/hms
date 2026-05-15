import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";
import { incrementOtpMetric } from "@/lib/metrics";
import { maskWhatsAppPhone } from "@/lib/services/notifications/providers/whatsapp";
import { WhatsAppAuthProvider } from "./whatsapp-auth-provider";

const logger = getLogger("auth.otp-service");

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_LENGTH_MIN = 100000;
const OTP_LENGTH_MAX_EXCLUSIVE = 1000000;
const MAX_ATTEMPTS = 5;
const PHONE_SEND_LIMIT = 3;
const PHONE_SEND_WINDOW_MS = 15 * 60 * 1000;
const IP_SEND_LIMIT = 10;
const IP_SEND_WINDOW_MS = 60 * 60 * 1000;

export class OtpServiceError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "OtpServiceError";
  }
}

type SendOtpInput = {
  phone: string;
  purpose: string;
  requestIp?: string | null;
};

type VerifyOtpInput = {
  phone: string;
  otp: string;
  purpose: string;
};

export class AuthOtpService {
  constructor(private readonly provider = new WhatsAppAuthProvider()) {}

  async sendPhoneOtp(input: SendOtpInput) {
    const phone = input.phone;
    const purpose = input.purpose;
    const requestIp = input.requestIp || null;
    const now = new Date();

    await this.enforceSendRateLimits(phone, requestIp, now);
    await (prisma as any).phoneVerificationOtp.updateMany({
      where: { phone, purpose, status: "PENDING" },
      data: { status: "EXPIRED", failure_reason: "superseded by new OTP request" },
    });

    const otp = String(crypto.randomInt(OTP_LENGTH_MIN, OTP_LENGTH_MAX_EXCLUSIVE));
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

    const record = await (prisma as any).phoneVerificationOtp.create({
      data: {
        phone,
        otp_hash: otpHash,
        purpose,
        status: "PENDING",
        max_attempts: MAX_ATTEMPTS,
        expires_at: expiresAt,
        provider_status: "PENDING",
        request_ip: requestIp,
      },
    });

    incrementOtpMetric("requests_total");

    try {
      const sendResult = await this.provider.sendOtp({ to: phone, otp });
      await (prisma as any).phoneVerificationOtp.update({
        where: { id: record.id },
        data: {
          meta_message_id: sendResult.providerMessageId,
          provider_status: "SENT",
          failure_reason: null,
        },
      });

      logger.metrics("otp.request.sent", {
        phone: maskWhatsAppPhone(phone),
        purpose,
        otp_id: record.id,
        meta_message_id: sendResult.providerMessageId,
      });

      return {
        success: true,
        expires_in_seconds: Math.floor(OTP_TTL_MS / 1000),
      };
    } catch (error: any) {
      incrementOtpMetric("send_failures");
      await (prisma as any).phoneVerificationOtp.update({
        where: { id: record.id },
        data: {
          status: "FAILED",
          provider_status: "FAILED",
          failure_reason: String(error?.message || error).slice(0, 500),
        },
      });

      logger.warn("otp.request.send_failed", {
        phone: maskWhatsAppPhone(phone),
        purpose,
        otp_id: record.id,
        error_code: error?.providerCode || error?.code || "OTP_SEND_FAILED",
        error: String(error?.message || error),
      });

      throw new OtpServiceError("Failed to send OTP", "OTP_SEND_FAILED", 502);
    }
  }

  async verifyPhoneOtp(input: VerifyOtpInput) {
    incrementOtpMetric("verifications_total");

    const record = await (prisma as any).phoneVerificationOtp.findFirst({
      where: {
        phone: input.phone,
        purpose: input.purpose,
        status: "PENDING",
      },
      orderBy: { created_at: "desc" },
    });

    if (!record) {
      incrementOtpMetric("verification_failures");
      throw new OtpServiceError("Invalid or expired OTP", "OTP_INVALID", 400);
    }

    const now = new Date();
    if (record.expires_at <= now) {
      incrementOtpMetric("expired_total");
      incrementOtpMetric("verification_failures");
      await (prisma as any).phoneVerificationOtp.update({
        where: { id: record.id },
        data: { status: "EXPIRED", failure_reason: "expired before verification" },
      });
      throw new OtpServiceError("OTP expired", "OTP_EXPIRED", 400);
    }

    if (record.attempts >= record.max_attempts) {
      incrementOtpMetric("verification_failures");
      await (prisma as any).phoneVerificationOtp.update({
        where: { id: record.id },
        data: { status: "FAILED", failure_reason: "maximum attempts exceeded" },
      });
      throw new OtpServiceError("OTP attempts exceeded", "OTP_ATTEMPTS_EXCEEDED", 429);
    }

    const matches = await bcrypt.compare(input.otp, record.otp_hash);
    if (!matches) {
      incrementOtpMetric("verification_failures");
      const nextAttempts = record.attempts + 1;
      await (prisma as any).phoneVerificationOtp.update({
        where: { id: record.id },
        data: {
          attempts: nextAttempts,
          ...(nextAttempts >= record.max_attempts
            ? { status: "FAILED", failure_reason: "maximum attempts exceeded" }
            : {}),
        },
      });
      throw new OtpServiceError("Invalid OTP", "OTP_INVALID", 400);
    }

    const profilePhones = profilePhoneCandidates(input.phone);
    const result = await prisma.$transaction(async (tx) => {
      const verified = await (tx as any).phoneVerificationOtp.updateMany({
        where: { id: record.id, status: "PENDING" },
        data: {
          status: "VERIFIED",
          verified_at: now,
          provider_status: "VERIFIED",
        },
      });

      if (verified.count !== 1) {
        throw new OtpServiceError("OTP already used", "OTP_ALREADY_USED", 409);
      }

      const profileUpdate = await (tx.profile as any).updateMany({
        where: { phone: { in: profilePhones } },
        data: {
          phone_verified: true,
          mobile_verified: true,
          updated_at: now,
        },
      });

      return { profileUpdated: profileUpdate.count };
    });

    logger.metrics("otp.verification.success", {
      phone: maskWhatsAppPhone(input.phone),
      purpose: input.purpose,
      otp_id: record.id,
      profile_updated: result.profileUpdated,
    });

    return {
      success: true,
      phone_verified: true,
      profile_updated: result.profileUpdated,
    };
  }

  private async enforceSendRateLimits(phone: string, requestIp: string | null, now: Date) {
    const phoneWindow = new Date(now.getTime() - PHONE_SEND_WINDOW_MS);
    const phoneCount = await (prisma as any).phoneVerificationOtp.count({
      where: { phone, created_at: { gte: phoneWindow } },
    });

    if (phoneCount >= PHONE_SEND_LIMIT) {
      incrementOtpMetric("rate_limit_hits");
      logger.warn("otp.rate_limited", {
        scope: "phone",
        phone: maskWhatsAppPhone(phone),
      });
      throw new OtpServiceError("Too many OTP requests for this phone", "OTP_RATE_LIMITED", 429);
    }

    if (requestIp) {
      const ipWindow = new Date(now.getTime() - IP_SEND_WINDOW_MS);
      const ipCount = await (prisma as any).phoneVerificationOtp.count({
        where: { request_ip: requestIp, created_at: { gte: ipWindow } },
      });

      if (ipCount >= IP_SEND_LIMIT) {
        incrementOtpMetric("rate_limit_hits");
        logger.warn("otp.rate_limited", {
          scope: "ip",
          request_ip: requestIp,
        });
        throw new OtpServiceError("Too many OTP requests", "OTP_RATE_LIMITED", 429);
      }
    }
  }
}

function profilePhoneCandidates(normalizedPhone: string) {
  const local10 = normalizedPhone.startsWith("91") && normalizedPhone.length === 12
    ? normalizedPhone.slice(2)
    : normalizedPhone;

  return Array.from(new Set([
    normalizedPhone,
    `+${normalizedPhone}`,
    local10,
    `+91${local10}`,
  ]));
}

export const authOtpService = new AuthOtpService();
