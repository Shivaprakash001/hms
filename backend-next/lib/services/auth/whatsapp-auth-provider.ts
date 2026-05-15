import { getLogger } from "@/lib/logger";
import {
  maskWhatsAppPhone,
  normalizeWhatsAppPhone,
  WhatsAppConfigError,
  WhatsAppProviderError,
} from "@/lib/services/notifications/providers/whatsapp";
import type {
  MetaWhatsAppErrorBody,
  WhatsAppProviderConfig,
  WhatsAppSendResult,
} from "@/lib/services/notifications/providers/whatsapp";

const logger = getLogger("auth.whatsapp-otp-provider");

const DEFAULT_BASE_URL = "https://graph.facebook.com/v19.0";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const AUTH_TEMPLATE_NAME = "otp_phone";
const AUTH_TEMPLATE_LANGUAGE = "en_US";

function configFromEnv(): WhatsAppProviderConfig {
  const accessToken = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.PHONE_NUMBER_ID;
  if (!accessToken) throw new WhatsAppConfigError("WHATSAPP_TOKEN is not configured");
  if (!phoneNumberId) throw new WhatsAppConfigError("PHONE_NUMBER_ID is not configured");

  return {
    accessToken,
    phoneNumberId,
    baseUrl: (process.env.WHATSAPP_API || DEFAULT_BASE_URL).replace(/\/$/, ""),
    timeoutMs: Number(process.env.WHATSAPP_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    maxRetries: Number(process.env.WHATSAPP_MAX_RETRIES || DEFAULT_MAX_RETRIES),
  };
}

function providerCode(body: MetaWhatsAppErrorBody): string | undefined {
  const code = body.error?.code;
  const subcode = body.error?.error_subcode;
  if (code && subcode) return `${code}:${subcode}`;
  if (code) return String(code);
  return undefined;
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

export class WhatsAppAuthProvider {
  private readonly config: WhatsAppProviderConfig;

  constructor(config: WhatsAppProviderConfig = configFromEnv()) {
    this.config = config;
  }

  async sendOtp(input: { to: string; otp: string }): Promise<WhatsAppSendResult> {
    const phone = normalizeWhatsAppPhone(input.to);
    const url = `${this.config.baseUrl}/${this.config.phoneNumberId}/messages`;
    const body = buildAuthTemplatePayload(phone, input.otp);

    let lastError: WhatsAppProviderError | null = null;
    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt += 1) {
      try {
        const result = await this.post(url, body, attempt);
        const providerMessageId = Array.isArray((result as any)?.messages)
          ? String((result as any).messages[0]?.id || "")
          : "";

        logger.info("auth.whatsapp_otp.sent", {
          phone: maskWhatsAppPhone(phone),
          attempts: attempt,
        });

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
      message: "WhatsApp OTP send failed",
      code: "WHATSAPP_OTP_SEND_FAILED",
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
      throw new WhatsAppProviderError({
        message: metaBody.error?.message || `WhatsApp API returned ${response.status}`,
        code: "WHATSAPP_PROVIDER_ERROR",
        providerCode: providerCode(metaBody),
        retryable: isRetryableStatus(response.status),
        status: response.status,
        attempts: attempt,
        raw: parsed,
      });
    } catch (error: any) {
      if (error instanceof WhatsAppProviderError) throw error;
      const isAbort = error?.name === "AbortError";
      throw new WhatsAppProviderError({
        message: isAbort ? "WhatsApp OTP request timed out" : "WhatsApp OTP network request failed",
        code: isAbort ? "WHATSAPP_TIMEOUT" : "WHATSAPP_NETWORK_ERROR",
        retryable: true,
        attempts: attempt,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function buildAuthTemplatePayload(phone: string, otp: string) {
  return {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: AUTH_TEMPLATE_NAME,
      language: { code: AUTH_TEMPLATE_LANGUAGE },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: otp }],
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: otp }],
        },
      ],
    },
  };
}
