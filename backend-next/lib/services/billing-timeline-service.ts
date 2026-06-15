import { prisma } from "@/lib/db";
import { billingScheduleService, type PaymentFrequency } from "@/lib/services/billing-schedule-service";
import { hostelPolicyService } from "@/lib/services/hostel-policy-service";
import { tenantFinancialLedgerService } from "@/src/services/payments/tenant-financial-ledger-service";

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

    const [policyResponse, advanceSummary] = await Promise.all([
      hostelPolicyService.getHostelPolicy(tenant.hostel_id).catch(() => null),
      tenantFinancialLedgerService.getBalance(tenant.id, tenant.owner_id).catch(() => null),
    ]);
    const policy = billingScheduleService.normalizePolicy(policyResponse?.policy);
    // Extract billing schedule settings from the full policy (NOT just payment_frequency)
    const billingPrefs = (policyResponse?.policy?.billing ?? {}) as {
      due_day?: number; auto_rent_day?: number; grace_days?: number;
    };
    const dueDay = Math.max(1, Math.min(28, Number(billingPrefs.due_day ?? 5)));
    const autoRentDay = Math.max(1, Math.min(28, Number(billingPrefs.auto_rent_day ?? 1)));

    const obligations = await prisma.rent_obligations.findMany({
      where: {
        tenant_id: tenantId,
        status: { in: ["PENDING", "PARTIAL", "PAID", "WAIVED"] },
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

    const rentAdvanceCredits = await prisma.tenant_advance_ledger.findMany({
      where: {
        tenant_id: tenantId,
        type: "CREDIT",
        reason: "TOPUP",
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
    const nextStart = billingScheduleService.getNextCleanBillingPeriodDate(new Date(), activeFrequency, policy);
    const futureSchedule = billingScheduleService.previewSchedule({
      frequency: activeFrequency,
      startDate: nextStart,
      monthlyRent: money(tenant.monthly_rent),
      maintenanceAmount: String(tenant.maintenance_type || "MONTHLY") === "MONTHLY" ? money(tenant.maintenance_charge) : 0,
      periods: 6,
      policy,
      dueDay,
      autoRentDay,
    });
    const existingPeriodKeys = new Set(
      obligations.map((ob: any) => `${new Date(ob.billing_period_start || ob.rent_month).toISOString().slice(0, 10)}:${ob.obligation_type}`)
    );
    let previewRentAdvance = money((advanceSummary as any)?.available_rent_advance);
    const applyPreviewAdvance = (amount: number) => {
      const covered = money(Math.min(previewRentAdvance, amount));
      previewRentAdvance = money(Math.max(previewRentAdvance - covered, 0));
      return {
        coveredByAdvance: covered,
        remaining: money(Math.max(amount - covered, 0)),
      };
    };

    const projectedItems = futureSchedule.flatMap((slot) => {
      const startKey = slot.period_start.toISOString().slice(0, 10);
      const rows: any[] = [];
      if (!existingPeriodKeys.has(`${startKey}:RENT`) && slot.amount > 0) {
        const amount = money(slot.amount);
        const preview = applyPreviewAdvance(amount);
        rows.push({
          obligation_id: null,
          timeline_id: `projected:rent:${startKey}`,
          type: "PROJECTED_RENT",
          billing_plan_id: null,
          period_start: slot.period_start,
          period_end: slot.period_end,
          rent_month: slot.period_start,
          label: slot.installment_label,
          installment_sequence: slot.installment_sequence,
          amount,
          paid: preview.coveredByAdvance,
          remaining: preview.remaining,
          covered_by_advance: preview.coveredByAdvance,
          due_date: slot.due_date,
          status: "PROJECTED",
          state: preview.remaining <= 0 ? "covered" : "upcoming",
        });
      }
      if (!existingPeriodKeys.has(`${startKey}:MAINTENANCE`) && slot.maintenance_amount > 0) {
        const amount = money(slot.maintenance_amount);
        const preview = applyPreviewAdvance(amount);
        rows.push({
          obligation_id: null,
          timeline_id: `projected:maintenance:${startKey}`,
          type: "PROJECTED_MAINTENANCE",
          billing_plan_id: null,
          period_start: slot.period_start,
          period_end: slot.period_end,
          rent_month: slot.period_start,
          label: `${slot.installment_label} maintenance`,
          installment_sequence: slot.installment_sequence,
          amount,
          paid: preview.coveredByAdvance,
          remaining: preview.remaining,
          covered_by_advance: preview.coveredByAdvance,
          due_date: slot.due_date,
          status: "PROJECTED",
          state: preview.remaining <= 0 ? "covered" : "upcoming",
        });
      }
      return rows;
    });

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
      payment_method: entry.reference_type === "PAYMENT_ATTEMPT" ? "PHONEPE" : "OFFLINE",
      reference_number: entry.reference_id,
      notes: entry.notes,
    }));

    const timeline = [...items, ...paymentItems, ...rentAdvanceItems, ...projectedItems].sort((a: any, b: any) => {
      const aDate = new Date(a.due_date || a.period_start || 0).getTime();
      const bDate = new Date(b.due_date || b.period_start || 0).getTime();
      if (aDate !== bDate) return aDate - bDate;
      return String(a.timeline_id).localeCompare(String(b.timeline_id));
    });

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
    };
  }
}

export const billingTimelineService = new BillingTimelineService();
