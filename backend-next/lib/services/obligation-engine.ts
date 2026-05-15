import { getLogger } from "../logger";

const logger = getLogger("obligation-engine");

/**
 * 🏦 Obligation Engine
 *
 * Creates financial obligations tied to tenant lifecycle events.
 * All operations are IDEMPOTENT — safe to call multiple times
 * via the DB unique constraint (allocation_id, rent_month, obligation_type).
 *
 * Rule: Obligations are the SINGLE SOURCE OF TRUTH for money owed.
 * Frontend never calculates totals — it reads obligations.
 */
export class ObligationEngine {
  /**
   * Create initial obligations when a tenant is invited.
   * Called INSIDE the invite transaction so everything is atomic.
   *
   * Creates:
   *   ADVANCE     → due on joining_date (if advance_deposit > 0)
   *   MAINTENANCE → due on joining_date (only if maintenance_type === "ONE_TIME" and charge > 0)
   *
   * Monthly maintenance is handled by the rent generation cron, not here.
   */
  async createInitialObligations(
    tx: any, // Prisma transaction client
    params: {
      tenantId: string;
      allocationId: string;
      ownerId: string;
      hostelId: string;
      joiningDate: Date;
      billingStartDate?: Date;
      monthlyRent?: number;
      createRent?: boolean;
      advanceDeposit: number;
      maintenanceCharge: number;
      maintenanceType: string; // "MONTHLY" | "ONE_TIME"
    }
  ) {
    const {
      tenantId,
      allocationId,
      ownerId,
      hostelId,
      joiningDate,
      billingStartDate,
      monthlyRent,
      createRent,
      advanceDeposit,
      maintenanceCharge,
      maintenanceType,
    } = params;

    const created: string[] = [];

    // rent_month anchor = 1st of joining month (deterministic UTC key)
    const rentMonth = new Date(
      Date.UTC(joiningDate.getFullYear(), joiningDate.getMonth(), 1)
    );

    // ── RENT obligation ─────────────────────────────────────────
    // Active bulk-imported tenants should owe rent immediately from the
    // configured billing start date. Invited tenants keep rent generation on
    // the normal monthly job unless callers explicitly opt in.
    if (createRent && monthlyRent && monthlyRent > 0) {
      const wasCreated = await this.upsertObligation(tx, {
        tenantId,
        allocationId,
        ownerId,
        hostelId,
        rentMonth,
        amount: monthlyRent,
        dueDate: billingStartDate || joiningDate,
        obligationType: "RENT",
      });
      if (wasCreated) created.push("RENT");
    }

    // ── ADVANCE obligation ──────────────────────────────────────
    if (advanceDeposit > 0) {
      const wasCreated = await this.upsertObligation(tx, {
        tenantId,
        allocationId,
        ownerId,
        hostelId,
        rentMonth,
        amount: advanceDeposit,
        dueDate: joiningDate,
        obligationType: "ADVANCE",
      });
      if (wasCreated) created.push("ADVANCE");
    }

    // ── ONE-TIME MAINTENANCE obligation ─────────────────────────
    if (maintenanceCharge > 0 && maintenanceType === "ONE_TIME") {
      const wasCreated = await this.upsertObligation(tx, {
        tenantId,
        allocationId,
        ownerId,
        hostelId,
        rentMonth,
        amount: maintenanceCharge,
        dueDate: joiningDate,
        obligationType: "MAINTENANCE",
      });
      if (wasCreated) created.push("MAINTENANCE");
    }

    logger.info(
      `Initial obligations for tenant ${tenantId}: [${created.join(", ") || "none"}]`
    );
    return created;
  }

  /**
   * Idempotent obligation create.
   * Uses findFirst guard + P2002 fallback for race safety.
   */
  private async upsertObligation(
    tx: any,
    params: {
      tenantId: string;
      allocationId: string;
      ownerId: string;
      hostelId: string;
      rentMonth: Date;
      amount: number;
      dueDate: Date;
      obligationType: string;
    }
  ): Promise<boolean> {
    const {
      tenantId,
      allocationId,
      ownerId,
      hostelId,
      rentMonth,
      amount,
      dueDate,
      obligationType,
    } = params;

    try {
      const existing = await tx.rent_obligations.findFirst({
        where: {
          allocation_id: allocationId,
          rent_month: rentMonth,
          obligation_type: obligationType,
        },
      });
      if (existing) {
        logger.info(
          `${obligationType} obligation already exists for allocation ${allocationId}`
        );
        return false;
      }

      await tx.rent_obligations.create({
        data: {
          tenant_id: tenantId,
          allocation_id: allocationId,
          owner_id: ownerId,
          hostel_id: hostelId,
          rent_month: rentMonth,
          amount,
          total_amount: amount,
          due_date: dueDate,
          status: "PENDING",
          obligation_type: obligationType,
        },
      });
      return true;
    } catch (err: any) {
      if (err?.code === "P2002") {
        // Concurrent insert — idempotent skip
        logger.info(
          `${obligationType} obligation race-skip for allocation ${allocationId}`
        );
        return false;
      }
      throw err;
    }
  }
}

export const obligationEngine = new ObligationEngine();
