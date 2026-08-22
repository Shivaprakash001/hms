import { renewalDecisionService } from "./renewal-decision-service";
import { renewalOfferService } from "./renewal-offer-service";

/**
 * 🔭 UNIFIED RENEWAL PIPELINE READ MODEL
 *
 * One row per agreement, carrying a single lifecycle `stage`, for the merged
 * owner renewal screen. Composes the two pre-existing sources rather than
 * re-querying either — the pattern CLAUDE.md mandates after the financial
 * surfaces drifted apart by each recalculating the same figures:
 *
 *   renewalDecisionService.getOwnerRenewalQueue()  → expiry/rent/move-out signals
 *   renewalOfferService.listOffers()               → offer lifecycle position
 *
 * Neither source alone is complete, which is exactly why the two owner tabs
 * disagreed. The queue only holds agreements in EXPIRING_SOON/AGREEMENT_EXPIRED,
 * so a renewal that has been accepted (predecessor → RENEWED) drops out of it;
 * offers, meanwhile, can exist against an agreement still in SIGNED. Rows are
 * therefore the **union** keyed by agreement id.
 *
 * The central correction over the old queue: `stage` and `urgency` are separate
 * axes. The queue's `EXPIRED_AND_RENT_OVERDUE` fused two independent facts (the
 * contract lapsed; rent is unpaid) into one badge that no sent offer could ever
 * suppress — so a tenant who had already been invited to renew still read as
 * "Expired", next to a Create Offer button that would 409. Here the lifecycle
 * position owns `stage`, and lapsed-contract / overdue-rent / move-out ride
 * alongside as `urgency` flags.
 */

export const RENEWAL_STAGES = [
  "NEEDS_OFFER",
  "DRAFT",
  "INVITED",
  "NEGOTIATING",
  "AWAITING_PAYMENT",
  "READY_FOR_SIGNATURE",
  "RENEWAL_DRAFTED",
  "RENEWED",
  "DECLINED",
  "OFFER_EXPIRED",
  "MOVE_OUT",
] as const;

export type RenewalStage = (typeof RENEWAL_STAGES)[number];

/** Offer statuses that still represent a live, un-resolved offer. */
const LIVE_OFFER_STATUSES = ["DRAFT", "SENT"];

function numberValue(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function isoOrNull(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(value as any);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * The offer that represents this agreement's current position. Offers arrive
 * newest-first; a SUPERSEDED row is by definition replaced by a newer one, so
 * it is skipped rather than shown as the state of play.
 */
function pickCurrentOffer(offers: any[]) {
  return offers.find((o) => o.status !== "SUPERSEDED") || offers[0] || null;
}

/**
 * Resolves the single lifecycle stage. Order matters: the first match wins, so
 * this list *is* the precedence rule.
 */
function resolveStage(input: {
  queueRow: any | null;
  offer: any | null;
  agreementStatus: string | null;
  now: Date;
}): { stage: RenewalStage; stage_reason: string | null } {
  const { queueRow, offer, agreementStatus, now } = input;

  // A move-out in flight outranks everything — renewing someone who is leaving
  // is never the next action, and `TenantRenewalPage` gates on this too.
  if (queueRow?.states?.includes("MOVE_OUT_IN_PROGRESS")) {
    return { stage: "MOVE_OUT", stage_reason: queueRow.move_out_status || "Move-out in progress" };
  }

  // Predecessor already handed over to its successor.
  if (String(agreementStatus) === "RENEWED") {
    return { stage: "RENEWED", stage_reason: null };
  }

  if (offer) {
    const lapsed =
      offer.offer_expires_at != null && new Date(offer.offer_expires_at) <= now;

    if (offer.status === "ACCEPTED") {
      // Mirrors computePipelineStatus in renewal-offer-service so the two
      // vocabularies cannot drift.
      return numberValue(offer.additional_deposit_required) > 0
        ? { stage: "AWAITING_PAYMENT", stage_reason: "Deposit top-up due before signing" }
        : { stage: "READY_FOR_SIGNATURE", stage_reason: null };
    }
    if (offer.status === "DECLINED") {
      return { stage: "DECLINED", stage_reason: offer.decline_reason || null };
    }
    // An offer past its window is expired to the tenant whether or not
    // expireStaleOffers has swept it yet — acceptOffer already rejects it.
    if (offer.status === "EXPIRED" || (LIVE_OFFER_STATUSES.includes(offer.status) && lapsed)) {
      return { stage: "OFFER_EXPIRED", stage_reason: "Tenant did not respond in time" };
    }
    if (offer.status === "SENT") {
      const isNegotiating = (offer.decisions || []).some((d: any) => d.decision === "SENT");
      return isNegotiating
        ? { stage: "NEGOTIATING", stage_reason: "Tenant asked to discuss terms" }
        : { stage: "INVITED", stage_reason: null };
    }
    if (offer.status === "DRAFT") {
      return { stage: "DRAFT", stage_reason: "Created but not sent to the tenant yet" };
    }
  }

  // A successor exists without an accepted offer — the manual renewal-draft
  // path (createRenewalDraft) rather than the offer path.
  if (queueRow?.has_successor) {
    return { stage: "RENEWAL_DRAFTED", stage_reason: "Renewal agreement drafted, pending activation" };
  }

  return { stage: "NEEDS_OFFER", stage_reason: null };
}

export class RenewalPipelineReadModelService {
  /**
   * @param hostelId required — never optional, and never defaulted to the
   * owner's first hostel (see scripts/architectural-invariants-check.ts).
   */
  async getPipeline(
    ownerId: string,
    hostelId: string,
    options: { stage?: string; now?: Date } = {},
  ) {
    if (!hostelId) throw new Error("BAD_REQUEST: hostelId is required");
    const now = options.now || new Date();

    const [queue, offersResult] = await Promise.all([
      renewalDecisionService.getOwnerRenewalQueue(ownerId, { hostelId, filter: "all", now }),
      renewalOfferService.listOffers(ownerId, hostelId, { limit: 500 }),
    ]);

    const offersByAgreement = new Map<string, any[]>();
    for (const offer of offersResult.offers || []) {
      const list = offersByAgreement.get(offer.agreement_id) || [];
      list.push(offer);
      offersByAgreement.set(offer.agreement_id, list);
    }

    const rows: any[] = [];
    const seen = new Set<string>();

    // 1. Every agreement the expiry queue knows about.
    for (const queueRow of queue.renewals || []) {
      const agreementId = queueRow.current_agreement?.id;
      if (!agreementId) continue;
      seen.add(agreementId);
      rows.push(
        this.buildRow({
          agreementId,
          queueRow,
          offers: offersByAgreement.get(agreementId) || [],
          now,
        }),
      );
    }

    // 2. Agreements that only surface through an offer — accepted renewals whose
    //    predecessor has left the queue, and offers written against an agreement
    //    still in SIGNED. Without this the merged list would silently lose every
    //    renewal the moment the tenant accepted it.
    for (const [agreementId, offers] of Array.from(offersByAgreement.entries())) {
      if (seen.has(agreementId)) continue;
      rows.push(this.buildRow({ agreementId, queueRow: null, offers, now }));
    }

    const counts = RENEWAL_STAGES.reduce(
      (acc, stage) => {
        acc[stage] = rows.filter((row) => row.stage === stage).length;
        return acc;
      },
      { ALL: rows.length } as Record<string, number>,
    );

    const sorted = rows.sort((a, b) => rankRow(a) - rankRow(b) || sortKey(a) - sortKey(b));
    const filtered =
      options.stage && options.stage !== "ALL"
        ? sorted.filter((row) => row.stage === options.stage)
        : sorted;

    return { hostel_id: hostelId, stage: options.stage || "ALL", counts, rows: filtered };
  }

  private buildRow(input: { agreementId: string; queueRow: any | null; offers: any[]; now: Date }) {
    const { agreementId, queueRow, offers, now } = input;
    const offer = pickCurrentOffer(offers);

    // Tenant/room details come from the queue when it has the agreement (richer
    // payload, includes floor name); otherwise from the offer's own tenant include.
    const offerTenant = offer?.tenant;
    const offerRoom = offerTenant?.room_allocations?.[0]?.room || null;
    const tenant = queueRow?.tenant || {
      id: offerTenant?.id || null,
      name: offerTenant?.profiles?.name || null,
      phone: offerTenant?.profiles?.phone || null,
      room: offerRoom ? { id: offerRoom.id || null, room_no: offerRoom.room_no, room_type: offerRoom.room_type, floor_name: null } : null,
    };

    const queueAgreement = queueRow?.current_agreement || null;
    const offerAgreement = offer?.agreement || null;
    const agreementStatus = queueAgreement?.status || offerAgreement?.status || null;

    const agreement = {
      id: agreementId,
      status: agreementStatus,
      agreement_version: queueAgreement?.agreement_version ?? offerAgreement?.agreement_version ?? 1,
      agreement_end_date: queueAgreement?.agreement_end_date ?? offerAgreement?.agreement_end_date ?? null,
      // current_rent on the offer is a snapshot of the predecessor's terms, so
      // it is a valid fallback when the queue doesn't carry this agreement.
      rent: numberValue(queueAgreement?.contract?.rent ?? offer?.current_rent),
      security_deposit: numberValue(queueAgreement?.contract?.security_deposit ?? offer?.current_security_deposit),
    };

    const { stage, stage_reason } = resolveStage({ queueRow, offer, agreementStatus, now });

    const offerLapsed = Boolean(offer?.offer_expires_at) && new Date(offer.offer_expires_at) <= now;

    return {
      agreement_id: agreementId,
      tenant,
      agreement,
      stage,
      stage_reason,
      latest_offer: offer
        ? {
            id: offer.id,
            status: offer.status,
            pipeline_status: offer.pipeline_status,
            proposed_rent: numberValue(offer.proposed_rent),
            proposed_security_deposit: numberValue(offer.proposed_security_deposit),
            proposed_duration_months: offer.proposed_duration_months,
            proposed_start_date: offer.proposed_start_date,
            proposed_end_date: offer.proposed_end_date,
            additional_deposit_required: numberValue(offer.additional_deposit_required),
            deposit_refund_eligible: numberValue(offer.deposit_refund_eligible),
            offer_expires_at: offer.offer_expires_at,
            sent_at: offer.sent_at,
            owner_notes: offer.owner_notes,
            decline_reason: offer.decline_reason,
            is_custom_override: offer.is_custom_override,
          }
        : null,
      offers_count: offers.length,

      // Independent of `stage` — these are why a row is *urgent*, not where it
      // sits in the lifecycle. Fusing the two is the bug this read model fixes.
      urgency: {
        contract_lapsed: String(agreementStatus) === "AGREEMENT_EXPIRED",
        days_overdue: numberValue(queueRow?.days_overdue),
        days_until_expiry: queueRow?.days_until_expiry ?? null,
        past_grace_period: Boolean(queueRow?.states?.includes("RENEWAL_OVERDUE_CRITICAL")),
        overdue_rent: queueRow?.overdue_rent?.count > 0 ? queueRow.overdue_rent : null,
        move_out: queueRow?.move_out_request || null,
        offer_response_due: stage === "INVITED" || stage === "NEGOTIATING" ? isoOrNull(offer?.offer_expires_at) : null,
        offer_expired_at: stage === "OFFER_EXPIRED" ? isoOrNull(offer?.offer_expires_at) : null,
      },

      // Which actions the owner can actually take, resolved server-side against
      // the same rules the services enforce — so the UI never renders a button
      // whose endpoint will reject it (the dead "Revise on declined" button and
      // the 409-ing "Create Offer" both came from the UI guessing).
      can: {
        // generateOffer refuses when a DRAFT/SENT offer already exists, or when
        // the agreement has left CURRENT_AGREEMENT_STATUSES. A lapsed-but-unswept
        // offer is still SENT, so it blocks creation too — Resend is the way out.
        create_offer:
          !(offer && LIVE_OFFER_STATUSES.includes(offer.status)) &&
          ["EXPIRING_SOON", "AGREEMENT_EXPIRED", "SIGNED"].includes(String(agreementStatus)) &&
          stage !== "MOVE_OUT" &&
          !queueRow?.has_successor,
        send_offer: offer?.status === "DRAFT" && !offerLapsed,
        resend_offer: stage === "OFFER_EXPIRED",
        revise_offer: Boolean(offer) && ["DRAFT", "SENT", "DECLINED", "EXPIRED"].includes(offer.status),
      },

      // Carried through for callers still keyed on the old vocabulary.
      decision_state: queueRow?.decision_state || null,
      states: queueRow?.states || [],
      renewal_blocked_reason: queueRow?.renewal_blocked_reason || null,
      has_successor: Boolean(queueRow?.has_successor),
      current_agreement: queueAgreement,
    };
  }
}

/** Most-urgent first: things needing the owner to act, then things waiting on the tenant. */
function rankRow(row: any): number {
  const order: Record<string, number> = {
    NEEDS_OFFER: 0,
    OFFER_EXPIRED: 1,
    DECLINED: 2,
    DRAFT: 3,
    AWAITING_PAYMENT: 4,
    READY_FOR_SIGNATURE: 5,
    RENEWAL_DRAFTED: 6,
    NEGOTIATING: 7,
    INVITED: 8,
    MOVE_OUT: 9,
    RENEWED: 10,
  };
  const base = order[row.stage] ?? 11;
  // Within a stage, an overdue-rent row outranks a clean one.
  return base * 2 + (row.urgency?.overdue_rent ? 0 : 1);
}

function sortKey(row: any): number {
  const end = row.agreement?.agreement_end_date ? new Date(row.agreement.agreement_end_date).getTime() : Number.MAX_SAFE_INTEGER;
  return end;
}

export const renewalPipelineReadModelService = new RenewalPipelineReadModelService();
