import { prisma } from "@/lib/db";

export class PaymentLinkService {
  /**
   * Finds or creates an active payment link token for a tenant or obligation.
   * - If `tenantId` is provided, resolves to their oldest unpaid/partially paid obligation.
   * - If `obligationId` is provided, uses that specific obligation.
   */
  static async getOrCreateToken(params: {
    obligationId?: string;
    tenantId?: string;
  }): Promise<{ token: string; expiresAt: Date }> {
    const { obligationId, tenantId } = params;

    if (!obligationId && !tenantId) {
      throw new Error("Either obligationId or tenantId must be provided");
    }

    let targetObligationId = obligationId;
    let targetTenantId = tenantId;

    // 1. Resolve tenantId to oldest unpaid obligation
    if (tenantId && !obligationId) {
      const obligation = await prisma.rent_obligations.findFirst({
        where: {
          tenant_id: tenantId,
          status: { in: ["PENDING", "PARTIAL"] },
          is_superseded: false,
        },
        orderBy: { billing_period_start: "asc" },
      });

      if (!obligation) {
        throw new Error("No outstanding rent obligations found for this tenant");
      }
      targetObligationId = obligation.id;
    }

    // 2. Resolve obligationId to targetTenantId
    if (targetObligationId && !targetTenantId) {
      const obligation = await prisma.rent_obligations.findUnique({
        where: { id: targetObligationId },
        select: { tenant_id: true },
      });
      if (!obligation) {
        throw new Error("Obligation not found");
      }
      targetTenantId = obligation.tenant_id;
    }

    if (!targetObligationId || !targetTenantId) {
      throw new Error("Could not resolve tenant and obligation");
    }

    // 3. Check for existing non-expired token
    const existing = await prisma.payment_link_tokens.findFirst({
      where: {
        obligation_id: targetObligationId,
        tenant_id: targetTenantId,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: "desc" },
    });

    if (existing) {
      return {
        token: existing.token,
        expiresAt: existing.expires_at,
      };
    }

    // 4. Retrieve host and owner information from the obligation
    const obligation = await prisma.rent_obligations.findUnique({
      where: { id: targetObligationId },
      include: {
        tenants: {
          select: { owner_id: true },
        },
      },
    });

    if (!obligation) {
      throw new Error("Obligation not found");
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // 5. Create new payment link token
    const created = await prisma.payment_link_tokens.create({
      data: {
        obligation_id: targetObligationId,
        tenant_id: targetTenantId,
        host_id: obligation.hostel_id,
        owner_id: obligation.owner_id || obligation.tenants?.owner_id || null,
        expires_at: expiresAt,
      },
      select: { token: true, expires_at: true },
    });

    return {
      token: created.token,
      expiresAt: created.expires_at,
    };
  }
}
