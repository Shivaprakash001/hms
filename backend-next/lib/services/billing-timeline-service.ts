import { prisma } from "@/lib/db";
import { billingScheduleService, type PaymentFrequency } from "@/lib/services/billing-schedule-service";
import { hostelPolicyService } from "@/lib/services/hostel-policy-service";

function money(value: unknown) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function daysUntil(date: Date) {
  const today = new Date();
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((target - start) / 86_400_000);
}

export class BillingTimelineService {
  async getTenantTimeline(tenantId: string, ownerId?: string) {
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        owner_id: true,
        hostel_id: true,
        payment_frequency: true,
        payment_frequency_effective_from: true,
        payment_frequency_updated_at: true,
        monthly_rent: true,
        maintenance_charge: true,
        maintenance_type: true,
        tenant_billing_plans: {
          orderBy: { effective_from: "desc" },
          take: 8,
        },
        payment_frequency_change_requests: {
          orderBy: { created_at: "desc" },
          take: 10,
        },
      },
    });
    if (!tenant) throw new Error("TENANT_NOT_FOUND");
    if (ownerId && tenant.owner_id !== ownerId) throw new Error("TENANT_NOT_FOUND");

    const [policyResponse] = await Promise.all([
      hostelPolicyService.getHostelPolicy(tenant.hostel_id).catch(() => null),
    ]);
    // Extract billing schedule settings from the full policy (NOT just payment_frequency)
    const billingPrefs = (policyResponse?.policy?.billing ?? {}) as {
      due_day?: number; auto_rent_day?: number; grace_days?: number;
    };
    const dueDay = Math.max(1, Math.min(28, Number(billingPrefs.due_day ?? 5)));
    const autoRentDay = Math.max(1, Math.min(28, Number(billingPrefs.auto_rent_day ?? 1)));

    const obligations = await prisma.rent_obligations.findMany({
      where: {
        tenant_id: tenantId,
        status: { in: ["UPCOMING", "PENDING", "PARTIAL", "PAID", "OVERDUE", "WAIVED"] },
        is_superseded: false,
      },
      include: { payments: true },
      orderBy: [{ billing_period_start: "asc" }, { rent_month: "asc" }, { obligation_type: "asc" }],
      take: 120,
    });

    const payments = await prisma.payments.findMany({
      where: { tenant_id: tenantId },
      orderBy: { payment_date: "desc" },
      take: 20,
    });

    const rentAdvanceCredits = await prisma.tenant_financial_ledger.findMany({
      where: {
        tenant_id: tenantId,
        type: "CREDIT",
        reason: "FUTURE_RENT_CREDIT_TOPUP",
      },
      orderBy: { created_at: "desc" },
      take: 20,
    });

    const items = obligations.map((ob: any) => {
      const amount = money(ob.amount);
      const recordedPaid = money((ob.payments || []).reduce((s: number, p: any) => s + Number(p.amount_paid || 0), 0));
      const paid = ob.status === "PAID" && recordedPaid <= 0 ? amount : recordedPaid;
      const remaining = money(Math.max(amount - paid, 0));
      const dueDate = new Date(ob.due_date);
      const delta = daysUntil(dueDate);
      let state = "pending";
      if (ob.status === "WAIVED") state = "waived";
      else if (remaining <= 0 || ob.status === "PAID") state = "paid";
      else if (paid > 0 || ob.status === "PARTIAL") state = "partial";
      else if (delta < 0) state = "overdue";
      else if (delta <= 5) state = "due_soon";
      else if (delta > 30) state = "upcoming";

      return {
        obligation_id: ob.id,
        timeline_id: `obligation:${ob.id}`,
        type: ob.obligation_type,
        billing_plan_id: ob.billing_plan_id,
        period_start: ob.billing_period_start || ob.rent_month,
        period_end: ob.billing_period_end || ob.rent_month,
        rent_month: ob.rent_month,
        label: ob.installment_label || new Date(ob.rent_month).toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
        installment_sequence: ob.installment_sequence,
        amount,
        paid,
        remaining,
        due_date: ob.due_date,
        status: ob.status,
        state,
      };
    });

    const activeFrequency = (tenant.payment_frequency || "MONTHLY") as PaymentFrequency;
    const projectedItems: any[] = [];

    const paymentItems = payments.map((payment: any) => ({
      obligation_id: payment.obligation_id,
      timeline_id: `payment:${payment.id}`,
      type: "PAYMENT",
      billing_plan_id: null,
      period_start: payment.payment_date,
      period_end: payment.payment_date,
      rent_month: payment.payment_date,
      label: "Payment received",
      installment_sequence: null,
      amount: money(payment.amount_paid),
      paid: money(payment.amount_paid),
      remaining: 0,
      due_date: payment.payment_date,
      status: "PAID",
      state: "paid",
      payment_method: payment.payment_method,
      reference_number: payment.reference_number,
    }));

    const rentAdvanceItems = rentAdvanceCredits.map((entry: any) => ({
      obligation_id: null,
      timeline_id: `advance-credit:${entry.id}`,
      type: "ADVANCE_CREDIT",
      billing_plan_id: null,
      period_start: entry.created_at,
      period_end: entry.created_at,
      rent_month: entry.created_at,
      label: "Future rent credit",
      installment_sequence: null,
      amount: money(entry.amount),
      paid: money(entry.amount),
      remaining: 0,
      due_date: entry.created_at,
      status: "PAID",
      state: "paid",
      payment_method: entry.reference_type === "PAYMENT_ATTEMPT" ? "RAZORPAY" : "OFFLINE",
      reference_number: entry.reference_id,
      notes: entry.notes,
    }));

    const timeline = [...items, ...paymentItems, ...rentAdvanceItems].sort((a: any, b: any) => {
      const aDate = new Date(a.due_date || a.period_start || 0).getTime();
      const bDate = new Date(b.due_date || b.period_start || 0).getTime();
      if (aDate !== bDate) return aDate - bDate;
      return String(a.timeline_id).localeCompare(String(b.timeline_id));
    });

    // Find the latest rent obligation
    const rentObligations = obligations.filter((ob) => ob.obligation_type === "RENT");
    let latestRentMonth: Date | null = tenant.payment_frequency_effective_from
      ? new Date(tenant.payment_frequency_effective_from)
      : null;

    if (rentObligations.length > 0) {
      const maxMonth = rentObligations.reduce((max, ob) => {
        const d = new Date(ob.rent_month);
        return d > max ? d : max;
      }, new Date(0));
      if (maxMonth.getTime() > 0) {
        latestRentMonth = maxMonth;
      }
    }

    if (!latestRentMonth) {
      const activeAllocation = await prisma.roomAllocation.findFirst({
        where: { tenant_id: tenantId, is_active: true },
        select: { start_date: true },
      });
      latestRentMonth = activeAllocation?.start_date ? new Date(activeAllocation.start_date) : new Date();
    }

    const months = billingScheduleService.periodMonths(activeFrequency);
    const nextRentMonth = new Date(Date.UTC(latestRentMonth.getUTCFullYear(), latestRentMonth.getUTCMonth() + months, 1));
    const nextGenDate = new Date(Date.UTC(nextRentMonth.getUTCFullYear(), nextRentMonth.getUTCMonth(), autoRentDay));

    const nextInstallment = billingScheduleService.buildInstallment({
      frequency: activeFrequency,
      anchorDate: nextRentMonth,
      monthlyRent: tenant.monthly_rent ? Number(tenant.monthly_rent) : 0,
      maintenanceAmount: tenant.maintenance_charge ? Number(tenant.maintenance_charge) : 0,
      dueDay,
      autoRentDay,
      policy: policyResponse?.policy?.preferences_config || {},
    });

    const nextRentGeneration = {
      next_rent_month: nextRentMonth.toISOString(),
      next_rent_generation_date: nextGenDate.toISOString(),
      next_installment_due_date: nextInstallment.due_date.toISOString(),
      next_installment_amount: nextInstallment.amount,
      next_maintenance_amount: nextInstallment.maintenance_amount,
      period_start: nextInstallment.period_start.toISOString(),
      period_end: nextInstallment.period_end.toISOString(),
      installment_label: nextInstallment.installment_label,
    };

    return {
      tenant_id: tenant.id,
      active_frequency: activeFrequency,
      effective_from: tenant.payment_frequency_effective_from,
      updated_at: tenant.payment_frequency_updated_at,
      billing_settings: { due_day: dueDay, auto_rent_day: autoRentDay, grace_days: Number(billingPrefs.grace_days ?? 0) },
      plans: tenant.tenant_billing_plans,
      requests: tenant.payment_frequency_change_requests,
      items: timeline,
      obligation_items: items,
      payment_items: [...paymentItems, ...rentAdvanceItems],
      rent_advance_items: rentAdvanceItems,
      projected_items: projectedItems,
      next_rent_generation: nextRentGeneration,
    };
  }
}

export const billingTimelineService = new BillingTimelineService();
