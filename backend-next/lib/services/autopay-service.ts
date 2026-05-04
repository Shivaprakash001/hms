import { prisma } from "../db";
import { getLogger } from "../logger";
import { eventSystem } from "../events";
import { EmailService } from "./email-service";

const logger = getLogger("autopay");

export class AutopayService {
  /**
   * Initiate autopay for a subscription if enabled.
   * Called when subscription transitions to ACTIVE or GRACE.
   */
  async initiateAutopay(subscriptionId: string) {
    const sub = await (prisma as any).subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub || !sub.autopay_enabled) return;

    logger.info(`Initiating autopay for subscription ${subscriptionId}`);
    await this.attemptAutopay(subscriptionId, "INITIAL");
  }

  /**
   * Attempt autopay charge (mocked).
   * In production, this would call PhonePe API to charge the customer.
   * For now, we simulate success/failure.
   */
  private async attemptAutopay(subscriptionId: string, trigger: string): Promise<boolean> {
    const sub = await (prisma as any).subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) return false;

    // Simulate 80% success rate for demo
    const success = Math.random() < 0.8;

    const id = require("crypto").randomUUID();
    await (prisma as any).autopayAttempt.create({
      data: {
        id,
        subscription_id: subscriptionId,
        attempt_at: new Date(),
        result: success ? "SUCCESS" : "FAILED",
        provider_response: success ? "Charged successfully" : "Payment declined"
      }
    });

    if (success) {
      // Extend billing cycle
      const nextBilling = new Date();
      nextBilling.setMonth(nextBilling.getMonth() + 1);
      await (prisma as any).subscription.update({
        where: { id: subscriptionId },
        data: {
          status: "ACTIVE",
          next_billing_at: nextBilling,
          grace_started_at: null,
          grace_ends_at: null,
          updated_at: new Date()
        }
      });
      logger.info(`Autopay succeeded for subscription ${subscriptionId}`);
    }

    return success;
  }

  /**
   * Enter grace period (called when payment fails on billing date).
   * Grace period = 7 days with 3 retry attempts at day 0, 3, 7.
   */
  async enterGracePeriod(subscriptionId: string) {
    const sub = await (prisma as any).subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) return;

    const graceStart = new Date();
    const graceEnd = new Date();
    graceEnd.setDate(graceEnd.getDate() + 7);

    await (prisma as any).subscription.update({
      where: { id: subscriptionId },
      data: {
        status: "GRACE",
        grace_started_at: graceStart,
        grace_ends_at: graceEnd,
        updated_at: new Date()
      }
    });

    logger.info(`Subscription ${subscriptionId} entered GRACE period until ${graceEnd.toISOString()}`);

    // Trigger day 0 retry immediately
    await this.attemptAutopay(subscriptionId, "GRACE_DAY_0");
  }

  /**
   * Process grace period retries (called daily).
   * Attempts: day 0 (on enter), day 3, day 7.
   */
  async processGracePeriodRetries() {
    const now = new Date();
    const subscriptions = await (prisma as any).subscription.findMany({
      where: { status: "GRACE" }
    });

    for (const sub of subscriptions) {
      if (!sub.grace_started_at || !sub.grace_ends_at) continue;

      const daysInGrace = Math.floor((now.getTime() - sub.grace_started_at.getTime()) / (1000 * 60 * 60 * 24));

      // Day 3 retry
      if (daysInGrace === 3) {
        logger.info(`Grace day 3 retry for subscription ${sub.id}`);
        await this.attemptAutopay(sub.id, "GRACE_DAY_3");
      }

      // Day 7 retry
      if (daysInGrace === 7) {
        logger.info(`Grace day 7 retry for subscription ${sub.id}`);
        const success = await this.attemptAutopay(sub.id, "GRACE_DAY_7");

        if (!success) {
          // Final failure → mark EXPIRED
          await this.markExpired(sub.id);
        }
      }
    }
  }

  /**
   * Mark subscription as EXPIRED and notify owner.
   */
  async markExpired(subscriptionId: string) {
    const sub = await (prisma as any).subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) return;

    await (prisma as any).subscription.update({
      where: { id: subscriptionId },
      data: { status: "EXPIRED", updated_at: new Date() }
    });

    logger.warn(`Subscription ${subscriptionId} marked EXPIRED`);

    // Send owner notification email (best effort)
    const owner = await prisma.profile.findUnique({ where: { id: sub.owner_id } });
    if (owner?.email) {
      try {
        await EmailService.sendEmail(
          owner.email,
          "⚠️ Subscription Expired",
          `<p>Your subscription has expired due to payment failure after 7 days grace period. Your account is now in read-only mode.</p>`
        );
      } catch (err) {
        logger.error(`Failed to send expiration email to ${owner.email}:`, err);
      }
    }

    // Broadcast event for real-time UI
    eventSystem.trigger("subscription_expired", { owner_id: sub.owner_id });
  }
}

export const autopayService = new AutopayService();
