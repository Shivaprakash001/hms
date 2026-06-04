import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getLogger } from "@/lib/logger";
import { getTenantOperationalContext } from "@/lib/hostel-context";
import { randomUUID } from "crypto";

const logger = getLogger("tenant.advance");

// Refund lifecycle — physical money has not necessarily been returned until COMPLETED.
export type RefundStatus = "PENDING" | "COMPLETED" | "FAILED";

export class TenantAdvanceService {
  /**
   * Get the current advance balance and full ledger history for a tenant.
   * Balance = SUM(CREDIT) - SUM(DEBIT).
   * We recompute from ledger entries (authoritative), not from balance_after
   * snapshots (which are for audit display only).
   */
  async getBalance(tenantId: string, ownerId: string) {
    await this._assertOwnership(tenantId, ownerId);
    return this._buildBalanceResponse(tenantId);
  }

  /**
   * Tenant self-service balance — derives ownerId from DB, no caller-supplied ownerId.
   * Used by GET /api/tenants/me/advance.
   */
  async getBalanceForTenant(profileId: string) {
    const tenant = await prisma.tenants.findUnique({
      where: { profile_id: profileId },
      select: { id: true, owner_id: true },
    });
    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");
    return this._buildBalanceResponse(tenant.id);
  }

  private async _buildBalanceResponse(tenantId: string) {
    const entries = await prisma.tenant_advance_ledger.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: "asc" },
    });
    const balance = entries.reduce((acc: number, e: any) => {
      const amt = Number(e.amount);
      return e.type === "CREDIT" ? acc + amt : acc - amt;
    }, 0);
    return {
      tenant_id: tenantId,
      balance: Math.round(balance * 100) / 100,
      last_updated: entries.length > 0 ? entries[entries.length - 1].created_at : null,
      entries,
    };
  }

  /**
   * Record advance received from tenant (DEPOSIT or TOPUP).
   * Concurrency: SELECT FOR UPDATE on tenant row.
   */
  async credit(params: {
    tenantId: string;
    ownerId: string;
    createdBy: string;
    reason: "DEPOSIT" | "TOPUP";
    amount: number;
    notes?: string;
    referenceId?: string;
    referenceType?: string;
  }) {
    const { tenantId, ownerId, createdBy, reason, amount, notes, referenceId, referenceType } = params;

    if (amount <= 0) throw new Error("BAD_REQUEST: Amount must be positive");
    await this._assertOwnership(tenantId, ownerId);
    await this._assertAdvanceEnabled(ownerId, tenantId);

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const tenant = await tx.tenants.findUniqueOrThrow({
        where: { id: tenantId },
        select: { id: true, hostel_id: true },
      });
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
      const currentBalance = await this._computeBalance(tx, tenantId);
      const newBalance = Math.round((currentBalance + amount) * 100) / 100;
      const entry = await tx.tenant_advance_ledger.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          owner_id: ownerId,
          hostel_id: tenant.hostel_id,
          type: "CREDIT",
          reason,
          amount,
          balance_after: newBalance,
          notes: notes || null,
          reference_id: referenceId || null,
          reference_type: referenceType || null,
          created_by: createdBy,
        },
      });
      
      // Auto-apply advance balance to any outstanding obligations!
      await this.autoApplyAdvanceToDuesInTx(tx, tenantId, ownerId, createdBy);
      const balanceAfterApply = await this._computeBalance(tx, tenantId);

      logger.info("advance.credit", { tenant_id: tenantId, reason, amount, new_balance: balanceAfterApply, entry_id: entry.id });
      return { entry, balance: balanceAfterApply };
    });
  }

  /**
   * Idempotent credit used exclusively by finalizePaymentAttempt().
   * Called INSIDE the caller's transaction — no new transaction started.
   * Guards against duplicate webhook processing via the DB unique index
   * on (reference_id, reference_type).
   *
   * Returns the existing entry if already credited (idempotent), or creates a new one.
   */
  async creditIdempotentInTx(
    tx: any,
    params: {
      tenantId: string;
      ownerId: string;
      createdBy: string;
      amount: number;
      referenceId: string;
      referenceType: string;
      notes?: string;
    }
  ) {
    const { tenantId, ownerId, createdBy, amount, referenceId, referenceType, notes } = params;

    // Idempotency: if a ledger entry already exists for this reference, return it.
    const existing = await tx.tenant_advance_ledger.findFirst({
      where: {
        reference_id: referenceId,
        reference_type: referenceType,
      },
      select: { id: true },
    });
    if (existing) {
      logger.info("advance.credit.already_credited", { reference_id: referenceId, reference_type: referenceType });
      return { alreadyCredited: true };
    }

    const tenant = await tx.tenants.findUniqueOrThrow({
      where: { id: tenantId },
      select: { id: true, hostel_id: true },
    });

    const currentBalance = await this._computeBalance(tx, tenantId);
    const newBalance = Math.round((currentBalance + amount) * 100) / 100;

    const entry = await tx.tenant_advance_ledger.create({
      data: {
        id: randomUUID(),
        tenant_id: tenantId,
        owner_id: ownerId,
        hostel_id: tenant.hostel_id,
        type: "CREDIT",
        reason: "DEPOSIT",
        amount,
        balance_after: newBalance,
        notes: notes || `Gateway advance payment credited`,
        reference_id: referenceId,
        reference_type: referenceType,
        created_by: createdBy,
      },
    });

    // Auto-apply advance balance to any outstanding obligations!
    await this.autoApplyAdvanceToDuesInTx(tx, tenantId, ownerId, createdBy);
    const balanceAfterApply = await this._computeBalance(tx, tenantId);

    logger.info("advance.credit.from_gateway", {
      tenant_id: tenantId,
      amount,
      new_balance: balanceAfterApply,
      entry_id: entry.id,
      reference_id: referenceId,
    });

    return { entry, balance: balanceAfterApply, alreadyCredited: false };
  }

  /**
   * Record advance deduction or refund (DEDUCTION, REFUND, CORRECTION).
   * Validates balance is sufficient for DEDUCTION/REFUND.
   * Concurrency: SELECT FOR UPDATE on tenant row.
   */
  async debit(params: {
    tenantId: string;
    ownerId: string;
    createdBy: string;
    reason: "DEDUCTION" | "REFUND" | "CORRECTION";
    amount: number;
    notes?: string;
    referenceId?: string;
    referenceType?: string;
    refundStatus?: RefundStatus;
  }) {
    const { tenantId, ownerId, createdBy, reason, amount, notes, referenceId, referenceType, refundStatus } = params;

    if (amount <= 0) throw new Error("BAD_REQUEST: Amount must be positive");
    await this._assertOwnership(tenantId, ownerId);
    await this._assertAdvanceEnabled(ownerId, tenantId);

    // For REFUND: the entry is created with refund_status = PENDING.
    // Balance decreases immediately (intent recorded), but the physical money may not have
    // been returned yet. Owner must call the update-refund-status endpoint to mark COMPLETED.
    // CORRECTION entries bypass this — they are admin fixes and don't track physical flow.
    const effectiveRefundStatus =
      reason === "REFUND" ? (refundStatus ?? "PENDING") : null;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const tenant = await tx.tenants.findUniqueOrThrow({
        where: { id: tenantId },
        select: { id: true, hostel_id: true },
      });
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
      const currentBalance = await this._computeBalance(tx, tenantId);

      if (reason !== "CORRECTION" && currentBalance < amount) {
        throw new Error(
          `BAD_REQUEST: Insufficient advance balance. Available: ₹${currentBalance.toFixed(2)}, Requested: ₹${amount.toFixed(2)}`
        );
      }

      const newBalance = Math.max(0, Math.round((currentBalance - amount) * 100) / 100);

      const entry = await tx.tenant_advance_ledger.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          owner_id: ownerId,
          hostel_id: tenant.hostel_id,
          type: "DEBIT",
          reason,
          amount,
          balance_after: newBalance,
          notes: notes || null,
          reference_id: referenceId || null,
          reference_type: referenceType || null,
          refund_status: effectiveRefundStatus,
          created_by: createdBy,
        },
      });

      logger.info("advance.debit", { tenant_id: tenantId, reason, amount, new_balance: newBalance, entry_id: entry.id, refund_status: effectiveRefundStatus });
      return { entry, balance: newBalance };
    });
  }

  /**
   * Update the physical refund status on an existing REFUND ledger entry.
   * This must be called when the bank transfer actually completes or fails.
   */
  async updateRefundStatus(entryId: string, ownerId: string, status: RefundStatus) {
    const entry = await prisma.tenant_advance_ledger.findUnique({
      where: { id: entryId },
      select: { owner_id: true, reason: true },
    });
    if (!entry) throw new Error("NOT_FOUND: Ledger entry not found");
    if (entry.owner_id !== ownerId) throw new Error("FORBIDDEN: Not your ledger entry");
    if ((entry as any).reason !== "REFUND") throw new Error("BAD_REQUEST: Can only update refund_status on REFUND entries");

    return prisma.tenant_advance_ledger.update({
      where: { id: entryId },
      data: { refund_status: status },
    });
  }

  /**
   * Apply advance balance against an outstanding obligation.
   * Atomically:
   *   1. Validates advance balance >= requested amount
   *   2. Validates obligation belongs to tenant and is not PAID/WAIVED
   *   3. Creates a Payment record (method: ADVANCE_ADJUSTMENT)
   *   4. Updates obligation status
   *   5. Creates a ledger DEBIT entry
   *
   * Concurrency: locks tenant row + obligation row.
   */
  async adjustAgainstObligation(params: {
    tenantId: string;
    ownerId: string;
    createdBy: string;
    obligationId: string;
    amount: number;
    notes?: string;
  }) {
    const { tenantId, ownerId, createdBy, obligationId, amount, notes } = params;

    if (amount <= 0) throw new Error("BAD_REQUEST: Amount must be positive");
    await this._assertOwnership(tenantId, ownerId);
    await this._assertAdvanceEnabled(ownerId, tenantId);

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      return this.adjustAgainstObligationInTx(tx, params);
    });
  }

  /**
   * Inner logic to adjust advance balance against an obligation, running inside an existing transaction.
   */
  async adjustAgainstObligationInTx(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      ownerId: string;
      createdBy: string;
      obligationId: string;
      amount: number;
      notes?: string;
    }
  ) {
    const { tenantId, ownerId, createdBy, obligationId, amount, notes } = params;

    // Lock tenant row first (always first to avoid deadlock ordering)
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
    // Lock obligation row
    await tx.$queryRaw`SELECT id FROM rent_obligations WHERE id = ${obligationId}::uuid FOR UPDATE`;

    const obligation = await tx.rent_obligations.findUnique({
      where: { id: obligationId },
      include: { payments: { select: { amount_paid: true } } },
    });

    if (!obligation) throw new Error("NOT_FOUND: Obligation not found");
    if (obligation.tenant_id !== tenantId) throw new Error("FORBIDDEN: Obligation does not belong to this tenant");
    if (obligation.status === "PAID") throw new Error("BAD_REQUEST: Obligation already fully paid");
    if (obligation.status === "WAIVED") throw new Error("BAD_REQUEST: Cannot adjust a waived obligation");

    const paidPaisa = obligation.payments.reduce(
      (acc: number, p: any) => acc + Math.round(Number(p.amount_paid) * 100), 0
    );
    const obligationPaisa = Math.round(Number(obligation.amount) * 100);
    const remainingPaisa = obligationPaisa - paidPaisa;
    const adjustPaisa = Math.round(amount * 100);

    if (adjustPaisa > remainingPaisa) {
      throw new Error(
        `BAD_REQUEST: Adjustment exceeds outstanding balance. Outstanding: ₹${(remainingPaisa / 100).toFixed(2)}, Requested: ₹${amount.toFixed(2)}`
      );
    }

    // Check advance balance
    const currentBalance = await this._computeBalance(tx, tenantId);
    if (currentBalance < amount) {
      throw new Error(
        `BAD_REQUEST: Insufficient advance balance. Available: ₹${currentBalance.toFixed(2)}, Requested: ₹${amount.toFixed(2)}`
      );
    }

    // Create payment record
    const payment = await tx.payments.create({
      data: {
        obligation_id: obligationId,
        tenant_id: tenantId,
        owner_id: ownerId,
        hostel_id: obligation.hostel_id,
        amount_paid: adjustPaisa / 100,
        payment_method: "ADVANCE_ADJUSTMENT",
        reference_number: `ADV-${Date.now()}`,
        payment_date: new Date(),
      },
    });

    // Update obligation status
    const newPaidPaisa = paidPaisa + adjustPaisa;
    const newStatus = newPaidPaisa >= obligationPaisa ? "PAID" : "PARTIAL";
    await tx.rent_obligations.update({
      where: { id: obligationId },
      data: { status: newStatus },
    });

    // Ledger DEBIT
    const newBalance = Math.round((currentBalance - amount) * 100) / 100;
    const entry = await tx.tenant_advance_ledger.create({
      data: {
        id: randomUUID(),
        tenant_id: tenantId,
        owner_id: ownerId,
        hostel_id: obligation.hostel_id,
        type: "DEBIT",
        reason: "ADJUSTMENT",
        amount,
        balance_after: newBalance,
        notes: notes || `Adjusted against obligation ${obligationId}`,
        reference_id: obligationId,
        reference_type: "OBLIGATION",
        created_by: createdBy,
      },
    });

    logger.info("advance.adjust", {
      tenant_id: tenantId,
      obligation_id: obligationId,
      amount,
      new_balance: newBalance,
      payment_id: payment.id,
      entry_id: entry.id,
      obligation_new_status: newStatus,
    });

    return { entry, payment, balance: newBalance, obligation_status: newStatus };
  }

  /**
   * Automatically apply any positive advance balance to unpaid obligations
   * (PENDING / PARTIAL) for the tenant, oldest first. Runs inside an existing transaction.
   */
  async autoApplyAdvanceToDuesInTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ownerId: string,
    createdBy: string
  ) {
    // 1. Lock tenant row and fetch advance_deposit (security deposit)
    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
    const tenant = await tx.tenants.findUniqueOrThrow({
      where: { id: tenantId },
      select: { advance_deposit: true },
    });
    const securityDeposit = Number(tenant.advance_deposit || 0);

    // Fetch total paid amount against ADVANCE obligations (which represents the security deposit paid outside the ledger/already adjusted)
    const paidAdvanceObligations = await tx.payments.aggregate({
      where: {
        tenant_id: tenantId,
        obligation: {
          obligation_type: "ADVANCE",
        },
      },
      _sum: {
        amount_paid: true,
      },
    });
    const paidAdvanceObligationSum = Number(paidAdvanceObligations?._sum?.amount_paid || 0);

    // Calculate the remaining security deposit that needs to be held/reserved in the ledger
    const remainingSecurityDepositFromLedger = Math.max(0, securityDeposit - paidAdvanceObligationSum);

    // 2. Fetch current advance ledger balance
    const ledgerBalance = await this._computeBalance(tx, tenantId);
    
    // Only the amount exceeding the remaining security deposit that needs to be held is available for automatic rent/due adjustment.
    let currentBalance = Math.round(Math.max(0, ledgerBalance - remainingSecurityDepositFromLedger) * 100) / 100;
    if (currentBalance <= 0) return;

    // 3. Fetch all outstanding obligations for this tenant (oldest first)
    const obligations = await tx.rent_obligations.findMany({
      where: {
        tenant_id: tenantId,
        status: { in: ["PENDING", "PARTIAL"] },
      },
      include: { payments: { select: { amount_paid: true } } },
      orderBy: { rent_month: "asc" },
    });

    if (obligations.length === 0) return;

    for (const obligation of obligations) {
      if (currentBalance <= 0) break;

      const paidAmount = obligation.payments.reduce(
        (sum, p) => sum + Number(p.amount_paid), 0
      );
      const remainingAmount = Math.round((Number(obligation.amount) - paidAmount) * 100) / 100;

      if (remainingAmount <= 0) continue;

      const adjustAmount = Math.min(currentBalance, remainingAmount);
      if (adjustAmount > 0) {
        await this.adjustAgainstObligationInTx(tx, {
          tenantId,
          ownerId,
          createdBy,
          obligationId: obligation.id,
          amount: adjustAmount,
          notes: `Auto-adjusted from tenant advance balance`,
        });
        currentBalance = Math.round((currentBalance - adjustAmount) * 100) / 100;
      }
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async _assertOwnership(tenantId: string, ownerId: string) {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { owner_id: true },
    });
    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");
    if (tenant.owner_id !== ownerId) throw new Error("FORBIDDEN: Tenant does not belong to this owner");
  }

  private async _assertAdvanceEnabled(ownerId: string, tenantId?: string) {
    // Phase 2: resolve from tenant's hostel if available
    if (!tenantId) {
      throw new Error("HOSTEL_CONTEXT_REQUIRED: tenantId is required to resolve advance preferences");
    }
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { hostel_id: true },
    });
    const { prefs } = await getTenantOperationalContext(tenantId, ownerId, tenant?.hostel_id);
    if (!prefs.advance_enabled) {
      throw new Error("BAD_REQUEST: Advance/deposit feature is not enabled for this hostel. Enable it in Settings → Preferences.");
    }
  }

  /**
   * Compute the current balance from all ledger entries.
   * CREDIT increases balance, DEBIT decreases it.
   * Always recompute — never trust a single balance_after snapshot.
   */
  private async _computeBalance(tx: Prisma.TransactionClient, tenantId: string): Promise<number> {
    const [credits, debits] = await Promise.all([
      tx.tenant_advance_ledger.aggregate({
        where: { tenant_id: tenantId, type: "CREDIT" },
        _sum: { amount: true },
      }),
      tx.tenant_advance_ledger.aggregate({
        where: { tenant_id: tenantId, type: "DEBIT" },
        _sum: { amount: true },
      }),
    ]);
    const creditSum = Number(credits._sum.amount ?? 0);
    const debitSum = Number(debits._sum.amount ?? 0);
    return Math.round((creditSum - debitSum) * 100) / 100;
  }
}

export const tenantAdvanceService = new TenantAdvanceService();
