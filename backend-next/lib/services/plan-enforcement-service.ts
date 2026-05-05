import { prisma } from "../db";
import { getLogger } from "../logger";

const logger = getLogger("plan-enforcement");

// Statuses that block all writes
const BLOCKED_STATUSES = ["EXPIRED", "CANCELLED", "LIMITED"];

type PlanRecord = {
  id: string;
  tenant_limit: number;
  hostel_limit: number;
  automation: boolean;
  multi_hostel: boolean;
  analytics: boolean;
  is_custom: boolean;
};

export class PlanEnforcementService {
  /**
   * Returns the owner's OwnerSubscription row (authoritative for billing).
   * Throws if missing — callers must have a subscription to proceed.
   */
  async _getOwnerSubscription(ownerId: string) {
    const sub = await prisma.ownerSubscription.findUnique({
      where: { owner_id: ownerId },
      include: { plan: true },
    });
    if (!sub) {
      throw new Error("FORBIDDEN: No active subscription found for owner. Plan enforcement failed.");
    }
    // Treat ACTIVE subscriptions whose end_date has passed as EXPIRED
    if (sub.status === "ACTIVE" && sub.end_date && new Date() > sub.end_date) {
      await prisma.ownerSubscription.update({
        where: { owner_id: ownerId },
        data: { status: "EXPIRED" },
      }).catch(() => {}); // best-effort; cron reconciler is the authoritative expiry handler
      return { ...sub, status: "EXPIRED" };
    }
    return sub;
  }

  async _resolvePlan(planId: string | null): Promise<PlanRecord> {
    if (!planId) {
      const p = await prisma.plan.findUnique({ where: { id: "FREE" } });
      if (!p) throw new Error("CONFIG_ERROR: Missing FREE plan in DB");
      return p as PlanRecord;
    }
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error("NOT_FOUND: Plan not found");
    return plan as PlanRecord;
  }

  async _countActiveTenants(ownerId: string) {
    return prisma.tenant.count({ where: { owner_id: ownerId, status: { not: "LEFT" } } });
  }

  async _countHostels(ownerId: string) {
    return prisma.hostel.count({ where: { owner_id: ownerId, is_active: true } });
  }


  async assertSubscriptionActive(ownerId: string) {
    const sub = await this._getOwnerSubscription(ownerId);
    if (BLOCKED_STATUSES.includes(sub.status)) {
      throw new Error(`FORBIDDEN: Account in ${sub.status} mode. Upgrade required`);
    }
    return true;
  }

  async assertTenantLimit(ownerId: string) {
    const sub = await this._getOwnerSubscription(ownerId);
    if (BLOCKED_STATUSES.includes(sub.status)) {
      throw new Error(`FORBIDDEN: Account in ${sub.status} mode. Upgrade required`);
    }
    const plan = await this._resolvePlan(sub.plan_id);
    if (!plan) return true;
    if (plan.is_custom) return true;
    if (Number(plan.tenant_limit) <= 0) return true; // unbounded (NULL / 0 = unlimited)
    const count = await this._countActiveTenants(ownerId);
    if (count >= Number(plan.tenant_limit)) {
      throw new Error("PLAN_LIMIT: TENANT_LIMIT_REACHED");
    }
    return true;
  }

  async assertHostelLimit(ownerId: string) {
    const sub = await this._getOwnerSubscription(ownerId);
    if (BLOCKED_STATUSES.includes(sub.status)) {
      throw new Error(`FORBIDDEN: Account in ${sub.status} mode. Upgrade required`);
    }
    const plan = await this._resolvePlan(sub.plan_id);
    if (!plan) return true;
    if (plan.is_custom) return true;
    if (Number(plan.hostel_limit) <= 0) return true;
    const count = await this._countHostels(ownerId);
    if (count >= Number(plan.hostel_limit)) {
      throw new Error("PLAN_LIMIT: HOSTEL_LIMIT_REACHED");
    }
    return true;
  }

  /**
   * Returns true only when the owner's active plan has the given feature enabled.
   * Returns false for FREE plan, expired subscriptions, or any DB error.
   * Does NOT throw — use for conditional branching, not enforcement.
   */
  async hasFeature(ownerId: string, feature: "automation" | "multi_hostel" | "analytics"): Promise<boolean> {
    try {
      const sub = await this._getOwnerSubscription(ownerId);
      if (BLOCKED_STATUSES.includes(sub.status)) return false;
      const plan = await this._resolvePlan(sub.plan_id);
      return Boolean(plan?.[feature]);
    } catch {
      return false;
    }
  }

  /** Convenience alias — kept for any callers added before hasFeature existed. */
  async hasAutomation(ownerId: string): Promise<boolean> {
    return this.hasFeature(ownerId, "automation");
  }

  async assertFeature(ownerId: string, feature: "automation" | "multi_hostel" | "analytics") {
    const sub = await this._getOwnerSubscription(ownerId);
    if (BLOCKED_STATUSES.includes(sub.status)) {
      throw new Error(`FORBIDDEN: Account in ${sub.status} mode. Upgrade required`);
    }
    const plan = await this._resolvePlan(sub.plan_id);
    if (plan && plan[feature]) return true;
    throw new Error(`PLAN_LIMIT: FEATURE_NOT_AVAILABLE`);
  }

  async _messageCredits(ownerId: string) {
    const res = await prisma.addonUsage.findUnique({
      where: { owner_id: ownerId },
      select: { reminders_remaining: true },
    });
    return Number(res?.reminders_remaining ?? 0);
  }

  async assertMessageQuota(ownerId: string, warnThresholdPercent = 20) {
    const credits = await this._messageCredits(ownerId);
    if (credits <= 0) {
      throw new Error("FORBIDDEN: Reminder quota exhausted");
    }
    return credits;
  }
}

export const planEnforcementService = new PlanEnforcementService();
