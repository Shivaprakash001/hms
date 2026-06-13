import { prisma } from "@/lib/db";
import { getLogger } from "@/lib/logger";

const logger = getLogger("onboarding-financials");

export type OnboardingFinancialInitResult = {
  createdObligations: string[];
  skipped: boolean;
  reason?: string;
};

type Tx = typeof prisma;

function money(value: unknown) {
  const number = Number(value || 0);
  return Math.round((Number.isFinite(number) ? number : 0) * 100) / 100;
}

function rentMonthFor(date: Date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1));
}

export class OnboardingFinancialsService {
  async initializeOnboardingFinancials(
    tx: Tx,
    params: {
      tenantId: string;
      ownerId: string;
      hostelId: string;
      joiningDate: Date;
      maintenanceCharge: number;
      maintenanceType: string;
    }
  ): Promise<OnboardingFinancialInitResult> {
    const tenantId = String(params.tenantId || "").trim();
    const ownerId = String(params.ownerId || "").trim();
    const hostelId = String(params.hostelId || "").trim();
    const joiningDate = params.joiningDate instanceof Date ? params.joiningDate : new Date(params.joiningDate);
    const maintenanceType = String(params.maintenanceType || "MONTHLY").toUpperCase();
    const maintenanceCharge = money(params.maintenanceCharge);

    if (!tenantId) throw new Error("VALIDATION_ERROR: tenantId is required");
    if (!ownerId) throw new Error("VALIDATION_ERROR: ownerId is required");
    if (!hostelId) throw new Error("VALIDATION_ERROR: hostelId is required");
    if (Number.isNaN(joiningDate.getTime())) throw new Error("VALIDATION_ERROR: joiningDate is invalid");
    if (maintenanceCharge < 0) throw new Error("VALIDATION_ERROR: maintenanceCharge cannot be negative");

    const tenant = await tx.tenants.findUnique({
      where: { id: tenantId },
      select: { id: true, owner_id: true, hostel_id: true, status: true },
    });
    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");
    if (tenant.owner_id !== ownerId || tenant.hostel_id !== hostelId) {
      throw new Error("FORBIDDEN: Tenant does not match onboarding financial scope");
    }
    if (tenant.status !== "INVITED") {
      return { createdObligations: [], skipped: true, reason: "TENANT_NOT_INVITED" };
    }
    if (maintenanceType === "NONE" || maintenanceCharge <= 0) {
      return { createdObligations: [], skipped: true, reason: "NO_MAINTENANCE_REQUIRED" };
    }

    await tx.$queryRaw`SELECT id FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;

    const rentMonth = rentMonthFor(joiningDate);
    const existing = await tx.rent_obligations.findFirst({
      where: {
        tenant_id: tenantId,
        rent_month: rentMonth,
        obligation_type: "MAINTENANCE",
        is_superseded: false,
      },
      select: { id: true },
    });
    if (existing) {
      return { createdObligations: [], skipped: true, reason: "MAINTENANCE_EXISTS" };
    }

    await tx.rent_obligations.create({
      data: {
        tenant_id: tenantId,
        allocation_id: null,
        owner_id: ownerId,
        hostel_id: hostelId,
        rent_month: rentMonth,
        amount: maintenanceCharge,
        total_amount: maintenanceCharge,
        due_date: joiningDate,
        status: "PENDING",
        obligation_type: "MAINTENANCE",
        billing_period_start: joiningDate,
        billing_period_end: joiningDate,
        installment_label: "Onboarding maintenance",
      },
    });

    logger.info("onboarding.maintenance_obligation_created", {
      tenant_id: tenantId,
      hostel_id: hostelId,
      amount: maintenanceCharge,
      maintenance_type: maintenanceType,
    });

    return { createdObligations: ["MAINTENANCE"], skipped: false };
  }
}

export const onboardingFinancialsService = new OnboardingFinancialsService();
