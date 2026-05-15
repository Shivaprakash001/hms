import { prisma } from "../db";
import { Prisma } from "@prisma/client";

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
  async reconcileSettledOperationalObligations(ownerId: string, hostelId: string): Promise<number> {
    const rows = await prisma.$queryRaw<{ one: number }[]>`
      WITH pay_agg AS (
        SELECT obligation_id, SUM(amount_paid)::float AS total_paid
        FROM payments
        GROUP BY obligation_id
      ),
      to_fix AS (
        SELECT o.id
        FROM rent_obligations o
        LEFT JOIN pay_agg p ON p.obligation_id = o.id
        WHERE o.owner_id = ${ownerId}::uuid
          AND o.hostel_id = ${hostelId}::uuid
          AND o.status IN ('PENDING', 'PARTIAL')
          AND o.amount - COALESCE(p.total_paid, 0) <= 0
      )
      UPDATE rent_obligations o
      SET status = 'PAID', updated_at = NOW()
      FROM to_fix f
      WHERE o.id = f.id
      RETURNING 1 AS one
    `;
    return rows.length;
  }

  /**
   * Operational cashflow metrics for a date range.
   *
   * Scope:
   * - ACTIVE tenants only
   * - obligations whose rent_month is within [start, end]
   * - excludes WAIVED obligations
   * - remaining balance is canonical: amount - paid
   */
  async getOperationalCashflowMetrics(
    ownerId: string,
    start: Date,
    end: Date,
    hostelId: string,
  ): Promise<{
    expected_total: number;
    collected_total: number;
    pending_total: number;
    overdue_total: number;
    unpaid_tenant_count: number;
    overdue_tenant_count: number;
    collection_rate: number;
  }> {
    await this.reconcileSettledOperationalObligations(ownerId, hostelId);

    const now = new Date();
    const todayUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ));

    const hostelFilter = Prisma.sql`AND o.hostel_id = ${hostelId}::uuid`;

    const [row] = await prisma.$queryRaw<{
      expected_total: number;
      collected_total: number;
      pending_total: number;
      overdue_total: number;
      unpaid_tenant_count: number;
      overdue_tenant_count: number;
    }[]>`
      WITH base AS (
        SELECT
          o.id,
          o.tenant_id,
          o.amount::float                              AS amount,
          o.due_date,
          GREATEST(
            o.amount - COALESCE(pay_agg.total_paid, 0),
            0
          )::float                                     AS remaining
        FROM rent_obligations o
        JOIN tenants t ON t.id = o.tenant_id
        LEFT JOIN (
          SELECT obligation_id, SUM(amount_paid)::float AS total_paid
          FROM payments
          GROUP BY obligation_id
        ) pay_agg ON pay_agg.obligation_id = o.id
        WHERE o.owner_id = ${ownerId}::uuid
          AND t.status = 'ACTIVE'
          AND o.status <> 'WAIVED'
          AND o.rent_month >= ${start}::date
          AND o.rent_month <= ${end}::date
          ${hostelFilter}
      )
      SELECT
        COALESCE(SUM(b.amount), 0)::float                                       AS expected_total,
        COALESCE(SUM(b.amount - b.remaining), 0)::float                         AS collected_total,
        COALESCE(SUM(b.remaining), 0)::float                                    AS pending_total,
        COALESCE(SUM(
          CASE WHEN b.due_date < ${todayUTC}::date
            THEN b.remaining
            ELSE 0
          END
        ), 0)::float                                                            AS overdue_total,
        COUNT(DISTINCT CASE WHEN b.remaining > 0 THEN b.tenant_id END)::int     AS unpaid_tenant_count,
        COUNT(DISTINCT CASE
          WHEN b.remaining > 0 AND b.due_date < ${todayUTC}::date
          THEN b.tenant_id
        END)::int                                                               AS overdue_tenant_count
      FROM base b
    `;

    const expected = Number(row?.expected_total || 0);
    const collected = Number(row?.collected_total || 0);
    const pending = Number(row?.pending_total || 0);
    const rate = expected > 0
      ? Math.round(((collected / expected) * 100) * 100) / 100
      : 0;

    return {
      expected_total: expected,
      collected_total: collected,
      pending_total: pending,
      overdue_total: Number(row?.overdue_total || 0),
      unpaid_tenant_count: Number(row?.unpaid_tenant_count || 0),
      overdue_tenant_count: Number(row?.overdue_tenant_count || 0),
      collection_rate: rate,
    };
  }

  /**
   * Operational outstanding per tenant for a specific owner.
   * ACTIVE tenants only, remaining-balance basis.
   */
  async getOperationalOutstandingByTenants(
    ownerId: string,
    hostelId: string,
    tenantIds: string[],
  ): Promise<Map<string, number>> {
    const ids = Array.from(new Set(tenantIds.filter(Boolean)));
    if (ids.length === 0) return new Map();

    await this.reconcileSettledOperationalObligations(ownerId, hostelId);

    const rows = await prisma.$queryRaw<Array<{ tenant_id: string; outstanding: number }>>`
      SELECT
        o.tenant_id,
        COALESCE(SUM(
          GREATEST(o.amount - COALESCE(pay_agg.total_paid, 0), 0)
        ), 0)::float AS outstanding
      FROM rent_obligations o
      JOIN tenants t ON t.id = o.tenant_id
      LEFT JOIN (
        SELECT obligation_id, SUM(amount_paid)::float AS total_paid
        FROM payments
        GROUP BY obligation_id
      ) pay_agg ON pay_agg.obligation_id = o.id
      WHERE o.owner_id = ${ownerId}::uuid
        AND o.tenant_id = ANY(${ids}::uuid[])
        AND o.hostel_id = ${hostelId}::uuid
        AND t.status = 'ACTIVE'
        AND o.status IN ('PENDING', 'PARTIAL')
      GROUP BY o.tenant_id
    `;

    return new Map(rows.map((r) => [r.tenant_id, Number(r.outstanding || 0)]));
  }

  /**
   * Operational dues for the dashboard:
   * - PENDING/PARTIAL obligations
   * - belonging to ACTIVE tenants only
   * - split into: pending (due_date >= today), overdue (due_date < today)
   */
  async getOperationalDues(ownerId: string, hostelId: string): Promise<{
    pending_total: number;
    overdue_total: number;
    overdue_count: number;
    unpaid_tenant_count: number;
    overdue_tenant_count: number;
  }> {
    await this.reconcileSettledOperationalObligations(ownerId, hostelId);

    const now = new Date();
    const todayUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ));

    const hostelFilter = Prisma.sql`AND o.hostel_id = ${hostelId}::uuid`;

    const [row] = await prisma.$queryRaw<
      {
        pending_total: number;
        overdue_total: number;
        overdue_count: number;
        unpaid_tenant_count: number;
        overdue_tenant_count: number;
      }[]
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
        )::int                                                                        AS overdue_count,
        COUNT(DISTINCT t.id)::int                                                     AS unpaid_tenant_count,
        COUNT(DISTINCT CASE
          WHEN o.due_date < ${todayUTC}::date THEN t.id
        END)::int                                                                     AS overdue_tenant_count
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
        ${hostelFilter}
    `;

    return {
      pending_total: row?.pending_total ?? 0,
      overdue_total: row?.overdue_total ?? 0,
      overdue_count: row?.overdue_count ?? 0,
      unpaid_tenant_count: row?.unpaid_tenant_count ?? 0,
      overdue_tenant_count: row?.overdue_tenant_count ?? 0,
    };
  }

  /**
   * Operational defaulters (ACTIVE tenants only), ranked by overdue outstanding.
   * Uses remaining amount (amount - paid), never raw amount.
   */
  async getOperationalDefaulters(
    ownerId: string,
    limit: number = 5,
    hostelId: string,
  ): Promise<Array<{
    tenant_id: string;
    name: string;
    pending_amount: number;
    days_overdue: number;
  }>> {
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit || 5)));
    const hostelFilter = Prisma.sql`AND o.hostel_id = ${hostelId}::uuid`;
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
          ${hostelFilter}
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
   *
   * @param asOfDate  - Reference date for overdue calculation (default: now)
   * @param ownerId   - Optional: scope to a single owner. Omit for cron (all owners).
   */
  async getOperationalOverdueObligations(
    asOfDate: Date = new Date(),
    ownerId: string,
    hostelId: string,
  ): Promise<Array<{
    obligation_id: string;
    tenant_id: string;
    owner_id: string;
    hostel_id: string | null;
    allocation_id: string | null;
    rent_month: Date;
    due_date: Date;
    amount: number;
    remaining_amount: number;
    tenant_name: string | null;
    personal_email: string | null;
    phone: string | null;
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
      hostel_id: string | null;
      allocation_id: string | null;
      rent_month: Date;
      due_date: Date;
      amount: number;
      remaining_amount: number;
      tenant_name: string | null;
      personal_email: string | null;
      phone: string | null;
    }>>`
      SELECT
        o.id                                                AS obligation_id,
        o.tenant_id,
        o.owner_id,
        r.hostel_id                                         AS hostel_id,
        o.allocation_id,
        o.rent_month,
        o.due_date,
        o.amount::float                                     AS amount,
        (o.amount - COALESCE(pay_agg.total_paid, 0))::float AS remaining_amount,
        p.name                                              AS tenant_name,
        t.personal_email,
        p.phone                                             AS phone
      FROM rent_obligations o
      JOIN tenants t ON t.id = o.tenant_id
      JOIN profiles p ON p.id = t.profile_id
      LEFT JOIN room_allocations ra ON ra.id = o.allocation_id
      LEFT JOIN rooms r ON r.id = ra.room_id
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
        AND o.owner_id = ${ownerId}::uuid
        AND o.hostel_id = ${hostelId}::uuid
    `;

    return rows.map((r) => ({
      obligation_id:    r.obligation_id,
      tenant_id:        r.tenant_id,
      owner_id:         r.owner_id,
      hostel_id:        r.hostel_id ?? null,
      allocation_id:    r.allocation_id,
      rent_month:       r.rent_month,
      due_date:         r.due_date,
      amount:           Number(r.amount || 0),
      remaining_amount: Number(r.remaining_amount || 0),
      tenant_name:      r.tenant_name,
      personal_email:   r.personal_email,
      phone:            r.phone,
    }));
  }


  /**
   * Historical outstanding — all tenants, no lifecycle filter.
   * Used for accounting reports and overdue defaulter lists.
   */
  async getHistoricalOutstanding(ownerId: string, hostelId: string): Promise<{
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
        AND o.hostel_id = ${hostelId}::uuid
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
  async getTenantDues(tenantId: string, ownerId: string | undefined, hostelId: string): Promise<{
    tenant_id: string;
    items: TenantDueItem[];
    total_due: number;
    rent_due: number;
    late_fees_due: number;
    obligation_count: number;
  }> {
    const obligations = await prisma.rent_obligations.findMany({
      where: {
        tenant_id: tenantId,
        ...(ownerId ? { owner_id: ownerId } : {}),
        hostel_id: hostelId,
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
