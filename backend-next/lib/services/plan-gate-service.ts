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

const STARTER_LIMITS = { tenant_limit: 25, hostel_limit: 1 };

async function getEffectiveLimits(ownerId: string) {
  const sub = await prisma.ownerSubscription.findUnique({
    where: { owner_id: ownerId },
    include: { plan: { select: { tenant_limit: true, hostel_limit: true } } },
  });

  if (!sub) {
    throw new Error(`PLAN_LIMIT: FORBIDDEN. No active subscription found for owner. Plan enforcement failed.`);
  }

  // Treat ACTIVE subscriptions whose end_date has lapsed as EXPIRED.
  // The cron reconciler is authoritative, but enforcement must not grant writes
  // to subscriptions that should have already expired.
  const effectiveStatus =
    sub.status === "ACTIVE" && sub.end_date && new Date() > sub.end_date
      ? "EXPIRED"
      : sub.status;

  if (effectiveStatus === "EXPIRED" || effectiveStatus === "CANCELLED" || effectiveStatus === "LIMITED") {
    throw new Error(`PLAN_LIMIT: FORBIDDEN. Account in ${effectiveStatus} mode. Upgrade required.`);
  }

  return {
    tenant_limit: sub.plan.tenant_limit,   // null = unlimited
    hostel_limit: sub.plan.hostel_limit,
  };
}

export const planGate = {
  /**
   * Assert the owner can add one more tenant.
   * Call this BEFORE creating a tenant record.
   */
  async assertTenantLimit(ownerId: string): Promise<void> {
    const limits = await getEffectiveLimits(ownerId);
    if (limits.tenant_limit === null) return; // unlimited

    const current = await prisma.tenant.count({
      where: { owner_id: ownerId, status: { not: "LEFT" } },
    });

    if (current >= limits.tenant_limit) {
      throw new Error(
        `PLAN_LIMIT: You've reached your plan limit of ${limits.tenant_limit} tenants. ` +
        `Upgrade to Pro or Business to add more.`
      );
    }
  },

  /**
   * Assert the owner can add one more hostel.
   * Call this BEFORE creating a hostel record.
   */
  async assertHostelLimit(ownerId: string): Promise<void> {
    const limits = await getEffectiveLimits(ownerId);
    if (limits.hostel_limit === null) return; // unlimited

    const current = await prisma.hostel.count({
      where: { owner_id: ownerId, is_active: true },
    });

    if (current >= limits.hostel_limit) {
      throw new Error(
        `PLAN_LIMIT: You've reached your plan limit of ${limits.hostel_limit} hostel(s). ` +
        `Upgrade to Pro or Business to add more.`
      );
    }
  },
};
