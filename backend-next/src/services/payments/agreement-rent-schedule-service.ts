import { prisma } from "@/lib/db";
import { resolvePreferences } from "@/lib/preferences";

type Tx = typeof prisma | any;

export type AgreementRentScheduleResult = {
  agreementId: string;
  created: number;
  updated: number;
  skipped: number;
  months: Array<{ rent_month: Date; status: "UPCOMING" | "PENDING" | "OVERDUE" }>;
};

function money(value: unknown) {
  const number = Number(value || 0);
  return Math.round((Number.isFinite(number) ? number : 0) * 100) / 100;
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function firstOfUtcMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function addUtcMonths(value: Date, months: number) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
}

function lastDayOfUtcMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));
}

function dueDateForMonth(month: Date, dueDay: number) {
  const bounded = Math.max(1, Math.min(28, Math.trunc(Number(dueDay || 5))));
  const lastDay = lastDayOfUtcMonth(month).getUTCDate();
  return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), Math.min(bounded, lastDay)));
}

function monthLabel(month: Date, sequence: number) {
  return `${month.toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" })} rent (${sequence})`;
}

function statusFor(month: Date, dueDate: Date, now: Date): "UPCOMING" | "PENDING" | "OVERDUE" {
  const currentMonth = firstOfUtcMonth(now);
  if (month.getTime() > currentMonth.getTime()) return "UPCOMING";
  return dueDate.getTime() < startOfUtcDay(now).getTime() ? "OVERDUE" : "PENDING";
}

function shouldUpdateStatus(existingStatus: string | null | undefined) {
  return !["PAID", "WAIVED", "PARTIAL"].includes(String(existingStatus || ""));
}

export class AgreementRentScheduleService {
  async generateForAgreement(agreementId: string, options: { now?: Date } = {}) {
    return prisma.$transaction((tx: any) => this.generateForAgreementInTx(tx, agreementId, options));
  }

  async generateForAgreementInTx(
    tx: Tx,
    agreementId: string,
    options: { now?: Date } = {}
  ): Promise<AgreementRentScheduleResult> {
    const id = String(agreementId || "").trim();
    if (!id) throw new Error("VALIDATION_ERROR: agreementId is required");

    await tx.$queryRaw`SELECT id FROM "Agreement" WHERE id = ${id}::uuid FOR UPDATE`;

    const agreement = await tx.agreement.findUnique({
      where: { id },
      include: {
        hostel: true,
        tenant: {
          include: {
            room_allocations: {
              where: { is_active: true, end_date: null },
              orderBy: { start_date: "desc" },
              take: 1,
              include: { room: true },
            },
          },
        },
      },
    });

    if (!agreement) throw new Error("NOT_FOUND: Agreement not found");
    if (!["SIGNED", "EXPIRING_SOON", "AGREEMENT_EXPIRED"].includes(String(agreement.status))) {
      return { agreementId: id, created: 0, updated: 0, skipped: 0, months: [] };
    }

    const durationMonths = Math.trunc(Number(agreement.agreement_duration_months || 0));
    if (durationMonths <= 0) {
      throw new Error("VALIDATION_ERROR: agreement_duration_months must be greater than 0");
    }

    const startDate = agreement.agreement_start_date || agreement.tenant?.joined_on || agreement.tenant?.billing_start_date;
    if (!startDate) throw new Error("VALIDATION_ERROR: agreement_start_date or tenant joined_on is required");
    const startMonth = firstOfUtcMonth(new Date(startDate));

    const allocation = agreement.tenant?.room_allocations?.[0] || null;
    const rentAmount = money(agreement.contract_rent ?? agreement.tenant?.monthly_rent ?? allocation?.room?.base_rent);
    if (rentAmount <= 0) throw new Error("VALIDATION_ERROR: agreement rent must be greater than 0");

    const prefs = resolvePreferences(agreement.hostel || {});
    const dueDay = Number(prefs.due_day || 5);
    const now = options.now || new Date();

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const months: AgreementRentScheduleResult["months"] = [];

    for (let i = 0; i < durationMonths; i++) {
      const rentMonth = addUtcMonths(startMonth, i);
      const dueDate = dueDateForMonth(rentMonth, dueDay);
      const status = statusFor(rentMonth, dueDate, now);
      const periodEnd = lastDayOfUtcMonth(rentMonth);
      const sequence = i + 1;
      months.push({ rent_month: rentMonth, status });

      // Duplicate guard: check by agreement_id, allocation_id, AND tenant_id.
      // The tenant_id clause catches onboarding-created obligations that have
      // both agreement_id=NULL and allocation_id=NULL (P0 duplicate rent fix).
      const existing = await tx.rent_obligations.findFirst({
        where: {
          is_superseded: false,
          obligation_type: "RENT",
          OR: [
            { agreement_id: id, rent_month: rentMonth },
            ...(allocation?.id ? [{ allocation_id: allocation.id, rent_month: rentMonth }] : []),
            { tenant_id: agreement.tenant_id, rent_month: rentMonth },
          ],
        },
        include: { payments: { select: { id: true } } },
      });

      if (existing) {
        const patch: Record<string, any> = {
          agreement_id: id,
          owner_id: agreement.tenant?.owner_id || existing.owner_id,
          hostel_id: agreement.hostel_id,
          billing_period_start: rentMonth,
          billing_period_end: periodEnd,
          installment_label: existing.installment_label || monthLabel(rentMonth, sequence),
          installment_sequence: existing.installment_sequence || sequence,
          updated_at: new Date(),
        };

        if (money(existing.amount) !== rentAmount && (!existing.payments || existing.payments.length === 0)) {
          patch.amount = rentAmount;
          patch.total_amount = rentAmount;
        }
        if (shouldUpdateStatus(existing.status)) {
          patch.status = status === "OVERDUE" ? "PENDING" : status;
        }
        if (allocation?.id && !existing.allocation_id) {
          patch.allocation_id = allocation.id;
        }

        await tx.rent_obligations.update({ where: { id: existing.id }, data: patch });
        updated++;
        continue;
      }

      try {
        await tx.rent_obligations.create({
          data: {
            tenant_id: agreement.tenant_id,
            allocation_id: allocation?.id || null,
            owner_id: agreement.tenant?.owner_id || null,
            hostel_id: agreement.hostel_id,
            agreement_id: id,
            rent_month: rentMonth,
            amount: rentAmount,
            total_amount: rentAmount,
            due_date: dueDate,
            status: status === "OVERDUE" ? "PENDING" : status,
            obligation_type: "RENT",
            billing_period_start: rentMonth,
            billing_period_end: periodEnd,
            installment_label: monthLabel(rentMonth, sequence),
            installment_sequence: sequence,
          },
        });
        created++;
      } catch (error: any) {
        if (error?.code === "P2002") {
          skipped++;
          continue;
        }
        throw error;
      }
    }

    return { agreementId: id, created, updated, skipped, months };
  }

  async syncDueStatuses(params: { hostelId?: string; now?: Date } = {}) {
    const now = startOfUtcDay(params.now || new Date());
    const currentMonth = firstOfUtcMonth(now);
    const whereHostel = params.hostelId ? { hostel_id: params.hostelId } : {};

    // 1. Self-healing backfill: Convert any existing database status 'OVERDUE' to 'PENDING' or 'PARTIAL'
    const overdueObs = await prisma.rent_obligations.findMany({
      where: {
        ...whereHostel,
        status: "OVERDUE"
      },
      include: { payments: { select: { amount_paid: true } } }
    });

    for (const ob of overdueObs) {
      const totalPaid = ob.payments.reduce((sum, p) => sum + Number(p.amount_paid), 0);
      const targetStatus = totalPaid > 0 ? "PARTIAL" : "PENDING";
      await prisma.rent_obligations.update({
        where: { id: ob.id },
        data: { status: targetStatus, updated_at: new Date() }
      });
    }

    // 2. Transition 'UPCOMING' rent obligations to 'PENDING' when the billing month starts
    const pendingResult = await prisma.rent_obligations.updateMany({
      where: {
        ...whereHostel,
        obligation_type: "RENT",
        is_superseded: false,
        status: "UPCOMING",
        rent_month: { lte: currentMonth },
      },
      data: { status: "PENDING", updated_at: new Date() },
    });

    // 3. Count overdue obligations dynamically instead of setting database status
    const overdueCount = await prisma.rent_obligations.count({
      where: {
        ...whereHostel,
        obligation_type: "RENT",
        is_superseded: false,
        status: { in: ["PENDING", "PARTIAL"] },
        due_date: { lt: now },
      },
    });

    return {
      pending: pendingResult.count,
      overdue: overdueCount,
    };
  }
}

export const agreementRentScheduleService = new AgreementRentScheduleService();
