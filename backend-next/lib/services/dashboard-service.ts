import { prisma } from "../db";
import { formatShortMonth } from "../format";
import { financialService } from "./financial-service";
import { operationalPendingInvariantHolds } from "./financial-invariants";

/**
 * 📊 Dashboard Service — Financial Metrics (Source of Truth)
 *
 * CRITICAL DATA INTEGRITY NOTES:
 *
 * 1. "Total Collected (This Month)" MUST use `payments.payment_date` (NOT created_at).
 *    `payment_date` is the actual date money was received.
 *
 * 2. `payment_date` is a PostgreSQL DATE column (@db.Date in Prisma).
 *    DATE has NO time component — it stores YYYY-MM-DD only.
 *    When filtering DATE columns, use plain date boundaries (day 1 to next month day 1).
 *
 * 3. Month boundaries MUST be:
 *    - startOfMonth: day 1 (INCLUSIVE via gte)
 *    - nextMonthStart: day 1 of next month (EXCLUSIVE via lt)
 *    ⚠️  NEVER use (month + 1, 0) — that gives the LAST day of current month, not first of next!
 *
 * 4. When recording payments, `payment_date` must be set to the correct calendar date
 *    in the owner's timezone (see payment-service.ts). This service only reads the stored DATE.
 */

export class DashboardService {
  async getOwnerStats(userId: string) {
    // Use UTC month boundaries for DATE column filtering.
    //
    // payments.payment_date is @db.Date (PostgreSQL DATE, no time component).
    // Prisma sends Date objects to PostgreSQL which casts them to DATE (YYYY-MM-DD).
    // We use UTC-constructed dates so the YYYY-MM-DD extracted is predictable.
    //
    // Example for May 2026:
    //   monthStart = 2026-05-01T00:00:00Z → PostgreSQL DATE = '2026-05-01'
    //   nextMonthStart = 2026-06-01T00:00:00Z → PostgreSQL DATE = '2026-06-01'
    //   Filter: payment_date >= '2026-05-01' AND payment_date < '2026-06-01'
    //   This correctly includes May 1–31 and excludes June onward.
    const now = new Date();
    const utcYear = now.getUTCFullYear();
    const utcMonth = now.getUTCMonth();
    const today = new Date();

    // ✅ FIXED: Use (utcMonth + 1, 1) for first day of next month.
    // ❌ BUG WAS: (utcMonth + 1, 0) = last day of CURRENT month, excluding final day's payments.
    const monthStart = new Date(Date.UTC(utcYear, utcMonth, 1, 0, 0, 0, 0));
    const nextMonthStart = new Date(Date.UTC(utcYear, utcMonth + 1, 1, 0, 0, 0, 0));

    // ✅ Use count()+aggregate instead of findMany — avoids fetching full rows for JS-side counting
    const [totalTenants, activeTenants, roomStats, payments, costs] = await Promise.all([
      prisma.tenant.count({ where: { owner_id: userId } }),
      prisma.tenant.count({ where: { owner_id: userId, status: "ACTIVE" } }),
      prisma.$queryRaw<{ total_rooms: number; total_capacity: number }[]>`
        SELECT COUNT(r.id)::int AS total_rooms, COALESCE(SUM(r.capacity), 0)::int AS total_capacity
        FROM rooms r JOIN hostels h ON h.id = r.hostel_id
        WHERE h.owner_id = ${userId}::uuid AND r.is_active = true
      `,
      // ✅ FIXED: Use payment_date (actual payment date, source of truth)
      // ✅ FIXED: Use nextMonthStart (day 1 of next month, exclusive upper bound)
      prisma.payment.aggregate({
        where: {
          owner_id: userId,
          payment_date: { gte: monthStart, lt: nextMonthStart },
        },
        _sum: { amount_paid: true },
      }),
      prisma.expense.aggregate({
        where: {
          owner_id: userId,
          date: { gte: monthStart, lt: nextMonthStart },
        },
        _sum: { amount: true },
      }),
    ]);

    const totalCapacity = Number(roomStats[0]?.total_capacity ?? 0);
    const currentRevenue = Number(payments._sum.amount_paid || 0);
    const monthlyExpenses = Number(costs?._sum?.amount || 0);
    const occupancyRate = totalCapacity > 0 ? Math.round((activeTenants / totalCapacity) * 100) : 0;

    // Pending dues calculation — single DB aggregate instead of findMany+include+JS loop.
    // Logic is identical: remaining = amount - SUM(payments); overdue = due_date < today.
    // due_date is @db.Date — compare against UTC midnight of today for DATE-to-DATE clean match.
    // Operational dues — ACTIVE tenants only (canonical via financialService)
    const dues = await financialService.getOperationalDues(userId);
    const pendingTotal = dues.pending_total;
    const overdueTotal = dues.overdue_total;
    const overdueCount = dues.overdue_tenant_count;
    const unpaidTenantCount = operationalPendingInvariantHolds(pendingTotal, dues.unpaid_tenant_count)
      ? dues.unpaid_tenant_count
      : 0;

    return {
      total_rooms: Number(roomStats[0]?.total_rooms ?? 0),
      total_tenants: totalTenants,
      active_tenants: activeTenants,
      total_capacity: totalCapacity,
      vacant_beds: Math.max(totalCapacity - activeTenants, 0),
      occupancy_rate: occupancyRate,
      revenue: currentRevenue,
      expenses_this_month: monthlyExpenses,
      rent_collected_this_month: currentRevenue,
      pending_dues: pendingTotal,
      overdue_amount: overdueTotal,
      overdue_count: overdueCount,
      unpaid_tenant_count: unpaidTenantCount,
    };
  }

  async getMonthlyStats(userId: string, months: number = 6) {
    const now = new Date();

    // Build all date ranges first so we can fire every query in one parallel batch
    // instead of awaiting each iteration serially (was: months × 2 = 12 sequential round trips).
    const ranges = Array.from({ length: months }, (_, i) => {
      const targetMonth     = now.getUTCMonth() - i;
      const targetYear      = now.getUTCFullYear() + Math.floor(targetMonth / 12);
      const normalizedMonth = ((targetMonth % 12) + 12) % 12;
      const start = new Date(Date.UTC(targetYear, normalizedMonth, 1, 0, 0, 0, 0));
      const end   = new Date(Date.UTC(targetYear, normalizedMonth + 1, 1, 0, 0, 0, 0));
      return { start, end };
    });

    // All 12 queries fire simultaneously — one DB round-trip instead of 6.
    const results = await Promise.all(
      ranges.map(({ start, end }) =>
        Promise.all([
          prisma.payment.aggregate({
            where: { owner_id: userId, payment_date: { gte: start, lt: end } },
            _sum: { amount_paid: true },
          }),
          prisma.rentObligation.aggregate({
            where: { owner_id: userId, rent_month: { gte: start, lt: end }, status: { not: "WAIVED" } },
            _sum: { amount: true },
          }),
        ])
      )
    );

    return results
      .map(([collected, due], i) => {
        const { start }        = ranges[i];
        const collectedAmount  = Number(collected._sum.amount_paid || 0);
        const dueAmount        = Number(due._sum.amount || 0);
        return {
          month: formatShortMonth(start),
          year:  start.getFullYear(),
          collected: collectedAmount,
          due:       dueAmount,
          collection_rate: dueAmount > 0 ? Math.round((collectedAmount / dueAmount) * 100) : 0,
        };
      })
      .reverse();
  }

  async getTenantStats(profileId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { profile_id: profileId },
      include: {
        allocations: { where: { is_active: true, end_date: null }, include: { room: true } },
        obligations: { 
          where: { status: { in: ["PENDING", "PARTIAL"] } }, 
          orderBy: { due_date: "asc" },
          include: { payments: { select: { amount_paid: true } } }
        }
      }
    });

    if (!tenant) throw new Error("NOT_FOUND: Tenant record not found");

    const dues = await financialService.getTenantDues(tenant.id);
    const pendingTotal = dues.total_due;
    const nextItem = dues.items[0];
    const nextPayment: Date | null = nextItem?.due_date ?? null;
    const oldestObligationId: string | null = nextItem?.obligation_id ?? null;

    return {
      tenant_id: tenant.id,
      room_no: tenant.allocations[0]?.room.room_no || "Not Assigned",
      monthly_rent: Number(tenant.monthly_rent),
      pending_dues: pendingTotal,
      next_payment_date: nextPayment,
      oldest_obligation_id: oldestObligationId,
      status: tenant.status
    };
  }
}

export const dashboardService = new DashboardService();
