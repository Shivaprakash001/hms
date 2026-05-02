import { prisma } from "../db";
import { formatShortMonth } from "../format";

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

    const [tenants, rooms, payments, costs] = await Promise.all([
      prisma.tenant.findMany({ where: { owner_id: userId }, select: { status: true } }),
      prisma.room.findMany({ where: { hostel: { owner_id: userId } }, select: { capacity: true } }),
      // ✅ FIXED: Use payment_date (actual payment date, source of truth)
      // ✅ FIXED: Use nextMonthStart (day 1 of next month, exclusive upper bound)
      // ✅ Uses aggregate instead of findMany+reduce for DB-level summation
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

    const totalTenants = tenants.length;
    const activeTenants = tenants.filter((s: any) => s.status === "ACTIVE").length;
    const totalCapacity = rooms.reduce((sum: number, r: any) => sum + r.capacity, 0);
    const currentRevenue = Number(payments._sum.amount_paid || 0);
    const monthlyExpenses = Number(costs?._sum?.amount || 0);
    const occupancyRate = totalCapacity > 0 ? Math.round((activeTenants / totalCapacity) * 100) : 0;

    // Pending dues calculation
    // Only consider obligations that are actually unpaid (PENDING or PARTIAL).
    // Overdue = due_date is strictly before today (comparing DATE values).
    const unpaidObligations = await prisma.rentObligation.findMany({
      where: { 
        owner_id: userId, 
        status: { in: ["PENDING", "PARTIAL"] }
      },
      include: { payments: { select: { amount_paid: true } } }
    });

    let pendingTotal = 0;
    let overdueTotal = 0;
    let overdueCount = 0;

    // Use a UTC-normalized "today" for overdue comparison.
    // due_date is @db.Date — Prisma returns it as midnight UTC of that date.
    // We compare against start-of-today UTC so the comparison is DATE-to-DATE clean.
    const todayUTC = new Date(Date.UTC(utcYear, utcMonth, now.getUTCDate(), 0, 0, 0, 0));

    unpaidObligations.forEach((ob: any) => {
      const paid = ob.payments.reduce((sum: number, p: any) => sum + Number(p.amount_paid), 0);
      const remaining = Number(ob.amount) - paid;
      if (remaining > 0) {
        pendingTotal += remaining;
        // Overdue if due_date is strictly BEFORE today (not including today itself)
        if (ob.due_date < todayUTC) {
          overdueTotal += remaining;
          overdueCount++;
        }
      }
    });

    return {
      total_rooms: rooms.length,
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
      overdue_count: overdueCount
    };
  }

  async getMonthlyStats(userId: string, months: number = 6) {
    const stats = [];
    for (let i = 0; i < months; i++) {
        // FIX: Use UTC boundaries to prevent timezone leakage across historical months.
        const now = new Date();
        const targetMonth = now.getUTCMonth() - i;
        const targetYear = now.getUTCFullYear() + Math.floor(targetMonth / 12);
        const normalizedMonth = ((targetMonth % 12) + 12) % 12;
        const start = new Date(Date.UTC(targetYear, normalizedMonth, 1, 0, 0, 0, 0));
        const end = new Date(Date.UTC(targetYear, normalizedMonth + 1, 1, 0, 0, 0, 0));

        const [collected, due] = await Promise.all([
            prisma.payment.aggregate({
                where: { owner_id: userId, payment_date: { gte: start, lt: end } },
                _sum: { amount_paid: true }
            }),
            prisma.rentObligation.aggregate({
                where: { owner_id: userId, rent_month: { gte: start, lt: end }, status: { not: "WAIVED" } },
                _sum: { amount: true }
            })
        ]);

        const collectedAmount = Number(collected._sum.amount_paid || 0);
        const dueAmount = Number(due._sum.amount || 0);

        stats.push({
            month: formatShortMonth(start),
            year: start.getFullYear(),
            collected: collectedAmount,
            due: dueAmount,
            collection_rate: dueAmount > 0 ? Math.round((collectedAmount / dueAmount) * 100) : 0
        });
    }
    return stats.reverse();
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

    let pendingTotal = 0;
    let nextPayment: Date | null = null;
    let oldestObligationId: string | null = null;

    tenant.obligations.forEach((ob: any) => {
      const paid = ob.payments.reduce((sum: number, p: any) => sum + Number(p.amount_paid), 0);
      const remaining = Number(ob.amount) - paid;
      if (remaining > 0) {
        pendingTotal += remaining;
        if (!nextPayment) {
          nextPayment = ob.due_date;
          oldestObligationId = ob.id;
        }
      }
    });

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
