import { prisma } from "../db";
import { getLogger } from "../logger";

const logger = getLogger("plan-enforcement");

type PlanRecord = {
  id: string;
  tenant_limit: number;
  hostel_limit: number;
  automation: boolean;
  messaging: boolean;
  multi_hostel: boolean;
  analytics: boolean;
  is_custom: boolean;
};

export class PlanEnforcementService {
  async _ensureSubscriptionExists(ownerId: string) {
    let sub = await (prisma as any).subscription.findUnique({ where: { owner_id: ownerId } });
    if (!sub) {
      throw new Error("FORBIDDEN: No active subscription found for owner. Plan enforcement failed.");
    }
    return sub as any;
  }

  async _resolvePlan(planId: string | null): Promise<PlanRecord> {
    if (!planId) {
      const p = await prisma.plan.findUnique({ where: { id: "FREE" } });
      if (!p) throw new Error("CONFIG_ERROR: Missing FREE plan in DB");
      return p as any;
    }
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error("NOT_FOUND: Plan not found");
    return plan as any;
  }

  async _countActiveTenants(ownerId: string) {
    return await prisma.tenant.count({ where: { owner_id: ownerId, status: { not: "LEFT" } } });
  }

  async _countHostels(ownerId: string) {
    return await prisma.hostel.count({ where: { owner_id: ownerId, is_active: true } });
  }

  async _messageCredits(ownerId: string) {
    const res = await (prisma as any).messagePacks.aggregate({
      _sum: { messages_remaining: true },
      where: { owner_id: ownerId },
    });
    return Number(res._sum.messages_remaining || 0);
  }

  async getEffectiveSubscription(ownerId: string) {
    const sub = await this._ensureSubscriptionExists(ownerId);
    // Transition trial if needed
    if (sub.status === "TRIAL" && sub.trial_ends_at && new Date() > sub.trial_ends_at) {
      await this._handleTrialEnd(ownerId, sub);
      // reload
      return await (prisma as any).subscription.findUnique({ where: { owner_id: ownerId } });
    }
    return sub;
  }

  async _handleTrialEnd(ownerId: string, sub: any) {
    logger.info(`Handling trial end for owner ${ownerId}`);
    // Evaluate usage vs FREE limits
    const freePlan = await prisma.plan.findUnique({ where: { id: "FREE" } });
    if (!freePlan) throw new Error("CONFIG_ERROR: FREE plan missing");

    const tenantCount = await this._countActiveTenants(ownerId);
    const hostelCount = await this._countHostels(ownerId);

    if (tenantCount <= Number(freePlan.tenant_limit) && hostelCount <= Number(freePlan.hostel_limit)) {
      // Downgrade to FREE plan, ACTIVE status
      await (prisma as any).subscription.update({ where: { id: sub.id }, data: { plan_id: "FREE", status: "ACTIVE", updated_at: new Date() } });
      logger.info(`Owner ${ownerId} trial ended — downgraded to FREE`);
    } else {
      // Enter LIMITED mode
      await (prisma as any).subscription.update({ where: { id: sub.id }, data: { status: "LIMITED", updated_at: new Date() } });
      logger.info(`Owner ${ownerId} trial ended — entered LIMITED due to usage overflow`);
    }
  }

  async assertSubscriptionActive(ownerId: string) {
    const sub = await this.getEffectiveSubscription(ownerId);
    if (!sub) throw new Error("NOT_FOUND: Subscription not found");
    if (sub.status === "EXPIRED") throw new Error("FORBIDDEN: Subscription expired");
    if (sub.status === "LIMITED") throw new Error("FORBIDDEN: Account in LIMITED mode. Upgrade required");
    // TRIAL, ACTIVE, GRACE allowed
    return true;
  }

  async assertTenantLimit(ownerId: string) {
    const sub = await this.getEffectiveSubscription(ownerId);
    const plan = await this._resolvePlan(sub.plan_id);
    if (plan.is_custom) return true; // no hard limits
    const count = await this._countActiveTenants(ownerId);
    if (Number(plan.tenant_limit) <= 0) return true; // unbounded
    if (count >= Number(plan.tenant_limit)) {
      throw new Error("FORBIDDEN: Tenant limit reached for your plan");
    }
    return true;
  }

  async assertHostelLimit(ownerId: string) {
    const sub = await this.getEffectiveSubscription(ownerId);
    const plan = await this._resolvePlan(sub.plan_id);
    if (plan.is_custom) return true;
    const count = await this._countHostels(ownerId);
    if (Number(plan.hostel_limit) <= 0) return true;
    if (count >= Number(plan.hostel_limit)) {
      throw new Error("FORBIDDEN: Hostel limit reached for your plan");
    }
    return true;
  }

  async assertFeature(ownerId: string, feature: "automation" | "messaging" | "multi_hostel" | "analytics") {
    const sub = await this.getEffectiveSubscription(ownerId);
    const plan = await this._resolvePlan(sub.plan_id);
    if ((plan as any)[feature]) return true;
    throw new Error(`FORBIDDEN: Feature '${feature}' not available on your plan`);
  }

  async assertMessageQuota(ownerId: string, warnThresholdPercent = 20) {
    const credits = await this._messageCredits(ownerId);
    if (credits <= 0) {
      // send notification via email system is elsewhere; raise error to block sending
      throw new Error("FORBIDDEN: Message quota exhausted");
    }
    const totalPurchased = await (prisma as any).messagePacks.aggregate({ _sum: { messages_total: true }, where: { owner_id: ownerId } });
    const total = Number(totalPurchased._sum.messages_total || 0);
    if (total > 0) {
      const pct = Math.round((credits / total) * 100);
      if (pct <= warnThresholdPercent) {
        // best effort: log warning for monitoring; email is handled by other services
        logger.warn(`Owner ${ownerId} message quota below ${warnThresholdPercent}%. Remaining ${credits}/${total}`);
      }
    }
    return credits;
  }
}

export const planEnforcementService = new PlanEnforcementService();
