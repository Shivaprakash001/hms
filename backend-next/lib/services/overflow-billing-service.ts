import { prisma } from "../db";
import { getLogger } from "../logger";
import crypto from "crypto";

const logger = getLogger("overflow.billing");

// ── Upgrade nudge: show when overflow cost ≥ 40% of the price gap to next plan
const NUDGE_THRESHOLD_RATIO = 0.4;

// Next plan in upgrade path
const NEXT_PLAN: Record<string, string> = {
  STARTER: "GROWTH",
  GROWTH: "BUSINESS",
};

export type OverflowThreshold = "SAFE" | "WARNING_80" | "OVERFLOW" | "NEAR_CAP" | "AT_CAP";

export interface OverflowStatus {
  enabled: boolean;
  plan_id: string;
  active_tenants: number;
  included_limit: number;
  overflow_count: number;
  overflow_amount_paise: number;
  hard_cap: number;
  percentage_of_included: number;
  percentage_of_hard_cap: number;
  threshold: OverflowThreshold;
  upgrade_nudge: {
    show: boolean;
    recommended_plan: string | null;
    monthly_overflow_cost: number;
    plan_price_gap: number;
    message: string | null;
  };
}

interface OverflowCalcResult {
  owner_id: string;
  billing_month: Date;
  plan_id: string;
  active_tenant_count: number;
  included_limit: number;
  overflow_count: number;
  overflow_price_per_tenant_paise: number;
  overflow_amount_paise: number;
  idempotency_key: string;
}

export class OverflowBillingService {
  private getOverflowConfig(plan: any) {
    const features = plan?.features && typeof plan.features === "object" ? plan.features : {};
    return {
      enabled: Boolean(plan?.overflow_enabled ?? features.overflow_enabled ?? false),
      pricePerTenantPaise: Number(plan?.overflow_price_per_tenant_paise ?? features.overflow_price_per_tenant_paise ?? 0),
      hardCap: Number(plan?.overflow_hard_cap ?? features.overflow_hard_cap ?? plan?.tenant_limit ?? 0),
    };
  }

  /**
   * Returns the first-of-month Date for a given month string (YYYY-MM) or current month.
   */
  private _billingMonthDate(month?: string): Date {
    if (month) {
      const [year, mon] = month.split("-").map(Number);
      return new Date(Date.UTC(year, mon - 1, 1));
    }
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  /**
   * Calculate overflow for a single owner without writing to DB.
   * Safe to call repeatedly — pure read operation.
   */
  async calculateForOwner(ownerId: string, billingMonth?: string): Promise<OverflowCalcResult | null> {
    const sub = await prisma.owner_subscriptions.findUnique({
    where: { owner_id: ownerId },
    include: {
        plans: {
          select: {
            id: true,
            tenant_limit: true,
            features: true,
          },
        },
      },
    });
    if (!sub || sub.status !== "ACTIVE") return null;

    const plan = sub.plans;
    const cfg = this.getOverflowConfig(plan);
    if (!cfg.enabled) return null;
    if (plan.tenant_limit <= 0) return null; // unlimited plan — no overflow

    const monthDate = this._billingMonthDate(billingMonth);
    const idempotencyKey = `${ownerId}:${monthDate.toISOString().slice(0, 10)}`;

    const activeTenants = await prisma.tenants.count({
      where: { owner_id: ownerId, status: { notIn: ["LEFT", "CANCELLED", "EXPIRED"] } },
    });

    const overflowCount = Math.max(0, activeTenants - plan.tenant_limit);
    const overflowAmountPaise = overflowCount * cfg.pricePerTenantPaise;

    return {
      owner_id: ownerId,
      billing_month: monthDate,
      plan_id: plan.id,
      active_tenant_count: activeTenants,
      included_limit: plan.tenant_limit,
      overflow_count: overflowCount,
      overflow_price_per_tenant_paise: cfg.pricePerTenantPaise,
      overflow_amount_paise: overflowAmountPaise,
      idempotency_key: idempotencyKey,
    };
  }

  /**
   * Process overflow billing for a single owner for the given billing month.
   * Idempotent: safe to call multiple times — uses idempotency_key unique constraint.
   *
   * Returns: { status, overflow_count, overflow_amount_paise, invoice_id?, skipped }
   */
  async processForOwner(
    ownerId: string,
    billingMonth?: string
  ): Promise<{
    status: "INVOICED" | "ZERO" | "SKIPPED" | "NOT_APPLICABLE";
    overflow_count: number;
    overflow_amount_paise: number;
    invoice_id: string | null;
    skipped: boolean;
  }> {
    const calc = await this.calculateForOwner(ownerId, billingMonth);

    if (!calc) {
      return { status: "NOT_APPLICABLE", overflow_count: 0, overflow_amount_paise: 0, invoice_id: null, skipped: false };
    }

    // Idempotency: if already processed this month, return existing record
    const existing = await prisma.overflow_ledger.findUnique({
      where: { idempotency_key: calc.idempotency_key },
    });
    if (existing) {
      logger.info("overflow.process.idempotent_skip", {
        owner_id: ownerId,
        billing_month: calc.billing_month,
        existing_status: existing.status,
      });
      return {
        status: existing.status as any,
        overflow_count: existing.overflow_count,
        overflow_amount_paise: existing.overflow_amount_paise,
        invoice_id: existing.invoice_id,
        skipped: true,
      };
    }

    // Save usage snapshot (upsert — safe if already exists)
    await prisma.owner_usage_snapshots.upsert({
      where: { owner_id_billing_month: { owner_id: ownerId, billing_month: calc.billing_month } },
      create: {
        owner_id: ownerId,
        billing_month: calc.billing_month,
        plan_id: calc.plan_id,
        active_tenant_count: calc.active_tenant_count,
        included_limit: calc.included_limit,
        overflow_tenant_count: calc.overflow_count,
        overflow_amount_paise: calc.overflow_amount_paise,
        peak_tenant_count: calc.active_tenant_count,
      },
      update: {
        active_tenant_count: calc.active_tenant_count,
        overflow_tenant_count: calc.overflow_count,
        overflow_amount_paise: calc.overflow_amount_paise,
        peak_tenant_count: calc.active_tenant_count,
        snapshot_taken_at: new Date(),
      },
    });

    // No overflow — record ZERO entry and exit
    if (calc.overflow_count === 0) {
      await prisma.overflow_ledger.create({
        data: {
          owner_id: ownerId,
          billing_month: calc.billing_month,
          plan_id: calc.plan_id,
          active_tenant_count: calc.active_tenant_count,
          included_limit: calc.included_limit,
          overflow_count: 0,
          overflow_price_per_tenant_paise: calc.overflow_price_per_tenant_paise,
          overflow_amount_paise: 0,
          status: "ZERO",
          idempotency_key: calc.idempotency_key,
          processed_at: new Date(),
        },
      });
      return { status: "ZERO", overflow_count: 0, overflow_amount_paise: 0, invoice_id: null, skipped: false };
    }

    // Create invoice + ledger atomically
    const result = await prisma.$transaction(async (tx) => {
      const invoiceNumber = `OVF-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const now = new Date();
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 7);
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + 30);

      const planLabel = calc.plan_id.charAt(0) + calc.plan_id.slice(1).toLowerCase();
      const pricePerTenantRs = calc.overflow_price_per_tenant_paise / 100;

      const lineItems = [
        {
          type: "OVERFLOW",
          description: `Extra Tenant Usage — ${calc.overflow_count} tenant${calc.overflow_count !== 1 ? "s" : ""} × ₹${pricePerTenantRs}`,
          quantity: calc.overflow_count,
          unit_price_paise: calc.overflow_price_per_tenant_paise,
          amount_paise: calc.overflow_amount_paise,
        },
      ];

      const invoice = await tx.ownerInvoice.create({
        data: {
          owner_id: ownerId,
          plan_id: calc.plan_id,
          invoice_number: invoiceNumber,
          amount_paise: calc.overflow_amount_paise,
          status: "PENDING",
          billing_month: calc.billing_month,
          due_date: dueDate,
          expires_at: expiresAt,
          line_items: lineItems,
        },
      });

      const ledger = await tx.overflow_ledger.create({
        data: {
          owner_id: ownerId,
          billing_month: calc.billing_month,
          plan_id: calc.plan_id,
          active_tenant_count: calc.active_tenant_count,
          included_limit: calc.included_limit,
          overflow_count: calc.overflow_count,
          overflow_price_per_tenant_paise: calc.overflow_price_per_tenant_paise,
          overflow_amount_paise: calc.overflow_amount_paise,
          invoice_id: invoice.id,
          status: "INVOICED",
          idempotency_key: calc.idempotency_key,
          processed_at: new Date(),
        },
      });

      return { invoice, ledger };
    });

    logger.info("overflow.process.invoiced", {
      owner_id: ownerId,
      billing_month: calc.billing_month,
      overflow_count: calc.overflow_count,
      overflow_amount_paise: calc.overflow_amount_paise,
      invoice_id: result.invoice.id,
    });

    return {
      status: "INVOICED",
      overflow_count: calc.overflow_count,
      overflow_amount_paise: calc.overflow_amount_paise,
      invoice_id: result.invoice.id,
      skipped: false,
    };
  }

  /**
   * Process all eligible owners for monthly overflow billing.
   * Entry point for the monthly cron job.
   * Returns a summary of what was processed.
   */
  async processAllOwners(billingMonth?: string): Promise<{
    processed: number;
    invoiced: number;
    zero: number;
    skipped: number;
    errors: number;
    total_overflow_paise: number;
    details: Array<{ owner_id: string; status: string; overflow_count: number; overflow_amount_paise: number }>;
  }> {
    // ACTIVE subscriptions only; overflow eligibility is decided in calculateForOwner()
    const eligibleSubs = await prisma.owner_subscriptions.findMany({
      where: {
        status: "ACTIVE",
      },
      select: { owner_id: true },
    });

    const summary = {
      processed: 0,
      invoiced: 0,
      zero: 0,
      skipped: 0,
      errors: 0,
      total_overflow_paise: 0,
      details: [] as Array<{ owner_id: string; status: string; overflow_count: number; overflow_amount_paise: number }>,
    };

    for (const sub of eligibleSubs) {
      try {
        const result = await this.processForOwner(sub.owner_id, billingMonth);
        summary.processed++;

        if (result.skipped) summary.skipped++;
        else if (result.status === "INVOICED") summary.invoiced++;
        else if (result.status === "ZERO") summary.zero++;

        summary.total_overflow_paise += result.overflow_amount_paise;
        summary.details.push({
          owner_id: sub.owner_id,
          status: result.status,
          overflow_count: result.overflow_count,
          overflow_amount_paise: result.overflow_amount_paise,
        });
      } catch (err: any) {
        summary.errors++;
        logger.error("overflow.process_all.owner_failed", {
          owner_id: sub.owner_id,
          error: err?.message,
        });
        summary.details.push({
          owner_id: sub.owner_id,
          status: "ERROR",
          overflow_count: 0,
          overflow_amount_paise: 0,
        });
      }
    }

    logger.info("overflow.process_all.complete", summary);
    return summary;
  }

  /**
   * Returns current overflow status for an owner — used by billing dashboard.
   * Pure read, no writes. Always returns a valid structure.
   */
  async getOverflowStatus(ownerId: string): Promise<OverflowStatus> {
    const sub = await prisma.owner_subscriptions.findUnique({
    where: { owner_id: ownerId },
    include: {
        plans: {
          select: {
            id: true,
            name: true,
            price_inr: true,
            tenant_limit: true,
            is_custom: true,
            features: true,
          },
        },
      },
    });

    const disabled: OverflowStatus = {
      enabled: false,
      plan_id: sub?.plan_id ?? "FREE",
      active_tenants: 0,
      included_limit: 0,
      overflow_count: 0,
      overflow_amount_paise: 0,
      hard_cap: 0,
      percentage_of_included: 0,
      percentage_of_hard_cap: 0,
      threshold: "SAFE",
      upgrade_nudge: { show: false, recommended_plan: null, monthly_overflow_cost: 0, plan_price_gap: 0, message: null },
    };

    if (!sub) return disabled;

    const plan = sub.plans;

    const activeTenants = await prisma.tenants.count({
      where: { owner_id: ownerId, status: { notIn: ["LEFT", "CANCELLED", "EXPIRED"] } },
    });

    // Unlimited plans (BUSINESS/SCALE or custom)
    if (plan.tenant_limit <= 0 || plan.is_custom) {
      return { ...disabled, enabled: false, plan_id: plan.id, active_tenants: activeTenants };
    }

    const includedLimit = plan.tenant_limit;
    const cfg = this.getOverflowConfig(plan);
    const hardCap = cfg.hardCap || includedLimit;
    const overflowEnabled = cfg.enabled;
    const overflowCount = Math.max(0, activeTenants - includedLimit);
    const overflowAmountPaise = overflowEnabled ? overflowCount * cfg.pricePerTenantPaise : 0;

    const pctOfIncluded = Math.round((activeTenants / includedLimit) * 100);
    const pctOfHardCap = hardCap > 0 ? Math.round((activeTenants / hardCap) * 100) : 0;

    let threshold: OverflowThreshold = "SAFE";
    if (activeTenants >= hardCap && hardCap > 0) threshold = "AT_CAP";
    else if (pctOfHardCap >= 93) threshold = "NEAR_CAP";
    else if (activeTenants > includedLimit) threshold = "OVERFLOW";
    else if (pctOfIncluded >= 80) threshold = "WARNING_80";

    // Upgrade nudge calculation
    let upgradeNudge = disabled.upgrade_nudge;
    const nextPlanId = NEXT_PLAN[plan.id];
    if (overflowEnabled && overflowCount > 0 && nextPlanId) {
      const nextPlan = await prisma.plans.findUnique({ where: { id: nextPlanId }, select: { price_inr: true, name: true } });
      if (nextPlan) {
        const priceGapPaise = nextPlan.price_inr - plan.price_inr;
        const nudgeThresholdPaise = Math.round(priceGapPaise * NUDGE_THRESHOLD_RATIO);
        const showNudge = overflowAmountPaise >= nudgeThresholdPaise && priceGapPaise > 0;
        upgradeNudge = {
          show: showNudge,
          recommended_plan: nextPlanId,
          monthly_overflow_cost: overflowAmountPaise,
          plan_price_gap: priceGapPaise,
          message: showNudge
            ? `You're spending ₹${(overflowAmountPaise / 100).toFixed(0)}/mo on overflow. Upgrade to ${nextPlan.name} for only ₹${(priceGapPaise / 100).toFixed(0)} more.`
            : null,
        };
      }
    }

    return {
      enabled: overflowEnabled,
      plan_id: plan.id,
      active_tenants: activeTenants,
      included_limit: includedLimit,
      overflow_count: overflowCount,
      overflow_amount_paise: overflowAmountPaise,
      hard_cap: hardCap,
      percentage_of_included: pctOfIncluded,
      percentage_of_hard_cap: pctOfHardCap,
      threshold,
      upgrade_nudge: upgradeNudge,
    };
  }
}

export const overflowBillingService = new OverflowBillingService();
