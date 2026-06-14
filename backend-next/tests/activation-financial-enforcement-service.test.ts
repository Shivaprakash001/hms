import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ActivationFinancialEnforcementError,
  ActivationFinancialEnforcementService,
} from "@/src/services/tenants/activation-financial-enforcement-service";
import { activationFinancialStatusService } from "@/src/services/tenants/activation-financial-status-service";

vi.mock("@/src/services/tenants/activation-financial-status-service", () => ({
  activationFinancialStatusService: {
    getActivationFinancialStatus: vi.fn(),
  },
}));

const readyStatus = {
  requiredDeposit: 10000,
  paidDeposit: 10000,
  depositOutstanding: 0,
  requiredMaintenance: 1000,
  paidMaintenance: 1000,
  maintenanceOutstanding: 0,
  isDepositCleared: true,
  isMaintenanceCleared: true,
  isFinanciallyReady: true,
};

describe("ActivationFinancialEnforcementService", () => {
  let service: ActivationFinancialEnforcementService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ActivationFinancialEnforcementService();
  });

  it("blocks activation when deposit is outstanding", async () => {
    vi.mocked(activationFinancialStatusService.getActivationFinancialStatus).mockResolvedValue({
      ...readyStatus,
      paidDeposit: 4000,
      depositOutstanding: 6000,
      isDepositCleared: false,
      isFinanciallyReady: false,
    });

    await expect(service.assertActivationFinancialReady("tenant-1")).rejects.toMatchObject({
      code: "DEPOSIT_OUTSTANDING",
      status: 409,
      details: {
        requiredDeposit: 10000,
        paidDeposit: 4000,
        outstandingDeposit: 6000,
      },
    });
  });

  it("blocks activation when maintenance is outstanding", async () => {
    vi.mocked(activationFinancialStatusService.getActivationFinancialStatus).mockResolvedValue({
      ...readyStatus,
      paidMaintenance: 0,
      maintenanceOutstanding: 1000,
      isMaintenanceCleared: false,
      isFinanciallyReady: false,
    });

    await expect(service.assertActivationFinancialReady("tenant-1")).rejects.toMatchObject({
      code: "MAINTENANCE_OUTSTANDING",
      status: 409,
      details: {
        requiredMaintenance: 1000,
        paidMaintenance: 0,
        outstandingMaintenance: 1000,
      },
    });
  });

  it("blocks activation with complete payload when both are outstanding", async () => {
    const incomplete = {
      ...readyStatus,
      paidDeposit: 0,
      depositOutstanding: 10000,
      paidMaintenance: 0,
      maintenanceOutstanding: 1000,
      isDepositCleared: false,
      isMaintenanceCleared: false,
      isFinanciallyReady: false,
    };
    vi.mocked(activationFinancialStatusService.getActivationFinancialStatus).mockResolvedValue(incomplete);

    await expect(service.assertActivationFinancialReady("tenant-1")).rejects.toMatchObject({
      code: "ONBOARDING_FINANCIALS_INCOMPLETE",
      status: 409,
      details: incomplete,
    });
  });

  it("returns readiness when deposit and maintenance are cleared", async () => {
    vi.mocked(activationFinancialStatusService.getActivationFinancialStatus).mockResolvedValue(readyStatus);

    await expect(service.assertActivationFinancialReady("tenant-1")).resolves.toEqual(readyStatus);
  });

  it("uses a structured error type", () => {
    const error = new ActivationFinancialEnforcementError("DEPOSIT_OUTSTANDING", "Deposit due", { outstandingDeposit: 1 });

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("DEPOSIT_OUTSTANDING");
    expect(error.status).toBe(409);
    expect(error.details).toEqual({ outstandingDeposit: 1 });
  });
});
