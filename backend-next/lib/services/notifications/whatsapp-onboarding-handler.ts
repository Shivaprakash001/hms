import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";
import { eventLog } from "@/lib/services/event-log-service";
import { normalizeWhatsAppPhone } from "./providers/whatsapp/meta-provider";
import {
  buildTenantOnboardingTemplatePayload,
  ONBOARDING_COMPLETED_TEMPLATE_NAME,
} from "./providers/whatsapp/templates";
import { whatsAppTemplateDeliveryService } from "./whatsapp-template-delivery";
import { reservationStatusService } from "@/src/services/tenants/reservation-status-service";

const logger = getLogger("whatsapp.onboarding");

/**
 * Handles the tenant_onboarding_completed event.
 *
 * Architecture:
 *   Load tenant context from DB
 *     ↓
 *   buildTenantOnboardingTemplatePayload(...)  ← pure mapper
 *     ↓
 *   WhatsAppTemplateDeliveryService.send(...)  ← idempotent
 *     ↓
 *   eventLog audit
 *
 * Rule 5: WhatsApp failure must never break onboarding.
 * Rule 6: All data loaded from database, never from request.
 */
export async function sendTenantOnboardingNotification(tenantId: string): Promise<void> {
  // 1. Load tenant context from database
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    include: {
      profiles: { select: { name: true } },
      hostels: { select: { id: true, name: true, auto_rent_day: true, owner_id: true } },
      room_allocations: {
        where: { is_active: true, end_date: null },
        orderBy: { start_date: "desc" as const },
        take: 1,
        include: { room: { select: { room_no: true } } },
      },
    },
  });

  if (!tenant) {
    logger.warn("whatsapp.onboarding.tenant_not_found", { tenant_id: tenantId });
    return;
  }

  if (tenant.status !== "ACTIVE") {
    logger.warn("whatsapp.onboarding.tenant_not_active", {
      tenant_id: tenantId,
      status: tenant.status,
    });
    return;
  }

  // 1.5 Gate: Ensure the tenant has reserved their bed (financially committed)
  const resStatus = await reservationStatusService.getReservationStatus(tenantId);
  if (resStatus.status === "PAYMENT_PENDING") {
    logger.info("whatsapp.onboarding.postponed_payment_pending", {
      tenant_id: tenantId,
      status: resStatus.status,
    });
    return;
  }

  // 2. Resolve phone number
  const rawPhone = tenant.phone_1 || tenant.profiles?.phone;
  if (!rawPhone) {
    logger.warn("whatsapp.onboarding.no_phone", { tenant_id: tenantId });
    await eventLog.log("tenant_onboarding_whatsapp_failed", tenant.owner_id, {
      tenant_id: tenantId,
      hostel_id: tenant.hostel_id,
      reason: "no_phone_number",
    }, tenantId);
    return;
  }

  let normalizedPhone: string;
  try {
    normalizedPhone = normalizeWhatsAppPhone(rawPhone);
  } catch {
    logger.warn("whatsapp.onboarding.invalid_phone", { tenant_id: tenantId });
    await eventLog.log("tenant_onboarding_whatsapp_failed", tenant.owner_id, {
      tenant_id: tenantId,
      hostel_id: tenant.hostel_id,
      reason: "invalid_phone_number",
    }, tenantId);
    return;
  }

  // 3. Resolve allocation and room
  const allocation = tenant.room_allocations?.[0];
  const room = allocation?.room;
  const hostel = tenant.hostels;

  if (!hostel) {
    logger.warn("whatsapp.onboarding.no_hostel", { tenant_id: tenantId });
    return;
  }

  // 4. Build template payload (pure mapper — no DB queries)
  const bodyParameters = buildTenantOnboardingTemplatePayload({
    tenantName: tenant.profiles?.name || "Resident",
    hostelName: hostel.name,
    roomNumber: room?.room_no || "N/A",
    joiningDate: tenant.joined_on || new Date(),
    monthlyRent: Number(tenant.monthly_rent || 0),
    rentDueDay: hostel.auto_rent_day || 1,
  });

  // 5. Send via generic delivery service (idempotent)
  const idempotencyKey = `tenant_onboarding_completed:${tenantId}`;

  try {
    const result = await whatsAppTemplateDeliveryService.send({
      phone: normalizedPhone,
      templateName: ONBOARDING_COMPLETED_TEMPLATE_NAME,
      bodyParameters,
      idempotencyKey,
      tenantId,
      hostelId: hostel.id,
      ownerId: tenant.owner_id || undefined,
      languageCode: "en_IN",
    });

    if (result.skipped) {
      logger.info("whatsapp.onboarding.skipped", {
        tenant_id: tenantId,
        reason: "duplicate_or_invalid_phone",
      });
      return;
    }

    // 6. Audit log — success
    await eventLog.log("tenant_onboarding_whatsapp_sent", tenant.owner_id, {
      tenant_id: tenantId,
      hostel_id: hostel.id,
      provider_message_id: result.providerMessageId,
      log_id: result.logId,
    }, tenantId);
  } catch (error: any) {
    // 6. Audit log — failure (Rule 5: never break onboarding)
    logger.error("whatsapp.onboarding.send_failed", {
      tenant_id: tenantId,
      error: String(error?.message || error),
    });

    await eventLog.log("tenant_onboarding_whatsapp_failed", tenant.owner_id, {
      tenant_id: tenantId,
      hostel_id: hostel.id,
      error: String(error?.message || error).slice(0, 500),
    }, tenantId).catch(() => {});
  }
}
