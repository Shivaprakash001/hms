import { getLogger } from "@/lib/logger";
import {
  WhatsAppConfigError,
  WhatsAppProviderError,
  WhatsAppValidationError,
} from "./errors";
import type {
  MetaWhatsAppErrorBody,
  WhatsAppProviderConfig,
  WhatsAppSendResult,
  WhatsAppTemplateMessage,
} from "./types";

const logger = getLogger("whatsapp.meta-provider");

const DEFAULT_BASE_URL = "https://graph.facebook.com/v19.0";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_INVITATION_TEMPLATE = "tenant_account_activation_v2";
const LEGACY_MISSING_INVITATION_TEMPLATE = "hms_tenant_invite_v2";

function configFromEnv(): WhatsAppProviderConfig {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID;
  if (!accessToken) throw new WhatsAppConfigError("WHATSAPP_ACCESS_TOKEN or WHATSAPP_TOKEN is not configured");
  if (!phoneNumberId) throw new WhatsAppConfigError("WHATSAPP_PHONE_NUMBER_ID or PHONE_NUMBER_ID is not configured");

  return {
    accessToken,
    phoneNumberId,
    baseUrl: (process.env.WHATSAPP_API || DEFAULT_BASE_URL).replace(/\/$/, ""),
    timeoutMs: Number(process.env.WHATSAPP_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    maxRetries: Number(process.env.WHATSAPP_MAX_RETRIES || DEFAULT_MAX_RETRIES),
  };
}

export function validateWhatsAppConfiguration() {
  if (process.env.OTP_PROVIDER !== "whatsapp") {
    return;
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID;
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const otpTemplate = process.env.WHATSAPP_OTP_TEMPLATE;

  const missing = [];
  if (!accessToken) missing.push("WHATSAPP_ACCESS_TOKEN/WHATSAPP_TOKEN");
  if (!phoneNumberId) missing.push("WHATSAPP_PHONE_NUMBER_ID/PHONE_NUMBER_ID");
  if (!businessAccountId) missing.push("WHATSAPP_BUSINESS_ACCOUNT_ID");
  if (!otpTemplate) missing.push("WHATSAPP_OTP_TEMPLATE");

  if (missing.length > 0) {
    throw new Error(
      `CRITICAL CONFIGURATION ERROR: OTP_PROVIDER is set to 'whatsapp' but the following required environment variable(s) are missing: ${missing.join(", ")}`
    );
  }
}

export function normalizeWhatsAppPhone(raw: string): string {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) throw new WhatsAppValidationError("Recipient phone number is empty");

  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.startsWith("91") && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length < 8 || digits.length > 15) {
    throw new WhatsAppValidationError("Recipient phone number is not a valid international number");
  }
  return digits;
}

export function maskWhatsAppPhone(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function providerCode(body: MetaWhatsAppErrorBody): string | undefined {
  const code = body.error?.code;
  const subcode = body.error?.error_subcode;
  if (code && subcode) return `${code}:${subcode}`;
  if (code) return String(code);
  return undefined;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractActivationToken(activationLink: string): string {
  try {
    const url = new URL(activationLink);
    const token = url.pathname.split("/").filter(Boolean).pop();
    return token ? decodeURIComponent(token) : activationLink;
  } catch {
    const token = String(activationLink || "").split("/").filter(Boolean).pop();
    return token || activationLink;
  }
}

function invitationTemplateName(): string {
  const configured = String(process.env.WHATSAPP_INVITATION_TEMPLATE || "").trim();
  if (!configured || configured === LEGACY_MISSING_INVITATION_TEMPLATE) {
    return DEFAULT_INVITATION_TEMPLATE;
  }
  return configured;
}

function invitationTemplateLanguage(templateName: string): string {
  const configured = String(process.env.WHATSAPP_INVITATION_LANGUAGE || "").trim();
  if (configured) return configured;
  if (templateName === "tenant_account_activation_v2") return "en";
  return "en_IN";
}

export class MetaWhatsAppProvider {
  private readonly config: WhatsAppProviderConfig;

  constructor(config: WhatsAppProviderConfig = configFromEnv()) {
    this.config = config;
  }

  async sendTemplate(message: WhatsAppTemplateMessage): Promise<WhatsAppSendResult> {
    const phone = normalizeWhatsAppPhone(message.to);
    const url = `${this.config.baseUrl}/${this.config.phoneNumberId}/messages`;
    const body = {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: message.templateName,
        language: message.language || { code: "en" },
        ...(message.bodyParameters?.length
          ? {
              components: [{
                type: "body",
                parameters: message.bodyParameters.map((text) => ({ type: "text", text: String(text) })),
              }],
            }
          : {}),
      },
    };

    let lastError: WhatsAppProviderError | null = null;
    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt += 1) {
      try {
        const result = await this.post(url, body, attempt);
        const providerMessageId = Array.isArray((result as any)?.messages)
          ? String((result as any).messages[0]?.id || "")
          : "";
        return {
          providerMessageId: providerMessageId || null,
          raw: result,
          attempts: attempt,
        };
      } catch (error: any) {
        if (error instanceof WhatsAppProviderError) {
          lastError = error;
          if (!error.retryable || attempt > this.config.maxRetries) throw error;
          await sleep(Math.min(1000 * 2 ** (attempt - 1), 5000));
          continue;
        }
        throw error;
      }
    }

    throw lastError || new WhatsAppProviderError({
      message: "WhatsApp send failed",
      code: "WHATSAPP_SEND_FAILED",
      retryable: false,
      attempts: this.config.maxRetries + 1,
    });
  }

  async sendOtp(input: { to: string; otp: string; purpose: string }): Promise<WhatsAppSendResult> {
    const phone = normalizeWhatsAppPhone(input.to);
    const templateName = process.env.WHATSAPP_OTP_TEMPLATE;
    if (!templateName) {
      throw new WhatsAppConfigError("WHATSAPP_OTP_TEMPLATE is not configured");
    }

    const url = `${this.config.baseUrl}/${this.config.phoneNumberId}/messages`;
    const isTextMessage = templateName.toLowerCase() === "text";
    const body = isTextMessage
      ? {
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: {
            body: `Your HMS verification code is: ${input.otp}. This code is for ${input.purpose}. Valid for 5 minutes.`
          }
        }
      : {
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: templateName,
            language: { code: "en_US" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: String(input.otp) },
                  { type: "text", text: String(input.purpose) },
                ],
              },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [
                  { type: "text", text: String(input.otp) },
                ],
              },
            ],
          },
        };

    logger.info("whatsapp.otp.send_started", {
      phone: maskWhatsAppPhone(phone),
      templateName,
      purpose: input.purpose,
      isTextMessage,
    });

    let lastError: WhatsAppProviderError | null = null;
    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt += 1) {
      try {
        const result = await this.post(url, body, attempt);
        const providerMessageId = Array.isArray((result as any)?.messages)
          ? String((result as any).messages[0]?.id || "")
          : "";

        logger.info("whatsapp.otp.send_success", {
          phone: maskWhatsAppPhone(phone),
          attempts: attempt,
          providerMessageId,
        });

        return {
          providerMessageId: providerMessageId || null,
          raw: result,
          attempts: attempt,
        };
      } catch (error: any) {
        if (error instanceof WhatsAppProviderError) {
          lastError = error;
          if (!error.retryable || attempt > this.config.maxRetries) {
            logger.error("whatsapp.otp.send_failed", {
              phone: maskWhatsAppPhone(phone),
              attempts: attempt,
              error_code: error.providerCode || error.code || "WHATSAPP_SEND_FAILED",
              error: error.message,
            });
            throw error;
          }
          await sleep(Math.min(1000 * 2 ** (attempt - 1), 5000));
          continue;
        }
        logger.error("whatsapp.otp.send_failed", {
          phone: maskWhatsAppPhone(phone),
          attempts: attempt,
          error: String(error?.message || error),
        });
        throw error;
      }
    }

    throw lastError || new WhatsAppProviderError({
      message: "WhatsApp OTP send failed",
      code: "WHATSAPP_OTP_SEND_FAILED",
      retryable: false,
      attempts: this.config.maxRetries + 1,
    });
  }

  async sendInvitation(input: {
    to: string;
    tenantName: string;
    ownerName: string;
    hostelName: string;
    roomNumber: string;
    roomRent: number;
    activationLink: string;
  }): Promise<WhatsAppSendResult> {
    const phone = normalizeWhatsAppPhone(input.to);
    const templateName = invitationTemplateName();
    const languageCode = invitationTemplateLanguage(templateName);
    const activationToken = extractActivationToken(input.activationLink);
    const url = `${this.config.baseUrl}/${this.config.phoneNumberId}/messages`;
    const useText = templateName.toLowerCase() === "text";
    const body = useText
      ? {
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: {
            body: `Hello ${input.tenantName}, you have been invited by ${input.ownerName} to join ${input.hostelName}, Room ${input.roomNumber}. Rent: ₹${input.roomRent}. Complete your onboarding here: ${input.activationLink}`
          }
        }
      : {
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: templateName,
            language: { code: languageCode },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: String(input.tenantName) },
                  { type: "text", text: String(input.roomNumber) },
                  { type: "text", text: String(input.roomRent) }
                ],
              },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [
                  { type: "text", text: activationToken },
                ],
              },
            ]
          }
        };

    logger.info("whatsapp.invitation.send_started", {
      phone: maskWhatsAppPhone(phone),
      templateName,
      languageCode,
      useText
    });

    let lastError: WhatsAppProviderError | null = null;
    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt += 1) {
      try {
        const result = await this.post(url, body, attempt);
        const providerMessageId = Array.isArray((result as any)?.messages)
          ? String((result as any).messages[0]?.id || "")
          : "";

        logger.info("whatsapp.invitation.send_success", {
          phone: maskWhatsAppPhone(phone),
          attempts: attempt,
          providerMessageId,
        });

        return {
          providerMessageId: providerMessageId || null,
          raw: result,
          attempts: attempt,
        };
      } catch (error: any) {
        if (error instanceof WhatsAppProviderError) {
          lastError = error;
          if (!error.retryable || attempt > this.config.maxRetries) {
            logger.error("whatsapp.invitation.send_failed", {
              phone: maskWhatsAppPhone(phone),
              attempts: attempt,
              error_code: error.providerCode || error.code || "WHATSAPP_SEND_FAILED",
              error: error.message,
            });
            throw error;
          }
          await sleep(Math.min(1000 * 2 ** (attempt - 1), 5000));
          continue;
        }
        logger.error("whatsapp.invitation.send_failed", {
          phone: maskWhatsAppPhone(phone),
          attempts: attempt,
          error: String(error?.message || error),
        });
        throw error;
      }
    }

    throw lastError || new WhatsAppProviderError({
      message: "WhatsApp invitation send failed",
      code: "WHATSAPP_INVITATION_SEND_FAILED",
      retryable: false,
      attempts: this.config.maxRetries + 1,
    });
  }

  private async post(url: string, body: unknown, attempt: number): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const rawText = await response.text();
      const parsed = rawText ? safeJson(rawText) : {};
      if (response.ok) return parsed;

      const metaBody = parsed as MetaWhatsAppErrorBody;
      const code = providerCode(metaBody);
      const message = metaBody.error?.message || `WhatsApp API returned ${response.status}`;
      throw new WhatsAppProviderError({
        message,
        code: "WHATSAPP_PROVIDER_ERROR",
        providerCode: code,
        retryable: isRetryableStatus(response.status),
        status: response.status,
        attempts: attempt,
        raw: parsed,
      });
    } catch (error: any) {
      if (error instanceof WhatsAppProviderError) throw error;
      const isAbort = error?.name === "AbortError";
      logger.warn("whatsapp.request_failed", {
        attempt,
        retryable: true,
        error: isAbort ? "request_timeout" : String(error?.message || error),
      });
      throw new WhatsAppProviderError({
        message: isAbort ? "WhatsApp request timed out" : "WhatsApp network request failed",
        code: isAbort ? "WHATSAPP_TIMEOUT" : "WHATSAPP_NETWORK_ERROR",
        retryable: true,
        attempts: attempt,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

if (process.env.OTP_PROVIDER === "whatsapp") {
  validateWhatsAppConfiguration();
}
