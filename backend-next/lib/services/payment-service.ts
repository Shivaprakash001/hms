import { prisma } from "../db";
import { eventSystem } from "../events";
import { Decimal } from "@prisma/client/runtime/library";

export class PaymentService {
  /**
   * Calculate prorated rent for a month.
   */
  calculateProratedRent(monthlyRent: number, startDate: Date, endDate: Date | null, targetMonth: Date): number {
    const monthStart = new Date(targetMonth.getFullYear(), targetMonth.month, 1);
    const lastDay = new Date(targetMonth.getFullYear(), targetMonth.month + 1, 0).getDate();
    const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.month, lastDay);

    const actualStart = startDate > monthStart ? startDate : monthStart;
    const actualEnd = endDate && endDate < monthEnd ? endDate : monthEnd;

    if (actualStart > actualEnd) return 0;

    const daysOccupied = Math.ceil((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (daysOccupied >= lastDay) return monthlyRent;

    return Number(((monthlyRent * daysOccupied) / lastDay).toFixed(2));
  }

  async generateMonthlyRent(rentMonth: Date, ownerId?: string) {
    const targetMonth = new Date(rentMonth.getFullYear(), rentMonth.month, 1);
    const lastDay = new Date(targetMonth.getFullYear(), targetMonth.month + 1, 0).getDate();
    const monthEndDate = new Date(targetMonth.getFullYear(), targetMonth.month, lastDay);

    // Find all allocations active during some part of this month
    const allocations = await prisma.roomAllocation.findMany({
      where: {
        start_date: { lte: monthEndDate },
        OR: [
          { end_date: null },
          { end_date: { gte: targetMonth } }
        ],
        ...(ownerId && { student: { owner_id: ownerId } })
      },
      include: { student: true }
    });

    let generated = 0;
    let skipped = 0;

    for (const alloc of allocations) {
      if (!alloc.student) continue;

      const amount = this.calculateProratedRent(
        Number(alloc.student.monthly_rent),
        alloc.start_date,
        alloc.end_date,
        targetMonth
      );

      if (amount <= 0) continue;

      // Check for existing
      const existing = await prisma.rentObligation.findFirst({
        where: {
          student_id: alloc.student_id,
          rent_month: targetMonth,
        }
      });

      if (existing) {
        skipped++;
        continue;
      }

      const obligation = await prisma.rentObligation.create({
        data: {
          student_id: alloc.student_id,
          allocation_id: alloc.id,
          owner_id: ownerId || alloc.student.owner_id,
          rent_month: targetMonth,
          amount: new Decimal(amount),
          due_date: new Date(targetMonth.getFullYear(), targetMonth.month, 10), // Default 10th
          status: "PENDING"
        }
      });

      generated++;
      await eventSystem.trigger("rent_obligation_created", {
        obligationId: obligation.id,
        studentId: alloc.student_id,
        amount
      });
    }

    return { generated, skipped, total: allocations.length };
  }

  async recordPayment(data: {
    obligationId: string;
    amountPaid: number;
    paymentMethod: string;
    referenceNumber?: string;
    paymentDate?: Date;
    userId?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const obligation = await tx.rentObligation.findUnique({
        where: { id: data.obligationId },
        include: { payments: true }
      });

      if (!obligation) throw new Error("NOT_FOUND: Obligation not found");
      if (obligation.status === "WAIVED") throw new Error("BAD_REQUEST: Cannot pay for waived obligation");

      const totalAlreadyPaid = obligation.payments.reduce((acc, p) => acc + Number(p.amount_paid), 0);
      const remaining = Number(obligation.amount) - totalAlreadyPaid;

      if (data.amountPaid > remaining) throw new Error(`BAD_REQUEST: Payment exceeds balance. Remaining: ${remaining}`);

      const payment = await tx.payment.create({
        data: {
          obligation_id: data.obligationId,
          student_id: obligation.student_id,
          owner_id: obligation.owner_id,
          amount_paid: new Decimal(data.amountPaid),
          payment_method: data.paymentMethod,
          reference_number: data.referenceNumber,
          payment_date: data.paymentDate || new Date(),
        }
      });

      const newTotalPaid = totalAlreadyPaid + data.amountPaid;
      const newStatus = newTotalPaid >= Number(obligation.amount) ? "PAID" : "PARTIAL";

      await tx.rentObligation.update({
        where: { id: data.obligationId },
        data: { status: newStatus }
      });

      return { payment, newStatus };
    }).then(async (res) => {
      await eventSystem.trigger("payment_recorded", {
        paymentId: res.payment.id,
        obligationId: data.obligationId,
        amount: data.amountPaid
      });
      return res;
    });
  }

  async reconcilePendingAttempts() {
    // Cron logic implementation
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pending = await prisma.paymentAttempt.findMany({
      where: {
        status: "PENDING",
        created_at: { gte: cutoff }
      }
    });

    // In a real app, we'd loop and call gateway API here
    return { processed: pending.length };
  }
}

export const paymentService = new PaymentService();
