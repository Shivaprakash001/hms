import { prisma } from "../db";

/**
 * FinancialService — Canonical dues calculation layer
 *
 * DEFINITIONS:
 *
 *   OPERATIONAL DUES
 *     Obligations on ACTIVE tenants only.
 *     These are amounts the owner can realistically collect.
 *     Used by: dashboard summary cards, reminders, analytics collection rate.
 *     Excludes: LEFT, INVITED, EXPIRED, CANCELLED tenants.
 *
 *   HISTORICAL OUTSTANDING
 *     All PENDING/PARTIAL obligations regardless of tenant lifecycle status.
 *     Used by: accounting export, audit, overdue defaulter lists.
 *     Includes: every tenant who ever owed money and hasn't paid/waived it.
 *
 * FIELD CONSISTENCY:
 *   All calculations use `o.amount` (base rent obligation amount, without late fees).
 *   Late fees are separate LATE_FEE-type obligations summed independently.
 *   `total_amount` on the obligation row is `amount + late_fee` — we never read it
 *   for summation to avoid double-counting (late fees arrive as their own obligations).
 *
 * NO LOGIC DUPLICATION:
 *   Dashboard, analytics, tenant table, and reminders MUST call this service.
 *   Never write a raw obligation aggregate outside this file.
 */
export class FinancialService {

  /**
   * Operational dues for the dashboard:
   * - PENDING/PARTIAL obligations
   * - belonging to ACTIVE tenants only
   * - split into: pending (due_date >= today), overdue (due_date < today)
   */
  async getOperationalDues(ownerId: string): Promise<{
    pending_total: number;
    overdue_total: number;
    overdue_count: number;
  }> {
    const now = new Date();
    const todayUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ));

    const [row] = await prisma.$queryRaw<
      { pending_total: number; overdue_total: number; overdue_count: number }[]
    >`
      SELECT
        COALESCE(SUM(
          o.amount - COALESCE(pay_agg.total_paid, 0)
        ), 0)::float                                                                  AS pending_total,
        COALESCE(SUM(
          CASE WHEN o.due_date < ${todayUTC}::date
            THEN o.amount - COALESCE(pay_agg.total_paid, 0)
            ELSE 0
          END
        ), 0)::float                                                                  AS overdue_total,
        COUNT(
          CASE WHEN o.due_date < ${todayUTC}::date
            AND o.amount - COALESCE(pay_agg.total_paid, 0) > 0
          THEN 1 END
        )::int                                                                        AS overdue_count
      FROM rent_obligations o
      JOIN tenants t ON t.id = o.tenant_id
      LEFT JOIN (
        SELECT obligation_id, SUM(amount_paid)::float AS total_paid
        FROM payments
        GROUP BY obligation_id
      ) pay_agg ON pay_agg.obligation_id = o.id
      WHERE o.owner_id    = ${ownerId}::uuid
        AND o.status      IN ('PENDING', 'PARTIAL')
        AND t.status      = 'ACTIVE'
        AND o.amount - COALESCE(pay_agg.total_paid, 0) > 0
    `;

    return {
      pending_total: row?.pending_total ?? 0,
      overdue_total: row?.overdue_total ?? 0,
      overdue_count: row?.overdue_count ?? 0,
    };
  }

  /**
   * Operational defaulters (ACTIVE tenants only), ranked by overdue outstanding.
   * Uses remaining amount (amount - paid), never raw amount.
   */
  async getOperationalDefaulters(
    ownerId: string,
    limit: number = 5,
  ): Promise<Array<{
    tenant_id: string;
    name: string;
    pending_amount: number;
    days_overdue: number;
  }>> {
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit || 5)));
    const rows = await prisma.$queryRaw<Array<{
      tenant_id: string;
      name: string;
      pending_amount: number;
      days_overdue: number;
    }>>`
      WITH overdue AS (
        SELECT
          o.tenant_id,
          p.name,
          SUM(o.amount - COALESCE(pay_agg.total_paid, 0))::float AS pending_amount,
          MIN(o.due_date)                                         AS earliest_due
        FROM rent_obligations o
        JOIN tenants t ON t.id = o.tenant_id
        JOIN profiles p ON p.id = t.profile_id
        LEFT JOIN (
          SELECT obligation_id, SUM(amount_paid)::float AS total_paid
          FROM payments
          GROUP BY obligation_id
        ) pay_agg ON pay_agg.obligation_id = o.id
        WHERE o.owner_id = ${ownerId}::uuid
          AND o.status IN ('PENDING', 'PARTIAL')
          AND t.status = 'ACTIVE'
          AND o.due_date < CURRENT_DATE
          AND o.amount - COALESCE(pay_agg.total_paid, 0) > 0
        GROUP BY o.tenant_id, p.name
      )
      SELECT
        tenant_id,
        name,
        pending_amount,
        GREATEST(0, (CURRENT_DATE - earliest_due::date))::int AS days_overdue
      FROM overdue
      ORDER BY pending_amount DESC
      LIMIT ${safeLimit}
    `;

    return rows.map((r) => ({
      tenant_id: r.tenant_id,
      name: r.name,
      pending_amount: Number(r.pending_amount || 0),
      days_overdue: Number(r.days_overdue || 0),
    }));
  }

  /**
   * Overdue operational obligations for reminder engine.
   * ACTIVE tenants only; excludes cancelled/expired/invited/left lifecycle states.
   */
  async getOperationalOverdueObligations(asOfDate: Date = new Date()): Promise<Array<{
    obligation_id: string;
    tenant_id: string;
    owner_id: string;
    allocation_id: string | null;
    rent_month: Date;
    due_date: Date;
    amount: number;
    remaining_amount: number;
    tenant_name: string | null;
    personal_email: string | null;
  }>> {
    const cutoff = new Date(Date.UTC(
      asOfDate.getUTCFullYear(),
      asOfDate.getUTCMonth(),
      asOfDate.getUTCDate(),
    ));

    const rows = await prisma.$queryRaw<Array<{
      obligation_id: string;
      tenant_id: string;
      owner_id: string;
      allocation_id: string | null;
      rent_month: Date;
      due_date: Date;
      amount: number;
      remaining_amount: number;
      tenant_name: string | null;
      personal_email: string | null;
    }>>`
      SELECT
        o.id                                                AS obligation_id,
        o.tenant_id,
        o.owner_id,
        o.allocation_id,
        o.rent_month,
        o.due_date,
        o.amount::float                                     AS amount,
        (o.amount - COALESCE(pay_agg.total_paid, 0))::float AS remaining_amount,
        p.name                                              AS tenant_name,
        t.personal_email
      FROM rent_obligations o
      JOIN tenants t ON t.id = o.tenant_id
      JOIN profiles p ON p.id = t.profile_id
      LEFT JOIN (
        SELECT obligation_id, SUM(amount_paid)::float AS total_paid
        FROM payments
        GROUP BY obligation_id
      ) pay_agg ON pay_agg.obligation_id = o.id
      WHERE o.status IN ('PENDING', 'PARTIAL')
        AND o.obligation_type = 'RENT'
        AND o.due_date < ${cutoff}::date
        AND t.status = 'ACTIVE'
        AND o.amount - COALESCE(pay_agg.total_paid, 0) > 0
    `;

    return rows.map((r) => ({
      obligation_id: r.obligation_id,
      tenant_id: r.tenant_id,
      owner_id: r.owner_id,
      allocation_id: r.allocation_id,
      rent_month: r.rent_month,
      due_date: r.due_date,
      amount: Number(r.amount || 0),
      remaining_amount: Number(r.remaining_amount || 0),
      tenant_name: r.tenant_name,
      personal_email: r.personal_email,
    }));
  }

  /**
   * Historical outstanding — all tenants, no lifecycle filter.
   * Used for accounting reports and overdue defaulter lists.
   */
  async getHistoricalOutstanding(ownerId: string): Promise<{
    outstanding_total: number;
    overdue_total: number;
    overdue_count: number;
  }> {
    const now = new Date();
    const todayUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ));

    const [row] = await prisma.$queryRaw<
      { outstanding_total: number; overdue_total: number; overdue_count: number }[]
    >`
      SELECT
        COALESCE(SUM(
          o.amount - COALESCE(pay_agg.total_paid, 0)
        ), 0)::float                                                                  AS outstanding_total,
        COALESCE(SUM(
          CASE WHEN o.due_date < ${todayUTC}::date
            THEN o.amount - COALESCE(pay_agg.total_paid, 0)
            ELSE 0
          END
        ), 0)::float                                                                  AS overdue_total,
        COUNT(
          CASE WHEN o.due_date < ${todayUTC}::date
            AND o.amount - COALESCE(pay_agg.total_paid, 0) > 0
          THEN 1 END
        )::int                                                                        AS overdue_count
      FROM rent_obligations o
      LEFT JOIN (
        SELECT obligation_id, SUM(amount_paid)::float AS total_paid
        FROM payments
        GROUP BY obligation_id
      ) pay_agg ON pay_agg.obligation_id = o.id
      WHERE o.owner_id = ${ownerId}::uuid
        AND o.status   IN ('PENDING', 'PARTIAL')
        AND o.amount - COALESCE(pay_agg.total_paid, 0) > 0
    `;

    return {
      outstanding_total: row?.outstanding_total ?? 0,
      overdue_total:     row?.overdue_total     ?? 0,
      overdue_count:     row?.overdue_count     ?? 0,
    };
  }

  /**
   * Single-tenant dues breakdown.
   * Used by: payment page, tenant detail view, tenant list row.
   * Returns itemised list of PENDING/PARTIAL obligations with remaining amounts.
   * Does NOT include PAID obligations — they are settled.
   */
  async getTenantDues(tenantId: string): Promise<{
    tenant_id: string;
    items: TenantDueItem[];
    total_due: number;
    rent_due: number;
    late_fees_due: number;
    obligation_count: number;
  }> {
    const obligations = await prisma.rentObligation.findMany({
      where: {
        tenant_id: tenantId,
        status: { in: ["PENDING", "PARTIAL"] },
      },
      include: {
        payments: { select: { amount_paid: true } },
        allocation: { include: { room: { select: { room_no: true } } } },
      },
      orderBy: [{ due_date: "asc" }],
    });

    const items: TenantDueItem[] = obligations.map((ob) => {
      const paid = ob.payments.reduce((s, p) => s + Number(p.amount_paid), 0);
      const outstanding = Math.max(Number(ob.amount) - paid, 0);
      return {
        obligation_id: ob.id,
        type: ob.obligation_type,
        rent_month: ob.rent_month,
        due_date: ob.due_date,
        amount: Number(ob.amount),
        paid,
        outstanding,
        status: ob.status,
        room_no: ob.allocation?.room?.room_no ?? null,
      };
    }).filter((i) => i.outstanding > 0);

    const totalDue     = items.reduce((s, i) => s + i.outstanding, 0);
    const rentDue      = items.filter((i) => i.type === "RENT").reduce((s, i) => s + i.outstanding, 0);
    const lateFeesDue  = items.filter((i) => i.type === "LATE_FEE").reduce((s, i) => s + i.outstanding, 0);

    return {
      tenant_id:        tenantId,
      items,
      total_due:        totalDue,
      rent_due:         rentDue,
      late_fees_due:    lateFeesDue,
      obligation_count: items.length,
    };
  }

  /**
   * Compact payment summary for a tenant — used in list/table rows.
   * Reads PENDING/PARTIAL obligations only (no PAID, no WAIVED).
   */
  getTenantPaymentSummary(_tenantId: string, obligationRows: ObligationRow[]): {
    total_billed: number;
    total_paid: number;
    pending_amount: number;
    last_paid_at: Date | null;
    last_payment_amount: number;
    payment_status: "PAID" | "PARTIAL" | "PENDING" | "NOT_GENERATED";
  } {
    let totalBilled = 0;
    let totalPaid   = 0;
    let lastPaidAt: Date | null = null;
    let lastPaymentAmount = 0;

    for (const ob of obligationRows) {
      if (ob.status === "WAIVED") continue;
      totalBilled += Number(ob.amount);
      for (const p of ob.payments) {
        const amt = Number(p.amount_paid);
        totalPaid += amt;
        const pd = new Date(p.payment_date);
        if (!lastPaidAt || pd > lastPaidAt) {
          lastPaidAt = pd;
          lastPaymentAmount = amt;
        }
      }
    }

    const pending = Math.max(0, totalBilled - totalPaid);
    let payment_status: "PAID" | "PARTIAL" | "PENDING" | "NOT_GENERATED" = "PENDING";
    if (totalBilled === 0)                         payment_status = "NOT_GENERATED";
    else if (pending <= 0)                         payment_status = "PAID";
    else if (totalPaid > 0)                        payment_status = "PARTIAL";

    return {
      total_billed:         totalBilled,
      total_paid:           totalPaid,
      pending_amount:       pending,
      last_paid_at:         lastPaidAt,
      last_payment_amount:  lastPaymentAmount,
      payment_status,
    };
  }
}

export interface TenantDueItem {
  obligation_id: string;
  type: string;
  rent_month: Date;
  due_date: Date;
  amount: number;
  paid: number;
  outstanding: number;
  status: string;
  room_no: string | null;
}

export interface ObligationRow {
  amount: number | string;
  status: string;
  payments: Array<{ amount_paid: number | string; payment_date: Date | string }>;
}

export const financialService = new FinancialService();
