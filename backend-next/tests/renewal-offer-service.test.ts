import { beforeEach, describe, expect, it, vi } from "vitest";
import { RenewalOfferService } from "@/src/services/tenants/renewal-offer-service";
import { randomUUID } from "crypto";

vi.mock("@/lib/services/notifications/whatsapp-renewal-handler", () => ({
  sendRenewalOfferNotification: vi.fn().mockResolvedValue(undefined),
  sendRenewalOfferDeclinedNotification: vi.fn().mockResolvedValue(undefined),
  sendRenewalOfferDiscussionNotification: vi.fn().mockResolvedValue(undefined),
}));


const mockAgreement = {
  id: "agreement-1",
  tenant_id: "tenant-1",
  hostel_id: "hostel-1",
  template_id: "template-1",
  status: "SIGNED",
  agreement_version: 1,
  agreement_start_date: new Date("2026-01-01T00:00:00.000Z"),
  agreement_end_date: new Date("2026-06-30T00:00:00.000Z"),
  agreement_duration_months: 6,
  contract_rent: 8000,
  contract_security_deposit: 5000,
  contract_maintenance: 1000,
  contract_maintenance_type: "MONTHLY",
  contract_payment_frequency: "MONTHLY",
  hostel: {
    id: "hostel-1",
    owner_id: "owner-1",
  },
  tenant: {
    id: "tenant-1",
    security_deposit: 5000,
    tenant_financial_ledger: [
      { amount: 5000, type: "CREDIT", reason: "SECURITY_DEPOSIT_COLLECTED" }
    ],
    room_allocations: [
      {
        is_active: true,
        end_date: null,
        room: {
          room_no: "101",
          room_type: "G1",
        }
      }
    ]
  },
  renewal_offers_source: [],
};

const mockOfferFull = {
  id: "offer-1",
  agreement_id: "agreement-1",
  tenant_id: "tenant-1",
  hostel_id: "hostel-1",
  owner_id: "owner-1",
  proposed_rent: 8500,
  proposed_security_deposit: 6000,
  proposed_duration_months: 6,
  proposed_start_date: new Date("2026-07-01"),
  proposed_end_date: new Date("2027-01-01"),
  effective_from: new Date("2026-07-01"),
  additional_deposit_required: 1000,
  status: "SENT",
  agreement: { id: "agreement-1", template_id: "template-1", agreement_version: 1 },
  tenant: { id: "tenant-1", profile_id: "profile-1" },
};

function createDbMock(agreementOverride: Partial<typeof mockAgreement> = {}) {
  const agreement = { ...mockAgreement, ...agreementOverride };
  
  const txMock = {
    agreement: {
      findUnique: vi.fn().mockResolvedValue(agreement),
      findUniqueOrThrow: vi.fn().mockResolvedValue(agreement),
      create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: randomUUID(), ...data })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    tenants: {
      findUnique: vi.fn().mockResolvedValue({ id: "tenant-1", profile_id: "profile-1" }),
    },
    hostels: {
      findUnique: vi.fn().mockResolvedValue({ id: "hostel-1", owner_id: "owner-1" }),
    },
    agreementTemplate: {
      findFirst: vi.fn().mockResolvedValue({ id: "template-1" }),
      findMany: vi.fn().mockResolvedValue([
        {
          id: "template-1",
          hostel_id: "hostel-1",
          type: "RENEWAL",
          status: "PUBLISHED",
          is_active: true,
          room_category: "G1",
          default_rent: 8500,
          default_security_deposit: 7000,
          default_duration_months: 6,
          effective_from: new Date("2020-01-01"),
          effective_to: null,
        }
      ]),
    },
    renewalOffer: {
      create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: randomUUID(), ...data })),
      findUnique: vi.fn().mockResolvedValue(mockOfferFull),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => ({ id: where.id, ...data })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    bulkRenewalBatch: {
      create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: randomUUID(), ...data })),
      findUnique: vi.fn().mockResolvedValue({ id: "batch-1", owner_id: "owner-1" }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => ({ id: where.id, ...data })),
    },
    rent_obligations: {
      create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: randomUUID(), ...data })),
    },
    renewalDecision: {
      create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: randomUUID(), ...data })),
    },
  };

  const dbMock = {
    agreement: {
      findUnique: vi.fn().mockResolvedValue(agreement),
      findMany: vi.fn().mockResolvedValue([agreement]),
    },
    hostels: {
      findUnique: vi.fn().mockResolvedValue({ id: "hostel-1", owner_id: "owner-1" }),
    },
    agreementTemplate: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "template-1",
          hostel_id: "hostel-1",
          type: "RENEWAL",
          status: "PUBLISHED",
          is_active: true,
          room_category: "G1",
          default_rent: 8500,
          default_security_deposit: 7000,
          default_duration_months: 6,
          effective_from: new Date("2020-01-01"),
          effective_to: null,
        }
      ]),
    },
    renewalOffer: {
      create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: randomUUID(), ...data })),
      findUnique: vi.fn().mockResolvedValue(mockOfferFull),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => ({ id: where.id, ...data })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    bulkRenewalBatch: {
      findUnique: vi.fn().mockResolvedValue({ id: "batch-1", owner_id: "owner-1" }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => ({ id: where.id, ...data })),
    },
    tenants: {
      findUnique: vi.fn().mockResolvedValue({ id: "tenant-1", profile_id: "profile-1" }),
    },
    renewalDecision: {
      create: vi.fn().mockImplementation(async ({ data }: any) => ({ id: randomUUID(), ...data })),
    },
    $transaction: vi.fn(async (callback: any) => callback(txMock)),
  };

  return { dbMock, txMock };
}

describe("RenewalOfferService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateOffer", () => {
    it("successfully creates a draft offer with computed deposit deltas", async () => {
      const { dbMock, txMock } = createDbMock();
      const service = new RenewalOfferService(dbMock as any);

      const offer = await service.generateOffer("agreement-1", "owner-1", {
        proposed_rent: 8500,
        proposed_security_deposit: 7000,
        proposed_duration_months: 6,
        owner_notes: "V2 Offer",
      });

      expect(offer.proposed_rent).toBe(8500);
      expect(offer.proposed_security_deposit).toBe(7000);
      expect(offer.deposit_held).toBe(5000);
      expect(offer.additional_deposit_required).toBe(2000);
      expect(offer.deposit_refund_eligible).toBe(0);
      expect(offer.status).toBe("DRAFT");
    });

    it("raises error if agreement is not owned by requesting owner", async () => {
      const { dbMock } = createDbMock();
      const service = new RenewalOfferService(dbMock as any);

      await expect(
        service.generateOffer("agreement-1", "owner-other", {
          proposed_rent: 8500,
          proposed_security_deposit: 7000,
          proposed_duration_months: 6,
        })
      ).rejects.toThrow("FORBIDDEN: Not your agreement");
    });
  });

  describe("generateBulkOffers", () => {
    it("generates FLAT strategy bulk offers successfully", async () => {
      const { dbMock, txMock } = createDbMock();
      const service = new RenewalOfferService(dbMock as any);

      const result = await service.generateBulkOffers({
        ownerId: "owner-1",
        hostelId: "hostel-1",
        renewal_strategy: "FLAT",
        proposed_duration_months: 6,
        proposed_rent: 9000,
        proposed_deposit: 6000,
      });

      expect(result.offersGenerated).toBe(1);
      expect(txMock.bulkRenewalBatch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            renewal_strategy: "FLAT",
            proposed_rent: 9000,
            proposed_deposit: 6000,
          }),
        })
      );
      expect(txMock.renewalOffer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            proposed_rent: 9000,
            proposed_security_deposit: 6000,
            additional_deposit_required: 1000,
          }),
        })
      );
    });

    it("generates PERCENTAGE strategy bulk offers correctly", async () => {
      const { dbMock, txMock } = createDbMock();
      const service = new RenewalOfferService(dbMock as any);

      const result = await service.generateBulkOffers({
        ownerId: "owner-1",
        hostelId: "hostel-1",
        renewal_strategy: "PERCENTAGE",
        proposed_duration_months: 12,
        rent_increase_percent: 10, // 8000 + 10% = 8800
      });

      expect(result.offersGenerated).toBe(1);
      expect(txMock.renewalOffer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            proposed_rent: 8800,
          }),
        })
      );
    });

    it("generates ROOM_CATEGORY strategy bulk offers correctly", async () => {
      const { dbMock, txMock } = createDbMock();
      const service = new RenewalOfferService(dbMock as any);

      const result = await service.generateBulkOffers({
        ownerId: "owner-1",
        hostelId: "hostel-1",
        renewal_strategy: "ROOM_CATEGORY",
        proposed_duration_months: 12,
        category_rents: {
          G1: 9500,
          AC: 12000,
        },
      });

      expect(result.offersGenerated).toBe(1);
      expect(txMock.renewalOffer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            proposed_rent: 9500, // Matching G1
          }),
        })
      );
    });
  });

  describe("acceptOffer", () => {
    it("creates a draft agreement and generates a security deposit top-up obligation", async () => {
      const { dbMock, txMock } = createDbMock();
      const service = new RenewalOfferService(dbMock as any);

      const result = await service.acceptOffer("offer-1", "profile-1");

      expect(result.newAgreement.status).toBe("DRAFT");
      expect(result.newAgreement.contract_rent).toBe(8500);
      expect(result.newAgreement.contract_security_deposit).toBe(6000);
      expect(result.additionalDepositRequired).toBe(1000);
      expect(txMock.rent_obligations.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            obligation_type: "SECURITY_DEPOSIT",
            amount: 1000,
            status: "PENDING",
          }),
        })
      );
    });

    it("logs a structured decision history entry on acceptance", async () => {
      const { dbMock, txMock } = createDbMock();
      const service = new RenewalOfferService(dbMock as any);

      await service.acceptOffer("offer-1", "profile-1");

      expect(txMock.renewalDecision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            offer_id: "offer-1",
            decision: "ACCEPTED",
          }),
        })
      );
    });

    it("fails if the offer has expired", async () => {
      const { dbMock } = createDbMock();
      // Mock an expired offer
      const expiredOffer = {
        ...mockOfferFull,
        offer_expires_at: new Date(Date.now() - 10000), // 10s ago
      };
      dbMock.renewalOffer.findUnique = vi.fn().mockResolvedValue(expiredOffer);
      const service = new RenewalOfferService(dbMock as any);

      await expect(
        service.acceptOffer("offer-1", "profile-1")
      ).rejects.toThrow("BAD_REQUEST: This offer has expired");
    });
  });

  describe("declineOffer and discussOffer", () => {
    it("logs a structured decision history entry on decline", async () => {
      const { dbMock, txMock } = createDbMock();
      const service = new RenewalOfferService(dbMock as any);

      await service.declineOffer("offer-1", "profile-1", "Too expensive");

      expect(txMock.renewalDecision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            offer_id: "offer-1",
            decision: "DECLINED",
            reason: "Too expensive",
          }),
        })
      );
    });

    it("logs a structured decision history entry on discuss", async () => {
      const { dbMock, txMock } = createDbMock();
      const service = new RenewalOfferService(dbMock as any);

      await service.discussOffer("offer-1", "profile-1", "Can we lower deposit?");

      expect(dbMock.renewalDecision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            offer_id: "offer-1",
            decision: "SENT",
            reason: "Can we lower deposit?",
          }),
        })
      );
    });
  });

  describe("template effective date boundaries validation", () => {
    it("throws if no active template covers the effective date of the offer", async () => {
      const { dbMock } = createDbMock();
      // Return empty array from findMany to simulate no templates covering the date
      dbMock.agreementTemplate.findMany = vi.fn().mockResolvedValue([]);
      const service = new RenewalOfferService(dbMock as any);

      await expect(
        service.generateOffer("agreement-1", "owner-1", {
          proposed_rent: 8500,
          proposed_security_deposit: 7000,
          proposed_duration_months: 6,
          effective_from: new Date("2026-07-01"),
        })
      ).rejects.toThrow("BAD_REQUEST: No active agreement template covers the proposed effective date");
    });
  });
});
