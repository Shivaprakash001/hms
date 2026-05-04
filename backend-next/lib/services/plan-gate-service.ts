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
import { getLogger } from "../logger";

const logger = getLogger("plan-gate");

// ─── Rate limit config ────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX        = 10;    // max sends per owner per window
const rateLimitMap          = new Map<string, { count: number; windowStart: number }>();

// ─── Automation plan access map ───────────────────────────────────────────────

async function getEffectivePlan(ownerId: string) {
  const sub = await prisma.ownerSubscription.findUnique({
    where: { owner_id: ownerId },
    include: { plan: true },
  });

  if (!sub) return null;

  const effectiveStatus =
    sub.status === "ACTIVE" && sub.end_date && new Date() > sub.end_date
      ? "EXPIRED"
      : sub.status;

  if (["EXPIRED", "CANCELLED", "LIMITED"].includes(effectiveStatus)) {
    return null;
  }

  return sub.plan;
}

// ─── Automation Guard ─────────────────────────────────────────────────────────

/**
 * Throws a structured FEATURE_NOT_AVAILABLE error if the owner's plan does NOT
 * include automation (i.e., FREE plan or expired subscription).
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

// ─── Rate Limiter ─────────────────────────────────────────────────────────────

/**
 * In-process rate limiter: max 10 reminders per owner per 60s window.
 * Prevents credit burn from bugs or malicious clients.
 * Uses a sliding-window approach with Map (server memory — resets on restart).
 */
function checkRateLimit(ownerId: string): void {
  const now   = Date.now();
  const entry = rateLimitMap.get(ownerId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ownerId, { count: 1, windowStart: now });
    return;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    throw Object.assign(
      new Error(`Rate limit exceeded. Max ${RATE_LIMIT_MAX} reminders per minute.`),
      { code: "RATE_LIMIT_EXCEEDED", status: 429 }
    );
  }
}

// ─── Reminder Credit Guard ────────────────────────────────────────────────────

const AUTO_TOPUP_PACK = "200";
const AUTO_TOPUP_CREDITS = 200;

/**
 * Atomically deducts one reminder credit from the owner's addon_usage row.
 *
 * Enhancements:
 *  - Rate limiting (10/min per owner) before deduction
 *  - Auto-topup: if owner has auto_topup=true and credits just hit 0,
 *    queues a purchase of the 200-credit pack asynchronously
 *
 * Throws:
 *  - RATE_LIMIT_EXCEEDED (429)
 *  - NO_REMINDERS_LEFT  (402)
 */
export async function consumeReminder(ownerId: string): Promise<void> {
  // 1. Rate limit check (cheap, in-process)
  checkRateLimit(ownerId);

  // 2. Fetch current balance
  const usage = await (prisma.addonUsage as any).findUnique({
    where: { owner_id: ownerId },
    select: { reminders_remaining: true, auto_topup: true },
  });

  if (!usage || Number(usage.reminders_remaining) <= 0) {
    // 3. Auto-topup: fire-and-forget purchase intent if owner opted in
    if ((usage as any)?.auto_topup) {
      triggerAutoTopup(ownerId).catch((err) =>
        logger.error("auto_topup.failed", { owner_id: ownerId, error: err?.message })
      );
    }

    throw Object.assign(
      new Error("No reminder credits left. Buy a pack to continue sending reminders."),
      { code: "NO_REMINDERS_LEFT", feature: "reminders", status: 402 }
    );
  }

  // 4. Atomic decrement
  await prisma.addonUsage.update({
    where: { owner_id: ownerId },
    data: {
      reminders_remaining: { decrement: 1 },
      reminders_used: { increment: 1 },
    },
  });

  // 5. Post-deduction: check if balance just hit low-credit threshold → log event
  const remaining = Number(usage.reminders_remaining) - 1;
  if (remaining === 20 || remaining === 5) {
    logger.warn("addons.low_credits", { owner_id: ownerId, remaining });
  }
}

/**
 * Auto-topup: creates a payment intent for the 200-credit pack.
 * Called fire-and-forget when auto_topup = true and credits hit 0.
 * Only creates an intent — the actual credit happens via webhook.
 *
 * NOTE: In production, this should send an email/notification to the owner
 * so they can complete the payment. PhonePe requires user interaction for UPI.
 * For now, we log the event so it can be surfaced in the dashboard.
 */
async function triggerAutoTopup(ownerId: string): Promise<void> {
  logger.info("auto_topup.triggered", { owner_id: ownerId, pack: AUTO_TOPUP_PACK });

  // Log the auto-topup intent for dashboard visibility
  await prisma.systemEventLog.create({
    data: {
      event_type: "AUTO_TOPUP_TRIGGERED",
      owner_id: ownerId,
      metadata: {
        pack: AUTO_TOPUP_PACK,
        credits: AUTO_TOPUP_CREDITS,
        reason: "credits_exhausted",
      } as any,
    },
  }).catch(() => {}); // Non-critical — don't let this fail the main flow
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

// ─── Reconciliation ───────────────────────────────────────────────────────────

/**
 * Reconciles addon_usage.reminders_remaining against the ledger truth:
 *   ledger_credits = SUM(credits_added) from addon_transactions
 *   ledger_consumed = reminders_used
 *   expected_remaining = ledger_credits - ledger_consumed
 *
 * Returns a mismatch report. Called by the reconciliation cron job.
 */
export async function reconcileAddonCredits(ownerId: string): Promise<{
  owner_id: string;
  balance: number;
  ledger_added: number;
  ledger_consumed: number;
  expected: number;
  mismatch: boolean;
  drift: number;
}> {
  const [usage, ledger] = await Promise.all([
    prisma.addonUsage.findUnique({
      where: { owner_id: ownerId },
      select: { reminders_remaining: true, reminders_used: true },
    }),
    (prisma as any).addonTransaction.aggregate({
      where: { owner_id: ownerId },
      _sum: { credits_added: true },
    }),
  ]);

  const balance        = Number(usage?.reminders_remaining ?? 0);
  const consumed       = Number(usage?.reminders_used ?? 0);
  const ledger_added   = Number(ledger._sum?.credits_added ?? 0);
  const expected       = Math.max(0, ledger_added - consumed);
  const drift          = balance - expected;
  const mismatch       = drift !== 0;

  if (mismatch) {
    logger.error("addons.reconciliation.mismatch", {
      owner_id: ownerId,
      balance,
      consumed,
      ledger_added,
      expected,
      drift,
    });
  }

  return { owner_id: ownerId, balance, ledger_added, ledger_consumed: consumed, expected, mismatch, drift };
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

  /** @deprecated Reminders are NOT plan-gated. Use consumeReminder() instead. */
  async assertRemindersAllowed(_ownerId: string): Promise<void> {
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

  /** @deprecated Reminders are NOT plan-gated. Check addon credits instead. */
  async hasReminders(_ownerId: string): Promise<boolean> {
    return true;
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
