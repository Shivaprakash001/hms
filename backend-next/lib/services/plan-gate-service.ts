/**
 * 🚧 Plan Gate Service — Feature Limit Enforcement
 *
 * Rules:
 * - automation   → plan-gated (Starter+ required)
 * - reminders    → addon-credit-gated (ALL plans; credits must be > 0)
 * - No subscription row → treat as FREE (no automation)
 * - EXPIRED / CANCELLED / LIMITED → treat as FREE (no automation)
 */

import { prisma } from "../db";

// ─── Automation plan access map ───────────────────────────────────────────────
// Plans with automation = true in DB: STARTER, GROWTH, BUSINESS, SCALE
// FREE → automation = false
// This is a belt-and-suspenders constant; real truth is plan.automation column.

async function getEffectivePlan(ownerId: string) {
  const sub = await prisma.ownerSubscription.findUnique({
    where: { owner_id: ownerId },
    include: { plan: true },
  });

  if (!sub) {
    // No subscription → treat as FREE (no automation)
    return null;
  }

  const effectiveStatus =
    sub.status === "ACTIVE" && sub.end_date && new Date() > sub.end_date
      ? "EXPIRED"
      : sub.status;

  if (["EXPIRED", "CANCELLED", "LIMITED"].includes(effectiveStatus)) {
    return null; // Treat blocked accounts as FREE for feature purposes
  }

  return sub.plan;
}

// ─── Automation Guard ─────────────────────────────────────────────────────────

/**
 * Throws a structured FEATURE_NOT_AVAILABLE error if the owner's plan does NOT
 * include automation (i.e., FREE plan or expired subscription).
 *
 * Apply to:
 *   - manual rent generation trigger
 *   - cron auto late-fee application
 *   - cron auto-reminder dispatch
 */
export async function requireAutomation(ownerId: string): Promise<void> {
  const plan = await getEffectivePlan(ownerId);

  if (!plan || !plan.automation) {
    throw Object.assign(new Error("Upgrade to Starter to enable automation"), {
      code: "FEATURE_NOT_AVAILABLE",
      feature: "automation",
      upgrade_plan: "starter",
      status: 402,
    });
  }
}

// ─── Reminder Credit Guard ────────────────────────────────────────────────────

/**
 * Atomically deducts one reminder credit from the owner's addon_usage row.
 * Throws NO_REMINDERS_LEFT if credits are exhausted.
 *
 * Apply to:
 *   - every manual reminder send
 *   - every auto reminder send (in addition to requireAutomation for auto)
 */
export async function consumeReminder(ownerId: string): Promise<void> {
  const usage = await prisma.addonUsage.findUnique({
    where: { owner_id: ownerId },
    select: { reminders_remaining: true },
  });

  if (!usage || Number(usage.reminders_remaining) <= 0) {
    throw Object.assign(new Error("No reminder credits left. Buy a pack to continue sending reminders."), {
      code: "NO_REMINDERS_LEFT",
      feature: "reminders",
      status: 402,
    });
  }

  await prisma.addonUsage.update({
    where: { owner_id: ownerId },
    data: {
      reminders_remaining: { decrement: 1 },
      reminders_used: { increment: 1 },
    },
  });
}

/**
 * Returns remaining reminder credits for an owner.
 * Returns 0 if no addon row exists.
 */
export async function getReminderCredits(ownerId: string): Promise<number> {
  const usage = await prisma.addonUsage.findUnique({
    where: { owner_id: ownerId },
    select: { reminders_remaining: true, reminders_used: true },
  });
  return Number(usage?.reminders_remaining ?? 0);
}

// ─── Legacy planGate object (kept for backward compat with existing callers) ──

export const planGate = {
  async assertTenantLimit(ownerId: string): Promise<void> {
    const plan = await getEffectivePlan(ownerId);
    if (!plan) throw new Error("PLAN_LIMIT: FORBIDDEN. No active subscription.");
    if (plan.tenant_limit === 0) return; // 0 = unlimited

    const current = await prisma.tenant.count({
      where: { owner_id: ownerId, status: { not: "LEFT" } },
    });

    if (current >= plan.tenant_limit) {
      throw new Error("PLAN_LIMIT: TENANT_LIMIT_REACHED");
    }
  },

  async assertHostelLimit(ownerId: string): Promise<void> {
    const plan = await getEffectivePlan(ownerId);
    if (!plan) throw new Error("PLAN_LIMIT: FORBIDDEN. No active subscription.");
    if (plan.hostel_limit === 0) return;

    const current = await prisma.hostel.count({
      where: { owner_id: ownerId, is_active: true },
    });

    if (current >= plan.hostel_limit) {
      throw new Error("PLAN_LIMIT: HOSTEL_LIMIT_REACHED");
    }
  },

  async assertFeatureAllowed(ownerId: string, feature: "automation" | "multi_hostel" | "analytics"): Promise<void> {
    if (feature === "automation") {
      await requireAutomation(ownerId);
      return;
    }
    const plan = await getEffectivePlan(ownerId);
    if (!plan || !plan[feature]) {
      throw new Error("PLAN_LIMIT: FEATURE_NOT_AVAILABLE");
    }
  },

  /**
   * @deprecated Reminders are NOT plan-gated. Use consumeReminder() instead.
   * Kept only to avoid breaking legacy call-sites; always returns true.
   */
  async assertRemindersAllowed(_ownerId: string): Promise<void> {
    // Reminders are addon-credit-gated, not plan-gated.
    // This stub is intentionally a no-op. Use consumeReminder() at send time.
    return;
  },

  async hasFeature(ownerId: string, feature: "automation" | "multi_hostel" | "analytics"): Promise<boolean> {
    try {
      const plan = await getEffectivePlan(ownerId);
      return !!plan?.[feature];
    } catch {
      return false;
    }
  },

  /**
   * @deprecated Reminders are NOT plan-gated. Check addon credits instead.
   */
  async hasReminders(_ownerId: string): Promise<boolean> {
    return true; // All plans can send reminders if they have credits
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
  },
};
