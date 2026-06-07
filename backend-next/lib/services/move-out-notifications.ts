/**
 * Move-Out Notifications — Fires on every status transition.
 *
 * Called by MoveOutService after each state change.
 * Sends in-app notifications to both tenant and owner.
 */

import { notificationService } from "./notification-service";
import { prisma } from "../db";
import { getLogger } from "../logger";

const logger = getLogger("move-out-notify");

// Human-readable status messages for tenants
const TENANT_MESSAGES: Record<string, { title: string; message: string }> = {
  REQUESTED: {
    title: "Move-out request received",
    message: "We've received your move-out request. The hostel team will review it shortly.",
  },
  SETTLEMENT_PENDING: {
    title: "Room inspection completed",
    message: "Your room inspection is done. The settlement is being calculated.",
  },
  APPROVED: {
    title: "Settlement ready for review",
    message: "Your final settlement has been calculated. Open the Move-Out section to review it.",
  },
  VACATED: {
    title: "Bed vacated",
    message: "You have vacated the bed. Your status has been set to Former Tenant.",
  },
  COMPLETED: {
    title: "Move-out complete",
    message: "Your move-out is complete. Thank you for staying with us — we wish you all the best!",
  },
  REJECTED: {
    title: "Move-out request rejected",
    message: "Your move-out request was rejected/cancelled. Your tenancy continues as normal.",
  },
};

// Owner-facing messages (operational)
const OWNER_MESSAGES: Record<string, { title: string; message: (name: string) => string }> = {
  REQUESTED: {
    title: "New move-out request",
    message: (n) => `${n} has submitted a move-out request. Schedule an inspection.`,
  },
  SETTLEMENT_PENDING: {
    title: "Inspection completed",
    message: (n) => `Room inspection for ${n} is done. Review the settlement.`,
  },
  APPROVED: {
    title: "Settlement approved",
    message: (n) => `Settlement approved for ${n}. Ready for them to vacate.`,
  },
  VACATED: {
    title: "Tenant vacated",
    message: (n) => `${n} has vacated the bed. Room is now available.`,
  },
  COMPLETED: {
    title: "Move-out completed",
    message: (n) => `${n}'s move-out is complete.`,
  },
  REJECTED: {
    title: "Move-out request rejected",
    message: (n) => `Move-out request for ${n} was rejected/cancelled.`,
  },
};

/**
 * Notify both tenant and owner about a move-out status change.
 * Fire-and-forget: errors are logged but never thrown.
 */
export async function notifyMoveOutTransition(
  requestId: string,
  newStatus: string,
): Promise<void> {
  try {
    const req = await prisma.move_out_requests.findUnique({
      where: { id: requestId },
      select: {
        tenant_id: true,
        owner_id: true,
        tenant: { select: { profile_id: true, profiles: { select: { name: true } } } },
      },
    });
    if (!req) return;

    const tenantProfileId = req.tenant?.profile_id;
    const tenantName = req.tenant?.profiles?.name || "Tenant";

    // Notify tenant
    const tenantMsg = TENANT_MESSAGES[newStatus];
    if (tenantMsg && tenantProfileId) {
      await notificationService.createNotification(
        tenantProfileId, tenantMsg.title, tenantMsg.message, "move_out"
      );
    }

    // Notify owner
    const ownerMsg = OWNER_MESSAGES[newStatus];
    if (ownerMsg) {
      await notificationService.createNotification(
        req.owner_id, ownerMsg.title, ownerMsg.message(tenantName), "move_out"
      );
    }

    logger.info("move_out.notified", { request_id: requestId, status: newStatus });
  } catch (err: any) {
    // Never throw — notifications are best-effort
    logger.error("move_out.notify_failed", { request_id: requestId, error: err.message });
  }
}
