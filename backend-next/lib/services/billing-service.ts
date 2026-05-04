import { prisma } from "../db";

const STARTER_FALLBACK = {
  id: null as string | null,
  code: "STARTER",
  name: "Starter",
  price_inr: 49900,
  tenant_limit: 25,
  hostel_limit: 1,
  features: ["1 Hostel", "Up to 25 tenants", "Payments & receipts"],
};

export class BillingService {
  async getActivePlan(ownerId: string) {
    const sub = await prisma.ownerSubscription.findUnique({
      where: { owner_id: ownerId },
      include: { plan: true },
    });
    if (!sub) return STARTER_FALLBACK;
    return {
      ...sub.plan,
      subscription_status: sub.status,
      end_date: sub.end_date,
    };
  }

  async getOwnerUsage(ownerId: string) {
    const plan = await this.getActivePlan(ownerId);
    const [tenantsUsed, hostelsUsed] = await Promise.all([
      prisma.tenant.count({ where: { owner_id: ownerId, status: { not: "LEFT" } } }),
      prisma.hostel.count({ where: { owner_id: ownerId, is_active: true } }),
    ]);

    return {
      tenants: { used: tenantsUsed, limit: plan.tenant_limit ?? null },
      hostels: { used: hostelsUsed, limit: plan.hostel_limit ?? null },
    };
  }

  async getSubscriptionDetails(ownerId: string) {
    const sub = await prisma.ownerSubscription.findUnique({
      where: { owner_id: ownerId },
      include: { plan: true },
    });

    const usage = await this.getOwnerUsage(ownerId);

    const invoices = await prisma.ownerInvoice.findMany({
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
    });

    const plan = sub?.plan ?? STARTER_FALLBACK;

    return {
      current_plan: {
        id: plan.id,
        name: plan.name,
        
        price: plan.price_inr / 100,
        price_inr: plan.price_inr,
        currency: "INR",
        tenant_limit: plan.tenant_limit,
        hostel_limit: plan.hostel_limit,
        features: plan.features,
      },
      subscription: {
        status: sub?.status ?? "FREE",
        start_date: sub?.start_date ?? null,
        end_date: sub?.end_date ?? null,
        auto_renew: sub?.auto_renew ?? false,
        renewal_required: sub?.status === "PAST_DUE" || sub?.status === "EXPIRED",
      },
      usage,
      billing_history: invoices.map((inv) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        amount: inv.amount_paise / 100,
        status: inv.status,
        billing_month: inv.billing_month,
        paid_at: inv.paid_at,
        created_at: inv.created_at,
      })),
    };
  }
}

export const billingService = new BillingService();
