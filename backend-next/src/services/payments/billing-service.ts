import { prisma } from "@/lib/db";
import { overflowBillingService } from "@/lib/services/overflow-billing-service";

const FREE_FALLBACK = {
  id: "FREE" as string | null,
  name: "Free",
  price_inr: 0,
  tenant_limit: 15,
  hostel_limit: 1,
  automation: false,
  multi_hostel: false,
  analytics: false,
  can_generate_receipts: false,
};

export class BillingService {
  private isSchemaDriftError(error: any) {
    if (error?.code === 'P2022') return true;
    const msg = String(error?.message || error || '');
    return /column \S+ does not exist|column .* does not exist/i.test(msg);
  }

  private parseOverflowFlags(plan: any) {
    const features = (plan as any)?.features && typeof (plan as any).features === "object"
      ? (plan as any).features
      : {};
    return {
      overflow_enabled: Boolean((plan as any).overflow_enabled ?? features.overflow_enabled ?? false),
      overflow_price_per_tenant_paise: Number((plan as any).overflow_price_per_tenant_paise ?? features.overflow_price_per_tenant_paise ?? 0),
      overflow_hard_cap: Number((plan as any).overflow_hard_cap ?? features.overflow_hard_cap ?? 0),
    };
  }

  async getActivePlan(ownerId: string) {
    const sub = await prisma.owner_subscriptions.findUnique({
      where: { owner_id: ownerId },
      include: {
        plans: {
          select: {
            id: true,
            name: true,
            price_inr: true,
            tenant_limit: true,
            hostel_limit: true,
            automation: true,
            multi_hostel: true,
            analytics: true,
            can_generate_receipts: true,
            features: true,
          },
        },
      },
    });
    if (!sub) return FREE_FALLBACK;
    return {
      ...sub.plans,
      subscription_status: sub.status,
      end_date: sub.end_date,
    };
  }

  async getOwnerUsage(ownerId: string) {
    const plan = await this.getActivePlan(ownerId);
    const [tenantsUsed, hostelsUsed] = await Promise.all([
      prisma.tenants.count({ where: { owner_id: ownerId, status: { not: "LEFT" } } }),
      prisma.hostels.count({ where: { owner_id: ownerId, is_active: true } }),
    ]);

    return {
      tenants: { used: tenantsUsed, limit: plan.tenant_limit ?? null },
      hostels: { used: hostelsUsed, limit: plan.hostel_limit ?? null },
    };
  }

  async getSubscriptionDetails(ownerId: string) {
    const sub = await prisma.owner_subscriptions.findUnique({
      where: { owner_id: ownerId },
      include: {
        plans: {
          select: {
            id: true,
            name: true,
            price_inr: true,
            tenant_limit: true,
            hostel_limit: true,
            automation: true,
            multi_hostel: true,
            analytics: true,
            can_generate_receipts: true,
            features: true,
          },
        },
      },
    });

    const plan = sub?.plans ?? FREE_FALLBACK;

    const [usage, overflowStatus, invoices] = await Promise.all([
      this.getOwnerUsage(ownerId),
      overflowBillingService.getOverflowStatus(ownerId).catch((err: any) => {
        if (this.isSchemaDriftError(err)) {
          return {
            enabled: false,
            plan_id: plan.id || "FREE",
            active_tenants: 0,
            included_limit: plan.tenant_limit || 0,
            overflow_count: 0,
            overflow_amount_paise: 0,
            hard_cap: plan.tenant_limit || 0,
            percentage_of_included: 0,
            percentage_of_hard_cap: 0,
            threshold: "SAFE",
            upgrade_nudge: {
              show: false,
              recommended_plan: null,
              monthly_overflow_cost: 0,
              plan_price_gap: 0,
              message: null,
            },
          };
        }
        throw err;
      }),
      prisma.ownerInvoice.findMany({
        where: { owner_id: ownerId },
        orderBy: { created_at: "desc" },
        take: 12,
        select: {
          id: true,
          invoice_number: true,
          amount_paise: true,
          status: true,
          billing_month: true,
          paid_at: true,
          created_at: true,
        },
      }),
    ]);

    const overflow = this.parseOverflowFlags(plan);

    return {
      current_plan: {
        id: plan.id,
        name: plan.name,
        price: plan.price_inr / 100,
        price_inr: plan.price_inr,
        currency: "INR",
        tenant_limit: plan.tenant_limit,
        hostel_limit: plan.hostel_limit,
        automation: plan.automation,
        multi_hostel: plan.multi_hostel,
        analytics: plan.analytics,
        can_generate_receipts: (plan as any).can_generate_receipts ?? false,
        overflow_enabled: overflow.overflow_enabled,
        overflow_price_per_tenant_paise: overflow.overflow_price_per_tenant_paise,
        overflow_hard_cap: overflow.overflow_hard_cap,
      },
      subscription: {
        status: sub?.status ?? "FREE",
        start_date: sub?.start_date ?? null,
        end_date: sub?.end_date ?? null,
        auto_renew: sub?.auto_renew ?? false,
        renewal_required: sub?.status === "PAST_DUE" || sub?.status === "EXPIRED",
      },
      usage,
      overflow: overflowStatus,
      billing_history: invoices.map((inv) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        amount: inv.amount_paise / 100,
        status: inv.status,
        billing_month: inv.billing_month,
        paid_at: inv.paid_at,
        created_at: inv.created_at,
        line_items: (inv as any).line_items ?? null,
      })),
    };
  }
}

export const billingService = new BillingService();
