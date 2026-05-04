/**
 * 🚧 Plan Gate Service — Feature Limit Enforcement
 *
 * Every owner action that consumes a billable resource MUST call the
 * relevant gate here before executing. This is where plan limits are enforced.
 *
 * Rules:
 * - No subscription row → Starter limits apply (25 tenants, 1 hostel)
 * - NULL limit → unlimited (Business plan)
 * - status EXPIRED / CANCELLED → treat limits as Starter regardless of plan
 * - Throw errors with "PLAN_LIMIT:" prefix so API routes can return 402
 */

import { prisma } from "../db";

async function getEffectivePlan(ownerId: string) {
  const sub = await prisma.ownerSubscription.findUnique({
    where: { owner_id: ownerId },
    include: { plan: true },
  });

  if (!sub) {
    throw new Error(`PLAN_LIMIT: FORBIDDEN. No active subscription found for owner. Plan enforcement failed.`);
  }

  const effectiveStatus =
    sub.status === "ACTIVE" && sub.end_date && new Date() > sub.end_date
      ? "EXPIRED"
      : sub.status;

  if (effectiveStatus === "EXPIRED" || effectiveStatus === "CANCELLED" || effectiveStatus === "LIMITED") {
    throw new Error(`PLAN_LIMIT: FORBIDDEN. Account in ${effectiveStatus} mode. Upgrade required.`);
  }

  return sub.plan;
}

export const planGate = {
  async assertTenantLimit(ownerId: string): Promise<void> {
    const plan = await getEffectivePlan(ownerId);
    if (plan.tenant_limit === 0) return; // 0 = unlimited

    const current = await prisma.tenant.count({
      where: { owner_id: ownerId, status: { not: "LEFT" } },
    });

    if (current >= plan.tenant_limit) {
      throw new Error(`PLAN_LIMIT: TENANT_LIMIT_REACHED`);
    }
  },

  async assertHostelLimit(ownerId: string): Promise<void> {
    const plan = await getEffectivePlan(ownerId);
    if (plan.hostel_limit === 0) return; // 0 = unlimited

    const current = await prisma.hostel.count({
      where: { owner_id: ownerId, is_active: true },
    });

    if (current >= plan.hostel_limit) {
      throw new Error(`PLAN_LIMIT: HOSTEL_LIMIT_REACHED`);
    }
  },

  async assertFeatureAllowed(ownerId: string, feature: "automation" | "multi_hostel" | "analytics"): Promise<void> {
    const plan = await getEffectivePlan(ownerId);
    
    if (!plan[feature]) {
      throw new Error(`PLAN_LIMIT: FEATURE_NOT_AVAILABLE`);
    }
  },

  async updateUsage(ownerId: string): Promise<void> {
    const tenants_count = await prisma.tenant.count({
      where: { owner_id: ownerId, status: { not: "LEFT" } },
    });
    const hostels_count = await prisma.hostel.count({
      where: { owner_id: ownerId, is_active: true },
    });

    await prisma.usageTracking.upsert({
      where: { owner_id: ownerId },
      update: { tenants_count, hostels_count },
      create: { owner_id: ownerId, tenants_count, hostels_count },
    });
  }
};
