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
  profile_photo: boolean;
  document_verification: boolean;
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
      include: {
        plan: {
          select: {
            id: true,
            tenant_limit: true,
            hostel_limit: true,
            automation: true,
            multi_hostel: true,
            analytics: true,
            profile_photo: true,
            document_verification: true,
            is_custom: true,
          },
        },
      },
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
      const p = await prisma.plan.findUnique({
        where: { id: "FREE" },
        select: {
          id: true,
          tenant_limit: true,
          hostel_limit: true,
          automation: true,
          multi_hostel: true,
          analytics: true,
          profile_photo: true,
          document_verification: true,
          is_custom: true,
        },
      });
      if (!p) throw new Error("CONFIG_ERROR: Missing FREE plan in DB");
      return p as unknown as PlanRecord;
    }
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        tenant_limit: true,
        hostel_limit: true,
        automation: true,
        multi_hostel: true,
        analytics: true,
        profile_photo: true,
        document_verification: true,
        is_custom: true,
      },
    });
    if (!plan) throw new Error("NOT_FOUND: Plan not found");
    return plan as unknown as PlanRecord;
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
  /**
   * Gate document uploads by plan tier.
   *   FREE    → nothing allowed
   *   STARTER → PROFILE_PHOTO only
   *   GROWTH+ → all KYC doc types
   */
  async assertDocumentUpload(ownerId: string, docType: string) {
    let sub: any;
    try {
      sub = await this._getOwnerSubscription(ownerId);
    } catch {
      throw new Error("PLAN_LIMIT: DOCUMENT_UPLOAD_NOT_ALLOWED: Upgrade your plan to upload documents");
    }
    if (BLOCKED_STATUSES.includes(sub.status)) {
      throw new Error(`FORBIDDEN: Account in ${sub.status} mode. Upgrade required`);
    }
    const plan = await this._resolvePlan(sub.plan_id);

    if (docType === "PROFILE_PHOTO") {
      if (!plan.profile_photo) {
        throw new Error("PLAN_LIMIT: PROFILE_PHOTO_NOT_ALLOWED: Upgrade to Starter or higher to upload a profile photo");
      }
      return true;
    }

    if (!plan.document_verification) {
      throw new Error("PLAN_LIMIT: DOCUMENT_VERIFICATION_NOT_ALLOWED: Upgrade to Growth or higher to upload KYC documents");
    }
    return true;
  }

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

  async assertFeature(ownerId: string, feature: "automation" | "multi_hostel" | "analytics" | "profile_photo" | "document_verification") {
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
