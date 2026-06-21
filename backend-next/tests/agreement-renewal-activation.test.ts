import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  agreementFindMany: vi.fn(),
  agreementUpdate: vi.fn(),
  eventLogLog: vi.fn(),
  transaction: vi.fn(async (cb: any) => cb({
    agreement: { update: mocks.agreementUpdate },
  })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    agreement: {
      findMany: mocks.agreementFindMany,
      update: mocks.agreementUpdate,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/cache/dashboard-cache", () => ({
  invalidateHostelDashboardCache: vi.fn(),
  invalidateOwnerDashboardCache: vi.fn(),
}));

vi.mock("@/lib/services/event-log-service", () => ({
  eventLog: { log: mocks.eventLogLog },
}));

vi.mock("@/lib/services/notification-service", () => ({
  notificationService: { createNotification: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("./agreement-renewal-notification-service", () => ({
  agreementRenewalNotificationService: {
    checkTemplatesHealth: vi.fn().mockResolvedValue([]),
    processRenewalNotifications: vi.fn().mockResolvedValue(undefined),
  },
}));

import { AgreementLifecycleService } from "@/src/services/tenants/agreement-lifecycle-service";

describe("AgreementRenewalActivation", () => {
  let service: AgreementLifecycleService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AgreementLifecycleService();
  });

  it("activates scheduled renewals when the effective date arrives and there are no unpaid deposits", async () => {
    const today = new Date("2026-07-01T00:00:00.000Z");

    const mockDraft = {
      id: "draft-agreement-id",
      tenant_id: "tenant-id",
      hostel_id: "hostel-id",
      status: "DRAFT",
      agreement_start_date: today,
      agreement_end_date: new Date("2027-06-30T00:00:00.000Z"),
      agreement_duration_months: 12,
      contract_rent: 8500,
      contract_security_deposit: 6000,
      contract_maintenance: 1000,
      contract_maintenance_type: "MONTHLY",
      contract_payment_frequency: "MONTHLY",
      template_id: "template-id",
      content_snapshot: {
        source: "renewal_offer",
        renewal_offer_id: "offer-id",
      },
      tenant: {
        owner_id: "owner-id",
        profiles: { name: "Adithya" },
        rent_obligations: [], // no unpaid deposit obligations
      },
      template: {
        owner_signature_url: "owner-signature-template",
        owner_name: "Owner Name",
        rules_content: { rules: [] },
        version_number: 1,
      },
      renewed_from_agreement: {
        id: "predecessor-agreement-id",
        tenant_signature_url: "tenant-signature-predecessor",
        tenant_signature_name: "Tenant Name",
        tenant_signed_at: new Date("2026-01-01T00:00:00.000Z"),
        tenant_ip: "127.0.0.1",
        tenant_user_agent: "Mozilla",
        guardian_signature_url: "guardian-signature-predecessor",
        guardian_signature_name: "Guardian Name",
        guardian_relation: "Father",
        guardian_signed_at: new Date("2026-01-01T00:00:00.000Z"),
        guardian_ip: "127.0.0.1",
        guardian_user_agent: "Mozilla",
        owner_signature_url: "owner-signature-predecessor",
        owner_signature_name: "Owner Name",
        rules_snapshot: { rules: ["Existing Rules"] },
        rule_version_id: "rule-v1",
        rule_version_number: "v1",
        content_snapshot: {
          tenant_name: "Adithya",
          room_no: "101",
        },
      },
    };

    mocks.agreementFindMany.mockResolvedValue([mockDraft]);

    const summary = {
      checked: 0,
      marked_expiring: 0,
      marked_expired: 0,
      reminders_30d: 0,
      reminders_15d: 0,
      expiry_notifications: 0,
      skipped_legacy: 0,
      failed: 0,
      errors: [],
      renewals_activated: 0,
    };

    const touchedOwnerIds = new Set<string>();
    const touchedHostelIds = new Set<string>();

    await service.activateScheduledRenewals(today, summary, touchedOwnerIds, touchedHostelIds);

    expect(summary.renewals_activated).toBe(1);
    expect(summary.failed).toBe(0);
    expect(touchedOwnerIds.has("owner-id")).toBe(true);
    expect(touchedHostelIds.has("hostel-id")).toBe(true);

    // Verify transaction updates predecessor to RENEWED
    expect(mocks.agreementUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "predecessor-agreement-id" },
        data: expect.objectContaining({ status: "RENEWED" }),
      })
    );

    // Verify transaction updates draft to SIGNED with copied credentials
    expect(mocks.agreementUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "draft-agreement-id" },
        data: expect.objectContaining({
          status: "SIGNED",
          tenant_signature_url: "tenant-signature-predecessor",
          tenant_signature_name: "Tenant Name",
          tenant_signed_at: mockDraft.renewed_from_agreement.tenant_signed_at,
          tenant_ip: "127.0.0.1",
          tenant_user_agent: "Mozilla",
          owner_signature_url: "owner-signature-predecessor",
          owner_signature_name: "Owner Name",
          rules_snapshot: { rules: ["Existing Rules"] },
          rule_version_id: "rule-v1",
          rule_version_number: "v1",
        }),
      })
    );

    // Verify content snapshot was merged with predecessor details
    const updateCall = mocks.agreementUpdate.mock.calls.find(
      (call: any) => call[0].where.id === "draft-agreement-id"
    );
    expect(updateCall).toBeDefined();
    expect(updateCall[0].data.content_snapshot).toEqual(
      expect.objectContaining({
        tenant_name: "Adithya",
        room_no: "101",
        source: "renewal_offer",
        renewal_offer_id: "offer-id",
        agreement_start_date: "2026-07-01",
        contract_rent: 8500,
        contract_security_deposit: 6000,
      })
    );
  });

  it("blocks activation if there is an unpaid security deposit obligation", async () => {
    const today = new Date("2026-07-01T00:00:00.000Z");

    const mockDraft = {
      id: "draft-agreement-id",
      tenant_id: "tenant-id",
      hostel_id: "hostel-id",
      status: "DRAFT",
      agreement_start_date: today,
      tenant: {
        owner_id: "owner-id",
        profiles: { name: "Adithya" },
        rent_obligations: [
          {
            id: "ob-1",
            agreement_id: "draft-agreement-id",
            obligation_type: "SECURITY_DEPOSIT",
            status: "PENDING",
            amount: 1000,
          },
        ],
      },
      renewed_from_agreement: {
        id: "predecessor-agreement-id",
      },
    };

    mocks.agreementFindMany.mockResolvedValue([mockDraft]);

    const summary = {
      checked: 0,
      marked_expiring: 0,
      marked_expired: 0,
      reminders_30d: 0,
      reminders_15d: 0,
      expiry_notifications: 0,
      skipped_legacy: 0,
      failed: 0,
      errors: [],
      renewals_activated: 0,
    };

    const touchedOwnerIds = new Set<string>();
    const touchedHostelIds = new Set<string>();

    await service.activateScheduledRenewals(today, summary, touchedOwnerIds, touchedHostelIds);

    expect(summary.renewals_activated).toBe(0);
    expect(summary.failed).toBe(0); // not a failure/throw, just skipped/blocked
    expect(mocks.agreementUpdate).not.toHaveBeenCalled();

    // Verify blocking event was logged
    expect(mocks.eventLogLog).toHaveBeenCalledWith(
      "RENEWAL_ACTIVATION_BLOCKED",
      "owner-id",
      expect.objectContaining({
        agreement_id: "draft-agreement-id",
        reason: "Unpaid security deposit top-up obligation",
        obligation_id: "ob-1",
        amount: 1000,
      }),
      "tenant-id"
    );
  });
});
