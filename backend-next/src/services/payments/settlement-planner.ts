/**
 * 🏗️ Settlement Planner — Pure Domain Module
 *
 * The SINGLE source of truth for settlement priority, obligation tiers,
 * allocation logic, and minimum payment computation.
 *
 * Properties:
 * - Pure function — no Prisma, no I/O, no side effects
 * - Unit-testable without mocks
 * - Consumed by: settlement-preview, create-intent, _settleTenantRentPaymentInTx, receipts
 *
 * IMPORTANT: If you change priority order here, also update the SQL CASE WHEN
 * in _settleTenantRentPaymentInTx() FOR UPDATE query to match.
 */

// ── The canonical priority order ──────────────────────────────────────────────
// Security Deposit → Maintenance → Rent → Extra Charges
// This order is also encoded in the SQL FOR UPDATE query inside
// _settleTenantRentPaymentInTx. Keep them in sync.

export const SETTLEMENT_PRIORITY: Record<string, number> = {
  SECURITY_DEPOSIT: 1,
  MAINTENANCE: 2,
  RENT: 3,
  EXTRA_CHARGE: 4,
};

// ── Obligation tiers for minimum payment grouping ─────────────────────────────
// When partial payments are disabled, the minimum = sum of all outstanding
// obligations in the first INCOMPLETE tier.
//
// Tier 1 (Onboarding): Security Deposit + Maintenance → move-in costs, one unit
// Tier 2 (Recurring):  Rent → monthly obligations
// Tier 3 (Other):      Extra Charges → ad-hoc charges

export const SETTLEMENT_TIERS: Record<string, string> = {
  SECURITY_DEPOSIT: "ONBOARDING",
  MAINTENANCE: "ONBOARDING",
  RENT: "RECURRING",
  EXTRA_CHARGE: "OTHER",
};

const TIER_ORDER = ["ONBOARDING", "RECURRING", "OTHER"];

const TIER_LABELS: Record<string, string> = {
  ONBOARDING: "Onboarding Dues",
  RECURRING: "Rent",
  OTHER: "Extra Charges",
};

export const TYPE_LABELS: Record<string, string> = {
  RENT: "Rent",
  MAINTENANCE: "Maintenance",
  SECURITY_DEPOSIT: "Security Deposit",
  EXTRA_CHARGE: "Extra Charge",
};

// ── Input types ───────────────────────────────────────────────────────────────

export interface ObligationSnapshot {
  id: string;
  obligation_type: string;
  amount: number;          // total due (rupees)
  paid: number;            // already paid (rupees)
  due_date: Date;
  rent_month: Date | null;
  owner_id: string;
}

export interface PaymentPolicy {
  allow_partial: boolean;
  minimum_amount: number;  // hostel-configured floor (rupees)
}

// ── Output types ──────────────────────────────────────────────────────────────

export interface SettlementAllocation {
  obligation_id: string;
  type: string;
  tier: string;
  label: string;
  rent_month: Date | null;
  amount_due: number;
  outstanding: number;
  allocated: number;
  result: "PAID" | "PARTIAL" | "UNCHANGED";
}

export interface SettlementPlan {
  allocations: SettlementAllocation[];
  future_credit: number;
  total_outstanding: number;
  total_to_settle: number;
  remaining_outstanding: number;
  minimum_allowed: number;
  first_tier_label: string;
  payment_accepted: boolean;
  rejection_reason: string | null;
  payment_policy: "FULL_PAYMENT" | "PARTIAL_ALLOWED";
  warnings: string[];
  summary: string;
}

// ── Sort ──────────────────────────────────────────────────────────────────────

export function sortObligationsByPriority<T extends { obligation_type: string; due_date: Date; rent_month: Date | null }>(
  obligations: T[]
): T[] {
  return [...obligations].sort((a, b) => {
    const pa = SETTLEMENT_PRIORITY[a.obligation_type] ?? 5;
    const pb = SETTLEMENT_PRIORITY[b.obligation_type] ?? 5;
    if (pa !== pb) return pa - pb;
    const dateDiff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    if (dateDiff !== 0) return dateDiff;
    if (a.rent_month && b.rent_month) {
      return new Date(a.rent_month).getTime() - new Date(b.rent_month).getTime();
    }
    return 0;
  });
}

// ── Label helper ──────────────────────────────────────────────────────────────

function buildAllocationLabel(obligationType: string, rentMonth: Date | null): string {
  const monthLabel = rentMonth
    ? new Date(rentMonth).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : "";
  const typeLabel = TYPE_LABELS[obligationType] || obligationType;
  return monthLabel ? `${monthLabel} ${typeLabel}` : typeLabel;
}

// ── The planner ───────────────────────────────────────────────────────────────

export function buildSettlementPlan(
  rawObligations: ObligationSnapshot[],
  amountRupees: number,
  policy: PaymentPolicy
): SettlementPlan {
  const obligations = sortObligationsByPriority(rawObligations);
  const amountPaisa = Math.round(amountRupees * 100);
  let remainingPaisa = amountPaisa;

  // ── 1. Compute allocations ──────────────────────────────────────────────────
  const allocations: SettlementAllocation[] = [];
  let totalOutstandingPaisa = 0;

  for (const ob of obligations) {
    const duePaisa = Math.round(ob.amount * 100);
    const paidPaisa = Math.round(ob.paid * 100);
    const outstandingPaisa = Math.max(duePaisa - paidPaisa, 0);
    if (outstandingPaisa <= 0) continue;

    totalOutstandingPaisa += outstandingPaisa;

    const allocPaisa = Math.min(remainingPaisa, outstandingPaisa);
    const result: "PAID" | "PARTIAL" | "UNCHANGED" = allocPaisa <= 0
      ? "UNCHANGED"
      : (paidPaisa + allocPaisa >= duePaisa ? "PAID" : "PARTIAL");

    const tier = SETTLEMENT_TIERS[ob.obligation_type] || "OTHER";
    const label = buildAllocationLabel(ob.obligation_type, ob.rent_month);

    allocations.push({
      obligation_id: ob.id,
      type: ob.obligation_type,
      tier,
      label,
      rent_month: ob.rent_month,
      amount_due: duePaisa / 100,
      outstanding: outstandingPaisa / 100,
      allocated: allocPaisa / 100,
      result,
    });

    remainingPaisa -= allocPaisa;
  }

  const futureCreditPaisa = Math.max(remainingPaisa, 0);
  const futureCredit = futureCreditPaisa / 100;
  const totalOutstanding = totalOutstandingPaisa / 100;
  const totalToSettlePaisa = amountPaisa - futureCreditPaisa;
  const totalToSettle = totalToSettlePaisa / 100;
  const remainingOutstanding = Math.max(totalOutstanding - totalToSettle, 0);

  // ── 2. Compute minimum allowed payment (by tier) ────────────────────────────
  let minimumAllowed: number;
  let firstTierLabel = "";

  if (totalOutstanding === 0) {
    // No outstanding obligations — any positive amount becomes future credit
    minimumAllowed = 1;
    firstTierLabel = "Future Rent Credit";
  } else if (policy.allow_partial) {
    // Partial payments allowed — use hostel-configured minimum or ₹1
    minimumAllowed = Math.max(policy.minimum_amount, 1);
    // Find the label for the first outstanding obligation for UI context
    const firstOutstanding = allocations.find(a => a.outstanding > 0);
    firstTierLabel = firstOutstanding?.label || "";
  } else {
    // Full payment required — minimum = sum of first incomplete tier
    const tierTotals: Record<string, { total: number; label: string }> = {};
    for (const alloc of allocations) {
      if (alloc.outstanding <= 0) continue;
      if (!tierTotals[alloc.tier]) {
        tierTotals[alloc.tier] = {
          total: 0,
          label: TIER_LABELS[alloc.tier] || alloc.label,
        };
      }
      tierTotals[alloc.tier].total += alloc.outstanding;
    }

    const firstIncompleteTier = TIER_ORDER.find(t => tierTotals[t]);
    if (firstIncompleteTier && tierTotals[firstIncompleteTier]) {
      minimumAllowed = tierTotals[firstIncompleteTier].total;
      firstTierLabel = tierTotals[firstIncompleteTier].label;
    } else {
      minimumAllowed = 1;
    }
  }

  // ── 3. Validate ─────────────────────────────────────────────────────────────
  const paymentAccepted = amountRupees >= minimumAllowed;
  let rejectionReason: string | null = null;
  if (!paymentAccepted) {
    rejectionReason = policy.allow_partial
      ? `Minimum payment is ₹${minimumAllowed.toLocaleString("en-IN")}`
      : `Full payment required. Minimum: ₹${minimumAllowed.toLocaleString("en-IN")} (${firstTierLabel})`;
  }

  // ── 4. Warnings ─────────────────────────────────────────────────────────────
  const warnings: string[] = [];
  if (futureCredit > 0) {
    warnings.push(`₹${futureCredit.toLocaleString("en-IN")} will be credited as future rent`);
  }

  // ── 5. Summary ──────────────────────────────────────────────────────────────
  const activeAllocations = allocations.filter(a => a.allocated > 0);
  let summary: string;
  if (activeAllocations.length === 0 && futureCredit > 0) {
    summary = `₹${amountRupees.toLocaleString("en-IN")} → credited as future rent`;
  } else if (futureCredit > 0) {
    summary = `₹${amountRupees.toLocaleString("en-IN")} → ${activeAllocations.length} obligation(s) settled, ₹${futureCredit.toLocaleString("en-IN")} as future credit`;
  } else {
    summary = `₹${amountRupees.toLocaleString("en-IN")} → ${activeAllocations.length} obligation(s) settled`;
  }

  return {
    allocations,
    future_credit: futureCredit,
    total_outstanding: totalOutstanding,
    total_to_settle: totalToSettle,
    remaining_outstanding: remainingOutstanding,
    minimum_allowed: minimumAllowed,
    first_tier_label: firstTierLabel,
    payment_accepted: paymentAccepted,
    rejection_reason: rejectionReason,
    payment_policy: policy.allow_partial ? "PARTIAL_ALLOWED" : "FULL_PAYMENT",
    warnings,
    summary,
  };
}

// ── Helpers for consumers ─────────────────────────────────────────────────────

/**
 * Convert a Prisma obligation row (with payments relation) into an ObligationSnapshot.
 * Used by settlement-preview, create-intent, and _settleTenantRentPaymentInTx.
 */
export function toObligationSnapshot(ob: {
  id: string;
  obligation_type: string;
  amount: any;
  due_date: Date;
  rent_month: Date | null;
  owner_id: string;
  payments: Array<{ amount_paid: any }>;
}): ObligationSnapshot {
  return {
    id: ob.id,
    obligation_type: ob.obligation_type,
    amount: Number(ob.amount),
    paid: ob.payments.reduce((s: number, p: any) => s + Number(p.amount_paid), 0),
    due_date: new Date(ob.due_date),
    rent_month: ob.rent_month ? new Date(ob.rent_month) : null,
    owner_id: ob.owner_id,
  };
}
