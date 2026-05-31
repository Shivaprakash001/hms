import { prisma } from "../db";
import { Prisma } from "@prisma/client";
import { formatShortMonth } from "../format";
import { financialService } from "../../src/services/payments/financial-service";
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
  async getOwnerStats(userId: string, hostelId: string) {
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
    const previousMonthStart = new Date(Date.UTC(utcYear, utcMonth - 1, 1, 0, 0, 0, 0));
    const sixMonthStart = new Date(Date.UTC(utcYear, utcMonth - 5, 1, 0, 0, 0, 0));
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 7);

    const hostelRoomFilter = Prisma.sql`AND h.id = ${hostelId}::uuid`;
    const hostelPaymentFilter = { hostel_id: hostelId };

    // ✅ Use count()+aggregate instead of findMany — avoids fetching full rows for JS-side counting
    const [totalTenants, activeTenants, roomStats, payments, costs, occupiedRoomCount] = await Promise.all([
      prisma.tenants.count({ where: { owner_id: userId, hostel_id: hostelId } }),
      prisma.tenants.count({ where: { owner_id: userId, status: "ACTIVE", hostel_id: hostelId } }),
      prisma.$queryRaw<{ total_rooms: number; total_capacity: number }[]>`
        SELECT COUNT(r.id)::int AS total_rooms, COALESCE(SUM(r.capacity), 0)::int AS total_capacity
        FROM rooms r JOIN hostels h ON h.id = r.hostel_id
        WHERE h.owner_id = ${userId}::uuid AND r.is_active = true
        ${hostelRoomFilter}
      `,
      // ✅ FIXED: Use payment_date (actual payment date, source of truth)
      // ✅ FIXED: Use nextMonthStart (day 1 of next month, exclusive upper bound)
      prisma.payments.aggregate({
        where: {
          owner_id: userId,
          payment_date: { gte: monthStart, lt: nextMonthStart },
          ...hostelPaymentFilter,
        },
        _sum: { amount_paid: true },
      }),
      prisma.expenses.aggregate({
        where: {
          owner_id: userId,
          date: { gte: monthStart, lt: nextMonthStart },
          ...hostelPaymentFilter,
        },
        _sum: { amount: true },
      }),
      // Count rooms that have at least one active allocation (source-of-truth occupancy)
      prisma.rooms.count({
        where: {
          hostel_id: hostelId,
          is_active: true,
          room_allocations: { some: { is_active: true, end_date: null } },
        },
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
    const dues = await financialService.getOperationalDues(userId, hostelId);
    const pendingTotal = dues.pending_total;
    const overdueTotal = dues.overdue_total;
    const overdueCount = dues.overdue_tenant_count;
    const unpaidTenantCount = operationalPendingInvariantHolds(pendingTotal, dues.unpaid_tenant_count)
      ? dues.unpaid_tenant_count
      : 0;

    const [
      hostel,
      previousPayments,
      currentExpected,
      previousExpected,
      previousCosts,
      rooms,
      categoryExpenses,
      previousCategoryExpenses,
      obligationsRisk,
      oldestUnpaid,
      dueTodayAgg,
      dueWeekAgg,
      moveOutOpen,
      joinsThisMonth,
      exitsThisMonth,
      pendingInvites,
      inactiveInvites,
      remindersSent,
      reminderConversions,
      reminderChannels,
      highRiskScores,
      monthlyRows,
      occupancyProfitRows,
      recentPayments,
      recentExpenses,
      recentMoveOuts,
      recentAllocations,
      paymentAttemptStats,
    ] = await Promise.all([
      prisma.hostels.findFirst({
        where: { id: hostelId, owner_id: userId, is_active: true },
        select: { id: true, name: true, city: true, state: true, address: true, phone: true, is_active: true },
      }),
      prisma.payments.aggregate({
        where: { owner_id: userId, hostel_id: hostelId, payment_date: { gte: previousMonthStart, lt: monthStart } },
        _sum: { amount_paid: true },
      }),
      prisma.rent_obligations.aggregate({
        where: { owner_id: userId, hostel_id: hostelId, rent_month: { gte: monthStart, lt: nextMonthStart }, status: { not: "WAIVED" } },
        _sum: { total_amount: true },
      }),
      prisma.rent_obligations.aggregate({
        where: { owner_id: userId, hostel_id: hostelId, rent_month: { gte: previousMonthStart, lt: monthStart }, status: { not: "WAIVED" } },
        _sum: { total_amount: true },
      }),
      prisma.expenses.aggregate({
        where: { owner_id: userId, hostel_id: hostelId, date: { gte: previousMonthStart, lt: monthStart } },
        _sum: { amount: true },
      }),
      prisma.rooms.findMany({
        where: { hostel_id: hostelId, is_active: true },
        select: {
          id: true,
          room_no: true,
          capacity: true,
          room_type: true,
          floor: true,
          floor_ref: { select: { id: true, name: true } },
          room_allocations: {
            where: { is_active: true, end_date: null },
            select: { id: true, start_date: true, tenant_id: true },
          },
        },
        orderBy: [{ floor: "asc" }, { room_no: "asc" }],
      }),
      prisma.expenses.groupBy({
        by: ["category"],
        where: { owner_id: userId, hostel_id: hostelId, date: { gte: monthStart, lt: nextMonthStart } },
        _sum: { amount: true },
      }),
      prisma.expenses.groupBy({
        by: ["category"],
        where: { owner_id: userId, hostel_id: hostelId, date: { gte: previousMonthStart, lt: monthStart } },
        _sum: { amount: true },
      }),
      prisma.rent_obligations.findMany({
        where: { owner_id: userId, hostel_id: hostelId, status: { in: ["PENDING", "PARTIAL"] } },
        include: { tenants: { include: { profiles: { select: { name: true, phone: true } } } }, payments: { select: { amount_paid: true } } },
        orderBy: [{ due_date: "asc" }, { total_amount: "desc" }],
        take: 8,
      }),
      prisma.rent_obligations.findFirst({
        where: { owner_id: userId, hostel_id: hostelId, status: { in: ["PENDING", "PARTIAL"] } },
        orderBy: { due_date: "asc" },
        select: { due_date: true },
      }),
      prisma.rent_obligations.aggregate({
        where: { owner_id: userId, hostel_id: hostelId, due_date: today, status: { in: ["PENDING", "PARTIAL"] } },
        _sum: { total_amount: true },
      }),
      prisma.rent_obligations.aggregate({
        where: { owner_id: userId, hostel_id: hostelId, due_date: { gte: today, lte: weekEnd }, status: { in: ["PENDING", "PARTIAL"] } },
        _sum: { total_amount: true },
      }),
      prisma.move_out_requests.count({
        where: { owner_id: userId, hostel_id: hostelId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      }),
      prisma.tenants.count({
        where: { owner_id: userId, hostel_id: hostelId, status: "ACTIVE", joined_on: { gte: monthStart, lt: nextMonthStart } },
      }),
      prisma.tenants.count({
        where: { owner_id: userId, hostel_id: hostelId, status: "LEFT", exit_date: { gte: monthStart, lt: nextMonthStart } },
      }),
      prisma.tenants.count({ where: { owner_id: userId, hostel_id: hostelId, status: "INVITED" } }),
      prisma.tenants.count({ where: { owner_id: userId, hostel_id: hostelId, status: { in: ["EXPIRED", "CANCELLED"] } } }),
      prisma.reminder_logs.count({
        where: { hostel_id: hostelId, sent_at: { gte: monthStart, lt: nextMonthStart } },
      }),
      prisma.reminder_logs.count({
        where: { hostel_id: hostelId, sent_at: { gte: monthStart, lt: nextMonthStart }, converted_to_payment: true },
      }),
      prisma.reminder_logs.groupBy({
        by: ["channel"],
        where: { hostel_id: hostelId, sent_at: { gte: monthStart, lt: nextMonthStart } },
        _count: { id: true },
      }),
      prisma.tenant_behavior_scores.findMany({
        where: { tenants: { owner_id: userId, hostel_id: hostelId } },
        include: { tenants: { include: { profiles: { select: { name: true, phone: true } } } } },
        orderBy: { score: "asc" },
        take: 5,
      }),
      prisma.$queryRaw<Array<{ month: string; expected: number; collected: number; expenses: number; profit: number }>>`
        WITH months AS (
          SELECT generate_series(date_trunc('month', ${sixMonthStart}::date), date_trunc('month', ${monthStart}::date), interval '1 month')::date AS month_start
        ),
        expected AS (
          SELECT date_trunc('month', rent_month)::date AS month_start, COALESCE(SUM(total_amount), 0)::numeric AS amount
          FROM rent_obligations
          WHERE owner_id = ${userId}::uuid AND hostel_id = ${hostelId}::uuid AND status <> 'WAIVED' AND rent_month >= ${sixMonthStart}::date
          GROUP BY 1
        ),
        collected AS (
          SELECT date_trunc('month', payment_date)::date AS month_start, COALESCE(SUM(amount_paid), 0)::numeric AS amount
          FROM payments
          WHERE owner_id = ${userId}::uuid AND hostel_id = ${hostelId}::uuid AND payment_date >= ${sixMonthStart}::date
          GROUP BY 1
        ),
        spent AS (
          SELECT date_trunc('month', date)::date AS month_start, COALESCE(SUM(amount), 0)::numeric AS amount
          FROM expenses
          WHERE owner_id = ${userId}::uuid AND hostel_id = ${hostelId}::uuid AND date >= ${sixMonthStart}::date
          GROUP BY 1
        )
        SELECT to_char(m.month_start, 'Mon') AS month,
          COALESCE(e.amount, 0)::float AS expected,
          COALESCE(c.amount, 0)::float AS collected,
          COALESCE(s.amount, 0)::float AS expenses,
          (COALESCE(c.amount, 0) - COALESCE(s.amount, 0))::float AS profit
        FROM months m
        LEFT JOIN expected e ON e.month_start = m.month_start
        LEFT JOIN collected c ON c.month_start = m.month_start
        LEFT JOIN spent s ON s.month_start = m.month_start
        ORDER BY m.month_start ASC
      `,
      prisma.hostel_daily_snapshots.findMany({
        where: { hostel_id: hostelId, snapshot_date: { gte: sixMonthStart } },
        select: { snapshot_date: true, occupancy_rate: true, profit: true, collected_revenue: true, expenses: true },
        orderBy: { snapshot_date: "asc" },
        take: 180,
      }),
      prisma.payments.findMany({
        where: { owner_id: userId, hostel_id: hostelId },
        include: { tenants: { include: { profiles: { select: { name: true } } } } },
        orderBy: { payment_date: "desc" },
        take: 5,
      }),
      prisma.expenses.findMany({
        where: { owner_id: userId, hostel_id: hostelId },
        orderBy: { date: "desc" },
        take: 5,
      }),
      prisma.move_out_requests.findMany({
        where: { owner_id: userId, hostel_id: hostelId },
        include: { tenant: { include: { profiles: { select: { name: true } } } } },
        orderBy: { created_at: "desc" },
        take: 5,
      }),
      prisma.roomAllocation.findMany({
        where: { hostel_id: hostelId },
        include: { room: { select: { room_no: true } }, tenant: { include: { profiles: { select: { name: true } } } } },
        orderBy: { created_at: "desc" },
        take: 5,
      }),
      prisma.paymentAttempt.groupBy({
        by: ["status"],
        where: { owner_id: userId, hostel_id: hostelId, created_at: { gte: monthStart, lt: nextMonthStart } },
        _count: { id: true },
      }),
    ]);

    const expectedRevenue = Number(currentExpected._sum.total_amount || 0);
    const previousRevenue = Number(previousPayments._sum.amount_paid || 0);
    const previousExpectedRevenue = Number(previousExpected._sum.total_amount || 0);
    const previousExpenses = Number(previousCosts._sum.amount || 0);
    const netProfit = currentRevenue - monthlyExpenses;
    const previousProfit = previousRevenue - previousExpenses;
    const profitMargin = currentRevenue > 0 ? Math.round((netProfit / currentRevenue) * 100) : 0;
    const collectionRate = expectedRevenue > 0 ? Math.round((currentRevenue / expectedRevenue) * 100) : 0;
    const previousCollectionRate = previousExpectedRevenue > 0 ? Math.round((previousRevenue / previousExpectedRevenue) * 100) : 0;
    const expenseRatio = currentRevenue > 0 ? Math.round((monthlyExpenses / currentRevenue) * 100) : 0;
    const expensePerTenant = activeTenants > 0 ? Math.round(monthlyExpenses / activeTenants) : 0;
    const revenuePerOccupiedBed = activeTenants > 0 ? Math.round(currentRevenue / activeTenants) : 0;
    const avgBedRevenue = activeTenants > 0 ? currentRevenue / activeTenants : 0;
    const vacancyLossEstimate = Math.round(Math.max(totalCapacity - activeTenants, 0) * avgBedRevenue);
    const occupancyTrend = occupancyRate - (Number(occupancyProfitRows.at(-30)?.occupancy_rate || occupancyRate) || occupancyRate);
    const revenueTrend = previousRevenue > 0 ? Math.round(((currentRevenue - previousRevenue) / previousRevenue) * 100) : currentRevenue > 0 ? 100 : 0;
    const profitTrend = previousProfit !== 0 ? Math.round(((netProfit - previousProfit) / Math.abs(previousProfit)) * 100) : netProfit > 0 ? 100 : 0;
    const expenseGrowth = previousExpenses > 0 ? Math.round(((monthlyExpenses - previousExpenses) / previousExpenses) * 100) : monthlyExpenses > 0 ? 100 : 0;

    const previousCategoryMap = new Map(previousCategoryExpenses.map((row) => [row.category, Number(row._sum.amount || 0)]));
    const expenseCategories = categoryExpenses
      .map((row) => {
        const amount = Number(row._sum.amount || 0);
        const previous = previousCategoryMap.get(row.category) || 0;
        const trend = previous > 0 ? Math.round(((amount - previous) / previous) * 100) : amount > 0 ? 100 : 0;
        return {
          category: row.category,
          amount,
          percentage: monthlyExpenses > 0 ? Math.round((amount / monthlyExpenses) * 100) : 0,
          trend,
        };
      })
      .sort((a, b) => b.amount - a.amount);
    const topExpenseCategory = expenseCategories[0] || null;
    const fixedCategories = new Set(["Internet", "Security", "Staff Salary", "Salary"]);
    const fixedExpenses = expenseCategories.filter((c) => fixedCategories.has(c.category)).reduce((sum, c) => sum + c.amount, 0);
    const fixedCostRatio = monthlyExpenses > 0 ? Math.round((fixedExpenses / monthlyExpenses) * 100) : 0;

    const roomUtilization = rooms.map((room) => {
      const occupied = room.room_allocations.length;
      const capacity = Number(room.capacity || 0);
      return {
        id: room.id,
        room_no: room.room_no,
        floor: room.floor_ref?.name || (room.floor != null ? `Floor ${room.floor}` : "Unassigned"),
        room_type: room.room_type || "Standard",
        capacity,
        occupied,
        vacant: Math.max(capacity - occupied, 0),
        state: occupied >= capacity ? "full" : occupied === 0 ? "vacant" : "partial",
      };
    });
    const fullRooms = roomUtilization.filter((r) => r.state === "full").length;
    const partialRooms = roomUtilization.filter((r) => r.state === "partial").length;
    const vacantRooms = roomUtilization.filter((r) => r.state === "vacant").length;
    const floorMap = new Map<string, { floor: string; capacity: number; occupied: number }>();
    for (const room of roomUtilization) {
      const current = floorMap.get(room.floor) || { floor: room.floor, capacity: 0, occupied: 0 };
      current.capacity += room.capacity;
      current.occupied += room.occupied;
      floorMap.set(room.floor, current);
    }
    const floorOccupancy = Array.from(floorMap.values()).map((f) => ({
      ...f,
      occupancy_rate: f.capacity > 0 ? Math.round((f.occupied / f.capacity) * 100) : 0,
    }));

    const duesAging = {
      total_dues: pendingTotal,
      overdue_dues: overdueTotal,
      due_today: Number(dueTodayAgg._sum.total_amount || 0),
      due_this_week: Number(dueWeekAgg._sum.total_amount || 0),
      oldest_unpaid_due: oldestUnpaid?.due_date || null,
      overdue_30_plus_count: obligationsRisk.filter((o) => (today.getTime() - new Date(o.due_date).getTime()) / 86400000 > 30).length,
    };

    const highRiskTenants = obligationsRisk.map((ob: any) => {
      const paid = ob.payments.reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0);
      const balance = Math.max(0, Number(ob.total_amount || ob.amount || 0) - paid);
      const daysOverdue = Math.max(0, Math.floor((today.getTime() - new Date(ob.due_date).getTime()) / 86400000));
      return {
        tenant_id: ob.tenant_id,
        tenant_name: ob.tenants?.profiles?.name || "Tenant",
        phone: ob.tenants?.profiles?.phone || null,
        balance,
        days_overdue: daysOverdue,
        risk: daysOverdue > 30 || balance > 20000 ? "critical" : daysOverdue > 7 ? "high" : "medium",
      };
    }).sort((a, b) => (b.days_overdue - a.days_overdue) || (b.balance - a.balance)).slice(0, 5);

    const reminderConversionRate = remindersSent > 0 ? Math.round((reminderConversions / remindersSent) * 100) : 0;
    const mostEffectiveChannel = reminderChannels.sort((a, b) => b._count.id - a._count.id)[0]?.channel || null;
    const tenantChurnRate = activeTenants > 0 ? Math.round((exitsThisMonth / activeTenants) * 100) : 0;

    const attemptCountByStatus = new Map(paymentAttemptStats.map((s) => [s.status, s._count.id]));
    const attemptsTotal = [...attemptCountByStatus.values()].reduce((a, b) => a + b, 0);
    const attemptsFailed = (attemptCountByStatus.get("FAILED") || 0);
    const attemptsPendingVerification = (attemptCountByStatus.get("PENDING_VERIFICATION") || 0) + (attemptCountByStatus.get("PENDING_MANUAL_CONFIRMATION") || 0);
    const attemptsExpired = (attemptCountByStatus.get("EXPIRED") || 0);
    const attemptsSuccess = (attemptCountByStatus.get("SUCCESS") || 0);
    const attemptsDecisive = attemptsTotal - (attemptCountByStatus.get("CREATED") || 0) - (attemptCountByStatus.get("PENDING") || 0) - (attemptCountByStatus.get("PROCESSING") || 0);
    const upiFailureRate = attemptsDecisive > 0 ? Math.round((attemptsFailed / attemptsDecisive) * 100) : 0;

    let operationalScore = 100;
    operationalScore -= Math.max(0, 90 - occupancyRate) * 0.5;
    operationalScore -= Math.max(0, 95 - collectionRate) * 0.35;
    operationalScore -= Math.max(0, expenseRatio - 35) * 0.45;
    operationalScore -= Math.max(0, 20 - profitMargin) * 0.6;
    operationalScore -= Math.min(20, overdueCount * 4);
    operationalScore -= Math.min(12, tenantChurnRate * 1.5);
    operationalScore = Math.max(0, Math.min(100, Math.round(operationalScore)));
    const operationalState = operationalScore >= 85 ? "Excellent" : operationalScore >= 70 ? "Healthy" : operationalScore >= 45 ? "At Risk" : "Critical";
    const profitabilityStatus = profitMargin >= 30 && pendingTotal < currentRevenue * 0.15 && occupancyRate >= 85 && expenseRatio <= 35
      ? "Highly Profitable"
      : profitMargin >= 18 && occupancyRate >= 70
        ? "Stable"
        : profitMargin >= 0 && operationalScore >= 45
          ? "Attention Needed"
          : "Critical";

    const alerts = [
      ...(overdueTotal > 0 ? [{
        severity: overdueCount > 2 || duesAging.overdue_30_plus_count > 0 ? "critical" : "warning",
        title: `${overdueCount} tenant${overdueCount === 1 ? "" : "s"} overdue`,
        impact: `${overdueTotal.toLocaleString("en-IN")} pending collection risk`,
        action: "Collect or send reminder today",
        cta: "Review dues",
      }] : []),
      ...(occupancyRate < 70 ? [{
        severity: occupancyRate < 60 ? "critical" : "warning",
        title: "Low occupancy pressure",
        impact: `${Math.max(totalCapacity - activeTenants, 0)} vacant beds may cost ₹${vacancyLossEstimate.toLocaleString("en-IN")}`,
        action: "Push room filling or adjust pricing",
        cta: "Open rooms",
      }] : []),
      ...(expenseRatio > 45 ? [{
        severity: expenseRatio > 60 ? "critical" : "warning",
        title: "Expenses consuming revenue",
        impact: `${expenseRatio}% of collections are going to operations`,
        action: "Check top expense categories",
        cta: "Open expenses",
      }] : []),
      ...(pendingInvites > 0 ? [{
        severity: "info",
        title: `${pendingInvites} onboarding pending`,
        impact: "Invited tenants have not completed activation",
        action: "Follow up before rooms stay vacant",
        cta: "Open tenants",
      }] : []),
      ...(moveOutOpen > 0 ? [{
        severity: "warning",
        title: `${moveOutOpen} move-out request${moveOutOpen === 1 ? "" : "s"} open`,
        impact: "Upcoming vacancy or settlement work",
        action: "Resolve inspection and replacement plan",
        cta: "Open move-outs",
      }] : []),
    ].slice(0, 6);

    const recentActivity = [
      ...recentPayments.map((p: any) => ({
        type: "payment",
        title: `${p.tenants?.profiles?.name || "Tenant"} paid ₹${Number(p.amount_paid || 0).toLocaleString("en-IN")}`,
        detail: p.payment_method,
        date: p.payment_date,
      })),
      ...recentExpenses.map((e: any) => ({
        type: "expense",
        title: `${e.category} expense added`,
        detail: `${e.title} · ₹${Number(e.amount || 0).toLocaleString("en-IN")}`,
        date: e.date,
      })),
      ...recentMoveOuts.map((m: any) => ({
        type: "moveout",
        title: `${m.tenant?.profiles?.name || "Tenant"} move-out ${String(m.status).toLowerCase()}`,
        detail: m.reason_text || String(m.reason || "Move-out request"),
        date: m.created_at,
      })),
      ...recentAllocations.map((a: any) => ({
        type: "allocation",
        title: `${a.tenant?.profiles?.name || "Tenant"} allocated room ${a.room?.room_no || ""}`.trim(),
        detail: "Room allocation",
        date: a.created_at,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 12);

    return {
      hostel: {
        id: hostel?.id || hostelId,
        name: hostel?.name || "Hostel",
        location: hostel?.city || hostel?.address || "",
        phone: hostel?.phone || null,
        status: hostel?.is_active ? "Active" : "Inactive",
      },
      total_rooms: Number(roomStats[0]?.total_rooms ?? 0),
      occupied_rooms: occupiedRoomCount,
      total_tenants: totalTenants,
      active_tenants: activeTenants,
      total_capacity: totalCapacity,
      vacant_beds: Math.max(totalCapacity - activeTenants, 0),
      occupancy_rate: occupancyRate,
      revenue: currentRevenue,
      total_revenue: currentRevenue,
      monthly_revenue: currentRevenue,
      expenses_this_month: monthlyExpenses,
      rent_collected_this_month: currentRevenue,
      pending_dues: pendingTotal,
      overdue_amount: overdueTotal,
      overdue_count: overdueCount,
      overdue_tenants: overdueCount,
      unpaid_tenant_count: unpaidTenantCount,
      expected_revenue: expectedRevenue,
      collection_rate: collectionRate,
      net_profit: netProfit,
      profit_margin: profitMargin,
      expense_revenue_ratio: expenseRatio,
      expense_per_tenant: expensePerTenant,
      revenue_per_occupied_bed: revenuePerOccupiedBed,
      vacancy_loss_estimate: vacancyLossEstimate,
      tenant_churn_rate: tenantChurnRate,
      reminder_conversion_rate: reminderConversionRate,
      operational_score: operationalScore,
      operational_state: operationalState,
      profitability_status: profitabilityStatus,
      intelligence: {
        health: {
          score: operationalScore,
          state: operationalState,
          profitability_status: profitabilityStatus,
          occupancy_state: occupancyRate >= 90 ? "Healthy" : occupancyRate >= 60 ? "Moderate" : "Dangerous",
          profit_state: netProfit < 0 ? "loss" : profitMargin >= 20 ? "healthy" : "unstable",
        },
        kpis: {
          occupancy: {
            value: occupancyRate,
            occupied_beds: activeTenants,
            vacant_beds: Math.max(totalCapacity - activeTenants, 0),
            trend: Math.round(occupancyTrend),
            insight: `${Math.max(totalCapacity - activeTenants, 0)} vacant beds need filling`,
          },
          revenue: {
            collected: currentRevenue,
            expected: expectedRevenue,
            collection_rate: collectionRate,
            trend: revenueTrend,
            insight: `₹${pendingTotal.toLocaleString("en-IN")} pending from ${unpaidTenantCount} tenants`,
          },
          profit: {
            amount: netProfit,
            margin: profitMargin,
            trend: profitTrend,
            insight: profitTrend < 0 ? `Profit trend down ${Math.abs(profitTrend)}%` : `Profit trend up ${profitTrend}%`,
          },
          dues: {
            pending: pendingTotal,
            overdue_tenants: overdueCount,
            oldest_unpaid_due: oldestUnpaid?.due_date || null,
            insight: `${duesAging.overdue_30_plus_count} tenants overdue beyond 30 days`,
          },
          expenses: {
            amount: monthlyExpenses,
            ratio: expenseRatio,
            top_category: topExpenseCategory,
            insight: topExpenseCategory?.trend > 30 ? `${topExpenseCategory.category} increased ${topExpenseCategory.trend}%` : "Expenses are within tracked range",
          },
          tenant_stability: {
            move_out_requests: moveOutOpen,
            new_joins: joinsThisMonth,
            exits: exitsThisMonth,
            churn_rate: tenantChurnRate,
            insight: tenantChurnRate > 10 ? "High tenant churn detected" : "Tenant movement looks stable",
          },
        },
        revenue: {
          trend: monthlyRows,
          collection_efficiency: {
            collection_rate: collectionRate,
            trend: collectionRate - previousCollectionRate,
            average_payment_delay_days: highRiskTenants.length ? Math.round(highRiskTenants.reduce((s, t) => s + t.days_overdue, 0) / highRiskTenants.length) : 0,
            late_fee_collected: 0,
            pending_amount: pendingTotal,
          },
          revenue_per_occupied_bed: revenuePerOccupiedBed,
        },
        occupancy: {
          room_utilization: roomUtilization,
          summary: { full_rooms: fullRooms, partial_rooms: partialRooms, vacant_rooms: vacantRooms },
          floor_occupancy: floorOccupancy,
          vacancy_risk: {
            vacant_beds: Math.max(totalCapacity - activeTenants, 0),
            vacancy_loss_estimate: vacancyLossEstimate,
            insight: occupancyRate < 70 ? "Occupancy is dragging profitability" : "Occupancy is supporting revenue",
          },
          occupancy_vs_profit: occupancyProfitRows.map((row) => ({
            date: row.snapshot_date,
            occupancy: Number(row.occupancy_rate || 0),
            profit: Number(row.profit || 0),
          })).slice(-30),
        },
        dues: {
          summary: duesAging,
          high_risk_tenants: highRiskTenants,
          reminder_conversion: {
            sent: remindersSent,
            conversions: reminderConversions,
            conversion_rate: reminderConversionRate,
            best_channel: mostEffectiveChannel,
          },
          low_behavior_scores: highRiskScores.map((row: any) => ({
            tenant_id: row.tenant_id,
            tenant_name: row.tenants?.profiles?.name || "Tenant",
            score: row.score,
            phone: row.tenants?.profiles?.phone || null,
          })),
        },
        expenses: {
          categories: expenseCategories.slice(0, 6),
          growth: expenseGrowth,
          fixed_variable_ratio: fixedCostRatio,
          expense_per_tenant: expensePerTenant,
          anomalies: expenseCategories.filter((c) => c.trend > 35).slice(0, 3),
        },
        tenant_movement: {
          recent_joins: joinsThisMonth,
          move_out_requests: moveOutOpen,
          exits_this_month: exitsThisMonth,
          pending_onboarding: pendingInvites,
          inactive_invitations: inactiveInvites,
        },
        payment_attempts: {
          total: attemptsTotal,
          success: attemptsSuccess,
          failed: attemptsFailed,
          pending_verification: attemptsPendingVerification,
          abandoned: attemptsExpired,
          upi_failure_rate: upiFailureRate,
        },
        alerts,
        recent_activity: recentActivity,
      },
    };
  }

  async getMonthlyStats(userId: string, hostelId: string, months: number = 6) {
    const now = new Date();

    // Build all date ranges first so we can fire every query in one parallel batch
    // instead of awaiting each iteration serially (was: months × 2 = 12 sequential round trips).
    const ranges = Array.from({ length: months }, (_, i) => {
      const targetMonth     = now.getUTCMonth() - i;
      const targetYear      = now.getUTCFullYear() + Math.floor(targetMonth / 12);
      const normalizedMonth = ((targetMonth % 12) + 12) % 12;
      const start = new Date(Date.UTC(targetYear, normalizedMonth, 1, 0, 0, 0, 0));
      const end   = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0, 0, 0, 0, 0));
      return { start, end };
    });

    const results = await Promise.all(
      ranges.map(({ start, end }) => financialService.getOperationalCashflowMetrics(userId, start, end, hostelId))
    );

    return results
      .map((cf, i) => {
        const { start }        = ranges[i];
        const collectedAmount  = Number(cf.collected_total || 0);
        const dueAmount        = Number(cf.expected_total || 0);
        return {
          month: formatShortMonth(start),
          year:  start.getFullYear(),
          collected: collectedAmount,
          due:       dueAmount,
          collection_rate: Number(cf.collection_rate || 0),
        };
      })
      .reverse();
  }

  async getTenantStats(profileId: string) {
    const tenant = await prisma.tenants.findUnique({
      where: { profile_id: profileId },
      include: {
        room_allocations: { where: { is_active: true, end_date: null }, include: { room: true } },
        rent_obligations: { 
          where: { status: { in: ["PENDING", "PARTIAL"] } }, 
          orderBy: { due_date: "asc" },
          include: { payments: { select: { amount_paid: true } } }
        }
      }
    });

    if (!tenant) throw new Error("NOT_FOUND: Tenant record not found");

    if (!tenant.hostel_id) throw new Error("HOSTEL_CONTEXT_REQUIRED: tenant hostel scope unavailable");
    const dues = await financialService.getTenantDues(tenant.id, tenant.owner_id || undefined, tenant.hostel_id);
    const pendingTotal = dues.total_due;
    const nextItem = dues.items[0];
    const nextPayment: Date | null = nextItem?.due_date ?? null;
    const oldestObligationId: string | null = nextItem?.obligation_id ?? null;

    return {
      tenant_id: tenant.id,
      room_no: (tenant as any).room_allocations[0]?.room.room_no || "Not Assigned",
      monthly_rent: Number(tenant.monthly_rent),
      pending_dues: pendingTotal,
      next_payment_date: nextPayment,
      oldest_obligation_id: oldestObligationId,
      status: tenant.status
    };
  }
}

export const dashboardService = new DashboardService();
