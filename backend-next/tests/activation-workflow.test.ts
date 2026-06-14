import { describe, expect, it, vi, beforeEach } from "vitest";
import { ActivationWorkflowService } from "@/src/services/tenants/activation-workflow-service";
import { authOtpService } from "@/lib/services/auth/auth-otp-service";
import { tenantInvitationLifecycleService } from "@/src/services/tenants/tenant-invitation-lifecycle-service";
import { prisma } from "@/lib/db";

// Mock the database client
vi.mock("@/lib/db", () => {
  const mockPrisma = {
    tenants: {
      update: vi.fn(),
      findUnique: vi.fn().mockImplementation((args) => {
        return Promise.resolve({
          id: args?.where?.id || "tenant-1",
          advance_deposit: 5000,
          maintenance_charge: 1000,
          maintenance_type: "MONTHLY",
        });
      }),
    },
    profile: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    tenant_invitations: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    ruleVersion: {
      findFirst: vi.fn().mockResolvedValue({ id: "template-1", title: "Rules", content: {} } as any),
      findUnique: vi.fn().mockResolvedValue({ id: "template-1", title: "Rules", content: {} } as any),
      create: vi.fn().mockResolvedValue({ id: "template-1", title: "Rules", content: {} } as any),
    },
    agreementTemplate: {
      findFirst: vi.fn().mockResolvedValue({
        id: "template-1",
        version: "v1",
        title: "Agreement",
        custom_rules: [],
        owner_name: "Owner",
        owner_signature_url: "http://sig.com",
        rules_content: { categories: [] },
        type: "RESIDENCY",
        status: "PUBLISHED",
        version_number: 1,
        is_active: true,
      } as any),
      create: vi.fn().mockResolvedValue({
        id: "template-1",
        version: "v1",
        title: "Agreement",
        custom_rules: [],
        owner_name: "Owner",
        owner_signature_url: "http://sig.com",
        rules_content: { categories: [] },
        type: "RESIDENCY",
        status: "PUBLISHED",
        version_number: 1,
        is_active: true,
      } as any),
    },
    agreement: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    roomAllocation: {
      count: vi.fn(),
    },
    tenant_advance_ledger: {
      aggregate: vi.fn().mockImplementation((args) => {
        if (args?.where?.reference_type === "PAYMENT") {
          return Promise.resolve({ _sum: { amount: 0 } });
        }
        return Promise.resolve({ _sum: { amount: 5000 } });
      }),
    },
    rent_obligations: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    payments: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount_paid: 0 } }),
    },
    phoneVerificationOtp: {
      findFirst: vi.fn().mockResolvedValue({ status: "VERIFIED" }),
    },
    tenantPolicyAcceptance: {
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn((cb) => cb(mockPrisma)),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  };
  return { prisma: mockPrisma, supabase: {} };
});

vi.mock("@/src/services/tenants/tenant-invitation-lifecycle-service", () => ({
  tenantInvitationLifecycleService: {
    resolveByToken: vi.fn(),
    startActivation: vi.fn(),
  },
}));

vi.mock("@/lib/services/auth/auth-otp-service", () => ({
  authOtpService: {
    verifyPhoneOtp: vi.fn(),
  },
}));

vi.mock("@/lib/services/event-log-service", () => ({
  eventLog: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("ActivationWorkflowService OTP Hardening", () => {
  let activationService: ActivationWorkflowService;

  beforeEach(() => {
    vi.clearAllMocks();
    activationService = new ActivationWorkflowService();
  });

  it("should fail ACCOUNT step if no OTP is provided", async () => {
    const mockTenant = { id: "tenant-1", status: "INVITED", phone_1: "918008046952", hostel_id: "hostel-1" };
    const mockProfile = { id: "profile-1", phone: "918008046952" };
    const mockInvitation = { id: "invite-1", email: "tenant@example.com", phone: "918008046952" };

    vi.mocked(tenantInvitationLifecycleService.resolveByToken).mockResolvedValue({
      source: "tenant_invitations",
      invitation: mockInvitation,
      profile: mockProfile,
      tenant: mockTenant,
      token: "test-token",
    } as any);

    await expect(
      activationService.mutate("test-token", "ACCOUNT", { password: "Password123!", confirm_password: "Password123!" }, { ip: "127.0.0.1", userAgent: "test" })
    ).rejects.toThrow("VALIDATION_ERROR: Verification code is required to verify your mobile number");
  });

  it("should fail ACCOUNT step if OTP verification throws error", async () => {
    const mockTenant = { id: "tenant-1", status: "INVITED", phone_1: "918008046952", hostel_id: "hostel-1" };
    const mockProfile = { id: "profile-1", phone: "918008046952" };
    const mockInvitation = { id: "invite-1", email: "tenant@example.com", phone: "918008046952" };

    vi.mocked(tenantInvitationLifecycleService.resolveByToken).mockResolvedValue({
      source: "tenant_invitations",
      invitation: mockInvitation,
      profile: mockProfile,
      tenant: mockTenant,
      token: "test-token",
    } as any);

    vi.mocked(authOtpService.verifyPhoneOtp).mockRejectedValueOnce(new Error("Invalid code"));

    await expect(
      activationService.mutate("test-token", "ACCOUNT", { password: "Password123!", confirm_password: "Password123!", otp: "123456" }, { ip: "127.0.0.1", userAgent: "test" })
    ).rejects.toThrow("VALIDATION_ERROR: Mobile verification failed: Invalid code");
  });

  it("should succeed ACCOUNT step if valid OTP is provided", async () => {
    const mockTenant = {
      id: "tenant-1",
      status: "INVITED",
      phone_1: "918008046952",
      hostel_id: "hostel-1",
      hostels: { name: "Hostel 1", rent_cycle: "MONTHLY", auto_rent_day: 1, preferences: {} },
      rule_acceptances: [],
      agreements: [],
      room_allocations: [],
    };
    const mockProfile = { id: "profile-1", phone: "918008046952" };
    const mockInvitation = { id: "invite-1", email: "tenant@example.com", phone: "918008046952", reservations: [] };

    vi.mocked(tenantInvitationLifecycleService.resolveByToken).mockResolvedValue({
      source: "tenant_invitations",
      invitation: mockInvitation,
      profile: mockProfile,
      tenant: mockTenant,
      token: "test-token",
    } as any);

    vi.mocked(prisma.roomAllocation.count).mockResolvedValue(0);
    vi.mocked(prisma.ruleVersion.findFirst).mockResolvedValue({ id: "rule-1", title: "Rules", content: {} } as any);
    vi.mocked(prisma.agreementTemplate.findFirst).mockResolvedValue({
      id: "template-1",
      title: "Agreement",
      custom_rules: [],
      owner_name: "Owner",
      owner_signature_url: "http://sig.com",
    } as any);
    vi.mocked(prisma.agreement.create).mockResolvedValue({
      id: "agreement-1",
      status: "DRAFT",
      content_snapshot: {},
    } as any);

    vi.mocked(authOtpService.verifyPhoneOtp).mockResolvedValue(true as any);

    // Run mutate and check that it doesn't throw
    const res = await activationService.mutate("test-token", "ACCOUNT", { password: "Password123!", confirm_password: "Password123!", otp: "123456", email: "tenant@gmail.com" }, { ip: "127.0.0.1", userAgent: "test" });
    expect(res).toBeDefined();
    expect(authOtpService.verifyPhoneOtp).toHaveBeenCalledWith({
      phone: "+918008046952",
      otp: "123456",
      purpose: "Registration",
      requestIp: null,
    });
  });

  it("should succeed on ACCOUNT step even if no password is provided", async () => {
    const mockTenant = {
      id: "tenant-1",
      status: "INVITED",
      phone_1: "918008046952",
      hostel_id: "hostel-1",
      hostels: { name: "Hostel 1", rent_cycle: "MONTHLY", auto_rent_day: 1, preferences: {} },
      rule_acceptances: [],
      agreements: [],
      room_allocations: [],
    };
    const mockProfile = { id: "profile-1", phone: "918008046952" };
    const mockInvitation = { id: "invite-1", email: "tenant@example.com", phone: "918008046952", reservations: [] };

    vi.mocked(tenantInvitationLifecycleService.resolveByToken).mockResolvedValue({
      source: "tenant_invitations",
      invitation: mockInvitation,
      profile: mockProfile,
      tenant: mockTenant,
      token: "test-token",
    } as any);

    vi.mocked(prisma.roomAllocation.count).mockResolvedValue(0);
    vi.mocked(prisma.ruleVersion.findFirst).mockResolvedValue({ id: "rule-1", title: "Rules", content: {} } as any);
    vi.mocked(prisma.agreementTemplate.findFirst).mockResolvedValue({
      id: "template-1",
      title: "Agreement",
      custom_rules: [],
      owner_name: "Owner",
      owner_signature_url: "http://sig.com",
    } as any);
    vi.mocked(prisma.agreement.create).mockResolvedValue({
      id: "agreement-1",
      status: "DRAFT",
      content_snapshot: {},
    } as any);

    vi.mocked(authOtpService.verifyPhoneOtp).mockResolvedValue(true as any);

    const res = await activationService.mutate("test-token", "ACCOUNT", { otp: "123456", email: "tenant@gmail.com" }, { ip: "127.0.0.1", userAgent: "test" });
    expect(res).toBeDefined();
  });
});
