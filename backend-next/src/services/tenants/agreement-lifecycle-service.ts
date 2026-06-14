import { prisma } from "@/lib/db";
import { invalidateHostelDashboardCache, invalidateOwnerDashboardCache } from "@/lib/cache/dashboard-cache";
import { eventLog } from "@/lib/services/event-log-service";
import { notificationService } from "@/lib/services/notification-service";
import { AGREEMENT_ACTIVITY_EVENTS, AGREEMENT_LIFECYCLE_MANAGED_STATUSES } from "./agreement-status";
import { agreementRenewalNotificationService } from "./agreement-renewal-notification-service";

type AgreementLifecycleSummary = {
  checked: number;
  marked_expiring: number;
  marked_expired: number;
  reminders_30d: number;
  reminders_15d: number;
  expiry_notifications: number;
  skipped_legacy: number;
  failed: number;
  errors: string[];
};

function utcDateOnly(input = new Date()) {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

function daysUntilDate(date: Date, today: Date) {
  const target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const base = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.ceil((target - base) / 86_400_000);
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function profileName(agreement: any) {
  return agreement.tenant?.profiles?.name || agreement.content_snapshot?.tenant_name || "Tenant";
}

export class AgreementLifecycleService {
  /**
   * Agreement lifecycle is deliberately isolated from occupancy and financials.
   * This cron must never create obligations, touch ledgers, change tenant status,
   * release rooms, or start move-outs.
   */
  async processDailyLifecycle(asOf: Date = new Date()): Promise<AgreementLifecycleSummary> {
    const today = utcDateOnly(asOf);
    const summary: AgreementLifecycleSummary = {
      checked: 0,
      marked_expiring: 0,
      marked_expired: 0,
      reminders_30d: 0,
      reminders_15d: 0,
      expiry_notifications: 0,
      skipped_legacy: 0,
      failed: 0,
      errors: [],
    };
    const touchedOwnerIds = new Set<string>();
    const touchedHostelIds = new Set<string>();

    // Verify template health and write drift alerts if needed
    if (process.env.OTP_PROVIDER === "whatsapp") {
      try {
        const healthResults = await agreementRenewalNotificationService.checkTemplatesHealth();
        for (const item of healthResults) {
          if (!item.exists || item.status !== "APPROVED") {
            await eventLog.log("TEMPLATE_DRIFT_ALERT", null, {
              templateName: item.name,
              exists: item.exists,
              status: item.status,
              error: `Meta template '${item.name}' is missing or not APPROVED (current status: ${item.status || "UNKNOWN"}).`,
            });
            console.error(`[TEMPLATE_DRIFT_ALERT] Meta template '${item.name}' is missing or not APPROVED (current status: ${item.status || "UNKNOWN"}).`);
          }
        }
      } catch (err: any) {
        console.error("[TEMPLATE_DRIFT_ALERT] Failed to run WhatsApp template health check:", err);
      }
    }

    const agreements = await prisma.agreement.findMany({
      where: {
        status: { in: [...AGREEMENT_LIFECYCLE_MANAGED_STATUSES] },
      },
      include: {
        hostel: {
          include: {
            profiles: {
              select: {
                name: true,
                phone: true,
              },
            },
          },
        },
        renewed_to_agreement: true,
        renewed_agreements: {
          where: { status: { notIn: ["VOID", "TERMINATED"] } },
          orderBy: { generated_at: "desc" },
          take: 1,
        },
        tenant: {
          include: {
            profiles: {
              select: {
                name: true,
                phone: true,
              },
            },
            room_allocations: {
              where: { is_active: true, end_date: null },
              include: { room: { select: { id: true, room_no: true } } },
              take: 1,
            },
            move_out_requests: {
              orderBy: { created_at: "desc" },
              take: 3,
            },
            rent_obligations: {
              where: { status: { in: ["PENDING", "PARTIAL"] }, is_superseded: false },
              orderBy: { due_date: "asc" },
              take: 20,
            },
          },
        },
      },
      orderBy: { agreement_end_date: "asc" },
    });

    for (const agreement of agreements) {
      summary.checked++;
      if (!agreement.agreement_end_date) {
        summary.skipped_legacy++;
        continue;
      }

      try {
        const endDate = utcDateOnly(new Date(agreement.agreement_end_date));
        const daysLeft = daysUntilDate(endDate, today);
        const ownerId = agreement.tenant?.owner_id || agreement.hostel?.owner_id || null;
        const tenantProfileId = agreement.tenant?.profile_id || null;
        const hostelId = agreement.hostel_id;
        const tenantName = profileName(agreement);
        const ownerNotificationId = ownerId || null;

        const baseMetadata = {
          agreement_id: agreement.id,
          tenant_id: agreement.tenant_id,
          hostel_id: agreement.hostel_id,
          agreement_end_date: endDate.toISOString().slice(0, 10),
          days_left: daysLeft,
        };

        if (ownerId) touchedOwnerIds.add(ownerId);
        if (hostelId) touchedHostelIds.add(hostelId);

        if (daysLeft <= 0) {
          const update = await prisma.agreement.updateMany({
            where: {
              id: agreement.id,
              status: { in: ["SIGNED", "EXPIRING_SOON"] },
            },
            data: {
              status: "AGREEMENT_EXPIRED",
            },
          });
          if (update.count > 0) {
            summary.marked_expired++;
            agreement.status = "AGREEMENT_EXPIRED";
            await eventLog.log(AGREEMENT_ACTIVITY_EVENTS.EXPIRED, ownerId, baseMetadata, agreement.tenant_id);
          }
          const notifyUpdate = await prisma.agreement.updateMany({
            where: {
              id: agreement.id,
              expired_notified_at: null,
            },
            data: { expired_notified_at: new Date() },
          });
          if (notifyUpdate.count > 0) {
            await this.notifyTenant(
              tenantProfileId,
              "Agreement expired",
              `Your hostel agreement for ${agreement.hostel?.name || "your hostel"} expired on ${formatDate(endDate)}. Please renew or contact the hostel office.`
            );
            await this.notifyOwner(
              ownerNotificationId,
              "Agreement expired",
              `${tenantName}'s agreement expired on ${formatDate(endDate)}. Occupancy and rent generation are unchanged.`
            );
            summary.expiry_notifications++;
          }
        } else {
          if (daysLeft <= 30) {
            if (agreement.status === "SIGNED") {
              const update = await prisma.agreement.updateMany({
                where: { id: agreement.id, status: "SIGNED" },
                data: { status: "EXPIRING_SOON" },
              });
              if (update.count > 0) {
                summary.marked_expiring++;
                agreement.status = "EXPIRING_SOON";
                await eventLog.log(AGREEMENT_ACTIVITY_EVENTS.EXPIRING, ownerId, baseMetadata, agreement.tenant_id);
              }
            }

            if (daysLeft > 15) {
              const notifyUpdate = await prisma.agreement.updateMany({
                where: {
                  id: agreement.id,
                  expiry_notified_30d_at: null,
                },
                data: { expiry_notified_30d_at: new Date() },
              });
              if (notifyUpdate.count > 0) {
                await this.notifyTenant(
                  tenantProfileId,
                  "Agreement expiring soon",
                  `Your hostel agreement expires on ${formatDate(endDate)}. Please renew before expiry.`
                );
                await this.notifyOwner(
                  ownerNotificationId,
                  "Agreement expiring soon",
                  `${tenantName}'s agreement expires on ${formatDate(endDate)}.`
                );
                summary.reminders_30d++;
              }
            }
          }

          if (daysLeft <= 15) {
            const notifyUpdate = await prisma.agreement.updateMany({
              where: {
                id: agreement.id,
                expiry_notified_15d_at: null,
              },
              data: { expiry_notified_15d_at: new Date() },
            });
            if (notifyUpdate.count > 0) {
              await this.notifyTenant(
                tenantProfileId,
                "Agreement renewal reminder",
                `Your hostel agreement expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} on ${formatDate(endDate)}.`
              );
              await this.notifyOwner(
                ownerNotificationId,
                "Agreement renewal reminder",
                `${tenantName}'s agreement expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`
              );
              summary.reminders_15d++;
            }
          }
        }

        // TRIGGER WHATSAPP NOTIFICATIONS
        await agreementRenewalNotificationService.processRenewalNotifications(agreement, today);
      } catch (error: any) {
        summary.failed++;
        summary.errors.push(`${agreement.id}: ${error?.message || String(error)}`);
      }
    }

    for (const ownerId of touchedOwnerIds) invalidateOwnerDashboardCache(ownerId);
    for (const hostelId of touchedHostelIds) invalidateHostelDashboardCache(hostelId);

    return summary;
  }

  private async notifyTenant(profileId: string | null, title: string, message: string) {
    if (!profileId) return;
    await notificationService.createNotification(profileId, title, message, "agreement_lifecycle").catch(() => undefined);
  }

  private async notifyOwner(profileId: string | null, title: string, message: string) {
    if (!profileId) return;
    await notificationService.createNotification(profileId, title, message, "agreement_lifecycle").catch(() => undefined);
  }
}

export const agreementLifecycleService = new AgreementLifecycleService();
