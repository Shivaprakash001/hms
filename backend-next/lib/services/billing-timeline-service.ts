import { prisma } from "@/lib/db";

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
    const tenant = await prisma.tenants.findFirst({
      where: { id: tenantId, ...(ownerId ? { owner_id: ownerId } : {}) },
      select: {
        id: true,
        owner_id: true,
        hostel_id: true,
        payment_frequency: true,
        payment_frequency_effective_from: true,
        payment_frequency_updated_at: true,
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

    const items = obligations.map((ob: any) => {
      const paid = money((ob.payments || []).reduce((s: number, p: any) => s + Number(p.amount_paid || 0), 0));
      const amount = money(ob.amount);
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

    return {
      tenant_id: tenant.id,
      active_frequency: tenant.payment_frequency || "MONTHLY",
      effective_from: tenant.payment_frequency_effective_from,
      updated_at: tenant.payment_frequency_updated_at,
      plans: tenant.tenant_billing_plans,
      requests: tenant.payment_frequency_change_requests,
      items,
    };
  }
}

export const billingTimelineService = new BillingTimelineService();
