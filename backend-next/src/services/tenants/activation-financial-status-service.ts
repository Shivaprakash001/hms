import { prisma } from "@/lib/db";

export type ActivationFinancialStatus = {
  requiredDeposit: number;
  paidDeposit: number;
  depositOutstanding: number;
  requiredMaintenance: number;
  paidMaintenance: number;
  maintenanceOutstanding: number;
  isDepositCleared: boolean;
  isMaintenanceCleared: boolean;
  isFinanciallyReady: boolean;
};

function money(value: unknown) {
  const number = Number(value || 0);
  return Math.round((Number.isFinite(number) ? number : 0) * 100) / 100;
}

function outstanding(required: number, paid: number) {
  return money(Math.max(0, required - paid));
}

export class ActivationFinancialStatusService {
  async getActivationFinancialStatus(tenantId: string): Promise<ActivationFinancialStatus> {
    const id = String(tenantId || "").trim();
    if (!id) throw new Error("VALIDATION_ERROR: tenantId is required");

    const tenant = await prisma.tenants.findUnique({
      where: { id },
      select: {
        id: true,
        advance_deposit: true,
        maintenance_charge: true,
        maintenance_type: true,
      },
    });
    if (!tenant) throw new Error("NOT_FOUND: Tenant not found");

    const [depositCredits, maintenanceObligations, paidAdvanceObligations, ledgerDepositPayments] = await Promise.all([
      prisma.tenant_advance_ledger.aggregate({
        where: {
          tenant_id: id,
          type: "CREDIT",
          reason: "DEPOSIT",
        },
        _sum: { amount: true },
      }),
      prisma.rent_obligations.findMany({
        where: {
          tenant_id: id,
          obligation_type: "MAINTENANCE",
          is_superseded: false,
        },
        select: {
          payments: {
            select: { amount_paid: true },
          },
        },
      }),
      prisma.payments.aggregate({
        where: {
          tenant_id: id,
          obligation: {
            obligation_type: "ADVANCE",
          },
        },
        _sum: {
          amount_paid: true,
        },
      }),
      prisma.tenant_advance_ledger.aggregate({
        where: {
          tenant_id: id,
          type: "CREDIT",
          reason: "DEPOSIT",
          reference_type: "PAYMENT",
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    const requiredDeposit = money(tenant.advance_deposit);
    const paidAdvanceObligationSum = Number(paidAdvanceObligations?._sum?.amount_paid || 0);
    const ledgerDepositPaymentsSum = Number(ledgerDepositPayments?._sum?.amount || 0);
    const paidAdvanceObligationSumOutsideLedger = Math.max(0, paidAdvanceObligationSum - ledgerDepositPaymentsSum);

    const paidDeposit = money(Number(depositCredits._sum.amount || 0) + paidAdvanceObligationSumOutsideLedger);
    const depositOutstanding = outstanding(requiredDeposit, paidDeposit);

    const maintenanceType = String(tenant.maintenance_type || "MONTHLY").toUpperCase();
    const requiredMaintenance = maintenanceType === "NONE" ? 0 : money(tenant.maintenance_charge);
    const paidMaintenance = money(
      maintenanceObligations.reduce((sum: number, obligation: any) => {
        const payments = Array.isArray(obligation.payments) ? obligation.payments : [];
        return sum + payments.reduce((paid: number, payment: any) => paid + Number(payment.amount_paid || 0), 0);
      }, 0)
    );
    const maintenanceOutstanding = outstanding(requiredMaintenance, paidMaintenance);

    const isDepositCleared = depositOutstanding <= 0;
    const isMaintenanceCleared = maintenanceOutstanding <= 0;

    return {
      requiredDeposit,
      paidDeposit,
      depositOutstanding,
      requiredMaintenance,
      paidMaintenance,
      maintenanceOutstanding,
      isDepositCleared,
      isMaintenanceCleared,
      isFinanciallyReady: isDepositCleared && isMaintenanceCleared,
    };
  }
}

export const activationFinancialStatusService = new ActivationFinancialStatusService();

export function getActivationFinancialStatus(tenantId: string) {
  return activationFinancialStatusService.getActivationFinancialStatus(tenantId);
}
