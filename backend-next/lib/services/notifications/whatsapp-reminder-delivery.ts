import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";
import {
  MetaWhatsAppProvider,
  WhatsAppProviderError,
  WhatsAppValidationError,
  buildRentReminderBodyParameters,
  getMetaTemplateName,
  maskWhatsAppPhone,
  normalizeWhatsAppPhone,
  selectRentReminderTemplate,
} from "./providers/whatsapp";

const logger = getLogger("whatsapp.reminder-delivery");

export type WhatsAppRentReminderInput = {
  ownerId: string;
  tenantId: string;
  hostelId: string;
  obligationId: string;
  phone: string;
  tenantName: string;
  hostelName: string;
  amount: number;
  rentMonth: Date | string;
  dueDate: Date | string;
  daysOverdue: number;
  sendDateKey: string;
  prefs?: any;
};

type ReservationResult = {
  id: string;
  delivery_status: string;
};

export class WhatsAppReminderDeliveryService {
  constructor(private readonly provider = new MetaWhatsAppProvider()) {}

  async sendRentReminder(input: WhatsAppRentReminderInput) {
    const template = selectRentReminderTemplate(input.daysOverdue);
    const templateName = getMetaTemplateName(template);
    const idempotencyKey = `rent_reminder:${input.obligationId}:${template}:${input.sendDateKey}`;
    let normalizedPhone = input.phone;
    let maskedPhone = maskWhatsAppPhone(input.phone);

    const reserved = await this.reserveDelivery({
      ...input,
      phone: input.phone,
      templateName,
      idempotencyKey,
    });

    if (!reserved) {
      logger.info("whatsapp.reminder.duplicate_skipped", {
        owner_id: input.ownerId,
        tenant_id: input.tenantId,
        obligation_id: input.obligationId,
        template,
      });
      return { sent: false, skipped: true, idempotencyKey };
    }

    try {
      normalizedPhone = normalizeWhatsAppPhone(input.phone);
      maskedPhone = maskWhatsAppPhone(normalizedPhone);
      const bodyParameters = buildRentReminderBodyParameters(input);

      const result = await this.provider.sendTemplate({
        to: normalizedPhone,
        templateName,
        bodyParameters,
      });

      await prisma.$executeRaw`
        UPDATE whatsapp_logs
        SET status = 'SENT',
            delivery_status = 'SENT',
            provider_message_id = ${result.providerMessageId},
            provider_response = ${JSON.stringify(result.raw)}::jsonb,
            attempt_count = ${result.attempts},
            provider_error_code = NULL,
            provider_error_message = NULL
        WHERE id = ${reserved.id}::uuid
      `;

      logger.info("whatsapp.reminder.sent", {
        owner_id: input.ownerId,
        tenant_id: input.tenantId,
        obligation_id: input.obligationId,
        template,
        phone: maskedPhone,
        attempts: result.attempts,
      });

      return {
        sent: true,
        skipped: false,
        logId: reserved.id,
        providerMessageId: result.providerMessageId,
        idempotencyKey,
      };
    } catch (error: any) {
      await this.markFailed(reserved.id, error);
      logger.warn("whatsapp.reminder.failed", {
        owner_id: input.ownerId,
        tenant_id: input.tenantId,
        obligation_id: input.obligationId,
        template,
        phone: maskedPhone,
        retryable: error instanceof WhatsAppProviderError ? error.retryable : false,
        error_code: error?.providerCode || error?.code || "WHATSAPP_SEND_FAILED",
        error: String(error?.message || error),
      });
      throw error;
    }
  }

  private async reserveDelivery(input: WhatsAppRentReminderInput & {
    templateName: string;
    idempotencyKey: string;
  }): Promise<ReservationResult | null> {
    const rows = await prisma.$queryRaw<ReservationResult[]>`
      INSERT INTO whatsapp_logs (
        id,
        phone,
        template,
        template_name,
        obligation_id,
        owner_id,
        tenant_id,
        hostel_id,
        status,
        delivery_status,
        idempotency_key,
        attempt_count
      )
      VALUES (
        gen_random_uuid(),
        ${input.phone},
        ${input.templateName},
        ${input.templateName},
        ${input.obligationId}::uuid,
        ${input.ownerId}::uuid,
        ${input.tenantId}::uuid,
        ${input.hostelId}::uuid,
        'PENDING',
        'PENDING',
        ${input.idempotencyKey},
        0
      )
      ON CONFLICT (idempotency_key) DO UPDATE
      SET status = 'PENDING',
          delivery_status = 'PENDING',
          provider_message_id = NULL,
          provider_error_code = NULL,
          provider_error_message = NULL,
          error_message = NULL,
          attempt_count = 0,
          provider_response = NULL
      WHERE whatsapp_logs.status = 'FAILED'
         OR whatsapp_logs.delivery_status IN ('FAILED_FINAL', 'FAILED_RETRYABLE')
      RETURNING id::text, delivery_status
    `;

    return rows[0] || null;
  }

  private async markFailed(logId: string, error: unknown) {
    const normalized = normalizeDeliveryError(error);
    await prisma.$executeRaw`
      UPDATE whatsapp_logs
      SET status = 'FAILED',
          delivery_status = ${normalized.deliveryStatus},
          provider_error_code = ${normalized.code},
          provider_error_message = ${normalized.message},
          attempt_count = ${normalized.attempts},
          provider_response = ${normalized.raw ? JSON.stringify(normalized.raw) : null}::jsonb
      WHERE id = ${logId}::uuid
    `;
  }
}

function normalizeDeliveryError(error: unknown) {
  if (error instanceof WhatsAppProviderError) {
    return {
      deliveryStatus: error.retryable ? "FAILED_RETRYABLE" : "FAILED_FINAL",
      code: error.providerCode || error.code,
      message: error.message.slice(0, 500),
      attempts: error.attempts,
      raw: error.raw || null,
    };
  }

  if (error instanceof WhatsAppValidationError) {
    return {
      deliveryStatus: "FAILED_FINAL",
      code: error.code,
      message: error.message.slice(0, 500),
      attempts: 0,
      raw: null,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    deliveryStatus: "FAILED_FINAL",
    code: "WHATSAPP_SEND_FAILED",
    message: message.slice(0, 500),
    attempts: 0,
    raw: null,
  };
}

export const whatsappReminderDeliveryService = new WhatsAppReminderDeliveryService();
