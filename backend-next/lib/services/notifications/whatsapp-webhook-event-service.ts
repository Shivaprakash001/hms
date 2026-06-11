import crypto from "crypto";
import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";
import { incrementOtpDeliveryStatus } from "@/lib/metrics";
import { formatDate, formatShortMonth } from "@/lib/format";
import { financialService } from "@/src/services/payments/financial-service";
import { rateLimitService } from "@/lib/services/rate-limit-service";
import { MetaWhatsAppProvider } from "./providers/whatsapp/meta-provider";
import {
  getSelectionState,
  setSelectionState,
  deleteSelectionState,
  BalanceSelectionState,
} from "./whatsapp-selection-state";

const logger = getLogger("whatsapp.webhook-event");

function getPhoneCandidates(rawPhone: string): string[] {
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return [];
  const candidates = [digits, rawPhone];
  if (digits.length === 12 && digits.startsWith("91")) {
    const tenDigits = digits.slice(2);
    candidates.push(tenDigits);
    candidates.push(`+91${tenDigits}`);
    candidates.push(`0${tenDigits}`);
  } else if (digits.length === 10) {
    candidates.push(`91${digits}`);
    candidates.push(`+91${digits}`);
    candidates.push(`0${digits}`);
  }
  return Array.from(new Set(candidates));
}

function formatAmountWithoutSymbol(amount: number): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

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

type ExtractedMessageEvent = {
  from: string;
  messageId: string;
  timestamp: string;
  body: string;
};

function extractMessageEvents(payload: unknown): ExtractedMessageEvent[] {
  const webhook = payload as any;
  const events: ExtractedMessageEvent[] = [];

  for (const entry of webhook.entry || []) {
    for (const change of entry.changes || []) {
      const messages = change.value?.messages || [];
      for (const item of messages) {
        if (item.type === "text" && item.text?.body) {
          events.push({
            from: item.from,
            messageId: item.id,
            timestamp: item.timestamp,
            body: item.text.body,
          });
        }
      }
    }
  }

  return events;
}

export class WhatsAppWebhookEventService {
  private static readonly COMMAND_HANDLERS: Record<
    string,
    (service: WhatsAppWebhookEventService, msg: ExtractedMessageEvent) => Promise<any>
  > = {
    BAL: (service, msg) => service.handleBalanceCommand(msg),
    BALANCE: (service, msg) => service.handleBalanceCommand(msg),
  };

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

    // 1. Check for inbound messages (commands)
    const messages = extractMessageEvents(payload);
    if (messages.length > 0) {
      let processedCommands = 0;
      const commandResults: any[] = [];

      for (const msg of messages) {
        const cleanBody = msg.body.trim().toUpperCase();
        const handler = WhatsAppWebhookEventService.COMMAND_HANDLERS[cleanBody];
        if (handler) {
          const res = await handler(this, msg);
          commandResults.push(res);
          processedCommands++;
        } else {
          // Check if there is an active selection state for this sender
          const selectionState = await getSelectionState(msg.from);
          if (selectionState) {
            const res = await this.handleSelectionReply(msg, selectionState);
            commandResults.push(res);
            processedCommands++;
          }
        }
      }

      if (processedCommands > 0) {
        const result = {
          inbound_messages: messages.length,
          processed_commands: processedCommands,
          command_results: commandResults,
        };
        await this.markProcessed(eventId, result);
        return result;
      }
    }

    // 2. Fallback to status events processing
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

  private async handleBalanceCommand(msg: ExtractedMessageEvent) {
    const phone = msg.from;
    const command = msg.body.trim().toUpperCase();

    // 1. Per-sender Rate Limiting (1 request/minute)
    const rateLimitResult = await rateLimitService.checkStatelessLimit({
      scope: "whatsapp_command:BAL",
      identifier: phone,
      maxAttempts: 1,
      windowSeconds: 60,
    });

    if (!rateLimitResult.allowed) {
      logger.warn("whatsapp.command.rate_limited", { phone });

      const provider = new MetaWhatsAppProvider();
      let providerMessageId: string | null = null;
      let providerResponse: any = null;
      let success = false;
      let errorMsg: string | null = null;

      try {
        const sendResult = await provider.sendTextMessage(
          phone,
          "You are requesting updates too frequently. Please wait 1 minute before sending another request."
        );
        providerMessageId = sendResult.providerMessageId;
        providerResponse = sendResult.raw;
        success = true;
      } catch (err: any) {
        errorMsg = err.message || String(err);
      }

      const auditLog = {
        command,
        sender_role: "UNKNOWN",
        success,
        template_used: "text",
        failure_reason: "Rate limit exceeded" + (errorMsg ? `: ${errorMsg}` : ""),
      };

      await prisma.$executeRaw`
        INSERT INTO whatsapp_logs (
          id,
          phone,
          template,
          template_name,
          status,
          delivery_status,
          attempt_count,
          provider_message_id,
          provider_response,
          error_message
        )
        VALUES (
          gen_random_uuid(),
          ${phone},
          'text',
          'BAL',
          'RATE_LIMITED',
          'RATE_LIMITED',
          1,
          ${providerMessageId},
          ${JSON.stringify(auditLog)}::jsonb,
          ${errorMsg}
        )
      `;

      return { phone, command, success: false, reason: "RATE_LIMITED" };
    }

    // 2. Resolve Phone to Active/Invited Tenants
    const candidates = getPhoneCandidates(phone);
    const matchingTenants = await prisma.tenants.findMany({
      where: {
        OR: [
          { phone_1: { in: candidates } },
          { phone_2: { in: candidates } },
          { phone_3: { in: candidates } },
          { guardian_phone: { in: candidates } },
          {
            profiles: {
              phone: { in: candidates }
            }
          }
        ]
      },
      include: {
        profiles: true,
      }
    });

    // Filter by active status
    const activeTenants = matchingTenants.filter(
      (t) => t.status === "ACTIVE" || t.status === "INVITED"
    );

    // Fail-safe denial for no matches
    if (activeTenants.length === 0) {
      const failureReason = "No active tenant found";

      logger.warn("whatsapp.command.unauthorized", {
        phone,
        reason: failureReason,
        matches_found: activeTenants.length,
      });

      const provider = new MetaWhatsAppProvider();
      let providerMessageId: string | null = null;
      let providerResponse: any = null;
      let success = false;
      let errorMsg: string | null = null;

      try {
        const sendResult = await provider.sendTextMessage(
          phone,
          "Sorry, this number is not linked to an active resident account."
        );
        providerMessageId = sendResult.providerMessageId;
        providerResponse = sendResult.raw;
        success = true;
      } catch (err: any) {
        errorMsg = err.message || String(err);
      }

      const auditLog = {
        command,
        sender_role: "UNKNOWN",
        success,
        template_used: "text",
        failure_reason: failureReason + (errorMsg ? `: ${errorMsg}` : ""),
      };

      await prisma.$executeRaw`
        INSERT INTO whatsapp_logs (
          id,
          phone,
          template,
          template_name,
          status,
          delivery_status,
          attempt_count,
          provider_message_id,
          provider_response,
          error_message
        )
        VALUES (
          gen_random_uuid(),
          ${phone},
          'text',
          'BAL',
          'UNAUTHORIZED',
          'UNAUTHORIZED',
          1,
          ${providerMessageId},
          ${JSON.stringify(auditLog)}::jsonb,
          ${errorMsg}
        )
      `;

      return { phone, command, success: false, reason: "UNAUTHORIZED", matches: activeTenants.length };
    }

    // If multiple active tenants match, trigger guardian selection workflow
    if (activeTenants.length > 1) {
      // Create and save selection state
      await setSelectionState(phone, {
        phone,
        action: "BALANCE_SELECTION",
        tenantIds: activeTenants.map((t) => t.id),
      });

      // Fetch allocations to display room numbers
      const allocations = await prisma.roomAllocation.findMany({
        where: {
          tenant_id: { in: activeTenants.map((t) => t.id) },
        },
        orderBy: {
          created_at: "desc",
        },
        include: {
          room: true,
        },
      });

      const roomMap = new Map<string, string>();
      for (const alloc of allocations) {
        if (!roomMap.has(alloc.tenant_id) && alloc.room?.room_no) {
          roomMap.set(alloc.tenant_id, alloc.room.room_no);
        }
      }

      const tenantLines = activeTenants
        .map((t, idx) => {
          const name = t.profiles?.name || t.guardian_name || "Resident";
          const roomNo = roomMap.get(t.id);
          return `${idx + 1}. ${name}${roomNo ? ` (Room ${roomNo})` : ""}`;
        })
        .join("\n");

      const replyText = `Your number is linked to multiple residents.\n\nReply with the resident name:\n\n${tenantLines}\n\nThis selection expires in 10 minutes.`;

      const provider = new MetaWhatsAppProvider();
      let providerMessageId: string | null = null;
      let providerResponse: any = null;
      let success = false;
      let errorMsg: string | null = null;

      try {
        const sendResult = await provider.sendTextMessage(phone, replyText);
        providerMessageId = sendResult.providerMessageId;
        providerResponse = sendResult.raw;
        success = true;
      } catch (err: any) {
        errorMsg = err.message || String(err);
      }

      const auditLog = {
        command,
        sender_role: "GUARDIAN",
        success,
        template_used: "text",
        state: "selection_pending",
        failure_reason: errorMsg,
      };

      await prisma.$executeRaw`
        INSERT INTO whatsapp_logs (
          id,
          phone,
          template,
          template_name,
          status,
          delivery_status,
          attempt_count,
          provider_message_id,
          provider_response,
          error_message
        )
        VALUES (
          gen_random_uuid(),
          ${phone},
          'text',
          'BAL',
          'MULTIPLE_MATCHES',
          'SENT',
          1,
          ${providerMessageId},
          ${JSON.stringify(auditLog)}::jsonb,
          ${errorMsg}
        )
      `;

      return { phone, command, success: true, reason: "MULTIPLE_MATCHES", matches: activeTenants.length };
    }

    // Exactly 1 active tenant
    const tenant = activeTenants[0];

    // Determine sender role (Tenant vs Guardian)
    let senderRole: "TENANT" | "GUARDIAN" = "TENANT";
    const guardianPhones = tenant.guardian_phone ? getPhoneCandidates(tenant.guardian_phone) : [];
    if (guardianPhones.some((p) => candidates.includes(p))) {
      senderRole = "GUARDIAN";
    }

    return this.sendBalanceTemplateForTenant(tenant, phone, command, senderRole);
  }

  private async sendBalanceTemplateForTenant(
    tenant: any,
    phone: string,
    command: string,
    senderRole: "TENANT" | "GUARDIAN"
  ) {
    let success = false;
    let providerMessageId: string | null = null;
    let errorMsg: string | null = null;

    try {
      const obligations = await prisma.rent_obligations.findMany({
        where: {
          tenant_id: tenant.id,
          status: { not: "WAIVED" },
          is_superseded: false,
        },
        include: {
          payments: {
            select: {
              amount_paid: true,
              payment_date: true,
            }
          }
        }
      });

      const summary = financialService.getTenantPaymentSummary(tenant.id, obligations);

      const nextUnpaid = await prisma.rent_obligations.findFirst({
        where: {
          tenant_id: tenant.id,
          status: { in: ["PENDING", "PARTIAL"] },
          is_superseded: false,
        },
        orderBy: { due_date: "asc" },
      });

      const activeAllocation = await prisma.roomAllocation.findFirst({
        where: {
          tenant_id: tenant.id,
          is_active: true,
          end_date: null,
        }
      });

      const allocation = activeAllocation || await prisma.roomAllocation.findFirst({
        where: { tenant_id: tenant.id },
        orderBy: { created_at: "desc" }
      });

      const tenantName = tenant.profiles?.name || tenant.guardian_name || "Resident";
      const ayStart = allocation
        ? new Date(allocation.start_date).getFullYear().toString()
        : (tenant.joined_on ? new Date(tenant.joined_on).getFullYear().toString() : new Date().getFullYear().toString());

      const ayEnd = allocation?.end_date
        ? new Date(allocation.end_date).getFullYear().toString()
        : (allocation
          ? (new Date(allocation.start_date).getFullYear() + 1).toString()
          : (tenant.joined_on ? (new Date(tenant.joined_on).getFullYear() + 1).toString() : (new Date().getFullYear() + 1).toString()));

      const contractStart = allocation
        ? formatDate(allocation.start_date)
        : (tenant.joined_on ? formatDate(tenant.joined_on) : "N/A");

      const contractEnd = allocation?.end_date
        ? formatDate(allocation.end_date)
        : "N/A";

      const totalContract = formatAmountWithoutSymbol(summary.total_billed);
      const totalPaidStr = formatAmountWithoutSymbol(summary.total_paid);
      const balanceRemaining = formatAmountWithoutSymbol(summary.pending_amount);
      const lastPaymentAmount = formatAmountWithoutSymbol(summary.last_payment_amount);
      const lastPaymentDate = summary.last_paid_at ? formatShortMonth(summary.last_paid_at) : "N/A";
      const nextDueMonth = nextUnpaid ? formatShortMonth(nextUnpaid.due_date) : "N/A";

      const bodyParameters = [
        tenantName,       // {{1}}
        ayStart,          // {{2}}
        ayEnd,            // {{3}}
        contractStart,    // {{4}}
        contractEnd,      // {{5}}
        totalContract,    // {{6}}
        totalPaidStr,     // {{7}}
        balanceRemaining, // {{8}}
        lastPaymentAmount,// {{9}}
        lastPaymentDate,  // {{10}}
        nextDueMonth      // {{11}}
      ];

      const provider = new MetaWhatsAppProvider();
      const sendResult = await provider.sendTemplate({
        to: phone,
        templateName: "rent_balance_summary_v1",
        language: { code: "en" },
        bodyParameters,
      });

      providerMessageId = sendResult.providerMessageId;
      success = true;

      const auditLog = {
        command,
        sender_role: senderRole,
        success: true,
        template_used: "rent_balance_summary_v1",
        failure_reason: null,
      };

      await prisma.$executeRaw`
        INSERT INTO whatsapp_logs (
          id,
          phone,
          template,
          template_name,
          status,
          delivery_status,
          attempt_count,
          provider_message_id,
          provider_response,
          tenant_id,
          owner_id,
          hostel_id
        )
        VALUES (
          gen_random_uuid(),
          ${phone},
          'rent_balance_summary_v1',
          'BAL',
          'SENT',
          'SENT',
          1,
          ${providerMessageId},
          ${JSON.stringify(auditLog)}::jsonb,
          ${tenant.id}::uuid,
          ${tenant.owner_id}::uuid,
          ${tenant.hostel_id}::uuid
        )
      `;

      return { phone, command, success: true, tenant_id: tenant.id };
    } catch (err: any) {
      errorMsg = err.message || String(err);
      logger.error("whatsapp.command.failed", { phone, error: errorMsg });

      const auditLog = {
        command,
        sender_role: senderRole,
        success: false,
        template_used: "rent_balance_summary_v1",
        failure_reason: errorMsg,
      };

      await prisma.$executeRaw`
        INSERT INTO whatsapp_logs (
          id,
          phone,
          template,
          template_name,
          status,
          delivery_status,
          attempt_count,
          provider_response,
          error_message,
          tenant_id,
          owner_id,
          hostel_id
        )
        VALUES (
          gen_random_uuid(),
          ${phone},
          'rent_balance_summary_v1',
          'BAL',
          'FAILED',
          'FAILED',
          1,
          ${JSON.stringify(auditLog)}::jsonb,
          ${errorMsg},
          ${tenant.id}::uuid,
          ${tenant.owner_id}::uuid,
          ${tenant.hostel_id}::uuid
        )
      `;

      throw err;
    }
  }

  private async handleSelectionReply(msg: ExtractedMessageEvent, state: BalanceSelectionState) {
    const phone = msg.from;
    const cleanReply = msg.body.trim().toLowerCase();

    // 1. Check if expired
    if (new Date(state.expiresAt).getTime() < Date.now()) {
      await deleteSelectionState(phone);

      const provider = new MetaWhatsAppProvider();
      let providerMessageId: string | null = null;
      let errorMsg: string | null = null;
      let success = false;

      try {
        const sendResult = await provider.sendTextMessage(
          phone,
          "Selection expired.\n\nSend BAL again to view a payment summary."
        );
        providerMessageId = sendResult.providerMessageId;
        success = true;
      } catch (err: any) {
        errorMsg = err.message || String(err);
      }

      const auditLog = {
        event: "WHATSAPP_BALANCE_SELECTION",
        guardianPhone: phone,
        selectedTenantId: null,
        success: false,
        reason: "expired_selection",
        error: errorMsg,
      };

      await prisma.$executeRaw`
        INSERT INTO whatsapp_logs (
          id,
          phone,
          template,
          template_name,
          status,
          delivery_status,
          attempt_count,
          provider_message_id,
          provider_response,
          error_message
        )
        VALUES (
          gen_random_uuid(),
          ${phone},
          'text',
          'BAL',
          'EXPIRED_SELECTION',
          'SENT',
          1,
          ${providerMessageId},
          ${JSON.stringify(auditLog)}::jsonb,
          ${errorMsg}
        )
      `;

      return { phone, success: false, reason: "EXPIRED_SELECTION" };
    }

    // 2. Fetch tenants and active allocations in the selection list
    const tenants = await prisma.tenants.findMany({
      where: {
        id: { in: state.tenantIds },
        status: { in: ["ACTIVE", "INVITED"] },
      },
      include: {
        profiles: true,
      },
    });

    const allocations = await prisma.roomAllocation.findMany({
      where: {
        tenant_id: { in: state.tenantIds },
      },
      orderBy: {
        created_at: "desc",
      },
      include: {
        room: true,
      },
    });

    const roomMap = new Map<string, string>();
    for (const alloc of allocations) {
      if (!roomMap.has(alloc.tenant_id) && alloc.room?.room_no) {
        roomMap.set(alloc.tenant_id, alloc.room.room_no);
      }
    }

    // 3. Match reply against candidates
    const matchedTenants = tenants.filter((t) => {
      const name = t.profiles?.name || t.guardian_name || "Resident";
      const roomNo = roomMap.get(t.id) || "";
      const primary = name.trim().toLowerCase();
      const secondary = `${name} (room ${roomNo})`.trim().toLowerCase();
      return cleanReply === primary || (roomNo && cleanReply === secondary);
    });

    const provider = new MetaWhatsAppProvider();

    // Case A: Exactly 1 matched tenant
    if (matchedTenants.length === 1) {
      const tenant = matchedTenants[0];
      await deleteSelectionState(phone);

      // Log success audit
      const auditLog = {
        event: "WHATSAPP_BALANCE_SELECTION",
        guardianPhone: phone,
        selectedTenantId: tenant.id,
        success: true,
      };

      await prisma.$executeRaw`
        INSERT INTO whatsapp_logs (
          id,
          phone,
          template,
          template_name,
          status,
          delivery_status,
          attempt_count,
          provider_response,
          tenant_id,
          owner_id,
          hostel_id
        )
        VALUES (
          gen_random_uuid(),
          ${phone},
          'text',
          'BAL',
          'SELECTION_SUCCESS',
          'SENT',
          1,
          ${JSON.stringify(auditLog)}::jsonb,
          ${tenant.id}::uuid,
          ${tenant.owner_id}::uuid,
          ${tenant.hostel_id}::uuid
        )
      `;

      // Determine sender role
      let senderRole: "TENANT" | "GUARDIAN" = "TENANT";
      const candidates = getPhoneCandidates(phone);
      const guardianPhones = tenant.guardian_phone ? getPhoneCandidates(tenant.guardian_phone) : [];
      if (guardianPhones.some((p) => candidates.includes(p))) {
        senderRole = "GUARDIAN";
      }

      return this.sendBalanceTemplateForTenant(tenant, phone, "BAL", senderRole);
    }

    // Case B: Ambiguous matches (multiple tenants share this name/reply)
    if (matchedTenants.length > 1) {
      const options = matchedTenants.map((t) => {
        const name = t.profiles?.name || t.guardian_name || "Resident";
        const roomNo = roomMap.get(t.id) || "No Room";
        return `${name} (Room ${roomNo})`;
      });

      const replyText = `Multiple residents share this name.\n\nReply with:\n\n${options.join("\n\nor\n\n")}`;

      let providerMessageId: string | null = null;
      let errorMsg: string | null = null;
      let success = false;

      try {
        const sendResult = await provider.sendTextMessage(phone, replyText);
        providerMessageId = sendResult.providerMessageId;
        success = true;
      } catch (err: any) {
        errorMsg = err.message || String(err);
      }

      // Save a new pending selection state containing only the ambiguous records
      await setSelectionState(phone, {
        phone,
        action: "BALANCE_SELECTION",
        tenantIds: matchedTenants.map((t) => t.id),
      });

      const auditLog = {
        event: "WHATSAPP_BALANCE_SELECTION",
        guardianPhone: phone,
        selectedTenantId: null,
        success: false,
        reason: "ambiguous_selection",
        error: errorMsg,
      };

      await prisma.$executeRaw`
        INSERT INTO whatsapp_logs (
          id,
          phone,
          template,
          template_name,
          status,
          delivery_status,
          attempt_count,
          provider_message_id,
          provider_response,
          error_message
        )
        VALUES (
          gen_random_uuid(),
          ${phone},
          'text',
          'BAL',
          'AMBIGUOUS_SELECTION',
          'SENT',
          1,
          ${providerMessageId},
          ${JSON.stringify(auditLog)}::jsonb,
          ${errorMsg}
        )
      `;

      return { phone, success: false, reason: "AMBIGUOUS_SELECTION", matches: matchedTenants.length };
    }

    // Case C: Invalid selection (Zero matches)
    const originalLines = tenants
      .map((t, idx) => {
        const name = t.profiles?.name || t.guardian_name || "Resident";
        const roomNo = roomMap.get(t.id);
        return `${idx + 1}. ${name}${roomNo ? ` (Room ${roomNo})` : ""}`;
      })
      .join("\n");

    const replyText = `Resident not found.\n\nReply with one of the following names:\n\n${originalLines}\n\nThis selection expires in 10 minutes.`;

    let providerMessageId: string | null = null;
    let errorMsg: string | null = null;
    let success = false;

    try {
      const sendResult = await provider.sendTextMessage(phone, replyText);
      providerMessageId = sendResult.providerMessageId;
      success = true;
    } catch (err: any) {
      errorMsg = err.message || String(err);
    }

    // We do NOT delete the pending state so they can try again.

    const auditLog = {
      event: "WHATSAPP_BALANCE_SELECTION",
      guardianPhone: phone,
      selectedTenantId: null,
      success: false,
      reason: "invalid_selection",
      error: errorMsg,
    };

    await prisma.$executeRaw`
      INSERT INTO whatsapp_logs (
        id,
        phone,
        template,
        template_name,
        status,
        delivery_status,
        attempt_count,
        provider_message_id,
        provider_response,
        error_message
      )
      VALUES (
        gen_random_uuid(),
        ${phone},
        'text',
        'BAL',
        'INVALID_SELECTION',
        'SENT',
        1,
        ${providerMessageId},
        ${JSON.stringify(auditLog)}::jsonb,
        ${errorMsg}
      )
    `;

    return { phone, success: false, reason: "INVALID_SELECTION" };
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
          delivery_status = 'PENDING'
          OR (delivery_status = 'SENT' AND ${event.status} IN ('SENT', 'DELIVERED', 'READ', 'FAILED'))
          OR (delivery_status = 'DELIVERED' AND ${event.status} = 'READ')
        )
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
