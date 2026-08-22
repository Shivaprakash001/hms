import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOwnerRenewalQueue: vi.fn(),
  listOffers: vi.fn(),
}));

vi.mock("@/src/services/tenants/renewal-decision-service", () => ({
  renewalDecisionService: { getOwnerRenewalQueue: mocks.getOwnerRenewalQueue },
}));
vi.mock("@/src/services/tenants/renewal-offer-service", () => ({
  renewalOfferService: { listOffers: mocks.listOffers },
}));

import { renewalPipelineReadModelService } from "@/src/services/tenants/renewal-pipeline-read-model";

const NOW = new Date("2026-08-22T12:00:00.000Z");
const FUTURE = new Date("2026-09-06T12:00:00.000Z");
const PAST = new Date("2026-08-01T12:00:00.000Z");

/** A queue row as `evaluateAgreement` returns it — expired contract, rent overdue. */
function queueRow(overrides: Record<string, any> = {}) {
  return {
    decision_state: "EXPIRED_AND_RENT_OVERDUE",
    states: ["RENEWAL_DECISION_PENDING", "EXPIRED_AND_RENT_OVERDUE"],
    days_overdue: 22,
    days_until_expiry: null,
    has_successor: false,
    move_out_request: null,
    move_out_status: null,
    overdue_rent: { count: 4, amount: 32400 },
    tenant: { id: "tenant-1", name: "M. Durga Prasad", phone: "9999", room: { id: "room-1", room_no: "401", room_type: "G1", floor_name: "4th Floor" } },
    current_agreement: {
      id: "agreement-1",
      status: "AGREEMENT_EXPIRED",
      agreement_version: 1,
      agreement_end_date: new Date("2026-07-31"),
      contract: { rent: 8100, security_deposit: 16200 },
    },
    ...overrides,
  };
}

function offer(overrides: Record<string, any> = {}) {
  return {
    id: "offer-1",
    agreement_id: "agreement-1",
    status: "SENT",
    pipeline_status: "SENT",
    proposed_rent: 8900,
    proposed_security_deposit: 17800,
    proposed_duration_months: 6,
    additional_deposit_required: 0,
    deposit_refund_eligible: 0,
    offer_expires_at: FUTURE,
    decisions: [],
    tenant: { id: "tenant-1", profiles: { name: "M. Durga Prasad" }, room_allocations: [] },
    agreement: { id: "agreement-1", status: "AGREEMENT_EXPIRED", agreement_version: 1, agreement_end_date: new Date("2026-07-31") },
    ...overrides,
  };
}

function setup(rows: any[], offers: any[]) {
  mocks.getOwnerRenewalQueue.mockResolvedValue({ filter: "all", counts: {}, renewals: rows });
  mocks.listOffers.mockResolvedValue({ offers, pipeline: {} });
}

describe("RenewalPipelineReadModelService", () => {
  beforeEach(() => vi.clearAllMocks());

  // The bug this read model exists to fix.
  it("stages a tenant with a live sent offer as INVITED, not as an expired-contract row", async () => {
    setup([queueRow()], [offer()]);

    const { rows } = await renewalPipelineReadModelService.getPipeline("owner-1", "hostel-1", { now: NOW });

    expect(rows).toHaveLength(1);
    expect(rows[0].stage).toBe("INVITED");
    expect(rows[0].can.create_offer).toBe(false);
  });

  // Stage and urgency are separate axes — the lapsed contract and the overdue
  // rent must survive as flags rather than overwriting the lifecycle position.
  it("keeps lapsed-contract and overdue-rent as urgency flags alongside the stage", async () => {
    setup([queueRow()], [offer()]);

    const { rows } = await renewalPipelineReadModelService.getPipeline("owner-1", "hostel-1", { now: NOW });

    expect(rows[0].stage).toBe("INVITED");
    expect(rows[0].urgency.contract_lapsed).toBe(true);
    expect(rows[0].urgency.days_overdue).toBe(22);
    expect(rows[0].urgency.overdue_rent).toEqual({ count: 4, amount: 32400 });
    expect(rows[0].urgency.offer_response_due).toBe(FUTURE.toISOString());
  });

  it("stages an agreement with no offer as NEEDS_OFFER and allows creating one", async () => {
    setup([queueRow()], []);

    const { rows } = await renewalPipelineReadModelService.getPipeline("owner-1", "hostel-1", { now: NOW });

    expect(rows[0].stage).toBe("NEEDS_OFFER");
    expect(rows[0].can.create_offer).toBe(true);
    expect(rows[0].can.resend_offer).toBe(false);
  });

  it("stages a lapsed offer as OFFER_EXPIRED and offers resend instead of create", async () => {
    setup([queueRow()], [offer({ status: "EXPIRED", offer_expires_at: PAST })]);

    const { rows } = await renewalPipelineReadModelService.getPipeline("owner-1", "hostel-1", { now: NOW });

    expect(rows[0].stage).toBe("OFFER_EXPIRED");
    expect(rows[0].can.resend_offer).toBe(true);
    expect(rows[0].can.revise_offer).toBe(true);
    expect(rows[0].urgency.offer_expired_at).toBe(PAST.toISOString());
  });

  // A SENT offer past its window blocks generateOffer (it is still "active"),
  // so the UI must not show Create Offer — Resend is the only way forward.
  it("treats a sent-but-lapsed offer as expired and still forbids creating a new offer", async () => {
    setup([queueRow()], [offer({ status: "SENT", offer_expires_at: PAST })]);

    const { rows } = await renewalPipelineReadModelService.getPipeline("owner-1", "hostel-1", { now: NOW });

    expect(rows[0].stage).toBe("OFFER_EXPIRED");
    expect(rows[0].can.create_offer).toBe(false);
    expect(rows[0].can.resend_offer).toBe(true);
  });

  it("stages a sent offer the tenant asked to discuss as NEGOTIATING", async () => {
    setup([queueRow()], [offer({ decisions: [{ decision: "SENT" }] })]);

    const { rows } = await renewalPipelineReadModelService.getPipeline("owner-1", "hostel-1", { now: NOW });
    expect(rows[0].stage).toBe("NEGOTIATING");
  });

  it("splits an accepted offer by whether a deposit top-up is outstanding", async () => {
    setup([queueRow()], [offer({ status: "ACCEPTED", additional_deposit_required: 1600 })]);
    let result = await renewalPipelineReadModelService.getPipeline("owner-1", "hostel-1", { now: NOW });
    expect(result.rows[0].stage).toBe("AWAITING_PAYMENT");

    setup([queueRow()], [offer({ status: "ACCEPTED", additional_deposit_required: 0 })]);
    result = await renewalPipelineReadModelService.getPipeline("owner-1", "hostel-1", { now: NOW });
    expect(result.rows[0].stage).toBe("READY_FOR_SIGNATURE");
  });

  it("stages a move-out in progress above every offer state", async () => {
    setup(
      [queueRow({ states: ["MOVE_OUT_IN_PROGRESS"], move_out_status: "APPROVED", move_out_request: { id: "mo-1", status: "APPROVED" } })],
      [offer()],
    );

    const { rows } = await renewalPipelineReadModelService.getPipeline("owner-1", "hostel-1", { now: NOW });
    expect(rows[0].stage).toBe("MOVE_OUT");
    expect(rows[0].can.create_offer).toBe(false);
  });

  it("stages a manual renewal draft (successor, no accepted offer) as RENEWAL_DRAFTED", async () => {
    setup([queueRow({ has_successor: true })], []);

    const { rows } = await renewalPipelineReadModelService.getPipeline("owner-1", "hostel-1", { now: NOW });
    expect(rows[0].stage).toBe("RENEWAL_DRAFTED");
    expect(rows[0].can.create_offer).toBe(false);
  });

  // The union is the whole point: the expiry queue drops an agreement the moment
  // it becomes RENEWED, so an offers-only row must still appear.
  it("includes an agreement that only the offers list knows about", async () => {
    setup([], [offer({ agreement_id: "agreement-9", status: "ACCEPTED", agreement: { id: "agreement-9", status: "RENEWED", agreement_version: 1, agreement_end_date: new Date("2026-07-31") } })]);

    const { rows } = await renewalPipelineReadModelService.getPipeline("owner-1", "hostel-1", { now: NOW });

    expect(rows).toHaveLength(1);
    expect(rows[0].agreement_id).toBe("agreement-9");
    expect(rows[0].stage).toBe("RENEWED");
  });

  it("does not double-count an agreement present in both sources", async () => {
    setup([queueRow()], [offer(), offer({ id: "offer-0", status: "SUPERSEDED" })]);

    const { rows, counts } = await renewalPipelineReadModelService.getPipeline("owner-1", "hostel-1", { now: NOW });

    expect(rows).toHaveLength(1);
    expect(counts.ALL).toBe(1);
    expect(rows[0].offers_count).toBe(2);
  });

  // A superseded offer has been replaced by definition, so it must never be
  // what the row reports as the current state of play.
  it("ignores a superseded offer when resolving the current one", async () => {
    setup([queueRow()], [offer({ id: "offer-2", status: "SUPERSEDED" }), offer({ id: "offer-1", status: "SENT" })]);

    const { rows } = await renewalPipelineReadModelService.getPipeline("owner-1", "hostel-1", { now: NOW });
    expect(rows[0].latest_offer.id).toBe("offer-1");
    expect(rows[0].stage).toBe("INVITED");
  });

  it("counts every stage and filters to one when asked", async () => {
    setup(
      [queueRow(), queueRow({ current_agreement: { ...queueRow().current_agreement, id: "agreement-2" }, tenant: { id: "t2", name: "B", room: null } })],
      [offer()],
    );

    const all = await renewalPipelineReadModelService.getPipeline("owner-1", "hostel-1", { now: NOW });
    expect(all.counts.ALL).toBe(2);
    expect(all.counts.INVITED).toBe(1);
    expect(all.counts.NEEDS_OFFER).toBe(1);

    const invited = await renewalPipelineReadModelService.getPipeline("owner-1", "hostel-1", { stage: "INVITED", now: NOW });
    expect(invited.rows).toHaveLength(1);
    expect(invited.rows[0].stage).toBe("INVITED");
    // Counts stay whole-pipeline so the chips don't collapse when one is selected.
    expect(invited.counts.ALL).toBe(2);
  });

  it("sorts rows needing owner action ahead of rows waiting on the tenant", async () => {
    setup(
      [
        queueRow({ current_agreement: { ...queueRow().current_agreement, id: "a-invited" }, overdue_rent: null }),
        queueRow({ current_agreement: { ...queueRow().current_agreement, id: "a-needs" }, overdue_rent: null }),
      ],
      [offer({ agreement_id: "a-invited" })],
    );

    const { rows } = await renewalPipelineReadModelService.getPipeline("owner-1", "hostel-1", { now: NOW });
    expect(rows.map((r: any) => r.stage)).toEqual(["NEEDS_OFFER", "INVITED"]);
  });

  it("requires a hostelId rather than defaulting to the owner's first hostel", async () => {
    setup([], []);
    await expect(
      renewalPipelineReadModelService.getPipeline("owner-1", "", { now: NOW }),
    ).rejects.toThrow("BAD_REQUEST: hostelId is required");
  });
});
