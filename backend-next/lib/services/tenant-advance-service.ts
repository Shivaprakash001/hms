import { prisma } from "../db";
import { getLogger } from "../logger";

const logger = getLogger("tenant.advance");

export class TenantAdvanceService {
  /**
   * Get the current advance balance and full ledger history for a tenant.
   * Balance = SUM(CREDIT) - SUM(DEBIT).
   * We recompute from ledger entries (authoritative), not from balance_after
   * snapshots (which are for audit display only).
   */
  async getBalance(tenantId: string, ownerId: string) {
    await this._assertOwnership(tenantId, ownerId);

    const entries = await prisma.tenantAdvanceLedger.findMany({
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

    return prisma.$transaction(async (tx) => {
      // Lock tenant row — serializes all advance mutations for this tenant
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;

      const currentBalance = await this._computeBalance(tx, tenantId);
      const newBalance = Math.round((currentBalance + amount) * 100) / 100;

      const entry = await tx.tenantAdvanceLedger.create({
        data: {
          tenant_id: tenantId,
          owner_id: ownerId,
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

      logger.info("advance.credit", {
        tenant_id: tenantId,
        reason,
        amount,
        new_balance: newBalance,
        entry_id: entry.id,
      });

      return { entry, balance: newBalance };
    });
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
  }) {
    const { tenantId, ownerId, createdBy, reason, amount, notes, referenceId, referenceType } = params;

    if (amount <= 0) throw new Error("BAD_REQUEST: Amount must be positive");
    await this._assertOwnership(tenantId, ownerId);

    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;

      const currentBalance = await this._computeBalance(tx, tenantId);

      if (reason !== "CORRECTION" && currentBalance < amount) {
        throw new Error(
          `BAD_REQUEST: Insufficient advance balance. Available: ₹${currentBalance.toFixed(2)}, Requested: ₹${amount.toFixed(2)}`
        );
      }

      const newBalance = Math.max(0, Math.round((currentBalance - amount) * 100) / 100);

      const entry = await tx.tenantAdvanceLedger.create({
        data: {
          tenant_id: tenantId,
          owner_id: ownerId,
          type: "DEBIT",
          reason,
          amount,
          balance_after: newBalance,
          notes: notes || null,
          reference_id: referenceId || null,
          reference_type: referenceType || null,
          created_by: createdBy,
        },
      });

      logger.info("advance.debit", {
        tenant_id: tenantId,
        reason,
        amount,
        new_balance: newBalance,
        entry_id: entry.id,
      });

      return { entry, balance: newBalance };
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

    return prisma.$transaction(async (tx) => {
      // Lock tenant row first (always first to avoid deadlock ordering)
      await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;
      // Lock obligation row
      await tx.$queryRaw`SELECT id FROM rent_obligations WHERE id = ${obligationId}::uuid FOR UPDATE`;

      const obligation = await tx.rentObligation.findUnique({
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
      const payment = await tx.payment.create({
        data: {
          obligation_id: obligationId,
          tenant_id: tenantId,
          owner_id: ownerId,
          amount_paid: adjustPaisa / 100,
          payment_method: "ADVANCE_ADJUSTMENT",
          reference_number: `ADV-${Date.now()}`,
          payment_date: new Date(),
        },
      });

      // Update obligation status
      const newPaidPaisa = paidPaisa + adjustPaisa;
      const newStatus = newPaidPaisa >= obligationPaisa ? "PAID" : "PARTIAL";
      await tx.rentObligation.update({
        where: { id: obligationId },
        data: { status: newStatus },
      });

      // Ledger DEBIT
      const newBalance = Math.round((currentBalance - amount) * 100) / 100;
      const entry = await tx.tenantAdvanceLedger.create({
        data: {
          tenant_id: tenantId,
          owner_id: ownerId,
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
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async _assertOwnership(tenantId: string, ownerId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { owner_id: true },
    });
    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");
    if (tenant.owner_id !== ownerId) throw new Error("FORBIDDEN: Tenant does not belong to this owner");
  }

  /**
   * Compute live balance from ledger entries inside a transaction.
   * Always recompute — never trust a single balance_after snapshot.
   */
  private async _computeBalance(tx: any, tenantId: string): Promise<number> {
    const result = await tx.$queryRaw<{ balance: string }[]>`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE -amount END), 0)::TEXT AS balance
      FROM tenant_advance_ledger
      WHERE tenant_id = ${tenantId}::uuid
    `;
    return parseFloat(result[0]?.balance ?? "0");
  }
}

export const tenantAdvanceService = new TenantAdvanceService();
