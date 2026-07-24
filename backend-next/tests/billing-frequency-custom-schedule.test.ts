import { describe, expect, it, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { createTestOwner, createTestHostel } from "./factories/owner-factory";
import { createTestTenant, createTestAgreement } from "./factories/tenant-factory";
import { createTestObligation } from "./factories/payment-factory";
import { billingTransitionService } from "@/lib/services/billing-transition-service";

function daysFromNow(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

describe("BillingTransitionService.ownerSetCustomSchedule — owner-defined custom installments", () => {
  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE "test"."profiles" CASCADE`;
  });

  async function createFixture(tenantOverrides: any = {}) {
    const owner = await createTestOwner();
    const hostel = await createTestHostel(owner.id);
    const tenant = await createTestTenant(owner.id, hostel.id, { monthly_rent: 8500, ...tenantOverrides });
    return { owner, hostel, tenant };
  }

  it("creates exactly the specified installments and stamps the tenant/billing plan as CUSTOM_INSTALLMENTS", async () => {
    const { owner, tenant } = await createFixture();

    const result = await billingTransitionService.ownerSetCustomSchedule(owner.id, tenant.id, {
      installments: [
        { due_date: daysFromNow(10), amount: 15000, label: "Move-in installment" },
        { due_date: daysFromNow(70), amount: 10000 },
        { due_date: daysFromNow(130), amount: 12000 },
      ],
      reason: "Tenant requested a custom schedule",
    });

    expect(result.obligations_created).toBe(3);
    expect(result.billing_plan.frequency).toBe("CUSTOM_INSTALLMENTS");
    expect(result.request.status).toBe("APPROVED");

    const rows = await prisma.rent_obligations.findMany({
      where: { tenant_id: tenant.id, is_superseded: false },
      orderBy: { due_date: "asc" },
    });
    expect(rows).toHaveLength(3);
    expect(Number(rows[0].amount)).toBe(15000);
    expect(rows[0].installment_label).toBe("Move-in installment");
    expect(rows[0].status).toBe("UPCOMING");
    expect(Number(rows[1].amount)).toBe(10000);
    expect(Number(rows[2].amount)).toBe(12000);

    const updatedTenant = await prisma.tenants.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(updatedTenant.payment_frequency).toBe("CUSTOM_INSTALLMENTS");
  });

  it("supersedes future UPCOMING obligations at/after the first installment date, leaving earlier ones untouched", async () => {
    const { owner, hostel, tenant } = await createFixture();

    const earlierUpcoming = await createTestObligation(tenant.id, owner.id, hostel.id, {
      obligation_type: "RENT",
      status: "UPCOMING",
      due_date: new Date(daysFromNow(5)),
      rent_month: new Date(daysFromNow(5)),
    });
    const laterUpcoming = await createTestObligation(tenant.id, owner.id, hostel.id, {
      obligation_type: "RENT",
      status: "UPCOMING",
      due_date: new Date(daysFromNow(40)),
      rent_month: new Date(daysFromNow(40)),
    });

    await billingTransitionService.ownerSetCustomSchedule(owner.id, tenant.id, {
      installments: [{ due_date: daysFromNow(20), amount: 9000 }],
    });

    const earlierRow = await prisma.rent_obligations.findUniqueOrThrow({ where: { id: earlierUpcoming.id } });
    const laterRow = await prisma.rent_obligations.findUniqueOrThrow({ where: { id: laterUpcoming.id } });
    expect(earlierRow.is_superseded).toBe(false);
    expect(laterRow.is_superseded).toBe(true);
  });

  it("rejects an empty installment list", async () => {
    const { owner, tenant } = await createFixture();
    await expect(
      billingTransitionService.ownerSetCustomSchedule(owner.id, tenant.id, { installments: [] })
    ).rejects.toThrow("VALIDATION_ERROR");
  });

  it("rejects a non-positive amount", async () => {
    const { owner, tenant } = await createFixture();
    await expect(
      billingTransitionService.ownerSetCustomSchedule(owner.id, tenant.id, {
        installments: [{ due_date: daysFromNow(10), amount: 0 }],
      })
    ).rejects.toThrow("VALIDATION_ERROR");
  });

  it("rejects a due date in the past", async () => {
    const { owner, tenant } = await createFixture();
    await expect(
      billingTransitionService.ownerSetCustomSchedule(owner.id, tenant.id, {
        installments: [{ due_date: daysFromNow(-5), amount: 5000 }],
      })
    ).rejects.toThrow("VALIDATION_ERROR");
  });

  it("rejects duplicate installment dates", async () => {
    const { owner, tenant } = await createFixture();
    await expect(
      billingTransitionService.ownerSetCustomSchedule(owner.id, tenant.id, {
        installments: [
          { due_date: daysFromNow(10), amount: 5000 },
          { due_date: daysFromNow(10), amount: 6000 },
        ],
      })
    ).rejects.toThrow("VALIDATION_ERROR");
  });

  it("rejects more than 24 installments", async () => {
    const { owner, tenant } = await createFixture();
    const installments = Array.from({ length: 25 }, (_, i) => ({ due_date: daysFromNow(10 + i), amount: 1000 }));
    await expect(
      billingTransitionService.ownerSetCustomSchedule(owner.id, tenant.id, { installments })
    ).rejects.toThrow("VALIDATION_ERROR");
  });

  it("blocks the change when a real in-flight PENDING obligation falls on/after the first installment date", async () => {
    const { owner, hostel, tenant } = await createFixture();

    await createTestObligation(tenant.id, owner.id, hostel.id, {
      obligation_type: "RENT",
      status: "PENDING",
      due_date: new Date(daysFromNow(15)),
      rent_month: new Date(daysFromNow(15)),
    });

    await expect(
      billingTransitionService.ownerSetCustomSchedule(owner.id, tenant.id, {
        installments: [{ due_date: daysFromNow(10), amount: 9000 }],
      })
    ).rejects.toThrow("UNCLEAN_BILLING_PERIOD");
  });

  it("handles agreement-based tenants with pre-existing obligations without unique constraint failure", async () => {
    const { owner, hostel, tenant } = await createFixture();
    const agreement = await createTestAgreement(tenant.id, hostel.id);

    // Pre-create an obligation linked to the agreement with a rent_month in month 10
    const rentMonth10 = new Date(daysFromNow(10));
    await createTestObligation(tenant.id, owner.id, hostel.id, {
      agreement_id: agreement.id,
      obligation_type: "RENT",
      status: "UPCOMING",
      due_date: rentMonth10,
      rent_month: new Date(Date.UTC(rentMonth10.getUTCFullYear(), rentMonth10.getUTCMonth(), 1)),
    });

    const result = await billingTransitionService.ownerSetCustomSchedule(owner.id, tenant.id, {
      installments: [
        { due_date: daysFromNow(10), amount: 33500, label: "Installment 1" },
        { due_date: daysFromNow(40), amount: 33500, label: "Installment 2" },
      ],
      reason: "Agreement custom installments test",
    });

    expect(result.obligations_created).toBe(2);
    expect(result.billing_plan.frequency).toBe("CUSTOM_INSTALLMENTS");

    const rows = await prisma.rent_obligations.findMany({
      where: { tenant_id: tenant.id, is_superseded: false },
      orderBy: { due_date: "asc" },
    });
    expect(rows).toHaveLength(2);
    expect(Number(rows[0].amount)).toBe(33500);
    expect(rows[0].installment_label).toBe("Installment 1");
    expect(Number(rows[1].amount)).toBe(33500);
    expect(rows[1].installment_label).toBe("Installment 2");
  });
});
