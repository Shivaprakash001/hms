import { prisma } from "../db";

export class DashboardService {
  async getOwnerStats(userId: string) {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const [students, rooms, payments, costs] = await Promise.all([
      prisma.student.findMany({ where: { owner_id: userId }, select: { status: true } }),
      prisma.room.findMany({ where: { hostel: { owner_id: userId } }, select: { capacity: true } }),
      prisma.payment.findMany({ 
        where: { 
          owner_id: userId, 
          payment_date: { gte: monthStart, lt: nextMonth } 
        }, 
        select: { amount_paid: true } 
      }),
      // Assuming costs (expenses) table exists in schema, otherwise skip
      prisma.$queryRaw`SELECT SUM(amount) as total FROM "Expense" WHERE owner_id = ${userId}::uuid AND date >= ${monthStart} AND date < ${nextMonth}` as Promise<any>
    ]);

    const totalTenants = students.length;
    const activeTenants = students.filter((s: any) => s.status === "ACTIVE").length;
    const totalCapacity = rooms.reduce((sum: number, r: any) => sum + r.capacity, 0);
    const currentRevenue = payments.reduce((sum: number, p: any) => sum + Number(p.amount_paid), 0);
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
            month: start.toLocaleString('default', { month: 'short' }),
            year: start.getFullYear(),
            collected: collectedAmount,
            due: dueAmount,
            collection_rate: dueAmount > 0 ? Math.round((collectedAmount / dueAmount) * 100) : 0
        });
    }
    return stats.reverse();
  }

  async getStudentStats(profileId: string) {
    const student = await prisma.student.findUnique({
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

    if (!student) throw new Error("NOT_FOUND: Student record not found");

    let pendingTotal = 0;
    let nextPayment: Date | null = null;
    let oldestObligationId: string | null = null;

    student.obligations.forEach((ob: any) => {
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
      student_id: student.id,
      room_no: student.allocations[0]?.room.room_no || "Not Assigned",
      monthly_rent: Number(student.monthly_rent),
      pending_dues: pendingTotal,
      next_payment_date: nextPayment,
      oldest_obligation_id: oldestObligationId,
      status: student.status
    };
  }
}

export const dashboardService = new DashboardService();
