import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";
import { incrementOtpDeliveryStatus } from "@/lib/metrics";

const logger = getLogger("whatsapp.webhook-event");

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: unknown;
        statuses?: MetaWebhookStatus[];
      };
    }>;
  }>;
};

type MetaWebhookStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  errors?: Array<{
    code?: number | string;
    title?: string;
    message?: string;
    details?: string;
  }>;
};

type WhatsAppLifecycleStatus = "SENT" | "DELIVERED" | "READ" | "FAILED";

type ExtractedStatusEvent = {
  eventType: string;
  providerMessageId: string;
  status: WhatsAppLifecycleStatus;
  providerTimestamp?: string;
  recipientId?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  rawStatus: MetaWebhookStatus;
};

type RecordReceivedInput = {
  rawBody: string;
  headers: Record<string, string>;
  signatureVerified: boolean;
  signatureAlgorithm?: string | null;
  signatureFailureReason?: string | null;
};

type RecordReceivedResult = {
  event: {
    id: string;
    processing_status: string;
    processing_result: unknown;
  };
  duplicate: boolean;
  eventHash: string;
  payload: unknown;
};

const PROVIDER = "META";
const STATUS_RANK: Record<string, number> = {
  UNKNOWN: 0,
  RESERVED: 0,
  PENDING: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED: 4,
  FAILED_RETRYABLE: 4,
  FAILED_FINAL: 4,
};

export function computeWhatsAppWebhookEventHash(rawBody: string) {
  return crypto
    .createHash("sha256")
    .update(`${PROVIDER}:${rawBody}`)
    .digest("hex");
}

export function redactWhatsAppWebhookHeaders(headers: Record<string, string>) {
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers || {})) {
    const lower = key.toLowerCase();
    if (["authorization", "cookie", "set-cookie", "x-hub-signature-256"].includes(lower)) {
      redacted[key] = value ? "[REDACTED]" : "";
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

function parseJson(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody);
  } catch {
    return { raw: rawBody };
  }
}

function normalizeStatus(status?: string): WhatsAppLifecycleStatus | null {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "sent") return "SENT";
  if (normalized === "delivered") return "DELIVERED";
  if (normalized === "read") return "READ";
  if (normalized === "failed") return "FAILED";
  return null;
}

function firstStatusEvent(payload: unknown) {
  return extractStatusEvents(payload)[0] || null;
}

function extractStatusEvents(payload: unknown): ExtractedStatusEvent[] {
  const webhook = payload as MetaWebhookPayload;
  const events: ExtractedStatusEvent[] = [];

  for (const entry of webhook.entry || []) {
    for (const change of entry.changes || []) {
      const statuses = change.value?.statuses || [];
      for (const item of statuses) {
        const lifecycleStatus = normalizeStatus(item.status);
        if (!lifecycleStatus || !item.id) continue;

        const error = item.errors?.[0];
        events.push({
          eventType: change.field || "messages",
          providerMessageId: item.id,
          status: lifecycleStatus,
          providerTimestamp: item.timestamp,
          recipientId: item.recipient_id,
          errorCode: error?.code ? String(error.code) : null,
          errorMessage: error?.message || error?.title || error?.details || null,
          rawStatus: item,
        });
      }
    }
  }

  return events;
}

export class WhatsAppWebhookEventService {
  async recordReceived(input: RecordReceivedInput): Promise<RecordReceivedResult> {
    const eventHash = computeWhatsAppWebhookEventHash(input.rawBody);
    const payload = parseJson(input.rawBody);
    const firstStatus = firstStatusEvent(payload);
    const eventType = firstStatus?.eventType || inferEventType(payload);
    const providerMessageId = firstStatus?.providerMessageId || null;

    const existing = await prisma.$queryRaw<Array<{
      id: string;
      processing_status: string;
      processing_result: unknown;
    }>>`
      SELECT id::text, processing_status, processing_result
      FROM whatsapp_webhook_events
      WHERE event_hash = ${eventHash}
      LIMIT 1
    `;

    if (existing[0]) {
      return { event: existing[0], duplicate: true, eventHash, payload };
    }

    const inserted = await prisma.$queryRaw<Array<{
      id: string;
      processing_status: string;
      processing_result: unknown;
    }>>`
      INSERT INTO whatsapp_webhook_events (
        provider,
        event_hash,
        event_type,
        provider_message_id,
        raw_payload,
        headers_redacted,
        signature_verified,
        signature_algorithm,
        signature_failure_reason,
        processing_status
      )
      VALUES (
        ${PROVIDER},
        ${eventHash},
        ${eventType},
        ${providerMessageId},
        ${JSON.stringify(payload)}::jsonb,
        ${JSON.stringify(redactWhatsAppWebhookHeaders(input.headers))}::jsonb,
        ${input.signatureVerified},
        ${input.signatureAlgorithm || null},
        ${input.signatureFailureReason || null},
        'RECEIVED'
      )
      RETURNING id::text, processing_status, processing_result
    `;

    return { event: inserted[0], duplicate: false, eventHash, payload };
  }

  async processWebhookEvent(eventId: string, payload: unknown) {
    await this.markProcessing(eventId);
    const statuses = extractStatusEvents(payload);

    if (statuses.length === 0) {
      const result = { status_events: 0, updated_logs: 0 };
      await this.markProcessed(eventId, result);
      return result;
    }

    let updatedLogs = 0;
    for (const statusEvent of statuses) {
      updatedLogs += await this.applyStatusEvent(statusEvent);
      await this.applyOtpStatusEvent(statusEvent);
    }

    const result = {
      status_events: statuses.length,
      updated_logs: updatedLogs,
      provider_message_ids: statuses.map((event) => event.providerMessageId),
    };
    await this.markProcessed(eventId, result);

    logger.info("whatsapp.webhook.processed", {
      webhook_event_id: eventId,
      status_events: statuses.length,
      updated_logs: updatedLogs,
    });

    return result;
  }

  async markFailed(eventId: string, error: string, status = "FAILED") {
    await prisma.$executeRaw`
      UPDATE whatsapp_webhook_events
      SET processing_status = ${status},
          error_message = ${error.slice(0, 500)},
          processed_at = now()
      WHERE id = ${eventId}::uuid
    `;
  }

  private async markProcessing(eventId: string) {
    await prisma.$executeRaw`
      UPDATE whatsapp_webhook_events
      SET processing_status = 'PROCESSING'
      WHERE id = ${eventId}::uuid
    `;
  }

  private async markProcessed(eventId: string, result: unknown) {
    await prisma.$executeRaw`
      UPDATE whatsapp_webhook_events
      SET processing_status = 'PROCESSED',
          processing_result = ${JSON.stringify(result)}::jsonb,
          processed_at = now()
      WHERE id = ${eventId}::uuid
    `;
  }

  private async applyStatusEvent(event: ExtractedStatusEvent) {
    const incomingRank = STATUS_RANK[event.status];
    const providerResponse = JSON.stringify({
      webhook_status: event.rawStatus,
      provider_timestamp: event.providerTimestamp || null,
      recipient_id: event.recipientId || null,
    });

    const count = await prisma.$executeRaw`
      UPDATE whatsapp_logs
      SET status = ${event.status},
          delivery_status = ${event.status},
          provider_error_code = ${event.status === "FAILED" ? event.errorCode : null},
          provider_error_message = ${event.status === "FAILED" ? event.errorMessage : null},
          provider_response = COALESCE(provider_response, '{}'::jsonb) || ${providerResponse}::jsonb
      WHERE provider_message_id = ${event.providerMessageId}
        AND (
          CASE delivery_status
            WHEN 'READ' THEN 3
            WHEN 'DELIVERED' THEN 2
            WHEN 'SENT' THEN 1
            WHEN 'FAILED' THEN 4
            WHEN 'FAILED_RETRYABLE' THEN 4
            WHEN 'FAILED_FINAL' THEN 4
            ELSE 0
          END
        ) <= ${incomingRank}
    `;

    if (count === 0) {
      logger.warn("whatsapp.webhook.unmatched_or_stale_status", {
        provider_message_id: event.providerMessageId,
        status: event.status,
      });
    }

    return Number(count || 0);
  }

  private async applyOtpStatusEvent(event: ExtractedStatusEvent) {
    incrementOtpDeliveryStatus(event.status);

    const count = await prisma.$executeRaw`
      UPDATE phone_verification_otps
      SET provider_status = ${event.status},
          failure_reason = ${event.status === "FAILED" ? event.errorMessage : null}
      WHERE meta_message_id = ${event.providerMessageId}
    `;

    if (Number(count || 0) > 0) {
      logger.info("whatsapp.webhook.otp_status_updated", {
        provider_message_id: event.providerMessageId,
        status: event.status,
        updated_otps: Number(count || 0),
      });
    }
  }
}

function inferEventType(payload: unknown) {
  const webhook = payload as MetaWebhookPayload;
  return webhook.entry?.[0]?.changes?.[0]?.field || null;
}

export const whatsappWebhookEventService = new WhatsAppWebhookEventService();
