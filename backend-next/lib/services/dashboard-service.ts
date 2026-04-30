import { prisma } from "../db";
import { formatShortMonth } from "../format";

export class DashboardService {
  async getOwnerStats(userId: string) {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const [tenants, rooms, payments, costs] = await Promise.all([
      prisma.tenant.findMany({ where: { owner_id: userId }, select: { status: true } }),
      prisma.room.findMany({ where: { hostel: { owner_id: userId } }, select: { capacity: true } }),
      prisma.payment.findMany({ 
        where: { 
          owner_id: userId, 
          payment_date: { gte: monthStart, lt: nextMonth } 
        }, 
        select: { amount_paid: true } 
      }),
      prisma.expense.aggregate({
        where: {
          owner_id: userId,
          date: { gte: monthStart, lt: nextMonth },
        },
        _sum: { amount: true },
      }),
    ]);

    const totalTenants = tenants.length;
    const activeTenants = tenants.filter((s: any) => s.status === "ACTIVE").length;
    const totalCapacity = rooms.reduce((sum: number, r: any) => sum + r.capacity, 0);
    const currentRevenue = payments.reduce((sum: number, p: any) => sum + Number(p.amount_paid), 0);
    const monthlyExpenses = Number(costs?._sum?.amount || 0);
    const occupancyRate = totalCapacity > 0 ? Math.round((activeTenants / totalCapacity) * 100) : 0;

    // Pending dues calculation
    const undpaidObligations = await prisma.rentObligation.findMany({
      where: { 
        owner_id: userId, 
        status: { in: ["PENDING", "PARTIAL"] }
      },
      include: { payments: { select: { amount_paid: true } } }
    });

    let pendingTotal = 0;
    let overdueTotal = 0;
    let overdueCount = 0;

    undpaidObligations.forEach((ob: any) => {
      const paid = ob.payments.reduce((sum: number, p: any) => sum + Number(p.amount_paid), 0);
      const remaining = Number(ob.amount) - paid;
      if (remaining > 0) {
        pendingTotal += remaining;
        if (ob.due_date < today) {
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
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);

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
